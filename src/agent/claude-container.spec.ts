import { describe, expect, it } from "vitest";
import * as prettier from "prettier";
import { projectFiles, type GeneratedFile } from "./files";
import { displayName, names } from "./names";
import type { AgentSpec } from "./spec";
import { TEMPLATE } from "./templates/claude-container/template";
import { TEMPLATE_TENANT } from "./templates/shared/retenant";
import { COMPATIBILITY_DATE, CONTAINER, DEFAULT_MODEL_ID } from "../train";

/**
 * The `claude-container` blueprint, as `projectFiles` writes it.
 *
 * Its files are working files of a real project rather than composed, so what
 * is held here is what that can get wrong: a file left out or left in, a
 * spelling of the template's tenant left behind, a layout that holds for one
 * tenant id and not another, and the wiring between files that nothing in the
 * project itself would notice. Whether a project installs, typechecks and
 * passes its own suite is `.github/workflows/scaffold.yml`'s.
 */

const spec = (tenant: string): AgentSpec => ({
  tenant,
  name: displayName(tenant),
  description: "Gets a task done with Claude Code in a container.",
  blueprint: "claude-container",
  subAgent: "claude_code",
  capabilities: [],
  modelId: DEFAULT_MODEL_ID
});

const at = (files: GeneratedFile[], path: string): string => {
  const file = files.find((entry) => entry.path === path);
  if (file === undefined) throw new Error(`${path} was not generated`);
  return file.contents;
};

const options = { trailingComma: "none" } as const;

async function formatted(
  path: string,
  contents: string
): Promise<string | undefined> {
  const { inferredParser } = await prettier.getFileInfo(path);
  if (inferredParser === null) return undefined;
  return prettier.format(contents, { ...options, filepath: path });
}

const TOP = [
  "package.json",
  "wrangler.jsonc",
  "tsconfig.json",
  "vitest.config.ts",
  "eslint.config.js",
  ".prettierrc",
  ".prettierignore",
  ".gitignore",
  ".nvmrc",
  ".dockerignore",
  ".env.example",
  "README.md",
  "AGENTS.md",
  "Dockerfile",
  "scripts/build-daemon.mjs",
  "scripts/verify-container-env.mjs",
  "src/index.ts",
  "src/host-manifest.ts",
  "src/config.ts",
  "src/copy.ts",
  "src/model.ts",
  "src/sandbox-daemon.ts"
];

/** Each variant's own files, beside {@link TOP}, in the order they are written. */
const VARIANTS = {
  generic: {
    workspace: [
      "container.ts",
      "git-identity.ts",
      "install-plan.ts",
      "scratch.ts"
    ],
    agent: [
      "definition.ts",
      "host.ts",
      "workflow.ts",
      "agent.ts",
      "children.ts",
      "manifest.ts",
      "plugins.ts",
      "soul.ts",
      "share.ts",
      "claude-code.ts",
      "sandbox.ts",
      "egress.ts"
    ],
    tests: (tenant: string) => [`test/${tenant}.spec.ts`],
    children: ["SessionChild"]
  }
} as const;

