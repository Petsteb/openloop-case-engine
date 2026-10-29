"""Load test for the OpenLoop API: simulated bank staff and client-portal users (stdlib + httpx only).

Each user behaves like the real UIs (web/src): it polls the cheap change detectors every ~2.5 s
(`/api/version`, `/api/cases/{id}/version`) and refetches the heavy views only when something changed.
- Staff (case screen + work queue): the bundle of its case, the queue and the bell when the global version
  moved; now and then it opens another case. Small share of writes: `POST /advance {days: 1}` on a synthetic
  file, rarely `POST /api/cases` (opens a new file).
- Client (portal): the client view and the message thread of its file when its version moved, its "my files"
  list when the global version moved. Small share of writes: `POST /messages` with role=client.
Writes only target synthetic files (never demo-1). Nothing here calls a paid service: run the server offline
(AGENT_MODE=scripted JUDGE_MODE=heuristic EMAIL_MODE=outbox), and never against the live demo server.

    python backend/scripts/loadtest.py --base http://127.0.0.1:8400 --users 50 --seconds 30
    python backend/scripts/loadtest.py --users 200 --procs 4     # one Python client process tops out near 300 RPS
    python backend/scripts/loadtest.py --users 16 --think 0      # closed loop, no think time: saturation
    python backend/scripts/loadtest.py --cookie "session=..."     # once login lands (raw Cookie header value)
    python backend/scripts/loadtest.py --pid 1234                # also sample the server's RSS and CPU (needs psutil)

Reports per endpoint: count, RPS, p50 / p95 / p99 latency in ms (requests started after the warm-up), and errors
(non-2xx or transport failures, whole run).
"""
import argparse
import asyncio
import json
import math
import os
import random
import statistics
import subprocess
import sys
import tempfile
import threading
import time
from collections import defaultdict
from urllib.parse import urlparse

import httpx

SYNTHETIC_MESSAGES = ["Bună ziua, am încărcat documentele cerute.", "When will you have an answer?",
                      "Mulțumim, revenim cu certificatul.", "Is anything else missing from our file?"]


class Stats:
    def __init__(self, start: float):
        self.start = start  # wall clock (time.time()) shared by every worker process
        self.samples: dict[str, list[list]] = defaultdict(list)  # name -> [[t since start, ms, ok], ...]
        self.err_samples: dict[str, str] = {}

    def add(self, name: str, t_start: float, ms: float, ok: bool, detail: str = "") -> None:
        self.samples[name].append([round(t_start - self.start, 3), round(ms, 2), ok])
        if not ok:
            self.err_samples.setdefault(name, detail[:200])


def pct(values: list[float], p: float) -> float:
    if not values:
        return float("nan")
    s = sorted(values)
    return s[max(0, min(len(s) - 1, math.ceil(p / 100 * len(s)) - 1))]  # nearest rank


class Client:
    """httpx wrapper that times every call under a stable endpoint name."""

    def __init__(self, http: httpx.AsyncClient, stats: Stats):
        self.http, self.stats = http, stats

    async def call(self, name: str, method: str, path: str, **kw):
        wall, t0 = time.time(), time.perf_counter()
        try:
            r = await self.http.request(method, path, **kw)
            ok = 200 <= r.status_code < 300
            self.stats.add(name, wall, (time.perf_counter() - t0) * 1000, ok, f"HTTP {r.status_code}: {r.text[:120]}")
            return r.json() if ok else None
        except Exception as exc:  # timeouts, refused connections: counted as errors, the user keeps going
            self.stats.add(name, wall, (time.perf_counter() - t0) * 1000, False, f"{type(exc).__name__}: {exc}")
            return None


async def sleep_think(think: float) -> None:
    if think > 0:
        await asyncio.sleep(random.uniform(0.8, 1.2) * think)  # jitter, so users don't poll in lock-step


