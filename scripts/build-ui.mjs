import { build } from "esbuild";
import { cp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
await mkdir("web", { recursive: true });
await cp("public", "web", { recursive: true });
const themes = {};
for (const name of await readdir("themes"))
  if (name.endsWith(".css"))
    themes[name.slice(0, -4)] = await readFile("themes/" + name, "utf8");
await build({
  entryPoints: ["ui/main.jsx"],
  bundle: true,
  external: ["/sky.webp", "/ridges.webp"],
  assetNames: "[name]",
  minify: true,
  jsx: "automatic",
  outfile: "web/app.js",
  define: {
    BUNDLED_THEMES: JSON.stringify(themes),
    BUNDLED_SITE_ICONS: JSON.stringify((await readdir("public/site-icons")).filter(n => n.endsWith(".png")).map(n => n.slice(0, -4))),
  },
  logLevel: "info",
});
await writeFile(
  "web/index.html",
  '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fokus</title><link rel="icon" href="icons/ceramic.png"><link rel="stylesheet" href="app.css"></head><body><div id="root"></div><script src="app.js"></script></body></html>',
);
