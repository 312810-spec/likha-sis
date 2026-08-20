// src/hooks/useNotifications.js
// Composes every school-wide signal into the three sections the notification
// bell renders: active alerts, recent announcements, and what's coming up.
//
// Every source degrades independently. A dead weather API, a blocked seismic
// feed, or a Firestore permission error drops only its own section — the bell
// must never be able to take the dashboard shell down with it.

import { useState, useEffect, useMemo, useCallback } from "react";
import { collection, onSnapshot, query, orderBy, limit } from "firebase/firestore";
import { db } from "../firebase";
import useLocalWeather from "./useLocalWeather.js";
import {
  deriveWeatherAlerts,
  fetchEarthquakeAlerts,
  announcementsToAlerts,
  mergeAlerts,
} from "../utils/hazardAlerts.js";
import { getRecentAnnouncements } from "../utils/announcements.js";
import { getUpcomingEntries } from "../utils/schoolCalendar.js";

export const LAST_SEEN_KEY = "likha.notifications.lastSeenAt";

function readLastSeen() {
  try {
    return Number(globalThis.localStorage?.getItem(LAST_SEEN_KEY)) || 0;
  } catch {
    return 0;
  }
}

function writeLastSeen(value) {
  try {
    globalThis.localStorage?.setItem(LAST_SEEN_KEY, String(value));
  } catch {
    // Private mode — the badge just won't persist across reloads.
  }
}

function docsToArray(snapshot) {
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export default function useNotifications() {
  const { weather, latitude, longitude } = useLocalWeather();
  const [announcements, setAnnouncements] = useState([]);
  const [schoolEvents, setSchoolEvents] = useState([]);
  const [quakeAlerts, setQuakeAlerts] = useState([]);
  const [lastSeenAt, setLastSeenAt] = useState(readLastSeen);

  useEffect(() => {
    const q = query(collection(db, "announcements"), orderBy("effectiveDate", "desc"), limit(50));
    const unsubscribe = onSnapshot(
      q,
      (snap) => setAnnouncements(docsToArray(snap)),
      () => setAnnouncements([])
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const q = query(collection(db, "schoolEvents"), orderBy("startDate", "desc"), limit(100));
    const unsubscribe = onSnapshot(
      q,
      (snap) => setSchoolEvents(docsToArray(snap)),
      () => setSchoolEvents([])
    );
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (latitude === null || longitude === null) return undefined;
    let cancelled = false;
    fetchEarthquakeAlerts(latitude, longitude).then((alerts) => {
      if (!cancelled) setQuakeAlerts(alerts);
    });
    return () => {
      cancelled = true;
    };
  }, [latitude, longitude]);

  const alerts = useMemo(
    () =>
      mergeAlerts(
        announcementsToAlerts(announcements),
        deriveWeatherAlerts(weather),
        quakeAlerts
      ),
    [announcements, weather, quakeAlerts]
  );

  const recentAnnouncements = useMemo(
    () => getRecentAnnouncements(announcements).slice(0, 6),
    [announcements]
  );

  const upcoming = useMemo(
    () => getUpcomingEntries({ schoolEvents, announcements, limit: 6 }, new Date(), 30),
    [schoolEvents, announcements]
  );

  // Unread counts only alerts and announcements. "Coming up" is a standing
  // list, not news — badging a holiday that has been on the calendar all year
  // would make the badge meaningless.
  const unreadCount = useMemo(() => {
    const isNew = (iso) => {
      const t = iso ? new Date(iso).getTime() : 0;
      return Number.isFinite(t) && t > lastSeenAt;
    };
    const newAlerts = alerts.filter((a) => isNew(a.issuedAt)).length;
    const newPosts = recentAnnouncements.filter((a) =>
      isNew(a.createdAt?.seconds ? a.createdAt.seconds * 1000 : a.effectiveDate)
    ).length;
    return newAlerts + newPosts;
  }, [alerts, recentAnnouncements, lastSeenAt]);

  const markAllSeen = useCallback(() => {
    const now = Date.now();
    writeLastSeen(now);
    setLastSeenAt(now);
  }, []);

  return {
    alerts,
    announcements: recentAnnouncements,
    upcoming,
    weather,
    unreadCount,
    markAllSeen,
    isEmpty: alerts.length === 0 && recentAnnouncements.length === 0 && upcoming.length === 0,
  };
}
