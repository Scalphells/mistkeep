/**
 * Pile d'annulation générique pour des états patchés par fusion superficielle
 * (`next = { ...cur, ...patch }`), comme la carte. Chaque entrée mémorise les
 * valeurs PRÉCÉDENTES des clés touchées, taguées par contexte (id de scène) :
 * une entrée d'un autre contexte invalide toute la pile — annuler des patchs
 * d'une scène sur une autre n'aurait aucun sens. Pas de redo, volontairement.
 *
 * Module pur (aucun import) : testable sans backend.
 */
export function createUndoStack(max = 50) {
  let stack = [];
  return {
    /** Mémorise les valeurs de `cur` que `patch` va remplacer. */
    record(ctx, cur, patch) {
      const prev = {};
      for (const k of Object.keys(patch)) prev[k] = cur?.[k];
      stack.push({ ctx, prev });
      if (stack.length > max) stack.shift();
    },
    /** Y a-t-il une entrée annulable dans ce contexte ? */
    canUndo(ctx) {
      const top = stack[stack.length - 1];
      return !!top && top.ctx === ctx;
    },
    /** Dépile la dernière entrée du contexte (ou vide la pile si obsolète). */
    pop(ctx) {
      const top = stack[stack.length - 1];
      if (!top || top.ctx !== ctx) {
        stack = []; // pile d'un autre contexte : obsolète
        return null;
      }
      stack.pop();
      return top.prev;
    },
    size() {
      return stack.length;
    },
  };
}
