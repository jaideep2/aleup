import OneDrive from "@uppy/onedrive";
import type { ProviderRegistration } from "../types.js";

export function oneDrive(overrides?: Partial<ProviderRegistration>): ProviderRegistration {
  return {
    id: "onedrive",
    pluginId: "OneDrive",
    label: "OneDrive",
    plugin: OneDrive,
    ...overrides,
  };
}
