import MarkdownIt from 'markdown-it';
import DOMPurify from 'dompurify';
import { t as tr } from './i18n.js';

/**
 * Rendu Markdown SÛR.
 *
 * markdown-it convertit le Markdown en HTML ; DOMPurify retire ensuite tout
 * élément/attribut dangereux (scripts, handlers on*, iframes…). On désactive le
 * HTML brut dans la source par précaution : seuls les contenus Markdown sont
 * interprétés, le reste est échappé.
 */

const md = new MarkdownIt({
  html: false, // ignore le HTML brut dans le texte source
  linkify: true, // transforme les URL en liens
  breaks: true, // retour à la ligne simple = <br>
});

// Les liens s'ouvrent dans un nouvel onglet, sans fuite de référent.
DOMPurify.addHook('afterSanitizeAttributes', (node) => {
  if (node.tagName === 'A') {
    node.setAttribute('target', '_blank');
    node.setAttribute('rel', 'noopener noreferrer');
  }
});

function escapeAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function rollAnchor(expr) {
  const e = String(expr).trim();
  return `<a class="md-roll" data-roll="${escapeAttr(e)}" title="${escapeAttr(tr('md.rollTitle', { e }))}">🎲 ${e}</a>`;
}

/**
 * Enrichissements façon Foundry, appliqués après le rendu Markdown :
 *  - `[[1d20+5]]` → jet en ligne cliquable (lance le dé) ;
 *  - `@[[Nom]]`   → lien interne vers une entrée du compendium (clic = ouvre) ;
 *  - notations de dés détectées dans la prose (ex. « 1d8 + 3 ») → cliquables.
 * Les gestionnaires de clic sont délégués globalement (lib/mdlinks.js).
 */
function enrich(html) {
  // 1) Tokens explicites protégés par un placeholder sûr (non re-traités ensuite).
  const slots = [];
  const stash = (anchor) => {
    slots.push(anchor);
    return `@@SLOT${slots.length - 1}@@`;
  };
  html = html.replace(/@\[\[([^\]\n]+?)\]\]/g, (_m, name) => {
    const n = name.trim();
    return stash(`<a class="md-ref" data-ref="${escapeAttr(n)}" title="${escapeAttr(tr('md.refTitle'))}">🔗 ${n}</a>`);
  });
  html = html.replace(/\[\[\s*([0-9dD][0-9dD +\-*]*?)\s*\]\]/g, (_m, expr) => stash(rollAnchor(expr)));

  // 2) Auto-détection des notations de dés, UNIQUEMENT dans les nœuds texte
  //    (entre « > » et « < »), pour ne jamais toucher aux balises ni attributs.
  const DICE = /\b\d{1,3}\s*[dD]\s*\d{1,3}(?:\s*[+-]\s*\d{1,3})?\b/g;
  html = html.replace(/>([^<]+)</g, (_m, txt) => '>' + txt.replace(DICE, (d) => rollAnchor(d)) + '<');

  // 3) Restaure les tokens protégés.
  html = html.replace(/@@SLOT(\d+)@@/g, (_m, i) => slots[Number(i)] || '');
  return html;
}

/** Rend un texte Markdown en HTML assaini, prêt pour innerHTML. */
export function renderMarkdown(src) {
  const html = enrich(md.render(String(src ?? '')));
  return DOMPurify.sanitize(html, { USE_PROFILES: { html: true } });
}
