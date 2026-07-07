// Adapter over the headless provider plugin's Companion client. This is a deliberate seam:
// `uppy.getPlugin(id).provider` is an Uppy INTERNAL (not semver-protected), so it's reached
// into exactly here and pinned by a contract test — an upstream change breaks one file, loudly.

import type Uppy from "@uppy/core";

/** The slice of @uppy/companion-client's Provider that aleup relies on. */
export interface CompanionClient {
  list<T>(path: string | null, options: Record<string, never>): Promise<T>;
  fileUrl(requestPath: string): string;
  /** Opens Companion's OAuth popup + postMessage handshake and stores the token. */
  login(options: { signal?: AbortSignal }): Promise<unknown>;
  logout(): Promise<unknown>;
  readonly name: string;
  readonly provider: string;
}

interface RawProvider {
  list<T>(path: string | null, options: Record<string, never>): Promise<T>;
  fileUrl(requestPath: string): string;
  login(options: {
    uppyVersions: string;
    authFormData: undefined;
    signal?: AbortSignal;
  }): Promise<unknown>;
  logout(): Promise<unknown>;
  name: string;
  provider: string;
}

/** The headless plugin's Companion client (auth/list) for a mounted provider plugin. */
export function providerClient(uppy: Uppy, pluginId: string): CompanionClient | null {
  const plugin = uppy.getPlugin(pluginId) as { provider?: RawProvider } | undefined;
  const raw = plugin?.provider;
  if (!raw) return null;
  return {
    list: (path, options) => raw.list(path, options),
    fileUrl: (requestPath) => raw.fileUrl(requestPath),
    // companion-client's login wants the client version handshake; keep that vendor
    // detail inside the adapter.
    login: ({ signal } = {}) =>
      raw.login({ uppyVersions: "@uppy/core=5", authFormData: undefined, signal }),
    logout: () => raw.logout(),
    get name() {
      return raw.name;
    },
    get provider() {
      return raw.provider;
    },
  };
}
