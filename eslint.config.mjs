import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import prettier from "eslint-config-prettier/flat";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  prettier,
  {
    // Architecture rule (CLAUDE.md): the core never knows the modules.
    // Modules attach to the core only through the contract and src/modules/registry.ts.
    files: ["src/core/**/*.{ts,tsx,mts,js,jsx,mjs}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              regex: "^(@/modules|(\\.\\./)+modules)(/|$)",
              message:
                "src/core must not import from src/modules. Use the module contract (docs/06-modul-sozlesmesi.md).",
            },
          ],
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
