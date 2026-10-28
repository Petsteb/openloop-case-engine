"""Shared Claude-on-Bedrock client for the case agent and the case chat.

Our hackathon AWS account denies the newer Mantle endpoint and EU regions by policy, so we use the
Anthropic SDK's AnthropicBedrock client (bedrock-runtime) with a Bedrock API key and an inference-profile ID.
"""
import os

MODEL = os.environ.get("BEDROCK_MODEL_ID", "us.anthropic.claude-opus-5-5")
EFFORT = os.environ.get("AGENT_EFFORT", "low")


def make_client():
    from anthropic import AnthropicBedrock
    key = os.environ.get("AWS_BEARER_TOKEN_BEDROCK", "")
    if not key:
        raise RuntimeError("AWS_BEARER_TOKEN_BEDROCK is empty")
    # short timeout + one retry: a live demo must fall back in seconds, not minutes
    return AnthropicBedrock(aws_region=os.environ.get("AWS_REGION", "us-east-1"), api_key=key,
                            timeout=float(os.environ.get("AGENT_TIMEOUT_S", "30")), max_retries=1)


def create(client, *, system: str, messages: list, tools: list, max_tokens: int = 4096, effort: str | None = None):
    """One Messages API call. A refusal is raised so callers fall back like on any other failure."""
    resp = client.messages.create(model=os.environ.get("BEDROCK_MODEL_ID", MODEL), max_tokens=max_tokens, system=system,
                                  tools=tools, messages=messages, output_config={"effort": effort or EFFORT})
    if resp.stop_reason == "refusal":
        raise RuntimeError("model refusal")
    return resp
