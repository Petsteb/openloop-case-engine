"""Mock trade-register (ONRC) API — stands in for the real external service."""
from .profiles import registry_entries


class RegistryUnavailable(Exception):
    pass


_COMPANIES = registry_entries()

state = {"down": False}


def lookup(cui: str) -> dict:
    if state["down"]:
        raise RegistryUnavailable("ONRC API timeout")
    company = _COMPANIES.get(cui.strip())
    return company or {"cui": cui, "status": "NOT_FOUND"}
