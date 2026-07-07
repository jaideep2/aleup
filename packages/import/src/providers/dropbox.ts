import Dropbox from "@uppy/dropbox";
import type { ProviderRegistration } from "../types.js";

export function dropbox(overrides?: Partial<ProviderRegistration>): ProviderRegistration {
  return {
    id: "dropbox",
    pluginId: "Dropbox",
    label: "Dropbox",
    plugin: Dropbox,
    ...overrides,
  };
}
