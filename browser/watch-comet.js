// Run with macOS JavaScript for Automation. Only an explicit button click
// sends a hostname to Fokus. The return URL travels in the local page's fragment.
ObjC.import("AppKit");
ObjC.bindFunction("getppid", ["int", []]);

function send(event) {
  const line = $(JSON.stringify(event) + "\n").dataUsingEncoding($.NSUTF8StringEncoding);
  $.NSFileHandle.fileHandleWithStandardOutput.writeData(line);
}

function readRules(path) {
  const file = $.NSString.stringWithContentsOfFileEncodingError(path, $.NSUTF8StringEncoding, null);
  if (!file) throw Error("Could not read blocking rules");
  const rules = new Set();
  let inside = false;
  for (const line of ObjC.unwrap(file).split(/\r?\n/)) {
    if (line === "# >>> Fokus website blocking >>>") inside = true;
    else if (line === "# <<< Fokus website blocking <<<") inside = false;
    else if (inside && /^0\.0\.0\.0 [a-z0-9.-]+$/.test(line)) rules.add(line.slice(8));
  }
  return rules;
}

function siteOf(address) {
  if (!/^https?:\/\//i.test(address)) return null;
  const url = $.NSURL.URLWithString(address);
  return url && ObjC.unwrap(url.host)?.toLowerCase().replace(/\.$/, "");
}

function inspect(tab, address, rules, page) {
  let target, allow;
  if (address.startsWith(page + "#")) {
    const [state, payload] = address.slice(page.length + 1).split("/");
    if (!payload || !["blocked", "allow", "available"].includes(state)) return;
    let original;
    try { original = decodeURIComponent(payload); } catch { return; }
    // Older block pages carry just the host.
    const host = /^[a-z0-9.-]+$/i.test(payload) ? payload : siteOf(original);
    if (!host) return;
    const blocked = rules.has(host);
    target = page + (blocked ? "#blocked/" : "#available/") + payload;
    if (blocked && state === "allow") allow = host;
  } else {
    if (!rules.has(siteOf(address))) return;
    target = page + "#blocked/" + encodeURIComponent(address);
  }
  if (address === target || tab.url() !== address) return;
  tab.url = target;
  if (allow) send({allow});
}

function canInspectWithoutPrompt() {
  ObjC.import("CoreServices");
  ObjC.bindFunction("AEDeterminePermissionToAutomateTarget", ["int", ["void *", "unsigned int", "unsigned int", "bool"]]);
  const target = $.NSAppleEventDescriptor.descriptorWithBundleIdentifier("ai.perplexity.comet");
  const anyEvent = 0x2a2a2a2a;
  return $.AEDeterminePermissionToAutomateTarget(target.aeDesc, anyEvent, anyEvent, false) === 0;
}

function run([file, hostsPath, parent]) {
  const page = ObjC.unwrap($.NSURL.fileURLWithPath(file).absoluteString);
  const comet = Application("ai.perplexity.comet");
  let previous = null, status = "", ticks = 0;
  function report(value) {
    if (status !== value) send({status: value});
    status = value;
  }
  while ($.getppid() === Number(parent)) {
    try {
      if (!comet.running()) {
        previous = null;
        report("waiting");
        ticks = 0;
      } else {
        const rules = readRules(hostsPath);
        const signature = Array.from(rules).join(" ");
        // Recover open block pages after a restart during a break. A first-time
        // user should only get the Automation prompt when blocking is active.
        if (rules.size || (previous === null ? canInspectWithoutPrompt() : previous !== "")) {
          const windows = comet.windows();
          const fullScan = signature !== previous || ticks % 12 === 0;
          for (const win of windows) {
            if (fullScan) {
              const addresses = win.tabs.url();
              addresses.forEach((address, i) => {
                if (address) inspect(win.tabs[i], address, rules, page);
              });
            } else {
              const tab = win.activeTab;
              const address = tab.url();
              if (address) inspect(tab, address, rules, page);
            }
          }
          report(rules.size ? "connected" : "idle");
          ticks++;
          if (windows.length || rules.size) previous = signature;
        } else {
          previous = signature;
          report("idle");
        }
      }
    } catch (error) {
      const denied = error.errorNumber === -1743 || /not authorized|not permitted/i.test(String(error));
      report(denied ? "denied" : "retrying");
      ticks = 0;
    }
    delay(status === "denied" ? 5 : status === "connected" ? 0.8 : 2);
  }
}
