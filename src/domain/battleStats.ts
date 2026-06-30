import type { SpeciesOption, StatKey, StatPointSpread } from './types';
import { EMPTY_SPREAD, STAT_KEYS } from './types';
import { natureModifiersForName } from './pokemonData';
import { STAT_POINT_PER_STAT_LIMIT, normalizeStatPoints } from './statPoints';

export function natureMultiplierForStat(nature: string, stat: StatKey): number {
  if (stat === 'hp') return 1;

  const modifiers = natureModifiersForName(nature);
  if (modifiers.plus === stat) return 1.1;
  if (modifiers.minus === stat) return 0.9;
  return 1;
}

export function calculateBattleStat(
  species: SpeciesOption,
  stat: StatKey,
  nature: string,
  statPoints: Partial<StatPointSpread>,
): number {
  const points = normalizeStatPoints(statPoints)[stat];

  if (stat === 'hp') return species.baseStats.hp + points + 75;

  return Math.floor((species.baseStats[stat] + points + 20) * natureMultiplierForStat(nature, stat));
}

export function calculateBattleStats(
  species: SpeciesOption,
  nature: string,
  statPoints: Partial<StatPointSpread>,
): Record<StatKey, number> {
  return STAT_KEYS.reduce<Record<StatKey, number>>(
    (stats, stat) => ({
      ...stats,
      [stat]: calculateBattleStat(species, stat, nature, statPoints),
    }),
    { ...EMPTY_SPREAD },
  );
}

export function calculatePerStatMaximumStats(
  species: SpeciesOption,
  nature: string,
): Record<StatKey, number> {
  return STAT_KEYS.reduce<Record<StatKey, number>>(
    (stats, stat) => ({
      ...stats,
      [stat]: calculateBattleStat(species, stat, nature, { [stat]: STAT_POINT_PER_STAT_LIMIT }),
    }),
    { ...EMPTY_SPREAD },
  );
}
