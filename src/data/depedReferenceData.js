// src/data/depedReferenceData.js
// The official DepEd field-office hierarchy: regions and their Schools Division
// Offices (SDOs). Sourced from the DepEd Regional & Division Offices Directory
// (deped.gov.ph/contact-us/regional-division-offices-directory/) rather than
// written from memory, because a wrong division name silently corrupts every
// printed School Form the division heading appears on.
//
// NOTE: the Negros Island Region (NIR) was re-established as a separate region,
// so Region VI (Western Visayas) here does NOT contain Negros Occidental,
// Negros Oriental, or Siquijor -- those sit under NIR. Older lists that fold
// Negros back into Region VI are out of date.
//
// Districts and individual school names are deliberately NOT bundled. There are
// thousands of districts and roughly 60,000 schools, with no stable public
// machine-readable list; shipping a partial snapshot would present stale data as
// authoritative. Those two fields are type-ahead comboboxes instead, backed by a
// `referenceData/schoolDirectory` Firestore doc each school maintains itself.

export const DEPED_REGIONS = [
  { code: "NCR", name: "National Capital Region (NCR)" },
  { code: "CAR", name: "Cordillera Administrative Region (CAR)" },
  { code: "R1", name: "Region I (Ilocos Region)" },
  { code: "R2", name: "Region II (Cagayan Valley)" },
  { code: "R3", name: "Region III (Central Luzon)" },
  { code: "R4A", name: "Region IV-A (CALABARZON)" },
  { code: "MIMAROPA", name: "MIMAROPA Region" },
  { code: "R5", name: "Region V (Bicol Region)" },
  { code: "R6", name: "Region VI (Western Visayas)" },
  { code: "NIR", name: "Negros Island Region (NIR)" },
  { code: "R7", name: "Region VII (Central Visayas)" },
  { code: "R8", name: "Region VIII (Eastern Visayas)" },
  { code: "R9", name: "Region IX (Zamboanga Peninsula)" },
  { code: "R10", name: "Region X (Northern Mindanao)" },
  { code: "R11", name: "Region XI (Davao Region)" },
  { code: "R12", name: "Region XII (SOCCSKSARGEN)" },
  { code: "R13", name: "Region XIII (Caraga)" },
  { code: "BARMM", name: "Bangsamoro Autonomous Region in Muslim Mindanao (BARMM)" },
];

