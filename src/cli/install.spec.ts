import { describe, expect, it } from "vitest";
import { needsShell } from "./install.js";

/**
 * Installing is npm's job, and nothing here runs it: what this pins is the one
 * decision the module makes before it does — which platform needs a shell to
 * reach npm at all.
 */

describe("needsShell", () => {
  it("goes through a shell on Windows, where npm is a batch script", () => {
    // `npm.cmd` is not an executable: spawned directly it fails with EINVAL,
    // which would be every Windows run of this CLI.
    expect(needsShell("win32")).toBe(true);
  });

  it("runs npm directly everywhere else", () => {
    for (const platform of ["linux", "darwin", "freebsd"] as const) {
      expect(needsShell(platform), platform).toBe(false);
    }
  });
});
