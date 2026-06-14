import { escapeHtml } from './utils.js';
import { openActionCard } from './actioncard.js';
import { t as tr } from './i18n.js';

/**
 * Statbloc cliquable : extrait les actions « jouables » d'une description de
 * monstre/PNJ (Markdown, souvent issu de l'import SRD) et permet de les lancer
 * via la carte d'action (jet d'attaque vs CA, dégâts, critique, DD de
 * sauvegarde). Aucune donnée propriétaire n'est embarquée : on lit la prose que
 * le MJ a lui-même saisie/importée.
 *
 * Lignes reconnues : `**Nom.** … +X to hit … Hit: N (XdY + Z) <type> damage`,
 * « DC 13 … saving throw … (XdY) <type> damage », etc. (EN + FR de base).
 */

const ATK_RE = /([+-]\d+)\s*(?:to hit|au toucher|pour toucher|sur l['’]attaque)/i;
const DICE_RE = /(\d+\s*d\s*\d+(?:\s*[+-]\s*\d+)?)/i;
const DC_RE = /\b(?:DC|DD)\s*(\d+)/i;

/** Type de dégâts (mot avant « damage », sinon après « dégâts »). */
function damageType(body) {
  const en = body.match(/([A-Za-zÀ-ÿ]+)\s+damage/i);
  if (en) return en[1];
  const fr = body.match(/d[ée]g[âa]ts?\s+([A-Za-zÀ-ÿ]+)/i);
  if (fr) return fr[1];
  return '';
}

/**
 * @param {string} desc Markdown de la fiche
 * @returns {Array<{nm,bon,dmg,dc,typ,desc,noAtk}>}
 */
export function parseStatblockActions(desc) {
  if (!desc) return [];
  const out = [];
  for (const raw of String(desc).split('\n')) {
    const line = raw.trim();
    if (!line) continue;
    // Action en gras : « **Nom.** corps » ou « **Nom** corps ».
    const m = line.match(/^[-*]?\s*\*\*(.+?)\.?\*\*[:.]?\s*(.+)$/);
    if (!m) continue;
    const nm = m[1].trim();
    const body = m[2].trim();
    if (!nm || !body) continue;

    const am = body.match(ATK_RE);
    const dm = body.match(DICE_RE);
    const cm = body.match(DC_RE);
    // On ne garde que ce qui est jouable (jet d'attaque, dégâts ou sauvegarde).
    if (!am && !dm && !cm) continue;

    out.push({
      nm,
      bon: am ? Number(am[1]) : null,
      noAtk: !am, // pas de jet d'attaque (sort/souffle à sauvegarde)
      dmg: dm ? dm[1].replace(/\s+/g, '') : '',
      dc: cm ? cm[1] : '',
      typ: damageType(body),
      desc: body,
    });
  }
  return out;
}

let _ov = null;
export function closeStatblock() {
  if (_ov) {
    _ov.remove();
    _ov = null;
    document.removeEventListener('keydown', _key, true);
  }
}
function _key(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeStatblock();
  }
}

/**
 * Ouvre la liste cliquable des actions d'un statbloc. `entry` = entrée de
 * compendium ({ name, data:{ desc, ac, hpMax, cr } }) ou tout objet
 * { name, desc } ; un nom + une description suffisent.
 */
export function openStatblock(entry) {
  closeStatblock();
  const name = entry?.name || tr('sb.default');
  const d = entry?.data || entry || {};
  const desc = d.desc || '';
  const acts = parseStatblockActions(desc);

  const stats = [
    d.ac != null && d.ac !== '' ? tr('sb.ac', { v: escapeHtml(String(d.ac)) }) : '',
    d.hpMax != null && d.hpMax !== '' ? tr('sb.hp', { v: escapeHtml(String(d.hpMax)) }) : '',
    d.cr ? tr('sb.cr', { v: escapeHtml(String(d.cr)) }) : '',
  ].filter(Boolean);

  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card sb-card" role="dialog" aria-modal="true">
      <h3 class="modal-title">⚔ ${escapeHtml(name)}</h3>
      ${stats.length ? `<div class="cmp-stats sb-stats">${stats.map((s) => `<span>${s}</span>`).join('')}</div>` : ''}
      ${
        acts.length
          ? `<div class="sb-list">${acts
              .map(
                (a, i) => `<button class="sb-action" data-sb="${i}">
                  <span class="sb-action-nm">${escapeHtml(a.nm)}</span>
                  <span class="sb-action-meta">${[
                    a.bon != null ? tr('sb.toHit', { bon: `${a.bon >= 0 ? '+' : ''}${a.bon}` }) : '',
                    a.dmg ? `💥 ${escapeHtml(a.dmg)}${a.typ ? ` ${escapeHtml(a.typ)}` : ''}` : '',
                    a.dc ? tr('sb.dc', { dc: escapeHtml(a.dc) }) : '',
                  ]
                    .filter(Boolean)
                    .join(' · ')}</span>
                </button>`
              )
              .join('')}</div>`
          : `<p class="modal-msg">${tr('sb.noActions')}<br>${tr('sb.format')}</p>`
      }
      <div class="modal-actions"><button class="modal-btn sb-close">${tr('common.close')}</button></div>
    </div>`;
  document.body.appendChild(ov);
  _ov = ov;
  document.addEventListener('keydown', _key, true);

  ov.querySelector('.sb-close').addEventListener('click', closeStatblock);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) closeStatblock();
  });
  ov.querySelectorAll('[data-sb]').forEach((b) =>
    b.addEventListener('click', () => {
      const a = acts[Number(b.dataset.sb)];
      if (a) openActionCard({ charId: null, who: name, kind: 'atk', item: a });
    })
  );
}
