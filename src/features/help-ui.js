import { escapeHtml } from '../lib/utils.js';
import { t } from '../lib/i18n.js';

/**
 * Aide de jeu — pense-bête des règles D&D 5e (2014). Contenu statique,
 * consultable par le MJ et les joueurs. Filtre par mot-clé. Les libellés sont
 * des clés i18n résolues au rendu (cf. help.* dans les dictionnaires).
 */

const SECTIONS = [
  {
    title: 'help.sec.conditions',
    rows: [
      ['help.c.blinded', 'help.c.blinded.d'],
      ['help.c.charmed', 'help.c.charmed.d'],
      ['help.c.deafened', 'help.c.deafened.d'],
      ['help.c.frightened', 'help.c.frightened.d'],
      ['help.c.grappled', 'help.c.grappled.d'],
      ['help.c.restrained', 'help.c.restrained.d'],
      ['help.c.poisoned', 'help.c.poisoned.d'],
      ['help.c.prone', 'help.c.prone.d'],
      ['help.c.incapacitated', 'help.c.incapacitated.d'],
      ['help.c.stunned', 'help.c.stunned.d'],
      ['help.c.paralyzed', 'help.c.paralyzed.d'],
      ['help.c.petrified', 'help.c.petrified.d'],
      ['help.c.unconscious', 'help.c.unconscious.d'],
      ['help.c.invisible', 'help.c.invisible.d'],
      ['help.c.exhaustion', 'help.c.exhaustion.d'],
    ],
  },
  {
    title: 'help.sec.actions',
    rows: [
      ['help.a.attack', 'help.a.attack.d'],
      ['help.a.cast', 'help.a.cast.d'],
      ['help.a.dash', 'help.a.dash.d'],
      ['help.a.disengage', 'help.a.disengage.d'],
      ['help.a.dodge', 'help.a.dodge.d'],
      ['help.a.help', 'help.a.help.d'],
      ['help.a.hide', 'help.a.hide.d'],
      ['help.a.ready', 'help.a.ready.d'],
      ['help.a.search', 'help.a.search.d'],
      ['help.a.useobj', 'help.a.useobj.d'],
      ['help.a.bonus', 'help.a.bonus.d'],
    ],
  },
  {
    title: 'help.sec.rest',
    rows: [
      ['help.r.short', 'help.r.short.d'],
      ['help.r.long', 'help.r.long.d'],
    ],
  },
  {
    title: 'help.sec.rules',
    rows: [
      ['help.u.adv', 'help.u.adv.d'],
      ['help.u.cover', 'help.u.cover.d'],
      ['help.u.surprise', 'help.u.surprise.d'],
      ['help.u.death', 'help.u.death.d'],
      ['help.u.massive', 'help.u.massive.d'],
    ],
  },
];

export function mountHelp(container) {
  container.innerHTML = `
    <div class="help-wrap">
      <input class="help-search" id="help-search" type="search" placeholder="${t('help.search.ph')}" autocomplete="off" />
      <div class="help-content" id="help-content"></div>
    </div>
  `;

  const render = (q = '') => {
    const needle = q.trim().toLowerCase();
    const el = container.querySelector('#help-content');
    el.innerHTML =
      SECTIONS.map((sec) => {
        const rows = sec.rows.filter(([term, desc]) => {
          if (!needle) return true;
          return t(term).toLowerCase().includes(needle) || t(desc).toLowerCase().includes(needle);
        });
        if (!rows.length) return '';
        return `<section class="help-sec">
          <h3>${escapeHtml(t(sec.title))}</h3>
          ${rows
            .map(([term, desc]) => `<div class="help-row"><span class="help-term">${escapeHtml(t(term))}</span><span class="help-desc">${escapeHtml(t(desc))}</span></div>`)
            .join('')}
        </section>`;
      }).join('') || `<div class="help-empty">${t('help.empty')}</div>`;
  };

  container.querySelector('#help-search').addEventListener('input', (e) => render(e.target.value));
  render();
  return () => {};
}
