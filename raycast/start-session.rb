#!/usr/bin/ruby
# @raycast.schemaVersion 1
# @raycast.title Fokus: Start Session
# @raycast.mode compact
# @raycast.packageName Fokus
# @raycast.icon 🎯
# @raycast.argument1 {"type":"text","placeholder":"Minutes (1–240)"}

require_relative "timer"
start_timer("focus", ARGV.first)
