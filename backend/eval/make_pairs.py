"""Generate backend/eval/pairs.jsonl: 150 labelled pairs to calibrate the judge threshold (seed 42, deterministic).

Row: {"id", "kind": "address"|"person", "a", "b", "label": "same"|"different", "split": "tune"|"test", "why"}.
96 address rows (50 same, 46 different) + 54 person rows (28 same, 26 different) = 150, 48% different.
The split is stratified by (kind, label, why), so tune and test both get every kind of near-miss.

Labelling rules (Romanian addresses): formatting variants, diacritics and omitted block/apartment are "same";
a different number, sector, city, postal code or street name is "different"; and Str. vs Calea (or Bd./Al./Sos.) with
the same name and number is "different" too, because in Romania those can be two different streets.
Persons: order swaps and case/diacritics are "same"; a 1-letter surname change or another first name is "different".

    python backend/eval/make_pairs.py
"""
import json
import random
import unicodedata
from pathlib import Path

OUT = Path(__file__).resolve().parent / "pairs.jsonl"
SEED = 42

TYPES = {"Str.": "Strada", "Calea": "Calea", "Bd.": "Bulevardul", "Al.": "Aleea", "Șos.": "Șoseaua"}
STREETS = ["Fagului", "Teilor", "Morii", "Libertății", "Republicii", "Victoriei", "Unirii", "Primăverii", "Dorobanților",
           "Mihai Eminescu", "Ștefan cel Mare", "Aviatorilor", "Plopilor", "Crinului", "Lalelelor", "Eroilor", "Independenței",
           "Păcii", "Fabricii", "Gării", "Școlii", "Livezilor", "Castanilor", "Mihai Viteazu", "Horea", "Avram Iancu", "Traian",
           "Decebal", "Splai Mureș", "Nicolae Titulescu", "Industriilor", "Bucegi"]
NEAR_STREETS = [("Fagului", "Fagetului"), ("Teilor", "Tilei"), ("Morii", "Moșilor"), ("Mihai Viteazu", "Mihai Eminescu"),
                ("Unirii", "Unirea"), ("Crinului", "Crișului"), ("Plopilor", "Plopului"), ("Aviatorilor", "Aviației"),
                ("Horea", "Horea Cloșca"), ("Victoriei", "Victoriei Noi")]
CITIES = [("Cluj-Napoca", "Cluj"), ("Timișoara", "Timiș"), ("Brașov", "Brașov"), ("Iași", "Iași"), ("Sibiu", "Sibiu"),
          ("Oradea", "Bihor"), ("Constanța", "Constanța"), ("Craiova", "Dolj"), ("Ploiești", "Prahova"), ("Arad", "Arad"),
          ("Pitești", "Argeș"), ("Bacău", "Bacău"), ("Târgu Mureș", "Mureș"), ("Baia Mare", "Maramureș"),
          ("Suceava", "Suceava"), ("Galați", "Galați")]
BLOCKS = ["bl. A2", "bl. B1", "bl. C4", "bl. D3", "bl. A0", "bl. M5"]
GIVEN_M = ["Andrei", "Radu", "Mihai", "Ion", "Vlad", "Alexandru", "Daniel", "Cristian", "Gabriel", "Florin", "Sorin", "Lucian", "Tudor"]
GIVEN_F = ["Elena", "Maria", "Ioana", "Ana", "Raluca", "Cristina", "Daniela", "Simona", "Carmen", "Oana", "Diana", "Roxana", "Alina"]
GIVEN_DIA = ["Ștefan", "Mălina", "Cătălin", "Ionuț", "Șerban", "Ioana-Mădălina", "Bogdan-Ștefan", "Răzvan", "Teodora", "Ruxandra", "Anișoara", "Valentin"]
SURNAMES = ["Munteanu", "Popescu", "Ionescu", "Dumitrescu", "Stoica", "Gheorghe", "Rusu", "Constantin", "Lungu", "Cojocaru",
            "Neagu", "Mocanu", "Vasilescu", "Diaconu"]
