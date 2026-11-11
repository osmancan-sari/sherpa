import { createRegistry } from "@/core/contract/registry";
import type { ModuleDefinition } from "@/core/contract/types";
import { sablon } from "./_sablon/module";
import { deneme } from "./deneme/module";

// Registered modules. The core reaches modules only through this registry and the module
// contract (docs/06-modul-sozlesmesi.md); src/core never imports from src/modules (ESLint).
// A definition that breaks the contract fails here, when the app starts and in the tests.
//
// To add a module: copy src/modules/_sablon, then add its definition to the list below
// (steps in src/modules/_sablon/README.md).

/**
 * The test module is registered only where it is asked for (local development, the test
 * runs, a "dev" deployment). Production never sets this, so it never meets real data.
 */
export const DEMO_MODULE_ENABLED = process.env.NEXT_PUBLIC_SHERPA_DEMO_MODULE === "1";

/**
 * The template the way README step 2 leaves it: copied and renamed, nothing else. It is
 * registered next to the test module so that the end-to-end tests can switch it on and prove
 * that a fresh copy of the template is a working module (tests/e2e/template-module.spec.ts).
 */
export const TEMPLATE_COPY: ModuleDefinition = {
  ...sablon,
  slug: "sablon-kopya",
  name: "Şablon kopyası",
};

const definitions: ModuleDefinition[] = [...(DEMO_MODULE_ENABLED ? [deneme, TEMPLATE_COPY] : [])];

export const registry = createRegistry(definitions);
