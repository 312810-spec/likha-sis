# LIKHA-SIS

**Learner Information & Knowledge Hub Administrative System** — a web-based school management PWA for Tingub National High School (Philippines), built to enter school data once and automatically generate the DepEd forms, reports, and records that depend on it.

## Stack

- React + Vite, Tailwind CSS
- Firebase (Authentication + Firestore, offline-first via `persistentLocalCache`)
- Single-page string-state routing in `App.jsx` (no React Router)
- `lucide-react` icons, `vite-plugin-pwa` for installability

## DepEd compliance

Built against current DepEd issuances for SY 2026–2027: DO 15 (grading), DO 006 (Safe Environment/LRP), DO 017 (Strengthened SHS), and the three-term academic calendar (Term 1–3, no legacy quarters). See `CLAUDE.md` for the full domain-mandate reference.

## Getting started

```bash
npm install
npm run dev      # start the dev server
npm run lint      # eslint
npm run test      # vitest
npm run build     # production build
```

A Firebase project is required — configure `src/firebase.js` with your project's credentials, then deploy `firestore.rules` (`firebase deploy --only firestore:rules`). On first run, the in-app Setup Wizard walks through School Identity, the School Settings key, and initial configuration.

## Project docs

- **`CLAUDE.md`** — architecture, domain mandates, and development conventions (read this first)
- **`LIKHA-SIS — Living Project Specification.md`** — the living spec: target users, data model, and phase-by-phase implementation status
- **`roadmap.md`** — current pending work, ranked by priority
