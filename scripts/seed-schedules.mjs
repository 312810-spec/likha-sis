// scripts/seed-schedules.mjs
//
// One-time seeder for the Class Program & Teacher's Load generator.
//
// The generator reads its configuration from schedules/{schoolYear}. There is
// no Setup UI yet, so this script creates that configuration once so the
// feature can be opened and tested. Teacher records are built from the REAL
// users already enrolled in the system, so the roster matches production
// rather than inventing staff.
//
// Usage (PowerShell):
//   $env:LIKHA_EMAIL="you@example.com"; $env:LIKHA_PASSWORD="..."; node scripts/seed-schedules.mjs
//
// Usage (bash):
//   LIKHA_EMAIL=you@example.com LIKHA_PASSWORD=... node scripts/seed-schedules.mjs
//
// The account must hold the ictCoordinator or principal role -- firestore.rules
// allows writes to schedules/** for those two roles only.
//
// Safe to re-run: the shift configuration is merged, and existing sections are
// left alone unless you pass --overwrite-sections (which would discard any
// timetable already painted in the builder).

import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyD5LkbygXnyMI2w0r7Cs9cwB9-VjMjlh-0",
  authDomain: "likha-sis.firebaseapp.com",
  projectId: "likha-sis",
  storageBucket: "likha-sis.firebasestorage.app",
  messagingSenderId: "116245880464",
  appId: "1:116245880464:web:8250e26f283e58e4064215",
};

const SCHOOL_YEAR = process.env.LIKHA_SCHOOL_YEAR || "2026-2027";
const OVERWRITE_SECTIONS = process.argv.includes("--overwrite-sections");

// ---------------------------------------------------------------------------
// EDIT ME: the bell schedule. This mirrors the shift in the reference
// Class Program -- 6:00 start, 40-minute periods, 8 periods a day, with the
// fixed blocks in their declared positions. afterPeriod: 0 places a block
// before period 1; afterPeriod equal to periodsPerDay places it after the last.
// ---------------------------------------------------------------------------
const SHIFTS = [
  {
    id: "AM",
    label: "Morning",
    startTime: "6:00",
    periodDuration: 40,
    periodsPerDay: 8,
    fixedBlocks: [
      {
        afterPeriod: 0,
        label: "Flag Ceremony",
        labelByDay: {
          tue: "Environmental Sanitation",
          wed: "Environmental Sanitation",
          thu: "Environmental Sanitation",
          fri: "Environmental Sanitation",
        },
        duration: 10,
      },
      { afterPeriod: 4, label: "Health Break", duration: 10 },
      {
        afterPeriod: 8,
        label: "Aral Program",
        labelByDay: { fri: "HGP" },
        duration: 40,
      },
      { afterPeriod: 8, label: "Environmental Sanitation", duration: 10 },
    ],
  },
];

// ---------------------------------------------------------------------------
// EDIT ME: sections. Cells are left empty on purpose -- open the Builder tab,
// press "Seed from sessions per week", then drag or click to adjust. Set
// adviserId to a real teacher id (which is the user's uid) once you know it;
// the script prints the available ids at the end.
// ---------------------------------------------------------------------------
const SECTIONS = [
  { id: "g7-faith", gradeLevel: "7", name: "FAITH", shiftId: "AM" },
  { id: "g7-hope", gradeLevel: "7", name: "HOPE", shiftId: "AM" },
  { id: "g7-love", gradeLevel: "7", name: "LOVE", shiftId: "AM" },
  { id: "g8-charity", gradeLevel: "8", name: "CHARITY", shiftId: "AM" },
  { id: "g8-joy", gradeLevel: "8", name: "JOY", shiftId: "AM" },
  { id: "g9-peace", gradeLevel: "9", name: "PEACE", shiftId: "AM" },
  { id: "g10-compassion", gradeLevel: "10", name: "COMPASSION", shiftId: "AM" },
];

// Subjects declared per grade level, with the meetings-per-week the DepEd
// loading-minutes rule counts. teacherId is left blank -- assign in the builder,
// or fill these in once you know the ids printed at the end.
const SUBJECTS_BY_GRADE = {
  7: ["Filipino 7", "English 7", "Math 7", "Science 7", "AP 7", "ESP 7", "TLE 7", "Mapeh 7"],
  8: ["Filipino 8", "English 8", "Math 8", "Science 8", "AP 8", "ESP 8", "TLE 8", "Mapeh 8"],
  9: ["Filipino 9", "English 9", "Math 9", "Science 9", "AP 9", "ESP 9", "TLE 9", "Mapeh 9"],
  10: ["Filipino 10", "English 10", "Math 10", "Science 10", "AP 10", "ESP 10", "TLE 10", "Mapeh 10"],
};

const SIGNATORIES = {
  checkedByName: "",
  checkedByTitle: "Master Teacher I",
  approvedByName: "",
  approvedByTitle: "Principal II",
};

function subjectsFor(gradeLevel) {
  const names = SUBJECTS_BY_GRADE[gradeLevel] || [];
  return names.map((subject) => ({
    subject,
    teacherId: "",
    sessionsPerWeek: 5,
  }));
}

// A user counts as teaching staff if they hold any teaching-ish role or carry
// subject assignments. Kept permissive on purpose -- an extra name in the
// palette is harmless, a missing one blocks assignment.
const TEACHER_ROLES = [
  "adviser",
  "subjectTeacher",
  "masterTeacher",
  "teacher",
  "ictCoordinator",
  "principal",
];

