# LIKHA-SIS — Project Memory & Architectural Blueprint

## 1. Purpose & Context
FranzShin is the ICT Coordinator at Tingub National High School (Philippines) and the primary developer of LIKHA-SIS (Learner Information & Knowledge Hub Administrative System)—a web-based school management PWA.

Development operates exclusively via **Claude Code CLI (Pro)** running directly in the local terminal environment (`/e/LIKHA SYS/likha-sis`). Claude Code acts as the autonomous Lead Architect & Full-Stack Engineer, eliminating external prompt-generation loops and free-tier coding agent setups.

---

## 2. Core Architecture & Tech Stack
* **Frontend/Backend:** React + Vite, Tailwind CSS v3, Firebase (Auth + Firestore), `lucide-react`, `ColorThief`. Hosted on GitHub.
* **Primary Engine:** `Sonnet 5` set as default in Claude Code CLI via `CLAUDE.md`.
* **Routing:** Single-page string state (`currentPage`) in `App.jsx` (**STRICT: Do NOT use React Router**).
* **Theming:** Screen-chrome dark/light/brand themes using `useDarkMode()` and `useBrandTheme()` hooks.
* **Print Safety Boundaries:** Printable components (`ReportCard`, `CertificateGenerator`, `IDGenerator`) maintain a strict pure white background during `@media print`.
* **Configuration:** All school setup lives in one ICT-Coordinator-only tabbed **School Settings** page, gated by a hashed School Settings key (see Section 4D).
* **APIs:** QR generation via `api.qrserver.com` (no npm dependencies).
* **Source of Truth:** Live GitHub repository at `https://github.com/312810-spec/likha-sis.git`.

---

## 3. DepEd Domain Mandates (SY 2026–2027)
* **DO 15, s. 2026 (Grading):**
  * Components: WW (Written/Oral Works), PT (Product/Performance Tasks), EX (Examinations).
  * EX Internal Split: ST1 (30%), ST2 (30%), TE (40%). Omitted for Grades 1–3 transition subjects.
  * Weights (WW/PT/EX): Core = 20/50/30; EPP-TLE/MAPEH = 20/60/20; Tech-Pro/Immersion = 20/80/0 or 15/65/20.
  * Transmutation: Raw → Weighted → Initial Grade (IG) → SY 2026–2027 Transmutation Table. Zero-based grading begins SY 2027–2028.
* **DO 006, s. 2026 (Safe Environment / LRP):**
  * 3-tier behavioral classifications: Level 1 (Minor/Disruptive), Level 2 (Serious/Stalking/Slight Injury), Level 3 (Severe/Gang/Cheating/Drugs).
  * Integrated into LARDO tracking. Access restricted to `smeaCoordinator`, `principal`, and `guidance` roles.
* **DO 017, s. 2026 (Strengthened SHS):**
  * 2-Track Model: Academic Track vs. Tech-Pro Track (10 Elective Clusters). 5 mandatory core subjects in Grade 11.
* **Calendar:** 3-Term System (`Term 1`, `Term 2`, `Term 3`) ONLY. Legacy Q1–Q4 quarterly references are obsolete.

---

## 4. Architectural Frameworks

### A. Single-Agent Terminal System (Claude Code CLI)
Execution operates directly within Git Bash without third-party prompt handoffs:

```
              [ FranzShin (Terminal Directives) ]
                             │
                             ▼
                 [ Claude Code CLI (Sonnet 5) ]
             (Reads CLAUDE.md & Analyzes Repo)
                             │
    ┌────────────────────────┼────────────────────────┐
    ▼                        ▼                        ▼
[ Direct File Edits ]  [ Terminal Executions ]  [ Security & Schema ]
(React / Tailwind)     (npm run lint / test)    (firestore.rules)
    │                        │                        │
    └────────────────────────┼────────────────────────┘
                             ▼
                    [ Commit, on request ]
```

### B. Active Loop Engineering Engine (Self-Correcting Execution)
1. **Repo Baseline Loop:** Inspect state and run test baseline before any modification.
2. **Implementation-to-Verification Loop:** Automatically run `npm run lint && npm run test` after making changes.
3. **Auto-Refactor Loop:** If linting or testing fails, parse error outputs, fix code immediately, and re-verify until a 100% pass rate is achieved.
4. **Data-Safety Loop:** Automatically append security definitions in `firestore.rules` for any new Firestore collection.
5. **Git Commit Convention:** Use conventional messages (`feat:`, `fix:`, `docs:`, ...) when the user asks for a commit — never commit or push automatically; `.claude/settings.json` gates both behind explicit approval.
6. **Business Logic Trigger Loops:**
   * Attendance < 80% (SF2) → Auto-trigger LARDO risk flag.
   * Initial Grade < 70.00 → Auto-trigger DO 15 academic intervention flag.
   * 14-day post-intervention recovery (attendance or grades) → Auto-resolve the LARDO risk flag.