SURNAMES_DIA = ["Țurcanu", "Bălan", "Șerban", "Pătrașcu", "Stănescu", "Lăzărescu", "Ciobanu-Țepeș", "Nițu", "Târnăcop", "Drăgan"]
SURNAME_PAIRS = [("Popa", "Pop"), ("Stancu", "Stanciu"), ("Marin", "Marian"), ("Moldovan", "Moldovean"), ("Dobre", "Dobra"),
                 ("Barbu", "Barba"), ("Preda", "Predu"), ("Matei", "Matea"), ("Dinu", "Dina"), ("Toma", "Tomu"),
                 ("Rusu", "Rus"), ("Enache", "Enachi")]
NEAR_GIVEN = [("Andrei", "Andreea"), ("Ion", "Ioana"), ("Marin", "Maria"), ("Alexandru", "Alexandra"), ("Ștefan", "Ștefana"),
              ("Daniel", "Daniela"), ("Cristian", "Cristina"), ("Florin", "Florina"), ("Mihai", "Mihaela")]
SECTOR_STREETS = ["Dorobanților", "Calea Victoriei", "Mihai Eminescu", "Pache Protopopescu", "Barbu Văcărescu", "Fabrica de Glucoză"]


def fold(s: str) -> str:
    return unicodedata.normalize("NFKD", s).encode("ascii", "ignore").decode()


def street(addr: dict, full: bool) -> str:
    return f"{TYPES[addr['type']] if full else addr['type']} {addr['name']}"


def render(addr: dict, style: str) -> str:
    """One address, one of several real-world formattings."""
    city, county = addr["city"], addr["county"]
    num, bl = addr["num"], addr.get("bl")
    blk = f", {bl}" if bl else ""
    if style == "abbr":       # Str. Fagului nr. 7, bl. A2, Cluj-Napoca, jud. Cluj
        return f"{street(addr, False)} nr. {num}{blk}, {city}, jud. {county}"
    if style == "plain":      # Strada Fagului 7, Cluj-Napoca
        return f"{street(addr, True)} {num}{blk}, {city}"
    if style == "full":       # Strada Fagului, nr. 7, Cluj-Napoca, Județ Cluj
        return f"{street(addr, True)}, nr. {num}{blk}, {city}, Județ {county}"
    if style == "nocounty":   # Str. Fagului nr. 7, Cluj-Napoca
        return f"{street(addr, False)} nr. {num}{blk}, {city}"
    if style == "cityfirst":  # Cluj-Napoca, Strada Fagului 7
        return f"{city}, {street(addr, True)} {num}{blk}"
    raise ValueError(style)


STYLES = ["abbr", "plain", "full", "nocounty"]


