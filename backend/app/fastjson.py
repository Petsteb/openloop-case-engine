"""JSON responses without FastAPI's per-value `jsonable_encoder` walk, byte-identical to what FastAPI would send.

A route that returns a plain dict pays for `jsonable_encoder` visiting every value (isinstance checks against
models, dataclasses, enums, paths...) before `json.dumps`. A full case bundle is ~80 KB of plain JSON values,
so that walk costs several times the dump itself (~9 ms vs ~1.3 ms of CPU for the demo bundle on our laptop;
docs/pitch/performance.md). Content made only of JSON
types (dict, list, tuple, str, int, float, bool, None) is dumped directly, with the exact settings of FastAPI's
JSONResponse; anything else (a datetime, a set, a model) falls back to the normal FastAPI path.
"""
import json

from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse, Response


def json_response(content) -> Response:
    try:
        body = json.dumps(content, ensure_ascii=False, allow_nan=False, indent=None, separators=(",", ":"))
    except (TypeError, ValueError):  # not plain JSON: let FastAPI encode it (and raise where it would raise)
        return JSONResponse(jsonable_encoder(content))
    return Response(body.encode("utf-8"), media_type="application/json")
