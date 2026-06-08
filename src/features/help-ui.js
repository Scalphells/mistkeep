import { escapeHtml } from '../lib/utils.js';

/**
 * Aide de jeu — pense-bête des règles D&D 5e (2014). Contenu statique,
 * consultable par le MJ et les joueurs. Filtre par mot-clé.
 */

const SECTIONS = [
  {
    title: '🩹 États (conditions)',
    rows: [
      ['🙈 Aveuglé', "Rate les jets nécessitant la vue. Attaques contre lui : avantage. Ses attaques : désavantage."],
      ['💗 Charmé', "Ne peut pas attaquer le charmeur. Celui-ci a l'avantage aux interactions sociales avec lui."],
      ['🔇 Assourdi', 'Rate les jets nécessitant l’ouïe.'],
      ['😱 Effrayé', "Désavantage aux tests/attaques tant qu'il voit la source. Ne peut pas s'en approcher volontairement."],
      ['✊ Agrippé', 'Vitesse 0 (pas de bonus de vitesse).'],
      ['🕸 Entravé', 'Vitesse 0. Attaques contre lui : avantage. Ses attaques : désavantage. Désavantage aux JdS de Dex.'],
      ['🤢 Empoisonné', 'Désavantage aux jets d’attaque et aux tests de caractéristique.'],
      ['⬇️ À terre', "Déplacement en rampant. Ses attaques : désavantage. Attaques contre lui : avantage au contact, désavantage à distance."],
      ['🚫 Neutralisé', 'Ne peut effectuer ni action ni réaction.'],
      ['💫 Étourdi', 'Neutralisé, chancelant. Rate les JdS de For et Dex. Attaques contre lui : avantage.'],
      ['🥶 Paralysé', 'Neutralisé, immobile. Rate les JdS For/Dex. Attaques contre lui : avantage. Coup au contact = critique.'],
      ['🗿 Pétrifié', 'Transformé en solide. Neutralisé, résistance à tous les dégâts, immunisé poison/maladie.'],
      ['😵 Inconscient', 'Neutralisé, tombe à terre, lâche ce qu’il tient. Rate JdS For/Dex. Attaques : avantage. Contact = critique.'],
      ['👻 Invisible', 'Indétectable à la vue. Ses attaques : avantage. Attaques contre lui : désavantage.'],
      ['🥵 Épuisement', '1 : désavantage aux tests · 2 : vitesse ÷2 · 3 : désavantage attaques & JdS · 4 : PV max ÷2 · 5 : vitesse 0 · 6 : mort.'],
    ],
  },
  {
    title: '⚔️ Actions en combat',
    rows: [
      ['Attaquer', 'Une attaque au corps-à-corps ou à distance (plus si attaques multiples).'],
      ['Lancer un sort', 'Selon le temps d’incantation (souvent 1 action).'],
      ['Foncer', 'Déplacement supplémentaire égal à ta vitesse.'],
      ['Se désengager', 'Ton déplacement ne provoque pas d’attaques d’opportunité.'],
      ['Esquiver', 'Les attaques contre toi : désavantage ; avantage à tes JdS de Dex.'],
      ['Aider', 'Donne l’avantage à un allié (attaque ou test) ou aide au combat.'],
      ['Se cacher', 'Test de Discrétion pour devenir non vu/entendu.'],
      ['Préparer', 'Choisis un déclencheur + une action/déplacement exécuté en réaction.'],
      ['Chercher', 'Test de Perception/Investigation.'],
      ['Utiliser un objet', 'Interagir avec un objet qui requiert une action.'],
      ['Action bonus / Réaction', 'Bonus : seulement si une capacité l’autorise. Réaction : 1 par round (ex. attaque d’opportunité).'],
    ],
  },
  {
    title: '🛌 Repos',
    rows: [
      ['Repos court (≥ 1 h)', 'Dépense de dés de vie (1dN + mod. CON) pour soigner ; certaines capacités récupèrent.'],
      ['Repos long (≥ 8 h)', 'PV au maximum ; récupère la moitié des dés de vie (min 1) ; emplacements de sorts restaurés.'],
    ],
  },
  {
    title: '🎲 Règles utiles',
    rows: [
      ['Avantage / Désavantage', 'Lance 2d20, garde le meilleur / le pire. Ne se cumulent pas (un seul des deux).'],
      ['Couverture', '+2 CA (à moitié), +5 CA (aux trois quarts), totale = pas de ligne d’effet.'],
      ['Surprise', 'Un personnage surpris ne peut ni agir ni réagir lors de son premier tour.'],
      ['Jets de mort', 'À 0 PV : 1d20. ≥10 réussite, <10 échec. 3 réussites = stabilisé, 3 échecs = mort. 1 = 2 échecs, 20 = +1 PV.'],
      ['Dégâts massifs', 'Si des dégâts ≥ PV max restants te font tomber à 0, tu meurs sur le coup.'],
    ],
  },
];

export function mountHelp(container) {
  container.innerHTML = `
    <div class="help-wrap">
      <input class="help-search" id="help-search" type="search" placeholder="Filtrer (ex. agrippé, foncer, repos…)" autocomplete="off" />
      <div class="help-content" id="help-content"></div>
    </div>
  `;

  const render = (q = '') => {
    const needle = q.trim().toLowerCase();
    const el = container.querySelector('#help-content');
    el.innerHTML = SECTIONS.map((sec) => {
      const rows = sec.rows.filter(
        ([t, d]) => !needle || t.toLowerCase().includes(needle) || d.toLowerCase().includes(needle)
      );
      if (!rows.length) return '';
      return `<section class="help-sec">
          <h3>${escapeHtml(sec.title)}</h3>
          ${rows
            .map(([t, d]) => `<div class="help-row"><span class="help-term">${escapeHtml(t)}</span><span class="help-desc">${escapeHtml(d)}</span></div>`)
            .join('')}
        </section>`;
    }).join('') || `<div class="help-empty">Aucun résultat.</div>`;
  };

  container.querySelector('#help-search').addEventListener('input', (e) => render(e.target.value));
  render();
  return () => {};
}
