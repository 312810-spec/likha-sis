import { useEffect, useState } from 'react';

const STORAGE_KEY = 'likha-sis-dark-mode';

function readStoredMode() {
  if (typeof window === 'undefined') return 'system';
  const v = localStorage.getItem(STORAGE_KEY);
  return v === 'light' || v === 'dark' || v === 'system' ? v : 'system';
}

export default function useDarkMode() {
  const [mode, setMode] = useState(() => readStoredMode());

  // track only the system preference in state; derive resolvedIsDark from mode + systemIsDark
  const [systemIsDark, setSystemIsDark] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  const resolvedIsDark = mode === 'dark' ? true : mode === 'light' ? false : systemIsDark;

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
  }, [resolvedIsDark]);

  return [mode, resolvedIsDark, setMode];
}
