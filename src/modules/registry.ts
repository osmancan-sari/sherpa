import { createRegistry } from "@/core/contract/registry";
import type { ModuleDefinition } from "@/core/contract/types";

// Registered modules. The core reaches modules only through this registry and the module
// contract (docs/06-modul-sozlesmesi.md); src/core never imports from src/modules (ESLint).
// A definition that breaks the contract fails here, when the app starts and in the tests.
const definitions: ModuleDefinition[] = [];

export const registry = createRegistry(definitions);
