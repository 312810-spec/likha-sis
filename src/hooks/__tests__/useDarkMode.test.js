// @vitest-environment jsdom

import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, beforeEach } from 'vitest';
import useDarkMode from '../useDarkMode.js';

const STORAGE_KEY = 'likha-sis-dark-mode';

describe('useDarkMode', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('defaults to false and keeps the document light by default', () => {
    const { result } = renderHook(() => useDarkMode());

    expect(result.current[0]).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('false');
  });

  it('toggles the value and updates the document class and localStorage', () => {
    const { result } = renderHook(() => useDarkMode());

    act(() => {
      result.current[1]();
    });

    expect(result.current[0]).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });

  it('persists the mode across a fresh render of the hook', () => {
    const { result, unmount } = renderHook(() => useDarkMode());

    act(() => {
      result.current[1]();
    });

    unmount();

    const { result: rerenderedResult } = renderHook(() => useDarkMode());

    expect(rerenderedResult.current[0]).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(localStorage.getItem(STORAGE_KEY)).toBe('true');
  });
});
