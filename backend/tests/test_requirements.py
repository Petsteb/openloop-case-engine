"""Every third-party package the app imports is in requirements.txt. A package that is only installed on a laptop
passes every local test and then crashes in the deployed image (it happened: `cryptography`)."""
import ast
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[2]
DIST_NAMES = {"dotenv": "python-dotenv"}  # import name -> package name where they differ


def test_every_app_import_is_a_requirement():
    imported = set()
    for f in (ROOT / "backend" / "app").glob("*.py"):
        for n in ast.walk(ast.parse(f.read_text(encoding="utf-8"))):
            if isinstance(n, ast.Import):
                imported |= {a.name.split(".")[0] for a in n.names}
            elif isinstance(n, ast.ImportFrom) and n.level == 0 and n.module:
                imported.add(n.module.split(".")[0])
    required = {re.split(r"[<>=\[ ;#]", line.strip())[0].lower()
                for line in (ROOT / "requirements.txt").read_text(encoding="utf-8").splitlines() if line.strip()
                and not line.lstrip().startswith("#")}
    missing = sorted(m for m in imported - set(sys.stdlib_module_names) if DIST_NAMES.get(m, m).lower() not in required)
    assert not missing, f"add to requirements.txt: {missing}"


def test_every_requirement_is_pinned_in_the_lock():
    """The Docker image installs requirements.lock (exact versions + hashes), not requirements.txt. A package added to
    requirements.txt but not to the lock would be missing from the image."""
    def norm(name):
        return name.lower().replace("_", "-")
    required = {norm(re.split(r"[<>=\[ ;#]", line.strip())[0])
                for line in (ROOT / "requirements.txt").read_text(encoding="utf-8").splitlines()
                if line.strip() and not line.lstrip().startswith("#")}
    lock = (ROOT / "requirements.lock").read_text(encoding="utf-8").splitlines()
    # A pin is "name==version \" followed by an indented "--hash=sha256:..." line.
    pins = {norm(line.split("==")[0]) for line, nxt in zip(lock, lock[1:])
            if "==" in line and not line.startswith((" ", "#")) and nxt.strip().startswith("--hash=sha256:")}
    assert pins, "requirements.lock has no hashed pins"
    missing = sorted(required - pins)
    assert not missing, f"regenerate requirements.lock (see its header): {missing}"
