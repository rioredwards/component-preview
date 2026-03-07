import { spawn } from "child_process";
import * as fs from "fs";
import * as path from "path";

const HOST = "127.0.0.1";
const PORT = 5173;
const URL = `http://${HOST}:${PORT}/`;

const workspaceRoot = process.cwd();
const fixtureRoot = path.join(workspaceRoot, "fixtures", "hover-fixture-debug");

const rootTypeScriptPkg = path.join(workspaceRoot, "node_modules", "typescript", "package.json");
const fixtureVitePkg = path.join(fixtureRoot, "node_modules", "vite", "package.json");

function isReadyOutput(text) {
  return /Local:\s+http:\/\/127\.0\.0\.1:5173\/?/i.test(text);
}

async function isServerAlive() {
  try {
    const response = await fetch(URL, { signal: AbortSignal.timeout(1000) });
    return response.status < 500;
  } catch {
    return false;
  }
}

async function runCommand(command, args, cwd) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      stdio: "inherit",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? "unknown"}`));
    });
  });
}

async function ensureRootDependenciesInstalled() {
  if (fs.existsSync(rootTypeScriptPkg)) {
    return;
  }
  console.log("[fixture] Installing root dependencies...");
  await runCommand("npm", ["install"], workspaceRoot);
}

async function ensureFixtureDependenciesInstalled() {
  if (fs.existsSync(fixtureVitePkg)) {
    return;
  }
  console.log("[fixture] Installing fixture dependencies...");
  await runCommand("npm", ["install"], fixtureRoot);
}

async function runDevServerAndWaitReady() {
  const child = spawn(
    "npm",
    ["run", "dev", "--", "--host", HOST, "--port", String(PORT)],
    {
      cwd: fixtureRoot,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
    },
  );

  let readySignaled = false;

  const relay = (stream, write) => {
    if (!stream) {
      return;
    }
    stream.on("data", (chunk) => {
      const text = chunk.toString();
      write(text);
      if (!readySignaled && isReadyOutput(text)) {
        readySignaled = true;
        console.log(`[fixture] Dev server ready at ${URL}`);
      }
    });
  };

  relay(child.stdout, (text) => process.stdout.write(text));
  relay(child.stderr, (text) => process.stderr.write(text));

  await new Promise((resolve, reject) => {
    child.on("error", reject);
    child.on("exit", (code) => {
      if (!readySignaled) {
        reject(
          new Error(
            `[fixture] Dev server failed before readiness signal (exit code ${code ?? "unknown"}).`,
          ),
        );
        return;
      }
      resolve();
    });
  });

  throw new Error("[fixture] Dev server exited unexpectedly.");
}

async function main() {
  if (await isServerAlive()) {
    console.log(`[fixture] Dev server already running at ${URL}`);
    console.log(`[fixture] Dev server ready at ${URL}`);
    return;
  }

  await ensureRootDependenciesInstalled();
  await ensureFixtureDependenciesInstalled();

  console.log(`[fixture] Starting dev server at ${URL}`);
  await runDevServerAndWaitReady();
}

void main().catch((err) => {
  console.error("[fixture] Failed to ensure dev server.");
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
