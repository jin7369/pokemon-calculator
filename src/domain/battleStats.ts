import type { SpeciesOption, StatKey, StatPointSpread } from './types';
import { EMPTY_SPREAD, STAT_KEYS } from './types';
import { natureModifiersForName } from './pokemonData';
import { STAT_POINT_PER_STAT_LIMIT, statPointsToEvs } from './statPoints';

export const DEFAULT_IV = 31;
export const DEFAULT_BATTLE_LEVEL = 50;

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
  level = DEFAULT_BATTLE_LEVEL,
): number {
  const ev = statPointsToEvs(statPoints)[stat];
  const baseValue = Math.floor(((2 * species.baseStats[stat] + DEFAULT_IV + Math.floor(ev / 4)) * level) / 100);

  if (stat === 'hp') return baseValue + level + 10;

  return Math.floor((baseValue + 5) * natureMultiplierForStat(nature, stat));
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
