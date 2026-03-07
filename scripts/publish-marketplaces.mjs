#!/usr/bin/env node
import { execSync } from "node:child_process";
import { readdirSync } from "node:fs";

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

run("npm run package:vsix");
const vsix = latestVsix();

if (mode === "open-vsx" || mode === "all") {
  if (!process.env.OVSX_PAT) {
    throw new Error("Missing OVSX_PAT env var for Open VSX publish.");
  }
  run(`npx ovsx publish ${vsix} -p ${process.env.OVSX_PAT}`);
}

if (mode === "all") {
  // VS Code Marketplace publish reads VSCE_PAT from env.
  if (!process.env.VSCE_PAT) {
    throw new Error("Missing VSCE_PAT env var for VS Code Marketplace publish.");
  }
  run(`npx @vscode/vsce publish --packagePath ${vsix}`);
}

console.log(`\nPublish flow complete for ${vsix}`);
