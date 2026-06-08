import { sendMessage } from '../features/chat.js';

/**
 * Cartes riches publiées dans le chat SANS migration de schéma : on encode la
 * charge utile JSON dans le `content` d'un message, préfixée par une sentinelle.
 * Le rendu du chat détecte la sentinelle et affiche une carte (action, note…)
 * au lieu d'une bulle de texte. Les cartes héritent ainsi du temps réel, de la
 * RLS et de l'effacement des messages.
 */

const SENTINEL = '@@VMJCARD@@';

/** Encode et publie une carte dans le chat (canal public par défaut). */
export async function postCard(payload, { channel = 'public' } = {}) {
  try {
    await sendMessage(SENTINEL + JSON.stringify(payload), channel);
  } catch (e) {
    console.warn('[chatpost]', e?.message || e);
  }
}

/** Décode une carte depuis un contenu de message, ou null si ce n'en est pas une. */
export function parseCard(content) {
  if (typeof content !== 'string' || !content.startsWith(SENTINEL)) return null;
  try {
    const p = JSON.parse(content.slice(SENTINEL.length));
    return p && typeof p === 'object' ? p : null;
  } catch {
    return null;
  }
}
