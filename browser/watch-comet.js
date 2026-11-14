// Run with macOS JavaScript for Automation. Only an explicit button click
// sends a hostname to Fokus. Return addresses stay in this process's memory.
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

function inspect(tab, address, rules, page, destinations) {
  if (!address.startsWith(page + "#")) {
    const host = siteOf(address);
    if (!rules.has(host)) return;
    const id = tab.id();
    if (tab.url() !== address) return;
    tab.url = page + "#blocked/" + host;
    destinations.set(id, {host, address});
    return id;
  }

  const [state, host] = address.slice(page.length + 1).split("/");
  if (!host || !/^[a-z0-9.-]+$/i.test(host)) return;
  const id = tab.id();
  const saved = destinations.get(id);
  if (rules.has(host)) {
    const blocked = page + "#blocked/" + host;
    if (address !== blocked && tab.url() === address) {
      tab.url = blocked;
      if (state === "allow") send({allow: host});
    }
    if (saved && saved.host === host) return id;
    return;
  }

  const target = saved && saved.host === host ? saved.address : page + "#available/" + host;
  if (address !== target && tab.url() === address) tab.url = target;
  destinations.delete(id);
}

function run([file, hostsPath, parent]) {
  const page = ObjC.unwrap($.NSURL.fileURLWithPath(file).absoluteString);
  const comet = Application("ai.perplexity.comet");
  const destinations = new Map();
  let previous = "", status = "", ticks = 0, releaseTabs = false;
  function report(value) {
    if (status !== value) send({status: value});
    status = value;
  }
  while ($.getppid() === Number(parent)) {
    try {
      if (!comet.running()) {
        destinations.clear();
        report("waiting");
        ticks = 0;
      } else {
        const rules = readRules(hostsPath);
        const signature = Array.from(rules).join(" ");
        if (rules.size || releaseTabs) {
          const windows = comet.windows();
          const fullScan = signature !== previous || ticks % 12 === 0;
          const retained = new Set();
          for (const win of windows) {
            if (fullScan) {
              const addresses = win.tabs.url();
              addresses.forEach((address, i) => {
                if (address) {
                  const id = inspect(win.tabs[i], address, rules, page, destinations);
                  if (id !== undefined) retained.add(id);
                }
              });
            } else {
              const tab = win.activeTab;
              const address = tab.url();
              if (address) inspect(tab, address, rules, page, destinations);
            }
          }
          if (fullScan) {
            for (const id of destinations.keys()) {
              if (!retained.has(id)) destinations.delete(id);
            }
          }
          releaseTabs = rules.size > 0;
          report(releaseTabs ? "connected" : "idle");
          ticks++;
          previous = signature;
        } else {
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
