/**
 * The files a generated project needs that say nothing about the agent: how it
 * builds, lints, formats and typechecks, and what git ignores.
 *
 * Constants, like `./shared.ts` and for the same reason — identical in every
 * generated project, so a later merge has nothing to reconcile.
 *
 * `tsconfig.json` carries no comments on purpose: prettier's own parser for it
 * is the JSON one, and the explanations that would go in it are in the
 * generated AGENTS.md instead. The toolchain these are written against is
 * pinned in `src/train.ts`.
 */
import { NODE_VERSION } from "../../../train.js";
import { jsonFile } from "../text.js";

/**
 * `tsconfig.json` — the Worker's own sources.
 *
 * Written out rather than built with `jsonFile`, because it has arrays in it:
 * prettier puts a short array on one line and `JSON.stringify` never does.
 */
export const tsconfigJson = `{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022"],
    "types": ["./worker-configuration.d.ts", "node"],
    "strict": true,
    "noEmit": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "paths": {
      "@/*": ["./src/*"]
    }
  },
  "include": ["src/**/*.ts"]
}
`;

/**
 * `test/tsconfig.json` — the suite, which additionally sees `cloudflare:test`.
 * A separate project because those types have no business in the Worker's.
 */
export const testTsconfigJson = `{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "types": [
      "../worker-configuration.d.ts",
      "node",
      "@cloudflare/vitest-plugin/types"
    ]
  },
  "include": ["./**/*.ts"]
}
`;

/** `.prettierrc` */
export const prettierrc = jsonFile({ trailingComma: "none" });

/** `.nvmrc` */
export const nvmrc = `${NODE_VERSION}\n`;

/** `.prettierignore` */
export const prettierignore = `node_modules/
dist/
.wrangler/

# Written by \`npm run types\`.
worker-configuration.d.ts
`;

/** `.gitignore` */
export const gitignore = `node_modules/
dist/
.wrangler/
*.tsbuildinfo
*.log

# Secrets. \`.env.example\` is the one file here that is committed.
.env
.env.*
!.env.example

# Written by \`npm run types\` from wrangler.jsonc.
worker-configuration.d.ts

.DS_Store
`;

/** `eslint.config.js` */
export const eslintConfigJs = `import tseslint from "typescript-eslint";
import da from "@dynamicagents/core/eslint";

const LINTED_FILES = ["src/**/*.ts", "test/**/*.ts"];

export default tseslint.config(
  {
    extends: [...tseslint.configs.recommended],
    files: LINTED_FILES,
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
      "no-unused-expressions": "off",
      // The Agents SDK's \`this.sql\`…\`\` statements are tagged templates run for
      // their side effect; keep the rule for everything else.
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowTaggedTemplates: true }
      ],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_"
        }
      ]
    }
  },
  {
    // Type-aware pass — enables @deprecated detection without switching the
    // whole config to recommendedTypeChecked and its stricter rule set.
    files: LINTED_FILES,
    plugins: { "@typescript-eslint": tseslint.plugin, da },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname
      }
    },
    rules: {
      "@typescript-eslint/no-deprecated": "error",
      // Covers the object-literal keys \`no-deprecated\` structurally cannot see —
      // every \`generateText({ system: … })\`-style options bag.
      "da/no-deprecated-object-properties": "error"
    }
  },
  {
    ignores: [
      "worker-configuration.d.ts",
      "node_modules/",
      ".wrangler/",
      "dist/"
    ]
  }
);
`;
