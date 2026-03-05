export function isPluginOnlyFrameworkFile(filePath: string): boolean {
  return /\.(vue|svelte)$/i.test(filePath);
}

export function shouldOfferPluginSetup(
  filePath: string,
  errorCode: string | undefined,
  alreadyDismissed: boolean,
): boolean {
  if (alreadyDismissed) {
    return false;
  }
  if (!isPluginOnlyFrameworkFile(filePath)) {
    return false;
  }
  return errorCode === "MISSING_VITE_PLUGIN";
}

export function shouldPersistPluginPromptDismissal(choice: string | undefined): boolean {
  return choice === "Learn more" || choice === "Dismiss";
}
