import { store } from '../state.js';
import { escapeHtml } from './utils.js';
import { parseDice } from '../features/dice.js';
import { adjustHp, logCombat, sendPlayerRequest } from '../features/initiative.js';
import { updateCharacter } from '../features/characters.js';
import { updateToken } from '../features/map.js';

/**
 * Résolution d'attaque ciblée (MJ).
 *
 * Couple carte + combat + fiche : on choisit un attaquant et une cible (jetons),
 * une attaque (issue de la fiche de l'attaquant ou saisie à la main), puis on
 * résout : jet d20 + bonus vs CA → touché/raté/critique → jet de dégâts (dés
 * doublés au critique) → application automatique des PV à la cible.
 *
 * L'écriture des PV passe par le tracker d'initiative (`adjustHp`, RLS MJ) si la
 * cible y est liée, sinon directement sur la fiche (`updateCharacter`). Chaque
 * résolution est consignée dans le journal de combat (partagé en temps réel).
 */

/* ── Aléatoire (rejection sampling, sans biais modulo) ───────── */
function rng(min, max) {
  const range = max - min + 1;
  const buf = new Uint32Array(1);
  const limit = Math.floor(0xffffffff / range) * range;
  let x;
  do {
    crypto.getRandomValues(buf);
    x = buf[0];
  } while (x >= limit);
  return min + (x % range);
}

/** Jet de dégâts : double le nombre de dés au critique. Gère un nombre nu. */
function rollDamage(notation, crit) {
  const raw = String(notation || '').trim();
  if (!raw) return null;
  const p = parseDice(raw);
  if (!p) {
    const flat = Number(raw);
    return Number.isFinite(flat) ? { rolls: [], modifier: flat, total: Math.max(0, flat), crit } : null;
  }
  const n = crit ? p.count * 2 : p.count;
  const rolls = [];
  for (let i = 0; i < n; i++) rolls.push(rng(1, p.sides));
  const total = Math.max(0, rolls.reduce((a, b) => a + b, 0) + p.modifier);
  return { rolls, modifier: p.modifier, total, sides: p.sides, crit };
}

/* ── Accès aux entités ───────────────────────────────────────── */
function charOf(charId) {
  return charId ? store.get().characters.find((c) => c.id === charId) || null : null;
}
function combatantOf(charId) {
  return charId ? store.get().initiative.find((c) => c.char_id === charId) || null : null;
}
/** Combattant lié à un jeton : par entity_id, sinon par char_id. */
function combatantForToken(t) {
  if (!t) return null;
  const init = store.get().initiative;
  if (t.entityId) {
    const c = init.find((x) => x.entity_id === t.entityId);
    if (c) return c;
  }
  return t.charId ? init.find((x) => x.char_id === t.charId) || null : null;
}
function tokenLabel(t) {
  if (!t) return '—';
  return t.label || charOf(t.charId)?.name || 'Jeton';
}
function tokenAC(t) {
  const ch = charOf(t?.charId);
  if (ch?.data?.ac != null) return Number(ch.data.ac);
  return t?.ac != null ? Number(t.ac) : null; // jeton autonome
}
function tokenAttacks(t) {
  const ch = charOf(t?.charId);
  return Array.isArray(ch?.data?.atks) ? ch.data.atks : [];
}

/* ── Application des dégâts ───────────────────────────────────── */
function applyDamage(token, dmg) {
  // Joueur : ne peut pas écrire les PV → délègue au MJ qui applique.
  if (!store.get().isDM) {
    sendPlayerRequest({
      kind: 'dmg',
      target: { entityId: token?.entityId || null, charId: token?.charId || null, tokenId: token?.id || null, name: tokenLabel(token) },
      amount: dmg,
    });
    return 'sent';
  }
  const charId = token?.charId;
  const comb = combatantForToken(token);
  if (comb) {
    adjustHp(comb.entity_id, -dmg); // journalise + synchronise la fiche
    return 'combat';
  }
  const ch = charOf(charId);
  if (ch && ch.data?.hp != null) {
    const before = Number(ch.data.hp) || 0;
    let temp = Number(ch.data.hpTmp) || 0;
    let d = dmg;
    const fromTemp = Math.min(temp, d);
    temp -= fromTemp;
    d -= fromTemp;
    const after = Math.max(0, before - d);
    updateCharacter(charId, { hp: after, hpTmp: temp });
    logCombat(`💥 ${tokenLabel(token)} subit ${dmg} dégâts (PV ${before}→${after}).`);
    return 'sheet';
  }
  // Jeton autonome avec PV propres.
  if (token && (token.hp != null || token.hpMax != null)) {
    const before = Number(token.hp) || 0;
    let temp = Number(token.hpTemp) || 0;
    let d = dmg;
    const fromTemp = Math.min(temp, d);
    temp -= fromTemp;
    d -= fromTemp;
    const after = Math.max(0, before - d);
    updateToken(token.id, { hp: after, hpTemp: temp });
    logCombat(`💥 ${tokenLabel(token)} subit ${dmg} dégâts (PV ${before}→${after}).`);
    return 'token';
  }
  return 'none'; // jeton non lié : PV non suivis
}

