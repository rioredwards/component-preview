import { ElementHandle, Page } from "playwright";

export interface FindElementRequest {
  workspaceRoot: string;
  absoluteFilePath: string;
  line: number; // 1-based
  column: number; // 1-based
}

export interface FrameworkAdapter {
  name: "vite-plugin" | "react-fiber";
  initialize(page: Page, devServerUrl: string): Promise<void>;
  detect(page: Page): Promise<boolean>;
  findElement(page: Page, req: FindElementRequest): Promise<ElementHandle<Element> | null>;
  dispose?(): Promise<void>;
}
