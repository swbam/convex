import { describe, it, expect } from 'vitest';
import { cn } from './utils';

describe('utils', () => {
  it('cn should merge class names correctly', () => {
    const result = cn('px-4', 'py-2', 'bg-blue-500');
    expect(result).toBe('px-4 py-2 bg-blue-500');
  });

  it('cn should handle conditional classes', () => {
    const result = cn('base-class', false && 'conditional-class', 'another-class');
    expect(result).toBe('base-class another-class');
  });
});

