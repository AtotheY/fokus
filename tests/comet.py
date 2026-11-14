"""Exercise the macOS watcher and the local block page without reading browser tabs."""
from pathlib import Path
import subprocess
import tempfile

root = Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    path = Path(tmp)
    hosts = path / "hosts"
    hosts.write_text(
        "0.0.0.0 unrelated.test\n# >>> Fokus website blocking >>>\n"
        "0.0.0.0 x.com\n:: x.com\n0.0.0.0 www.linkedin.com\n0.0.0.0 instagram.com\n"
        "# <<< Fokus website blocking <<<\n0.0.0.0 other.test\n"
    )
    script = path / "check.js"
    script.write_text((root / "browser/watch-comet.js").read_text() + r"""
function run([path]) {
  const rules = readRules(path);
  const page = "file:///Fokus/blocked.html";
  function check(address, hosts, expected, current = address) {
    let target = address;
    const tab = {get url() {return () => current}, set url(value) {target = value}};
    inspect(tab, address, hosts, page);
    if (target !== expected) throw Error("Unexpected navigation for " + address);
  }
  if (rules.size !== 3) throw Error("Exported unrelated hosts");
  const siteBreak = new Set(["x.com"]);
  for (const raw of [
    "https://X.COM./home", "https://someone@x.com:443/",
    "https://instagram.com/asistilli", "http://www.linkedin.com:8080/in/example/?view=full#about",
    "https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A123/?q=a%2Fb#comments"
  ]) {
    const payload = encodeURIComponent(raw);
    const blocked = page + "#blocked/" + payload;
    const available = page + "#available/" + payload;
    check(raw, rules, blocked);
    check(blocked, rules, blocked);
    check(blocked, new Set(), available);
    check(available, rules, blocked);
    check(blocked, new Set(), blocked, "https://other.test/");
    if (siteOf(raw) !== "x.com") check(blocked, siteBreak, available);
  }
  for (const raw of ["https://unrelated.test/", "https://x.com.example.org/", "https://x.com@example.org/"]) {
    check(raw, rules, raw);
  }
  check("https://x.com/home", rules, "https://x.com/home", "https://example.org");
  const payload = encodeURIComponent("https://www.linkedin.com/in/example/#about");
  check(page + "#allow/" + payload, rules, page + "#blocked/" + payload);
  check(page + "#allow/" + payload, siteBreak, page + "#available/" + payload);
  check(page + "#allow/x.com", rules, page + "#blocked/x.com");
  check(page + "#blocked/x.com", new Set(), page + "#available/x.com");
  for (const payload of ["%ZZ", "javascript%3Aalert(1)", "file%3A%2F%2F%2Fetc"]) {
    const address = page + "#allow/" + payload;
    check(address, rules, address);
  }
}
""")
    output = subprocess.check_output(
        ["/usr/bin/osascript", "-l", "JavaScript", script, hosts], text=True
    )
    assert output.splitlines() == ['{"allow":"www.linkedin.com"}', '{"allow":"x.com"}']
subprocess.run(["node", root / "tests/comet-page.mjs"], check=True)
print("Comet blocking, break requests and exact return URLs passed.")
