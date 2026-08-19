// src/components/SyncStatusBanner.jsx
// Shows a non-intrusive banner when the browser is offline.
// Uses the useOnlineStatus hook to detect connectivity in real time.
// Auto-dismisses when the connection is restored.

import { WifiOff, Wifi } from "lucide-react";
import { useOnlineStatus } from "../hooks/useOnlineStatus";
import { useState, useEffect, useRef } from "react";

export function SyncStatusBanner() {
  const { isOnline } = useOnlineStatus();
  // Show a brief "Back online" flash when connectivity is restored.
  const [showReconnected, setShowReconnected] = useState(false);
  // Track whether we were offline using a ref so we don't need setState in the
  // effect body, which can trigger cascading renders (react-hooks/set-state-in-effect).
  const wasPreviouslyOffline = useRef(false);

  useEffect(() => {
    if (!isOnline) {
      // Going offline: record it via ref, hide any "reconnected" flash.
      wasPreviouslyOffline.current = true;
    } else if (wasPreviouslyOffline.current) {
      // Coming back online: schedule the flash via setTimeout so the setState
      // call happens asynchronously and doesn't fire synchronously within the
      // effect body.
      wasPreviouslyOffline.current = false;
      const flashTimer = setTimeout(() => setShowReconnected(true), 0);
      const hideTimer = setTimeout(() => setShowReconnected(false), 3000);
      return () => {
        clearTimeout(flashTimer);
        clearTimeout(hideTimer);
      };
    }
  }, [isOnline]);

  if (isOnline && !showReconnected) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        padding: "8px 16px",
        fontSize: "13px",
        fontWeight: 600,
        letterSpacing: "0.01em",
        transition: "background-color 0.3s ease",
        backgroundColor: showReconnected ? "#166534" : "#92400e",
        color: "#ffffff",
        boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
        userSelect: "none",
      }}
    >
      {showReconnected ? (
        <>
          <Wifi size={15} aria-hidden />
          Back online — changes are syncing now.
        </>
      ) : (
        <>
          <WifiOff size={15} aria-hidden />
          You're offline. Changes are saved locally and will sync when you reconnect.
        </>
      )}
    </div>
  );
}

export default SyncStatusBanner;
