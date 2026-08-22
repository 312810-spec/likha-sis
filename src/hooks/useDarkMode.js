import { useEffect, useRef, useState } from 'react';

export const STORAGE_KEY = 'likha-sis-dark-mode';

export function readStoredMode() {
  if (typeof window === 'undefined') return 'system';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

// Single source of truth for the light/dark/system resolution rule. The
// pre-paint bootstrap in index.html can't import this (it runs before the
// module graph loads), so it duplicates this exact logic inline -- this
// export exists so that duplication can be tested for parity instead of
// trusted by inspection.
export function resolveIsDark(mode, systemIsDark) {
  return mode === 'dark' ? true : mode === 'light' ? false : systemIsDark;
}

export default function useDarkMode() {
  const [mode, setMode] = useState(() => readStoredMode());

  // track only the system preference in state; derive resolvedIsDark from mode + systemIsDark
  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const resolvedIsDark = resolveIsDark(mode, systemIsDark);

  const isFirstRun = useRef(true);

  // Persist the raw preference string when it changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, mode);
    } catch {
      // ignore
    }
  }, [mode]);

  // Subscribe to OS theme changes only when in system mode
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (mode !== 'system') return;

    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => setSystemIsDark(Boolean(e.matches));

    if (mq.addEventListener) {
      mq.addEventListener('change', handler);
    } else if (mq.addListener) {
      mq.addListener(handler);
    }

    return () => {
      if (mq.removeEventListener) {
        mq.removeEventListener('change', handler);
      } else if (mq.removeListener) {
        mq.removeListener(handler);
      }
    };
  }, [mode]);

  // Apply class on root; also sync colorScheme to suppress browser forced-dark
  useEffect(() => {
    const root = document.documentElement;

    // Skip the crossfade on first mount (would flash on initial load); only
    // animate actual switches after that.
    if (isFirstRun.current) {
      isFirstRun.current = false;
    } else {
      root.classList.add('theme-transition');
    }

    root.classList.toggle('dark', resolvedIsDark);

    const scheme = resolvedIsDark ? 'dark' : 'light';
    root.style.colorScheme = scheme;

    let metaTag = document.querySelector('meta[name="color-scheme"]');
    if (!metaTag) {
      metaTag = document.createElement('meta');
      metaTag.setAttribute('name', 'color-scheme');
      document.head.appendChild(metaTag);
    }
    metaTag.setAttribute('content', scheme);

    const timeout = setTimeout(() => root.classList.remove('theme-transition'), 220);
    return () => clearTimeout(timeout);
  }, [resolvedIsDark]);

  return [mode, resolvedIsDark, setMode];
}
