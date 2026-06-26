import { describe, expect, it } from 'vitest';
import {
  displayNameForMove,
  displayNameForSpecies,
  getMoveOption,
  getLearnableAttackMoveOptionsForSpecies,
  getSpeciesOption,
  getSpeciesOptionsThatLearnMove,
  MOVE_OPTIONS,
  NATURE_OPTIONS,
  natureModifiersForName,
  natureNameForModifiers,
  POKEMON_OPTIONS,
  resolveMoveName,
  resolveSpeciesName,
} from './pokemonData';

describe('pokemon Korean display names', () => {
  it('displays base species in Korean', () => {
    expect(displayNameForSpecies('Charizard')).toBe('리자몽');
    expect(displayNameForSpecies('Pikachu')).toBe('피카츄');
  });

  it('keeps form names distinguishable', () => {
    expect(displayNameForSpecies('Charizard-Mega-X')).toBe('메가리자몽X');
    expect(displayNameForSpecies('Charizard-Gmax')).toBe('리자몽 (Gmax)');
  });

  it('resolves Korean and English names to the internal Smogon name', () => {
    expect(resolveSpeciesName('리자몽')).toBe('Charizard');
    expect(resolveSpeciesName('Charizard')).toBe('Charizard');
  });

  it('stores the Korean display name on species options', () => {
    expect(getSpeciesOption('Pikachu')?.displayName).toBe('피카츄');
  });

  it('stores selectable abilities on species options', () => {
    expect(getSpeciesOption('Charizard')?.abilities).toContain('Blaze');
    expect(getSpeciesOption('Charizard')?.abilities).toContain('Solar Power');
  });

  it('disambiguates localized form names that would otherwise collide', () => {
    expect(displayNameForSpecies('Kommo-o')).toBe('짜랑고우거');
    expect(getSpeciesOption('Kommo-o')?.displayName).toBe('짜랑고우거');
    expect(displayNameForSpecies('Kommo-o-Totem')).toBe('짜랑고우거 (Totem)');
  });

  it('filters species options to the current Pokemon Champions ruleset', () => {
    expect(getSpeciesOption('Charizard')).not.toBeNull();
    expect(getSpeciesOption('Charizard-Mega-X')).not.toBeNull();
    expect(getSpeciesOption('Pikachu')).not.toBeNull();
    expect(getSpeciesOption('Pidgeot')).not.toBeNull();
    expect(getSpeciesOption('Gholdengo')).not.toBeNull();
    expect(getSpeciesOption('Annihilape')).not.toBeNull();
    expect(getSpeciesOption('Floette-Eternal')).not.toBeNull();
    expect(getSpeciesOption('Palafin-Hero')).not.toBeNull();
    expect(getSpeciesOption('Caterpie')).toBeNull();
    expect(getSpeciesOption('Clodsire')).toBeNull();
    expect(getSpeciesOption('Syclant')).toBeNull();
    expect(resolveSpeciesName('캐터피')).toBeNull();
  });

  it('keeps species option display names unique', () => {
    expect(new Set(POKEMON_OPTIONS.map((species) => species.displayName)).size).toBe(POKEMON_OPTIONS.length);
  });

  it('returns learnable attacking moves for a selected species', () => {
    expect(getLearnableAttackMoveOptionsForSpecies('Charizard').some((move) => move.name === 'Flamethrower')).toBe(true);
    expect(getLearnableAttackMoveOptionsForSpecies('Gholdengo').some((move) => move.name === 'Thunderbolt')).toBe(true);
    expect(getLearnableAttackMoveOptionsForSpecies('Caterpie')).toEqual([]);
  });

  it('returns ruleset species that can learn a selected attacking move', () => {
    const flamethrowerLearners = getSpeciesOptionsThatLearnMove('Flamethrower').map((species) => species.name);

    expect(flamethrowerLearners).toContain('Charizard');
    expect(flamethrowerLearners).not.toContain('Pikachu');
    expect(getSpeciesOptionsThatLearnMove('Splash')).toEqual([]);
  });

  it('stores multi-hit metadata on attacking moves', () => {
    expect(getMoveOption('Icicle Spear')?.multiHit).toMatchObject({
      min: 2,
      max: 5,
      defaultHits: 3,
      supportsSkillLink: true,
      supportsLoadedDice: true,
    });
    expect(getMoveOption('Population Bomb')?.multiHit?.selectableHits).toHaveLength(10);
  });
});

describe('move Korean display names', () => {
  it('displays official moves in Korean', () => {
    expect(displayNameForMove('Flamethrower')).toBe('화염방사');
    expect(displayNameForMove('Thunderbolt')).toBe('10만볼트');
  });

  it('displays manually verified newer moves in Korean', () => {
    expect(displayNameForMove('Aqua Cutter')).toBe('아쿠아커터');
    expect(displayNameForMove('Tera Blast')).toBe('테라버스트');
  });

  it('keeps typed Hidden Power variants distinguishable', () => {
    expect(displayNameForMove('Hidden Power Fire')).toBe('잠재파워 (불꽃)');
  });

  it('resolves Korean and English move names to the internal Smogon name', () => {
    expect(resolveMoveName('화염방사')).toBe('Flamethrower');
    expect(resolveMoveName('테라버스트')).toBe('Tera Blast');
    expect(resolveMoveName('Flamethrower')).toBe('Flamethrower');
  });

  it('stores the Korean display name on move options', () => {
    expect(getMoveOption('Flamethrower')?.displayName).toBe('화염방사');
  });

  it('keeps move option display names unique', () => {
    expect(new Set(MOVE_OPTIONS.map((move) => move.displayName)).size).toBe(MOVE_OPTIONS.length);
  });
});

describe('nature options', () => {
  it('keeps only one neutral nature option', () => {
    const neutralNatures = NATURE_OPTIONS.filter((nature) => nature.label.includes('무보정'));
    const natureNames = NATURE_OPTIONS.map((nature) => nature.name);

    expect(neutralNatures).toEqual([
      { id: 'serious', name: 'Serious', label: 'Serious (무보정)', plus: null, minus: null },
    ]);
    expect(natureNames).not.toContain('Hardy');
    expect(natureNames).not.toContain('Docile');
    expect(natureNames).not.toContain('Bashful');
    expect(natureNames).not.toContain('Quirky');
  });

  it('keeps boosted nature labels explicit', () => {
    expect(NATURE_OPTIONS[0]).toEqual({
      id: 'serious',
      name: 'Serious',
      label: 'Serious (무보정)',
      plus: null,
      minus: null,
    });
    expect(NATURE_OPTIONS).toContainEqual({
      id: 'modest',
      name: 'Modest',
      label: 'Modest (+특공 / -공격)',
      plus: 'spa',
      minus: 'atk',
    });
  });

  it('maps nature modifiers back to calc nature names', () => {
    expect(natureNameForModifiers('spa', 'atk')).toBe('Modest');
    expect(natureNameForModifiers('atk', 'spa')).toBe('Adamant');
    expect(natureNameForModifiers(null, null)).toBe('Serious');
    expect(natureNameForModifiers('atk', 'atk')).toBe('Serious');
  });

  it('maps calc nature names to stat modifiers', () => {
    expect(natureModifiersForName('Modest')).toEqual({ plus: 'spa', minus: 'atk' });
    expect(natureModifiersForName('Serious')).toEqual({ plus: null, minus: null });
  });
});
