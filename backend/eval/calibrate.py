"""Calibrate the judge threshold: tune on one half of eval/pairs.jsonl, confirm on the other.

A "false approval" is the only error that matters: the judge's top label is `same_*` with p >= threshold
(so the engine would auto-accept) for a pair labelled "different". The chosen threshold is the lowest one with
zero false approvals on the tune split; the test split then shows how that choice generalises.

    python backend/eval/calibrate.py [--mode featherless|heuristic]    (no --mode: both)

Writes backend/eval/calibration.json (merged by mode) and docs/pitch/calibration.png (if matplotlib imports).
"""
import argparse
import json
import os
import sys
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
BACKEND = HERE.parent
ROOT = BACKEND.parent
PAIRS = HERE / "pairs.jsonl"
CALIBRATION = HERE / "calibration.json"
CHART = ROOT / "docs" / "pitch" / "calibration.png"
THRESHOLDS = [0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.99]
SPLITS = ("tune", "test")


def _top(result: dict) -> tuple[str, float]:
    """Accepts a judge.judge() result (has "probs") or a bare probabilities dict."""
    probs = result["probs"] if "probs" in result else result
    top = max(probs, key=probs.get)
    return top, float(probs[top])


def _metrics(scored: list[tuple[str, str, float]], threshold: float) -> dict:
    n = len(scored)
    accepted = [(label, top, p) for label, top, p in scored if top.startswith("same") and p >= threshold]
    false_approvals = sum(1 for label, _, _ in accepted if label == "different")
    return {"n": n, "auto_accepted": len(accepted),
            "auto_accept_rate": round(len(accepted) / n, 4) if n else 0.0,
            "false_approvals": false_approvals,
            "manual_review_rate": round(1 - len(accepted) / n, 4) if n else 0.0,
            "accuracy_of_accepted": round((len(accepted) - false_approvals) / len(accepted), 4) if accepted else None}


def run(rows: list[dict], probs_fn, thresholds: list[float] = THRESHOLDS) -> dict:
    """probs_fn(kind, a, b) -> probabilities dict, or a judge.judge()-style result. Called once per row."""
    scored: dict[str, list[tuple[str, str, float]]] = {s: [] for s in SPLITS}
    for row in rows:
        top, p = _top(probs_fn(row["kind"], row["a"], row["b"]))
        scored[row["split"]].append((row["label"], top, p))
    per_threshold = {str(t): {s: _metrics(scored[s], t) for s in SPLITS} for t in thresholds}
    chosen = next((t for t in sorted(thresholds) if per_threshold[str(t)]["tune"]["false_approvals"] == 0), None)
    return {"thresholds": list(thresholds), "n": {s: len(scored[s]) for s in SPLITS},
            "per_threshold": per_threshold, "chosen": chosen,
            "test_at_chosen": per_threshold[str(chosen)]["test"] if chosen is not None else None}


