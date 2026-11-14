require "json"
require "socket"
require "timeout"

def start_timer(action, input)
  duration = input.to_s.strip
  unless duration.match?(/\A[0-9]{1,3}\z/) && (1..240).cover?(duration.to_i)
    abort "Enter a whole number from 1 to 240 minutes."
  end

  sandbox = ENV["FOKUS_TEST_DIRECTORY"]
  endpoint = sandbox ? File.join(sandbox, "control.sock") : "/var/run/dev.usefokus.app.sock"
  state = Timeout.timeout(6) do
    UNIXSocket.open(endpoint) do |socket|
      socket.write(JSON.generate(type: action, minutes: duration.to_i))
      socket.close_write
      JSON.parse(socket.read)
    end
  end
  abort state["error"] if state["error"]
  abort state["problem"] if state["problem"]

  session = action == "focus"
  deadline = state.fetch("rules").fetch(session ? "focusUntil" : "breakUntil")
  puts "#{session ? 'Focus timer' : 'Break'} until #{Time.at(deadline).strftime('%-I:%M %p')}."
rescue Errno::ENOENT, Errno::ECONNREFUSED, Errno::EACCES
  abort "Open Fokus and enable or reconnect website blocking."
rescue Timeout::Error, SystemCallError, IOError, JSON::ParserError, KeyError
  abort "Could not confirm the timer. Check its status in Fokus."
end
