import { describe, expect, it } from "vitest";
import {
  isPluginOnlyFrameworkFile,
  shouldOfferPluginSetup,
  shouldPersistPluginPromptDismissal,
} from "./pluginOnboarding";

describe("pluginOnboarding", () => {
  it("identifies plugin-only framework file types", () => {
    expect(isPluginOnlyFrameworkFile("/repo/src/App.vue")).toBe(true);
    expect(isPluginOnlyFrameworkFile("/repo/src/App.svelte")).toBe(true);
    expect(isPluginOnlyFrameworkFile("/repo/src/App.tsx")).toBe(false);
  });

  it("offers setup only when plugin is missing and not dismissed", () => {
    expect(
      shouldOfferPluginSetup("/repo/src/App.vue", "MISSING_VITE_PLUGIN", false),
    ).toBe(true);
    expect(
      shouldOfferPluginSetup("/repo/src/App.vue", "MISSING_VITE_PLUGIN", true),
    ).toBe(false);
    expect(
      shouldOfferPluginSetup("/repo/src/App.tsx", "MISSING_VITE_PLUGIN", false),
    ).toBe(false);
    expect(
      shouldOfferPluginSetup("/repo/src/App.vue", "OTHER_ERROR", false),
    ).toBe(false);
  });

  it("persists dismissal for explicit user actions only", () => {
    expect(shouldPersistPluginPromptDismissal("Learn more")).toBe(true);
    expect(shouldPersistPluginPromptDismissal("Dismiss")).toBe(true);
    expect(shouldPersistPluginPromptDismissal(undefined)).toBe(false);
  });
});
