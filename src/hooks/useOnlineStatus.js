// src/hooks/useOnlineStatus.js
// Tracks whether the browser currently has a network connection.
// Listens to the native 'online' and 'offline' window events so the UI
// can react in real time when the user loses or regains connectivity.

import { useState, useEffect } from "react";

/**
 * Returns { isOnline } — true when the browser reports a network connection,
 * false when it is offline. Updates immediately as connectivity changes.
 */
export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(() => navigator.onLine);

  useEffect(() => {
    function handleOnline() {
      setIsOnline(true);
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  return { isOnline };
}

export default useOnlineStatus;
