import { store } from '../state.js';
import { escapeHtml } from '../lib/utils.js';
import { modalConfirm, modalPrompt } from '../lib/modal.js';
import { showToast } from '../lib/toast.js';
import { openEncounterBuilder } from './encounter-ui.js';
import {
  loadInitiative,
  addCombatant,
  addPartyFromCharacters,
  updateCombatant,
  adjustHp,
  toggleCondition,
  setCondValue,
  addEffect,
  removeEffect,
  rollAllInitiative,
  removeCombatant,
  clearCombat,
  clearCombatLog,
  nextTurn,
  prevTurn,
  reorderByInitiative,
  subscribeInitiative,
  logCombat,
  sendTurnAction,
  sendEndTurn,
  sendPlayerRequest,
  rollDeathSave,
  setDeathSave,
  resolveGroupSave,
  setManualOrder,
  setCombatantStatus,
  combatantName,
} from './initiative.js';
import { getSystem } from '../lib/systems/index.js';
import { activeCampaign } from '../lib/campaigns.js';
import { loadCompendium } from './compendium.js';
import { openStatblock, parseStatblockActions } from '../lib/statblock.js';
import { hpTierLabel } from '../lib/hptiers.js';
import { t } from '../lib/i18n.js';

/**
 * UI du tracker d'initiative. Le MJ pilote (ajout, PV, tour) ; les joueurs
 * suivent le combat en temps réel (lecture seule).
 */

import { systemConditions, condIcon, condIconHtml, condLabel, condDesc, condValued } from '../lib/conditions.js';

/** Rappel d'un jet de Concentration si un combattant concentré subit des dégâts. */
function concentrationCheck(entityId, damage) {
  const c = store.get().initiative.find((x) => x.entity_id === entityId);
  if (!c || damage <= 0) return;
  const concentrating =
    (c.effects || []).some((e) => e.concentration) || (c.conditions || []).includes('Concentration');
  if (!concentrating) return;
  const dc = Math.max(10, Math.floor(damage / 2));
  showToast(t('init.toast.conc', { name: c.name, dc }), {
    type: 'warn',
    icon: '⚠️',
    timeout: 8000,
  });
}

/** Entrée de compendium (monstre/PNJ) au même nom, avec actions jouables. */
function statblockFor(name) {
  const n = String(name || '').trim().toLowerCase();
  if (!n) return null;
  const e = (store.get().compendium || []).find(
    (x) => (x.kind === 'monster' || x.kind === 'npc') && x.name.trim().toLowerCase() === n
  );
  return e && parseStatblockActions(e.data?.desc).length ? e : null;
}

export async function mountInitiative(container) {
  await loadInitiative();
  if (!store.get().compendium?.length) loadCompendium(); // pour relier les statblocs par nom
  const unsubRealtime = subscribeInitiative();
  const unsubStore = store.subscribe(render);
  render(container);

  return () => {
    unsubStore();
    unsubRealtime();
  };
}

