import path from "path";

export function stripQueryAndHash(id: string): string {
  const q = id.indexOf("?");
  const h = id.indexOf("#");
  const cut = [q, h].filter((v) => v >= 0).sort((a, b) => a - b)[0];
  return cut === undefined ? id : id.slice(0, cut);
}

export function normalizeToPosix(value: string): string {
  return value.replace(/\\/g, "/");
}

export function normalizeRelativeFilePath(root: string, absoluteFilePath: string): string {
  const cleanRoot = stripQueryAndHash(root);
  const cleanFile = stripQueryAndHash(absoluteFilePath);
  const relative = normalizeToPosix(path.relative(cleanRoot, cleanFile));

  if (relative === "") {
    return path.basename(cleanFile);
  }
  if (relative.startsWith("./")) {
    return relative.slice(2);
  }
  return relative;
}
