// @vitest-environment jsdom

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import useDarkMode, { STORAGE_KEY, readStoredMode, resolveIsDark } from '../useDarkMode.js';

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
    document.documentElement.style.colorScheme = '';
    // Reset the meta tag content to a neutral state
    const existing = document.querySelector('meta[name="color-scheme"]');
    if (existing) existing.setAttribute('content', 'light dark');
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

  it('sets colorScheme style and meta tag to "dark" in explicit dark mode', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    matchMediaMatches = false;
    renderHook(() => useDarkMode());

    expect(document.documentElement.style.colorScheme).toBe('dark');
    const meta = document.querySelector('meta[name="color-scheme"]');
    expect(meta).not.toBeNull();
    expect(meta.getAttribute('content')).toBe('dark');
  });

  it('sets colorScheme style and meta tag to "light" in explicit light mode', () => {
    localStorage.setItem(STORAGE_KEY, 'light');
    matchMediaMatches = true; // OS is dark but mode overrides to light
    renderHook(() => useDarkMode());

    expect(document.documentElement.style.colorScheme).toBe('light');
    const meta = document.querySelector('meta[name="color-scheme"]');
    expect(meta).not.toBeNull();
    expect(meta.getAttribute('content')).toBe('light');
  });

  it('sets colorScheme style and meta tag to "dark" when system mode resolves dark', () => {
    matchMediaMatches = true; // OS is dark, mode stays "system"
    renderHook(() => useDarkMode());

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.style.colorScheme).toBe('dark');
    const meta = document.querySelector('meta[name="color-scheme"]');
    expect(meta.getAttribute('content')).toBe('dark');
  });

  it('does not add theme-transition on first mount, even when the pre-paint bootstrap already applied .dark', () => {
    // Simulate what index.html's pre-paint script does before React mounts.
    localStorage.setItem(STORAGE_KEY, 'dark');
    document.documentElement.classList.add('dark');
    document.documentElement.style.colorScheme = 'dark';

    renderHook(() => useDarkMode());

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('theme-transition')).toBe(false);
  });

  it('adds theme-transition when the user changes mode after mount', () => {
    const { result } = renderHook(() => useDarkMode());
    expect(document.documentElement.classList.contains('theme-transition')).toBe(false);

    act(() => {
      result.current[2]('dark');
    });

    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('theme-transition')).toBe(true);
  });
});

describe('resolveIsDark (pre-paint parity)', () => {
  it('stored "dark" resolves true regardless of system preference', () => {
    expect(resolveIsDark('dark', false)).toBe(true);
    expect(resolveIsDark('dark', true)).toBe(true);
  });

  it('stored "light" resolves false regardless of system preference', () => {
    expect(resolveIsDark('light', true)).toBe(false);
    expect(resolveIsDark('light', false)).toBe(false);
  });

  it('stored "system" follows the OS preference', () => {
    expect(resolveIsDark('system', true)).toBe(true);
    expect(resolveIsDark('system', false)).toBe(false);
  });
});

describe('readStoredMode (pre-paint parity)', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('falls back to "system" when nothing is stored', () => {
    expect(readStoredMode()).toBe('system');
  });

  it('falls back to "system" for an invalid stored value', () => {
    localStorage.setItem(STORAGE_KEY, 'purple');
    expect(readStoredMode()).toBe('system');
  });

  it('returns the stored value when it is a valid mode', () => {
    localStorage.setItem(STORAGE_KEY, 'dark');
    expect(readStoredMode()).toBe('dark');
    localStorage.setItem(STORAGE_KEY, 'light');
    expect(readStoredMode()).toBe('light');
    localStorage.setItem(STORAGE_KEY, 'system');
    expect(readStoredMode()).toBe('system');
  });
});