function render(arg) {
  const container =
    arg instanceof HTMLElement ? arg : document.getElementById('init-root');
  if (!container) return;

  // Si on est en train de saisir dans un champ, on ne ré-rend pas (préserve focus).
  if (
    container.id === 'init-root' &&
    container.contains(document.activeElement) &&
    document.activeElement.tagName === 'INPUT'
  ) {
    updateDynamic(container);
    return;
  }

  const { isDM } = store.get();
  container.id = 'init-root';
  container.innerHTML = `
    <div class="init-wrap">
      <div class="init-header">
        <div class="init-round">${t('combat.round')} <strong id="init-round">${store.get().initRound}</strong></div>
        ${
          isDM
            ? `<div class="init-controls">
                 <button class="btn init-ctrl" id="init-prev">${t('combat.prev')}</button>
                 <button class="btn init-ctrl" id="init-next">${t('combat.next')}</button>
                 <button class="dice-btn" id="init-party">${t('combat.importParty')}</button>
                 <button class="dice-btn" id="init-roll" title="${t('combat.rollInit.title')}">${t('combat.rollInit')}</button>
                 <button class="dice-btn" id="init-encounter" title="${t('combat.encounter.title')}">${t('combat.encounter')}</button>
                 <button class="dice-btn" id="init-groupsave" title="${t('combat.groupsave.title')}">${t('combat.groupsave')}</button>
                 <button class="dice-btn" id="init-clear">${t('combat.reset')}</button>
               </div>`
            : `<div class="init-readonly">${t('combat.readonly')}</div>`
        }
      </div>
      ${isDM ? actionBar(false) : isMyTurn() ? actionBar(true) : ''}
      ${isDM ? addForm() : playerCombatPanel()}
      <div class="init-list" id="init-list"></div>
      <details class="init-log">
        <summary>${t('combat.log')} ${isDM ? `<button class="init-log-clear" id="init-log-clear" title="${t('combat.log.clear')}">🧹</button>` : ''}</summary>
        <div class="init-log-list" id="init-log-list"></div>
      </details>
    </div>
  `;

  renderList(container);
  renderLog(container);

  if (isDM) {
    container.querySelector('#init-prev').addEventListener('click', prevTurn);
    container.querySelector('#init-next').addEventListener('click', nextTurn);
    container.querySelector('#init-party').addEventListener('click', addPartyFromCharacters);
    container.querySelector('#init-roll').addEventListener('click', rollAllInitiative);
    container.querySelector('#init-encounter').addEventListener('click', openEncounterBuilder);
    container.querySelector('#init-groupsave').addEventListener('click', openGroupSave);
    container.querySelector('#init-clear').addEventListener('click', async () => {
      if (await modalConfirm(t('combat.clear.confirm'), { title: t('combat.clear.title'), danger: true, okLabel: t('combat.clear.ok') }))
        clearCombat();
    });
    container.querySelector('#init-log-clear')?.addEventListener('click', (e) => {
      e.preventDefault();
      clearCombatLog();
    });
    bindAddForm(container);
  }

  // Barre d'action du tour : MJ (écrit direct) ou joueur actif (diffuse au MJ).
  const mine = !isDM && isMyTurn();
  if (isDM || mine) {
    container.querySelector('#iab-end')?.addEventListener('click', () => {
      if (isDM) nextTurn();
      else {
        sendEndTurn();
        showToast(t('combat.toast.endTurn'), { timeout: 1800 });
      }
    });
    container.querySelectorAll('[data-action]').forEach((b) =>
      b.addEventListener('click', () => {
        const active = store.get().initiative[store.get().initTurn];
        if (!active) return;
        const text = `▶ ${active.name} : action — ${b.dataset.action}.`;
        if (isDM) logCombat(text, !active.char_id); // action d'un monstre = MJ only
        else {
          sendTurnAction(text);
          showToast(t('combat.toast.action', { action: b.dataset.action }), { timeout: 1500 });
        }
      })
    );
  }

  // Panneau d'autonomie joueur (rejoindre/quitter, initiative, états).
  if (!isDM) {
    const panel = container.querySelector('.init-playerpanel');
    if (panel) {
      const charId = panel.dataset.char;
      panel.querySelector('[data-pp="join"]')?.addEventListener('click', () => {
        sendPlayerRequest({ kind: 'join', charId });
        showToast(t('combat.toast.joinReq'), { timeout: 1600 });
      });
      panel.querySelector('[data-pp="leave"]')?.addEventListener('click', () => sendPlayerRequest({ kind: 'leave', charId }));
      panel.querySelector('[data-pp="rollinit"]')?.addEventListener('click', () => {
        sendPlayerRequest({ kind: 'rollinit', charId });
        showToast(t('combat.toast.initSent'), { timeout: 1600 });
      });
      panel.querySelectorAll('.ipp-cond').forEach((b) =>
        b.addEventListener('click', () => {
          const comb = store.get().initiative.find((c) => c.char_id === charId);
          const set = new Set(comb?.conditions || []);
          const k = b.dataset.cond;
          if (set.has(k)) set.delete(k);
          else set.add(k);
          sendPlayerRequest({ kind: 'conds', charId, conditions: [...set] });
        })
      );
    }
  }
}

function renderLog(container) {
  const el = container.querySelector('#init-log-list');
  if (!el) return;
  const log = (store.get().combatLog || []).filter((e) => store.get().isDM || !e.dm);
  if (!log.length) {
    el.innerHTML = `<div class="init-log-empty">${t('dock.combat.noEvents')}</div>`;
    return;
  }
  el.innerHTML = log
    .slice(-120)
    .map((e) => {
      const time = new Date(e.t).toLocaleTimeString(t('locale.bcp47'), { hour: '2-digit', minute: '2-digit' });
      return `<div class="init-log-row"><time>${time}</time> ${escapeHtml(e.text)}</div>`;
    })
    .join('');
  el.scrollTop = el.scrollHeight;
}

