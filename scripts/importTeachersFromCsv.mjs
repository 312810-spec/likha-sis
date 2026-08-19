// One-off bulk importer: reads the DepEd Teacher & Staff Onboarding Form CSV
// in public/ and creates a LIKHA-SIS Auth + Firestore users/{uid} doc for
// each row. Default password is LastName + Employee/DepEd ID Number, e.g.
// "Caluya6113070" -- teachers should change it on first login.
//
// Usage (run from the repo root):
//   ICT_ADMIN_EMAIL=you@school.example ICT_ADMIN_PASSWORD=yourpassword node scripts/importTeachersFromCsv.mjs
//
// Requires an existing ictCoordinator or principal account to sign in as,
// because firestore.rules only allows writing other users' docs to that role.
// Auth account creation happens on a secondary app instance so the admin's
// own session is untouched (same pattern as src/firebaseAdmin.js).

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(
  __dirname,
  "..",
  "public",
  "DepEd Teacher & Staff Onboarding Form  (Responses) - Form Responses 1.csv"
);

const firebaseConfig = {
  apiKey: "AIzaSyD5LkbygXnyMI2w0r7Cs9cwB9-VjMjlh-0",
  authDomain: "likha-sis.firebaseapp.com",
  projectId: "likha-sis",
  storageBucket: "likha-sis.firebasestorage.app",
  messagingSenderId: "116245880464",
  appId: "1:116245880464:web:8250e26f283e58e4064215",
};

const adminEmail = process.env.ICT_ADMIN_EMAIL;
const adminPassword = process.env.ICT_ADMIN_PASSWORD;
if (!adminEmail || !adminPassword) {
  console.error(
    "Set ICT_ADMIN_EMAIL and ICT_ADMIN_PASSWORD env vars to an existing ictCoordinator/principal account before running this script."
  );
  process.exit(1);
}

const mainApp = initializeApp(firebaseConfig, "importMain");
const mainAuth = getAuth(mainApp);
const db = getFirestore(mainApp);

const secondaryApp = initializeApp(firebaseConfig, "importSecondary");
const secondaryAuth = getAuth(secondaryApp);

// Minimal CSV parser: handles quoted fields with embedded commas/newlines.
function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c === "\r") {
      // skip
    } else {
      field += c;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function mapRoles(roleText) {
  const lower = roleText.toLowerCase();
  const roles = [];
  if (lower.includes("adviser")) roles.push("adviser");
  if (lower.includes("subject teacher")) roles.push("subjectTeacher");
  if (roles.length === 0) roles.push("subjectTeacher");
  return roles;
}

async function main() {
  const csvText = readFileSync(CSV_PATH, "utf-8");
  const rows = parseCsv(csvText);
  const [header, ...dataRows] = rows;
  const col = (name) => header.indexOf(name);

  const idx = {
    lastName: col("Last Name"),
    firstName: col("First Name"),
    middleName: col("Middle Name"),
    email: col("DepEd Email Address"),
    roles: col("Role(s)"),
    empId: col("Employee / Deped ID Number"),
    position: col("Official Position . Designation"),
  };

  await signInWithEmailAndPassword(mainAuth, adminEmail, adminPassword);
  console.log(`Signed in as ${adminEmail}. Importing ${dataRows.length} rows...`);

  const results = [];
  for (const r of dataRows) {
    if (r.every((f) => !f || !f.trim())) continue;
    const lastName = (r[idx.lastName] || "").trim();
    const firstName = (r[idx.firstName] || "").trim();
    const middleName = (r[idx.middleName] || "").trim();
    const email = (r[idx.email] || "").trim();
    const roleText = (r[idx.roles] || "").trim();
    const empId = (r[idx.empId] || "").trim();
    const position = (r[idx.position] || "").trim();

    if (!lastName || !email || !empId) {
      results.push({ email: email || "(missing)", status: "skipped: missing required field" });
      continue;
    }

    const fullName = [firstName, middleName && middleName !== "N/A" ? middleName : "", lastName]
      .filter(Boolean)
      .join(" ");
    const password = `${lastName.replace(/\s+/g, "")}${empId}`;
    const roles = mapRoles(roleText);

    try {
      const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password);
      const uid = cred.user.uid;
      await signOut(secondaryAuth);

      await setDoc(doc(db, "users", uid), {
        fullName,
        email,
        roles,
        assignments: [],
        employeeNumber: empId,
        position,
        createdAt: serverTimestamp(),
        createdByEmail: adminEmail,
      });

      results.push({ email, status: "created", password });
    } catch (err) {
      await signOut(secondaryAuth).catch(() => {});
      results.push({ email, status: `failed: ${err.code || err.message}` });
    }
  }

  console.log("\n--- Import summary ---");
  for (const r of results) {
    console.log(
      r.status === "created"
        ? `OK    ${r.email}  (temp password: ${r.password})`
        : `SKIP  ${r.email}  -- ${r.status}`
    );
  }
  const created = results.filter((r) => r.status === "created").length;
  console.log(`\n${created}/${results.length} accounts created.`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("Import failed:", err);
    process.exit(1);
  });
