# LIKHA-SIS — Autonomous Engineering Engine (Claude Code Pro Edition)

## 1. System Architecture & Constraints
* **Developer & Lead:** FranzShin (ICT Coordinator, Tingub National High School).
* **System:** LIKHA-SIS (Learner Information & Knowledge Hub Administrative System).
* **Tech Stack:** React + Vite, Tailwind CSS v3, Firebase (Auth + Firestore), `lucide-react`, `ColorThief`. Hosted on GitHub.
* **Single Source of Truth:** `https://github.com/312810-spec/likha-sis.git`.
* **Routing:** Single-page string state via `currentPage` in `App.jsx` (**STRICT: Do NOT use React Router**).
* **Dynamic Theming:** Screen-chrome dark/light/brand themes using `useDarkMode()` and `useBrandTheme()` hooks.
* **Media Print Boundaries:** Printable components (`ReportCard` / SF9, `CertificateGenerator`, `IDGenerator`) MUST maintain a strict pure white background during print/export (`@media print`).
* **External APIs:** QR generation uses `api.qrserver.com` (no heavy npm dependencies).

---

## 2. DepEd Domain Mandates (SY 2026–2027)
* **Calendar:** 3-Term System (`Term 1`, `Term 2`, `Term 3`) ONLY. Never use Q1–Q4 quarterly structures.
* **DO 15, s. 2026 (Grading):**
  * Components: WW (Written/Oral Works), PT (Product/Performance Tasks), EX (Examinations).
  * EX Internal Split: ST1 (30%), ST2 (30%), TE (40%). Omitted for Grades 1–3 transition subjects.
  * Weights (WW/PT/EX): Core = 20/50/30; EPP-TLE/MAPEH = 20/60/20; Tech-Pro/Immersion = 20/80/0 or 15/65/20.
  * Scale: Raw -> Weighted -> Initial Grade (IG) -> SY 2026–2027 Transmutation Table. Zero-based grading begins SY 2027–2028.
* **DO 006, s. 2026 (Safe Learning Environment / LRP):**
  * 3-Tier Behavioral Classifications: Level 1 (Minor/Disruptive), Level 2 (Serious/Stalking/Slight Injury), Level 3 (Severe/Gang/Cheating/Drugs).
  * Integrated into LARDO Tracking. Restricted to `smeaCoordinator`, `principal`, and `guidance` roles.
* **DO 017, s. 2026 (Strengthened SHS):**
  * 2-Track Model: Academic Track vs. Tech-Pro Track (10 Elective Clusters).
  * Subject Mapping: 5 Mandatory Core subjects in Grade 11 + Stackable/Cross-Track Electives.

---

## 3. PROMPT ENGINEERING DIRECTIVES (Claude Code CLI Execution)
* **Direct Execution:** Do NOT generate copy-paste text prompts or delegate tasks to external agents (Cline/Antigravity/Copilot). Perform all file editing, code generation, refactoring, and wiring directly in the repo.
* **High-Density Output:** Deliver conciseness in terminal responses. Prioritize execution output, command results, and code diffs over explanations unless specifically asked.
* **Structural Integration:** Ensure every new component follows the existing pattern:
  1. Built as a self-contained component in `src/`.
  2. Wired into `App.jsx` under `currentPage === 'moduleName'`.
  3. Added to `Sidebar.jsx` navigation guarded by `pageAccess.js` roles.
  4. Explicit collection permissions declared in `firestore.rules`.

---

## 4. LOOP ENGINEERING (Self-Correcting Execution Engine)
Claude Code MUST execute the following continuous self-correcting loops during every interaction:

1. **Repo Verification Loop:** Read repository state and run test baseline before making modifications.
2. **Implementation-to-Verification Loop:** After modifying code, run `npm run lint && npm run test` automatically in the terminal.
3. **Auto-Refactor Loop:** If `npm run lint` or `npm run test` fails, inspect terminal error outputs, fix the code immediately, and re-run tests until 100% pass rate is achieved.
4. **Data-Safety Loop:** Whenever a new Firestore collection is referenced, automatically inspect and append the security rule definition in `firestore.rules`.
5. **Git Commit Discipline Loop:** Once tests and linting pass, stage changed files and create a structured Git commit (e.g., `feat(laro): add DO 006 discipline incident log`).
6. **Closed-Loop Business Logic Engine:**
   * Attendance < 80% (SF2) -> Auto-trigger LARDO flag.
   * Initial Grade < 70.00 (Class Record) -> Auto-trigger academic intervention flag.
   * 14-day post-intervention recovery (attendance or grades) -> Auto-resolve the LARDO risk flag.

---

## 5. GRAPH ENGINEERING (Component & Knowledge Dependency Graph)
Maintain strict adherence to the project's entity dependency graph when performing multi-file edits:

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


* **Dependency Traversal Rule:** When updating a core data schema (e.g., Learner or Class Record), automatically traverse and update dependent nodes:
  - Updates to `Class Record` MUST update `Consolidated Grades`, `SF9 Report Card`, and `SMEA Rollup`.
  - Updates to `Learner Profile` MUST update `SF1`, `SF2 Daily Attendance`, `SF8 BMI`, and `LARDO Tracking`.

---

## 6. Primary Terminal Commands
* **Build:** `npm run build`
* **Lint:** `npm run lint`
* **Test:** `npm run test`