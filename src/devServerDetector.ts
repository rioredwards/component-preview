import * as http from "http";

const CANDIDATE_PORTS = [3000, 5173, 4173, 8080, 8000];
const CACHE_TTL_MS = 30_000;

let cachedUrl: string | null = null;
let cachedAt = 0;

/**
 * Scans common localhost ports and returns the first URL that responds.
 * Result is cached for 30 seconds; on cache hit the server is verified to
 * still be alive before returning.
 */
export async function detectDevServer(): Promise<string | null> {
  if (cachedUrl && Date.now() - cachedAt < CACHE_TTL_MS) {
    if (await probe(cachedUrl)) {
      return cachedUrl;
    }
    // Server stopped — clear cache and re-probe
    cachedUrl = null;
    cachedAt = 0;
  }

  for (const port of CANDIDATE_PORTS) {
    const url = `http://localhost:${port}`;
    if (await probe(url)) {
      cachedUrl = url;
      cachedAt = Date.now();
      return url;
    }
  }
  return null;
}

/** Clears the cached dev server URL. Useful for testing. */
export function clearDetectorCache(): void {
  cachedUrl = null;
  cachedAt = 0;
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
