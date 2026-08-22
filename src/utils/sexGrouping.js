// src/utils/sexGrouping.js
// Shared Male/Female roster grouping, matching the pattern SF1.jsx and
// SF2.jsx already use (their own local sexLetter() helpers) -- extracted
// here so new multi-learner roster screens (Class Record, Consolidated
// Grades) reuse one implementation instead of adding a third/fourth copy.
// The importer stores sex as "Male"/"Female"; this normalizes to "M"/"F".

export function sexLetter(sex) {
  const s = String(sex || "").trim().toUpperCase();
  if (s.startsWith("M")) return "M";
  if (s.startsWith("F")) return "F";
  return "";
}

// Splits an already-sorted learner list into Male / Female / Unresolved
// groups, preserving each group's relative order (so a list sorted
// alphabetically beforehand stays alphabetical within each group).
export function groupLearnersBySex(learners) {
  const list = Array.isArray(learners) ? learners : [];
  const male = [];
  const female = [];
  const unresolved = [];
  list.forEach((learner) => {
    const letter = sexLetter(learner?.sex);
    if (letter === "M") male.push(learner);
    else if (letter === "F") female.push(learner);
    else unresolved.push(learner);
  });
  return { male, female, unresolved };
}
