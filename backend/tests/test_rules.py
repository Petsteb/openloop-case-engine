from datetime import datetime, timezone

from app import rules
from app.ledger import Ledger


def test_cui_checksum():
    assert rules.cui_checksum_valid("94123877")
    assert rules.cui_checksum_valid("RO94123877")
    assert not rules.cui_checksum_valid("45123870")
    assert not rules.cui_checksum_valid("1")


def test_names_match_regardless_of_order_and_diacritics():
    assert rules.same_name_exact("POP RADU", "Radu Pop")
    assert rules.same_name_exact("MUNTEANU ELENA", "Elena Munteanu")
    assert not rules.same_name_exact("Radu Pop", "Radu Popa")


def test_ubo_check_flags_undeclared_owner_and_share_mismatch():
    register = [{"name": "MUNTEANU ANDREI", "pct": 45}, {"name": "MUNTEANU ELENA", "pct": 30}, {"name": "POP RADU", "pct": 25}]
    declared = [{"name": "Andrei Munteanu", "pct": 70}, {"name": "Elena Munteanu", "pct": 30}]
    res = rules.ubo_check(register, declared)
    assert not res["ok"]
    assert [o["name"] for o in res["missing"]] == ["POP RADU"]
    assert res["pct_mismatch"][0]["register_pct"] == 45


def test_dscr_and_amounts():
    assert rules.parse_amount("420.000 RON") == 420000
    assert rules.dscr(420000, 180000, 120000) == 1.4
    assert rules.dscr_ok(1.4) and not rules.dscr_ok(1.19)


def test_doc_validity_window():
    issued = datetime(2026, 10, 9, tzinfo=timezone.utc)
    assert rules.doc_is_valid(issued, datetime(2026, 11, 7, tzinfo=timezone.utc))
    assert not rules.doc_is_valid(issued, datetime(2026, 11, 8, 9, tzinfo=timezone.utc))


def test_ledger_detects_tampering():
    led = Ledger("t")
    now = datetime(2026, 10, 28, tzinfo=timezone.utc)
    for i in range(3):
        led.append("X", now, {"type": "system", "id": "t"}, {"i": i}, f"event {i}")
    assert led.verify() == {"ok": True, "length": 3, "broken_at": None}
    led.events[1]["payload"]["i"] = 99
    assert led.verify()["broken_at"] == 2
