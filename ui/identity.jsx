import React, { useEffect, useRef, useState } from "react";
import { AppWindow, Globe } from "lucide-react";
import { invoke } from "./settings";

const bundled = new Set(BUNDLED_SITE_ICONS);
const icons = new Map();

function lookup(id, isApp) {
  const key = (isApp ? "app:" : "site:") + id;
  const cached = icons.get(key);
  if (cached) return cached;
  const request = invoke(isApp ? "app_icon" : "site_icon", isApp ? { id } : { site: id })
    .catch(() => null);
  icons.set(key, request);
  request.then((src) => {
    if (!src) setTimeout(() => icons.delete(key), 60_000);
  });
  return request;
}

export function IdentityIcon({ site, appId }) {
  const id = appId || site;
  const asset = !appId && bundled.has(site) ? "/site-icons/" + site + ".png" : null;
  const ref = useRef(null);
  const [loaded, setLoaded] = useState(null);
  useEffect(() => {
    if (asset) return;
    let current = true;
    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;
      observer.disconnect();
      lookup(id, Boolean(appId)).then((src) => {
        if (current) setLoaded({ id, src });
      });
    }, { rootMargin: "64px" });
    observer.observe(ref.current);
    return () => { current = false; observer.disconnect(); };
  }, [id, appId, asset]);
  const src = asset || (loaded?.id === id && loaded.src);
  return (
    <span className="identity-icon" aria-hidden="true" ref={ref}>
      {src ? <img alt="" src={src} /> : appId ? <AppWindow /> : <Globe />}
    </span>
  );
}

export function SitePreviews({ value }) {
  const [sites, setSites] = useState([]);
  useEffect(() => {
    const timer = setTimeout(() => {
      const hosts = new Set();
      for (const token of value.trim().split(/[\s,]+/)) {
        try {
          const url = new URL(token.includes("://") ? token : "https://" + token);
          const host = url.hostname.replace(/^www\./, "").replace(/\.$/, "");
          if (/^https?:$/.test(url.protocol) && !url.username && !url.password &&
              /^[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}$/i.test(host)) hosts.add(host);
        } catch { /* Incomplete domain. */ }
      }
      setSites([...hosts]);
    }, 450);
    return () => clearTimeout(timer);
  }, [value]);
  if (!sites.length) return null;
  return (
    <div className="site-previews">
      {sites.slice(0, 4).map((site) => (
        <span className="site-preview" key={site}><IdentityIcon site={site} /><span>{site}</span></span>
      ))}
      {sites.length > 4 && <small>+{sites.length - 4} more</small>}
    </div>
  );
}