/* ── Modale ───────────────────────────────────────────────────── */
let _overlay = null;

export function closeResolver() {
  if (_overlay) {
    _overlay.remove();
    _overlay = null;
    document.removeEventListener('keydown', _onKey, true);
  }
}
function _onKey(e) {
  if (e.key === 'Escape') {
    e.preventDefault();
    closeResolver();
  }
}

export function openAttackResolver({ attackerTokenId = null, targetTokenId = null, targetTokenIds = null } = {}) {
  closeResolver();
  const tokens = store.get().map?.tokens || [];
  if (!tokens.length) return;

  // Attaque groupée : plusieurs cibles → flux dédié.
  const tgts = (targetTokenIds || (targetTokenId ? [targetTokenId] : [])).filter((tid) => tokens.some((t) => t.id === tid));
  if (tgts.length > 1) {
    openMultiAttack(attackerTokenId, tgts);
    return;
  }

  const st = {
    atkId: attackerTokenId || tokens[0]?.id,
    tgtId: tgts[0] || tokens.find((t) => t.id !== attackerTokenId)?.id || tokens[0]?.id,
    atkIndex: 0, // index d'attaque sur la fiche, ou -1 = manuel
    mode: 'normal', // normal | adv | dis
  };

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay atk-overlay';
  overlay.innerHTML = `
    <div class="modal-card atk-card" role="dialog" aria-modal="true">
      <h3 class="modal-title">⚔ Résolution d'attaque</h3>
      <div class="atk-row">
        <label>Attaquant</label>
        <select class="atk-sel" id="atk-attacker"></select>
      </div>
      <div class="atk-row">
        <label>Attaque</label>
        <select class="atk-sel" id="atk-which"></select>
      </div>
      <div class="atk-row atk-grid2">
        <div><label>Bonus att.</label><input class="atk-in" id="atk-bonus" placeholder="+5"></div>
        <div><label>Dégâts</label><input class="atk-in" id="atk-dmg" placeholder="1d8+3"></div>
      </div>
      <div class="atk-row">
        <label>Jet</label>
        <div class="atk-modes" id="atk-mode">
          <button data-mode="normal" class="active">Normal</button>
          <button data-mode="adv">Avantage</button>
          <button data-mode="dis">Désavantage</button>
        </div>
      </div>
      <hr class="atk-hr">
      <div class="atk-row">
        <label>Cible</label>
        <select class="atk-sel" id="atk-target"></select>
      </div>
      <div class="atk-row atk-grid2">
        <div><label>CA cible</label><input class="atk-in" id="atk-ac" placeholder="15"></div>
        <div class="atk-tgthp" id="atk-tgthp"></div>
      </div>
      <div class="atk-result" id="atk-result"></div>
      <div class="modal-actions">
        <button class="modal-btn atk-close">Fermer</button>
        <button class="modal-btn modal-ok" id="atk-resolve">🎲 Résoudre</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  requestAnimationFrame(() => overlay.classList.add('show'));
  _overlay = overlay;
  document.addEventListener('keydown', _onKey, true);

  const $ = (sel) => overlay.querySelector(sel);
  const attackerSel = $('#atk-attacker');
  const whichSel = $('#atk-which');
  const bonusIn = $('#atk-bonus');
  const dmgIn = $('#atk-dmg');
  const targetSel = $('#atk-target');
  const acIn = $('#atk-ac');
  const tgtHp = $('#atk-tgthp');
  const resultEl = $('#atk-result');

  const tokenOpts = (selId) =>
    tokens
      .map((t) => `<option value="${t.id}" ${t.id === selId ? 'selected' : ''}>${escapeHtml(tokenLabel(t))}</option>`)
      .join('');
  attackerSel.innerHTML = tokenOpts(st.atkId);
  targetSel.innerHTML = tokenOpts(st.tgtId);

  function curAttacker() {
    return tokens.find((t) => t.id === st.atkId);
  }
  function curTarget() {
    return tokens.find((t) => t.id === st.tgtId);
  }

  function fillAttacks() {
    const atks = tokenAttacks(curAttacker());
    whichSel.innerHTML =
      atks.map((a, i) => `<option value="${i}">${escapeHtml(a.nm || `Attaque ${i + 1}`)}</option>`).join('') +
      `<option value="-1">✏ Manuel…</option>`;
    if (st.atkIndex >= atks.length) st.atkIndex = atks.length ? 0 : -1;
    whichSel.value = String(st.atkIndex);
    syncAtkFields();
  }
  function syncAtkFields() {
    const atks = tokenAttacks(curAttacker());
    if (st.atkIndex >= 0 && atks[st.atkIndex]) {
      bonusIn.value = atks[st.atkIndex].bon || '';
      dmgIn.value = atks[st.atkIndex].dmg || '';
    }
  }
  function fillTarget() {
    const ac = tokenAC(curTarget());
    if (ac != null && !acIn.dataset.touched) acIn.value = String(ac);
    const tgt = curTarget();
    const comb = combatantForToken(tgt);
    const ch = charOf(tgt?.charId);
    let hp = null;
    if (comb && comb.hp != null) hp = { cur: comb.hp, max: comb.hp_max, temp: comb.hp_temp };
    else if (ch?.data?.hp != null) hp = { cur: ch.data.hp, max: ch.data.hpMax, temp: ch.data.hpTmp };
    else if (tgt && (tgt.hp != null || tgt.hpMax != null)) hp = { cur: tgt.hp ?? 0, max: tgt.hpMax, temp: tgt.hpTemp };
    tgtHp.innerHTML = hp
      ? `<label>PV cible</label><div class="atk-hpval">${hp.cur}${hp.max != null ? ` / ${hp.max}` : ''}${hp.temp ? ` (+${hp.temp})` : ''}</div>`
      : `<label>PV cible</label><div class="atk-hpval muted">non suivis</div>`;
  }

  attackerSel.addEventListener('change', () => {
    st.atkId = attackerSel.value;
    st.atkIndex = 0;
    fillAttacks();
  });
  whichSel.addEventListener('change', () => {
    st.atkIndex = Number(whichSel.value);
    syncAtkFields();
  });
  targetSel.addEventListener('change', () => {
    st.tgtId = targetSel.value;
    acIn.dataset.touched = '';
    fillTarget();
  });
  acIn.addEventListener('input', () => {
    acIn.dataset.touched = '1';
  });
  overlay.querySelectorAll('#atk-mode button').forEach((b) =>
    b.addEventListener('click', () => {
      st.mode = b.dataset.mode;
      overlay.querySelectorAll('#atk-mode button').forEach((x) => x.classList.toggle('active', x === b));
    })
  );
  overlay.querySelector('.atk-close').addEventListener('click', closeResolver);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closeResolver();
  });
  overlay.querySelector('#atk-resolve').addEventListener('click', resolve);

  fillAttacks();
  fillTarget();

  function resolve() {
    const attacker = curAttacker();
    const target = curTarget();
    if (!attacker || !target) return;
    const bonus = parseInt(String(bonusIn.value).replace(/[^\d+-]/g, ''), 10) || 0;
    const ac = acIn.value === '' ? null : Number(acIn.value);
    const atkName = (() => {
      const atks = tokenAttacks(attacker);
      return st.atkIndex >= 0 && atks[st.atkIndex] ? atks[st.atkIndex].nm || 'Attaque' : 'Attaque';
    })();

    // Jet d'attaque (avantage/désavantage).
    let nat, dice;
    if (st.mode === 'adv' || st.mode === 'dis') {
      const a = rng(1, 20);
      const b = rng(1, 20);
      nat = st.mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
      dice = [a, b];
    } else {
      nat = rng(1, 20);
      dice = [nat];
    }
    const totalAtk = nat + bonus;
    const crit = nat === 20;
    const fumble = nat === 1;
    const hit = crit || (!fumble && (ac == null || totalAtk >= ac));

    const aName = tokenLabel(attacker);
    const tName = tokenLabel(target);
    const modeTag = st.mode === 'adv' ? ' (avantage)' : st.mode === 'dis' ? ' (désavantage)' : '';

    let dmgInfo = null;
    let applied = 'none';
    if (hit) {
      dmgInfo = rollDamage(dmgIn.value, crit);
      if (dmgInfo && dmgInfo.total > 0) applied = applyDamage(target, dmgInfo.total);
    }

    // Journal de combat (partagé temps réel).
    const verdict = crit ? 'CRITIQUE' : fumble ? 'échec critique' : hit ? 'touché' : 'raté';
    let line = `⚔ ${aName} → ${tName} [${atkName}] : ${totalAtk}${ac != null ? ` vs CA ${ac}` : ''} → ${verdict}`;
    if (hit && dmgInfo) line += `, ${dmgInfo.total} dégâts`;
    if (applied === 'none' && hit && dmgInfo) line += ' (PV non suivis)';
    logCombat(line);

    // Lecture du résultat dans la modale.
    const diceStr = dice.length > 1 ? `[${dice.join(', ')}] → ${nat}` : `${nat}`;
    resultEl.innerHTML = `
      <div class="atk-res-card ${hit ? 'hit' : 'miss'} ${crit ? 'crit' : ''} ${fumble ? 'fumble' : ''}">
        <div class="atk-res-head">${crit ? '💥 CRITIQUE !' : fumble ? '🎯 Échec critique' : hit ? '✔ Touché' : '✘ Raté'}</div>
        <div class="atk-res-line">d20${modeTag} : <b>${diceStr}</b> ${bonus >= 0 ? `+ ${bonus}` : `- ${-bonus}`} = <b>${totalAtk}</b>${ac != null ? ` vs CA ${ac}` : ''}</div>
        ${hit && dmgInfo
          ? `<div class="atk-res-line">Dégâts${crit ? ' (dés doublés)' : ''} : ${dmgInfo.rolls.length ? `[${dmgInfo.rolls.join(', ')}]` : ''}${dmgInfo.modifier ? ` ${dmgInfo.modifier > 0 ? '+' : ''}${dmgInfo.modifier}` : ''} = <b>${dmgInfo.total}</b></div>
             <div class="atk-res-line ${applied === 'none' ? 'muted' : ''}">${applied === 'none' ? '⚠ Cible non liée — PV non appliqués.' : applied === 'sent' ? `→ envoyé au MJ pour ${escapeHtml(tName)}` : `→ appliqués à ${escapeHtml(tName)}`}</div>`
          : ''}
      </div>`;
    // Rafraîchit l'affichage des PV cible (après application).
    setTimeout(fillTarget, 60);
  }
}

/* ── Attaque groupée (plusieurs cibles) ──────────────────────── */
function openMultiAttack(attackerTokenId, targetIdList) {
  const tokens = store.get().map?.tokens || [];
  const st = { atkId: attackerTokenId || tokens[0]?.id, atkIndex: 0, mode: 'normal' };
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay atk-overlay show';
  overlay.innerHTML = `
    <div class="modal-card atk-card" role="dialog" aria-modal="true">
      <h3 class="modal-title">⚔ Attaque groupée — ${targetIdList.length} cibles</h3>
      <div class="atk-row"><label>Attaquant</label><select class="atk-sel" id="ma-attacker"></select></div>
      <div class="atk-row"><label>Attaque</label><select class="atk-sel" id="ma-which"></select></div>
      <div class="atk-row atk-grid2">
        <div><label>Bonus att.</label><input class="atk-in" id="ma-bonus" placeholder="+5"></div>
        <div><label>Dégâts</label><input class="atk-in" id="ma-dmg" placeholder="1d8+3"></div>
      </div>
      <div class="atk-row">
        <label>Jet</label>
        <div class="atk-modes" id="ma-mode">
          <button data-mode="normal" class="active">Normal</button>
          <button data-mode="adv">Avantage</button>
          <button data-mode="dis">Désavantage</button>
        </div>
      </div>
      <div class="atk-result" id="ma-result"></div>
      <div class="modal-actions">
        <button class="modal-btn atk-close">Fermer</button>
        <button class="modal-btn modal-ok" id="ma-go">🎲 Résoudre sur ${targetIdList.length} cibles</button>
      </div>
    </div>`;
  document.body.appendChild(overlay);
  _overlay = overlay;
  document.addEventListener('keydown', _onKey, true);

  const $ = (s) => overlay.querySelector(s);
  const attackerSel = $('#ma-attacker');
  const whichSel = $('#ma-which');
  const bonusIn = $('#ma-bonus');
  const dmgIn = $('#ma-dmg');
  attackerSel.innerHTML = tokens.map((t) => `<option value="${t.id}" ${t.id === st.atkId ? 'selected' : ''}>${escapeHtml(tokenLabel(t))}</option>`).join('');

  const curAttacker = () => tokens.find((t) => t.id === st.atkId);
  function fillAttacks() {
    const atks = tokenAttacks(curAttacker());
    whichSel.innerHTML = atks.map((a, i) => `<option value="${i}">${escapeHtml(a.nm || `Attaque ${i + 1}`)}</option>`).join('') + `<option value="-1">✏ Manuel…</option>`;
    if (st.atkIndex >= atks.length) st.atkIndex = atks.length ? 0 : -1;
    whichSel.value = String(st.atkIndex);
    if (st.atkIndex >= 0 && atks[st.atkIndex]) {
      bonusIn.value = atks[st.atkIndex].bon || '';
      dmgIn.value = atks[st.atkIndex].dmg || '';
    }
  }
  attackerSel.addEventListener('change', () => {
    st.atkId = attackerSel.value;
    st.atkIndex = 0;
    fillAttacks();
  });
  whichSel.addEventListener('change', () => {
    st.atkIndex = Number(whichSel.value);
    const atks = tokenAttacks(curAttacker());
    if (st.atkIndex >= 0 && atks[st.atkIndex]) {
      bonusIn.value = atks[st.atkIndex].bon || '';
      dmgIn.value = atks[st.atkIndex].dmg || '';
    }
  });
  overlay.querySelectorAll('#ma-mode button').forEach((b) =>
    b.addEventListener('click', () => {
      st.mode = b.dataset.mode;
      overlay.querySelectorAll('#ma-mode button').forEach((x) => x.classList.toggle('active', x === b));
    })
  );
  overlay.querySelector('.atk-close').addEventListener('click', closeResolver);
  overlay.addEventListener('mousedown', (e) => {
    if (e.target === overlay) closeResolver();
  });
  fillAttacks();

  overlay.querySelector('#ma-go').addEventListener('click', () => {
    const attacker = curAttacker();
    const bonus = parseInt(String(bonusIn.value).replace(/[^\d+-]/g, ''), 10) || 0;
    const atks = tokenAttacks(attacker);
    const atkName = st.atkIndex >= 0 && atks[st.atkIndex] ? atks[st.atkIndex].nm || 'Attaque' : 'Attaque';
    const rows = targetIdList.map((tid) => {
      const target = tokens.find((t) => t.id === tid);
      if (!target) return null;
      let nat;
      if (st.mode === 'adv' || st.mode === 'dis') {
        const a = rng(1, 20);
        const b = rng(1, 20);
        nat = st.mode === 'adv' ? Math.max(a, b) : Math.min(a, b);
      } else nat = rng(1, 20);
      const ac = tokenAC(target);
      const totalAtk = nat + bonus;
      const crit = nat === 20;
      const fumble = nat === 1;
      const hit = crit || (!fumble && (ac == null || totalAtk >= ac));
      let dmg = 0;
      let applied = 'none';
      if (hit) {
        const di = rollDamage(dmgIn.value, crit);
        if (di) {
          dmg = di.total;
          if (dmg > 0) applied = applyDamage(target, dmg);
        }
      }
      logCombat(`⚔ ${tokenLabel(attacker)} → ${tokenLabel(target)} [${atkName}] : ${totalAtk}${ac != null ? ` vs CA ${ac}` : ''} → ${crit ? 'CRITIQUE' : fumble ? 'échec critique' : hit ? 'touché' : 'raté'}${hit && dmg ? `, ${dmg} dégâts` : ''}`);
      return { name: tokenLabel(target), totalAtk, ac, hit, crit, fumble, dmg, applied };
    }).filter(Boolean);
    overlay.querySelector('#ma-result').innerHTML = `<div class="zs-rows">${rows
      .map(
        (r) =>
          `<div class="zs-line ${r.hit ? 'ok' : 'ko'}"><span>${escapeHtml(r.name)}</span><span>${r.totalAtk}${r.ac != null ? `/${r.ac}` : ''} ${r.crit ? '💥' : r.hit ? '✔' : '✘'}</span><span>${r.dmg ? `−${r.dmg}` : '0'}${r.applied === 'none' && r.dmg ? ' ⚠' : ''}</span></div>`
      )
      .join('')}</div>`;
  });
}