async def staff_user(c: Client, world: dict, args, stop: float):
    cases, writable, company_of = world["cases"], world["writable"], world["company_of"]
    case_id = random.choice(cases)
    await c.call("GET /api/cases?role=employee", "GET", "/api/cases", params={"role": "employee"})
    await c.call("GET /api/cases/{id}/bundle", "GET", f"/api/cases/{case_id}/bundle")
    seen_global, seen_case = None, None
    while time.time() < stop:
        await sleep_think(args.think)
        g = await c.call("GET /api/version", "GET", "/api/version")
        v = await c.call("GET /api/cases/{id}/version", "GET", f"/api/cases/{case_id}/version")
        if g and g != seen_global:  # the queue and the bell refetch when anything changed anywhere
            if seen_global is not None:
                await c.call("GET /api/cases?role=employee", "GET", "/api/cases", params={"role": "employee"})
                await c.call("GET /api/notifications?role=employee", "GET", "/api/notifications",
                             params={"role": "employee"})
            seen_global = g
        if v and v != seen_case:  # the case screen refetches the bundle only when its ledger changed
            if seen_case is not None:
                await c.call("GET /api/cases/{id}/bundle", "GET", f"/api/cases/{case_id}/bundle")
            seen_case = v
        roll = random.random()
        if args.writes and roll < args.p_new_case:
            company = random.choice(world["companies"])
            body = {"template": random.choice(company["templates"]), "company_id": company["id"]}
            b = await c.call("POST /api/cases", "POST", "/api/cases", json=body)
            if b:
                new = b["case"]["id"]
                writable.append(new)
                cases.append(new)
                company_of[new] = company["id"]
        elif args.writes and roll < args.p_new_case + args.p_advance:
            target = random.choice(writable)
            await c.call("POST /api/cases/{id}/advance", "POST", f"/api/cases/{target}/advance", json={"days": 1})
        elif roll > 1 - args.p_switch:  # open another file: the queue, then its bundle
            case_id, seen_case = random.choice(cases), None
            await c.call("GET /api/cases?role=employee", "GET", "/api/cases", params={"role": "employee"})
            await c.call("GET /api/cases/{id}/bundle", "GET", f"/api/cases/{case_id}/bundle")


async def client_user(c: Client, world: dict, args, stop: float):
    case_id = random.choice(world["writable"])  # a portal user owns one synthetic file
    company = world["company_of"].get(case_id, "aurora")
    await c.call("GET /api/cases?role=client", "GET", "/api/cases", params={"role": "client", "company_id": company})
    await c.call("GET /api/cases/{id}/client-view", "GET", f"/api/cases/{case_id}/client-view")
    await c.call("GET /api/cases/{id}/messages?role=client", "GET", f"/api/cases/{case_id}/messages",
                 params={"role": "client"})
    seen_global, seen_case = None, None
    while time.time() < stop:
        await sleep_think(args.think)
        g = await c.call("GET /api/version", "GET", "/api/version")
        v = await c.call("GET /api/cases/{id}/version", "GET", f"/api/cases/{case_id}/version")
        if g and g != seen_global:
            if seen_global is not None:
                await c.call("GET /api/cases?role=client", "GET", "/api/cases",
                             params={"role": "client", "company_id": company})
            seen_global = g
        if v and v != seen_case:
            if seen_case is not None:
                await c.call("GET /api/cases/{id}/client-view", "GET", f"/api/cases/{case_id}/client-view")
                await c.call("GET /api/cases/{id}/messages?role=client", "GET", f"/api/cases/{case_id}/messages",
                             params={"role": "client"})
            seen_case = v
        if args.writes and random.random() < args.p_message:
            await c.call("POST /api/cases/{id}/messages", "POST", f"/api/cases/{case_id}/messages",
                         json={"role": "client", "text": random.choice(SYNTHETIC_MESSAGES)})


