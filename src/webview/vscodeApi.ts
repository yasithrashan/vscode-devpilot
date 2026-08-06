export type ExtensionMessage = {
  type: "command";
  command: "model" | "keys";
  value: "openai" | "gemini";
};
export type WebviewMessage = { type: "system"; text: string };

interface VsCodeApi {
  postMessage(message: ExtensionMessage): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

export const vscodeApi = acquireVsCodeApi();
