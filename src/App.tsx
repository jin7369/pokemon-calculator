import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Gauge, Search, Shield, SlidersHorizontal, Swords } from 'lucide-react';
import './App.css';
import {
  CATEGORY_LABELS,
  EMPTY_SPREAD,
  NATURE_STAT_KEYS,
  SPEED_CATEGORY_LABELS,
  STAT_LABELS,
  STAT_KEYS,
  type AttackConfig,
  type DefenseConfig,
  type DefenderBulkConfig,
  type HitCountSetting,
  type MoveOption,
  type NatureStatKey,
  type SpeedCategory,
  type SpeedConfig,
  type SpeedSortKey,
  type SpeciesOption,
  type SortKey,
  type StatKey,
  type StatPointSpread,
  type SurvivalCategory,
} from './domain/types';
import {
  MOVE_OPTIONS,
  POKEMON_OPTIONS,
  POKEMON_RULESET,
  getLearnableAttackMoveOptionsForSpecies,
  getMoveOption,
  getSpeciesOption,
  getSpeciesOptionsThatLearnMove,
  natureModifiersForName,
  natureNameForModifiers,
  resolveMoveName,
  resolveSpeciesName,
} from './domain/pokemonData';
import {
  calculateDefenseResults,
  calculateAttackResults,
  defensiveStatForCategory,
  offensiveStatForCategory,
  sortResults,
} from './domain/damage';
import {
  STAT_POINT_PER_STAT_LIMIT,
  STAT_POINT_TOTAL_LIMIT,
  normalizeStatPoints,
  totalStatPoints,
  updateStatPoint,
} from './domain/statPoints';
import {
  NO_OFFENSE_ITEM_ID,
  OFFENSE_ITEM_OPTIONS,
  combinedAttackMultiplier,
  formatMultiplier,
  getOffenseItemOption,
  offenseItemMultiplierForMove,
} from './domain/offenseItems';
import {
  NO_SPEED_ITEM_ID,
  SPEED_ITEM_OPTIONS,
  getSpeedItemOption,
} from './domain/speedItems';
import {
  calculateSpeedResults,
  sortSpeedResults,
} from './domain/speed';
import {
  describeHitCountSource,
  formatMoveHitRange,
  resolveAttackHitCount,
} from './domain/multiHit';
import {
  calculateBattleStats,
  calculatePerStatMaximumStats,
} from './domain/battleStats';

type TabKey = 'attack' | 'defense' | 'speed';

type FilterState = Record<SurvivalCategory, boolean>;
type SpeedFilterState = Record<SpeedCategory, boolean>;
type SharedPokemonBuild = {
  pokemon: string;
  nature: string;
  statPoints: StatPointSpread;
};

const DIRECT_MULTIPLIERS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const SPEED_DIRECT_MULTIPLIERS = [0.25, 0.5, 1, 1.5, 2, 4];
const BOOST_STAGES = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
const CATEGORY_ORDER: SurvivalCategory[] = ['survives', 'roll', 'ko'];
const SPEED_CATEGORY_ORDER: SpeedCategory[] = ['outspeeds', 'tie', 'slower'];
const INPUT_DEBOUNCE_MS = 180;
const SEARCH_DEBOUNCE_MS = 120;
const POKEMON_PICKER_PAGE_SIZE = 10;
const MOVE_PICKER_PAGE_SIZE = 10;
const TARGET_RESULTS_PAGE_SIZE = 10;
const EMPTY_ABILITY_OPTIONS: string[] = [];

const INITIAL_ATTACK: AttackConfig = {
  attacker: '리자몽',
  move: '화염방사',
  item: NO_OFFENSE_ITEM_ID,
  ability: 'Blaze',
  abilityEnabled: false,
  hitCount: 'auto',
  nature: 'Modest',
  attackStatPoints: { atk: 0, spa: 31 },
  boostStage: 0,
  directMultiplier: 1,
};

const INITIAL_DEFENDER_BULK: DefenderBulkConfig = {
  nature: 'Serious',
  statPoints: { hp: 0, def: 0, spd: 0 },
};

const INITIAL_DEFENSE: DefenseConfig = {
  defender: '리자몽',
  move: '화염방사',
  nature: 'Serious',
  statPoints: { hp: 0, def: 0, spd: 0 },
  attackerNature: 'Modest',
  attackerStatPoints: { atk: 0, spa: 31 },
  attackerBoostStage: 0,
  attackerItem: NO_OFFENSE_ITEM_ID,
  attackerDirectMultiplier: 1,
  hitCount: 'auto',
};

const INITIAL_SPEED: SpeedConfig = {
  pokemon: '리자몽',
  nature: 'Timid',
  statPoints: { spe: 31 },
  boostStage: 0,
  item: NO_SPEED_ITEM_ID,
  directMultiplier: 1,
  targetNature: 'Timid',
  targetStatPoints: { spe: 31 },
  targetBoostStage: 0,
  targetItem: NO_SPEED_ITEM_ID,
  targetDirectMultiplier: 1,
};

const INITIAL_SHARED_POKEMON_BUILD: SharedPokemonBuild = {
  pokemon: '리자몽',
  nature: 'Modest',
  statPoints: {
    ...EMPTY_SPREAD,
    spa: 31,
    spe: 31,
  },
};

const INITIAL_FILTERS: FilterState = {
  survives: true,
  roll: true,
  ko: true,
};

const INITIAL_SPEED_FILTERS: SpeedFilterState = {
  outspeeds: true,
  tie: true,
  slower: true,
};

const TABS: Array<{ key: TabKey; label: string; icon: typeof Swords }> = [
  { key: 'attack', label: '공격', icon: Swords },
  { key: 'defense', label: '수비', icon: Shield },
  { key: 'speed', label: '스피드', icon: Gauge },
];

