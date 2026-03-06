import * as fs from "fs/promises";
import * as http from "http";
import * as path from "path";

const CANDIDATE_PORTS = [5173, 3000, 4173, 8080, 8000];
const CACHE_TTL_MS = 30_000;
const GLOBAL_CACHE_KEY = "__global__";

interface CacheEntry {
  url: string;
  at: number;
}

const cacheByScope = new Map<string, CacheEntry>();

interface DetectorDeps {
  readFileUtf8(filePath: string): Promise<string>;
  probeUrl(url: string): Promise<boolean>;
}

const defaultDeps: DetectorDeps = {
  readFileUtf8: async (filePath: string) => await fs.readFile(filePath, "utf8"),
  probeUrl: async (url: string) => await probe(url),
};

let detectorDeps: DetectorDeps = defaultDeps;

export interface DetectDevServerOptions {
  preferredUrl?: string | null;
  workspaceRoot?: string | null;
}

/**
 * Detects a live dev server URL in this order:
 * 1. Explicit user preference
 * 2. Recent cache (with health check)
 * 3. Workspace hints (.env / vite config / package.json hints)
 * 4. Common port probe (only when workspaceRoot is not provided)
 */
export async function detectDevServer(
  options: DetectDevServerOptions = {},
): Promise<string | null> {
  const cacheKey = cacheKeyForWorkspace(options.workspaceRoot);

  const fromPreference = await firstLiveUrl(
    expandUrlCandidate(options.preferredUrl),
  );
  if (fromPreference) {
    cache(cacheKey, fromPreference);
    return fromPreference;
  }

  const cached = cacheByScope.get(cacheKey);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    if (await probe(cached.url)) {
      return cached.url;
    }
    cacheByScope.delete(cacheKey);
  }

  if (options.workspaceRoot) {
    const hintedCandidates = await discoverWorkspaceCandidates(options.workspaceRoot);
    const fromWorkspace = await firstLiveUrl(hintedCandidates);
    if (fromWorkspace) {
      cache(cacheKey, fromWorkspace);
      return fromWorkspace;
    }

    // Workspace-scoped lookups should not bind to arbitrary localhost ports.
    return null;
  }

  const fromCommonPorts = await firstLiveUrl(
    CANDIDATE_PORTS.map((port) => `http://localhost:${port}`),
  );
  if (fromCommonPorts) {
    cache(cacheKey, fromCommonPorts);
    return fromCommonPorts;
  }

  return null;
}

/** Clears the cached dev server URL. Useful for tests. */
export function clearDetectorCache(): void {
  cacheByScope.clear();
}

export function setDetectorDepsForTests(overrides: Partial<DetectorDeps> = {}): void {
  detectorDeps = {
    ...detectorDeps,
    ...overrides,
  };
}

export function resetDetectorDepsForTests(): void {
  detectorDeps = defaultDeps;
}

function cache(cacheKey: string, url: string): void {
  cacheByScope.set(cacheKey, { url, at: Date.now() });
}

function cacheKeyForWorkspace(workspaceRoot: string | null | undefined): string {
  if (!workspaceRoot) {
    return GLOBAL_CACHE_KEY;
  }
  const normalized = workspaceRoot.trim();
  return normalized || GLOBAL_CACHE_KEY;
}

async function firstLiveUrl(candidates: string[]): Promise<string | null> {
  for (const candidate of dedupe(candidates)) {
    if (await detectorDeps.probeUrl(candidate)) {
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
  candidates.push(...(await candidatesFromPackageJson(workspaceRoot)));
  return dedupe(candidates);
}

async function candidatesFromEnvFiles(workspaceRoot: string): Promise<string[]> {
  const envFiles = [".env", ".env.local"];
  const ports: string[] = [];

  for (const file of envFiles) {
    const filePath = path.join(workspaceRoot, file);
    try {
      const content = await detectorDeps.readFileUtf8(filePath);
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
      const content = await detectorDeps.readFileUtf8(filePath);
      const match = content.match(/\bport\s*:\s*(\d{2,5})\b/);
      if (match?.[1]) {
        candidates.push(`http://localhost:${match[1]}`);
      } else {
        candidates.push("http://localhost:5173");
      }
    } catch {
      // Optional hint file.
    }
  }

  return candidates;
}

async function candidatesFromPackageJson(workspaceRoot: string): Promise<string[]> {
  const filePath = path.join(workspaceRoot, "package.json");
  try {
    const content = await detectorDeps.readFileUtf8(filePath);
    const parsed = JSON.parse(content) as {
      scripts?: Record<string, string>;
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };

    const scripts = Object.values(parsed.scripts ?? {});
    const hasViteScript = scripts.some((value) => /\bvite\b/i.test(value));
    const hasViteDependency =
      !!parsed.dependencies?.vite || !!parsed.devDependencies?.vite;

    if (hasViteScript || hasViteDependency) {
      return ["http://localhost:5173"];
    }
  } catch {
    // Optional hint file.
  }

  return [];
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
