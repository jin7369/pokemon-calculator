import { describe, expect, it } from 'vitest';
import {
  displayNameForMove,
  displayNameForSpecies,
  getMoveOption,
  getSpeciesOption,
  MOVE_OPTIONS,
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
