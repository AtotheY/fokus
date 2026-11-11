"""Install/remove on the disposable hosted runner, never a user's machine."""
import ctypes
from ctypes import wintypes
import json
import os
from pathlib import Path
import subprocess
import tempfile
import time

if os.environ.get('GITHUB_ACTIONS') != 'true' or os.name != 'nt':
    raise SystemExit('Run this test only on the temporary Windows CI runner.')
package = Path('dist/Fokus-windows-x64').resolve()
hosts = Path(os.environ['SystemRoot']) / 'System32/drivers/etc/hosts'
original = hosts.read_bytes()
call = ctypes.WinDLL('kernel32', use_last_error=True).CallNamedPipeW
call.argtypes = [wintypes.LPCWSTR, ctypes.c_void_p, wintypes.DWORD, ctypes.c_void_p,
                 wintypes.DWORD, ctypes.POINTER(wintypes.DWORD), wintypes.DWORD]
call.restype = wintypes.BOOL

def request(value):
    data = json.dumps(value).encode()
    result = ctypes.create_string_buffer(200000)
    count = wintypes.DWORD()
    if not call(r'\\.\pipe\dev.usefokus.blocker',data,len(data),result,len(result),ctypes.byref(count),6000):
        raise ctypes.WinError(ctypes.get_last_error())
    response = json.loads(result.raw[:count.value])
    assert 'error' not in response, response
    return response

def setup(name, rules):
    sid = subprocess.check_output(['powershell.exe','-NoProfile','-Command',
        '[Security.Principal.WindowsIdentity]::GetCurrent().User.Value'],text=True).strip()
    subprocess.run(['powershell.exe','-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',
        '-File',str(package/name),'-Source',str(package),'-Rules',str(rules),'-OwnerSid',sid],check=True)

with tempfile.TemporaryDirectory(prefix='fokus-service-') as folder:
    rules = Path(folder)/'pending.json'
    rules.write_text(json.dumps({'sites':['example.test'],
        'schedule':{'enabled':False,'days':[0],'start':540,'end':1020},
        'focusUntil':int(time.time())+120,'breakUntil':0,'siteBreaks':{}}))
    try:
        setup('install-helper.ps1',rules)
        state = request({'type':'status'})
        assert state['ready'] and state['problem'] is None, state
        assert b'0.0.0.0 example.test' in hosts.read_bytes()
        request({'type':'break','minutes':1,'site':None})
        assert hosts.read_bytes() == original
        # Reinstall/reconnect must retain authoritative service rules.
        setup('install-helper.ps1',rules)
        assert request({'type':'status'})['rules']['breakUntil'] > int(time.time())
        request({'type':'resume','site':None})
        assert b'0.0.0.0 example.test' in hosts.read_bytes()
    finally:
        setup('uninstall-helper.ps1',rules)
    assert hosts.read_bytes() == original
    print('PASS: actual Windows service install, hosts enforcement, breaks, upgrade persistence and removal.')
