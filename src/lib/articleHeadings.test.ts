import { describe, it, expect } from 'vitest';
import { articleHeadingId, articleHeadingText } from './articleHeadings';

describe('article section links', () => {
  it('uses stable block identity across rerenders and distinguishes identical headings', () => {
    const first = { _key: 'a1', children: [{text:'Song requests'}] };
    const second = { ...first, _key: 'a2' };
    expect(articleHeadingId(first)).not.toBe(articleHeadingId(second));
    // Highlighting the current section must not change the targets of existing links.
    expect(articleHeadingId({ ...first, children: [{ text: 'Updated heading' }] })).toBe(articleHeadingId(first));
  });
  it('preserves marked span text for navigation and supports older blocks without keys', () => {
    const block = { children: [{text:'What is a '}, {text:'setlist', marks:['strong']}, {text:'?'}] };
    expect(articleHeadingText(block)).toBe('What is a setlist?');
    expect(articleHeadingId(block)).toBe('section-what-is-a-setlist-');
  });
});
