import GoogleDrive from "@uppy/google-drive";
import type { ProviderRegistration } from "../types.js";

export function googleDrive(overrides?: Partial<ProviderRegistration>): ProviderRegistration {
  return {
    id: "drive",
    pluginId: "GoogleDrive",
    label: "Google Drive",
    plugin: GoogleDrive,
    ...overrides,
  };
}