class Gen:
    def __init__(self, seed: int = SEED):
        self.rng = random.Random(seed)
        self.rows: list[dict] = []
        self.seen: set[tuple[str, str]] = set()
        self.bases: set[tuple] = set()

    def add(self, kind: str, a: str, b: str, label: str, why: str) -> None:
        assert a != b, (a, b)
        assert (a, b) not in self.seen and (b, a) not in self.seen, (a, b)
        self.seen.add((a, b))
        self.rows.append({"kind": kind, "a": a, "b": b, "label": label, "why": why})

    def base(self, types=("Str.", "Calea", "Bd.", "Al.", "Șos.")) -> dict:
        while True:
            addr = {"type": self.rng.choice(types), "name": self.rng.choice(STREETS), "num": self.rng.randint(2, 98)}
            addr["city"], addr["county"] = self.rng.choice(CITIES)
            key = (addr["name"], addr["num"], addr["city"])
            if key not in self.bases:
                self.bases.add(key)
                return addr

    def two_styles(self, styles=STYLES) -> tuple[str, str]:
        s1, s2 = self.rng.sample(styles, 2)
        return s1, s2

    # ---------------- addresses: same ----------------
    def addr_same(self) -> None:
        r = self.rng
        for _ in range(12):                                   # Str./Strada, nr./no number, jud./Județ
            addr = self.base(("Str.",))
            s1, s2 = self.two_styles()
            self.add("address", render(addr, s1), render(addr, s2), "same", "formatting variant")
        for i in range(8):                                    # diacritics / case
            addr = self.base(("Str.", "Calea", "Bd."))
            a = render(addr, r.choice(STYLES))
            b = fold(render(addr, r.choice(STYLES)))
            b = b.upper() if i % 2 else b
            if a == b:
                b = b.upper()
            self.add("address", a, b, "same", "diacritics / case")
        for _ in range(8):                                    # block / apartment omitted
            addr = self.base(("Str.",))
            addr["bl"] = r.choice(BLOCKS)
            if r.random() < 0.5:
                addr["bl"] += f", sc. {r.randint(1, 3)}, ap. {r.randint(1, 60)}"
            s1, s2 = self.two_styles()
            self.add("address", render(addr, s1), render({**addr, "bl": None}, s2), "same", "block / apartment omitted")
        for _ in range(8):                                    # same non-Strada type, abbreviated vs written out
            addr = self.base(("Bd.", "Al.", "Șos."))
            self.add("address", render(addr, "abbr"), render(addr, r.choice(["plain", "full"])), "same", "type abbreviated vs full")
        for _ in range(5):                                    # county present vs absent
            addr = self.base(("Str.", "Calea"))
            self.add("address", render(addr, "nocounty"), render(addr, r.choice(["abbr", "full"])), "same", "county present vs absent")
        for _ in range(4):                                    # city first
            addr = self.base(("Str.", "Bd."))
            self.add("address", render(addr, "cityfirst"), render(addr, r.choice(["abbr", "nocounty"])), "same", "reordered")
        for _ in range(5):                                    # Bucharest sectors
            name, num, sec = r.choice(SECTOR_STREETS), r.randint(2, 90), r.randint(1, 6)
            kind = "Str." if not name.startswith("Calea") else ""
            core = f"{name}" if not kind else f"{kind} {name}"
            full = core.replace("Str.", "Strada")
            a = f"{core} nr. {num}, București, Sector {sec}"
            b = r.choice([f"{full} {num}, Sector {sec}, Bucuresti", f"{full}, nr. {num}, sect. {sec}, București"])
            self.add("address", a, b, "same", "Bucharest sector formatting")

    # ---------------- addresses: different ----------------
    def addr_different(self) -> None:
        r = self.rng
        for i in range(10):                                   # different number
            addr = self.base(("Str.", "Bd.", "Calea"))
            n = addr["num"]
            n2 = [n + 2, int("1" + str(n)), int(str(n)[::-1]) if str(n)[::-1] != str(n) else n + 3, f"{n}A", n + 10][i % 5]
            if n2 == n:
                n2 = n + 4
            s1, s2 = self.two_styles()
            self.add("address", render(addr, s1), render({**addr, "num": n2}, s2), "different", "different number")
        for _ in range(6):                                    # different city
            addr = self.base(("Str.",))
            other = r.choice([c for c in CITIES if c[0] != addr["city"]])
            s1, s2 = self.two_styles()
            self.add("address", render(addr, s1), render({**addr, "city": other[0], "county": other[1]}, s2), "different", "different city")
        for _ in range(4):                                    # different sector
            name, num = r.choice(SECTOR_STREETS), r.randint(2, 90)
            s1, s2 = r.sample([1, 2, 3, 4, 5, 6], 2)
            core = name if name.startswith("Calea") else f"Str. {name}"
            self.add("address", f"{core} nr. {num}, București, Sector {s1}",
                     f"{core.replace('Str.', 'Strada')} {num}, Sector {s2}, București", "different", "different sector")
        for _ in range(5):                                    # different street type AND different street
            addr = self.base(("Str.",))
            other = r.choice([n for n in STREETS if n != addr["name"]])
            t2 = r.choice(["Calea", "Bd.", "Al."])
            s1, s2 = self.two_styles()
            self.add("address", render(addr, s1), render({**addr, "type": t2, "name": other}, s2), "different", "type and street differ")
        self.bases.add(("Fagului", 7, "Cluj-Napoca"))
        self.add("address", "Str. Fagului nr. 7, bl. A2, Cluj-Napoca, jud. Cluj", "Calea Fagului nr. 7, Cluj-Napoca, Județ Cluj",
                 "different", "Str. vs Calea, same name and number (demo pair)")   # exact strings of the demo case (scenario.py)
        for t2 in ["Calea", "Calea", "Calea", "Calea", "Bd.", "Bd.", "Al.", "Șos.", "Calea"]:   # Str. vs Calea / Bd. / Al. / Șos.
            addr = self.base(("Str.",))
            s1, s2 = self.two_styles()
            self.add("address", render(addr, s1), render({**addr, "type": t2}, s2), "different", f"Str. vs {t2}, same name and number")
        for n1, n2 in r.sample(NEAR_STREETS, 7):              # near-identical street names
            addr = self.base(("Str.", "Calea", "Al."))
            s1, s2 = self.two_styles()
            self.add("address", render({**addr, "name": n1}, s1), render({**addr, "name": n2}, s2), "different", "near-identical street name")
        for _ in range(2):                                    # same street and number, different block
            addr = self.base(("Str.",))
            b1, b2 = r.sample(BLOCKS, 2)
            s1, s2 = self.two_styles()
            self.add("address", render({**addr, "bl": b1}, s1), render({**addr, "bl": b2}, s2), "different", "different block")
        for _ in range(2):                                    # different postal code
            addr = self.base(("Str.", "Bd."))
            p1 = r.randint(100000, 899999)
            p2 = p1 + r.choice([7, 13, -9, 21])
            self.add("address", f"{render(addr, 'nocounty')}, cod postal {p1}", f"{render(addr, 'plain')}, cod postal {p2}",
                     "different", "different postal code")

    # ---------------- persons ----------------
    def person_name(self, dia: bool = False) -> tuple[str, str]:
        r = self.rng
        given = r.choice(GIVEN_DIA if dia else GIVEN_M + GIVEN_F)
        return given, r.choice(SURNAMES_DIA if dia else SURNAMES)

    def person_same(self) -> None:
        r = self.rng
        self.add("person", "Andrei Munteanu", "MUNTEANU ANDREI", "same", "order swap (demo pair)")
        for _ in range(9):                                    # order swap
            g, s = self.person_name()
            fmt = r.choice([(f"{g} {s}", f"{s} {g}"), (f"{g} {s}", f"{s.upper()} {g.upper()}"), (f"{s.upper()} {g}", f"{g} {s}")])
            self.add("person", fmt[0], fmt[1], "same", "order swap")
        for i in range(10):                                   # case / diacritics only
            g, s = self.person_name(dia=True)
            a = f"{g} {s}"
            b = [fold(a), a.upper(), fold(a).upper(), a.lower(), fold(a).lower()][i % 5]
            self.add("person", a, b, "same", "case / diacritics")
        for i in range(5):                                    # swap AND case / diacritics
            g, s = self.person_name(dia=True)
            b = [f"{fold(s)} {fold(g)}", f"{s.upper()} {g.upper()}", f"{fold(s).upper()} {fold(g).upper()}"][i % 3]
            self.add("person", f"{g} {s}", b, "same", "order swap + case / diacritics")
        for _ in range(3):                                    # "Surname, Given"
            g, s = self.person_name()
            self.add("person", f"{g} {s}", f"{s}, {g}", "same", "surname-comma format")

    def person_different(self) -> None:
        r = self.rng
        for s1, s2 in r.sample(SURNAME_PAIRS, 10):            # 1-letter surname change, mixed order/case
            g = r.choice(GIVEN_M + GIVEN_F)
            fa, fb = r.sample([lambda g, s: f"{g} {s}", lambda g, s: f"{s.upper()} {g.upper()}", lambda g, s: f"{s} {g}",
                               lambda g, s: f"{g} {s}"], 2)
            self.add("person", fa(g, s1), fb(g, s2), "different", "1-letter surname change")
        for g1, g2 in r.sample(NEAR_GIVEN, 8):                # Andrei vs Andreea, Ion vs Ioana ...
            s = r.choice(SURNAMES)
            self.add("person", f"{g1} {s}", r.choice([f"{g2} {s}", f"{s.upper()} {g2.upper()}"]), "different", "near first name")
        for _ in range(5):                                    # same surname, other first name (relatives)
            s = r.choice(SURNAMES)
            g1, g2 = r.sample(GIVEN_M + GIVEN_F, 2)
            self.add("person", f"{g1} {s}", r.choice([f"{g2} {s}", f"{s.upper()} {g2.upper()}"]), "different", "same surname, other first name")
        for _ in range(3):                                    # unrelated
            (g1, s1), (g2, s2) = self.person_name(), self.person_name()
            while s1 == s2 or g1 == g2:
                g2, s2 = self.person_name()
            self.add("person", f"{g1} {s1}", f"{g2} {s2}", "different", "unrelated people")


