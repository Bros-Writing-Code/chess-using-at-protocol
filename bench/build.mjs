// Bundles every adapter (with the shared harness) into bench/dist/<id>.js and
// writes one HTML page per method: bench/dist/<id>.html.
//
//   npm run bench:build
//
// Methods whose npm packages aren't installed are skipped with a message.

import { build } from "esbuild";
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const benchDir = dirname(fileURLToPath(import.meta.url));
const root = join(benchDir, "..");
const dist = join(benchDir, "dist");
const nm = (p) => join(root, "node_modules", p);

// css: files copied into dist/css and linked from the page.
// copy: [from, to] directories copied next to the page (assets the library loads at runtime).
const methods = {
  baseline: {},
  dom: {},
  svg: {},
  canvas: {},
  chessground: {
    css: ["chessground/assets/chessground.base.css", "chessground/assets/chessground.brown.css", "chessground/assets/chessground.cburnett.css"],
  },
  cmchessboard: {
    css: ["cm-chessboard/assets/chessboard.css"],
    copy: [["cm-chessboard/assets", "assets"]],
  },
  reactchessboard: {},
  chessboardjs: {
    css: ["@chrisoakman/chessboardjs/dist/chessboard-1.0.0.min.css"],
  },
};

function findCss(p) {
  if (existsSync(nm(p))) return nm(p);
  // fall back to any .css in the same folder (file names differ between versions)
  const dir = dirname(nm(p));
  if (!existsSync(dir)) return null;
  const alt = readdirSync(dir).find((f) => f.endsWith(".css"));
  return alt ? join(dir, alt) : null;
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, "css"), { recursive: true });

for (const [id, cfg] of Object.entries(methods)) {
  try {
    await build({
      stdin: {
        contents: `import { run } from "./harness.js"; import adapter from "./adapters/${id}.js"; run(adapter);`,
        resolveDir: benchDir,
      },
      bundle: true,
      minify: true,
      format: "esm",
      outfile: join(dist, `${id}.js`),
      define: { "process.env.NODE_ENV": '"production"' },
      logLevel: "silent",
    });

    const cssTags = [];
    for (const p of cfg.css ?? []) {
      const src = findCss(p);
      if (!src) throw new Error(`missing CSS file: node_modules/${p}`);
      const name = `${id}-${relative(dirname(src), src).replace(/\W/g, "_")}-${cssTags.length}.css`;
      cpSync(src, join(dist, "css", name));
      cssTags.push(`<link rel="stylesheet" href="css/${name}">`);
    }
    for (const [from, to] of cfg.copy ?? []) {
      if (!existsSync(nm(from))) throw new Error(`missing folder: node_modules/${from}`);
      cpSync(nm(from), join(dist, to), { recursive: true });
    }

    writeFileSync(
      join(dist, `${id}.html`),
      `<!doctype html>\n<html lang="en"><head><meta charset="utf-8"><title>Bench: ${id}</title>\n${cssTags.join("\n")}\n</head>\n<body><script type="module" src="${id}.js"></script></body></html>\n`
    );
    console.log(`built   ${id}`);
  } catch (err) {
    console.log(`SKIPPED ${id}: ${String(err.message).split("\n")[0]}`);
  }
}

cpSync(join(benchDir, "index.html"), join(dist, "index.html"));
console.log("\nServe with: npm run bench:serve  then open http://localhost:8080/");
