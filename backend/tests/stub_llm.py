"""A stand-in for the Anthropic client: client.messages.create(...) returns queued responses."""


class Block:
    def __init__(self, **kw):
        self.__dict__.update(kw)


class Resp:
    def __init__(self, content, stop_reason):
        self.content, self.stop_reason = content, stop_reason


class StubClient:
    """Queue items are Resp objects or exceptions; once empty, it ends the turn with a short text."""

    def __init__(self, script=()):
        self.script, self.calls = list(script), 0
        self.messages = self

    def create(self, **kw):
        self.calls += 1
        item = self.script.pop(0) if self.script else Resp([Block(type="text", text="No action needed")], "end_turn")
        if isinstance(item, Exception):
            raise item
        return item


def tool_use(name, inp, uid="tu_1"):
    return Resp([Block(type="tool_use", name=name, input=inp, id=uid)], "tool_use")


def text(s):
    return Resp([Block(type="text", text=s)], "end_turn")
