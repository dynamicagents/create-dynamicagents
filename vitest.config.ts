import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // The CLI's own specs. Vitest's default glob would also collect the
    // templates' specs, which run inside workerd and belong to each template's
    // own suite.
    include: ["src/**/*.spec.ts"]
  }
});
