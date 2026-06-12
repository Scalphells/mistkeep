/**
 * Calage de grille en deux clics : l'utilisateur clique deux coins OPPOSÉS
 * d'une même case de la battlemap (coordonnées en pixels image), on en déduit
 * la taille de case et le décalage de la grille.
 *
 * Tolérant au geste : deux coins en diagonale donnent dx ≈ dy ≈ côté (on
 * moyenne) ; deux coins d'une même arête donnent un axe ≈ 0 (on prend l'autre).
 *
 * Module pur (aucun import) : testable sans DOM.
 */
export function gridFromCorners(p1, p2, { min = 10, max = 400 } = {}) {
  const dx = Math.abs(Number(p2?.x) - Number(p1?.x));
  const dy = Math.abs(Number(p2?.y) - Number(p1?.y));
  if (!Number.isFinite(dx) || !Number.isFinite(dy)) return null;
  const hi = Math.max(dx, dy);
  const lo = Math.min(dx, dy);
  // Diagonale franche → moyenne des deux axes ; geste le long d'une arête
  // (un axe quasi nul) → l'axe dominant fait foi.
  const size = Math.round(lo < hi / 2 ? hi : (dx + dy) / 2);
  if (size < min || size > max) return null;
  // Le coin haut-gauche de la case cliquée ancre le décalage de la grille.
  const mod = (v) => ((Math.round(v) % size) + size) % size;
  return { size, ox: mod(Math.min(p1.x, p2.x)), oy: mod(Math.min(p1.y, p2.y)) };
}
