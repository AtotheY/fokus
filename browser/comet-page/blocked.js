const title = document.querySelector("h1");
const detail = document.querySelector("#detail");
const action = document.querySelector("#action");

function destination(payload) {
  if (/^[a-z0-9.-]+$/i.test(payload)) return {host: payload, url: "https://" + payload + "/", legacy: true};
  try {
    const url = decodeURIComponent(payload);
    if (!/^https?:\/\//i.test(url)) return;
    const host = new URL(url).hostname;
    if (host) return {host, url};
  } catch { /* A damaged fragment has no return address. */ }
}

function render() {
  const [state, payload] = location.hash.slice(1).split("/");
  const target = payload && destination(payload);
  action.hidden = !target;
  if (!target) return;
  const available = state === "available";
  title.textContent = available ? "Site available" : "Site blocked";
  document.title = target.host + " · Fokus";
  detail.textContent = available ? target.host + " is available again." : target.host + " is on your block list.";
  action.textContent = available ? "Return to " + target.host : "Unblock temporarily";
  action.onclick = () => location.replace(available ? target.url : "#allow/" + payload);
  if (available && !target.legacy) location.replace(target.url);
}
addEventListener("hashchange", render);
render();
