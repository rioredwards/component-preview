import * as fs from "fs";

const LOG_FILE = "/tmp/component-preview-debug.log";

// Clear the log file on first import so each session starts fresh.
fs.writeFileSync(LOG_FILE, `=== component-preview debug log ${new Date().toISOString()} ===\n`);

export function log(...args: unknown[]): void {
  const line = args.map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2))).join(" ");
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] ${line}\n`);
}
