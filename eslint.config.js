import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // .infographic-build holds Node build scripts (require/Buffer/process), not
  // browser app code, so linting them against browser globals only ever
  // produces false no-undef errors.
  // .claude/worktrees holds full checkouts of other branches. Without this,
  // ESLint lints every active worktree's copy of the source as if it were part
  // of master, reporting other branches' errors here. That matters beyond
  // noise: the weekly sweep in .claude/CRON.md chains
  // `npm run lint && npm run test`, so a non-zero lint exit from another
  // branch's code silently skips the tests and the audit skills.
  // .gemini/skills and .claude/skills/impeccable vendor a third-party
  // screenshot script (modern-screenshot.umd.js) as plugin content, not
  // project source -- linting it against this project's browser-only config
  // produces false no-undef/no-redeclare errors from its UMD wrapper.
  // scripts/external-calendar is a standalone Node project (its own
  // package.json, run only by .github/workflows/sync-official-calendar.yml)
  // using ESM .mjs files with Node globals (process, Buffer, fetch) this
  // browser-only config doesn't define -- the `files: ['**/*.{js,jsx}']`
  // glob below doesn't match .mjs anyway, but it's called out here too since
  // that's the more legible signal for why it isn't linted by this config.
  // It has its own `npm test` (vitest) run from inside that directory.
  globalIgnores(['dist', '.infographic-build', '.claude/worktrees', '.gemini', '.claude/skills/impeccable', 'scripts/external-calendar']),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
  },
])