def build() -> list[dict]:
    gen = Gen()
    gen.addr_same()
    gen.addr_different()
    gen.person_same()
    gen.person_different()
    rng = random.Random(SEED + 1)
    # stratified split: within each (kind, label), groups of the same "why" alternate tune/test
    groups: dict[tuple, list[dict]] = {}
    for row in gen.rows:
        groups.setdefault((row["kind"], row["label"], row["why"].split(" (")[0]), []).append(row)
    toggle: dict[tuple, int] = {}
    for key in sorted(groups):
        rows = groups[key]
        rng.shuffle(rows)
        for row in rows:
            t = toggle.get(key[:2], 0)
            row["split"] = "tune" if t % 2 == 0 else "test"
            toggle[key[:2]] = t + 1
    rows = gen.rows
    rng.shuffle(rows)
    return [{"id": f"PR-{i:03d}", "kind": r["kind"], "a": r["a"], "b": r["b"], "label": r["label"], "split": r["split"],
             "why": r["why"]} for i, r in enumerate(rows, 1)]


def check(rows: list[dict]) -> None:
    assert len(rows) == 150, len(rows)
    assert len({r["id"] for r in rows}) == 150
    diff = sum(r["label"] == "different" for r in rows)
    assert diff >= 0.4 * len(rows), diff
    assert all(r["a"] != r["b"] for r in rows)
    assert len({frozenset((r["a"], r["b"])) for r in rows}) == 150, "duplicate pair"
    for kind in ("address", "person"):
        for label in ("same", "different"):
            n_t = sum(1 for r in rows if (r["kind"], r["label"], r["split"]) == (kind, label, "tune"))
            n_s = sum(1 for r in rows if (r["kind"], r["label"], r["split"]) == (kind, label, "test"))
            assert abs(n_t - n_s) <= 1, (kind, label, n_t, n_s)
    assert sum(r["split"] == "tune" for r in rows) == 75


def main() -> None:
    rows = build()
    check(rows)
    OUT.write_text("".join(json.dumps(r, ensure_ascii=False) + "\n" for r in rows), encoding="utf-8")
    diff = sum(r["label"] == "different" for r in rows)
    print(f"wrote {len(rows)} rows to {OUT}: {diff} different ({100 * diff / len(rows):.0f}%), "
          f"{sum(r['kind'] == 'address' for r in rows)} address, {sum(r['kind'] == 'person' for r in rows)} person, "
          f"{sum(r['split'] == 'tune' for r in rows)} tune / {sum(r['split'] == 'test' for r in rows)} test")


if __name__ == "__main__":
    main()
