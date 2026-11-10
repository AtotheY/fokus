// Render the same horizon in the session artwork, Dock tile and finish previews.
const { createCanvas } = require("@napi-rs/canvas");
const { writeFileSync, mkdirSync } = require("node:fs");
const finishes = {
  ceramic: ["#e8e1d8", "#3e3853", "#8f80ae", "#f7d49c"],
  celadon: ["#bbd8c6", "#24483d", "#82b69e", "#f9ebbb"],
  midnight: ["#283045", "#292e57", "#849cde", "#f8e0b8"],
  obsidian: ["#38393f", "#1a1b22", "#81828c", "#dedde4"],
  amber: ["#d39342", "#713a23", "#d89448", "#ffe8aa"],
  frost: ["#c5dfeb", "#31516d", "#86b2d0", "#f6f2d7"],
  travertine: ["#d6c2a4", "#624637", "#ba9b73", "#fff0c8"],
  copper: ["#bc816a", "#52342f", "#ad7965", "#ffdcac"],
  ink: ["#dedbd2", "#26252b", "#777680", "#fcf0cf"],
  bloom: ["#ddbbcd", "#62394f", "#ba84a1", "#ffe5cb"],
  graphite: ["#55545c", "#282831", "#94919c", "#f3e7ce"],
  safelight: ["#984f46", "#51292f", "#c07563", "#ffe2af"],
};
const lerp = (a, b, t) => a + (b - a) * t;
function blend(a, b, t) {
  const mix = [1, 3, 5].map((i) =>
    Math.round(
      lerp(parseInt(a.slice(i, i + 2), 16), parseInt(b.slice(i, i + 2), 16), t),
    ),
  );
  return "rgb(" + mix.join(",") + ")";
}
function gradient(g, x, y, x2, y2, stops) {
  const grad = g.createLinearGradient(x, y, x2, y2);
  for (const [p, c] of stops) grad.addColorStop(p, c);
  return grad;
}
function icon(p) {
  const c = createCanvas(512, 512),
    g = c.getContext("2d");
  g.scale(4, 4);
  g.shadowColor = "#0006";
  g.shadowBlur = 6;
  g.shadowOffsetY = 3;
  g.fillStyle = p[0];
  g.beginPath();
  g.roundRect(9, 8, 110, 110, 26);
  g.fill();
  g.shadowColor = "transparent";
  g.save();
  g.clip();
  g.fillStyle = gradient(g, 20, 8, 100, 118, [
    [0, blend(p[0], "#ffffff", 0.33)],
    [0.48, p[0]],
    [1, blend(p[0], "#000000", 0.2)],
  ]);
  g.fillRect(8, 7, 112, 112);
  g.lineWidth = 1;
  g.strokeStyle = "#ffffff80";
  g.stroke();
  g.restore();
  g.save();
  g.beginPath();
  g.arc(64, 63, 38, 0, Math.PI * 2);
  g.clip();
  g.fillStyle = gradient(g, 48, 25, 80, 102, [
    [0, blend(p[1], p[2], 0.65)],
    [1, p[1]],
  ]);
  g.fillRect(20, 20, 90, 90);
  g.fillStyle = p[3];
  g.beginPath();
  g.arc(75, 51, 11, 0, 7);
  g.fill();
  for (let i = 0; i < 3; i++) {
    g.beginPath();
    const y = 64 + i * 8;
    g.moveTo(15, 120);
    g.lineTo(15, y);
    g.bezierCurveTo(46, y - 29 + i * 7, 68, y + 27 - i * 3, 112, y - 12);
    g.lineTo(115, 125);
    g.closePath();
    g.fillStyle = gradient(g, 64, y - 12, 64, 115, [
      [0, blend(p[2], "#ffffff", 0.32 - i * 0.09)],
      [0.45, blend(p[2], p[1], 0.24 + i * 0.19)],
      [1, p[1]],
    ]);
    g.fill();
    g.strokeStyle = "#ffffff45";
    g.lineWidth = 0.45;
    g.stroke();
  }
  g.restore();
  return c.toBuffer("image/png");
}
const W = 1680,
  H = 550,
  c = createCanvas(W, H),
  g = c.getContext("2d");