/** Barre d'action du combattant dont c'est le tour (MJ). */
const TURN_ACTIONS = [
  ['combat.action.attack', '⚔'], ['combat.action.spell', '✨'], ['combat.action.dash', '🏃'], ['combat.action.dodge', '🛡'],
  ['combat.action.disengage', '💨'], ['combat.action.help', '🤝'], ['combat.action.hide', '🫥'], ['combat.action.ready', '⏳'],
];
function actionBar(mine) {
  const { initiative, initTurn } = store.get();
  const active = initiative[initTurn];
  if (!active) return '';
  return `<div class="init-actionbar ${mine ? 'mine' : ''}">
      <div class="iab-head">${mine ? `🎯 <strong>${t('combat.yourTurn')}</strong>` : `${t('combat.turnOf')} <strong>${escapeHtml(combatantName(active))}</strong>`}</div>
      <div class="iab-acts">
        ${TURN_ACTIONS.map(([k, ic]) => { const a = t(k); return `<button class="iab-btn" data-action="${escapeHtml(a)}">${ic} ${a}</button>`; }).join('')}
      </div>
      <button class="btn iab-end" id="iab-end">${mine ? t('combat.endMyTurn') : t('combat.endTurnBtn')}</button>
      ${mine ? `<div class="iab-hint">${t('combat.actionHint')}</div>` : ''}
    </div>`;
}

/** Personnage du joueur courant (actif en priorité, sinon premier possédé). */
function myCharacter() {
  const { characters, user, activeChar } = store.get();
  const owned = (characters || []).filter((c) => c.owner_id === user?.id);
  return owned.find((c) => c.id === activeChar) || owned[0] || null;
}

/** Panneau d'autonomie du joueur en combat (rejoindre/quitter, initiative, états). */
function playerCombatPanel() {
  const mine = myCharacter();
  if (!mine) return '';
  const comb = store.get().initiative.find((c) => c.char_id === mine.id);
  const conds = comb?.conditions || [];
  return `<div class="init-playerpanel" data-char="${mine.id}">
      <div class="ipp-head">🎭 ${escapeHtml(mine.name)}</div>
      ${
        comb
          ? `<div class="ipp-row">
               <span class="ipp-init" title="${t('init.myInit')}">${t('dock.init')} <b>${comb.initiative ?? 0}</b></span>
               <button class="dice-btn" data-pp="rollinit">${t('init.rollMine')}</button>
               <button class="dice-btn" data-pp="leave">${t('dock.leave')}</button>
             </div>
             <div class="ipp-conds-lbl">${t('init.myConds')}</div>
             <div class="ipp-conds">${systemConditions()
               .map((c) => `<button class="ipp-cond ${conds.includes(c.n) ? 'on' : ''}" data-cond="${escapeHtml(c.n)}" title="${escapeHtml(condLabel(c.n))}">${c.i}</button>`)
               .join('')}</div>`
          : `<button class="dice-btn" data-pp="join">${t('dock.join')}</button>`
      }
    </div>`;
}

/** Le combattant actif est-il le personnage du joueur courant ? */
function isMyTurn() {
  const { initiative, initTurn, characters, user, isDM } = store.get();
  if (isDM) return false;
  const active = initiative[initTurn];
  if (!active?.char_id) return false;
  return characters.find((c) => c.id === active.char_id)?.owner_id === user?.id;
}

function addForm() {
  return `
    <form class="init-add" id="init-add">
      <input id="ia-name" placeholder="${t('combat.add.name')}" required />
      <input id="ia-init" type="number" placeholder="${t('combat.add.init')}" style="width:64px" />
      <input id="ia-hp" type="number" placeholder="${t('combat.add.hp')}" style="width:64px" />
      <input id="ia-hpmax" type="number" placeholder="${t('combat.add.hpmax')}" style="width:72px" />
      <input id="ia-qty" type="number" min="1" value="1" title="${t('combat.add.qtyTitle')}" style="width:52px" />
      <button class="btn" type="submit">${t('combat.add.submit')}</button>
    </form>`;
}

