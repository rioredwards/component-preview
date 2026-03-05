import type { Plugin, ResolvedConfig } from "vite";
import { normalizeRelativeFilePath, stripQueryAndHash } from "./pathUtils";
import { transformJsx } from "./transformJsx";
import { transformSvelte } from "./transformSvelte";
import { transformVue } from "./transformVue";

const DEFAULT_MARKER_GLOBAL = "__COMPONENT_PREVIEW_PLUGIN__";
const PLUGIN_VERSION = "0.1.0";

export interface ComponentPreviewPluginOptions {
  include?: RegExp[];
  exclude?: RegExp[];
  markerGlobal?: string;
}

function shouldProcessFile(
  file: string,
  include: RegExp[],
  exclude: RegExp[],
): boolean {
  if (exclude.some((p) => p.test(file))) {
    return false;
  }
  if (include.length === 0) {
    return true;
  }
  return include.some((p) => p.test(file));
}

function markerScript(markerGlobal: string): string {
  return `<script>window.${markerGlobal}=Object.assign(window.${markerGlobal}||{}, { version: "${PLUGIN_VERSION}" });</script>`;
}

export default function componentPreview(
  options: ComponentPreviewPluginOptions = {},
): Plugin {
  let config: ResolvedConfig | null = null;
  const include = options.include ?? [];
  const exclude = options.exclude ?? [];
  const markerGlobal = options.markerGlobal ?? DEFAULT_MARKER_GLOBAL;

  return {
    name: "vite-plugin-component-preview",
    enforce: "pre",
    configResolved(resolved) {
      config = resolved;
    },
    transformIndexHtml(html) {
      if (!config || config.command !== "serve") {
        return html;
      }
      return `${html}\n${markerScript(markerGlobal)}`;
    },
    transform(code, id) {
      if (!config || config.command !== "serve") {
        return null;
      }

      const sourceId = stripQueryAndHash(id);
      if (!sourceId || sourceId.includes("\0") || sourceId.includes("node_modules")) {
        return null;
      }

      if (!shouldProcessFile(sourceId, include, exclude)) {
        return null;
      }

      const normalizedFilePath = normalizeRelativeFilePath(config.root, sourceId);
      if (sourceId.endsWith(".tsx") || sourceId.endsWith(".jsx")) {
        return transformJsx(code, sourceId, normalizedFilePath);
      }
      if (sourceId.endsWith(".vue")) {
        return transformVue(code, sourceId, normalizedFilePath);
      }
      if (sourceId.endsWith(".svelte")) {
        return transformSvelte(code, sourceId, normalizedFilePath);
      }
      return null;
    },
  };
}
