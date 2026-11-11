"""Real Windows pipe/helper integration, touching only a disposable hosts file."""
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

ROOT = Path(__file__).resolve().parents[1]
BINARY = ROOT / 'target/debug/fokus-helper.exe'
kernel = ctypes.WinDLL('kernel32', use_last_error=True)
call = kernel.CallNamedPipeW
call.argtypes = [wintypes.LPCWSTR, ctypes.c_void_p, wintypes.DWORD,
                 ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(wintypes.DWORD), wintypes.DWORD]
call.restype = wintypes.BOOL


def endpoint(folder):
    value = 0xcbf29ce484222325
    for byte in str(folder).lower().encode():
        value = ((value ^ byte) * 0x100000001b3) & ((1 << 64) - 1)
    return rf'\\.\pipe\dev.usefokus.test.{value:x}'


def request(pipe, payload):
    data = json.dumps(payload).encode()
    output = ctypes.create_string_buffer(200000)
    count = wintypes.DWORD()
    if not call(pipe, data, len(data), output, len(output), ctypes.byref(count), 6000):
        raise ctypes.WinError(ctypes.get_last_error())
    return json.loads(output.raw[:count.value])


def wait_for(predicate, message):
    until = time.monotonic() + 10
    while time.monotonic() < until:
        try:
            if predicate():
                return
        except OSError:
            pass
        time.sleep(0.1)
    raise AssertionError(message)


if not BINARY.exists():
    raise SystemExit('Build first: cargo build --workspace')

with tempfile.TemporaryDirectory(prefix='fokus-windows-') as temporary:
    root = Path(temporary)
    hosts = root / 'hosts'
    original = '127.0.0.1 localhost\n# external entry\n192.0.2.1 existing.test\n'
    hosts.write_text(original)
    sid = subprocess.check_output(['powershell.exe', '-NoProfile', '-Command',
        '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'], text=True).strip()
    (root / 'owner.sid').write_text(sid)
    rules = {'sites': ['x.com', 'reddit.com'],
             'schedule': {'enabled': False, 'start': 540, 'end': 1020, 'days': [0]},
             'focusUntil': int(time.time()) + 120, 'breakUntil': 0, 'siteBreaks': {}}
    (root / 'rules.json').write_text(json.dumps(rules))
    env = dict(os.environ, FOKUS_TEST_DIRECTORY=str(root))
    pipe = endpoint(root)
    worker = None

    def start():
        process = subprocess.Popen([str(BINARY), '--console'], env=env)
        try:
            wait_for(lambda: request(pipe, {'type': 'status'})['ready'], 'Helper did not start')
        except BaseException:
            process.terminate()
            process.wait(timeout=5)
            raise
        return process

    try:
        worker = start()
        state = request(pipe, {'type': 'status'})
        assert state['problem'] is None and 'x.com' in state['blocked']
        assert '0.0.0.0 x.com\n' in hosts.read_text()
        assert original in hosts.read_text()
        # Windows executable IDs survive the rules protocol and are blocked.
        exe = r'c:\program files\example app\example.exe'
        result = request(pipe, {'type': 'group', 'change': {'op': 'addApp', 'id': 1,
            'app': {'id': exe, 'name': 'Example'}}})
        assert f'app:{exe}' in result['blockedApps'], result
        result = request(pipe, {'type': 'break', 'minutes': 1, 'site': f'app:{exe}'})
        assert f'app:{exe}' not in result['blockedApps'], result
        result = request(pipe, {'type': 'resume', 'site': f'app:{exe}'})
        assert f'app:{exe}' in result['blockedApps'], result
        rejected = request(pipe, {'type': 'group', 'change': {'op': 'addApp', 'id': 1,
            'app': {'id': r'c:\windows\explorer.exe', 'name': 'Explorer'}}})
        assert 'error' in rejected
        request(pipe, {'type': 'break', 'minutes': 1, 'site': 'x.com'})
        assert '0.0.0.0 x.com\n' not in hosts.read_text()
        assert '0.0.0.0 reddit.com\n' in hosts.read_text()
        request(pipe, {'type': 'break', 'minutes': 1, 'site': None})
        assert hosts.read_text() == original
        request(pipe, {'type': 'resume', 'site': None})
        # Whole-list resume preserves the per-site exception.
        assert '0.0.0.0 x.com\n' not in hosts.read_text()
        request(pipe, {'type': 'resume', 'site': 'x.com'})
        assert '0.0.0.0 x.com\n' in hosts.read_text()
        bad = request(pipe, {'type': 'focus', 'minutes': 0})
        assert 'error' in bad
        worker.terminate()
        worker.wait(timeout=5)
        # Simulate persisted break expiry across a helper restart.
        saved = json.loads((root / 'rules.json').read_text())
        saved['breakUntil'] = int(time.time()) + 3
        (root / 'rules.json').write_text(json.dumps(saved))
        worker = start()
        assert hosts.read_text() == original
        wait_for(lambda: '0.0.0.0 x.com\n' in hosts.read_text(), 'Break did not expire')
        assert original in hosts.read_text()
        # Finish the focus session and restore the file exactly.
        request(pipe, {'type': 'endFocus'})
        assert hosts.read_text() == original
        print('PASS: real named pipe, executable IDs, protected apps, site/whole breaks,')
        print('invalid edits, persistence, automatic break expiry, and hosts restoration.')
    finally:
        if worker:
            worker.terminate()
            worker.wait(timeout=5)
