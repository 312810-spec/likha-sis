# LIKHA-SIS — Project Context & Engineering Guidelines

## 1. System Architecture & Constraints
- **Developer:** FranzShin (ICT Coordinator, Tingub National High School)
- **Tech Stack:** React + Vite, Tailwind CSS v3, Firebase (Auth + Firestore), lucide-react, ColorThief. Hosted on GitHub.
- **Routing:** Single-page string state via `currentPage` in `App.jsx` (**STRICT: Do NOT use React Router**).
- **Theming:** Dark/Light/Brand themes apply to screen chrome only (`useDarkMode`, `useBrandTheme`). Printable pages (`ReportCard` / SF9, `CertificateGenerator`, `IDGenerator`) MUST maintain a pure white background.
- **APIs:** QR generation uses `api.qrserver.com` (no heavy npm packages).

## 2. DepEd Domain Mandates (SY 2026–2027)
- **Calendar:** 3-Term System (`Term 1`, `Term 2`, `Term 3`) ONLY. Never use Q1–Q4 quarterly structures.
- **DO 15, s. 2026 (Grading):** 
  - Components: WW, PT, EX (EX splits: ST1 30%, ST2 30%, TE 40%).
  - Weights: Core = 20/50/30; EPP-TLE/MAPEH = 20/60/20; Tech-Pro/Immersion = 20/80/0 or 15/65/20.
  - Initial Grade (IG) uses the SY 2026–2027 Transmutation Table. Zero-based grading starts SY 2027–2028.
- **DO 006, s. 2026 (Safe Environment / LRP):** 
  - 3-tier behavioral classifications (Level 1: Minor, Level 2: Serious, Level 3: Severe) in LARDO tracking.
  - Restricted to `smeaCoordinator`, `principal`, and `guidance` roles.
- **DO 017, s. 2026 (Strengthened SHS):** 
  - 2-Track Model (Academic Track vs. Tech-Pro Track with 10 Elective Clusters).

## 3. Workflow, Verification & Commands
- **Primary Commands:**
  - Build: `npm run build`
  - Lint: `npm run lint`
  - Test: `npm run test`
- **Verification Rule:** Always run `npm run lint` and `npm run test` before finalizing any feature or git commit.
- **Firestore Rules:** Always update `firestore.rules` whenever introducing a new Firestore collection.

## 4. Multi-Agent & Token Optimization
- **Agent Roles:** Claude acts as PM/Architect. Implementation tasks are delegated to Cline or Antigravity.
- **Cline Formatting:** Output tasks in plain text inside a single code block with zero internal markdown formatting.
- **Antigravity Formatting:** Output tasks in structured markdown with explicit headers (`## Goal`, `## Files`, `## Steps`, `## Verification`).
- **Closed-Loop Engine:** Auto-resolve LARDO risk flags when 14-day post-intervention attendance or grades recover.