import { describe, it, expect, vi } from 'vitest';
import { cn, parseShowCalendarDate } from './utils';

describe('utils', () => {
  it.each(['America/Los_Angeles', 'Pacific/Honolulu', 'Pacific/Auckland'])(
    'preserves concert calendar dates in %s', (zone) => {
      vi.stubEnv('TZ', zone);
      try {
        const date = parseShowCalendarDate('2026-09-18');
        expect(date.getFullYear()).toBe(2026);
        expect(date.getMonth()).toBe(8);
        expect(date.getDate()).toBe(18);
        expect(date.getDay()).toBe(5);
      } finally { vi.unstubAllEnvs(); }
    },
  );
  it('cn should merge class names correctly', () => {
    const result = cn('px-4', 'py-2', 'bg-blue-500');
    expect(result).toBe('px-4 py-2 bg-blue-500');
  });

  it('cn should handle conditional classes', () => {
    const result = cn('base-class', false && 'conditional-class', 'another-class');
    expect(result).toBe('base-class another-class');
  });
});
