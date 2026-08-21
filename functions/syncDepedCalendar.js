// functions/syncDepedCalendar.js
// Runs daily. Fetches DepEd's published official School Calendar page and
// upserts parsed events into depedCalendarEvents. This collection is
// supplementary/informational only -- it never overrides the Term 1/2/3
// boundaries owned by settings/schoolConfig (academicCalendar.js).

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore } from "firebase-admin/firestore";
import { parseDepedCalendarHtml } from "./depedCalendarParser.js";

const DEPED_CALENDAR_URL = "https://www.deped.gov.ph/school-calendar/";

function stableId(title, startDate) {
  // Simple deterministic key so re-runs upsert instead of duplicating.
  return `${startDate}-${title}`.toLowerCase().replace(/[^a-z0-9-]+/g, "-").slice(0, 200);
}

export const syncDepedCalendar = onSchedule(
  { schedule: "every 24 hours", region: "asia-southeast1", timeoutSeconds: 60 },
  async () => {
    const db = getFirestore();
    const collection = db.collection("depedCalendarEvents");

    let html;
    try {
      const response = await fetch(DEPED_CALENDAR_URL);
      if (!response.ok) {
        console.warn(`DepEd calendar fetch failed: ${response.status}`);
        return;
      }
      html = await response.text();
    } catch (error) {
      console.error("Failed to fetch DepEd calendar page:", error);
      return;
    }

    const events = parseDepedCalendarHtml(html);
    if (events.length === 0) {
      console.warn("DepEd calendar parser found zero events -- page structure may have changed.");
      return;
    }

    const batch = db.batch();
    for (const event of events) {
      const ref = collection.doc(stableId(event.title, event.startDate));
      batch.set(ref, {
        ...event,
        sourceDoLink: DEPED_CALENDAR_URL,
        updatedAt: new Date().toISOString(),
      });
    }
    await batch.commit();
  }
);