describe.each(Object.entries(VARIANTS))("%s", (_, variant) => {
  describe.each([TEMPLATE_TENANT, "pr-bot"])("tenant %s", (tenant) => {
    const files = projectFiles(spec(tenant));
    const n = names(tenant);
    const paths = files.map((file) => file.path);

    it("writes a complete project, and exactly this one", () => {
      expect(paths).toEqual([
        ...TOP,
        ...variant.workspace.map((name) => `src/workspace/${name}`),
        ...variant.agent.map((name) => `${n.dir}/${name}`),
        "test/tsconfig.json",
        "test/worker.ts",
        "test/edge.spec.ts",
        ...variant.tests(tenant)
      ]);
    });

    it("writes one file per path, nothing empty, each ending in one newline", () => {
      expect(new Set(paths).size).toBe(paths.length);
      for (const file of files) {
        expect(file.contents, file.path).not.toBe("");
        expect(file.contents.endsWith("\n"), file.path).toBe(true);
        expect(file.contents.endsWith("\n\n"), file.path).toBe(false);
      }
    });

    it("leaves no token unrendered", () => {
      expect(at(files, "wrangler.jsonc")).toContain(
        `"compatibility_date": "${COMPATIBILITY_DATE}"`
      );
      expect(at(files, "wrangler.jsonc")).not.toContain("$COMPATIBILITY_DATE");
    });

    it("names its classes, bindings and workflow from the tenant id", () => {
      const wrangler = at(files, "wrangler.jsonc");
      for (const name of [
        n.hostClass,
        n.agentClass,
        `${n.pascal}Sandbox`,
        `${n.screaming}_SANDBOX`,
        n.workflowClass,
        n.workflowBinding,
        n.workflowName
      ]) {
        expect(wrangler, name).toContain(`"${name}"`);
      }
      const index = at(files, "src/index.ts");
      for (const name of [
        n.hostClass,
        n.workflowClass,
        n.agentClass,
        `${n.pascal}Sandbox`,
        `${n.pascal}Egress`,
        ...variant.children.map((child) => `${n.pascal}${child}`)
      ]) {
        expect(index, name).toContain(name);
      }
      expect(at(files, `${n.dir}/definition.ts`)).toContain(`"${tenant}"`);
    });

    it("asks for no GitHub token: it works on no repository", () => {
      const secrets = /"secrets":\s*\{[\s\S]*?\]/.exec(
        at(files, "wrangler.jsonc")
      )?.[0];
      expect(secrets).not.toContain('"GITHUB_TOKEN"');
      expect(secrets).toContain('"CLAUDE_CODE_OAUTH_TOKEN_1"');
    });

    it("pins the sandbox package to the image's shim", () => {
      const pkg = JSON.parse(at(files, "package.json")) as {
        dependencies: Record<string, string>;
      };
      const shim = /cloudflare\/sandbox:(\S+)/.exec(
        at(files, "Dockerfile")
      )?.[1];
      expect(pkg.dependencies["@cloudflare/sandbox"]).toBe(shim);
      expect(shim).toBe(CONTAINER["@cloudflare/sandbox"]);
    });

    it("writes every file prettier can read", async () => {
      for (const file of files) await formatted(file.path, file.contents);
    });
  });

  /**
   * The templates are laid out for `claude-container`, so with that tenant the
   * project is already formatted. Another tenant id moves where a line crosses
   * the print width, which the CLI answers by running the project's own
   * prettier once it is installed, the last step of `installProject`.
   */
  it("is already formatted for its own tenant", async () => {
    const offenders: string[] = [];
    for (const file of projectFiles(spec(TEMPLATE_TENANT))) {
      const output = await formatted(file.path, file.contents);
      if (output !== undefined && output !== file.contents) {
        offenders.push(file.path);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("leaves no spelling of the template's own tenant behind", () => {
    const leftovers = projectFiles(spec("pr-bot"))
      .filter((file) =>
        /claude-container|ClaudeContainer|CLAUDE_CONTAINER|claudeContainer|Claude Container/.test(
          file.contents
        )
      )
      .map((file) => file.path);
    expect(leftovers).toEqual([]);
  });
});

/**
 * The two answers it shares with the generic blueprint. Each is a region or two
 * lines of a file that is otherwise the default project's own, so what is held
 * here is that the default writes that project unchanged, and that every other
 * answer still writes a whole, formatted one.
 */
describe("its answers", () => {
  const lean: AgentSpec = {
    ...spec(TEMPLATE_TENANT),
    modelId: "@cf/zai-org/glm-4.7-flash"
  };
  const withBrowser = projectFiles({
    ...spec(TEMPLATE_TENANT),
    capabilities: ["browser"]
  });
  const files = projectFiles(lean);

  // Read off the template itself, not off a project written with the default:
  // `withModel` writes whatever it is given, so only the file says whether the
  // default project and the CLI's default agree.
  it("names the generic blueprint's default model in its own template", () => {
    expect(TEMPLATE.configTs).toContain(`  modelId: "${DEFAULT_MODEL_ID}",`);
    expect(TEMPLATE.configTs).toContain(
      `  compactionModelId: "${DEFAULT_MODEL_ID}",`
    );
  });

  // The turn takes the answer; compaction keeps the template's full-size model,
  // which its own comment says a flash model times out in for this agent.
  it("writes the model it is given to the turn alone", () => {
    const config = at(files, "src/config.ts");
    expect(config).toContain('  modelId: "@cf/zai-org/glm-4.7-flash",');
    expect(config).toContain(`  compactionModelId: "${DEFAULT_MODEL_ID}",`);
  });

  it("never renames a model id that spells the template's tenant", () => {
    const config = at(
      projectFiles({
        ...spec("pr-bot"),
        modelId: "@cf/acme/claude-container-7b"
      }),
      "src/config.ts"
    );
    expect(config).toContain('  modelId: "@cf/acme/claude-container-7b",');
  });

  it("puts the description it is given on its card", () => {
    const n = names(TEMPLATE_TENANT);
    const card = at(
      projectFiles({
        ...spec(TEMPLATE_TENANT),
        description: 'Turns "invoices" into CSV'
      }),
      `${n.dir}/manifest.ts`
    );
    expect(card).toContain(`  description: 'Turns "invoices" into CSV',`);
    const long =
      "Reads every invoice the person sends and writes one CSV row per line item, with totals checked.";
    expect(
      at(
        projectFiles({ ...spec(TEMPLATE_TENANT), description: long }),
        `${n.dir}/manifest.ts`
      )
    ).toContain(`  description:\n    "${long}",`);
  });

  it("leaves the browser out whole without it", () => {
    const n = names(TEMPLATE_TENANT);
    expect(at(files, `${n.dir}/plugins.ts`)).not.toMatch(
      /browser\(|plugins\/browser/
    );
    expect(at(files, "wrangler.jsonc")).not.toMatch(/"BROWSER"|"LOADER"/);
    for (const doc of ["README.md", "AGENTS.md"]) {
      expect(at(files, doc), doc).not.toContain("Browser Rendering");
    }
  });

  it("has the browser whole with it", () => {
    const n = names(TEMPLATE_TENANT);
    expect(at(withBrowser, `${n.dir}/plugins.ts`)).toContain(
      "browser({ binding: env.BROWSER, loader: env.LOADER })"
    );
    expect(at(withBrowser, "wrangler.jsonc")).toMatch(
      /"BROWSER"[\s\S]*"LOADER"/
    );
    for (const doc of ["README.md", "AGENTS.md"]) {
      expect(at(withBrowser, doc), doc).toContain("Browser Rendering");
    }
  });

  it("is already formatted with the browser too", async () => {
    const offenders: string[] = [];
    for (const file of withBrowser) {
      const output = await formatted(file.path, file.contents);
      if (output !== undefined && output !== file.contents) {
        offenders.push(file.path);
      }
    }
    expect(offenders).toEqual([]);
  });
});
