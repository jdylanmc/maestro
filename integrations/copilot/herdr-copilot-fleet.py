#!/usr/bin/env python3

import fcntl
import hashlib
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import time


MAX_VISIBLE_AGENTS = 8
SOURCE = "user:copilot-fleet"
TOKEN_TTL_MS = 6 * 60 * 60 * 1000


def read_payload():
    try:
        payload = json.load(__import__("sys").stdin)
        return payload if isinstance(payload, dict) else {}
    except Exception:
        return {}


def parse_tool_args(value):
    if isinstance(value, dict):
        return value
    if isinstance(value, str):
        try:
            parsed = json.loads(value)
            return parsed if isinstance(parsed, dict) else {}
        except Exception:
            return {}
    return {}


def event_tasks(payload, event):
    if event == "start" and isinstance(payload.get("toolCalls"), list):
        return [
            parse_tool_args(call.get("args"))
            for call in payload["toolCalls"]
            if isinstance(call, dict) and call.get("name") == "task"
        ]
    tool_args = parse_tool_args(payload.get("toolArgs") or payload.get("tool_input"))
    return [tool_args] if tool_args else []


def task_identity(tool_args):
    tracked = {
        key: tool_args.get(key)
        for key in ("agent_type", "agentType", "name", "description", "prompt")
        if tool_args.get(key) is not None
    }
    encoded = json.dumps(tracked, sort_keys=True, separators=(",", ":")).encode()
    return hashlib.sha256(encoded).hexdigest()


def task_label(tool_args):
    value = (
        tool_args.get("description")
        or tool_args.get("name")
        or tool_args.get("agent_type")
        or tool_args.get("agentType")
        or "background agent"
    )
    label = " ".join(str(value).split())
    return label if len(label) <= 28 else f"{label[:27]}…"


def report_metadata(herdr_bin, pane_id, state):
    entries = []
    for item in state["tasks"].values():
        count = int(item.get("count", 0))
        if count > 0:
            entries.extend([str(item.get("label") or "background agent")] * count)

    sequence = max(time.time_ns(), int(state.get("sequence", 0)) + 1)
    state["sequence"] = sequence
    command = [
        herdr_bin,
        "pane",
        "report-metadata",
        pane_id,
        "--source",
        SOURCE,
        "--agent",
        "copilot",
        "--seq",
        str(sequence),
        "--ttl-ms",
        str(TOKEN_TTL_MS),
    ]
    if entries:
        command.extend(["--token", f"fleet_summary=fleet · {len(entries)} active"])
    else:
        command.extend(["--clear-token", "fleet_summary"])

    for index in range(MAX_VISIBLE_AGENTS):
        token = f"fleet{index + 1}"
        if index < len(entries):
            command.extend(["--token", f"{token}=● {entries[index]}"])
        else:
            command.extend(["--clear-token", token])

    subprocess.run(
        command,
        check=False,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
        timeout=1,
    )


def main():
    if os.environ.get("HERDR_ENV") != "1":
        return

    pane_id = os.environ.get("HERDR_PANE_ID")
    herdr_bin = os.environ.get("HERDR_BIN_PATH") or shutil.which("herdr")
    event = os.environ.get("HERDR_FLEET_EVENT")
    if not pane_id or not herdr_bin or not event:
        return

    payload = read_payload()
    session_id = str(payload.get("sessionId") or payload.get("session_id") or "")
    state_root = Path(tempfile.gettempdir()) / f"herdr-copilot-fleet-{os.getuid()}"
    state_root.mkdir(mode=0o700, parents=True, exist_ok=True)
    pane_key = hashlib.sha256(pane_id.encode()).hexdigest()
    state_path = state_root / f"{pane_key}.json"
    lock_path = state_root / f"{pane_key}.lock"

    with lock_path.open("a+", encoding="utf-8") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        try:
            state = json.loads(state_path.read_text(encoding="utf-8"))
        except Exception:
            state = {}

        if state.get("session_id") != session_id:
            state = {"session_id": session_id, "sequence": 0, "tasks": {}}

        if event == "reset":
            state["tasks"] = {}
        else:
            tasks = event_tasks(payload, event)
            if not tasks:
                return
            for tool_args in tasks:
                identity = task_identity(tool_args)
                item = state["tasks"].setdefault(
                    identity,
                    {"count": 0, "label": task_label(tool_args)},
                )
                if event == "start":
                    item["count"] = int(item.get("count", 0)) + 1
                elif event == "stop":
                    item["count"] = max(0, int(item.get("count", 0)) - 1)
                    if item["count"] == 0:
                        state["tasks"].pop(identity, None)

        report_metadata(herdr_bin, pane_id, state)
        state_path.write_text(json.dumps(state), encoding="utf-8")
        state_path.chmod(0o600)


if __name__ == "__main__":
    try:
        main()
    except Exception:
        pass
