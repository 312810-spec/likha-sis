cat << 'EOF' > GEMINI.md
# Project Context & Rules

## Core Architecture
- Stack: React, Firestore (`src/importers/`), Vitest / Jest.
- Agent Rules: Check `.agents/rules/` for schema and QA guidelines.

## Active Specs (Read on-demand only)
- SF10 Generation: `docs/superpowers/specs/2026-08-16-sf10-generation-design.md`
- SF8 Nutrition: `docs/superpowers/specs/2026-08-16-sf8-nutrition-consolidator-design.md`

## Token Savings & Workflow Constraints
- Never scan `node_modules`, `dist`, or full build output.
- Run targeted tests only (e.g., `npm test -- path/to/file.test.js`) instead of full test suites.
- Ask before modifying core Firestore batch logic or writing more than 3 files at once.
EOF