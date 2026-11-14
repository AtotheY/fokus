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
        "0.0.0.0 x.com\n:: x.com\n0.0.0.0 www.linkedin.com\n"
        "# <<< Fokus website blocking <<<\n0.0.0.0 other.test\n"
    )
    script = path / "check.js"
    script.write_text((root / "browser/watch-comet.js").read_text() + r"""
function run([path]) {
  const rules = readRules(path);
  const page = "file:///Fokus/blocked.html";
  const blocked = page + "#blocked/x.com";
  const available = page + "#available/x.com";
  const destinations = new Map();
  function check(address, current, expected, hosts, id = "1") {
    let target = address;
    const tab = {id: () => id, get url() {return () => current}, set url(value) {target = value}};
    inspect(tab, address, hosts, page, destinations);
    if (target !== expected) throw Error("Unexpected navigation for " + address);
  }
  if (rules.size !== 2) throw Error("Exported unrelated hosts");
  for (const raw of ["https://X.COM./home", "https://someone@x.com:443/"]) {
    check(raw, raw, blocked, rules);
    check(blocked, blocked, raw, new Set());
  }
  for (const raw of ["https://unrelated.test/", "https://x.com.example.org/", "https://x.com@example.org/"]) {
    check(raw, raw, raw, rules);
  }
  check("https://x.com/home", "https://example.org", "https://x.com/home", rules);
  check(blocked, blocked, available, new Set());
  check(available, available, blocked, rules);
  check(page + "#allow/x.com", page + "#allow/x.com", blocked, rules);

  const post = "https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A123/?q=a%2Fb#comments";
  const profile = "http://www.linkedin.com:8080/in/example/?view=full#about";
  const linkedin = page + "#blocked/www.linkedin.com";
  const request = page + "#allow/www.linkedin.com";
  const siteBreak = new Set(["x.com"]);
  check(post, post, linkedin, rules, "a");
  check(profile, profile, linkedin, rules, "b");
  check(request, request, linkedin, rules, "a");
  check(linkedin, linkedin, linkedin, rules, "a");
  check(linkedin, linkedin, profile, siteBreak, "b");
  check(linkedin, linkedin, post, siteBreak, "a");
  if (destinations.size) throw Error("Released tabs retained their addresses");

  check(post, post, linkedin, rules, "a");
  check(linkedin, "https://other.test/", linkedin, new Set(), "a");
  check(post, post, linkedin, rules, "a");
  check(blocked, blocked, available, new Set(), "a");
}
""")
    output = subprocess.check_output(
        ["/usr/bin/osascript", "-l", "JavaScript", script, hosts], text=True
    )
    assert output.splitlines() == ['{"allow":"x.com"}', '{"allow":"www.linkedin.com"}']
print("Comet tab replacement, exact hosts, navigation races and breaks passed.")