function bindAddForm(container) {
  container.querySelector('#init-add').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = container.querySelector('#ia-name').value.trim();
    if (!name) return;
    const init = container.querySelector('#ia-init').value;
    const hp = container.querySelector('#ia-hp').value;
    const hpMax = container.querySelector('#ia-hpmax').value;
    const qty = Math.max(1, Math.min(30, Number(container.querySelector('#ia-qty').value) || 1));
    // Groupe de monstres : « Gobelin 1 », « Gobelin 2 »… ; un seul → nom brut.
    for (let i = 1; i <= qty; i++) {
      await addCombatant({ name: qty > 1 ? `${name} ${i}` : name, initiative: init, hp, hpMax });
    }
    container.querySelector('#init-add').reset();
    container.querySelector('#ia-qty').value = '1';
    container.querySelector('#ia-name').focus();
  });
}

/** Modale « Jet de sauvegarde de groupe » (AoE). MJ. */
function openGroupSave() {
  const list = store.get().initiative;
  if (!list.length) {
    showToast(t('combat.toast.noCombatants'), { timeout: 2400 });
    return;
  }
  // Entrées de sauvegarde du système ; défaut sur la sauvegarde « d'esquive »
  // si elle existe (Dex en 5e, Réflexes en pf2e), sinon la première.
  const sopts = getSystem(activeCampaign()?.system).saveOptions;
  const sdef = ['dex', 'ref'].find((k) => sopts.some((o) => o.key === k)) || sopts[0]?.key;
  const ov = document.createElement('div');
  ov.className = 'modal-overlay show';
  ov.innerHTML = `
    <div class="modal-card gsave-card" role="dialog" aria-modal="true">
      <h3 class="modal-title">${t('combat.gs.title')}</h3>
      <div class="gsave-row">
        <label>${t('combat.gs.save')}
          <select id="gs-ab">${sopts.map((a) => `<option value="${escapeHtml(a.key)}" ${a.key === sdef ? 'selected' : ''}>${escapeHtml(a.label)}</option>`).join('')}</select>
        </label>
        <label>${t('combat.gs.dc')} <input type="number" id="gs-dc" value="15" min="1" style="width:64px"/></label>
      </div>
      <div class="gsave-row">
        <label>${t('combat.gs.dmg')} <input type="number" id="gs-dmg" value="0" min="0" style="width:74px" title="${t('combat.gs.dmgTitle')}"/></label>
        <label>${t('combat.gs.type')} <input type="text" id="gs-type" placeholder="${t('combat.gs.typePh')}" style="width:110px"/></label>
      </div>
      <div class="gsave-row">
        <label class="gsave-chk"><input type="radio" name="gs-half" value="half" checked/> ${t('combat.gs.half')}</label>
        <label class="gsave-chk"><input type="radio" name="gs-half" value="none"/> ${t('combat.gs.none')}</label>
      </div>
      <div class="gsave-targets">
        <div class="gsave-targets-h">${t('combat.gs.targets')} <button class="gsave-toggle" id="gs-toggle">${t('combat.gs.toggle')}</button></div>
        <div class="gsave-list" id="gs-list">
          ${list
            .map(
              (c) => `<label class="gsave-t"><input type="checkbox" value="${c.entity_id}" checked/> ${escapeHtml(c.name)}${c.hp === 0 ? ` <em>${t('combat.gs.zerohp')}</em>` : ''}</label>`
            )
            .join('')}
        </div>
      </div>
      <div class="modal-actions">
        <button class="modal-btn" id="gs-cancel">${t('combat.gs.cancel')}</button>
        <button class="modal-btn primary" id="gs-go">${t('combat.gs.go')}</button>
      </div>
    </div>`;
  document.body.appendChild(ov);
  const close = () => {
    ov.remove();
    document.removeEventListener('keydown', onKey, true);
  };
  const onKey = (e) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      close();
    }
  };
  document.addEventListener('keydown', onKey, true);
  ov.addEventListener('mousedown', (e) => {
    if (e.target === ov) close();
  });
  ov.querySelector('#gs-cancel').addEventListener('click', close);
  ov.querySelector('#gs-toggle').addEventListener('click', (e) => {
    e.preventDefault();
    const boxes = [...ov.querySelectorAll('#gs-list input')];
    const allOn = boxes.every((b) => b.checked);
    boxes.forEach((b) => (b.checked = !allOn));
  });
  ov.querySelector('#gs-go').addEventListener('click', () => {
    const ability = ov.querySelector('#gs-ab').value;
    const dc = Number(ov.querySelector('#gs-dc').value) || 10;
    const amount = Math.max(0, Number(ov.querySelector('#gs-dmg').value) || 0);
    const halfOnSuccess = ov.querySelector('input[name="gs-half"]:checked').value === 'half';
    const type = ov.querySelector('#gs-type').value.trim();
    const entityIds = [...ov.querySelectorAll('#gs-list input:checked')].map((b) => b.value);
    if (!entityIds.length) {
      showToast(t('combat.toast.pickOne'), { timeout: 2200 });
      return;
    }
    resolveGroupSave({ ability, dc, amount, halfOnSuccess, type, entityIds });
    close();
  });
}

