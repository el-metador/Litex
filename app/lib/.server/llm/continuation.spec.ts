import { describe, expect, it } from 'vitest';
import { mergeContinuationText } from './continuation';

describe('mergeContinuationText', () => {
  it('returns first segment when second segment is empty', () => {
    expect(mergeContinuationText('abc', '')).toBe('abc');
  });

  it('returns second segment when first segment is empty', () => {
    expect(mergeContinuationText('', 'abc')).toBe('abc');
  });

  it('handles exact duplicated continuation segment', () => {
    expect(mergeContinuationText('const x = 1;', 'const x = 1;')).toBe('const x = 1;');
  });

  it('handles continuation that repeats previous prefix', () => {
    const part1 = 'function renderPage() {\n  return <main>Hello</main>;\n}\n';
    const part2 = `${part1}\nexport default renderPage;\n`;

    expect(mergeContinuationText(part1, part2)).toBe(part2);
  });

  it('merges overlapping suffix/prefix without duplication', () => {
    const part1 = '...<section>\n  <h1>Title</h1>\n  <p>Intro';
    const part2 = '<p>Intro</p>\n</section>';

    expect(mergeContinuationText(part1, part2)).toBe('...<section>\n  <h1>Title</h1>\n  <p>Intro</p>\n</section>');
  });
});
