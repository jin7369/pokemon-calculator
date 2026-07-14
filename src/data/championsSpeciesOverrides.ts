export interface ChampionsSpeciesOverride {
  readonly baseStats?: Readonly<{
    hp: number;
    atk: number;
    def: number;
    spa: number;
    spd: number;
    spe: number;
  }>;
}

// Keep Champions-specific differences from the upstream battle data in this table.
export const CHAMPIONS_SPECIES_OVERRIDES = {
  'Starmie-Mega': {
    baseStats: {
      hp: 60,
      atk: 100,
      def: 105,
      spa: 130,
      spd: 105,
      spe: 120,
    },
  },
} as const satisfies Record<string, ChampionsSpeciesOverride>;
