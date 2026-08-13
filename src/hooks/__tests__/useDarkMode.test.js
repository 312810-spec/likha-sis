// @vitest-environment jsdom

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import useDarkMode from '../useDarkMode.js';

const STORAGE_KEY = 'likha-sis-dark-mode';

describe('useDarkMode (3-way)', () => {
  let matchMediaMatches = false;
  let listeners = [];

  function installMockMatchMedia() {
    listeners = [];
    window.matchMedia = () => {
      return {
        matches: matchMediaMatches,
        addEventListener: (evt, cb) => listeners.push(cb),
        removeEventListener: (evt, cb) => { listeners = listeners.filter((f) => f !== cb); },
        addListener: (cb) => listeners.push(cb),
        removeListener: (cb) => { listeners = listeners.filter((f) => f !== cb); },
      };
    };
  }

  function triggerMatchMediaChange(matches) {
    matchMediaMatches = matches;
    listeners.forEach((cb) => cb({ matches }));
  }

  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
    matchMediaMatches = false;
    installMockMatchMedia();
  });

  it('defaults to "system" and resolves using matchMedia', () => {
    matchMediaMatches = false;
    const { result } = renderHook(() => useDarkMode());

    expect(result.current[0]).toBe('system');
    expect(result.current[1]).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('explicit "dark" and "light" resolve regardless of matchMedia', () => {
    // Force stored dark
    localStorage.setItem(STORAGE_KEY, 'dark');
    matchMediaMatches = false;
    const { result: r1 } = renderHook(() => useDarkMode());
    expect(r1.current[0]).toBe('dark');
    expect(r1.current[1]).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    // Force stored light
    localStorage.setItem(STORAGE_KEY, 'light');
    document.documentElement.className = '';
    matchMediaMatches = true;
    const { result: r2 } = renderHook(() => useDarkMode());
    expect(r2.current[0]).toBe('light');
    expect(r2.current[1]).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('system mode updates when matchMedia changes', () => {
    matchMediaMatches = false;
    const { result } = renderHook(() => useDarkMode());
    expect(result.current[0]).toBe('system');
    expect(result.current[1]).toBe(false);

    act(() => {
      triggerMatchMediaChange(true);
    });

    expect(result.current[1]).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  it('persists the selected mode across a fresh render', () => {
    const { result, unmount } = renderHook(() => useDarkMode());

    act(() => {
      // setMode is the 3rd element
      result.current[2]('dark');
    });

    expect(result.current[0]).toBe('dark');
    expect(localStorage.getItem(STORAGE_KEY)).toBe('dark');

    unmount();

    const { result: r2 } = renderHook(() => useDarkMode());
    expect(r2.current[0]).toBe('dark');
  });
});
