/**
 * Brouillon de résumé de séance, généré à partir des traces de jeu déjà en
 * mémoire : journal de combat (session_state['combat_log']), jets de dés et
 * messages publics. Le MJ le génère dans le composeur de notes, l'édite, puis
 * le partage — rien n'est posté automatiquement.
 *
 * Module pur (aucun import, horloge injectée) : testable sans store.
 */

const MAX_COMBAT_LINES = 30;
const MAX_ROLL_LINES = 10;

function ts(v) {
  const t = typeof v === 'number' ? v : Date.parse(v);
  return Number.isFinite(t) ? t : 0;
}

/**
 * @param {{combatLog?: Array, messages?: Array, rolls?: Array, sinceMs?: number, now?: number}} src
 *   combatLog : [{ t, text, dm }] — les entrées `dm` (détails chiffrés des PV
 *   des monstres) sont exclues : le résumé a vocation à être partagé.
 *   rolls     : lignes `dice_rolls` (jets MJ/aveugles exclus, 20/1 naturels du d20 seulement).
 *   messages  : lignes `messages` (seul le canal public est compté).
 * @returns {string} brouillon Markdown.
 */
export function buildSessionRecap({ combatLog = [], messages = [], rolls = [], sinceMs = 0, now = Date.now() } = {}) {
  const dateStr = new Date(now).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const out = [`# Résumé de séance — ${dateStr}`, ''];

  const combat = combatLog.filter((e) => e && !e.dm && e.text && ts(e.t) >= sinceMs);
  out.push('## ⚔️ Combat');
  if (combat.length) {
    const shown = combat.slice(-MAX_COMBAT_LINES);
    if (combat.length > shown.length) out.push(`_… ${combat.length - shown.length} événement(s) plus ancien(s) omis._`);
    for (const e of shown) out.push(`- ${String(e.text).trim()}`);
  } else {
    out.push('_Aucun événement de combat sur la période._');
  }
  out.push('');

  // Jets marquants : 20/1 naturels des tests de d20 visibles de la table.
  const notable = rolls.filter((r) => {
    if (!r || ts(r.created_at) < sinceMs) return false;
    if (r.roll_type === 'dm' || r.details?.vis) return false; // jets cachés : hors résumé
    if (r.details?.mode === undefined || !/^1d20\b/.test(r.dice || '')) return false;
    return r.details?.kept === 20 || r.details?.kept === 1;
  });
  out.push('## 🎲 Jets marquants');
  if (notable.length) {
    for (const r of notable.slice(-MAX_ROLL_LINES)) {
      const tag = r.details.kept === 20 ? '20 naturel !' : '1 naturel…';
      out.push(`- **${r.roller_name || '?'}** — ${r.roll_name || 'd20'} : ${tag}`);
    }
  } else {
    out.push('_Ni critique ni échec critique sur la période._');
  }
  out.push('');

  const publicMsgs = messages.filter((m) => m && m.channel === 'public' && ts(m.created_at) >= sinceMs);
  if (publicMsgs.length) {
    out.push(`_${publicMsgs.length} message(s) échangés dans le chat public._`, '');
  }

  out.push('---', '_Brouillon généré automatiquement — complète et corrige avant de partager._');
  return out.join('\n');
}
