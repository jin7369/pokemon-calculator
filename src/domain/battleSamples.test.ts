import { describe, expect, it } from 'vitest';
import {
  SAMPLE_STORAGE_KEY,
  createDefaultBattleSample,
  loadSampleLibrary,
  normalizeSampleForSpecies,
  sanitizeBattleSample,
  saveSampleLibrary,
} from './battleSamples';
import { MEGA_STONE_ITEM_ID } from './battleItems';

class MemoryStorage {
  data = new Map<string, string>();

  getItem(key: string) {
    return this.data.get(key) ?? null;
  }

  setItem(key: string, value: string) {
    this.data.set(key, value);
  }
}

describe('battle samples', () => {
  it('creates a zero-point default sample', () => {
    const sample = createDefaultBattleSample('default');

    expect(sample.id).toBe('default');
    expect(Object.values(sample.statPoints).every((points) => points === 0)).toBe(true);
    expect(sample.moves).toEqual(['Flamethrower']);
  });

  it('sanitizes points, duplicate moves, ability and item', () => {
    const sample = sanitizeBattleSample({
      ...createDefaultBattleSample('sample'),
      statPoints: { hp: 32, atk: 32, def: 32, spa: 32, spd: 32, spe: 32 },
      moves: ['Flamethrower', 'Flamethrower', 'Splash', 'Air Slash'],
      ability: 'Not Real',
      item: 'not-real',
    });

    expect(sample).not.toBeNull();
    expect(Object.values(sample?.statPoints ?? {}).reduce((sum, value) => sum + value, 0)).toBe(66);
    expect(sample?.moves).toEqual(['Flamethrower', 'Air Slash']);
    expect(sample?.ability).toBe('Blaze');
    expect(sample?.abilityEnabled).toBe(false);
    expect(sample?.item).toBe('none');
  });

  it('clears invalid moves and forces a Mega Stone when species changes', () => {
    const sample = normalizeSampleForSpecies(
      { ...createDefaultBattleSample('mega'), item: 'life-orb', moves: ['Flamethrower'] },
      'Starmie-Mega',
    );

    expect(sample.species).toBe('Starmie-Mega');
    expect(sample.item).toBe(MEGA_STONE_ITEM_ID);
    expect(sample.moves).toEqual([]);
    expect(sample.ability).toBe('Huge Power');
  });

  it('round-trips versioned sample data through storage', () => {
    const storage = new MemoryStorage();
    const initial = loadSampleLibrary(storage);
    const warning = saveSampleLibrary(storage, initial.data);
    const loaded = loadSampleLibrary(storage);

    expect(warning).toBeNull();
    expect(storage.data.has(SAMPLE_STORAGE_KEY)).toBe(true);
    expect(loaded.warning).toBeNull();
    expect(loaded.data).toEqual(initial.data);
  });

  it('recovers from malformed or unsupported stored data', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAMPLE_STORAGE_KEY, JSON.stringify({ version: 99, samples: [] }));

    const loaded = loadSampleLibrary(storage);

    expect(loaded.warning).toContain('기본 샘플');
    expect(loaded.data.samples).toHaveLength(1);
  });
});
