// src/utils/depedHierarchy.js
// Reference data and autofill utilities for DepEd Philippine Schools,
// Divisions, Districts, and Regions.
//
// NOTE: the Negros Island Region (NIR) was re-established as a separate
// region, so Region VI (Western Visayas) and Region VII (Central Visayas)
// here do NOT contain Negros Occidental, Negros Oriental, or Siquijor --
// those sit under "Negros Island Region". Older lists that fold Negros back
// into Region VI/VII are out of date and silently corrupt the division
// heading on every printed School Form.

export const DEPED_REGIONS = [
  "NCR",
  "CAR",
  "Region I",
  "Region II",
  "Region III",
  "Region IV-A",
  "MIMAROPA Region",
  "Region V",
  "Region VI",
  "Negros Island Region",
  "Region VII",
  "Region VIII",
  "Region IX",
  "Region X",
  "Region XI",
  "Region XII",
  "CARAGA",
  "BARMM",
];

export const DEPED_DIVISIONS = {
  "Region VII": [
    { name: "Division of Mandaue City", cityProvince: "Mandaue City, Cebu" },
    { name: "Division of Cebu City", cityProvince: "Cebu City, Cebu" },
    { name: "Division of Cebu Province", cityProvince: "Cebu" },
    { name: "Division of Lapu-Lapu City", cityProvince: "Lapu-Lapu City, Cebu" },
    { name: "Division of Talisay City", cityProvince: "Talisay City, Cebu" },
    { name: "Division of Toledo City", cityProvince: "Toledo City, Cebu" },
    { name: "Division of City of Naga", cityProvince: "City of Naga, Cebu" },
    { name: "Division of Bohol", cityProvince: "Tagbilaran City, Bohol" },
    { name: "Division of Tagbilaran City", cityProvince: "Tagbilaran City, Bohol" },
  ],
  "Negros Island Region": [
    { name: "Division of Negros Oriental", cityProvince: "Dumaguete City, Negros Oriental" },
    { name: "Division of Dumaguete City", cityProvince: "Dumaguete City, Negros Oriental" },
    { name: "Division of Bais City", cityProvince: "Bais City, Negros Oriental" },
    { name: "Division of Bayawan City", cityProvince: "Bayawan City, Negros Oriental" },
    { name: "Division of Canlaon City", cityProvince: "Canlaon City, Negros Oriental" },
    { name: "Division of Guihulngan City", cityProvince: "Guihulngan City, Negros Oriental" },
    { name: "Division of Tanjay City", cityProvince: "Tanjay City, Negros Oriental" },
    { name: "Division of Siquijor", cityProvince: "Siquijor" },
    { name: "Division of Negros Occidental", cityProvince: "Bacolod City, Negros Occidental" },
    { name: "Division of Bacolod City", cityProvince: "Bacolod City, Negros Occidental" },
    { name: "Division of Bago City", cityProvince: "Bago City, Negros Occidental" },
    { name: "Division of Cadiz City", cityProvince: "Cadiz City, Negros Occidental" },
    { name: "Division of Escalante City", cityProvince: "Escalante City, Negros Occidental" },
    { name: "Division of Himamaylan City", cityProvince: "Himamaylan City, Negros Occidental" },
    { name: "Division of Kabankalan City", cityProvince: "Kabankalan City, Negros Occidental" },
    { name: "Division of La Carlota City", cityProvince: "La Carlota City, Negros Occidental" },
    { name: "Division of Sagay City", cityProvince: "Sagay City, Negros Occidental" },
    { name: "Division of San Carlos City", cityProvince: "San Carlos City, Negros Occidental" },
    { name: "Division of Silay City", cityProvince: "Silay City, Negros Occidental" },
    { name: "Division of Sipalay City", cityProvince: "Sipalay City, Negros Occidental" },
    { name: "Division of Talisay City", cityProvince: "Talisay City, Negros Occidental" },
    { name: "Division of Victorias City", cityProvince: "Victorias City, Negros Occidental" },
  ],
  "Region VI": [
    { name: "Division of Aklan", cityProvince: "Aklan" },
    { name: "Division of Antique", cityProvince: "Antique" },
    { name: "Division of Capiz", cityProvince: "Capiz" },
    { name: "Division of Guimaras", cityProvince: "Guimaras" },
    { name: "Division of Iloilo", cityProvince: "Iloilo" },
    { name: "Division of Iloilo City", cityProvince: "Iloilo City, Iloilo" },
    { name: "Division of Passi City", cityProvince: "Passi City, Iloilo" },
    { name: "Division of Roxas City", cityProvince: "Roxas City, Capiz" },
  ],
  NCR: [
    { name: "Division of Manila", cityProvince: "Manila, Metro Manila" },
    { name: "Division of Quezon City", cityProvince: "Quezon City, Metro Manila" },
    { name: "Division of Caloocan", cityProvince: "Caloocan City, Metro Manila" },
    { name: "Division of Pasig City", cityProvince: "Pasig City, Metro Manila" },
    { name: "Division of Taguig City and Pateros", cityProvince: "Taguig City, Metro Manila" },
    { name: "Division of Valenzuela City", cityProvince: "Valenzuela City, Metro Manila" },
    { name: "Division of Paranaque City", cityProvince: "Paranaque City, Metro Manila" },
    { name: "Division of Makati City", cityProvince: "Makati City, Metro Manila" },
    { name: "Division of Las Pinas City", cityProvince: "Las Pinas City, Metro Manila" },
    { name: "Division of Pasay City", cityProvince: "Pasay City, Metro Manila" },
    { name: "Division of Malabon City", cityProvince: "Malabon City, Metro Manila" },
    { name: "Division of Marikina City", cityProvince: "Marikina City, Metro Manila" },
    { name: "Division of Muntinlupa City", cityProvince: "Muntinlupa City, Metro Manila" },
    { name: "Division of Mandaluyong City", cityProvince: "Mandaluyong City, Metro Manila" },
    { name: "Division of Navotas City", cityProvince: "Navotas City, Metro Manila" },
    { name: "Division of San Juan City", cityProvince: "San Juan City, Metro Manila" },
  ],
  "Region IV-A": [
    { name: "Division of Cavite", cityProvince: "Cavite" },
    { name: "Division of Laguna", cityProvince: "Laguna" },
    { name: "Division of Batangas", cityProvince: "Batangas" },
    { name: "Division of Rizal", cityProvince: "Rizal" },
    { name: "Division of Quezon", cityProvince: "Quezon" },
    { name: "Division of Antipolo City", cityProvince: "Antipolo City, Rizal" },
    { name: "Division of Bacoor City", cityProvince: "Bacoor City, Cavite" },
    { name: "Division of Batangas City", cityProvince: "Batangas City, Batangas" },
    { name: "Division of Binan City", cityProvince: "Binan City, Laguna" },
    { name: "Division of Cabuyao City", cityProvince: "Cabuyao City, Laguna" },
    { name: "Division of Calamba City", cityProvince: "Calamba City, Laguna" },
    { name: "Division of Dasmarinas City", cityProvince: "Dasmarinas City, Cavite" },
    { name: "Division of General Trias City", cityProvince: "General Trias City, Cavite" },
    { name: "Division of Imus City", cityProvince: "Imus City, Cavite" },
    { name: "Division of Lipa City", cityProvince: "Lipa City, Batangas" },
    { name: "Division of Lucena City", cityProvince: "Lucena City, Quezon" },
    { name: "Division of San Pablo City", cityProvince: "San Pablo City, Laguna" },
    { name: "Division of Santa Rosa City", cityProvince: "Santa Rosa City, Laguna" },
    { name: "Division of Tanauan City", cityProvince: "Tanauan City, Batangas" },
    { name: "Division of Tayabas City", cityProvince: "Tayabas City, Quezon" },
  ],
  "Region III": [
    { name: "Division of Bulacan", cityProvince: "Bulacan" },
    { name: "Division of Pampanga", cityProvince: "Pampanga" },
    { name: "Division of Nueva Ecija", cityProvince: "Nueva Ecija" },
    { name: "Division of Tarlac", cityProvince: "Tarlac" },
    { name: "Division of Bataan", cityProvince: "Bataan" },
    { name: "Division of Zambales", cityProvince: "Zambales" },
    { name: "Division of Aurora", cityProvince: "Aurora" },
    { name: "Division of Angeles City", cityProvince: "Angeles City, Pampanga" },
    { name: "Division of City of San Fernando", cityProvince: "San Fernando City, Pampanga" },
    { name: "Division of Olongapo City", cityProvince: "Olongapo City, Zambales" },
    { name: "Division of San Jose del Monte City", cityProvince: "San Jose del Monte City, Bulacan" },
    { name: "Division of Tarlac City", cityProvince: "Tarlac City, Tarlac" },
  ],
};

