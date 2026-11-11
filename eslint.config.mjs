import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

// A project path (alias or relative) with a "modules" folder anywhere in it.
const CORE_TO_MODULES = "^(@/|\\.{1,2}/)(.*/)?modules(/|$)";
// The same pattern inside an esquery /regex/ literal, where "/" has to be escaped.
const CORE_TO_MODULES_ESQUERY = CORE_TO_MODULES.replaceAll("/", "\\/");
const CORE_TO_MODULES_MESSAGE =
  "src/core must not import from src/modules. Use the module contract (docs/06-modul-sozlesmesi.md).";
const CORE_TO_MODULES_PATTERN = { regex: CORE_TO_MODULES, message: CORE_TO_MODULES_MESSAGE };

// Architecture rule (CLAUDE.md): AI calls go through the single gateway in src/core/ai.
// Nothing else imports the provider's SDK.
const AI_SDK_PATTERN = {
  regex: "^@anthropic-ai/",
  message: "Only src/core/ai may use the AI provider's SDK. Call the gateway (runAiCall).",
};
const AI_GATEWAY = "src/core/ai/**";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // Outside the core: only the AI SDK rule. (A later block that sets the same rule replaces
    // it, so the core blocks below repeat this pattern.)
    files: ["src/**/*.{ts,tsx,mts,js,jsx,mjs}", "scripts/**/*.{ts,mts,js,mjs}"],
    ignores: ["src/core/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [AI_SDK_PATTERN] }],
    },
  },
  {
    files: ["src/core/**/*.{ts,tsx,mts,js,jsx,mjs}"],
    ignores: [AI_GATEWAY],
    rules: {
      "no-restricted-imports": ["error", { patterns: [CORE_TO_MODULES_PATTERN, AI_SDK_PATTERN] }],
    },
  },
  {
    files: [AI_GATEWAY],
    rules: {
      "no-restricted-imports": ["error", { patterns: [CORE_TO_MODULES_PATTERN] }],
    },
  },
  {
    // Architecture rule (CLAUDE.md): the core never knows the modules.
    // Modules attach to the core only through the contract and src/modules/registry.ts.
    // Inside src/core, no project path (alias or relative) may pass through a "modules" folder,
    // however it is spelled: "@/modules/x", "../../modules/x", "./../../modules/x",
    // "../../../src/modules/x", "@/core/../modules/x". Static, dynamic and require() alike.
    // (The import half of this rule is in the blocks above, together with the AI SDK rule.)
    files: ["src/core/**/*.{ts,tsx,mts,js,jsx,mjs}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector: `ImportExpression > Literal[value=/${CORE_TO_MODULES_ESQUERY}/]`,
          message: CORE_TO_MODULES_MESSAGE,
        },
        {
          selector: `ImportExpression > TemplateLiteral > TemplateElement:first-child[value.raw=/${CORE_TO_MODULES_ESQUERY}/]`,
          message: CORE_TO_MODULES_MESSAGE,
        },
        {
          selector: `CallExpression[callee.name="require"] > Literal[value=/${CORE_TO_MODULES_ESQUERY}/]`,
          message: CORE_TO_MODULES_MESSAGE,
        },
      ],
    },
  },
  {
    // Verification rule (prompts/BASLA.md): tests are never skipped or narrowed to get to green.
    files: ["tests/**/*.{ts,tsx}", "src/**/*.test.{ts,tsx}"],
    rules: {
      "no-restricted-syntax": [
        "error",
        {
          selector:
            "MemberExpression[property.name=/^(only|skip|todo|fixme|skipIf|runIf|fails|fail)$/]",
          message:
            "Tests are not skipped, narrowed or expected to fail (only, skip, todo, fixme, fails). Fix the test.",
        },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/lib/supabase/database.types.ts",
    "test-results/**",
    "playwright-report/**",
  ]),
]);

export default eslintConfig;
