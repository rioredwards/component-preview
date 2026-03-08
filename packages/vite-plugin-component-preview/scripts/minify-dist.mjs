import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { transform } from "esbuild";

const distDir = new URL("../dist", import.meta.url);

async function walk(dir) {
  const entries = await readdir(dir, { withFileTypes: true });
  const out = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...(await walk(full)));
    } else if (entry.isFile() && full.endsWith(".js")) {
      out.push(full);
    }
  }
  return out;
}

const files = await walk(distDir.pathname);
for (const file of files) {
  const source = await readFile(file, "utf8");
  const result = await transform(source, {
    loader: "js",
    minify: true,
    format: "esm",
    target: "es2020",
    sourcemap: false,
    legalComments: "none",
  });
  await writeFile(file, result.code, "utf8");
}

console.log(`Minified ${files.length} dist JS files.`);
