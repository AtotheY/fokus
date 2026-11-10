import { useEffect, useState } from "react";
import { Button } from "@radix-ui/themes";
import { ShieldCheck, Globe, RotateCw } from "lucide-react";
import { invoke } from "./settings";

// Scope uses the helper's hostname rules, including its service aliases.
export function ScopePreview({ input }) {
  const [result, setResult] = useState(null);
  useEffect(() => {
    let alive = true;
    setResult(null);
    if (!input.trim()) return;
    const timer = setTimeout(
      () =>
        invoke("site_scope", { site: input })
          .then((result) => {
            if (alive) setResult(result);
          })
          .catch(() => {}),
      150,
    );
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [input]);
  if (!result) return null;
  return (
    <details className="scope-preview">
      <summary>
        Blocks the whole site · <strong>{result.site}</strong>
      </summary>
      <p>{result.hosts.join(", ")}</p>
    </details>
  );
}

export function WebsiteCheck({ site, expected, ready }) {
  const [check, setCheck] = useState(null),
    [attempt, retry] = useState(0);
  useEffect(() => {
    let alive = true;
    setCheck(null);
    invoke("check_website", { site })
      .then((result) => {
        if (alive) setCheck(result);
      })
      .catch((e) => {
        if (alive) setCheck({ error: String(e) });
      });
    return () => {
      alive = false;
    };
  }, [site, attempt, expected, ready]);
  const blocked = check?.resolution === "blocked";
  const route = check?.resolution === "routable";
  let title = "Checking this computer…",
    detail = "";
  if (check?.error) {
    title = "Couldn’t check this address";
    detail = check.error;
  } else if (check) {
    if (expected && blocked) {
      title = "Blocking address confirmed";
      detail =
        "If an existing tab still works, reopen the browser to clear its connection. A remote proxy can use its own DNS.";
    } else if (expected && route) {
      title = "This computer still resolves the website";
      detail =
        "This site is on the block list. Check again in a moment. If this persists, check your DNS or VPN settings.";
    } else if (!expected && blocked) {
      title = "This computer still returns a blocking address";
      detail =
        "Check again after a moment. Another blocker, a DNS filter or a cached answer can also produce this result.";
    } else if (!expected && route) {
      title = "This computer returns a website address";
      detail =
        "If a tab still shows an error, reopen it. This check tests name resolution only.";
    } else {
      title = "The result is inconclusive";
      detail =
        "The resolver returned mixed or empty results. Check your DNS or VPN settings and try again.";
    }
  }
  return (
    <div className="site-check">
      <div className="check-rule">
        {expected ? <ShieldCheck size={15} /> : <Globe size={15} />}{" "}
        {ready
          ? expected
            ? "Blocking is on for this site"
            : "This site is allowed"
          : "Blocking is inactive"}
      </div>
      <div role="status">
        <strong>{title}</strong>
        {detail && <p>{detail}</p>}
      </div>
      <Button
        type="button"
        size="1"
        color="gray"
        variant="ghost"
        disabled={!check}
        onClick={() => retry((n) => n + 1)}
      >
        <RotateCw size={13} />
        Check again
      </Button>
    </div>
  );
}

export function useBreakPause(open, enabled) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    if (!open || !enabled) {
      setRemaining(0);
      return;
    }
    const end = Date.now() + 5000;
    setRemaining(5);
    const timer = setInterval(() => {
      const left = Math.max(0, Math.ceil((end - Date.now()) / 1000));
      setRemaining(left);
      if (!left) clearInterval(timer);
    }, 150);
    return () => clearInterval(timer);
  }, [open, enabled]);
  return open && enabled ? remaining : 0;
}
