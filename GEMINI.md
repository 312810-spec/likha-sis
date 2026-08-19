# Project Context & Rules

## Core Architecture
- Stack: React + Vite, Firestore, Firebase Auth, Vitest.
- Importers: `src/importers/` (SF1, SF10 XLSX parsers).
- Utils: `src/utils/` (grade computations, nutrition, SMEA, SF4, SF10, transmutation, LARDO, settings lock).
- Hooks: `src/hooks/` (useUserProfile, useDarkMode, useBrandTheme, useSchoolConfig, useAvailableSections, useOnlineStatus).
- Components: `src/components/` (DashboardShell, Sidebar, SF1PrintView, SyncStatusBanner).
- Pages: `src/pages/` (ImportCenter, SF1Importer, SF10Importer, UserManagement, ParentPortal, ParentLogin).
- Agent Rules: Check `.agents/rules/` for schema and QA guidelines.

## Implementation Status (as of Phase 6 Audit — August 19, 2026)
All core modules are production-ready and regression-tested (382/382 tests passing):

### School Forms
- **SF1** — Learner entry, edit, delete, view, grade/section filter, print view
- **SF2** — Daily attendance grid
- **SF4** — Monthly learner movement report
- **SF9** — Report card
- **SF10** — Permanent record generator + XLSX importer
- **SF8-style** — Nutrition status consolidator

### Academic & Grading
- Class Record (ECR), Consolidated Grades, Transmutation Table
- SHS subject weights, key stages config, grade computations
- 3-term academic calendar (`academicCalendar.js`, configurable)

### SMEA & Monitoring
- SMEA Enrollment report (3-term, auto-derived from SF1)
- LARDO Tracking (discipline/intervention records)
- Nutrition Status (BMI-for-Age, HFA with WHO z-score tables)
- Anecdotal Records
- Transfers Log

### System & Admin
- User Management with full RBAC (adviser, subjectTeacher, principal, masterTeacher, smeaCoordinator, ictCoordinator, guidance, stakeholder)
- Role-based page access (`pageAccess.js`)
- Settings Lock (school year lock, branding lock)
- School Settings + Setup Wizard
- Account Settings, Dark Mode, Branding / Theme Engine
- Import Center (SF1 + SF10 bulk XLSX import)
- Certificate Generator, ID Generator

### PWA & Connectivity
- PWA manifest + service worker (vite-plugin-pwa)
- Offline-aware SyncStatusBanner (useOnlineStatus hook)
- Firestore offline persistence enabled in `firebase.js`

### Parent Portal
- ParentLogin (separate login flow)
- ParentPortal (read-only, linked learners via `parentLinks/{uid}`)
- `PARENT_ONLY_ROLES` guard in App.jsx prevents staff-page access

## Active Specs (Read on-demand only)
- SF10 Generation: `docs/superpowers/specs/2026-08-16-sf10-generation-design.md`
- SF8 Nutrition: `docs/superpowers/specs/2026-08-16-sf8-nutrition-consolidator-design.md`

## Token Savings & Workflow Constraints
- Never scan `node_modules`, `dist`, or full build output.
- Run targeted tests only (e.g., `npm test -- --reporter=verbose src/__tests__/smeaEnrollment.test.js`) instead of full suites.
- Ask before modifying core Firestore batch logic or writing more than 3 files at once.
- Do NOT rewrite working components unless fixing a specific failing test.