function isTeachingStaff(user) {
  const roles = Array.isArray(user.roles) ? user.roles : [];
  if (roles.some((r) => TEACHER_ROLES.includes(r))) return true;
  return Array.isArray(user.assignments) && user.assignments.length > 0;
}

function handlesFor(user) {
  const assignments = Array.isArray(user.assignments) ? user.assignments : [];
  return [
    ...new Set(
      assignments
        .filter((a) => a && a.role === "subjectTeacher" && a.subject)
        .map((a) => a.subject)
    ),
  ];
}

async function main() {
  const email = process.env.LIKHA_EMAIL;
  const password = process.env.LIKHA_PASSWORD;

  if (!email || !password) {
    console.error(
      "Set LIKHA_EMAIL and LIKHA_PASSWORD to an ictCoordinator or principal account.\n" +
        "See the usage comment at the top of this file."
    );
    process.exit(1);
  }

  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log(`Signing in as ${email} ...`);
  await signInWithEmailAndPassword(auth, email, password);

  const base = doc(db, "schedules", SCHOOL_YEAR);

  // 1. Shift configuration.
  const existingConfig = await getDoc(base);
  await setDoc(
    base,
    {
      schoolYear: SCHOOL_YEAR,
      shifts: SHIFTS,
      signatories: {
        ...SIGNATORIES,
        ...((existingConfig.exists() && existingConfig.data().signatories) || {}),
      },
    },
    { merge: true }
  );
  console.log(
    `${existingConfig.exists() ? "Updated" : "Created"} schedules/${SCHOOL_YEAR} ` +
      `(${SHIFTS.length} shift(s), ${SHIFTS[0].periodsPerDay} periods/day)`
  );

  // 2. Teacher records, built from the real enrolled users.
  const userSnap = await getDocs(collection(db, "users"));
  const staff = userSnap.docs
    .map((d) => ({ id: d.id, ...d.data() }))
    .filter(isTeachingStaff);

  if (staff.length === 0) {
    console.warn(
      "No teaching staff found in users/. The palette will be empty -- check that " +
        "accounts carry a teaching role or subject assignments."
    );
  }

  for (const user of staff) {
    const teacherRef = doc(db, "schedules", SCHOOL_YEAR, "teachers", user.id);
    const existing = await getDoc(teacherRef);

    // Convention: the teacher doc id IS the user id. userId is stored too, as a
    // redundant copy, because some readers key on it.
    const payload = {
      userId: user.id,
      source: "user",
      displayName: user.fullName || user.email || user.id,
      handles: handlesFor(user),
      designations: [],
      // Ancillary designations carry real weekly minutes under the DepEd
      // loading-minutes rule even though they occupy no cell on a class
      // program. Add entries here, e.g.
      //   { label: "MAPEH Coordinator", meetingsPerWeek: 5, minutesPerMeeting: 40 }
      ancillaryLoad: [],
      bio: {
        course: "",
        ma: "",
        eligibility: "",
        firstDayOfService: "",
        yearsInDepEd: null,
      },
      dutySlots: {},
    };

    // Never clobber a record someone has already filled in.
    if (existing.exists()) {
      const prev = existing.data();
      await setDoc(
        teacherRef,
        {
          ...payload,
          handles: prev.handles && prev.handles.length ? prev.handles : payload.handles,
          designations: prev.designations || payload.designations,
          ancillaryLoad: prev.ancillaryLoad || payload.ancillaryLoad,
          bio: { ...payload.bio, ...(prev.bio || {}) },
          dutySlots: prev.dutySlots || {},
        },
        { merge: true }
      );
    } else {
      await setDoc(teacherRef, payload);
    }
  }
  console.log(`Seeded ${staff.length} teacher record(s) from enrolled users.`);

  // 3. Sections.
  let created = 0;
  let skipped = 0;
  for (const section of SECTIONS) {
    const ref = doc(db, "schedules", SCHOOL_YEAR, "sections", section.id);
    const existing = await getDoc(ref);

    if (existing.exists() && !OVERWRITE_SECTIONS) {
      skipped += 1;
      continue;
    }

    await setDoc(ref, {
      gradeLevel: section.gradeLevel,
      name: section.name,
      shiftId: section.shiftId,
      adviserId: "",
      subjects: subjectsFor(section.gradeLevel),
      cells: {},
    });
    created += 1;
  }
  console.log(
    `Sections: ${created} written, ${skipped} left alone` +
      (skipped > 0 ? " (pass --overwrite-sections to replace them)" : "")
  );

  console.log("\nTeacher ids (use these for adviserId / subjects[].teacherId):");
  for (const user of staff) {
    console.log(`  ${user.id}  ${user.fullName || user.email || ""}`);
  }

  console.log(
    `\nDone. Open the app, sign in, and go to "Class Program & Load".\n` +
      `In the Builder tab pick a section, press "Seed from sessions per week",\n` +
      `then adjust cells and Save.`
  );
  process.exit(0);
}

main().catch((err) => {
  console.error("\nSeeding failed:", err && err.message ? err.message : err);
  if (err && err.code === "permission-denied") {
    console.error(
      "The signed-in account needs the ictCoordinator or principal role " +
        "(firestore.rules restricts writes to schedules/**)."
    );
  }
  process.exit(1);
});
