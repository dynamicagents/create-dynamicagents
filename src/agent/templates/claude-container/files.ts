/**
 * The `claude-container` blueprint: a parent that hands a task to a Claude Code
 * session in a sandbox container, in a scratchpad, and shares the files it
 * makes as artifact links. No repository and no GitHub credential.
 *
 * Unlike the generic blueprint, whose files are each a template and a module
 * binding its variation, every file here is a working file of a real project
 * whose tenant is `claude-container`. The variations inside a file are the
 * tenant, swapped by `../shared/retenant.ts`; the answers it shares with the
 * generic blueprint, its turn's model, its description (on its card and atop its
 * README) and whether it has the browser; and the pins
 * `src/train.ts` owns: the compatibility date and the dependency ranges in
 * `./package-json.ts`. The browser is a `$when browser` region of the files
 * that hold it, and the model and the description are replaced in place, in
 * `src/config.ts`, the card and the README, so every file stays a working file of the
 * default project apart from those markers and tokens.
 *
 * The toolchain files and the deployment's stub card are the generic
 * blueprint's own, unchanged, so a merge with a generated generic agent finds
 * them identical.
 */
import { COMPATIBILITY_DATE } from "../../../train";
import { names } from "../../names";
import type { AgentSpec } from "../../spec";
import {
  eslintConfigJs,
  nvmrc,
  prettierignore,
  prettierrc,
  testTsconfigJson,
  tsconfigJson
} from "../shared/dotfiles";
import { hostManifestTs } from "../shared/host-manifest";
import { render } from "../shared/render";
import { retenant } from "../shared/retenant";
import { quoted, stringProp } from "../shared/text";
import { claudeContainerPackageJson } from "./package-json";
import { TEMPLATE } from "./template";

/** The one match of `line` in `source`, or a sentence naming what drifted. */
function only(source: string, line: RegExp, what: string): void {
  const found = source.match(line)?.length ?? 0;
  if (found !== 1) {
    throw new Error(
      `claude-container's ${what} has ${found} matching lines where one is expected`
    );
  }
}

/**
 * `config.ts` with its turn's model set to `modelId`. The compaction model is
 * left as the template writes it: this agent compacts at a size its own comment
 * says a flash model times out on, so the turn's model is not a safe stand-in.
 * The line is replaced rather than tokenised so the template stays the default
 * project's own file, and after the tenant rename so a model id is never renamed.
 */
export function withModel(source: string, modelId: string): string {
  const line = /^ {2}modelId: "[^"]*",$/gm;
  only(source, line, "config.ts `modelId`");
  return source.replace(line, () => `  modelId: ${quoted(modelId)},`);
}

/**
 * The agent's card with its description set to the one the CLI asked for, laid
 * out as prettier lays a property out. The soul stays the template's: it is
 * this agent's operating rules, not a line about what it is for.
 */
export function withDescription(source: string, description: string): string {
  const line = /^ {2}description:\n {4}"(?:[^"\\]|\\.)*",$/gm;
  only(source, line, "manifest.ts `description`");
  return source.replace(
    line,
    () => `${stringProp("description", description)},`
  );
}

/**
 * The README with its opening paragraph set to the description the CLI asked
 * for, as the generic README opens with it. The paragraph is replaced rather
 * than tokenised so the template stays the default project's own file, and after
 * the tenant rename, as the card's is, so an answer is never renamed.
 */
export function withReadmeDescription(
  source: string,
  description: string
): string {
  const opening = /^(# [^\n]*\n\n)[^\n]+(?:\n[^\n]+)*(?=\n\n)/;
  if (!opening.test(source)) {
    throw new Error(
      "claude-container's README.md has no opening paragraph under its title"
    );
  }
  return source.replace(
    opening,
    (_, title: string) => `${title}${description}`
  );
}

/** One file to write, its path relative to the project root. */
interface File {
  path: string;
  contents: string;
}

/** The whole project, in the order a reader would meet it. */
export function claudeContainerFiles(spec: AgentSpec): File[] {
  const t = TEMPLATE;
  const n = names(spec.tenant);
  const port = (path: string, source: string): File => ({
    path,
    contents: retenant(source, n, spec.name)
  });
  const file = (path: string, contents: string): File => ({ path, contents });
  const browser = spec.capabilities.includes("browser");

  return [
    file("package.json", claudeContainerPackageJson(spec)),
    port(
      "wrangler.jsonc",
      render(t.wranglerJsonc, {
        when: { browser },
        tokens: { COMPATIBILITY_DATE }
      })
    ),
    file("tsconfig.json", tsconfigJson),
    port("vitest.config.ts", t.vitestConfigTs),
    file("eslint.config.js", eslintConfigJs),
    file(".prettierrc", prettierrc),
    file(".prettierignore", prettierignore),
    port(".gitignore", t.gitignore),
    file(".nvmrc", nvmrc),
    port(".dockerignore", t.dockerignore),
    port(".env.example", t.envExample),
    file(
      "README.md",
      withReadmeDescription(
        port("README.md", t.readmeMd).contents,
        spec.description
      )
    ),
    port("AGENTS.md", t.agentsMd),
    port("Dockerfile", t.dockerfile),
    port("scripts/build-daemon.mjs", t.buildDaemonMjs),
    port("scripts/verify-container-env.mjs", t.verifyContainerEnvMjs),

    port("src/index.ts", t.indexTs),
    file("src/host-manifest.ts", hostManifestTs(spec)),
    file(
      "src/config.ts",
      withModel(port("src/config.ts", t.configTs).contents, spec.modelId)
    ),
    port("src/copy.ts", t.copyTs),
    port("src/model.ts", t.modelTs),
    port("src/sandbox-daemon.ts", t.sandboxDaemonTs),
    ...t.workspace.map(([name, source]) =>
      port(`src/workspace/${name}`, source)
    ),

    ...t.agent.map(([name, source]) => {
      const ported = port(
        `${n.dir}/${name}`,
        name === "plugins.ts" ? render(source, { when: { browser } }) : source
      );
      return name === "manifest.ts"
        ? {
            ...ported,
            contents: withDescription(ported.contents, spec.description)
          }
        : ported;
    }),

    file("test/tsconfig.json", testTsconfigJson),
    port("test/worker.ts", t.workerTs),
    port("test/edge.spec.ts", t.edgeSpecTs),
    ...t.tests.map(([name, source]) =>
      port(`test/${name.replace("{tenant}", spec.tenant)}`, source)
    )
  ];
}
