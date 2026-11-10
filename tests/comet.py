"""Exercise the exact macOS URL parser and tab logic without accessing a browser."""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    path = Path(tmp)
    hosts = path / "hosts"
    hosts.write_text(
        "0.0.0.0 unrelated.test\n# >>> Fokus website blocking >>>\n"
        "0.0.0.0 x.com\n:: x.com\n0.0.0.0 www.reddit.com\n"
        "# <<< Fokus website blocking <<<\n0.0.0.0 other.test\n"
    )
    script = path / "check.js"
    script.write_text((root / "browser/watch-comet.js").read_text() + r"""
function run([path]) {
  const rules = readRules(path);
  const page = "file:///Fokus/blocked.html";
  const blocked = page + "#blocked/x.com";
  const available = page + "#available/x.com";
  function check(address, current, expected, hosts) {
    let target = address;
    const tab = {get url() {return () => current}, set url(value) {target = value}};
    inspect(tab, address, hosts, page);
    if (target !== expected) throw Error("Unexpected navigation for " + address);
  }
  if (rules.size !== 2) throw Error("Exported unrelated hosts");
  for (const raw of ["https://X.COM./home", "https://someone@x.com:443/"]) {
    check(raw, raw, blocked, rules);
  }
  for (const raw of ["https://unrelated.test/", "https://x.com.example.org/", "https://x.com@example.org/"]) {
    check(raw, raw, raw, rules);
  }
  check("https://x.com/home", "https://example.org", "https://x.com/home", rules);
  check(blocked, blocked, available, new Set());
  check(available, available, blocked, rules);
  check(page + "#allow/x.com", page + "#allow/x.com", blocked, rules);
}
""")
    output = subprocess.check_output(
        ["/usr/bin/osascript", "-l", "JavaScript", script, hosts], text=True
    )
    assert output.strip() == '{"allow":"x.com"}'
print("Comet tab replacement, exact hosts, navigation races and breaks passed.")
