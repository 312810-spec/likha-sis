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
                 [ Automated Git Commit ]
```

### B. Active Loop Engineering Engine (Self-Correcting Execution)
1. **Repo Baseline Loop:** Inspect state and run test baseline before any modification.
2. **Implementation-to-Verification Loop:** Automatically run `npm run lint && npm run test` after making changes.
3. **Auto-Refactor Loop:** If linting or testing fails, parse error outputs, fix code immediately, and re-verify until a 100% pass rate is achieved.
4. **Data-Safety Loop:** Automatically append security definitions in `firestore.rules` for any new Firestore collection.
5. **Git Commit Loop:** Auto-stage and commit with conventional messages (`feat:`, `fix:`) upon passing tests.
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

---

## 5. Deployment Commands
```bash
git add CLAUDE.md
git commit -m "docs: update project memory and CLAUDE.md for Claude Code Pro and Sonnet 5"
git push origin master
```

---

## 6. Primary Terminal Commands
* **Build:** `npm run build`
* **Lint:** `npm run lint`
* **Test:** `npm run test`
