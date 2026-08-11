# LIKHA-SIS Project Graph

> Generated with `/graphify .` — visualizes the codebase's architecture.
> Renders in GitHub, VS Code (Mermaid Preview), Typora, Markdown, etc.

---

## 1. Component Hierarchy & Navigation Flow

```mermaid
flowchart TD
    HTML["📄 index.html"]
    MAIN["⚛️ main.jsx<br/><i>React entry — renders App</i>"]

    APP["🚦 App.jsx<br/><i>traffic controller</i>"]

    LOGIN["🔐 Login.jsx"]
    DASH["🏠 Dashboard.jsx"]
    SF1["📋 SF1.jsx"]
    VL["👀 ViewLearners.jsx"]
    CERT["🎓 CertificateGenerator.jsx"]
    EDIT["✏️ EditLearnerModal.jsx"]

    HTML --> MAIN --> APP

    APP -- "no user → <b>Login</b>" --> LOGIN
    APP -- "currentPage = dashboard → <b>menu</b>" --> DASH
    APP -- "currentPage = sf1" --> SF1
    APP -- "currentPage = viewLearners" --> VL
    APP -- "currentPage = certificates" --> CERT

    DASH -- "goToSF1" --> SF1
    DASH -- "goToViewLearners" --> VL
    DASH -- "goToCertificates" --> CERT

    SF1  -- "goBack" --> DASH
    VL   -- "goBack" --> DASH
    CERT -- "goBack" --> DASH
    VL   -- "edit learner" --> EDIT
```

## 2. Module Dependency Graph (imports)

```mermaid
flowchart LR
    MAIN["main.jsx"]
    APP["App.jsx"]
    LOGIN["Login.jsx"]
    DASH["Dashboard.jsx"]
    SF1["SF1.jsx"]
    VL["ViewLearners.jsx"]
    EDIT["EditLearnerModal.jsx"]
    CERT["CertificateGenerator.jsx"]
    FB["firebase.js<br/><i>exports: auth, db</i>"]
    CFG["schoolConfig.js"]

    MAIN --> APP
    APP --> LOGIN
    APP --> DASH
    APP --> SF1
    APP --> VL
    APP --> CERT
    VL --> EDIT

    LOGIN --> FB
    DASH --> FB
    SF1 --> FB
    VL --> FB
    EDIT --> FB
    CERT --> FB
    CERT --> CFG
```

## 3. Firestore Data Flow

```mermaid
flowchart LR
    subgraph UI["React UI"]
        SF1["SF1.jsx<br/>writes learners"]
        VL["ViewLearners.jsx<br/>reads / deletes"]
        EDIT["EditLearnerModal.jsx<br/>updates"]
        CERT["CertificateGenerator.jsx<br/>reads"]
    end

    FS[(🔥 Firestore<br/>collection: learners)]

    SF1 -- "addDoc · serverTimestamp" --> FS
    VL  -- "getDocs · deleteDoc" --> FS
    EDIT -- "doc · updateDoc" --> FS
    CERT -- "collection · getDocs" --> FS
```

**Legend — codebase at a glance**

| File | Role | Depends on |
|---|---|---|
| `main.jsx` | React entry, mounts `<App/>` | App |
| `App.jsx` | Auth gate + page router | firebase, Login, Dashboard, SF1, ViewLearners, CertificateGenerator |
| `Login.jsx` | Teacher email/password sign-in | firebase/auth |
| `Dashboard.jsx` | Menu hub; navigates to SF1 / ViewLearners / Certificates | firebase/auth |
| `SF1.jsx` | School Form 1 — saves learner info | firebase/firestore |
| `ViewLearners.jsx` | List, filter, delete-saved learners; opens edit modal | firebase/firestore, EditLearnerModal |
| `EditLearnerModal.jsx` | Inline edit of a learner document | firebase/firestore |
| `CertificateGenerator.jsx` | Certificate of Enrollment / Good Moral generator (print) | firebase/firestore, schoolConfig |
| `firebase.js` | Firebase init; exports `auth` + `db` | firebase/app, firebase/auth, firebase/firestore |
| `schoolConfig.js` | School/division/principal placeholder constants | — |

## 4. Text-Only Graph (no renderer needed)

```
                         index.html
                             │
                          main.jsx
                             │
                     ┌───────▼────────┐
                     │   App.jsx      │   ← auth gate + router
                     └───────┬────────┘
                             │
            ┌────────────────┼───────────────────┐
            │              currentPage            │
            ▼                ▼        ▼           ▼
        Login          Dashboard   SF1   ViewLearners
        (no user)     ────(user logged in)────
                         │    │     │
          goToSF1 ───────┘    │     │
          goToViewLearners ───┘     │
          goToCertificates ─────────┘   → CertificateGenerator
                                              │
                                     ViewLearners
                                              │
                                     EditLearnerModal
```