export const KNOWN_SCHOOLS = [
  {
    schoolName: "Tingub National High School",
    schoolId: "302975",
    region: "Region VII",
    divisionOffice: "Division of Mandaue City",
    district: "Mandaue City District III",
    municipalityCityProvince: "Mandaue City, Cebu",
    schoolAddress: "Tingub, Mandaue City, Cebu",
  },
  {
    schoolName: "Mandaue City Comprehensive National High School",
    schoolId: "302974",
    region: "Region VII",
    divisionOffice: "Division of Mandaue City",
    district: "Mandaue City District I",
    municipalityCityProvince: "Mandaue City, Cebu",
    schoolAddress: "Plaridel St., Centro, Mandaue City, Cebu",
  },
  {
    schoolName: "Subangdaku Technical-Vocational School",
    schoolId: "302976",
    region: "Region VII",
    divisionOffice: "Division of Mandaue City",
    district: "Mandaue City District II",
    municipalityCityProvince: "Mandaue City, Cebu",
    schoolAddress: "Subangdaku, Mandaue City, Cebu",
  },
  {
    schoolName: "Cebu City National Science High School",
    schoolId: "302981",
    region: "Region VII",
    divisionOffice: "Division of Cebu City",
    district: "South District 1",
    municipalityCityProvince: "Cebu City, Cebu",
    schoolAddress: "Salvador St., Labangon, Cebu City, Cebu",
  },
  {
    schoolName: "Abellana National School",
    schoolId: "302980",
    region: "Region VII",
    divisionOffice: "Division of Cebu City",
    district: "South District 2",
    municipalityCityProvince: "Cebu City, Cebu",
    schoolAddress: "Osmeña Blvd., Cebu City, Cebu",
  },
  {
    schoolName: "Ramon Magsaysay High School",
    schoolId: "300456",
    region: "NCR",
    divisionOffice: "Division of Manila",
    district: "District IV",
    municipalityCityProvince: "Manila, Metro Manila",
    schoolAddress: "Espana Blvd., Sampaloc, Manila",
  },
  {
    schoolName: "Quezon City Science High School",
    schoolId: "300501",
    region: "NCR",
    divisionOffice: "Division of Quezon City",
    district: "District I",
    municipalityCityProvince: "Quezon City, Metro Manila",
    schoolAddress: "Bago Bantay, Quezon City",
  },
];

