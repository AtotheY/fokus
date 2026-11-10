"""Reject private build paths and Mac metadata before publishing the installer."""
import pathlib
import re
import sys
import zipfile

with zipfile.ZipFile(sys.argv[1]) as archive:
    bad = archive.testzip()
    if bad:
        sys.exit(f"Invalid ZIP entry: {bad}")
    names = set(archive.namelist())
    required = {"Fokus.app/Contents/MacOS/Fokus", "Fokus.app/Contents/MacOS/fokus-helper"}
    if not required <= names:
        sys.exit("Installer is missing an executable")
    for name in names:
        parts = pathlib.PurePosixPath(name).parts
        if parts[0] != "Fokus.app" or any(p.startswith(".") or p == "__MACOSX" for p in parts):
            sys.exit(f"Unexpected archive entry: {name}")
        if re.search(rb"/Users/[^/\x00\n]{1,90}/|/private/var/folders/|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----", archive.read(name)):
            sys.exit(f"Private key marker or workstation path in {name}")
print("Installer integrity and privacy checks passed.")
