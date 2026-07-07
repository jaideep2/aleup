import { afterEach, beforeEach, expect, test } from "vitest";
import { createConnectClient, envCredentials } from "./index.js";
import type { CredentialsPort } from "@aleup/core";

const stub: CredentialsPort = (p) =>
  p === "google-drive" ? { clientId: "cid", clientSecret: "sec" } : null;

test("buildAuthUrl carries client_id, redirect, state, scope, and provider extras", () => {
  const client = createConnectClient(stub);
  const url = new URL(client.buildAuthUrl("google-drive", "https://app/cb", "st4te"));
  expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
  expect(url.searchParams.get("client_id")).toBe("cid");
  expect(url.searchParams.get("redirect_uri")).toBe("https://app/cb");
  expect(url.searchParams.get("state")).toBe("st4te");
  expect(url.searchParams.get("scope")).toContain("drive.file");
  // Google-specific offline params survive the port inversion.
  expect(url.searchParams.get("access_type")).toBe("offline");
  expect(url.searchParams.get("prompt")).toBe("consent");
});

test("providerConfigured mirrors the CredentialsPort; unconfigured providers throw on use", () => {
  const client = createConnectClient(stub);
  expect(client.providerConfigured("google-drive")).toBe(true);
  expect(client.providerConfigured("dropbox")).toBe(false);
  expect(() => client.buildAuthUrl("dropbox", "https://app/cb", "s")).toThrow(/not configured/);
});

beforeEach(() => {
  process.env.T_ID = "envcid";
  process.env.T_SECRET = "envsec";
});
afterEach(() => {
  delete process.env.T_ID;
  delete process.env.T_SECRET;
});

test("envCredentials reads the mapped env names at call time", () => {
  const port = envCredentials({ box: { clientIdEnv: "T_ID", clientSecretEnv: "T_SECRET" } });
  expect(port("box")).toEqual({ clientId: "envcid", clientSecret: "envsec" });
  expect(port("onedrive")).toBeNull();
  delete process.env.T_SECRET;
  expect(port("box")).toBeNull();
});