/**
 * Derives the official DepEd division header from the divisionOffice string.
 * e.g. "Division of Mandaue City" -> "Department of Education - Division of Mandaue City"
 */
export function formatDivisionHeader(divisionOffice) {
  const trimmed = (divisionOffice || "").trim();
  if (!trimmed) return "Department of Education";
  if (trimmed.toLowerCase().startsWith("department of education")) {
    return trimmed;
  }
  return `Department of Education - ${trimmed}`;
}

/**
 * Finds all known divisions in a region, or across all regions if region is omitted.
 */
export function getDivisionsForRegion(region) {
  if (region && DEPED_DIVISIONS[region]) {
    return DEPED_DIVISIONS[region];
  }
  return Object.values(DEPED_DIVISIONS).flat();
}

/**
 * Looks up known presets by matching school name, division, or district.
 */
export function findSchoolPreset(query) {
  if (!query || typeof query !== "string") return null;
  const q = query.trim().toLowerCase();
  return (
    KNOWN_SCHOOLS.find(
      (s) =>
        s.schoolName.toLowerCase() === q ||
        s.schoolName.toLowerCase().includes(q) ||
        s.schoolId === q
    ) || null
  );
}

/**
 * Looks up region and municipality based on division office name.
 */
export function findDivisionInfo(divisionOffice) {
  if (!divisionOffice || typeof divisionOffice !== "string") return null;
  const divName = divisionOffice.trim().toLowerCase();
  for (const [region, divisions] of Object.entries(DEPED_DIVISIONS)) {
    const found = divisions.find(
      (d) => d.name.toLowerCase() === divName || d.name.toLowerCase().includes(divName)
    );
    if (found) {
      return { region, ...found };
    }
  }
  return null;
}

/**
 * Reactive autofill helper: Given current form data and a changed field/value,
 * auto-populates connected fields (School ID, Region, Division Office, District,
 * Municipality/City/Province, School Address).
 */
export function autofillSchoolData(currentData, field, value) {
  const next = { ...currentData, [field]: value };

  if (field === "schoolName" && value) {
    const preset = findSchoolPreset(value);
    if (preset) {
      next.schoolId = preset.schoolId || next.schoolId || "";
      next.region = preset.region || next.region || "";
      next.divisionOffice = preset.divisionOffice || next.divisionOffice || "";
      next.district = preset.district || next.district || "";
      next.municipalityCityProvince =
        preset.municipalityCityProvince || next.municipalityCityProvince || "";
      next.schoolAddress = preset.schoolAddress || next.schoolAddress || "";
    }
  } else if (field === "divisionOffice" && value) {
    const divInfo = findDivisionInfo(value);
    if (divInfo) {
      if (!next.region || next.region === "[Region]") {
        next.region = divInfo.region;
      }
      if (
        !next.municipalityCityProvince ||
        next.municipalityCityProvince.includes("[Municipality")
      ) {
        next.municipalityCityProvince = divInfo.cityProvince;
      }
    }
  } else if (field === "district" && value) {
    const lower = value.toLowerCase();
    if (lower.includes("mandaue")) {
      if (!next.divisionOffice) next.divisionOffice = "Division of Mandaue City";
      if (!next.region) next.region = "Region VII";
      if (!next.municipalityCityProvince) next.municipalityCityProvince = "Mandaue City, Cebu";
    } else if (lower.includes("cebu city")) {
      if (!next.divisionOffice) next.divisionOffice = "Division of Cebu City";
      if (!next.region) next.region = "Region VII";
      if (!next.municipalityCityProvince) next.municipalityCityProvince = "Cebu City, Cebu";
    }
  } else if (field === "region" && value) {
    const availableDivs = DEPED_DIVISIONS[value];
    if (availableDivs && availableDivs.length > 0 && !next.divisionOffice) {
      next.divisionOffice = availableDivs[0].name;
      next.municipalityCityProvince = availableDivs[0].cityProvince;
    }
  }

  return next;
}