async def run_users(args, users: int, n_staff: int, start: float) -> dict:
    """One process worth of users. Returns raw samples, merged by the parent when --procs > 1."""
    headers = {"Cookie": args.cookie} if args.cookie else {}
    limits = httpx.Limits(max_connections=users + 10, max_keepalive_connections=users + 10)
    async with httpx.AsyncClient(base_url=args.base, headers=headers, limits=limits, timeout=args.timeout) as http:
        boot = Client(http, Stats(start))
        rows = await boot.call("setup", "GET", "/api/cases", params={"role": "employee"})
        companies = await boot.call("setup", "GET", "/api/companies")
        if not rows or not companies:
            sys.exit(f"cannot read /api/cases or /api/companies from {args.base}: {boot.stats.err_samples}")
        world = {"cases": [r["id"] for r in rows], "companies": companies,
                 "writable": [r["id"] for r in rows if r["id"] != "demo-1"] or [r["id"] for r in rows],
                 "company_of": {r["id"]: r["company_id"] for r in rows}}
        stats = Stats(start)
        c = Client(http, stats)
        await asyncio.sleep(max(0.0, start - time.time()))  # every worker process starts at the same moment
        cpu0 = time.process_time()
        stop = start + args.warmup + args.seconds

        async def user(i: int):
            await asyncio.sleep(random.uniform(0, max(args.think, 0.5)))  # staggered start, like people arriving
            await (staff_user if i < n_staff else client_user)(c, world, args, stop)

        await asyncio.gather(*(user(i) for i in range(users)))
        return {"samples": stats.samples, "err_samples": stats.err_samples, "elapsed": time.time() - start,
                "cpu_s": time.process_time() - cpu0, "users": users, "staff": n_staff}


def sample_server(pid: int, halt: threading.Event, start: float, out: dict) -> None:
    """RSS (on Windows: the working set) and CPU % of the server process, every 0.5 s."""
    try:
        import psutil  # optional: only used with --pid
    except ImportError:
        out["error"] = "psutil not importable: no server sampling"
        return
    try:
        p = psutil.Process(pid)
        out["rss_before_mb"] = p.memory_info().rss / 2**20
        p.cpu_percent(None)
        rows = []
        while not halt.wait(0.5):
            rows.append((time.time() - start, p.memory_info().rss / 2**20, p.cpu_percent(None)))
    except psutil.Error as exc:
        out["error"] = type(exc).__name__
        return
    out["rows"] = rows
    out["cpu_cores"] = psutil.cpu_count()


def report(args, parts: list[dict], server: dict, final_version) -> dict:
    merged: dict[str, list] = defaultdict(list)
    errors: dict[str, str] = {}
    for part in parts:
        for name, rows in part["samples"].items():
            merged[name] += rows
        for name, sample in part["err_samples"].items():
            errors.setdefault(name, sample)
    elapsed = max(p["elapsed"] for p in parts)
    window = max(0.001, min(args.seconds, elapsed - args.warmup))
    measured = {n: [r for r in rows if r[0] >= args.warmup] for n, rows in merged.items()}
    every = [r[1] for rows in measured.values() for r in rows]
    total = len(every)
    out = {"base": args.base, "users": sum(p["users"] for p in parts), "staff": sum(p["staff"] for p in parts),
           "procs": len(parts), "think_s": args.think, "warmup_s": args.warmup, "seconds": round(window, 1),
           "requests": total, "rps": round(total / window, 1),
           "errors": sum(1 for rows in merged.values() for r in rows if not r[2]),
           "requests_whole_run": sum(len(rows) for rows in merged.values()),
           "client_cpu_pct": round(sum(p["cpu_s"] for p in parts) / elapsed * 100),
           "server_version_after": final_version, "endpoints": {}, "error_samples": errors}
    out["p50_ms"], out["p95_ms"], out["p99_ms"] = (round(pct(every, q), 1) for q in (50, 95, 99))
    for name in sorted(measured, key=lambda n: -len(measured[n])):
        lat = [r[1] for r in measured[name]]
        out["endpoints"][name] = {"count": len(lat), "rps": round(len(lat) / window, 2),
                                  "p50_ms": round(pct(lat, 50), 1), "p95_ms": round(pct(lat, 95), 1),
                                  "p99_ms": round(pct(lat, 99), 1),
                                  "errors": sum(1 for r in merged[name] if not r[2])}
    rows = [r for r in server.get("rows", []) if r[0] >= args.warmup]
    out["server"] = {k: v for k, v in server.items() if k != "rows"}
    if rows:
        out["server"].update(rss_peak_mb=round(max(r[1] for r in rows), 1), rss_after_mb=round(rows[-1][1], 1),
                             cpu_mean_pct=round(statistics.mean(r[2] for r in rows)),
                             cpu_peak_pct=round(max(r[2] for r in rows)))
    return out


