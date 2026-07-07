import { defineWorkspace } from "vitest/config";

export default defineWorkspace([
  {
    test: {
      name: "packages",
      include: ["packages/*/src/**/*.test.{ts,tsx}"],
      environment: "node",
    },
  },
]);
