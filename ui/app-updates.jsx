import React, { useEffect, useState } from "react";
import { Button, Dialog } from "@radix-ui/themes";
import { Download } from "lucide-react";
import { invoke } from "./settings";

export function useAppUpdates(report) {
  const [status, setStatus] = useState({});
  const [offer, setOffer] = useState(false);
  const [checking, setChecking] = useState(false);
  useEffect(() => {
    let sequence = 0;
    const read = async () => {
      const request = ++sequence;
      try {
        const latest = await invoke("app_update_status");
        if (request === sequence && latest) setStatus(latest);
      } catch { /* The web preview has no native updater. */ }
    };
    const changed = () => { setChecking(false); void read(); };
    const show = () => { void read(); setOffer(true); };
    window.addEventListener("fokus-update-changed", changed);
    window.addEventListener("fokus-update-offer", show);
    void read();
    return () => {
      sequence++;
      window.removeEventListener("fokus-update-changed", changed);
      window.removeEventListener("fokus-update-offer", show);
    };
  }, []);
  const check = () => {
    setChecking(true);
    invoke("app_update_check").catch(error => { setChecking(false); report(error); });
  };
  const install = () => {
    setOffer(false);
    invoke("app_update_install").catch(report);
  };
  useEffect(() => { if (status.error) report(status.error); }, [status.error]);
  return { ...status, offer, setOffer, checking, check, install };
}

export function UpdateIndicator({ update }) {
  if (!update.available) return null;
  const label = update.installing ? "Updating Fokus…" : `Update to Fokus ${update.available} and restart`;
  return <button className="update-indicator" onClick={update.install}
    disabled={update.installing} title={label} aria-label={label}>
    <Download size={16} aria-hidden="true" />
  </button>;
}

export function UpdateOffer({ update }) {
  return <Dialog.Root open={Boolean(update.offer && update.available)} onOpenChange={update.setOffer}>
    <Dialog.Content maxWidth="380px">
      <Dialog.Title>Fokus {update.available} is available</Dialog.Title>
      <Dialog.Description>You have Fokus {update.current}.</Dialog.Description>
      <div className="update-actions">
        <Dialog.Close><Button variant="soft" color="gray">Later</Button></Dialog.Close>
        <Button onClick={update.install}>Update and restart</Button>
      </div>
    </Dialog.Content>
  </Dialog.Root>;
}
