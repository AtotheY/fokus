#!/bin/bash
set -euo pipefail
# Invoked by the app through the system administrator authorization panel.
helper="$1"
rules="$2"
owner="$3"
[[ "$owner" =~ ^[0-9]+$ ]]
base="/Library/Application Support/Fokus"
plist="/Library/LaunchDaemons/dev.usefokus.app.plist"
service="system/dev.usefokus.app"
# Retire a preview daemon only if its root-owned plist runs this same helper.
for preview in /Library/LaunchDaemons/*.fokus.plist; do
  [[ -f "$preview" ]] || continue
  program=$(/usr/libexec/PlistBuddy -c 'Print :ProgramArguments:0' "$preview" 2>/dev/null) || continue
  [[ "$program" == "$base/fokus-helper" ]] || continue
  label=$(/usr/libexec/PlistBuddy -c 'Print :Label' "$preview")
  [[ "$preview" == "/Library/LaunchDaemons/$label.plist" && "$label" =~ ^[a-zA-Z0-9.-]+$ ]] || continue
  /bin/launchctl bootout "system/$label" 2>/dev/null || true
  if /bin/launchctl print "system/$label" >/dev/null 2>&1; then
    echo "Could not stop the previous Fokus helper." >&2
    exit 1
  fi
  /bin/rm -f "$preview" "/var/run/$label.sock"
done
/usr/bin/install -d -o root -g wheel -m 755 "$base"
/usr/bin/install -o root -g wheel -m 755 "$helper" "$base/fokus-helper.next"
/bin/mv -f "$base/fokus-helper.next" "$base/fokus-helper"
if [[ ! -f "$base/rules.json" ]]; then
  /usr/bin/install -o root -g wheel -m 600 "$rules" "$base/rules.json"
fi
/bin/launchctl bootout "$service" 2>/dev/null || true
/bin/cat > "$plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>dev.usefokus.app</string>
<key>ProgramArguments</key><array><string>/Library/Application Support/Fokus/fokus-helper</string><string>$owner</string></array>
<key>RunAtLoad</key><true/><key>KeepAlive</key><true/>
</dict></plist>
PLIST
/bin/chmod 644 "$plist"
/bin/launchctl enable "$service"
/bin/launchctl bootstrap system "$plist"
