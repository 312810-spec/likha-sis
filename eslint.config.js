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
  globalIgnores(['dist', '.infographic-build', '.claude/worktrees']),
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
