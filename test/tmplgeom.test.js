import { describe, it, expect } from 'vitest';
import { templateSvg, templateLabel } from '../src/lib/tmplgeom.js';

const a = { x: 100, y: 100 };

describe('templateSvg', () => {
  it('cercle : rayon = distance a→b', () => {
    const svg = templateSvg('circle', a, { x: 170, y: 100 }, '#fff', 70);
    expect(svg).toContain('<circle');
    expect(svg).toContain('r="70"');
  });
  it('cône : génère un polygone à 3 points + le point d’origine', () => {
    const svg = templateSvg('cone', a, { x: 170, y: 100 }, '#fff', 70);
    expect(svg).toContain('<polygon');
    expect(svg).toContain('100,100');
  });
  it('ligne : polygone épais d’une case', () => {
    const svg = templateSvg('line', a, { x: 170, y: 100 }, '#fff', 70);
    expect(svg).toContain('<polygon');
  });
});

describe('templateLabel', () => {
  it('arrondit la distance en cases × pieds/case', () => {
    expect(templateLabel('circle', 70, 70, 5, 'm')).toBe('Rayon 5 m');
    expect(templateLabel('cone', 140, 70, 5, 'm')).toBe('Cône 10 m');
    expect(templateLabel('line', 210, 70, 5, 'm')).toBe('Ligne 15 m'); // 3 cases × 5
  });
});
