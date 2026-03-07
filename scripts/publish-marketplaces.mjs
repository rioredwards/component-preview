#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";

function shellQuote(value) {
  if (!value) return "";
  return JSON.stringify(String(value));
}

function run(cmd, env = process.env) {
  console.log(`\n$ ${cmd}`);
  execSync(cmd, { stdio: "inherit", env });
}

function latestVsix() {
  const files = readdirSync(process.cwd())
    .filter((f) => f.endsWith(".vsix"))
    .sort((a, b) => (a > b ? -1 : 1));
  if (!files.length) throw new Error("No .vsix found. Run package first.");
  return files[0];
}

const mode = process.argv[2] || "all";

const baseImagesUrl = process.env.VSCE_BASE_IMAGES_URL || process.env.ASSET_BASE_URL || "";
const baseContentUrl = process.env.VSCE_BASE_CONTENT_URL || process.env.CONTENT_BASE_URL || "";

const baseUrlArgs = [
  baseImagesUrl ? `--baseImagesUrl ${shellQuote(baseImagesUrl)}` : "",
  baseContentUrl ? `--baseContentUrl ${shellQuote(baseContentUrl)}` : "",
]
  .filter(Boolean)
  .join(" ");

run(`npm run package && npx @vscode/vsce package --no-dependencies ${baseUrlArgs}`.trim());
const vsix = latestVsix();

if (mode === "open-vsx" || mode === "all") {
  if (!process.env.OVSX_PAT) {
    throw new Error("Missing OVSX_PAT env var for Open VSX publish.");
  }
  run(`npx ovsx publish ${vsix} -p ${process.env.OVSX_PAT} ${baseUrlArgs}`.trim());
}

if (mode === "vscode" || mode === "all") {
  // VS Code Marketplace publish reads VSCE_PAT from env.
  if (!process.env.VSCE_PAT) {
    throw new Error("Missing VSCE_PAT env var for VS Code Marketplace publish.");
  }
  run(`npx @vscode/vsce publish --packagePath ${vsix} ${baseUrlArgs}`.trim());
}

if (mode === "package") {
  console.log(`\nPackaging complete: ${vsix}`);
} else {
  console.log(`\nPublish flow complete for ${vsix}`);
}
