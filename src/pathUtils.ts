import * as path from "path";

export function normalizeToPosix(value: string): string {
  return value.replace(/\\/g, "/");
}

export function normalizeWorkspaceRelativePath(
  workspaceRoot: string,
  absoluteFilePath: string,
): string {
  const relative = normalizeToPosix(path.relative(workspaceRoot, absoluteFilePath));
  if (relative === "") {
    return path.basename(absoluteFilePath);
  }
  if (relative.startsWith("./")) {
    return relative.slice(2);
  }
  return relative;
}

export function normalizeForComparison(value: string): string {
  return normalizeToPosix(value).toLowerCase();
}
