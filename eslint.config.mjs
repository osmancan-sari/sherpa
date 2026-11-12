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
    selector: "CallExpression[callee.name='Date']",
    message: "The planner does not read the clock; take `now` from the input.",
  },
  {
    selector:
      "CallExpression[callee.object.name=/^(Math|performance)$/][callee.property.name=/^(random|now)$/]",
    message: "The planner is deterministic: no random numbers, no clock.",
  },
  {
    selector: "CallExpression[callee.name='fetch']",
    message: "The planner does not touch the network.",
  },
];
const AI_SDK_SYNTAX = dynamicImports(AI_SDK_ESQUERY, AI_SDK_PATTERN.message);

// Architecture rule (docs/06-modul-sozlesmesi.md, "Sunucu zemini"; Ç3d): the module code that
// runs on the server (its rules, queries, ingest handlers and jobs) imports nothing made for
// the browser and touches no browser object. It runs with no screen: in the ingest endpoint and
// the scheduler.
// Its rules, queries, ingest handlers, jobs and text readers (`extractors`, run by the AI
// route), under any extension: "./rules" resolves to rules.mts or rules.tsx as well.
const SERVER_NAMES = "{rules,queries,ingest,jobs,extract}";
const ANY_SOURCE = "{ts,tsx,mts,js,jsx,mjs}";
const MODULE_SERVER_TOP = [`src/modules/*/${SERVER_NAMES}.${ANY_SOURCE}`];
// Every file under server/, whatever its extension: a .tsx there is server code too.
// … and when one of them grows into a folder ("./rules" resolves to rules/index.ts).
const MODULE_SERVER_DIR = [
  `src/modules/*/server/**/*.${ANY_SOURCE}`,
  `src/modules/*/${SERVER_NAMES}/**/*.${ANY_SOURCE}`,
];
// Inside the module, server code imports only server code: the four files and server/. A helper
// elsewhere in the module would let a browser import in through the back door.
const SERVER_NEIGHBOURS = "(rules|queries|ingest|jobs|extract)(/|$)|server/";
const MODULE_SERVER_RELATIVE_MESSAGE =
  'A module\'s server code imports, inside the module, only rules, queries, ingest, jobs and server/ (docs/06-modul-sozlesmesi.md, "Sunucu zemini").';
const RELATIVE_FROM_TOP = {
  regex: `^(\\./(?!${SERVER_NEIGHBOURS})|\\.\\./)`,
  message: MODULE_SERVER_RELATIVE_MESSAGE,
};
const RELATIVE_FROM_DIR = {
  regex: `^\\.\\./(?!${SERVER_NEIGHBOURS})`,
  message: MODULE_SERVER_RELATIVE_MESSAGE,
};
// The other spellings of the same back door (phase audit, round 2): a path that walks back
// ("./server/../helper"), and the alias ("@/modules/<slug>/helper"; a module's server code
// reaches its own files by relative paths, and other modules not at all).
const WALKS_BACK = {
  regex: "^.+/\\.\\.(/|$)",
  message: MODULE_SERVER_RELATIVE_MESSAGE,
};
// createRequire would load any path at run time, past every pattern here.
const NODE_MODULE = {
  regex: "^(node:)?module$",
  message: MODULE_SERVER_RELATIVE_MESSAGE,
};
const MODULE_ALIAS = {
  regex: "^@/modules(/|$)",
  message: MODULE_SERVER_RELATIVE_MESSAGE,
};
// Dynamic imports and require: server code has no use for them, and they would slip past the
// path patterns above.
const NO_DYNAMIC_IMPORT = [
  { selector: "ImportExpression", message: MODULE_SERVER_RELATIVE_MESSAGE },
  { selector: "CallExpression[callee.name='require']", message: MODULE_SERVER_RELATIVE_MESSAGE },
];
const BROWSER_ONLY = {
  regex:
    "^(react(-dom)?|next/(navigation|link|image|router|dynamic|script)|next-themes|lucide-react|@tanstack/.*|@base-ui/.*|@/components/.*|@/core/(app|ui|voice)|@/lib/supabase/client|(\\.{1,2}/)+(.*/)?components)(/.*)?$",
  message:
    'A module\'s server code (rules, queries, ingest, jobs) imports nothing made for the browser (docs/06-modul-sozlesmesi.md, "Sunucu zemini").',
};
const BROWSER_ONLY_ESQUERY = BROWSER_ONLY.regex.replaceAll("/", "\\/");
const BROWSER_GLOBALS = [
  "window",
  "document",
  "localStorage",
  "sessionStorage",
  "navigator",
  "location",
  "alert",
  "indexedDB",
  "speechSynthesis",
  "requestAnimationFrame",
].map((name) => ({ name, message: BROWSER_ONLY.message }));
const MODULE_SERVER_SYNTAX = [
  ...dynamicImports(BROWSER_ONLY_ESQUERY, BROWSER_ONLY.message),
  {
    selector: "Program > ExpressionStatement[directive='use client']",
    message: BROWSER_ONLY.message,
  },
];

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
    files: MODULE_SERVER_TOP,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            AI_SDK_PATTERN,
            BROWSER_ONLY,
            RELATIVE_FROM_TOP,
            WALKS_BACK,
            MODULE_ALIAS,
            NODE_MODULE,
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        ...AI_SDK_SYNTAX,
        ...MODULE_SERVER_SYNTAX,
        ...NO_DYNAMIC_IMPORT,
      ],
      "no-restricted-globals": ["error", ...BROWSER_GLOBALS],
    },
  },
  {
    files: MODULE_SERVER_DIR,
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            AI_SDK_PATTERN,
            BROWSER_ONLY,
            RELATIVE_FROM_DIR,
            WALKS_BACK,
            MODULE_ALIAS,
            NODE_MODULE,
          ],
        },
      ],
      "no-restricted-syntax": [
        "error",
        ...AI_SDK_SYNTAX,
        ...MODULE_SERVER_SYNTAX,
        ...NO_DYNAMIC_IMPORT,
      ],
      "no-restricted-globals": ["error", ...BROWSER_GLOBALS],
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
