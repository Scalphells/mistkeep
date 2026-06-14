import { store } from '../state.js';
import { t } from '../lib/i18n.js';
import { escapeHtml } from '../lib/utils.js';
import { addCombatant } from './initiative.js';
import { getSystem } from '../lib/systems/index.js';
import { activeCampaign } from '../lib/campaigns.js';

/**
 * Constructeur de rencontre (MJ) : pioche des monstres du compendium et lance
 * les combattants dans le tracker.
 *
 * Le chiffrage du budget (XP ajusté du multiplicateur 2014 face aux seuils du
 * groupe) est propre à D&D 5e : il ne s'affiche que si le système de la
 * campagne le déclare (`sys.encounterBudget`). Sur pf2e / Libre, on garde la
 * pioche et le lancement, sans barème de difficulté trompeur.
 */

// CR → XP (DMG 2014). Clés numériques (gère "1/2", "0.5", 5…).
const CR_XP = {
  0: 10, 0.125: 25, 0.25: 50, 0.5: 100, 1: 200, 2: 450, 3: 700, 4: 1100,
  5: 1800, 6: 2300, 7: 2900, 8: 3900, 9: 5000, 10: 5900, 11: 7200, 12: 8400,
  13: 10000, 14: 11500, 15: 13000, 16: 15000, 17: 18000, 18: 20000, 19: 22000,
  20: 25000, 21: 33000, 22: 41000, 23: 50000, 24: 62000, 25: 75000, 26: 90000,
  27: 105000, 28: 120000, 29: 135000, 30: 155000,
};

// Seuils d'XP par personnage et par niveau : [facile, moyen, difficile, mortel].
const THRESH = {
  1: [25, 50, 75, 100], 2: [50, 100, 150, 200], 3: [75, 150, 225, 400], 4: [125, 250, 375, 500],
  5: [250, 500, 750, 1100], 6: [300, 600, 900, 1400], 7: [350, 750, 1100, 1700], 8: [450, 900, 1400, 2100],
  9: [550, 1100, 1600, 2400], 10: [600, 1200, 1900, 2800], 11: [800, 1600, 2400, 3600], 12: [1000, 2000, 3000, 4500],
  13: [1100, 2200, 3400, 5100], 14: [1250, 2500, 3800, 5700], 15: [1400, 2800, 4300, 6400], 16: [1600, 3200, 4800, 7200],
  17: [2000, 3900, 5900, 8800], 18: [2100, 4200, 6300, 9500], 19: [2400, 4900, 7300, 10900], 20: [2800, 5700, 8500, 12700],
};

function crToXp(cr) {
  let n = cr;
  if (typeof cr === 'string') {
    n = cr.includes('/') ? Number(cr.split('/')[0]) / Number(cr.split('/')[1]) : Number(cr);
  }
  return CR_XP[n] ?? 0;
}

function multiplier(count) {
  if (count <= 1) return 1;
  if (count === 2) return 1.5;
  if (count <= 6) return 2;
  if (count <= 10) return 2.5;
  if (count <= 14) return 3;
  return 4;
}

