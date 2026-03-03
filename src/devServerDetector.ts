import * as http from "http";

const CANDIDATE_PORTS = [3000, 5173, 4173, 8080, 8000];

// Cache the result — re-probes only if no server was found last time.
let cachedUrl: string | null = null;

/**
 * Scans common localhost ports and returns the first URL that responds.
 * Result is cached for the session once a server is found.
 */
export async function detectDevServer(): Promise<string | null> {
  if (cachedUrl) {
    return cachedUrl;
  }

  for (const port of CANDIDATE_PORTS) {
    const url = `http://localhost:${port}`;
    if (await probe(url)) {
      cachedUrl = url;
      return url;
    }
  }
  return null;
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
