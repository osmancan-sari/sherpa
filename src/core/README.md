# Core

Everything here is independent of the modules. Nothing under `src/core/` may import from
`src/modules/`; ESLint enforces it (`eslint.config.mjs`) and `tests/unit/core-imports.test.ts`
checks that the rule stays in place.

| Folder | Holds | Arrives in |
| --- | --- | --- |
| `ui/` | Shared interface pieces: navigation now; NowCard, DayStrip, QuickAdd later | Ç0 onwards |
| `data/` | Queries, mutations, realtime | Ç1 |
| `events/` | Event publishing and subscription | Ç1 |
| `intake/` | Quick add, inbox, routing | Ç1 |
| `ai/` | The single gateway for AI calls | Ç2 |
| `planner/` | Pure planning functions and their tests | Ç3 |
