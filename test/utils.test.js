import { describe, it, expect } from 'vitest';
import { escapeHtml, safeColor, debounce } from '../src/lib/utils.js';

describe('escapeHtml', () => {
  it('échappe les caractères dangereux', () => {
    expect(escapeHtml('<img src=x onerror=alert(1)>')).toBe('&lt;img src=x onerror=alert(1)&gt;');
    expect(escapeHtml(`a & b "c" 'd'`)).toBe('a &amp; b &quot;c&quot; &#39;d&#39;');
  });
  it('gère null/undefined', () => {
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
  });
});

describe('safeColor', () => {
  it('accepte les couleurs hex valides', () => {
    expect(safeColor('#fff')).toBe('#fff');
    expect(safeColor('#7c6af7')).toBe('#7c6af7');
    expect(safeColor('#7c6af7aa')).toBe('#7c6af7aa');
  });
  it('accepte rgb/rgba et var() du thème', () => {
    expect(safeColor('rgba(0,0,0,0.6)')).toBe('rgba(0,0,0,0.6)');
    expect(safeColor('var(--green)')).toBe('var(--green)');
  });
  it('rejette les valeurs d’injection et applique le repli', () => {
    expect(safeColor('red; background:url(x)')).toBe('transparent');
    expect(safeColor('}#x{display:none', 'var(--accent)')).toBe('var(--accent)');
    expect(safeColor('expression(alert(1))')).toBe('transparent');
    expect(safeColor('')).toBe('transparent');
  });
});

describe('debounce', () => {
  it('expose flush et cancel', () => {
    let n = 0;
    const f = debounce(() => (n += 1), 50);
    f();
    f.flush();
    expect(n).toBe(1);
    f();
    f.cancel();
    expect(n).toBe(1);
  });
});
