const title = document.querySelector("h1");
const detail = document.querySelector("#detail");
const action = document.querySelector("#action");
function render() {
  const [state, host] = location.hash.slice(1).split("/");
  if (!/^[a-z0-9.-]+$/i.test(host || "")) { action.hidden = true; return; }
  const available = state === "available";
  title.textContent = available ? "Site available" : "Site blocked";
  document.title = host + " · Fokus";
  detail.textContent = available ? host + " is available again." : host + " is on your block list.";
  action.textContent = available ? "Return to " + host : "Unblock temporarily";
  action.onclick = () => {
    if (available) location.replace("https://" + host + "/");
    else location.replace("#allow/" + host);
  };
}
addEventListener("hashchange", render);
render();
