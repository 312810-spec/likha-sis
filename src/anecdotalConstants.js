// src/anecdotalConstants.js
// Option lists for Anecdotal Records. These live outside AnecdotalRecords.jsx
// because react-refresh requires a component file to export only components --
// exporting constants alongside the component breaks Fast Refresh.

export const ANECDOTAL_INCIDENT_TYPES = [
  "Behavioral / Conduct",
  "Academic Observation",
  "Guidance & Counseling",
  "Attendance & Punctuality",
  "Peer / Social Interaction",
  "Health & Well-being",
  "Commendation / Positive Note",
  "Other",
];

export const ANECDOTAL_STATUS_OPTIONS = [
  "Open / Under Observation",
  "In Progress / Counseling",
  "Resolved",
  "Referred to Guidance",
];