function renderList(container) {
  const el = container.querySelector('#init-list');
  if (!el) return;
  const { initiative, initTurn, initRound, isDM } = store.get();

  if (!initiative.length) {
    el.innerHTML = `<div class="char-empty">${t('init.empty')} ${isDM ? t('init.emptyDM') : ''}</div>`;
    return;
  }

  el.innerHTML = initiative
    .map((c, i) => combatantRow(c, i, i === initTurn, isDM, initRound))
    .join('');

  // Ciblage : disponible pour TOUS (MJ et joueurs), avant la sortie MJ-only.
  el.querySelectorAll('[data-target]').forEach((b) =>
    b.addEventListener('click', () => {
      const c = store.get().initiative.find((x) => x.entity_id === b.dataset.target);
      if (!c) return;
      const id = tokenIdForComb(c);
      if (!id) {
        showToast(t('init.toast.noToken'), { timeout: 2400 });
        return;
      }
      const set = new Set(store.get().targets || []);
      if (set.has(id)) set.delete(id);
      else set.add(id);
      store.set({ targets: [...set] });
      showToast(set.has(id) ? t('map.toast.targeted', { label: c.name, n: set.size }) : t('map.toast.untargeted', { n: set.size }), { timeout: 1400 });
    })
  );

  // Jet de sauvegarde contre la mort : MJ direct, joueur via requête au MJ.
  el.querySelectorAll('[data-dsroll]').forEach((b) =>
    b.addEventListener('click', () => {
      if (isDM) rollDeathSave(b.dataset.dsroll);
      else if (b.dataset.char) {
        sendPlayerRequest({ kind: 'deathsave', charId: b.dataset.char });
        showToast(t('init.toast.dsSent'), { timeout: 1800 });
      }
    })
  );

  if (!isDM) return;

  // Ajustement manuel des pastilles de jets de mort (MJ).
  el.querySelectorAll('[data-ds]').forEach((b) =>
    b.addEventListener('click', () => setDeathSave(b.dataset.id, b.dataset.ds, Number(b.dataset.dsi)))
  );

  el.querySelectorAll('[data-init]').forEach((input) =>
    input.addEventListener('change', async () => {
      await updateCombatant(input.dataset.init, { initiative: Number(input.value) || 0 });
      await reorderByInitiative();
    })
  );
  el.querySelectorAll('[data-hpdelta]').forEach((b) =>
    b.addEventListener('click', () => {
      const delta = Number(b.dataset.hpdelta);
      adjustHp(b.dataset.id, delta);
      if (delta < 0) concentrationCheck(b.dataset.id, -delta);
    })
  );
  el.querySelectorAll('[data-hpset]').forEach((input) =>
    input.addEventListener('change', () => {
      const cb = store.get().initiative.find((c) => c.entity_id === input.dataset.hpset);
      const oldHp = cb?.hp ?? 0;
      const newHp = Number(input.value) || 0;
      updateCombatant(input.dataset.hpset, { hp: newHp });
      if (newHp < oldHp) concentrationCheck(input.dataset.hpset, oldHp - newHp);
    })
  );
  el.querySelectorAll('[data-hptemp]').forEach((input) =>
    input.addEventListener('change', () =>
      updateCombatant(input.dataset.hptemp, { hp_temp: Math.max(0, Number(input.value) || 0) })
    )
  );
  el.querySelectorAll('[data-remove]').forEach((b) =>
    b.addEventListener('click', () => removeCombatant(b.dataset.remove))
  );
  el.querySelectorAll('[data-cond]').forEach((sel) =>
    sel.addEventListener('change', () => {
      if (sel.value) {
        toggleCondition(sel.dataset.cond, sel.value);
        sel.value = '';
      }
    })
  );
  el.querySelectorAll('[data-delcond]').forEach((b) =>
    b.addEventListener('click', () =>
      toggleCondition(b.dataset.id, b.dataset.delcond)
    )
  );
  el.querySelectorAll('[data-condval]').forEach((b) =>
    b.addEventListener('click', () => {
      const c = store.get().initiative.find((x) => x.entity_id === b.dataset.id);
      const cur = c?.cond_values?.[b.dataset.cond] || 1;
      setCondValue(b.dataset.id, b.dataset.cond, b.dataset.condval === 'inc' ? cur + 1 : cur - 1);
    })
  );
  el.querySelectorAll('[data-add-effect]').forEach((b) =>
    b.addEventListener('click', async () => {
      const conc = b.dataset.concentration === '1';
      const name = await modalPrompt(conc ? t('init.eff.concPrompt') : t('init.eff.namePrompt'), {
        title: conc ? t('cond.concentration') : t('init.eff.title'),
        placeholder: conc ? t('init.eff.concPh') : t('init.eff.namePh'),
      });
      if (!name || !name.trim()) return;
      let rounds = '';
      if (!conc) {
        rounds = await modalPrompt(t('init.eff.durPrompt'), { title: t('init.eff.durTitle'), placeholder: t('init.eff.durPh') });
        if (rounds === null) return;
      }
      addEffect(b.dataset.addEffect, { name: name.trim(), rounds: rounds && rounds.trim() ? rounds.trim() : null, concentration: conc });
    })
  );
  el.querySelectorAll('[data-deleffect]').forEach((b) =>
    b.addEventListener('click', () => removeEffect(b.dataset.id, Number(b.dataset.deleffect)))
  );
  el.querySelectorAll('[data-statblock]').forEach((b) =>
    b.addEventListener('click', () => {
      const e = statblockFor(b.dataset.statblock);
      if (e) openStatblock(e);
    })
  );
  el.querySelectorAll('[data-status]').forEach((b) =>
    b.addEventListener('click', () => setCombatantStatus(b.dataset.id, b.dataset.status))
  );

  // Réordonnancement manuel par glisser-déposer (MJ).
  let dragEid = null;
  el.querySelectorAll('.init-row[data-eid]').forEach((row) => {
    row.addEventListener('dragstart', (e) => {
      dragEid = row.dataset.eid;
      e.dataTransfer.effectAllowed = 'move';
      row.classList.add('dragging');
    });
    row.addEventListener('dragend', () => {
      dragEid = null;
      el.querySelectorAll('.init-row').forEach((r) => r.classList.remove('dragging', 'drop-target'));
    });
    row.addEventListener('dragover', (e) => {
      e.preventDefault();
      if (dragEid && row.dataset.eid !== dragEid) row.classList.add('drop-target');
    });
    row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
    row.addEventListener('drop', (e) => {
      e.preventDefault();
      row.classList.remove('drop-target');
      if (!dragEid || row.dataset.eid === dragEid) return;
      const ids = [...el.querySelectorAll('.init-row[data-eid]')].map((r) => r.dataset.eid);
      const from = ids.indexOf(dragEid);
      if (from < 0) return;
      ids.splice(from, 1);
      const to = ids.indexOf(row.dataset.eid); // insère le glissé AVANT la cible
      ids.splice(to, 0, dragEid);
      setManualOrder(ids);
    });
  });
}

