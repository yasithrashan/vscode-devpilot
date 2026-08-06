declare global {
  interface Window {
    __DEVPILOT_ICON__?: string;
  }
}

export const iconUri = window.__DEVPILOT_ICON__ ?? "";
