#!/bin/bash
set -euo pipefail
base="/Library/Application Support/Fokus"
/bin/launchctl bootout system/dev.usefokus.app 2>/dev/null || true
"${1:-$base/fokus-helper}" --clear
/bin/rm -f /var/run/dev.usefokus.app.sock /Library/LaunchDaemons/dev.usefokus.app.plist "$base/fokus-helper" "$base/rules.json"
/bin/rmdir "$base" || true
