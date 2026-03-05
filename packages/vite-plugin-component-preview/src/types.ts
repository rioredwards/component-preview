import type MagicString from "magic-string";

export interface TagInjectionPoint {
  startOffset: number;
  line: number;
  column: number;
  loc: number;
}

export interface TransformResult {
  code: string;
  map: ReturnType<MagicString["generateMap"]>;
}