def load_rows(path: Path = PAIRS) -> list[dict]:
    return [json.loads(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def _judge_fn(stats: dict):
    """judge.judge with retry: judge() swallows API errors into a heuristic fallback, which must not leak into
    a Featherless calibration. Back off and retry; if it still fails, count it and report it."""
    from app import judge as J

    def fn(kind, a, b):
        for attempt, wait in enumerate((0, 2, 4, 8, 16)):
            time.sleep(wait)
            out = J.judge(kind, a, b)
            src = out["source"]
            if src == "featherless (cached)" or not src.startswith("heuristic (featherless failed"):
                stats["cached" if src.endswith("(cached)") else "live"] += 1
                if src == "featherless":
                    time.sleep(0.15)  # be polite to the API; only uncached calls
                return out
        stats["failed"] += 1
        return out
    return fn


def run_mode(mode: str) -> dict:
    os.environ["JUDGE_MODE"] = mode  # after load_dotenv: --mode must win over .env
    rows = load_rows()
    stats = {"live": 0, "cached": 0, "failed": 0}
    res = run(rows, _judge_fn(stats))
    res["mode"] = mode
    if mode == "featherless":
        res["model"] = os.environ.get("FEATHERLESS_MODEL") or "default"
        res["calls"] = stats
        if stats["failed"]:
            print(f"WARNING: {stats['failed']} Featherless calls failed after retries and fell back to the heuristic; "
                  "re-run to fill the cache before trusting these numbers.", file=sys.stderr)
    return res


def write_json(results: dict[str, dict]) -> dict:
    merged = {}
    if CALIBRATION.exists():
        try:
            merged = json.loads(CALIBRATION.read_text(encoding="utf-8"))
        except ValueError:
            merged = {}
    merged.update(results)
    tmp = CALIBRATION.with_suffix(".json.tmp")
    tmp.write_text(json.dumps(merged, indent=1, ensure_ascii=False), encoding="utf-8")
    os.replace(tmp, CALIBRATION)
    return merged


def draw_chart(merged: dict, current: float = 0.9) -> bool:
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
    except ImportError:
        print("matplotlib not installed: skipping docs/pitch/calibration.png")
        return False
    modes = [m for m in ("heuristic", "featherless") if m in merged]
    colors = {"heuristic": "#6b7280", "featherless": "#2563eb"}
    fig, axes = plt.subplots(1, 2, figsize=(11, 4.2))
    for mode in modes:
        res = merged[mode]
        ts = res["thresholds"]
        fa = [res["per_threshold"][str(t)]["tune"]["false_approvals"] + res["per_threshold"][str(t)]["test"]["false_approvals"] for t in ts]
        rate = [100 * (res["per_threshold"][str(t)]["tune"]["auto_accepted"] + res["per_threshold"][str(t)]["test"]["auto_accepted"])
                / max(1, res["n"]["tune"] + res["n"]["test"]) for t in ts]
        axes[0].plot(ts, fa, marker="o", color=colors[mode], label=mode)
        axes[1].plot(ts, rate, marker="o", color=colors[mode], label=mode)
        if res.get("chosen") is not None:
            for ax, ys in ((axes[0], fa), (axes[1], rate)):
                ax.scatter([res["chosen"]], [ys[ts.index(res["chosen"])]], s=140, facecolors="none", edgecolors=colors[mode], linewidths=2)
    unsafe = [m for m in modes if merged[m].get("chosen") is None]
    if unsafe:
        axes[0].text(0.97, 0.3, "\n".join(f"{m}: no threshold reaches\n0 false approvals on tune" for m in unsafe),
                     transform=axes[0].transAxes, ha="right", va="center", fontsize=8, color=colors[unsafe[0]], zorder=5,
                     bbox={"facecolor": "white", "edgecolor": "none", "alpha": 0.9})
    for ax, title, ylabel in ((axes[0], "False approvals (lower is better)", "pairs wrongly auto-accepted"),
                              (axes[1], "Auto-accepted pairs", "% of all pairs")):
        ax.axvline(current, color="#dc2626", linestyle="--", linewidth=1, label=f"current threshold {current}")
        ax.set_title(title)
        ax.set_xlabel("judge threshold")
        ax.set_ylabel(ylabel)
        ax.grid(alpha=0.25)
        ax.legend(frameon=False)
    fig.suptitle("Judge calibration on 150 labelled pairs (circled: lowest threshold with 0 false approvals on tune)", fontsize=10)
    fig.tight_layout()
    CHART.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(CHART, dpi=150)
    plt.close(fig)
    return True


def print_summary(merged: dict) -> None:
    for mode in ("heuristic", "featherless"):
        if mode not in merged:
            continue
        res = merged[mode]
        print(f"\n== {mode} (n tune={res['n']['tune']}, test={res['n']['test']}) chosen={res['chosen']} ==")
        print(f"{'thr':>5} | {'tune acc%':>9} {'FA':>3} {'prec':>5} | {'test acc%':>9} {'FA':>3} {'prec':>5}")
        for t in res["thresholds"]:
            tu, te = res["per_threshold"][str(t)]["tune"], res["per_threshold"][str(t)]["test"]
            f = lambda m: "  -  " if m["accuracy_of_accepted"] is None else f"{m['accuracy_of_accepted']:.2f}"
            print(f"{t:>5} | {100 * tu['auto_accept_rate']:>9.1f} {tu['false_approvals']:>3} {f(tu):>5} | "
                  f"{100 * te['auto_accept_rate']:>9.1f} {te['false_approvals']:>3} {f(te):>5}")
        if res["test_at_chosen"]:
            print("test at chosen:", res["test_at_chosen"])
        if res.get("calls"):
            print("calls:", res["calls"])


def main() -> None:
    from dotenv import load_dotenv
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=["featherless", "heuristic"], help="default: both")
    args = parser.parse_args()
    load_dotenv(ROOT / ".env")
    sys.path.insert(0, str(BACKEND))
    results = {m: run_mode(m) for m in ([args.mode] if args.mode else ["heuristic", "featherless"])}
    merged = write_json(results)
    print(f"wrote {CALIBRATION}")
    draw_chart(merged)
    print_summary(merged)


if __name__ == "__main__":
    main()
