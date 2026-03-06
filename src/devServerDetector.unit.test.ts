import { afterEach, describe, expect, it } from "vitest";
import {
  clearDetectorCache,
  detectDevServer,
  resetDetectorDepsForTests,
  setDetectorDepsForTests,
} from "./devServerDetector";

function mockProbeStatuses(statusByUrl: Record<string, number>): void {
  setDetectorDepsForTests({
    probeUrl: async (url: string) => {
      const status = statusByUrl[url];
      return status !== undefined && status < 500;
    },
  });
}

function mockFileContents(contents: Record<string, string>): void {
  setDetectorDepsForTests({
    readFileUtf8: async (filePath: string) => {
      if (Object.prototype.hasOwnProperty.call(contents, filePath)) {
        return contents[filePath];
      }
      throw new Error("ENOENT");
    },
  });
}

describe("detectDevServer", () => {
  afterEach(() => {
    clearDetectorCache();
    resetDetectorDepsForTests();
  });

  it("prefers workspace Vite defaults over unrelated common ports", async () => {
    mockFileContents({
      "/repo/vite.config.ts": "export default defineConfig({})",
    });
    mockProbeStatuses({
      "http://localhost:3000": 200,
      "http://localhost:5173": 200,
    });

    const detected = await detectDevServer({ workspaceRoot: "/repo" });

    expect(detected).toBe("http://localhost:5173");
  });

  it("does not use blind common-port fallback for workspace-scoped detection", async () => {
    mockFileContents({});
    mockProbeStatuses({
      "http://localhost:3000": 200,
      "http://localhost:5173": 200,
    });

    const detected = await detectDevServer({ workspaceRoot: "/repo-without-hints" });

    expect(detected).toBeNull();
  });

  it("uses common-port fallback when workspaceRoot is missing", async () => {
    mockFileContents({});
    mockProbeStatuses({
      "http://localhost:3000": 200,
      "http://localhost:5173": 200,
    });

    const detected = await detectDevServer();

    expect(detected).toBe("http://localhost:5173");
  });

  it("scopes cache entries by workspace root", async () => {
    mockFileContents({});
    mockProbeStatuses({
      "http://localhost:5173": 200,
    });

    const first = await detectDevServer({
      workspaceRoot: "/repo-a",
      preferredUrl: "http://localhost:5173",
    });
    expect(first).toBe("http://localhost:5173");

    const second = await detectDevServer({
      workspaceRoot: "/repo-b",
    });
    expect(second).toBeNull();
  });
});