g.fillStyle = gradient(g, 0, H, W * 0.9, 0, [
  [0, "#191922"],
  [0.44, "#27243a"],
  [0.77, "#443956"],
  [1, "#30273f"],
]);
g.fillRect(0, 0, W, H);
let seed = 57;
function rand() {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}
for (let i = 0; i < 125; i++) {
  const x = rand() * W,
    y = rand() * H * 0.63;
  g.fillStyle = "rgba(240,225,220," + rand() * 0.36 + ")";
  g.fillRect(x, y, rand() * 1.8 + 1, 1.5);
}
function saveLayer(name) {
  const pixels = g.getImageData(0, 0, W, H);
  for (let i = 0; i < pixels.data.length; i += 4) {
    const grain = (rand() - 0.5) * 9;
    for (let k = 0; k < 3; k++) pixels.data[i + k] += grain;
  }
  g.putImageData(pixels, 0, 0);
  writeFileSync("public/" + name + ".webp", c.toBuffer("image/webp", 94));
}
saveLayer("sky");
g.clearRect(0, 0, W, H);
function ridge(x, layer) {
  const t = x / W;
  return (
    H * (0.57 + layer * 0.082) +
    Math.sin(t * 8.4 + layer * 0.98) * 37 +
    Math.sin(t * 15.1 + layer * 1.54) * 22 +
    Math.sin(t * 33 + layer * 0.8) * 5 -
    45 * Math.exp(-((t - 0.73) ** 2) / 0.025)
  );
}
const levels = [
  ["#9b879e", "#514660"],
  ["#817894", "#494459"],
  ["#716b87", "#38384e"],
  ["#5d5975", "#333447"],
  ["#48475f", "#292a3c"],
  ["#36374d", "#242533"],
];
levels.forEach(([top, bottom], i) => {
  g.save();
  g.beginPath();
  g.moveTo(0, H);
  for (let x = 0; x <= W; x += 3) g.lineTo(x, ridge(x, i));
  g.lineTo(W, H);
  g.closePath();
  g.clip();
  g.fillStyle = gradient(g, 0, H * (0.36 + i * 0.08), 0, H, [
    [0, top],
    [1, bottom],
  ]);
  g.fillRect(0, 0, W, H);
  for (let k = 0; k < 90; k++) {
    g.beginPath();
    for (let x = 0; x <= W; x += 4) {
      let y =
        ridge(x + k * 1.9, i) + k * (3.4 + 0.9 * Math.sin((x / W) * 5 + i));
      if (!x) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.lineWidth = k === 0 ? 2 : 1;
    g.strokeStyle = k === 0 ? "#f8d9e576" : "#f1ddf227";
    g.stroke();
  }
  g.restore();
});
saveLayer("ridges");
mkdirSync("public/icons", { recursive: true });
for (const [name, palette] of Object.entries(finishes))
  writeFileSync("public/icons/" + name + ".png", icon(palette));
writeFileSync("desktop/icons/icon.png", icon(finishes.ceramic));

const status = createCanvas(36, 36);
const pen = status.getContext("2d");
pen.lineWidth = 3;
pen.strokeStyle = "#000";
pen.lineCap = "round";
pen.beginPath();
pen.arc(18, 18, 13, 0, Math.PI * 2);
pen.stroke();
pen.beginPath();
pen.moveTo(5.5, 20);
pen.bezierCurveTo(13, 13, 19, 25, 30, 19);
pen.stroke();
pen.beginPath();
pen.arc(21, 13, 3.2, 0, Math.PI * 2);
pen.fill();
writeFileSync("desktop/icons/status.png", status.toBuffer("image/png"));
