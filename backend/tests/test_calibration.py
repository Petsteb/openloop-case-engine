import importlib.util
from pathlib import Path

_spec = importlib.util.spec_from_file_location("calibrate", Path(__file__).resolve().parents[1] / "eval" / "calibrate.py")
calibrate = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(calibrate)

# (id, split, label) -> p(same) the fake judge returns; "d*" rows are labelled different
ROWS = [
    {"id": "t1", "kind": "address", "a": "t1", "b": "x", "label": "same", "split": "tune"},
    {"id": "t2", "kind": "address", "a": "t2", "b": "x", "label": "same", "split": "tune"},
    {"id": "t3", "kind": "address", "a": "t3", "b": "x", "label": "different", "split": "tune"},       # false approval at <= 0.85
    {"id": "t4", "kind": "address", "a": "t4", "b": "x", "label": "different", "split": "tune"},       # top is "different" at 0.95: never accepted
    {"id": "s1", "kind": "address", "a": "s1", "b": "x", "label": "same", "split": "test"},
    {"id": "s2", "kind": "address", "a": "s2", "b": "x", "label": "different", "split": "test"},       # 0.97 same: false approval on test at 0.9
]
P_SAME = {"t1": 0.99, "t2": 0.92, "t3": 0.86, "t4": 0.05, "s1": 0.95, "s2": 0.97}


def fake_probs(kind, a, b):
    p = P_SAME[a]
    return {"same_address": p, "different_address": round(1 - p, 2)}


def test_calibration_picks_lowest_zero_false_approval_threshold():
    out = calibrate.run(ROWS, fake_probs)
    assert out["chosen"] == 0.9  # tune: 0.86 false approval blocks <= 0.85; test row at 0.97 must not influence it

    tune_85 = out["per_threshold"]["0.85"]["tune"]
    assert tune_85["false_approvals"] == 1 and tune_85["auto_accept_rate"] == 0.75
    tune_90 = out["per_threshold"]["0.9"]["tune"]
    assert tune_90["false_approvals"] == 0 and tune_90["auto_accept_rate"] == 0.5
    assert tune_90["manual_review_rate"] == 0.5 and tune_90["accuracy_of_accepted"] == 1.0

    test_90 = out["test_at_chosen"]
    assert test_90["false_approvals"] == 1 and test_90["auto_accept_rate"] == 1.0
    assert test_90["accuracy_of_accepted"] == 0.5


def test_calibration_accepts_judge_result_shape_and_none_when_unsafe():
    def judge_like(kind, a, b):
        p = {"same_address": 0.995, "different_address": 0.005}
        return {"probs": p, "top": "same_address", "p_top": 0.995}

    rows = [{"id": "x1", "kind": "address", "a": "p", "b": "q", "label": "different", "split": "tune"},
            {"id": "x2", "kind": "address", "a": "p", "b": "r", "label": "same", "split": "test"}]
    out = calibrate.run(rows, judge_like)
    assert out["chosen"] is None and out["test_at_chosen"] is None