### C. Graph Engineering (Component & Knowledge Traversal)

```
[ settings/schoolConfig ] ---> [ academicCalendar.js ]
         │                            │
         ▼                            ▼
[ App.jsx Routing ] <──────> [ Sidebar.jsx Guards ]
         │                            │
         ├────────────────────────────┼────────────────────────────┐
         ▼                            ▼                            ▼
[ Learner Data ]            [ Grading Module ]            [ SMEA / LRP ]
(SF1 / SF2 / SF8 BMI)       (DO 15 s.2026 Computations)    (DO 6 / DO 17 Tracks)
         │                            │                            │
         └────────────────────────────┼────────────────────────────┘
                                       ▼
                             [ firestore.rules ]
```

* **Dependency Traversal Rule:** Updates to core schemas (`Learner` / `Class Record`) automatically traverse and update dependent components (`Consolidated Grades`, `SF9`, `SMEA Rollups`, `LARDO`).

### D. School Settings & the Settings Lock (ICT Coordinator)

Everything the first-run `SetupWizard` collects is also editable at any time from a single tabbed **School Settings** page (`src/SchoolSettings.jsx`), owned exclusively by the `ictCoordinator` role. Tabs: School Identity, Grade Levels & SHS, Branding & Theme, Academic Calendar, Security. The standalone `brandingSettings` page no longer exists — branding renders inside the Branding & Theme tab via `<BrandingSettings embedded />`.

* **Access:** `pageAccess.js` grants `schoolSettings` to `ictCoordinator` only. The principal keeps User Management but can no longer read or write `settings/*`; `firestore.rules` enforces the same narrowing server-side.
* **Safety net — the School Settings key:** a dedicated key, separate from the login password, set during Step 2 of the SetupWizard and required before any tab is revealed. Only a PBKDF2-SHA256 record (150k iterations, 16-byte salt, 256 derived bits) is stored in `settings/security`; the plaintext key is never persisted. Implemented in `src/utils/settingsLock.js` on the Web Crypto API — **no npm dependency**. Verification fails closed, wrong attempts throttle after 5 tries, and the page re-locks on **Lock** or on leaving the page. A forgotten key is recovered by deleting `settings/security` in the Firebase console, which returns the page to "create a key" rather than locking the school out.
* **Firestore rules caveat:** rules are *additive*, so a narrow `match /settings/security` block alone cannot hide the hash — the broad `match /settings/{document}` rule carries a `document != 'security'` guard, and that guard is what actually restricts it. Both blocks keep a `!isSetupComplete()` bootstrap branch so first-run writes succeed; the SetupWizard therefore writes `settings/security` *before* `settings/schoolConfig`.
* **Threat model (honest):** `settings/security` is readable by the `ictCoordinator` role itself. The key guards against accidental edits, a forgotten open tab, and a borrowed workstation — not against a determined ICT Coordinator.
* **Academic Calendar is now data, not code:** school years and the three term date ranges live in `settings/schoolConfig.academicCalendar`, layered by `mergeAcademicCalendar()` over the built-in SY 2026–2027 fallback in `src/academicCalendar.js`. Consumers (`SF4.jsx`, `SMEAEnrollment.jsx`) read it through the `useAcademicCalendar()` hook. Terms stay fixed at three per DO 15, s. 2026 — they can be dated, never added or removed.

### E. Permanent Architectural Constraints
* No React Router — routing stays single-page `currentPage` state (§2, §4A).
* Preserve the Firestore data model; no new collection without an explicit `firestore.rules` block (`firestore-schema-sync` skill / `schema-guardian` agent) and architectural sign-off.
* Preserve `firestore.rules` — remember rules are additive (see `docs/ai/DECISIONS.md`), never assume a narrow nested rule overrides a broader parent grant.
* Preserve official DepEd form layouts (SF1/SF2/SF4/SF8/SF9/SF10) — structural changes are a compliance risk, not a styling choice.
* Preserve print safety (§17 conventions in `docs/ai/PROJECT-MEMORY.md`) — never let screen theme leak into `@media print`.
* Preserve the School Settings key/lock (§4D) — don't weaken its verification or bypass the settings-lock gate.
* Preserve the 3-term academic system — never reintroduce Q1–Q4 quarter terminology into new work.
* Don't duplicate grading/transmutation logic — call into `src/utils/gradeComputations.js` / `transmutationTable.js`, never reimplement the weight math inline.