export const DEPED_DIVISIONS = {
  NCR: [
    "Caloocan City",
    "Las Piñas City",
    "Makati City",
    "Malabon City",
    "Mandaluyong City",
    "Manila",
    "Marikina City",
    "Muntinlupa City",
    "Navotas City",
    "Parañaque City",
    "Pasay City",
    "Pasig City",
    "Quezon City",
    "San Juan City",
    "Taguig City - Pateros",
    "Valenzuela City",
  ],
  CAR: [
    "Abra",
    "Apayao",
    "Baguio City",
    "Benguet",
    "Ifugao",
    "Kalinga",
    "Mt. Province",
    "Tabuk City",
  ],
  R1: [
    "Alaminos City",
    "Batac City",
    "Candon City",
    "Dagupan City",
    "Ilocos Norte",
    "Ilocos Sur",
    "La Union",
    "Laoag City",
    "Pangasinan I",
    "Pangasinan II",
    "San Carlos City",
    "San Fernando City",
    "Urdaneta City",
    "Vigan City",
  ],
  R2: [
    "Batanes",
    "Cagayan Province",
    "Cauayan City",
    "Ilagan City",
    "Isabela",
    "Nueva Vizcaya",
    "Quirino",
    "Santiago City",
    "Tuguegarao City",
  ],
  R3: [
    "Angeles City",
    "Aurora",
    "Balanga City",
    "Baliwag City",
    "Bataan",
    "Bulacan",
    "Cabanatuan City",
    "Gapan City",
    "Mabalacat City",
    "Malolos City",
    "Meycauayan City",
    "Nueva Ecija",
    "Olongapo City",
    "Pampanga",
    "San Fernando City",
    "San Jose City",
    "San Jose del Monte",
    "Science City of Muñoz",
    "Tarlac",
    "Tarlac City",
    "Zambales",
  ],
  R4A: [
    "Antipolo City",
    "Bacoor City",
    "Batangas",
    "Batangas City",
    "Biñan City",
    "Cabuyao City",
    "Calaca City",
    "Calamba City",
    "Cavite",
    "Cavite City",
    "Dasmariñas City",
    "General Trias City",
    "Imus City",
    "Laguna",
    "Lipa City",
    "Lucena City",
    "Quezon",
    "Rizal",
    "San Pablo City",
    "San Pedro City",
    "Sta. Rosa City",
    "Sto. Tomas City",
    "Tanauan City",
    "Tayabas City",
  ],
  MIMAROPA: [
    "Calapan City",
    "Marinduque",
    "Occidental Mindoro",
    "Oriental Mindoro",
    "Palawan",
    "Puerto Princesa City",
    "Romblon",
  ],
  R5: [
    "Albay",
    "Camarines Norte",
    "Camarines Sur",
    "Catanduanes",
    "Iriga City",
    "Legazpi City",
    "Ligao City",
    "Masbate",
    "Masbate City",
    "Naga City",
    "Sorsogon",
    "Sorsogon City",
    "Tabaco City",
  ],
  R6: [
    "Aklan",
    "Antique",
    "Capiz",
    "Guimaras",
    "Iloilo",
    "Iloilo City",
    "Passi City",
    "Roxas City",
  ],
  NIR: [
    "Bacolod City",
    "Bago City",
    "Bais City",
    "Bayawan City",
    "Cadiz City",
    "Canlaon City",
    "Dumaguete City",
    "Escalante City",
    "Guihulngan City",
    "Himamaylan City",
    "Kabankalan City",
    "La Carlota City",
    "Negros Occidental",
    "Negros Oriental",
    "Sagay City",
    "San Carlos City",
    "Silay City",
    "Sipalay City",
    "Siquijor",
    "Talisay City",
    "Tanjay City",
    "Victorias City",
  ],
  R7: [
    "Bogo City",
    "Bohol",
    "Carcar City",
    "Cebu",
    "Cebu City",
    "Danao City",
    "Lapu-Lapu City",
    "Mandaue City",
    "Naga City",
    "Tagbilaran City",
    "Talisay City",
    "Toledo City",
  ],
  R8: [
    "Baybay City",
    "Biliran",
    "Borongan City",
    "Calbayog City",
    "Catbalogan City",
    "Eastern Samar",
    "Leyte",
    "Maasin City",
    "Northern Samar",
    "Ormoc City",
    "Samar (Western)",
    "Southern Leyte",
    "Tacloban City",
  ],
  R9: [
    "Dapitan City",
    "Dipolog City",
    "Isabela City",
    "Pagadian City",
    "Zamboanga City",
    "Zamboanga del Norte",
    "Zamboanga del Sur",
    "Zamboanga Sibugay",
  ],
  R10: [
    "Bukidnon",
    "Cagayan de Oro City",
    "Camiguin",
    "El Salvador City",
    "Gingoog City",
    "Iligan City",
    "Lanao del Norte",
    "Malaybalay City",
    "Misamis Occidental",
    "Misamis Oriental",
    "Oroquieta City",
    "Ozamis City",
    "Tangub City",
    "Valencia City",
  ],
  R11: [
    "Davao City",
    "Davao de Oro",
    "Davao del Norte",
    "Davao del Sur",
    "Davao Occidental",
    "Davao Oriental",
    "Digos City",
    "Mati City",
    "Panabo City",
    "Samal City",
    "Tagum City",
  ],
  R12: [
    "Cotabato",
    "General Santos City",
    "Kidapawan City",
    "Koronadal City",
    "Sarangani",
    "South Cotabato",
    "Sultan Kudarat",
    "Tacurong City",
  ],
  R13: [
    "Agusan del Norte",
    "Agusan del Sur",
    "Bayugan City",
    "Bislig City",
    "Butuan City",
    "Cabadbaran City",
    "Dinagat Islands",
    "Siargao",
    "Surigao City",
    "Surigao del Norte",
    "Surigao del Sur",
    "Tandag City",
  ],
  BARMM: [
    "Basilan",
    "Cotabato City",
    "Lamitan City",
    "Lanao del Sur I",
    "Lanao del Sur II",
    "Maguindanao I",
    "Maguindanao II",
    "Marawi City",
    "Sulu",
    "Tawi-Tawi",
  ],
};

/**
 * Division names offered by a region. Returns [] for an unknown or empty code so
 * a <select> bound to this never crashes while the region field is still blank.
 */
export function getDivisionsForRegion(regionCode) {
  if (!regionCode) return [];
  return DEPED_DIVISIONS[regionCode] || [];
}

/**
 * The region entry a division belongs to, or null when the name isn't recognised.
 *
 * Several division names are genuinely reused across regions ("San Carlos City"
 * exists in both Region I and NIR; "Naga City" in both Region V and Region VII;
 * "Talisay City" in both NIR and Region VII). This returns the FIRST match in
 * DEPED_REGIONS order, so it is only safe as a convenience for pre-filling a
 * blank region from legacy free-text data -- never as an authoritative lookup.
 */
export function findRegionForDivision(divisionName) {
  if (!divisionName) return null;
  const needle = String(divisionName).trim().toLowerCase();
  for (const region of DEPED_REGIONS) {
    const match = getDivisionsForRegion(region.code).some(
      (d) => d.toLowerCase() === needle
    );
    if (match) return region;
  }
  return null;
}

/** Display name for a region code, falling back to the raw code. */
export function getRegionName(regionCode) {
  const region = DEPED_REGIONS.find((r) => r.code === regionCode);
  return region ? region.name : regionCode || "";
}
