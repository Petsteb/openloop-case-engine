"""Mock trade-register (ONRC) API — stands in for the real external service."""


class RegistryUnavailable(Exception):
    pass


_COMPANIES = {
    "45123879": {"cui": "45123879", "name": "BRUTĂRIA AURORA S.R.L.", "status": "ACTIVĂ",
                 "postal_code": "400127", "administrator": "MUNTEANU ANDREI"},
}

state = {"down": False}


def lookup(cui: str) -> dict:
    if state["down"]:
        raise RegistryUnavailable("ONRC API timeout")
    company = _COMPANIES.get(cui.strip())
    return company or {"cui": cui, "status": "NOT_FOUND"}
