"""Tests never call live services: blank the keys before app.main's load_dotenv can load them from .env."""
import os

for key in ("AWS_BEARER_TOKEN_BEDROCK", "FEATHERLESS_API_KEY", "GMAIL_APP_PASSWORD"):
    os.environ[key] = ""  # present-but-empty: python-dotenv does not override existing variables
os.environ.setdefault("AGENT_MODE", "scripted")
os.environ.setdefault("JUDGE_MODE", "heuristic")
os.environ.setdefault("EMAIL_MODE", "outbox")