def print_report(r: dict) -> None:
    print(f"\n{r['users']} users ({r['staff']} staff, {r['users'] - r['staff']} client) in {r['procs']} process(es), "
          f"think {r['think_s']} s, measured {r['seconds']} s after a {r['warmup_s']} s warm-up, against {r['base']}")
    print(f"{'endpoint':42s} {'count':>7s} {'rps':>8s} {'p50 ms':>8s} {'p95 ms':>8s} {'p99 ms':>8s} {'errors':>7s}")
    for name, e in r["endpoints"].items():
        print(f"{name:42s} {e['count']:7d} {e['rps']:8.2f} {e['p50_ms']:8.1f} {e['p95_ms']:8.1f} {e['p99_ms']:8.1f} "
              f"{e['errors']:7d}")
    print(f"{'TOTAL':42s} {r['requests']:7d} {r['rps']:8.1f} {r['p50_ms']:8.1f} {r['p95_ms']:8.1f} {r['p99_ms']:8.1f} "
          f"{r['errors']:7d}")
    s = r["server"]
    if "rss_peak_mb" in s:
        print(f"server: RSS {s['rss_before_mb']:.0f} MB before, peak {s['rss_peak_mb']:.0f} MB, after {s['rss_after_mb']:.0f} MB; "
              f"CPU mean {s['cpu_mean_pct']}%, peak {s['cpu_peak_pct']}% (100% = one core of {s['cpu_cores']})")
    elif s.get("error"):
        print(f"server sampling: {s['error']}")
    print(f"load generator CPU: {r['client_cpu_pct']}% (100% = one core); server /api/version after: "
          f"{r['server_version_after']}")
    for name, sample in r["error_samples"].items():
        print(f"  first error on {name}: {sample}")


