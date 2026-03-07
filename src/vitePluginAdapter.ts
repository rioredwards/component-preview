import { ElementHandle, Page } from "playwright";
import { FindElementRequest, FrameworkAdapter } from "./frameworkAdapter";
import { normalizeForComparison, normalizeWorkspaceRelativePath } from "./pathUtils";

export const VITE_PLUGIN_MARKER_GLOBAL = "__COMPONENT_PREVIEW_PLUGIN__";

interface CandidateScoreInput {
  line: number;
  column: number;
  visible: boolean;
}

export function scoreViteCandidate(
  candidate: CandidateScoreInput,
  targetLine: number,
  targetColumn: number,
): number {
  let score = 0;

  if (candidate.line === targetLine) {
    score += 10_000;
  } else if (candidate.line < targetLine) {
    score -= (targetLine - candidate.line) * 1_000;
  } else {
    score -= (candidate.line - targetLine) * 3_000;
  }

  score -= Math.abs(candidate.column - targetColumn) * 10;

  if (candidate.visible) {
    score += 100;
  }

  return score;
}

export function pickBestViteCandidate(
  candidates: CandidateScoreInput[],
  targetLine: number,
  targetColumn: number,
): number | null {
  if (candidates.length === 0) {
    return null;
  }

  let bestIndex = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let i = 0; i < candidates.length; i += 1) {
    const score = scoreViteCandidate(candidates[i], targetLine, targetColumn);
    if (score > bestScore) {
      bestIndex = i;
      bestScore = score;
    }
  }

  return bestIndex;
}

export class VitePluginAdapter implements FrameworkAdapter {
  readonly name = "vite-plugin" as const;

  async initialize(_page: Page, _devServerUrl: string): Promise<void> {
    // No setup is required for selector-based lookups.
  }

  async detect(page: Page): Promise<boolean> {
    return await page.evaluate((markerGlobal: string) => {
      const marker = (window as unknown as Record<string, unknown>)[markerGlobal];
      if (marker && typeof marker === "object") {
        return true;
      }
      return !!document.querySelector("[data-cp-file][data-cp-line]");
    }, VITE_PLUGIN_MARKER_GLOBAL);
  }

  async findElement(page: Page, req: FindElementRequest): Promise<ElementHandle<Element> | null> {
    const relativePath = normalizeWorkspaceRelativePath(req.workspaceRoot, req.absoluteFilePath);
    const relativePathNormalized = normalizeForComparison(relativePath);
    const absolutePathNormalized = normalizeForComparison(req.absoluteFilePath);
    const basenameOnly = !relativePathNormalized.includes("/");

    const handle = await page.evaluateHandle(
      ({
        relativePathNormalized,
        absolutePathNormalized,
        basenameOnly,
        targetLine,
        targetColumn,
      }: {
        relativePathNormalized: string;
        absolutePathNormalized: string;
        basenameOnly: boolean;
        targetLine: number;
        targetColumn: number;
      }) => {
        const matchFile = (candidatePath: string): boolean => {
          const normalized = candidatePath.replace(/\\/g, "/").toLowerCase();
          if (normalized === relativePathNormalized || normalized === absolutePathNormalized) {
            return true;
          }
          if (basenameOnly) {
            return false;
          }
          return (
            normalized.endsWith(`/${relativePathNormalized}`) ||
            normalized.endsWith(`/${absolutePathNormalized}`)
          );
        };

        const rawCandidates = Array.from(
          document.querySelectorAll<HTMLElement>("[data-cp-file][data-cp-line]"),
        ).filter((el) => {
          const p = el.getAttribute("data-cp-file") ?? "";
          return matchFile(p);
        });

        if (rawCandidates.length === 0) {
          return null;
        }

        const parsed = rawCandidates.map((el) => {
          const line = Number.parseInt(el.getAttribute("data-cp-line") ?? "0", 10);
          const column = Number.parseInt(el.getAttribute("data-cp-col") ?? "1", 10);
          const rect = el.getBoundingClientRect();
          const visible = rect.width > 2 && rect.height > 2;
          return { el, line, column, visible };
        });

        const exactVisible = parsed.find(
          (c) => c.visible && c.line === targetLine && c.column === targetColumn,
        );
        if (exactVisible) {
          return exactVisible.el;
        }

        let best = parsed[0];
        let bestScore = Number.NEGATIVE_INFINITY;

        const score = (line: number, column: number, visible: boolean): number => {
          let current = 0;
          if (line === targetLine) {
            current += 10_000;
          } else if (line < targetLine) {
            current -= (targetLine - line) * 1_000;
          } else {
            current -= (line - targetLine) * 3_000;
          }
          current -= Math.abs(column - targetColumn) * 10;
          if (visible) {
            current += 100;
          }
          return current;
        };

        for (const candidate of parsed) {
          const currentScore = score(candidate.line, candidate.column, candidate.visible);
          if (currentScore > bestScore) {
            best = candidate;
            bestScore = currentScore;
          }
        }

        return best.el;
      },
      {
        relativePathNormalized,
        absolutePathNormalized,
        basenameOnly,
        targetLine: req.line,
        targetColumn: req.column,
      },
    );

    return handle.asElement();
  }
}