/** Id du jeton sur la carte lié à ce combattant (par entity_id ou char_id). */
function tokenIdForComb(c) {
  const toks = store.get().map?.tokens || [];
  const t = toks.find((x) => (c.entity_id && x.entityId === c.entity_id) || (c.char_id && x.charId === c.char_id));
  return t?.id || null;
}

/** PV masqués aux joueurs pour ce combattant ? (flag « PV cachés » du jeton lié, façon #4). */
function combHpHidden(c) {
  const toks = store.get().map?.tokens || [];
  const tk = toks.find((x) => (c.entity_id && x.entityId === c.entity_id) || (c.char_id && x.charId === c.char_id));
  return !!tk?.hpHidden;
}

/** Type d'un combattant pour la couleur du turn order. */
function combType(c) {
  if (!c.char_id) return 'monster';
  const ch = (store.get().characters || []).find((x) => x.id === c.char_id);
  return ch?.owner_id ? 'pj' : 'npc';
}

/** Ce combattant correspond-il au personnage du joueur courant ? */
function isOwnedByMe(c) {
  if (!c.char_id) return false;
  const { characters, user } = store.get();
  return characters.find((x) => x.id === c.char_id)?.owner_id === user?.id;
}

/** Bloc « jets de sauvegarde contre la mort » (PJ à 0 PV). */
function deathSavesHtml(c, isDM) {
  const ds = c.death_saves;
  if (c.hp !== 0 || !c.char_id || !ds) return '';
  const stable = ds.s >= 3;
  const dead = ds.f >= 3;
  const mine = isOwnedByMe(c);
  const pip = (kind, i, on) =>
    `<button class="ds-pip ds-${kind} ${on ? 'on' : ''}" ${
      isDM ? `data-ds="${kind}" data-dsi="${i}" data-id="${c.entity_id}"` : 'disabled'
    }></button>`;
  const succ = [1, 2, 3].map((i) => pip('s', i, ds.s >= i)).join('');
  const fail = [1, 2, 3].map((i) => pip('f', i, ds.f >= i)).join('');
  const status = dead
    ? `<span class="ds-status dead">${t('init.ds.dead')}</span>`
    : stable
      ? `<span class="ds-status stable">${t('init.ds.stable')}</span>`
      : '';
  const roll =
    (isDM || mine) && !stable && !dead
      ? `<button class="ds-roll" data-dsroll="${c.entity_id}" data-char="${escapeHtml(c.char_id)}" title="${t('init.ds.rollTitle')}">🎲</button>`
      : '';
  return `<div class="init-deathsaves" title="${t('init.ds.title')}">
      <span class="ds-lbl">${t('init.ds.lbl')}</span>
      <span class="ds-succ" title="${t('sheet.death.success')}">${succ}</span>
      <span class="ds-fail" title="${t('sheet.death.fail')}">${fail}</span>
      ${roll}${status}
    </div>`;
}

