# Core

Everything here is independent of the modules. Nothing under `src/core/` may import from
`src/modules/`; ESLint enforces it (`eslint.config.mjs`) and `tests/unit/core-imports.test.ts`
checks that the rule stays in place.

| Folder | Holds | Arrives in |
| --- | --- | --- |
| `contract/` | The module contract: types, registry, the work envelope's pure rules | Ç1 |
| `data/` | Queries, mutations, realtime; every function takes a Supabase client | Ç1 |
| `events/` | Event publishing and delivery to listening modules | Ç1 |
| `intake/` | Quick add parsing, structured blocks, inbox routing | Ç1 |
| `today/` | Pure selection rules of the first Today screen (until the planner) | Ç1 |
| `ui/` | Shared interface pieces: navigation, NowCard, QuickAdd, module page shell, kit | Ç0 onwards |
| `testing/` | Row factories for unit tests | Ç1 |
| `ai/` | The single gateway for AI calls | Ç2 |
| `planner/` | Pure planning functions and their tests | Ç3 |
