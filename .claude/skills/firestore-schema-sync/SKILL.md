---
name: firestore-schema-sync
description: >-
  Implements the Data-Safety Loop from CLAUDE.md Section 4B.4: any new
  Firestore collection introduced in app code gets a matching security rule
  block in firestore.rules before the change is done, then deploys it. Use
  whenever code adds a new top-level Firestore collection, a new
  db.collection("...") call to a name not already covered in firestore.rules,
  or when asked to add/review Firestore security rules.
metadata:
  category: LIKHA-SIS Domain
---

# Firestore Schema-to-Rules Sync

`firestore.rules` is the only guard on a new collection — keep them in sync.

## Steps
1. Grep changed code for `collection(db, "...")` calls; cross-reference against `match /{collection}/{docId}` blocks in `firestore.rules`.
2. Reuse existing helpers (`isSignedIn()`, `myRoles()`, `hasAnyRole([...])`, `isSetupComplete()`) — don't duplicate. Follow the `learners` block's access-comment convention.
3. LARDO/behavioral collections: restrict to `smeaCoordinator`, `principal`, `guidance` only (see `lardo-safety-audit`).
4. Add the `match` block near related collections, with an access-rationale comment.
5. Deploy via Bash directly (see memory `firestore-rules-deploy`), Firestore-rules-scoped only.

## Report
Collection name, rule block added, deploy result (or verbatim error).
