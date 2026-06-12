/**
 * Carillon de tour : deux notes brèves (WebAudio, aucun asset) jouées quand
 * c'est au joueur d'agir — complète le toast « À toi de jouer ! » pour qui ne
 * regarde pas l'écran. Coupable dans ⚙ Affichage (préférence `turnSound`).
 *
 * Politique d'autoplay : le contexte est créé paresseusement et `resume()`
 * est tenté s'il est suspendu ; en cours de séance, l'utilisateur a déjà
 * interagi avec la page, donc le son passe. En cas d'échec, silence — le
 * toast reste la notification de référence.
 */

let _ctx = null;

export function playTurnChime() {
  try {
    _ctx = _ctx || new (window.AudioContext || window.webkitAudioContext)();
    if (_ctx.state === 'suspended') _ctx.resume();
    const t0 = _ctx.currentTime;
    const gain = _ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.18, t0 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.6);
    gain.connect(_ctx.destination);
    // La quinte la⁵ → mi⁶ : courte, claire, pas agressive.
    for (const [freq, dt] of [[880, 0], [1318.5, 0.16]]) {
      const o = _ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = freq;
      o.connect(gain);
      o.start(t0 + dt);
      o.stop(t0 + dt + 0.45);
    }
  } catch {
    /* WebAudio indisponible : le toast suffit */
  }
}
