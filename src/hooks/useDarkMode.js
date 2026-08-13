import { useEffect, useState } from 'react';

const STORAGE_KEY = 'likha-sis-dark-mode';

export default function useDarkMode() {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window === 'undefined') {
      return false;
    }

    const storedValue = localStorage.getItem(STORAGE_KEY);
    return storedValue === 'true';
  });

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', isDark);
    localStorage.setItem(STORAGE_KEY, String(isDark));
  }, [isDark]);

  function toggleDarkMode() {
    setIsDark((previous) => !previous);
  }

  return [isDark, toggleDarkMode];
}
