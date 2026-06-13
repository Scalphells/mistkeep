import { describe, it, expect, beforeEach } from 'vitest';
import { t, setLocale, getLocale, LOCALES, DEFAULT_LOCALE } from '../src/lib/i18n.js';

describe('i18n', () => {
  beforeEach(() => setLocale('fr')); // état déterministe entre les tests

  it('langue par défaut = français', () => {
    expect(DEFAULT_LOCALE).toBe('fr');
    expect(getLocale()).toBe('fr');
  });

  it('traduit selon la langue active', () => {
    expect(t('prefs.close')).toBe('Fermer');
    setLocale('en');
    expect(getLocale()).toBe('en');
    expect(t('prefs.close')).toBe('Close');
  });

  it('repli sur la clé brute si elle est inconnue (traduction progressive)', () => {
    setLocale('en');
    expect(t('cle.inexistante')).toBe('cle.inexistante');
  });

  it('langue inconnue ignorée (reste l’actuelle)', () => {
    setLocale('xx');
    expect(getLocale()).toBe('fr');
  });

  it('interpole les paramètres {name}', () => {
    expect(t('Bonjour {name}', { name: 'Aé' })).toBe('Bonjour Aé');
  });

  it('LOCALES expose fr et en avec un libellé', () => {
    expect(LOCALES.map((l) => l.code)).toEqual(['fr', 'en']);
    expect(LOCALES.every((l) => typeof l.label === 'string' && l.label)).toBe(true);
  });

  it('parité des clés entre fr et en (aucune clé orpheline)', async () => {
    const fr = (await import('../src/locales/fr.json')).default;
    const en = (await import('../src/locales/en.json')).default;
    expect(Object.keys(en).sort()).toEqual(Object.keys(fr).sort());
  });
});
