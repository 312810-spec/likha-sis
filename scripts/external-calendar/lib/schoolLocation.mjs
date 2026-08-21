// scripts/external-calendar/lib/schoolLocation.mjs
// Maps a school's configured DepEd administrative region (settings/schoolConfig.region,
// e.g. "Region VII") to the matching PAGASA Regional Services Division (PRSD)
// page, so regional rainfall/thunderstorm warnings can be filtered to what's
// actually relevant to the school. Generic by Philippine geography -- not
// tied to any specific school or city (spec section 11).
//
// PAGASA groups the whole country into 5 PRSDs. Slugs verified against the
// live site (pagasa.dost.gov.ph/regional-forecast/<slug>) while building
// this: ncrprsd, nlprsd, slprsd, visprsd, minprsd.

const REGION_TO_PRSD = {
  ncr: { slug: "ncrprsd", label: "National Capital Region" },
  car: { slug: "nlprsd", label: "Northern Luzon" },
  "region i": { slug: "nlprsd", label: "Northern Luzon" },
  "region ii": { slug: "nlprsd", label: "Northern Luzon" },
  "region iii": { slug: "nlprsd", label: "Northern Luzon" },
  "region iv-a": { slug: "slprsd", label: "Southern Luzon" },
  calabarzon: { slug: "slprsd", label: "Southern Luzon" },
  "region iv-b": { slug: "slprsd", label: "Southern Luzon" },
  mimaropa: { slug: "slprsd", label: "Southern Luzon" },
  "region v": { slug: "slprsd", label: "Southern Luzon" },
  bicol: { slug: "slprsd", label: "Southern Luzon" },
  "region vi": { slug: "visprsd", label: "Visayas" },
  "region vii": { slug: "visprsd", label: "Visayas" },
  "region viii": { slug: "visprsd", label: "Visayas" },
  "region ix": { slug: "minprsd", label: "Mindanao" },
  "region x": { slug: "minprsd", label: "Mindanao" },
  "region xi": { slug: "minprsd", label: "Mindanao" },
  "region xii": { slug: "minprsd", label: "Mindanao" },
  "region xiii": { slug: "minprsd", label: "Mindanao" },
  caraga: { slug: "minprsd", label: "Mindanao" },
  barmm: { slug: "minprsd", label: "Mindanao" },
};

function normalize(value) {
  return String(value || "").trim().toLowerCase();
}

/**
 * Resolves a school's configured region to a PAGASA PRSD slug. Returns
 * `matched: false` (rather than guessing) when the region text isn't
 * recognized, so callers can label an advisory as generically regional
 * instead of falsely implying it specifically affects the school.
 */
export function matchSchoolPrsd({ region, municipalityCityProvince } = {}) {
  const prsd = REGION_TO_PRSD[normalize(region)];
  if (!prsd) return { matched: false, prsdSlug: null, regionalLabel: "" };

  const place = municipalityCityProvince ? `, ${municipalityCityProvince}` : "";
  return { matched: true, prsdSlug: prsd.slug, regionalLabel: `${prsd.label}${place}` };
}