export function openEncounterBuilder() {
  if (!store.get().isDM) return;
  const budget = !!getSystem(activeCampaign()?.system)?.encounterBudget; // chiffrage 5e ?
  const sel = new Map(); // entryId -> count

  const ov = document.createElement('div');
  ov.className = 'enc-overlay';
  ov.innerHTML = `
    <div class="enc-box">
      <header class="enc-head"><strong>${t('enc.title')}</strong><button class="enc-close" title="${t('common.close')}">✕</button></header>
      <div class="enc-cols">
        <div class="enc-pick">
          <input class="enc-search" id="enc-search" type="search" placeholder="${t('enc.search')}" />
          <div class="enc-list" id="enc-list"></div>
        </div>
        <div class="enc-summary" id="enc-summary"></div>
      </div>
      <footer class="enc-foot">
        <button class="btn" id="enc-launch">${t('enc.launch')}</button>
      </footer>
    </div>`;
  document.body.appendChild(ov);

  const listEl = ov.querySelector('#enc-list');
  const sumEl = ov.querySelector('#enc-summary');
  const search = ov.querySelector('#enc-search');
  const close = () => ov.remove();
  ov.querySelector('.enc-close').addEventListener('click', close);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });

  const monsters = () => store.get().compendium.filter((e) => e.kind === 'monster');

  const partyThresholds = () => {
    const chars = store.get().characters;
    const th = [0, 0, 0, 0];
    for (const c of chars) {
      const lvl = Math.max(1, Math.min(20, Number(c.data?.lvl) || 1));
      const row = THRESH[lvl];
      for (let i = 0; i < 4; i++) th[i] += row[i];
    }
    return { count: chars.length, th };
  };

  const renderList = () => {
    const q = search.value.trim().toLowerCase();
    const list = monsters()
      .filter((m) => !q || m.name.toLowerCase().includes(q))
      .slice(0, 200);
    listEl.innerHTML = list.length
      ? list
          .map((m) => {
            const n = sel.get(m.id) || 0;
            const meta = budget
              ? ` <em>${t('enc.cr')} ${escapeHtml(String(m.data?.cr ?? '?'))} · ${crToXp(m.data?.cr)} XP</em>`
              : '';
            return `<div class="enc-row">
              <span class="enc-name">${escapeHtml(m.name)}${meta}</span>
              <span class="enc-qty">
                <button class="enc-pm" data-dec="${m.id}">−</button>
                <span class="enc-n">${n}</span>
                <button class="enc-pm" data-inc="${m.id}">+</button>
              </span>
            </div>`;
          })
          .join('')
      : `<div class="enc-empty">${t('enc.empty')}</div>`;
    listEl.querySelectorAll('[data-inc]').forEach((b) =>
      b.addEventListener('click', () => {
        sel.set(b.dataset.inc, (sel.get(b.dataset.inc) || 0) + 1);
        renderList();
        renderSummary();
      })
    );
    listEl.querySelectorAll('[data-dec]').forEach((b) =>
      b.addEventListener('click', () => {
        const c = (sel.get(b.dataset.dec) || 0) - 1;
        if (c <= 0) sel.delete(b.dataset.dec);
        else sel.set(b.dataset.dec, c);
        renderList();
        renderSummary();
      })
    );
  };

  const renderSummary = () => {
    const comp = store.get().compendium;
    let totalCount = 0;
    let rawXp = 0;
    const lines = [];
    for (const [id, n] of sel) {
      const m = comp.find((e) => e.id === id);
      if (!m) continue;
      totalCount += n;
      rawXp += crToXp(m.data?.cr) * n;
      lines.push(`<div class="enc-sum-row">${n}× ${escapeHtml(m.name)}</div>`);
    }
    // Hors 5e : pas de barème de difficulté, juste la liste à lancer.
    if (!budget) {
      sumEl.innerHTML = `
        <h4>${t('enc.h.encounter')}</h4>
        ${lines.join('') || `<div class="enc-muted">${t('enc.addLeft')}</div>`}
        ${totalCount ? `<div class="enc-xp">${t('enc.creatures', { n: `<strong>${totalCount}</strong>` })}</div>` : ''}
      `;
      return;
    }
    const { count, th } = partyThresholds();
    const adj = Math.round(rawXp * multiplier(totalCount));
    let diffKey = 'triviale';
    if (adj >= th[3]) diffKey = 'mortelle';
    else if (adj >= th[2]) diffKey = 'difficile';
    else if (adj >= th[1]) diffKey = 'moyenne';
    else if (adj >= th[0]) diffKey = 'facile';
    sumEl.innerHTML = `
      <h4>${t('enc.h.party')}</h4>
      <div class="enc-party">${t('enc.party', { count, a: th[0], b: th[1], c: th[2], d: th[3] })}</div>
      <h4>${t('enc.h.encounter')}</h4>
      ${lines.join('') || `<div class="enc-muted">${t('enc.addLeft')}</div>`}
      <div class="enc-xp">${t('enc.xpline', { raw: rawXp, mult: multiplier(totalCount) })}<strong>${adj} XP</strong></div>
      <div class="enc-diff enc-diff-${diffKey}">${t('enc.diff')} <strong>${t('enc.diff.' + diffKey)}</strong></div>
    `;
  };

  ov.querySelector('#enc-launch').addEventListener('click', () => {
    const comp = store.get().compendium;
    for (const [id, n] of sel) {
      const m = comp.find((e) => e.id === id);
      if (!m) continue;
      const d = m.data || {};
      for (let i = 1; i <= n; i++) {
        addCombatant({
          name: n > 1 ? `${m.name} ${i}` : m.name,
          initiative: 0,
          hp: d.hpMax ?? d.hp ?? '',
          hpMax: d.hpMax ?? d.hp ?? '',
          hpTemp: 0,
        });
      }
    }
    close();
  });

  search.addEventListener('input', renderList);
  renderList();
  renderSummary();
}
