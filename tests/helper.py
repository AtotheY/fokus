"""Exercise the packaged daemon against a disposable hosts file on macOS."""
import json
import os
from pathlib import Path
import socket
import subprocess
import tempfile
import time

CONTENTS = Path(__file__).resolve().parents[1] / "dist/Fokus.app/Contents"
BINARY = CONTENTS / "MacOS/fokus-helper"
RAYCAST = CONTENTS / "Resources/Raycast"


def request(endpoint, payload, delay=0):
    with socket.socket(socket.AF_UNIX) as client:
        client.settimeout(4)
        client.connect(str(endpoint))
        # Darwin can inherit O_NONBLOCK from the listener. A client need not send
        # the request in the same instant it connects.
        time.sleep(delay)
        client.sendall(json.dumps(payload).encode())
        client.shutdown(socket.SHUT_WR)
        return json.load(client.makefile())


with tempfile.TemporaryDirectory(prefix="fokus-", dir="/tmp") as folder:
    root = Path(folder)
    hosts = root / "hosts"
    endpoint = root / "control.sock"
    original = "127.0.0.1 localhost\n# external entry\n192.0.2.1 existing.test\n"
    hosts.write_text(original)
    (root / "rules.json").write_text(json.dumps({
        "sites": ["x.com", "reddit.com", "instagram.com"],
        "schedule": {"enabled": False, "start": 540, "end": 1020, "days": [0]},
        "focusUntil": int(time.time()) + 120, "breakUntil": 0, "siteBreaks": {}
    }))
    worker = subprocess.Popen([BINARY, "--sandbox", root])
    try:
        for _ in range(100):
            if endpoint.exists():
                break
            time.sleep(0.05)
        state = request(endpoint, {"type": "status"}, delay=0.1)
        assert len(state["blocked"]) == 3 and state["problem"] is None
        request(endpoint, {"type": "break", "minutes": 5, "site": "x.com"})
        assert "0.0.0.0 x.com\n" not in hosts.read_text()
        assert "0.0.0.0 old.reddit.com\n" in hosts.read_text()
        request(endpoint, {"type": "break", "minutes": 5, "site": None})
        assert hosts.read_text() == original
        # Run the same executable commands Raycast indexes, against this helper.
        def command(script, minutes):
            return subprocess.run(
                [RAYCAST / script, minutes],
                env={**os.environ, "FOKUS_TEST_DIRECTORY": str(root)},
                capture_output=True, text=True, timeout=8,
            )

        request(endpoint, {"type": "endFocus"})
        assert command("take-break.rb", "5").returncode != 0
        for invalid in ("", "0", "241", "1.5", "10min"):
            assert command("start-session.rb", invalid).returncode != 0
        started = command("start-session.rb", "17")
        assert started.returncode == 0, started.stderr
        state = request(endpoint, {"type": "status"})
        assert 1018 <= state["rules"]["focusUntil"] - state["now"] <= 1020
        assert len(state["blocked"]) == 3
        paused = command("take-break.rb", "240")
        assert paused.returncode == 0, paused.stderr
        state = request(endpoint, {"type": "status"})
        assert state["rules"]["breakUntil"] == state["rules"]["focusUntil"]
        assert hosts.read_text() == original
    finally:
        worker.terminate()
        worker.wait(timeout=4)
print("Packaged helper passed delayed IPC, site breaks, hosts restoration and Raycast timers.")
