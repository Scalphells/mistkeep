import { backend } from './backend.js';
import { store } from '../state.js';
import { showToast } from './toast.js';

/**
 * Notifications globales : abonnement aux nouveaux messages privés et handouts
 * dès la connexion (indépendamment de l'onglet ouvert). Met à jour les
 * compteurs de non-lus (`unreadMessages`, `unreadHandouts`) et affiche des
 * toasts. La RLS garantit qu'on ne reçoit que ce qui nous concerne.
 *
 * Pour éviter de gonfler le compteur quand l'onglet concerné est déjà ouvert,
 * on compare au `sideTab` courant. Une fonction de navigation peut être
 * injectée pour rendre les toasts cliquables.
 */

let channel = null;
let _navigate = null;

export function setNotifyNavigate(fn) {
  _navigate = fn;
}

export function initNotify() {
  if (channel) return;
  const myId = store.get().user?.id;

  channel = backend.realtime
    .channel('notify_feed')
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, ({ new: m }) => {
      if (!m || m.sender_id === myId) return; // pas mes propres messages
      const onChat = store.get().sideTab === 'chat';
      if (!onChat) store.set({ unreadMessages: (store.get().unreadMessages || 0) + 1 });
      if (m.channel === 'dm') {
        showToast(`Message privé de ${m.sender_name || 'Anonyme'}`, {
          type: 'info',
          icon: '🎭',
          onClick: () => _navigate?.('chat'),
        });
      }
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'handouts' }, ({ new: h }) => {
      if (!h || h.pushed_by === myId) return;
      const onHandouts = store.get().sideTab === 'handouts';
      if (!onHandouts) store.set({ unreadHandouts: (store.get().unreadHandouts || 0) + 1 });
      showToast(`Nouveau document : ${h.title || 'Handout'}`, {
        type: 'success',
        icon: '🖼',
        onClick: () => _navigate?.('handouts'),
      });
    })
    .subscribe();
}

export function stopNotify() {
  if (channel) backend.realtime.removeChannel(channel);
  channel = null;
}
