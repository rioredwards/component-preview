import * as fs from "fs/promises";
import * as http from "http";
import * as path from "path";

const CANDIDATE_PORTS = [3000, 5173, 4173, 8080, 8000];
const CACHE_TTL_MS = 30_000;

let cachedUrl: string | null = null;
let cachedAt = 0;

export interface DetectDevServerOptions {
  preferredUrl?: string | null;
  workspaceRoot?: string | null;
}

/**
 * Detects a live dev server URL in this order:
 * 1. Explicit user preference
 * 2. Recent cache (with health check)
 * 3. Workspace hints (.env / vite config)
 * 4. Common port probe
 */
export async function detectDevServer(
  options: DetectDevServerOptions = {},
): Promise<string | null> {
  const fromPreference = await firstLiveUrl(
    expandUrlCandidate(options.preferredUrl),
  );
  if (fromPreference) {
    cache(fromPreference);
    return fromPreference;
  }

  if (cachedUrl && Date.now() - cachedAt < CACHE_TTL_MS) {
    if (await probe(cachedUrl)) {
      return cachedUrl;
    }
    cachedUrl = null;
    cachedAt = 0;
  }

  if (options.workspaceRoot) {
    const hintedCandidates = await discoverWorkspaceCandidates(options.workspaceRoot);
    const fromWorkspace = await firstLiveUrl(hintedCandidates);
    if (fromWorkspace) {
      cache(fromWorkspace);
      return fromWorkspace;
    }
  }

  const fromCommonPorts = await firstLiveUrl(
    CANDIDATE_PORTS.map((port) => `http://localhost:${port}`),
  );
  if (fromCommonPorts) {
    cache(fromCommonPorts);
    return fromCommonPorts;
  }

  return null;
}

/** Clears the cached dev server URL. Useful for tests. */
export function clearDetectorCache(): void {
  cachedUrl = null;
  cachedAt = 0;
}

function cache(url: string): void {
  cachedUrl = url;
  cachedAt = Date.now();
}

async function firstLiveUrl(candidates: string[]): Promise<string | null> {
  for (const candidate of dedupe(candidates)) {
    if (await probe(candidate)) {
      return candidate;
    }
  }
  return null;
}

function dedupe(values: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const normalized = value.trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function expandUrlCandidate(input: string | null | undefined): string[] {
  if (!input) {
    return [];
  }

  const value = input.trim();
  if (!value) {
    return [];
  }

  if (/^\d{2,5}$/.test(value)) {
    return [`http://localhost:${value}`];
  }

  if (/^https?:\/\//i.test(value)) {
    return [value.replace(/\/$/, "")];
  }

  if (/^localhost:\d{2,5}$/i.test(value) || /^127\.0\.0\.1:\d{2,5}$/i.test(value)) {
    return [`http://${value}`];
  }

  return [value];
}

async function discoverWorkspaceCandidates(workspaceRoot: string): Promise<string[]> {
  const candidates: string[] = [];
  candidates.push(...(await candidatesFromEnvFiles(workspaceRoot)));
  candidates.push(...(await candidatesFromViteConfig(workspaceRoot)));
  return dedupe(candidates);
}

async function candidatesFromEnvFiles(workspaceRoot: string): Promise<string[]> {
  const envFiles = [".env", ".env.local"];
  const ports: string[] = [];

  for (const file of envFiles) {
    const filePath = path.join(workspaceRoot, file);
    try {
      const content = await fs.readFile(filePath, "utf8");
      const matches = content.matchAll(/^\s*(VITE_PORT|PORT)\s*=\s*["']?(\d{2,5})["']?\s*$/gm);
      for (const m of matches) {
        if (m[2]) {
          ports.push(`http://localhost:${m[2]}`);
        }
      }
    } catch {
      // Optional hint file.
    }
  }

  return ports;
}

async function candidatesFromViteConfig(workspaceRoot: string): Promise<string[]> {
  const names = [
    "vite.config.ts",
    "vite.config.js",
    "vite.config.mjs",
    "vite.config.cjs",
  ];

  const candidates: string[] = [];
  for (const name of names) {
    const filePath = path.join(workspaceRoot, name);
    try {
      const content = await fs.readFile(filePath, "utf8");
      const match = content.match(/\bport\s*:\s*(\d{2,5})\b/);
      if (match?.[1]) {
        candidates.push(`http://localhost:${match[1]}`);
      }
    } catch {
      // Optional hint file.
    }
  }

  return candidates;
}

function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout: 1000 }, (res) => {
      resolve(res.statusCode !== undefined && res.statusCode < 500);
      res.resume();
    });
    req.on("error", () => resolve(false));
    req.on("timeout", () => {
      req.destroy();
      resolve(false);
    });
  });
}
