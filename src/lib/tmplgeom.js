/**
 * Géométrie des gabarits de sorts (fonctions pures, sans dépendance au store/DOM).
 * `gs` = taille d'une case en pixels carte ; `a` = origine, `b` = point visé.
 */

/** SVG d'un gabarit (cercle = rayon, cône, ligne épaisse d'une case). */
export function templateSvg(shape, a, b, color, gs = 70) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const f = `fill="${color}" fill-opacity="0.16" stroke="${color}" stroke-width="2"`;
  const dot = `<circle cx="${a.x}" cy="${a.y}" r="4" fill="${color}"/>`;
  if (shape === 'circle') return `<circle cx="${a.x}" cy="${a.y}" r="${dist}" ${f}/>${dot}`;
  if (shape === 'cone') {
    const ang = Math.atan2(dy, dx);
    const half = Math.atan(0.5);
    const p1x = a.x + Math.cos(ang - half) * dist;
    const p1y = a.y + Math.sin(ang - half) * dist;
    const p2x = a.x + Math.cos(ang + half) * dist;
    const p2y = a.y + Math.sin(ang + half) * dist;
    return `<polygon points="${a.x},${a.y} ${p1x},${p1y} ${p2x},${p2y}" ${f}/>${dot}`;
  }
  const len = dist || 1;
  const px = (-dy / len) * (gs / 2);
  const py = (dx / len) * (gs / 2);
  return `<polygon points="${a.x + px},${a.y + py} ${b.x + px},${b.y + py} ${b.x - px},${b.y - py} ${a.x - px},${a.y - py}" ${f}/>${dot}`;
}

/** Libellé d'un gabarit (ex. « Rayon 9 m ») d'après la distance et la grille. */
export function templateLabel(shape, dist, gs = 70, feetPerCell = 5, unit = 'm') {
  const ft = Math.round(dist / gs) * feetPerCell;
  const kind = shape === 'circle' ? 'Rayon' : shape === 'cone' ? 'Cône' : 'Ligne';
  return `${kind} ${ft} ${unit}`;
}