### F. AI Development Rules
* Inspect existing code before editing; read the file(s) you're about to change first.
* Plan before multi-file work — a short bullet plan for anything touching 3+ files.
* Prefer minimal diffs over rewrites; use targeted edits, not full-file replacement.
* Reuse existing utilities/hooks/components (see `docs/ai/PROJECT-MEMORY.md` for the current inventory) before writing new ones.
* Never add a dependency the existing stack (§2, §18) already covers.
* Verify changes: run the targeted lint/test for what you touched before declaring done (Claude Code hooks in `.claude/settings.json` do this automatically on Edit/Write/Stop).
* Report changed files and what was actually verified — never claim a check passed that didn't run.

Long-term project memory that doesn't belong in this file lives in `docs/ai/PROJECT-MEMORY.md` (reusable utilities, data relationships, security/print/testing conventions) and `docs/ai/DECISIONS.md` (ADR-style architecture decisions).

---

## 5. Commit Convention
Commit and push only when the user asks (`.claude/settings.json` requires approval for both). When asked, use a conventional message:
```bash
git add <files>
git commit -m "type: concise summary"
git push origin master
```

---

## 6. Primary Terminal Commands
* **Build:** `npm run build`
* **Lint:** `npm run lint`
* **Test:** `npm run test`

---

## 7. Automation Layer — Skills, Agents & Autopilot

### A. Project Skills (`.claude/skills/`)
Recurring domain workflows are packaged as skills so they run consistently instead of being re-reasoned from scratch each time:
* **`do15-grading-audit`** — Verifies grading logic (`src/utils/gradeComputations.js`, `src/utils/transmutationTable.js`, `ConsolidatedGrades.jsx`) against DO 15 s.2026 weights, the ST1/ST2/TE 30/30/40 exam split, and the Initial Grade < 70.00 intervention trigger.
* **`lardo-safety-audit`** — Verifies attendance-based LARDO flags (`src/utils/lardoAutoResolve.js`, `LardoTracking.jsx`), the 14-day auto-resolve window, and DO 006 3-tier LRP role restrictions (`smeaCoordinator`, `principal`, `guidance` only).
* **`print-safety-audit`** — Verifies printable components (`ReportCard.jsx`, `CertificateGenerator.jsx`, `IDGenerator.jsx`) keep a pure white `@media print` background with no dark/brand theme leakage.
* **`firestore-schema-sync`** — Implements the Data-Safety Loop (Section 4B.4): any new Firestore collection gets a matching `firestore.rules` block before the change is considered done, then deploys directly via `npx firebase-tools deploy --only firestore:rules`.

### B. Specialist Agent Team (`.claude/agents/`)
Nine focused agents — Opus for read-only analysis, Sonnet for execution/gating. No agent duplicates another's job:
* **`deped-domain-guardian`** (Opus, read-only analysis) — The single DepEd-compliance agent: 3-term calendar, official form layouts, and DO 15/DO 006/DO 017 rules (grading, LARDO, SHS tracks) already documented in the repo.
* **`security-privacy-auditor`** (Opus, read-only analysis) — Audits learner PII, auth, Firestore access, and secrets for Data Privacy Act exposure.
* **`feature-planner`** (Opus, read-only analysis) — Turns a complex feature request into an implementation-ready plan; never edits code.
* **`schema-guardian`** (Sonnet, execution) — Detects Firestore schema/index drift in a diff, then writes and deploys the matching `firestore.rules` block.
* **`test-automation-engineer`** (Sonnet, execution) — Adds/updates targeted Vitest coverage, prioritizing `src/utils/`, hooks, and critical workflows.
* **`release-gate`** (Sonnet, gate) — The single final-verification agent: lint/test/build, unintended files, dependency drift, Firestore-rule gaps, print/dark-mode/accessibility spot-check, constraint check against §2/§3.
* Plus the UI redesign chain (§7D note in `docs/ai/PROJECT-MEMORY.md`): `design-ux-architect` → `design-ui-designer` → `engineering-minimal-change-engineer` → `design-ui-finish-gate-reviewer` → `testing-accessibility-auditor` → `testing-performance-benchmarker` → `testing-reality-checker`.

Use the smallest number of agents necessary — don't spawn a chain for a trivial task; Claude should work directly and just verify. Preferred routing: simple task → direct + verify; medium task → `feature-planner` → implementation → `release-gate`; UI task → the seven-phase redesign chain; data/schema task → `feature-planner` → `schema-guardian` (drift check) → implementation → tests → `release-gate`; security-sensitive task → `feature-planner` → `security-privacy-auditor` → implementation → `release-gate`.

