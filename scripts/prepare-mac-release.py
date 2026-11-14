"""Advance the Mac patch and Sparkle build numbers together in a release checkout."""
import json
from pathlib import Path
import plistlib
import re
import subprocess

old = json.loads(Path("package.json").read_text())["version"]
major, minor, patch = map(int, old.split("."))
version = f"{major}.{minor}.{patch + 1}"
plist = Path("desktop/Info.plist")
info = plistlib.loads(plist.read_bytes())
build = int(info["CFBundleVersion"]) + 1


def replace_once(path, pattern, value):
    source = path.read_text()
    result, count = re.subn(pattern, lambda m: m[1] + value, source, flags=re.MULTILINE)
    if count != 1:
        raise ValueError(f"Expected one matching version in {path}, found {count}")
    path.write_text(result)


escaped = re.escape(old)
replace_once(Path("desktop/Cargo.toml"), r'(^version = ")' + escaped + '"$', version + '"')
replace_once(Path("Cargo.lock"), r'(^name = "fokus"\nversion = ")' + escaped + '"$', version + '"')
replace_once(Path("desktop/tauri.conf.json"), r'(^  "version": ")' + escaped + '",', version + '",')
replace_once(plist, r'(<key>CFBundleShortVersionString</key>\s*<string>)' + escaped + '</string>', version + '</string>')
replace_once(plist, r'(<key>CFBundleVersion</key>\s*<string>)\d+</string>', str(build) + '</string>')
# npm updates both package.json and its lockfile without creating a commit or tag.
subprocess.run(["npm", "version", version, "--no-git-tag-version", "--ignore-scripts"], check=True, stdout=subprocess.DEVNULL)
print(f"v{version}")
