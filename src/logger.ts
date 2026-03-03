import * as fs from "fs";

const LOG_FILE = "/tmp/component-preview-debug.log";

// Lazy-loaded VS Code Output channel. Set by initLogger() at activation time.
// When running in unit tests, this stays null and logging goes to file only.
let outputChannel: { appendLine(value: string): void } | null = null;

/**
 * Initializes the logger: creates a VS Code Output channel and clears the
 * debug log file. Call once from activate().
 */
export function initLogger(): void {
  const vscode = require("vscode") as typeof import("vscode");
  outputChannel = vscode.window.createOutputChannel("component-preview");
  fs.writeFileSync(LOG_FILE, `=== component-preview debug log ${new Date().toISOString()} ===\n`);
}

function formatArgs(args: unknown[]): string {
  return args.map((a) => (typeof a === "string" ? a : JSON.stringify(a, null, 2))).join(" ");
}

function writeToFile(level: string, args: unknown[]): void {
  const line = formatArgs(args);
  fs.appendFileSync(LOG_FILE, `[${new Date().toISOString()}] [${level}] ${line}\n`);
}

/** Debug: writes to file only. */
export function debug(...args: unknown[]): void {
  writeToFile("DEBUG", args);
}

/** Info: writes to both Output channel and file. */
export function info(...args: unknown[]): void {
  writeToFile("INFO", args);
  outputChannel?.appendLine(`[INFO] ${formatArgs(args)}`);
}

/** Warn: writes to both Output channel and file. */
export function warn(...args: unknown[]): void {
  writeToFile("WARN", args);
  outputChannel?.appendLine(`[WARN] ${formatArgs(args)}`);
}

/** Error: writes to both Output channel and file. */
export function error(...args: unknown[]): void {
  writeToFile("ERROR", args);
  outputChannel?.appendLine(`[ERROR] ${formatArgs(args)}`);
}

/** Backward-compatible alias for debug (used by devServerRenderer). */
export const log = debug;
