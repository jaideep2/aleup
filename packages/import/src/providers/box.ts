import Box from "@uppy/box";
import type { ProviderRegistration } from "../types.js";

export function box(overrides?: Partial<ProviderRegistration>): ProviderRegistration {
  return {
    id: "box",
    pluginId: "Box",
    label: "Box",
    plugin: Box,
    ...overrides,
  };
}
