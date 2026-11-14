import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";

const script = readFileSync(new URL("../browser/comet-page/blocked.js", import.meta.url), "utf8");
const action = {};
const location = {replace(value) { navigations.push(value); }};
const navigations = [];
let render;
runInNewContext(script, {
  URL, location: Object.assign(location, {hash: ""}),
  document: {querySelector: selector => selector === "#action" ? action : {}},
  addEventListener: (_, handler) => { render = handler; },
});

for (const url of [
  "https://instagram.com/asistilli",
  "https://www.linkedin.com/feed/update/urn%3Ali%3Aactivity%3A123/?q=a%2Fb#comments",
  "http://www.linkedin.com:8080/in/example/?view=full#about",
]) {
  const payload = encodeURIComponent(url);
  location.hash = "#blocked/" + payload;
  render();
  action.onclick();
  assert.deepEqual(navigations.splice(0), ["#allow/" + payload]);

  location.hash = "#available/" + payload;
  render();
  assert.equal(action.hidden, false);
  assert.deepEqual(navigations.splice(0), [url]);
  action.onclick();
  assert.deepEqual(navigations.splice(0), [url]);
}

location.hash = "#available/www.linkedin.com";
render();
action.onclick();
assert.deepEqual(navigations.splice(0), ["https://www.linkedin.com/"]);
for (const payload of ["%ZZ", "javascript%3Aalert(1)", "file%3A%2F%2F%2Fetc"]) {
  location.hash = "#available/" + payload;
  render();
  assert.equal(action.hidden, true);
  assert.equal(navigations.length, 0);
}