function combatantRow(c, i, active, isDM, round) {
  const hpPct =
    c.hp_max && c.hp !== null
      ? Math.max(0, Math.min(100, (c.hp / c.hp_max) * 100))
      : null;
  const dead = c.hp === 0;
  const hidden = combHpHidden(c); // PV masqués aux joueurs (flag du jeton, façon #4)

  const conds = (c.conditions || [])
    .map((cond) => {
      const valued = condValued(cond);
      const valBadge = valued ? `<b class="cond-val">${c.cond_values?.[cond] || 1}</b>` : '';
      const stepper =
        isDM && valued
          ? `<button class="cond-step" data-condval="dec" data-id="${c.entity_id}" data-cond="${escapeHtml(cond)}" title="${t('init.cond.dec')}">−</button><button class="cond-step" data-condval="inc" data-id="${c.entity_id}" data-cond="${escapeHtml(cond)}" title="${t('init.cond.inc')}">+</button>`
          : '';
      return `<span class="cond-tag" title="${escapeHtml(condDesc(cond) || condLabel(cond))}">${condIconHtml(cond)} ${escapeHtml(condLabel(cond))}${valBadge}${stepper}${
        isDM ? `<button class="cond-x" data-id="${c.entity_id}" data-delcond="${escapeHtml(cond)}">×</button>` : ''
      }</span>`;
    })
    .join('');

  const effects = (c.effects || [])
    .map((ef, idx) => {
      const rem = ef.until == null ? null : ef.until - (round || 1);
      const expired = rem != null && rem <= 0;
      const remTxt = ef.until == null ? '∞' : expired ? t('init.eff.expired') : `${rem}`;
      return `<span class="eff-tag ${ef.concentration ? 'conc' : ''} ${expired ? 'expired' : ''}">
        ${ef.concentration ? '🧠 ' : ''}${escapeHtml(ef.name)} <em>${remTxt}</em>${
        isDM ? `<button class="cond-x" data-id="${c.entity_id}" data-deleffect="${idx}">×</button>` : ''
      }</span>`;
    })
    .join('');

  const effAdd = isDM
    ? `<span class="eff-add">
         <button class="eff-btn" data-add-effect="${c.entity_id}" title="${t('init.addEffect')}">${t('init.effBtn')}</button>
         <button class="eff-btn" data-add-effect="${c.entity_id}" data-concentration="1" title="${t('cond.concentration')}">🧠</button>
       </span>`
    : '';

  const stBadge =
    c.status === 'ready'
      ? `<span class="init-status ready" title="${t('init.status.ready.title')}">${t('init.status.ready')}</span>`
      : c.status === 'delayed'
        ? `<span class="init-status delayed" title="${t('init.status.delayed.title')}">${t('init.status.delayed')}</span>`
        : '';

  return `
    <div class="init-row t-${combType(c)} ${active ? 'active' : ''} ${dead ? 'dead' : ''} ${c.status ? `st-${c.status}` : ''}" ${isDM ? `draggable="true" data-eid="${c.entity_id}"` : ''}>
      <div class="init-order">${isDM ? `<span class="init-grip" title="${t('init.grip')}">⠿</span>` : ''}${i + 1}</div>
      <div class="init-score">
        ${
          isDM
            ? `<input type="number" value="${c.initiative}" data-init="${c.entity_id}" />`
            : `<span>${c.initiative}</span>`
        }
      </div>
      <div class="init-name">
        <strong>${escapeHtml(combatantName(c))}</strong>
        ${(() => {
          const tid = tokenIdForComb(c);
          const on = tid && (store.get().targets || []).includes(tid);
          return `<button class="init-target ${on ? 'on' : ''}" data-target="${c.entity_id}" title="${tid ? t('init.target.toggle') : t('init.target.none')}">🎯</button>`;
        })()}
        ${isDM && statblockFor(c.name) ? `<button class="sb-mini" data-statblock="${escapeHtml(c.name)}" title="${t('init.statblock')}">⚔</button>` : ''}
        ${stBadge}
        <div class="init-conds">${conds}${effects}${effAdd}</div>
        ${deathSavesHtml(c, isDM)}
      </div>
      <div class="init-hp${isDM && hidden ? ' cloaked' : ''}">
        ${isDM && hidden ? `<span class="init-hp-cloak" title="${t('init.hpHidden.title')}">🙈</span>` : ''}
        ${
          c.hp === null
            ? '<span class="init-nohp">—</span>'
            : isDM
            ? `<button class="hp-btn sm" data-id="${c.entity_id}" data-hpdelta="-1">−</button>
               <input type="number" class="init-hp-in" value="${c.hp}" data-hpset="${c.entity_id}" />
               <button class="hp-btn sm" data-id="${c.entity_id}" data-hpdelta="1">+</button>
               <span class="init-hpmax">/${c.hp_max ?? '?'}</span>
               <span class="init-temp" title="${t('init.tempHp')}">
                 <span class="init-temp-lbl">${t('sheet.hp.tmp')}</span>
                 <input type="number" min="0" class="init-temp-in" value="${c.hp_temp ?? 0}" data-hptemp="${c.entity_id}" />
               </span>`
            : hidden
            ? `<span class="init-hptier">${hpPct !== null ? hpTierLabel(hpPct) : '—'}</span>`
            : `<span>${c.hp}${c.hp_max ? ` / ${c.hp_max}` : ''}</span>${
                c.hp_temp ? ` <span class="init-temp-badge" title="${t('init.tempHp')}">+${c.hp_temp}</span>` : ''
              }`
        }
        ${hpPct !== null && !(hidden && !isDM) ? `<div class="init-hpbar"><span style="width:${hpPct}%"></span></div>` : ''}
      </div>
      ${
        isDM
          ? `<div class="init-actions">
               <button class="init-st-btn ${c.status === 'ready' ? 'on' : ''}" data-status="ready" data-id="${c.entity_id}" title="${t('init.status.ready.title')}">⏳</button>
               <button class="init-st-btn ${c.status === 'delayed' ? 'on' : ''}" data-status="delayed" data-id="${c.entity_id}" title="${t('init.status.delayBtn')}">⏸</button>
               <select class="cond-select" data-cond="${c.entity_id}">
                 <option value="">${t('init.addCond')}</option>
                 ${systemConditions().map((x) => `<option value="${x.n}">${x.i} ${escapeHtml(condLabel(x.n))}</option>`).join('')}
               </select>
               <button class="mini-del" data-remove="${c.entity_id}">×</button>
             </div>`
          : ''
      }
    </div>`;
}

/** Mise à jour légère pendant la saisie (round + surbrillance du tour). */
function updateDynamic(container) {
  const roundEl = container.querySelector('#init-round');
  if (roundEl) roundEl.textContent = store.get().initRound;
  const rows = container.querySelectorAll('.init-row');
  const { initTurn } = store.get();
  rows.forEach((r, i) => r.classList.toggle('active', i === initTurn));
  renderLog(container);
}