function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`;
}

function formatBoost(stage: number): string {
  return stage > 0 ? `+${stage}` : `${stage}`;
}

function formatSpeedMargin(value: number): string {
  if (value > 0) return `+${value}`;
  return `${value}`;
}

function formatNatureSummary(nature: string): string {
  const modifiers = natureModifiersForName(nature);
  if (!modifiers.plus || !modifiers.minus) return `${nature} · 무보정`;
  return `${nature} · +${STAT_LABELS[modifiers.plus]} / -${STAT_LABELS[modifiers.minus]}`;
}

function parseHitCountSetting(value: string): HitCountSetting {
  return value === 'auto' ? 'auto' : Number(value);
}

function formatHitCountOption(hits: number): string {
  return `${hits}히트`;
}

function defaultRaisedStatForLowered(lowered: NatureStatKey): NatureStatKey {
  return lowered === 'atk' ? 'spa' : 'atk';
}

function defaultLoweredStatForRaised(raised: NatureStatKey): NatureStatKey {
  if (raised === 'atk') return 'spa';
  return 'atk';
}

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedValue(value), delayMs);
    return () => window.clearTimeout(timer);
  }, [value, delayMs]);

  return debouncedValue;
}

function toFullSpread(partial: Partial<Record<StatKey, number>>) {
  return { ...EMPTY_SPREAD, ...partial };
}

function baseStatTotal(species: SpeciesOption): number {
  return STAT_KEYS.reduce((sum, stat) => sum + species.baseStats[stat], 0);
}

function matchesPokemonOption(option: SpeciesOption, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) return true;

  return (
    option.displayName.toLowerCase().includes(normalizedQuery) ||
    option.name.toLowerCase().includes(normalizedQuery) ||
    option.id.toLowerCase().includes(normalizedQuery) ||
    option.types.some((type) => type.toLowerCase().includes(normalizedQuery))
  );
}

function matchesMoveOption(option: MoveOption, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) return true;

  return (
    option.displayName.toLowerCase().includes(normalizedQuery) ||
    option.name.toLowerCase().includes(normalizedQuery) ||
    option.id.toLowerCase().includes(normalizedQuery) ||
    option.type.toLowerCase().includes(normalizedQuery) ||
    option.category.toLowerCase().includes(normalizedQuery)
  );
}

function StatPointControl({
  stat,
  value,
  total,
  onChange,
}: {
  stat: StatKey;
  value: number;
  total: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="stat-control">
      <span className="stat-control__label">{STAT_LABELS[stat]}</span>
      <input
        type="range"
        min="0"
        max={STAT_POINT_PER_STAT_LIMIT}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <input
        className="stat-control__number"
        type="number"
        min="0"
        max={STAT_POINT_PER_STAT_LIMIT}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
      <span className="stat-control__total">{total}/{STAT_POINT_TOTAL_LIMIT}</span>
    </label>
  );
}

function NatureModifierPicker({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const modifiers = natureModifiersForName(value);
  let modifierText = '무보정';

  if (modifiers.plus && modifiers.minus) {
    modifierText = `+${STAT_LABELS[modifiers.plus]} / -${STAT_LABELS[modifiers.minus]}`;
  }

  function setRaisedStat(nextValue: string) {
    if (nextValue === 'neutral') {
      onChange(natureNameForModifiers(null, null));
      return;
    }

    const nextRaised = nextValue as NatureStatKey;
    const nextLowered = modifiers.minus && modifiers.minus !== nextRaised
      ? modifiers.minus
      : defaultLoweredStatForRaised(nextRaised);

    onChange(natureNameForModifiers(nextRaised, nextLowered));
  }

  function setLoweredStat(nextValue: string) {
    if (nextValue === 'neutral') {
      onChange(natureNameForModifiers(null, null));
      return;
    }

    const nextLowered = nextValue as NatureStatKey;
    const nextRaised = modifiers.plus && modifiers.plus !== nextLowered
      ? modifiers.plus
      : defaultRaisedStatForLowered(nextLowered);

    onChange(natureNameForModifiers(nextRaised, nextLowered));
  }

  return (
    <div className="nature-picker">
      <div className="nature-picker__header">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>

      <div className="nature-picker__fields">
        <label className="field-label">
          <span>올리는 능력치</span>
          <select
            value={modifiers.plus ?? 'neutral'}
            onChange={(event) => setRaisedStat(event.target.value)}
          >
            <option value="neutral">없음</option>
            {NATURE_STAT_KEYS.map((stat) => (
              <option key={stat} value={stat}>
                {STAT_LABELS[stat]}
              </option>
            ))}
          </select>
        </label>

        <label className="field-label">
          <span>내리는 능력치</span>
          <select
            value={modifiers.minus ?? 'neutral'}
            onChange={(event) => setLoweredStat(event.target.value)}
          >
            <option value="neutral">없음</option>
            {NATURE_STAT_KEYS.map((stat) => (
              <option key={stat} value={stat}>
                {STAT_LABELS[stat]}
              </option>
            ))}
          </select>
        </label>
      </div>

      <small>{modifierText}</small>
    </div>
  );
}

function TypeBadge({ type }: { type: string }) {
  return <span className={`type-badge type-${type.toLowerCase()}`}>{type}</span>;
}

function PokemonPicker({
  label,
  value,
  selected,
  options,
  onChange,
}: {
  label: string;
  value: string;
  selected: SpeciesOption | null;
  options: SpeciesOption[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const panelId = `${label.replace(/\s+/g, '-')}-pokemon-picker`;
  const filteredOptions = useMemo(
    () => options.filter((option) => matchesPokemonOption(option, query)),
    [options, query],
  );
  const pageCount = Math.max(1, Math.ceil(filteredOptions.length / POKEMON_PICKER_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * POKEMON_PICKER_PAGE_SIZE;
  const visibleOptions = filteredOptions.slice(pageStart, pageStart + POKEMON_PICKER_PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [query]);

  function selectPokemon(option: SpeciesOption) {
    onChange(option.displayName);
    setIsOpen(false);
    setQuery('');
    setPage(0);
  }

  return (
    <section className="pokemon-picker" aria-label={label}>
      <div className="field-label">
        <span>{label}</span>
        <button
          type="button"
          className="pokemon-picker__selected"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="pokemon-picker__selected-name">
            <strong>{selected?.displayName ?? value}</strong>
            <small>{selected?.name ?? '검색해서 선택'}</small>
          </span>
          {selected ? (
            <span className="type-list">
              {selected.types.map((type) => <TypeBadge key={type} type={type} />)}
            </span>
          ) : null}
          {selected ? <span className="pokemon-picker__selected-total">합계 {baseStatTotal(selected)}</span> : null}
        </button>
      </div>

      {isOpen ? (
        <div className="pokemon-picker__panel" id={panelId}>
          <label className="pokemon-picker__search">
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="포켓몬 이름, 영문명, 타입 검색"
              autoFocus
            />
          </label>

          <div className="pokemon-picker__meta">
            <span>{filteredOptions.length.toLocaleString()}개 결과</span>
            <span>{filteredOptions.length > 0 ? `${pageStart + 1}-${pageStart + visibleOptions.length}` : '0'} 표시</span>
          </div>

          <div className="pokemon-picker__list" role="listbox" aria-label="포켓몬 목록">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={option.name === selected?.name}
                  className={option.name === selected?.name ? 'pokemon-picker__option pokemon-picker__option--selected' : 'pokemon-picker__option'}
                  onClick={() => selectPokemon(option)}
                >
                  <span className="pokemon-picker__option-main">
                    <span>
                      <strong>{option.displayName}</strong>
                      <small>{option.name}</small>
                    </span>
                    <span className="type-list">
                      {option.types.map((type) => <TypeBadge key={type} type={type} />)}
                    </span>
                  </span>
                  <span className="pokemon-picker__option-stats">
                    {STAT_KEYS.map((stat) => (
                      <span key={stat}>
                        <small>{STAT_LABELS[stat]}</small>
                        <strong>{option.baseStats[stat]}</strong>
                      </span>
                    ))}
                    <span>
                      <small>합계</small>
                      <strong>{baseStatTotal(option)}</strong>
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <div className="pokemon-picker__empty">검색 결과 없음</div>
            )}
          </div>

          <div className="pokemon-picker__pagination">
            <button
              type="button"
              aria-label="이전 페이지"
              disabled={safePage === 0}
              onClick={() => setPage((current) => Math.max(current - 1, 0))}
            >
              <ChevronLeft size={17} aria-hidden="true" />
              이전
            </button>
            <span>{safePage + 1}/{pageCount}</span>
            <button
              type="button"
              aria-label="다음 페이지"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((current) => Math.min(current + 1, pageCount - 1))}
            >
              다음
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function MovePicker({
  label,
  value,
  selected,
  options,
  onChange,
}: {
  label: string;
  value: string;
  selected: MoveOption | null;
  options: MoveOption[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const panelId = `${label.replace(/\s+/g, '-')}-move-picker`;
  const filteredOptions = useMemo(
    () => options.filter((option) => matchesMoveOption(option, query)),
    [options, query],
  );
  const pageCount = Math.max(1, Math.ceil(filteredOptions.length / MOVE_PICKER_PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageStart = safePage * MOVE_PICKER_PAGE_SIZE;
  const visibleOptions = filteredOptions.slice(pageStart, pageStart + MOVE_PICKER_PAGE_SIZE);

  useEffect(() => {
    setPage(0);
  }, [query, options]);

  function selectMove(option: MoveOption) {
    onChange(option.displayName);
    setIsOpen(false);
    setQuery('');
    setPage(0);
  }

  return (
    <section className="pokemon-picker move-picker" aria-label={label}>
      <div className="field-label">
        <span>{label}</span>
        <button
          type="button"
          className="pokemon-picker__selected"
          aria-expanded={isOpen}
          aria-controls={panelId}
          onClick={() => setIsOpen((current) => !current)}
        >
          <span className="pokemon-picker__selected-name">
            <strong>{selected?.displayName ?? value}</strong>
            <small>{selected?.name ?? '포켓몬을 먼저 선택'}</small>
          </span>
          {selected ? <TypeBadge type={selected.type} /> : null}
          {selected ? (
            <span className="pokemon-picker__selected-total">
              {selected.category} · 위력 {selected.basePower}
              {formatMoveHitRange(selected) ? ` · ${formatMoveHitRange(selected)}` : ''}
            </span>
          ) : null}
        </button>
      </div>

      {isOpen ? (
        <div className="pokemon-picker__panel" id={panelId}>
          <label className="pokemon-picker__search">
            <Search size={17} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="기술 이름, 영문명, 타입 검색"
              autoFocus
            />
          </label>

          <div className="pokemon-picker__meta">
            <span>{filteredOptions.length.toLocaleString()}개 결과</span>
            <span>{filteredOptions.length > 0 ? `${pageStart + 1}-${pageStart + visibleOptions.length}` : '0'} 표시</span>
          </div>

          <div className="pokemon-picker__list" role="listbox" aria-label="기술 목록">
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={option.name === selected?.name}
                  className={option.name === selected?.name ? 'pokemon-picker__option move-picker__option pokemon-picker__option--selected' : 'pokemon-picker__option move-picker__option'}
                  onClick={() => selectMove(option)}
                >
                  <span className="pokemon-picker__option-main">
                    <span>
                      <strong>{option.displayName}</strong>
                      <small>{option.name}</small>
                    </span>
                    <TypeBadge type={option.type} />
                  </span>
                  <span className="move-picker__option-details">
                    <span>
                      <small>분류</small>
                      <strong>{option.category}</strong>
                    </span>
                    <span>
                      <small>위력</small>
                      <strong>{option.basePower}</strong>
                    </span>
                    {option.multiHit ? (
                      <span>
                        <small>히트</small>
                        <strong>{formatMoveHitRange(option)}</strong>
                      </span>
                    ) : null}
                  </span>
                </button>
              ))
            ) : (
              <div className="pokemon-picker__empty">공격 기술 없음</div>
            )}
          </div>

          <div className="pokemon-picker__pagination">
            <button
              type="button"
              aria-label="이전 페이지"
              disabled={safePage === 0}
              onClick={() => setPage((current) => Math.max(current - 1, 0))}
            >
              <ChevronLeft size={17} aria-hidden="true" />
              이전
            </button>
            <span>{safePage + 1}/{pageCount}</span>
            <button
              type="button"
              aria-label="다음 페이지"
              disabled={safePage >= pageCount - 1}
              onClick={() => setPage((current) => Math.min(current + 1, pageCount - 1))}
            >
              다음
              <ChevronRight size={17} aria-hidden="true" />
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

function BaseStatsTable({
  species,
  nature,
  statPoints = EMPTY_SPREAD,
}: {
  species: SpeciesOption | null;
  nature?: string;
  statPoints?: Partial<Record<StatKey, number>>;
}) {
  if (!species) return null;

  const total = baseStatTotal(species);
  const normalizedPoints = normalizeStatPoints(statPoints);
  const currentStats = nature ? calculateBattleStats(species, nature, normalizedPoints) : null;
  const maximumStats = nature ? calculatePerStatMaximumStats(species, nature) : null;
  const currentTotal = currentStats
    ? STAT_KEYS.reduce((sum, stat) => sum + currentStats[stat], 0)
    : 0;
  const maximumTotal = maximumStats
    ? STAT_KEYS.reduce((sum, stat) => sum + maximumStats[stat], 0)
    : 0;

  return (
    <div className="base-stats-panel" aria-label={`${species.displayName} 스탯`}>
      <div className="base-stats-panel__title">
        <span>{species.displayName}</span>
        <small>{nature ? formatNatureSummary(nature) : species.name}</small>
      </div>
      <table className="base-stats-table">
        <thead>
          <tr>
            <th>구분</th>
            {STAT_KEYS.map((stat) => (
              <th key={stat}>{STAT_LABELS[stat]}</th>
            ))}
            <th>합계</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">종족값</th>
            {STAT_KEYS.map((stat) => (
              <td key={stat}>{species.baseStats[stat]}</td>
            ))}
            <td>{total}</td>
          </tr>
          {currentStats ? (
            <tr>
              <th scope="row">현재</th>
              {STAT_KEYS.map((stat) => (
                <td key={stat}>
                  <span className="stat-value">
                    <strong>{currentStats[stat]}</strong>
                    <small>{normalizedPoints[stat]}P</small>
                  </span>
                </td>
              ))}
              <td>{currentTotal}</td>
            </tr>
          ) : null}
          {maximumStats ? (
            <tr>
              <th scope="row">31P 최대</th>
              {STAT_KEYS.map((stat) => (
                <td key={stat}>{maximumStats[stat]}</td>
              ))}
              <td>{maximumTotal}</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </div>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('attack');
  const [attack, setAttack] = useState<AttackConfig>(INITIAL_ATTACK);
  const [defense, setDefense] = useState<DefenseConfig>(INITIAL_DEFENSE);
  const [speed, setSpeed] = useState<SpeedConfig>(INITIAL_SPEED);
  const [sharedPokemonBuild, setSharedPokemonBuild] = useState<SharedPokemonBuild>(INITIAL_SHARED_POKEMON_BUILD);
  const [defenderBulk, setDefenderBulk] = useState<DefenderBulkConfig>(INITIAL_DEFENDER_BULK);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [targetSearch, setTargetSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('maxPercentDesc');
  const [targetPage, setTargetPage] = useState(0);
  const [defenseFilters, setDefenseFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [defenseSearch, setDefenseSearch] = useState('');
  const [defenseSortKey, setDefenseSortKey] = useState<SortKey>('maxPercentDesc');
  const [defensePage, setDefensePage] = useState(0);
  const [speedFilters, setSpeedFilters] = useState<SpeedFilterState>(INITIAL_SPEED_FILTERS);
  const [speedSearch, setSpeedSearch] = useState('');
  const [speedSortKey, setSpeedSortKey] = useState<SpeedSortKey>('marginAsc');
  const [speedPage, setSpeedPage] = useState(0);

  const debouncedAttack = useDebouncedValue(attack, INPUT_DEBOUNCE_MS);
  const debouncedDefense = useDebouncedValue(defense, INPUT_DEBOUNCE_MS);
  const debouncedSpeed = useDebouncedValue(speed, INPUT_DEBOUNCE_MS);
  const debouncedSharedPokemonBuild = useDebouncedValue(sharedPokemonBuild, INPUT_DEBOUNCE_MS);
  const debouncedDefenderBulk = useDebouncedValue(defenderBulk, INPUT_DEBOUNCE_MS);
  const debouncedTargetSearch = useDebouncedValue(targetSearch, SEARCH_DEBOUNCE_MS);
  const debouncedDefenseSearch = useDebouncedValue(defenseSearch, SEARCH_DEBOUNCE_MS);
  const debouncedSpeedSearch = useDebouncedValue(speedSearch, SEARCH_DEBOUNCE_MS);

  const selectedSharedPokemon = resolveSpeciesName(sharedPokemonBuild.pokemon);
  const selectedSharedPokemonOption = selectedSharedPokemon ? getSpeciesOption(selectedSharedPokemon) : null;
  const selectedAttacker = selectedSharedPokemon;
  const selectedAttackerAbilities = selectedSharedPokemonOption?.abilities ?? EMPTY_ABILITY_OPTIONS;
  const selectedAttackerMoveOptions = useMemo(
    () => getLearnableAttackMoveOptionsForSpecies(selectedAttacker),
    [selectedAttacker],
  );
  const selectedMoveName = resolveMoveName(attack.move);
  const selectedMove = selectedMoveName ? getMoveOption(selectedMoveName) : null;
  const selectedMoveIsLearnable = selectedAttackerMoveOptions.some((move) => move.name === selectedMoveName);
  const selectedLearnableMove = selectedMoveIsLearnable ? selectedMove : null;
  const selectedHitCount = resolveAttackHitCount(attack, selectedLearnableMove);
  const selectedItem = getOffenseItemOption(attack.item);
  const itemMultiplier = offenseItemMultiplierForMove(attack.item, selectedLearnableMove);
  const finalAttackMultiplier = combinedAttackMultiplier(attack.item, selectedLearnableMove, attack.directMultiplier);
  const activeAttackStat = selectedLearnableMove ? offensiveStatForCategory(selectedLearnableMove.category) : 'spa';

  const selectedDefenseDefender = selectedSharedPokemon;
  const selectedDefenseMoveName = resolveMoveName(defense.move);
  const selectedDefenseMove = selectedDefenseMoveName ? getMoveOption(selectedDefenseMoveName) : null;
  const selectedDefenseHitCount = resolveAttackHitCount(
    {
      ability: '',
      abilityEnabled: false,
      hitCount: defense.hitCount,
      item: defense.attackerItem,
    },
    selectedDefenseMove,
  );
  const selectedDefenseItem = getOffenseItemOption(defense.attackerItem);
  const defenseItemMultiplier = offenseItemMultiplierForMove(defense.attackerItem, selectedDefenseMove);
  const finalDefenseAttackMultiplier = combinedAttackMultiplier(
    defense.attackerItem,
    selectedDefenseMove,
    defense.attackerDirectMultiplier,
  );
  const activeDefenseAttackStat = selectedDefenseMove ? offensiveStatForCategory(selectedDefenseMove.category) : 'spa';
  const activeDefenseBulkStat = selectedDefenseMove ? defensiveStatForCategory(selectedDefenseMove.category) : 'spd';

  const selectedSpeedItem = getSpeedItemOption(speed.item);
  const selectedTargetSpeedItem = getSpeedItemOption(speed.targetItem);
  const finalSpeedMultiplier = selectedSpeedItem.multiplier * speed.directMultiplier;
  const finalTargetSpeedMultiplier = selectedTargetSpeedItem.multiplier * speed.targetDirectMultiplier;

  useEffect(() => {
    if (!selectedAttacker || selectedAttackerMoveOptions.length === 0) return;

    const currentMove = resolveMoveName(attack.move);
    const currentMoveIsLearnable = selectedAttackerMoveOptions.some((move) => move.name === currentMove);
    if (currentMoveIsLearnable) return;

    setAttack((current) => ({
      ...current,
      move: selectedAttackerMoveOptions[0].displayName,
    }));
  }, [attack.move, selectedAttacker, selectedAttackerMoveOptions]);

  useEffect(() => {
    setAttack((current) => {
      if (selectedAttackerAbilities.length === 0) {
        if (current.ability === '' && !current.abilityEnabled) return current;
        return { ...current, ability: '', abilityEnabled: false };
      }

      if (selectedAttackerAbilities.includes(current.ability)) return current;
      return { ...current, ability: selectedAttackerAbilities[0] };
    });
  }, [selectedAttackerAbilities]);

  useEffect(() => {
    if (attack.hitCount === 'auto') return;
    if (selectedLearnableMove?.multiHit?.selectableHits.includes(attack.hitCount)) return;

    setAttack((current) => ({ ...current, hitCount: 'auto' }));
  }, [attack.hitCount, selectedLearnableMove]);

  useEffect(() => {
    if (defense.hitCount === 'auto') return;
    if (selectedDefenseMove?.multiHit?.selectableHits.includes(defense.hitCount)) return;

    setDefense((current) => ({ ...current, hitCount: 'auto' }));
  }, [defense.hitCount, selectedDefenseMove]);

  const calculationAttack = useMemo<AttackConfig | null>(() => {
    const calculationAttacker = resolveSpeciesName(debouncedSharedPokemonBuild.pokemon);
    const calculationMove = resolveMoveName(debouncedAttack.move);

    if (
      !calculationAttacker ||
      !calculationMove ||
      !getLearnableAttackMoveOptionsForSpecies(calculationAttacker).some((move) => move.name === calculationMove)
    ) return null;

    return {
      ...debouncedAttack,
      attacker: calculationAttacker,
      move: calculationMove,
      nature: debouncedSharedPokemonBuild.nature,
      attackStatPoints: {
        atk: debouncedSharedPokemonBuild.statPoints.atk,
        spa: debouncedSharedPokemonBuild.statPoints.spa,
      },
    };
  }, [debouncedAttack, debouncedSharedPokemonBuild]);

  const calculation = useMemo(() => {
    if (!calculationAttack) return { results: [], summary: { survives: 0, roll: 0, ko: 0, total: 0 } };
    return calculateAttackResults(calculationAttack, debouncedDefenderBulk);
  }, [calculationAttack, debouncedDefenderBulk]);

  const calculationDefense = useMemo<DefenseConfig | null>(() => {
    const calculationDefender = resolveSpeciesName(debouncedSharedPokemonBuild.pokemon);
    const calculationMove = resolveMoveName(debouncedDefense.move);

    if (!calculationDefender || !calculationMove) return null;

    return {
      ...debouncedDefense,
      defender: calculationDefender,
      move: calculationMove,
      nature: debouncedSharedPokemonBuild.nature,
      statPoints: {
        hp: debouncedSharedPokemonBuild.statPoints.hp,
        def: debouncedSharedPokemonBuild.statPoints.def,
        spd: debouncedSharedPokemonBuild.statPoints.spd,
      },
    };
  }, [debouncedDefense, debouncedSharedPokemonBuild]);

  const calculationDefenseAttackers = useMemo(
    () => getSpeciesOptionsThatLearnMove(calculationDefense?.move ?? null),
    [calculationDefense?.move],
  );

  const defenseCalculation = useMemo(() => {
    if (!calculationDefense) return { results: [], summary: { survives: 0, roll: 0, ko: 0, total: 0 } };
    return calculateDefenseResults(calculationDefense, calculationDefenseAttackers);
  }, [calculationDefense, calculationDefenseAttackers]);

  const calculationSpeed = useMemo<SpeedConfig | null>(() => {
    const calculationPokemon = resolveSpeciesName(debouncedSharedPokemonBuild.pokemon);
    if (!calculationPokemon) return null;

    return {
      ...debouncedSpeed,
      pokemon: calculationPokemon,
      nature: debouncedSharedPokemonBuild.nature,
      statPoints: {
        spe: debouncedSharedPokemonBuild.statPoints.spe,
      },
    };
  }, [debouncedSpeed, debouncedSharedPokemonBuild]);

  const speedCalculation = useMemo(() => {
    if (!calculationSpeed) return { results: [], summary: { outspeeds: 0, tie: 0, slower: 0, total: 0 } };
    return calculateSpeedResults(calculationSpeed);
  }, [calculationSpeed]);

  const filteredResults = useMemo(() => {
    const query = debouncedTargetSearch.trim().toLowerCase();
    const visible = calculation.results.filter((result) => {
      const matchesCategory = filters[result.category];
      const matchesQuery = query.length === 0 || (result.displayName ?? result.name).toLowerCase().includes(query) || result.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });

    return sortResults(visible, sortKey);
  }, [calculation.results, filters, sortKey, debouncedTargetSearch]);

  const filteredDefenseResults = useMemo(() => {
    const query = debouncedDefenseSearch.trim().toLowerCase();
    const visible = defenseCalculation.results.filter((result) => {
      const matchesCategory = defenseFilters[result.category];
      const matchesQuery = query.length === 0 || (result.displayName ?? result.name).toLowerCase().includes(query) || result.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });

    return sortResults(visible, defenseSortKey);
  }, [defenseCalculation.results, defenseFilters, defenseSortKey, debouncedDefenseSearch]);

  const filteredSpeedResults = useMemo(() => {
    const query = debouncedSpeedSearch.trim().toLowerCase();
    const visible = speedCalculation.results.filter((result) => {
      const matchesCategory = speedFilters[result.category];
      const matchesQuery = query.length === 0 || result.displayName.toLowerCase().includes(query) || result.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });

    return sortSpeedResults(visible, speedSortKey);
  }, [speedCalculation.results, speedFilters, speedSortKey, debouncedSpeedSearch]);

  useEffect(() => {
    setTargetPage(0);
  }, [calculation.results, filters, sortKey, debouncedTargetSearch]);

  useEffect(() => {
    setDefensePage(0);
  }, [defenseCalculation.results, defenseFilters, defenseSortKey, debouncedDefenseSearch]);

  useEffect(() => {
    setSpeedPage(0);
  }, [speedCalculation.results, speedFilters, speedSortKey, debouncedSpeedSearch]);

  const targetPageCount = Math.max(1, Math.ceil(filteredResults.length / TARGET_RESULTS_PAGE_SIZE));
  const safeTargetPage = Math.min(targetPage, targetPageCount - 1);
  const targetPageStart = safeTargetPage * TARGET_RESULTS_PAGE_SIZE;
  const visibleResults = useMemo(
    () => filteredResults.slice(targetPageStart, targetPageStart + TARGET_RESULTS_PAGE_SIZE),
    [filteredResults, targetPageStart],
  );
  const targetDisplayStart = filteredResults.length > 0 ? targetPageStart + 1 : 0;
  const targetDisplayEnd = targetPageStart + visibleResults.length;

  const defensePageCount = Math.max(1, Math.ceil(filteredDefenseResults.length / TARGET_RESULTS_PAGE_SIZE));
  const safeDefensePage = Math.min(defensePage, defensePageCount - 1);
  const defensePageStart = safeDefensePage * TARGET_RESULTS_PAGE_SIZE;
  const visibleDefenseResults = useMemo(
    () => filteredDefenseResults.slice(defensePageStart, defensePageStart + TARGET_RESULTS_PAGE_SIZE),
    [filteredDefenseResults, defensePageStart],
  );
  const defenseDisplayStart = filteredDefenseResults.length > 0 ? defensePageStart + 1 : 0;
  const defenseDisplayEnd = defensePageStart + visibleDefenseResults.length;

  const speedPageCount = Math.max(1, Math.ceil(filteredSpeedResults.length / TARGET_RESULTS_PAGE_SIZE));
  const safeSpeedPage = Math.min(speedPage, speedPageCount - 1);
  const speedPageStart = safeSpeedPage * TARGET_RESULTS_PAGE_SIZE;
  const visibleSpeedResults = useMemo(
    () => filteredSpeedResults.slice(speedPageStart, speedPageStart + TARGET_RESULTS_PAGE_SIZE),
    [filteredSpeedResults, speedPageStart],
  );
  const speedDisplayStart = filteredSpeedResults.length > 0 ? speedPageStart + 1 : 0;
  const speedDisplayEnd = speedPageStart + visibleSpeedResults.length;

  const sharedPointSpread = toFullSpread(sharedPokemonBuild.statPoints);
  const defensePointSpread = toFullSpread(defenderBulk.statPoints);
  const defenseAttackerPointSpread = toFullSpread(defense.attackerStatPoints);
  const targetSpeedPointSpread = toFullSpread(speed.targetStatPoints);
  const sharedPointTotal = totalStatPoints(sharedPointSpread);
  const defensePointTotal = totalStatPoints(defensePointSpread);
  const defenseAttackerPointTotal = totalStatPoints(defenseAttackerPointSpread);
  const targetSpeedPointTotal = totalStatPoints(targetSpeedPointSpread);

  function setSharedPokemon(value: string) {
    setSharedPokemonBuild((current) => ({
      ...current,
      pokemon: value,
    }));
  }

  function setSharedNature(value: string) {
    setSharedPokemonBuild((current) => ({
      ...current,
      nature: value,
    }));
  }

  function setSharedStatPoint(stat: StatKey, value: number) {
    setSharedPokemonBuild((current) => {
      const next = updateStatPoint(current.statPoints, stat, value);
      return {
        ...current,
        statPoints: next,
      };
    });
  }

  function setDefenderStatPoint(stat: 'hp' | 'def' | 'spd', value: number) {
    setDefenderBulk((current) => {
      const next = updateStatPoint(toFullSpread(current.statPoints), stat, value);
      return {
        ...current,
        statPoints: { hp: next.hp, def: next.def, spd: next.spd },
      };
    });
  }

  function setDefenseAttackerStatPoint(stat: 'atk' | 'spa', value: number) {
    setDefense((current) => {
      const next = updateStatPoint(toFullSpread(current.attackerStatPoints), stat, value);
      return {
        ...current,
        attackerStatPoints: { atk: next.atk, spa: next.spa },
      };
    });
  }

  function setTargetSpeedStatPoint(value: number) {
    setSpeed((current) => {
      const next = updateStatPoint(toFullSpread(current.targetStatPoints), 'spe', value);
      return {
        ...current,
        targetStatPoints: { spe: next.spe },
      };
    });
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Pokémon Champions</p>
          <h1>배틀 스탯 계산기</h1>
        </div>
        <div className="rule-chip">싱글 · Lv50 · {POKEMON_RULESET.label} · {POKEMON_OPTIONS.length}종</div>
      </header>

      <nav className="tab-bar" aria-label="계산기 종류">
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            type="button"
            className={activeTab === key ? 'tab-button tab-button--active' : 'tab-button'}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </button>
        ))}
      </nav>

      {activeTab === 'attack' ? (
        <section className="workspace" aria-label="공격 계산기">
          <aside className="control-panel">
            <section className="control-section">
              <div className="section-title">
                <Swords size={18} aria-hidden="true" />
                <h2>공격 설정</h2>
              </div>

              <PokemonPicker
                label="공격 포켓몬"
                value={sharedPokemonBuild.pokemon}
                selected={selectedSharedPokemonOption}
                options={POKEMON_OPTIONS}
                onChange={setSharedPokemon}
              />

              <BaseStatsTable
                species={selectedSharedPokemonOption}
                nature={sharedPokemonBuild.nature}
                statPoints={sharedPokemonBuild.statPoints}
              />

              <div className="ability-panel">
                <label className="ability-toggle">
                  <input
                    type="checkbox"
                    checked={attack.abilityEnabled}
                    disabled={selectedAttackerAbilities.length === 0}
                    onChange={(event) => setAttack((current) => ({ ...current, abilityEnabled: event.target.checked }))}
                  />
                  <span>
                    <strong>공격 특성 적용</strong>
                    <small>{attack.abilityEnabled && attack.ability ? attack.ability : 'OFF'}</small>
                  </span>
                </label>

                <label className="field-label">
                  <span>공격 특성</span>
                  <select
                    value={attack.ability}
                    disabled={selectedAttackerAbilities.length === 0}
                    onChange={(event) => setAttack((current) => ({ ...current, ability: event.target.value }))}
                  >
                    {selectedAttackerAbilities.length === 0 ? (
                      <option value="">선택 가능 특성 없음</option>
                    ) : (
                      selectedAttackerAbilities.map((ability) => (
                        <option key={ability} value={ability}>{ability}</option>
                      ))
                    )}
                  </select>
                </label>
              </div>

              <MovePicker
                label="공격 기술"
                value={attack.move}
                selected={selectedLearnableMove}
                options={selectedAttackerMoveOptions}
                onChange={(value) => setAttack((current) => ({ ...current, move: value }))}
              />

              {selectedLearnableMove ? (
                <div className="move-summary">
                  <TypeBadge type={selectedLearnableMove.type} />
                  <span>{selectedLearnableMove.category}</span>
                  <span>위력 {selectedLearnableMove.basePower}</span>
                  {selectedHitCount ? <span>{selectedHitCount.hits}히트</span> : null}
                </div>
              ) : null}

              {selectedLearnableMove?.multiHit && selectedHitCount ? (
                <div className="multi-hit-panel">
                  <div className="multi-hit-panel__header">
                    <span>다단히트</span>
                    <strong>{selectedHitCount.hits}히트</strong>
                  </div>

                  {selectedLearnableMove.multiHit.selectableHits.length > 1 ? (
                    <label className="field-label">
                      <span>히트 수</span>
                      <select
                        value={String(attack.hitCount)}
                        onChange={(event) => setAttack((current) => ({
                          ...current,
                          hitCount: parseHitCountSetting(event.target.value),
                        }))}
                      >
                        <option value="auto">
                          자동 ({formatHitCountOption(resolveAttackHitCount(
                            { ...attack, hitCount: 'auto' },
                            selectedLearnableMove,
                          )?.hits ?? selectedLearnableMove.multiHit.defaultHits)})
                        </option>
                        {selectedLearnableMove.multiHit.selectableHits.map((hits) => (
                          <option key={hits} value={hits}>{formatHitCountOption(hits)}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <small>
                    {describeHitCountSource(selectedHitCount.source)}
                    {selectedLearnableMove.multiHit.supportsLoadedDice ? ' · 속임수주사위 자동 4히트' : ''}
                    {selectedLearnableMove.multiHit.supportsSkillLink ? ' · 스킬링크 자동 5히트' : ''}
                  </small>
                </div>
              ) : null}

              <label className="field-label">
                <span>화력 아이템</span>
                <select
                  value={attack.item}
                  onChange={(event) => setAttack((current) => ({ ...current, item: event.target.value }))}
                >
                  {OFFENSE_ITEM_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>

              <div className="multiplier-summary">
                <span>아이템 {formatMultiplier(itemMultiplier)}</span>
                <span>직접 {formatMultiplier(attack.directMultiplier)}</span>
                <strong>최종 {formatMultiplier(finalAttackMultiplier)}</strong>
                <small>{selectedItem.label}</small>
              </div>

              <NatureModifierPicker
                label="성격"
                value={sharedPokemonBuild.nature}
                onChange={setSharedNature}
              />

              <div className="stat-block">
                <div className="stat-block__header">
                  <span>공격 Stat Points</span>
                  <strong>{STAT_LABELS[activeAttackStat]} 적용</strong>
                </div>
                <StatPointControl
                  stat="atk"
                  value={sharedPokemonBuild.statPoints.atk}
                  total={sharedPointTotal}
                  onChange={(value) => setSharedStatPoint('atk', value)}
                />
                <StatPointControl
                  stat="spa"
                  value={sharedPokemonBuild.statPoints.spa}
                  total={sharedPointTotal}
                  onChange={(value) => setSharedStatPoint('spa', value)}
                />
              </div>

              <div className="inline-fields">
                <label className="field-label">
                  <span>능력 랭크</span>
                  <select
                    value={attack.boostStage}
                    onChange={(event) => setAttack((current) => ({ ...current, boostStage: Number(event.target.value) }))}
                  >
                    {BOOST_STAGES.map((stage) => (
                      <option key={stage} value={stage}>{formatBoost(stage)}</option>
                    ))}
                  </select>
                </label>

                <label className="field-label">
                  <span>직접 배율</span>
                  <select
                    value={attack.directMultiplier}
                    onChange={(event) => setAttack((current) => ({ ...current, directMultiplier: Number(event.target.value) }))}
                  >
                    {DIRECT_MULTIPLIERS.map((multiplier) => (
                      <option key={multiplier} value={multiplier}>{multiplier}x</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>

            <section className="control-section">
              <div className="section-title">
                <Shield size={18} aria-hidden="true" />
                <h2>공통 방어 조건</h2>
              </div>

              <NatureModifierPicker
                label="성격"
                value={defenderBulk.nature}
                onChange={(value) => setDefenderBulk((current) => ({ ...current, nature: value }))}
              />

              <div className="stat-block">
                <div className="stat-block__header">
                  <span>내구 Stat Points</span>
                  <strong>{defensePointTotal}/{STAT_POINT_TOTAL_LIMIT}</strong>
                </div>
                <StatPointControl
                  stat="hp"
                  value={defenderBulk.statPoints.hp}
                  total={defensePointTotal}
                  onChange={(value) => setDefenderStatPoint('hp', value)}
                />
                <StatPointControl
                  stat="def"
                  value={defenderBulk.statPoints.def}
                  total={defensePointTotal}
                  onChange={(value) => setDefenderStatPoint('def', value)}
                />
                <StatPointControl
                  stat="spd"
                  value={defenderBulk.statPoints.spd}
                  total={defensePointTotal}
                  onChange={(value) => setDefenderStatPoint('spd', value)}
                />
              </div>
            </section>
          </aside>

          <section className="results-panel">
            <div className="results-header">
              <div>
                <p className="eyebrow">Damage Results</p>
                <h2>전체 대상 계산</h2>
              </div>
              <div className="result-count">
                {targetDisplayStart}-{targetDisplayEnd}/{filteredResults.length} 표시
              </div>
            </div>

            {!selectedAttacker || !selectedLearnableMove ? (
              <div className="invalid-state">포켓몬 또는 기술 이름을 확인하세요.</div>
            ) : (
              <>
                <div className="summary-grid">
                  {CATEGORY_ORDER.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={`summary-tile summary-tile--${category} ${filters[category] ? 'summary-tile--active' : ''}`}
                      onClick={() => setFilters((current) => ({ ...current, [category]: !current[category] }))}
                    >
                      <span>{CATEGORY_LABELS[category]}</span>
                      <strong>{calculation.summary[category].toLocaleString()}</strong>
                    </button>
                  ))}
                </div>

                <div className="table-toolbar">
                  <label className="search-box">
                    <Search size={17} aria-hidden="true" />
                    <input
                      value={targetSearch}
                      onChange={(event) => setTargetSearch(event.target.value)}
                      placeholder="대상 검색"
                    />
                  </label>
                  <label className="sort-box">
                    <SlidersHorizontal size={17} aria-hidden="true" />
                    <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
                      <option value="maxPercentDesc">최대 데미지 높은순</option>
                      <option value="maxPercentAsc">최대 데미지 낮은순</option>
                      <option value="nameAsc">한글 이름순</option>
                      <option value="hpDesc">HP 높은순</option>
                    </select>
                  </label>
                </div>

                <div className="results-page-meta">
                  <span>{filteredResults.length.toLocaleString()}개 결과</span>
                  <span>{targetDisplayStart}-{targetDisplayEnd} 표시</span>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>포켓몬</th>
                        <th>타입</th>
                        <th>HP</th>
                        <th>데미지</th>
                        <th>비율</th>
                        <th>판정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleResults.length > 0 ? (
                        visibleResults.map((result) => (
                          <tr key={result.id}>
                            <td className="pokemon-cell"><span>{result.displayName ?? result.name}</span><small>{result.name}</small></td>
                            <td>
                              <div className="type-list">
                                {result.types.map((type) => <TypeBadge key={type} type={type} />)}
                              </div>
                            </td>
                            <td>{result.hp}</td>
                            <td>{result.minDamage}-{result.maxDamage}</td>
                            <td>{formatPercent(result.minPercent)} - {formatPercent(result.maxPercent)}</td>
                            <td>
                              <span className={`verdict verdict--${result.category}`}>
                                {CATEGORY_LABELS[result.category]}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="results-empty-row" colSpan={6}>검색 결과 없음</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredResults.length > 0 ? (
                  <div className="results-pagination">
                    <button
                      type="button"
                      aria-label="이전 결과 페이지"
                      disabled={safeTargetPage === 0}
                      onClick={() => setTargetPage((current) => Math.max(current - 1, 0))}
                    >
                      <ChevronLeft size={17} aria-hidden="true" />
                      이전
                    </button>
                    <span>{safeTargetPage + 1}/{targetPageCount}</span>
                    <button
                      type="button"
                      aria-label="다음 결과 페이지"
                      disabled={safeTargetPage >= targetPageCount - 1}
                      onClick={() => setTargetPage((current) => Math.min(current + 1, targetPageCount - 1))}
                    >
                      다음
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}

              </>
            )}
          </section>
        </section>
      ) : activeTab === 'defense' ? (
        <section className="workspace" aria-label="수비 계산기">
          <aside className="control-panel">
            <section className="control-section">
              <div className="section-title">
                <Shield size={18} aria-hidden="true" />
                <h2>방어 설정</h2>
              </div>

              <PokemonPicker
                label="피격 포켓몬"
                value={sharedPokemonBuild.pokemon}
                selected={selectedSharedPokemonOption}
                options={POKEMON_OPTIONS}
                onChange={setSharedPokemon}
              />

              <BaseStatsTable
                species={selectedSharedPokemonOption}
                nature={sharedPokemonBuild.nature}
                statPoints={sharedPokemonBuild.statPoints}
              />

              <MovePicker
                label="받을 기술"
                value={defense.move}
                selected={selectedDefenseMove}
                options={MOVE_OPTIONS}
                onChange={(value) => setDefense((current) => ({ ...current, move: value }))}
              />

              {selectedDefenseMove ? (
                <div className="move-summary">
                  <TypeBadge type={selectedDefenseMove.type} />
                  <span>{selectedDefenseMove.category}</span>
                  <span>위력 {selectedDefenseMove.basePower}</span>
                  {selectedDefenseHitCount ? <span>{selectedDefenseHitCount.hits}히트</span> : null}
                </div>
              ) : null}

              {selectedDefenseMove?.multiHit && selectedDefenseHitCount ? (
                <div className="multi-hit-panel">
                  <div className="multi-hit-panel__header">
                    <span>다단히트</span>
                    <strong>{selectedDefenseHitCount.hits}히트</strong>
                  </div>

                  {selectedDefenseMove.multiHit.selectableHits.length > 1 ? (
                    <label className="field-label">
                      <span>히트 수</span>
                      <select
                        value={String(defense.hitCount)}
                        onChange={(event) => setDefense((current) => ({
                          ...current,
                          hitCount: parseHitCountSetting(event.target.value),
                        }))}
                      >
                        <option value="auto">
                          자동 ({formatHitCountOption(resolveAttackHitCount(
                            {
                              ability: '',
                              abilityEnabled: false,
                              hitCount: 'auto',
                              item: defense.attackerItem,
                            },
                            selectedDefenseMove,
                          )?.hits ?? selectedDefenseMove.multiHit.defaultHits)})
                        </option>
                        {selectedDefenseMove.multiHit.selectableHits.map((hits) => (
                          <option key={hits} value={hits}>{formatHitCountOption(hits)}</option>
                        ))}
                      </select>
                    </label>
                  ) : null}

                  <small>
                    {describeHitCountSource(selectedDefenseHitCount.source)}
                    {selectedDefenseMove.multiHit.supportsLoadedDice ? ' · 속임수주사위 자동 4히트' : ''}
                  </small>
                </div>
              ) : null}

              <NatureModifierPicker
                label="피격 성격"
                value={sharedPokemonBuild.nature}
                onChange={setSharedNature}
              />

              <div className="stat-block">
                <div className="stat-block__header">
                  <span>내구 Stat Points</span>
                  <strong>{STAT_LABELS[activeDefenseBulkStat]} 적용</strong>
                </div>
                <StatPointControl
                  stat="hp"
                  value={sharedPokemonBuild.statPoints.hp}
                  total={sharedPointTotal}
                  onChange={(value) => setSharedStatPoint('hp', value)}
                />
                <StatPointControl
                  stat="def"
                  value={sharedPokemonBuild.statPoints.def}
                  total={sharedPointTotal}
                  onChange={(value) => setSharedStatPoint('def', value)}
                />
                <StatPointControl
                  stat="spd"
                  value={sharedPokemonBuild.statPoints.spd}
                  total={sharedPointTotal}
                  onChange={(value) => setSharedStatPoint('spd', value)}
                />
              </div>
            </section>

            <section className="control-section">
              <div className="section-title">
                <Swords size={18} aria-hidden="true" />
                <h2>공통 공격 조건</h2>
              </div>

              <NatureModifierPicker
                label="공격자 성격"
                value={defense.attackerNature}
                onChange={(value) => setDefense((current) => ({ ...current, attackerNature: value }))}
              />

              <div className="stat-block">
                <div className="stat-block__header">
                  <span>공격자 Stat Points</span>
                  <strong>{STAT_LABELS[activeDefenseAttackStat]} 적용</strong>
                </div>
                <StatPointControl
                  stat="atk"
                  value={defense.attackerStatPoints.atk}
                  total={defenseAttackerPointTotal}
                  onChange={(value) => setDefenseAttackerStatPoint('atk', value)}
                />
                <StatPointControl
                  stat="spa"
                  value={defense.attackerStatPoints.spa}
                  total={defenseAttackerPointTotal}
                  onChange={(value) => setDefenseAttackerStatPoint('spa', value)}
                />
              </div>

              <label className="field-label">
                <span>공격 아이템</span>
                <select
                  value={defense.attackerItem}
                  onChange={(event) => setDefense((current) => ({ ...current, attackerItem: event.target.value }))}
                >
                  {OFFENSE_ITEM_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>

              <div className="multiplier-summary">
                <span>아이템 {formatMultiplier(defenseItemMultiplier)}</span>
                <span>직접 {formatMultiplier(defense.attackerDirectMultiplier)}</span>
                <strong>최종 {formatMultiplier(finalDefenseAttackMultiplier)}</strong>
                <small>{selectedDefenseItem.label}</small>
              </div>

              <div className="inline-fields">
                <label className="field-label">
                  <span>능력 랭크</span>
                  <select
                    value={defense.attackerBoostStage}
                    onChange={(event) => setDefense((current) => ({ ...current, attackerBoostStage: Number(event.target.value) }))}
                  >
                    {BOOST_STAGES.map((stage) => (
                      <option key={stage} value={stage}>{formatBoost(stage)}</option>
                    ))}
                  </select>
                </label>

                <label className="field-label">
                  <span>직접 배율</span>
                  <select
                    value={defense.attackerDirectMultiplier}
                    onChange={(event) => setDefense((current) => ({ ...current, attackerDirectMultiplier: Number(event.target.value) }))}
                  >
                    {DIRECT_MULTIPLIERS.map((multiplier) => (
                      <option key={multiplier} value={multiplier}>{multiplier}x</option>
                    ))}
                  </select>
                </label>
              </div>
            </section>
          </aside>

          <section className="results-panel">
            <div className="results-header">
              <div>
                <p className="eyebrow">Incoming Damage</p>
                <h2>기술 습득 공격자 계산</h2>
              </div>
              <div className="result-count">
                {defenseDisplayStart}-{defenseDisplayEnd}/{filteredDefenseResults.length} 표시
              </div>
            </div>

            {!selectedDefenseDefender || !selectedDefenseMove ? (
              <div className="invalid-state">피격 포켓몬 또는 받을 기술을 확인하세요.</div>
            ) : (
              <>
                <div className="summary-grid">
                  {CATEGORY_ORDER.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={`summary-tile summary-tile--${category} ${defenseFilters[category] ? 'summary-tile--active' : ''}`}
                      onClick={() => setDefenseFilters((current) => ({ ...current, [category]: !current[category] }))}
                    >
                      <span>{CATEGORY_LABELS[category]}</span>
                      <strong>{defenseCalculation.summary[category].toLocaleString()}</strong>
                    </button>
                  ))}
                </div>

                <div className="table-toolbar">
                  <label className="search-box">
                    <Search size={17} aria-hidden="true" />
                    <input
                      value={defenseSearch}
                      onChange={(event) => setDefenseSearch(event.target.value)}
                      placeholder="공격자 검색"
                    />
                  </label>
                  <label className="sort-box">
                    <SlidersHorizontal size={17} aria-hidden="true" />
                    <select value={defenseSortKey} onChange={(event) => setDefenseSortKey(event.target.value as SortKey)}>
                      <option value="maxPercentDesc">최대 데미지 높은순</option>
                      <option value="maxPercentAsc">최대 데미지 낮은순</option>
                      <option value="nameAsc">한글 이름순</option>
                      <option value="hpDesc">HP 높은순</option>
                    </select>
                  </label>
                </div>

                <div className="results-page-meta">
                  <span>{filteredDefenseResults.length.toLocaleString()}개 결과</span>
                  <span>{defenseDisplayStart}-{defenseDisplayEnd} 표시</span>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>공격자</th>
                        <th>타입</th>
                        <th>내 HP</th>
                        <th>데미지</th>
                        <th>비율</th>
                        <th>판정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleDefenseResults.length > 0 ? (
                        visibleDefenseResults.map((result) => (
                          <tr key={result.id}>
                            <td className="pokemon-cell"><span>{result.displayName ?? result.name}</span><small>{result.name}</small></td>
                            <td>
                              <div className="type-list">
                                {result.types.map((type) => <TypeBadge key={type} type={type} />)}
                              </div>
                            </td>
                            <td>{result.hp}</td>
                            <td>{result.minDamage}-{result.maxDamage}</td>
                            <td>{formatPercent(result.minPercent)} - {formatPercent(result.maxPercent)}</td>
                            <td>
                              <span className={`verdict verdict--${result.category}`}>
                                {CATEGORY_LABELS[result.category]}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="results-empty-row" colSpan={6}>해당 기술을 배우는 공격자 없음</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredDefenseResults.length > 0 ? (
                  <div className="results-pagination">
                    <button
                      type="button"
                      aria-label="이전 수비 결과 페이지"
                      disabled={safeDefensePage === 0}
                      onClick={() => setDefensePage((current) => Math.max(current - 1, 0))}
                    >
                      <ChevronLeft size={17} aria-hidden="true" />
                      이전
                    </button>
                    <span>{safeDefensePage + 1}/{defensePageCount}</span>
                    <button
                      type="button"
                      aria-label="다음 수비 결과 페이지"
                      disabled={safeDefensePage >= defensePageCount - 1}
                      onClick={() => setDefensePage((current) => Math.min(current + 1, defensePageCount - 1))}
                    >
                      다음
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </section>
      ) : (
        <section className="workspace" aria-label="스피드 계산기">
          <aside className="control-panel">
            <section className="control-section">
              <div className="section-title">
                <Gauge size={18} aria-hidden="true" />
                <h2>내 스피드 설정</h2>
              </div>

              <PokemonPicker
                label="기준 포켓몬"
                value={sharedPokemonBuild.pokemon}
                selected={selectedSharedPokemonOption}
                options={POKEMON_OPTIONS}
                onChange={setSharedPokemon}
              />

              <BaseStatsTable
                species={selectedSharedPokemonOption}
                nature={sharedPokemonBuild.nature}
                statPoints={sharedPokemonBuild.statPoints}
              />

              <NatureModifierPicker
                label="성격"
                value={sharedPokemonBuild.nature}
                onChange={setSharedNature}
              />

              <div className="stat-block">
                <div className="stat-block__header">
                  <span>스피드 Stat Points</span>
                  <strong>{sharedPointTotal}/{STAT_POINT_TOTAL_LIMIT}</strong>
                </div>
                <StatPointControl
                  stat="spe"
                  value={sharedPokemonBuild.statPoints.spe}
                  total={sharedPointTotal}
                  onChange={(value) => setSharedStatPoint('spe', value)}
                />
              </div>

              <label className="field-label">
                <span>스피드 도구/효과</span>
                <select
                  value={speed.item}
                  onChange={(event) => setSpeed((current) => ({ ...current, item: event.target.value }))}
                >
                  {SPEED_ITEM_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>

              <div className="inline-fields">
                <label className="field-label">
                  <span>스피드 랭크</span>
                  <select
                    value={speed.boostStage}
                    onChange={(event) => setSpeed((current) => ({ ...current, boostStage: Number(event.target.value) }))}
                  >
                    {BOOST_STAGES.map((stage) => (
                      <option key={stage} value={stage}>{formatBoost(stage)}</option>
                    ))}
                  </select>
                </label>

                <label className="field-label">
                  <span>직접 배율</span>
                  <select
                    value={speed.directMultiplier}
                    onChange={(event) => setSpeed((current) => ({ ...current, directMultiplier: Number(event.target.value) }))}
                  >
                    {SPEED_DIRECT_MULTIPLIERS.map((multiplier) => (
                      <option key={multiplier} value={multiplier}>{multiplier}x</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="multiplier-summary">
                <span>도구 {formatMultiplier(selectedSpeedItem.multiplier)}</span>
                <span>직접 {formatMultiplier(speed.directMultiplier)}</span>
                <strong>최종 {formatMultiplier(finalSpeedMultiplier)}</strong>
                <small>{selectedSpeedItem.label}</small>
              </div>
            </section>

            <section className="control-section">
              <div className="section-title">
                <SlidersHorizontal size={18} aria-hidden="true" />
                <h2>비교 대상 공통 조건</h2>
              </div>

              <NatureModifierPicker
                label="상대 성격"
                value={speed.targetNature}
                onChange={(value) => setSpeed((current) => ({ ...current, targetNature: value }))}
              />

              <div className="stat-block">
                <div className="stat-block__header">
                  <span>상대 스피드 Stat Points</span>
                  <strong>{targetSpeedPointTotal}/{STAT_POINT_TOTAL_LIMIT}</strong>
                </div>
                <StatPointControl
                  stat="spe"
                  value={speed.targetStatPoints.spe}
                  total={targetSpeedPointTotal}
                  onChange={setTargetSpeedStatPoint}
                />
              </div>

              <label className="field-label">
                <span>상대 스피드 도구/효과</span>
                <select
                  value={speed.targetItem}
                  onChange={(event) => setSpeed((current) => ({ ...current, targetItem: event.target.value }))}
                >
                  {SPEED_ITEM_OPTIONS.map((item) => (
                    <option key={item.id} value={item.id}>{item.label}</option>
                  ))}
                </select>
              </label>

              <div className="inline-fields">
                <label className="field-label">
                  <span>상대 스피드 랭크</span>
                  <select
                    value={speed.targetBoostStage}
                    onChange={(event) => setSpeed((current) => ({ ...current, targetBoostStage: Number(event.target.value) }))}
                  >
                    {BOOST_STAGES.map((stage) => (
                      <option key={stage} value={stage}>{formatBoost(stage)}</option>
                    ))}
                  </select>
                </label>

                <label className="field-label">
                  <span>상대 직접 배율</span>
                  <select
                    value={speed.targetDirectMultiplier}
                    onChange={(event) => setSpeed((current) => ({ ...current, targetDirectMultiplier: Number(event.target.value) }))}
                  >
                    {SPEED_DIRECT_MULTIPLIERS.map((multiplier) => (
                      <option key={multiplier} value={multiplier}>{multiplier}x</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="multiplier-summary">
                <span>도구 {formatMultiplier(selectedTargetSpeedItem.multiplier)}</span>
                <span>직접 {formatMultiplier(speed.targetDirectMultiplier)}</span>
                <strong>최종 {formatMultiplier(finalTargetSpeedMultiplier)}</strong>
                <small>{selectedTargetSpeedItem.label}</small>
              </div>
            </section>
          </aside>

          <section className="results-panel">
            <div className="results-header">
              <div>
                <p className="eyebrow">Speed Results</p>
                <h2>전체 대상 추월 판정</h2>
              </div>
              <div className="result-count">
                {speedDisplayStart}-{speedDisplayEnd}/{filteredSpeedResults.length} 표시
              </div>
            </div>

            {!selectedSharedPokemonOption ? (
              <div className="invalid-state">기준 포켓몬 이름을 확인하세요.</div>
            ) : (
              <>
                <div className="summary-grid">
                  {SPEED_CATEGORY_ORDER.map((category) => (
                    <button
                      key={category}
                      type="button"
                      className={`summary-tile summary-tile--${category} ${speedFilters[category] ? 'summary-tile--active' : ''}`}
                      onClick={() => setSpeedFilters((current) => ({ ...current, [category]: !current[category] }))}
                    >
                      <span>{SPEED_CATEGORY_LABELS[category]}</span>
                      <strong>{speedCalculation.summary[category].toLocaleString()}</strong>
                    </button>
                  ))}
                </div>

                <div className="table-toolbar">
                  <label className="search-box">
                    <Search size={17} aria-hidden="true" />
                    <input
                      value={speedSearch}
                      onChange={(event) => setSpeedSearch(event.target.value)}
                      placeholder="비교 대상 검색"
                    />
                  </label>
                  <label className="sort-box">
                    <SlidersHorizontal size={17} aria-hidden="true" />
                    <select value={speedSortKey} onChange={(event) => setSpeedSortKey(event.target.value as SpeedSortKey)}>
                      <option value="marginAsc">추월 여유 낮은순</option>
                      <option value="marginDesc">추월 여유 높은순</option>
                      <option value="targetSpeedDesc">상대 스피드 높은순</option>
                      <option value="targetSpeedAsc">상대 스피드 낮은순</option>
                      <option value="nameAsc">한글 이름순</option>
                    </select>
                  </label>
                </div>

                <div className="results-page-meta">
                  <span>{filteredSpeedResults.length.toLocaleString()}개 결과</span>
                  <span>{speedDisplayStart}-{speedDisplayEnd} 표시</span>
                </div>

                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>비교 대상</th>
                        <th>타입</th>
                        <th>내 스피드</th>
                        <th>상대 스피드</th>
                        <th>차이</th>
                        <th>판정</th>
                      </tr>
                    </thead>
                    <tbody>
                      {visibleSpeedResults.length > 0 ? (
                        visibleSpeedResults.map((result) => (
                          <tr key={result.id}>
                            <td className="pokemon-cell"><span>{result.displayName}</span><small>{result.name}</small></td>
                            <td>
                              <div className="type-list">
                                {result.types.map((type) => <TypeBadge key={type} type={type} />)}
                              </div>
                            </td>
                            <td>{result.selfFinalSpeed}<small className="stat-detail">원본 {result.selfBaseSpeed}</small></td>
                            <td>{result.targetFinalSpeed}<small className="stat-detail">원본 {result.targetBaseSpeed}</small></td>
                            <td>{formatSpeedMargin(result.margin)}</td>
                            <td>
                              <span className={`verdict verdict--${result.category}`}>
                                {SPEED_CATEGORY_LABELS[result.category]}
                              </span>
                            </td>
                          </tr>
                        ))
                      ) : (
                        <tr>
                          <td className="results-empty-row" colSpan={6}>검색 결과 없음</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {filteredSpeedResults.length > 0 ? (
                  <div className="results-pagination">
                    <button
                      type="button"
                      aria-label="이전 스피드 결과 페이지"
                      disabled={safeSpeedPage === 0}
                      onClick={() => setSpeedPage((current) => Math.max(current - 1, 0))}
                    >
                      <ChevronLeft size={17} aria-hidden="true" />
                      이전
                    </button>
                    <span>{safeSpeedPage + 1}/{speedPageCount}</span>
                    <button
                      type="button"
                      aria-label="다음 스피드 결과 페이지"
                      disabled={safeSpeedPage >= speedPageCount - 1}
                      onClick={() => setSpeedPage((current) => Math.min(current + 1, speedPageCount - 1))}
                    >
                      다음
                      <ChevronRight size={17} aria-hidden="true" />
                    </button>
                  </div>
                ) : null}
              </>
            )}
          </section>
        </section>
      )}

    </main>
  );
}

export default App;



