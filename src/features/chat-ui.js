import { store } from '../state.js';
import { escapeHtml } from '../lib/utils.js';
import { modalConfirm } from '../lib/modal.js';
import { loadPlayers, characterNameForUser } from './characters.js';
import { colorFor, initials } from '../lib/profile.js';
import { rollCardHtml, rollVisibleTo, richCardHtml } from '../lib/chatcards.js';
import { parseCard } from '../lib/chatpost.js';
import { loadRecentRolls, subscribeRolls } from './dice.js';
import { loadCombatLog, subscribeInitiative } from './initiative.js';
import { applyFromButton } from '../lib/applyroll.js';
import {
  loadMessages,
  sendMessage,
  subscribeMessages,
  clearChannel,
} from './chat.js';
import { t } from '../lib/i18n.js';

/**
 * UI du chat partagé : canal Public + canal Privé (MJ ↔ joueur).
 * Couleurs/avatars issus du profil de l'expéditeur (lib/profile).
 * Renvoie une fonction de cleanup.
 */

/** Joueur « en face » d'un message privé, du point de vue du MJ. */
function peerOf(m, myId) {
  return m.sender_id === myId ? m.recipient_id : m.sender_id;
}

export async function mountChat(container) {
  const { isDM } = store.get();

  container.innerHTML = `
    <div class="chat-wrap">
      <header class="chat-bar">
        <div class="chat-channels">
          <button class="chat-chan active" data-chan="public">${t('chat.public')}</button>
          <button class="chat-chan" data-chan="dm">${isDM ? t('chat.dm.asDM') : t('chat.dm.asPlayer')}</button>
        </div>
        ${isDM ? `<button class="chat-clear" id="chat-clear" title="${t('chat.clear.title')}">${t('chat.clear')}</button>` : ''}
      </header>
      <div class="chat-filters" id="chat-filters">
        <button class="chat-filter active" data-filter="all">${t('chat.filter.all')}</button>
        <button class="chat-filter" data-filter="chat">${t('chat.filter.chat')}</button>
        <button class="chat-filter" data-filter="roll">${t('chat.filter.roll')}</button>
        <button class="chat-filter" data-filter="sys">${t('chat.filter.sys')}</button>
      </div>
      ${isDM ? `<div class="chat-peers" id="chat-peers" hidden></div>` : ''}
      <section class="chat-feed" id="chat-feed"></section>
      <form class="chat-form" id="chat-form">
        <input id="chat-input" type="text" placeholder="${t('chat.placeholder')}" autocomplete="off" maxlength="2000" />
        <button class="btn chat-send" type="submit">${t('chat.send')}</button>
      </form>
      <div class="chat-err" id="chat-err"></div>
    </div>
  `;

  const input = container.querySelector('#chat-input');
  const err = container.querySelector('#chat-err');
  const peersBar = container.querySelector('#chat-peers');
  const filtersBar = container.querySelector('#chat-filters');
  let feedFilter = 'all'; // all | chat | roll | sys (canal public uniquement)

  function syncChannelUI() {
    const chan = store.get().chatTab;
    if (peersBar) peersBar.hidden = !(isDM && chan === 'dm');
    if (filtersBar) filtersBar.hidden = chan === 'dm'; // filtres = canal public
    if (isDM && chan === 'dm') renderPeers();
    updateInputState();
    renderFeed();
  }

  filtersBar?.querySelectorAll('[data-filter]').forEach((b) =>
    b.addEventListener('click', () => {
      feedFilter = b.dataset.filter;
      filtersBar.querySelectorAll('[data-filter]').forEach((x) => x.classList.toggle('active', x === b));
      renderFeed();
    })
  );

  container.querySelectorAll('[data-chan]').forEach((b) =>
    b.addEventListener('click', () => {
      store.set({ chatTab: b.dataset.chan });
      container
        .querySelectorAll('[data-chan]')
        .forEach((x) => x.classList.toggle('active', x === b));
      syncChannelUI();
      input.focus();
    })
  );

  container.querySelector('#chat-clear')?.addEventListener('click', async () => {
    const chan = store.get().chatTab;
    const msg = chan === 'dm' ? t('chat.clear.confirm.dm') : t('chat.clear.confirm.public');
    if (await modalConfirm(msg, { title: t('chat.clear.modalTitle'), danger: true, okLabel: t('chat.clear.ok') })) {
      clearChannel(chan);
    }
  });

  function updateInputState() {
    const chan = store.get().chatTab;
    if (isDM && chan === 'dm' && !store.get().dmPeer) {
      input.disabled = true;
      input.placeholder = t('chat.input.pickPeer');
    } else {
      input.disabled = false;
      input.placeholder =
        chan === 'dm'
          ? isDM ? t('chat.input.dmReply') : t('chat.input.toDM')
          : t('chat.placeholder');
    }
  }

  function renderPeers() {
    if (!peersBar) return;
    const players = store.get().players.filter((p) => p.role !== 'dm');
    const peer = store.get().dmPeer;
    if (!players.length) {
      peersBar.innerHTML = `<span class="chat-peers-empty">${t('chat.peers.empty')}</span>`;
      return;
    }
    peersBar.innerHTML = players
      .map((p) => {
        const name = p.display_name || p.email || t('chat.player');
        return `<button class="chat-peer ${p.id === peer ? 'active' : ''}" data-peer="${p.id}"
                  style="--peer:${colorFor(p.id, name)}">${escapeHtml(name)}</button>`;
      })
      .join('');
    peersBar.querySelectorAll('[data-peer]').forEach((b) =>
      b.addEventListener('click', () => {
        store.set({ dmPeer: b.dataset.peer });
        renderPeers();
        updateInputState();
        renderFeed();
        input.focus();
      })
    );
  }

  container.querySelector('#chat-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const chan = store.get().chatTab;
    const recipient = isDM && chan === 'dm' ? store.get().dmPeer : null;
    if (isDM && chan === 'dm' && !recipient) {
      err.textContent = t('chat.err.pickPeer');
      return;
    }
    err.textContent = '';
    try {
      await sendMessage(text, chan, recipient);
      input.value = '';
    } catch (ex) {
      err.textContent = ex.message || t('chat.err.send');
    }
  });

  // Le MJ a besoin de la liste des joueurs pour le canal privé.
  if (isDM && !store.get().players.length) {
    try {
      await loadPlayers();
    } catch {
      /* no-op */
    }
  }

  // Application aux cibles depuis une carte de jet (MJ) — délégation.
  container.querySelector('#chat-feed').addEventListener('click', (e) => {
    const b = e.target.closest('[data-apply]');
    if (!b) return;
    applyFromButton(b.dataset.apply, Number(b.dataset.amount));
  });

  await loadMessages();
  // Le chat affiche aussi les jets de dés ET le journal de combat (façon Foundry).
  // On s'assure que tout est chargé et suivi en temps réel (abonnements idempotents).
  await Promise.all([loadRecentRolls().catch(() => {}), loadCombatLog().catch(() => {})]);
  const unsubRealtime = subscribeMessages();
  subscribeRolls();
  subscribeInitiative();
  // Le chat ne dépend pas de la carte/combat/notes… : ne pas reconstruire le fil
  // quand seules ces clés changent. NB : `characters` reste actif (les noms de
  // perso affichés viennent de characterNameForUser → store.characters), idem
  // `combatLog`/`players`. Coalesce aussi les rafales en un rendu par frame.
  const CHAT_IGNORE = [
    'map', 'scenes', 'activeSceneId', 'targets', 'paused', 'initiative',
    'initTurn', 'initRound', 'activeChar', 'handouts', 'sessionNotes',
    'compendium', 'compendiumOpenId', 'unreadMessages', 'unreadHandouts',
    'vaultFiles', 'fileTree', 'openTabs', 'activeTab', 'edits', 'ambience',
    'sfxboard', 'imagebank', 'campaign', 'clock', 'sideTab', 'toolTab',
  ];
  let _feedRaf = 0;
  const unsubStore = store.subscribe(() => {
    if (_feedRaf) return;
    _feedRaf = requestAnimationFrame(() => {
      _feedRaf = 0;
      if (isDM && store.get().chatTab === 'dm') renderPeers();
      renderFeed();
    });
  }, { except: CHAT_IGNORE });

  // Sélection par défaut d'un joueur côté MJ.
  if (isDM && !store.get().dmPeer) {
    const first = store.get().players.find((p) => p.role !== 'dm');
    if (first) store.set({ dmPeer: first.id });
  }

  syncChannelUI();

  return () => {
    if (_feedRaf) cancelAnimationFrame(_feedRaf);
    unsubStore();
    unsubRealtime();
  };

  /* ── Rendu du fil ── */
  function renderFeed() {
    const el = container.querySelector('#chat-feed');
    if (!el) return;
    const { messages, diceHist, chatTab, user, dmPeer } = store.get();

    const stick = el.scrollHeight - el.scrollTop - el.clientHeight < 80;

    const combatLog = store.get().combatLog || [];

    // Construction d'une frise unifiée (messages + jets de dés + combat, façon Foundry).
    let items;
    if (chatTab === 'dm' && isDM) {
      // Fil privé avec le joueur sélectionné : texte uniquement.
      items = messages
        .filter((m) => m.channel === 'dm' && peerOf(m, user?.id) === dmPeer)
        .map((m) => ({ kind: 'msg', t: +new Date(m.created_at), data: m }));
    } else if (chatTab === 'dm') {
      // Joueur : ses messages privés avec le MJ.
      items = messages
        .filter((m) => m.channel === 'dm')
        .map((m) => ({ kind: 'msg', t: +new Date(m.created_at), data: m }));
    } else {
      // Canal public : messages/cartes + jets de dés + journal de combat, triés par heure.
      items = messages
        .filter((m) => m.channel === 'public')
        .map((m) => {
          const card = parseCard(m.content);
          return { kind: card ? 'card' : 'msg', t: +new Date(m.created_at), data: m, card };
        });
      for (const r of diceHist || []) {
        if (rollVisibleTo(r, { isDM, user })) {
          items.push({ kind: 'roll', t: +new Date(r.created_at), data: r });
        }
      }
      for (const e of combatLog) {
        if (!e.dm || isDM) items.push({ kind: 'sys', t: e.t, data: e });
      }
      items.sort((a, b) => a.t - b.t);

      // Filtre de vue (chips) : Discussion = bulles + cartes riches ; Dés = jets ;
      // Combat = lignes système du journal de combat.
      if (feedFilter !== 'all') {
        const want = feedFilter === 'chat' ? ['msg', 'card'] : feedFilter === 'roll' ? ['roll'] : ['sys'];
        items = items.filter((it) => want.includes(it.kind));
      }
    }

    if (!items.length) {
      el.innerHTML = `<div class="chat-empty">${
        chatTab === 'dm'
          ? isDM
            ? t('chat.empty.dm.asDM')
            : t('chat.empty.dm.asPlayer')
          : t('chat.empty.public')
      }</div>`;
      return;
    }

    let html = '';
    let lastDay = '';
    let lastSender = null;

    for (const it of items) {
      const date = new Date(it.t);
      const day = dayLabel(date);
      if (day !== lastDay) {
        html += `<div class="chat-day"><span>${day}</span></div>`;
        lastDay = day;
        lastSender = null;
      }

      if (it.kind === 'roll') {
        lastSender = null; // une carte de jet coupe le groupage des bulles
        html += `<div class="chat-rollcard">${rollCardHtml(it.data, { isDM, user })}</div>`;
        continue;
      }
      if (it.kind === 'card') {
        lastSender = null;
        html += `<div class="chat-rollcard">${richCardHtml(it.card, it.data)}</div>`;
        continue;
      }
      if (it.kind === 'sys') {
        lastSender = null;
        html += `<div class="chat-sys ${it.data.dm ? 'dm' : ''}">${escapeHtml(it.data.text)}</div>`;
        continue;
      }

      const m = it.data;
      const mine = m.sender_id && m.sender_id === user?.id;
      const grouped = lastSender === m.sender_id;
      lastSender = m.sender_id;

      const time = date.toLocaleTimeString(t('locale.bcp47'), { hour: '2-digit', minute: '2-digit' });
      const color = colorFor(m.sender_id, m.sender_name);
      const who = characterNameForUser(m.sender_id) || m.sender_name;

      html += `
        <div class="chat-msg ${mine ? 'mine' : ''} ${grouped ? 'grouped' : ''}" style="--c:${color}">
          ${
            grouped
              ? '<div class="chat-avatar-spacer"></div>'
              : `<div class="chat-avatar" style="background:${color}">${escapeHtml(initials(who))}</div>`
          }
          <div class="chat-bubble">
            ${
              grouped
                ? ''
                : `<div class="chat-msg-head">
                     <strong style="color:${color}">${escapeHtml(who)}</strong>
                     <span class="chat-time">${time}</span>
                   </div>`
            }
            <div class="chat-body">${escapeHtml(m.content)}</div>
          </div>
        </div>`;
    }

    el.innerHTML = html;
    if (stick) el.scrollTop = el.scrollHeight;
  }
}

function dayLabel(d) {
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  if (sameDay(d, today)) return t('date.today');
  if (sameDay(d, yest)) return t('date.yesterday');
  return d.toLocaleDateString(t('locale.bcp47'), { day: '2-digit', month: 'long' });
}