### C. Autopilot
A scheduled cloud routine runs the grading/LARDO/print/schema audit skills on a recurring cadence so drift is caught without a manual prompt. See `.claude/CRON.md` for the active schedule.

### D. General Agent Pool (`~/.claude/agents/`, global)
270 general-purpose agent personas from the `msitarzewski/agency-agents` toolkit are installed globally (not project-scoped, so they're also available outside LIKHA-SIS). Most divisions in that pool — marketing, paid-media, sales, finance, GIS, game-development, spatial-computing/XR, legal, real estate, hospitality, healthcare-business — don't apply to a DepEd school PWA and should be ignored. When a task would benefit from one, reach for it automatically without asking, from these relevant divisions only:

* **`engineering-*`** — general dev work the project skills above don't cover: `engineering-code-reviewer`, `engineering-software-architect`, `engineering-database-optimizer` (Firestore data modeling), `engineering-devops-automator` (GitHub Actions/deploy), `engineering-git-workflow-master`, `engineering-minimal-change-engineer`, `engineering-technical-writer`, `engineering-section-508-specialist` (accessibility).
* **`security-*`** and **`data-privacy-officer`** — `security-appsec-engineer`, `security-architect`, `security-compliance-auditor`, `security-secrets-credential-engineer`, `security-ai-generated-code-auditor` (useful given this codebase is AI-written). Relevant beyond `firestore-schema-sync` because learner PII (grades, BMI, LRP/behavioral records) makes Philippine Data Privacy Act exposure a real concern, not just a Firestore-rules exercise.
* **`design-*`** — `design-ui-designer`, `design-ux-architect`, `design-ux-researcher`, `design-ui-finish-gate-reviewer`, `design-inclusive-visuals-specialist`, for PWA UI/UX work.
* **`testing-*`** — `testing-test-automation-engineer`, `testing-accessibility-auditor`, `testing-performance-benchmarker`, `testing-reality-checker`, alongside the project's own `test-automation-engineer` and `release-gate`.
* **`product-*`** and **`project-management-*`** — `product-manager`, `product-feedback-synthesizer`, `project-management-project-shepherd`, for feature scoping/prioritization work.
* **`specialized-codebase-archaeologist`**, **`specialized-document-generator`** (SF9/SF10/report-style document work), **`specialized-mcp-builder`** (if integrating an external MCP server).

Ignore every other division in the pool by default unless a task explicitly calls for it.

---

## 8. Full-Stack Engineering Lead Mode — Token Efficiency Directive

Claude Code operates as the **Full-Stack Engineering Lead** for LIKHA-SIS (Vite + React + Firebase), under a standing mandate for extreme token efficiency and code precision: complete engineering tasks with minimum token consumption while maintaining 100% type safety and strict DepEd compliance.

### A. Strict File & Read Boundaries (Token Saver)
* **Never** read non-code/asset directories or files: `.infographic-build/`, `public/*.png`, `public/*.xlsx`, `src/assets/`.
* **Never** output entire file contents when editing. Use targeted search-and-replace block edits (`Edit`-style snippet replaces) only — not full-file rewrites.
* **Never** re-read a file immediately after writing/editing it unless an explicit syntax/lint error occurs.
* When inspecting code structure, read **only** declaration lines, exported signatures, and interfaces first. Do not load full function bodies unless directly working inside them.

### B. Execution & Tool Guidelines
* **Targeted grep/search**: always constrain searches to the exact folder in scope.
  * Good: search `computeLearnerGrade` within `src/utils/`.
  * Bad: search `computeLearnerGrade` across the whole repo.
* **Targeted testing only**: run tests for the specific file under modification (e.g. `npx vitest run src/utils/__tests__/autoFlagTriggers.test.js`), not the full suite, unless a change is repo-wide.
* **Minimal terminal output**: prefer concise/quiet flags (`--silent`, `--reporter=compact`) to avoid inflating context with verbose CLI output.

### C. Domain & Architecture Discipline
* **State management**: keep components lean; rely on lightweight React hooks (`useSchoolConfig`, `useAcademicCalendar`) and pure functions inside `src/utils/`.
* **Firebase reads/writes**: every Firestore query must abide strictly by the field rules defined in `firestore.rules`.
* **Linting & hygiene**: run targeted ESLint checks on changed files only (e.g. `npx eslint src/path/to/File.jsx`) prior to declaring a task complete.
