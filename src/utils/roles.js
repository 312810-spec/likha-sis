// src/utils/roles.js
// The canonical list of LIKHA-SIS user roles and their display labels.
// Shared by UserManagement.jsx (creating/assigning roles), AccountSettings.jsx
// (showing your own role), and DashboardShell.jsx (profile dropdown label).

export const ROLE_OPTIONS = [
  { id: "principal", label: "Principal" },
  { id: "masterTeacher", label: "Master Teacher" },
  { id: "adviser", label: "Adviser" },
  { id: "subjectTeacher", label: "Subject Teacher" },
  { id: "stakeholder", label: "Stakeholder" },
  { id: "ictCoordinator", label: "ICT Coordinator" },
  { id: "smeaCoordinator", label: "SMEA Coordinator" },
  { id: "guidance", label: "Guidance Counselor" },
];

export const ROLE_LABELS = ROLE_OPTIONS.reduce((acc, r) => {
  acc[r.id] = r.label;
  return acc;
}, {});
