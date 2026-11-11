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
// Inside an esquery /regex/ literal "/" has to be escaped.
const AI_SDK_ESQUERY = "^@anthropic-ai\\/";

/**
 * The dynamic spellings of a forbidden import (`import("…")`, `import(`…`)`, `require("…")`),
 * which no-restricted-imports does not see.
 */
function dynamicImports(esquery, message) {
  return [
    { selector: `ImportExpression > Literal[value=/${esquery}/]`, message },
    {
      selector: `ImportExpression > TemplateLiteral > TemplateElement:first-child[value.raw=/${esquery}/]`,
      message,
    },
    { selector: `CallExpression[callee.name="require"] > Literal[value=/${esquery}/]`, message },
  ];
}
const CORE_TO_MODULES_SYNTAX = dynamicImports(CORE_TO_MODULES_ESQUERY, CORE_TO_MODULES_MESSAGE);

// Architecture rule (CLAUDE.md): the planner is pure. It reads no database, clock or network:
// no data, AI, app or Supabase code, no React, and the current time comes in as a parameter.
const PLANNER = "src/core/planner/**";
const PLANNER_IMPORTS = {
  regex:
    "^(@/core/(data|ai|app|ui)|(\\.\\./)+(data|ai|app|ui)|@/lib/supabase|react|next|@supabase|@tanstack)(/|$)",
  message: "src/core/planner is pure: data in, plan out (docs/04-planlayici.md).",
};
const PLANNER_SYNTAX = [
  {
    selector: "CallExpression[callee.object.name='Date'][callee.property.name='now']",
    message: "The planner does not read the clock; take `now` from the input.",
  },
  {
    selector: "NewExpression[callee.name='Date'][arguments.length=0]",
    message: "The planner does not read the clock; take `now` from the input.",
  },
  {
    selector: "CallExpression[callee.name='fetch']",
    message: "The planner does not touch the network.",
  },
];
const AI_SDK_SYNTAX = dynamicImports(AI_SDK_ESQUERY, AI_SDK_PATTERN.message);

// Architecture rules (CLAUDE.md), static and dynamic imports alike:
// - The core never knows the modules. Modules attach to the core only through the contract and
//   src/modules/registry.ts. Inside src/core, no project path (alias or relative) may pass
//   through a "modules" folder, however it is spelled: "@/modules/x", "../../modules/x",
//   "./../../modules/x", "../../../src/modules/x", "@/core/../modules/x".
// - Only the AI gateway (src/core/ai) imports the provider's SDK.
// A later block that sets the same rule replaces it for the files it matches, so each block
// below lists every pattern that applies to its files. (Test files get the test rule's
// no-restricted-syntax instead; their static imports stay covered.)
const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    files: ["src/**/*.{ts,tsx,mts,js,jsx,mjs}", "scripts/**/*.{ts,mts,js,mjs}"],
    ignores: ["src/core/**"],
    rules: {
      "no-restricted-imports": ["error", { patterns: [AI_SDK_PATTERN] }],
      "no-restricted-syntax": ["error", ...AI_SDK_SYNTAX],
    },
  },
  {
    files: ["src/core/**/*.{ts,tsx,mts,js,jsx,mjs}"],
    ignores: [AI_GATEWAY],
    rules: {
      "no-restricted-imports": ["error", { patterns: [CORE_TO_MODULES_PATTERN, AI_SDK_PATTERN] }],
      "no-restricted-syntax": ["error", ...CORE_TO_MODULES_SYNTAX, ...AI_SDK_SYNTAX],
    },
  },
  {
    files: [PLANNER],
    ignores: ["src/core/planner/**/*.test.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        { patterns: [CORE_TO_MODULES_PATTERN, AI_SDK_PATTERN, PLANNER_IMPORTS] },
      ],
      "no-restricted-syntax": [
        "error",
        ...CORE_TO_MODULES_SYNTAX,
        ...AI_SDK_SYNTAX,
        ...PLANNER_SYNTAX,
      ],
    },
  },
  {
    files: [AI_GATEWAY],
    rules: {
      "no-restricted-imports": ["error", { patterns: [CORE_TO_MODULES_PATTERN] }],
      "no-restricted-syntax": ["error", ...CORE_TO_MODULES_SYNTAX],
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