def run(args) -> dict:
    start = args.start_at or time.time() + (1.5 if args.procs > 1 else 0.3)
    split = [args.users // args.procs + (1 if i < args.users % args.procs else 0) for i in range(args.procs)]
    staff = [round(n * args.staff_share) for n in split]
    server, halt = {}, threading.Event()
    sampler = threading.Thread(target=sample_server, args=(args.pid, halt, start, server), daemon=True) if args.pid else None
    if sampler:
        sampler.start()
    if args.procs == 1:
        parts = [asyncio.run(run_users(args, split[0], staff[0], start))]
    else:  # one Python client process saturates near 300 RPS: spread the users over worker processes
        tmp = tempfile.mkdtemp(prefix="openloop-load-")
        workers, outs = [], []
        for i, (n, s) in enumerate(zip(split, staff)):
            out = os.path.join(tmp, f"worker-{i}.json")
            cmd = [sys.executable, os.path.abspath(__file__), "--base", args.base, "--users", str(n),
                   "--staff-share", str(s / n if n else 0), "--seconds", str(args.seconds), "--warmup", str(args.warmup),
                   "--think", str(args.think), "--timeout", str(args.timeout), "--start-at", str(start),
                   "--p-message", str(args.p_message), "--p-advance", str(args.p_advance),
                   "--p-new-case", str(args.p_new_case), "--p-switch", str(args.p_switch), "--worker-out", out,
                   "--force"]
            cmd += ["--seed", str(args.seed + i)] if args.seed is not None else []
            cmd += ["--cookie", args.cookie] if args.cookie else []
            cmd += [] if args.writes else ["--no-writes"]
            workers.append(subprocess.Popen(cmd))
            outs.append(out)
        for w in workers:
            w.wait()
        parts = []
        for out in outs:
            with open(out, encoding="utf-8") as f:
                parts.append(json.load(f))
            os.remove(out)
        os.rmdir(tmp)
    halt.set()
    if sampler:
        sampler.join(timeout=2)
    try:
        final = httpx.get(args.base.rstrip("/") + "/api/version", headers={"Cookie": args.cookie} if args.cookie else {},
                          timeout=args.timeout).json()
    except Exception as exc:
        final = f"unavailable ({type(exc).__name__})"
    return report(args, parts, server, final)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--base", default="http://127.0.0.1:8400", help="server base URL (default: %(default)s)")
    ap.add_argument("--users", type=int, default=10, help="concurrent simulated users (default: %(default)s)")
    ap.add_argument("--seconds", type=float, default=30, help="measured duration after the warm-up (default: %(default)s)")
    ap.add_argument("--warmup", type=float, default=5, help="seconds of traffic not measured while users arrive "
                                                            "(default: %(default)s)")
    ap.add_argument("--cookie", default=None, help="raw Cookie header value sent on every request (login session)")
    ap.add_argument("--think", type=float, default=2.5, help="seconds between a user's polls; the UIs use 2.5-3 s; "
                                                             "0 = closed loop (default: %(default)s)")
    ap.add_argument("--staff-share", type=float, default=0.5, help="share of users that are bank staff (default: %(default)s)")
    ap.add_argument("--no-writes", dest="writes", action="store_false", help="read-only traffic")
    ap.add_argument("--p-message", type=float, default=0.03, help="per client poll: chance to post a message")
    ap.add_argument("--p-advance", type=float, default=0.02, help="per staff poll: chance to skip a file 1 day")
    ap.add_argument("--p-new-case", type=float, default=0.005, help="per staff poll: chance to open a new file")
    ap.add_argument("--p-switch", type=float, default=0.03, help="per staff poll: chance to open another file")
    ap.add_argument("--timeout", type=float, default=30, help="per-request timeout in seconds")
    ap.add_argument("--procs", type=int, default=1, help="client worker processes the users are spread over")
    ap.add_argument("--pid", type=int, default=None, help="server process id: sample its RSS and CPU (needs psutil)")
    ap.add_argument("--json", default=None, help="also write the report as JSON to this path")
    ap.add_argument("--seed", type=int, default=None, help="random seed, for a repeatable traffic mix")
    ap.add_argument("--force", action="store_true", help="allow writes to localhost:8000 (the live demo server)")
    ap.add_argument("--start-at", type=float, default=None, help=argparse.SUPPRESS)  # worker processes only
    ap.add_argument("--worker-out", default=None, help=argparse.SUPPRESS)
    a = ap.parse_args()
    u = urlparse(a.base)
    if u.hostname in ("localhost", "127.0.0.1", "::1") and (u.port or 80) == 8000 and a.writes and not a.force:
        sys.exit("refusing to write synthetic load to localhost:8000 (the live demo server); use another port, "
                 "--no-writes, or --force")
    if a.seed is not None:
        random.seed(a.seed)
    if a.worker_out:  # a worker process: raw samples to a file, the parent merges and reports
        n_staff = round(a.users * a.staff_share)
        part = asyncio.run(run_users(a, a.users, n_staff, a.start_at or time.time()))
        with open(a.worker_out, "w", encoding="utf-8") as f:
            json.dump(part, f)
        sys.exit(0)
    a.procs = max(1, min(a.procs, a.users))
    result = run(a)
    print_report(result)
    if a.json:
        with open(a.json, "w", encoding="utf-8") as f:
            json.dump(result, f, indent=2, ensure_ascii=False)
