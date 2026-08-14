import { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Gauge,
  Pin,
  Plus,
  Save,
  Search,
  Shield,
  SlidersHorizontal,
  Swords,
  Trash2,
  X,
} from 'lucide-react';
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
  displayNameForAbility,
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
import {
  BATTLE_ITEM_OPTIONS,
  MEGA_STONE_ITEM_ID,
  battleItemOffenseMultiplier,
  getBattleItemOption,
} from './domain/battleItems';
import {
  SAMPLE_MOVE_SLOT_COUNT,
  SAMPLE_STORAGE_VERSION,
  createDefaultBattleSample,
  createSampleId,
  loadSampleLibrary,
  normalizeSampleForSpecies,
  samplesEqual,
  sanitizeBattleSample,
  saveSampleLibrary,
  type BattleSample,
  type SampleLibraryData,
} from './domain/battleSamples';
import {
  calculateSampleMatchup,
  type DefensePointRecommendation,
  type SampleMatchupResult,
  type SingleStatPointRecommendation,
} from './domain/sampleComparison';

type TabKey = 'compare' | 'attack' | 'defense' | 'speed';

type FilterState = Record<SurvivalCategory, boolean>;
type SpeedFilterState = Record<SpeedCategory, boolean>;
type PendingSampleAction = { type: 'switch'; sampleId: string } | { type: 'new' };

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
  attackStatPoints: { atk: 0, spa: 0 },
  boostStage: 0,
  directMultiplier: 1,
};

const INITIAL_DEFENDER_BULK: DefenderBulkConfig = {
  nature: 'Serious',
  statPoints: { hp: 0, def: 0, spd: 0 },
  targetHasHeldItem: true,
};

const INITIAL_DEFENSE: DefenseConfig = {
  defender: '리자몽',
  move: '화염방사',
  nature: 'Serious',
  statPoints: { hp: 0, def: 0, spd: 0 },
  defenderHasHeldItem: true,
  attackerNature: 'Modest',
  attackerStatPoints: { atk: 0, spa: 0 },
  attackerBoostStage: 0,
  attackerItem: NO_OFFENSE_ITEM_ID,
  attackerDirectMultiplier: 1,
  hitCount: 'auto',
};

const INITIAL_SPEED: SpeedConfig = {
  pokemon: '리자몽',
  nature: 'Timid',
  statPoints: { spe: 0 },
  boostStage: 0,
  item: NO_SPEED_ITEM_ID,
  directMultiplier: 1,
  targetNature: 'Timid',
  targetStatPoints: { spe: 0 },
  targetBoostStage: 0,
  targetItem: NO_SPEED_ITEM_ID,
  targetDirectMultiplier: 1,
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
  { key: 'compare', label: '샘플 비교', icon: BookOpen },
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
              <th scope="row">{STAT_POINT_PER_STAT_LIMIT}P 최대</th>
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

function SingleStatRecommendationView({
  recommendation,
  goal,
}: {
  recommendation: SingleStatPointRecommendation;
  goal: string;
}) {
  const label = STAT_LABELS[recommendation.stat];
  const currentText = recommendation.currentAddRequired === null
    ? '현재 배분에서 달성 불가'
    : recommendation.currentAddRequired === recommendation.currentPoints
      ? `현재 ${recommendation.currentPoints}P로 충족`
      : `${label} ${recommendation.currentAddRequired}P (+${recommendation.currentAddRequired - recommendation.currentPoints}P)`;
  const redistributionText = recommendation.redistributedRequired === null
    ? '32P에서도 달성 불가'
    : `${label} ${recommendation.redistributedRequired}P${recommendation.pointsToReallocate > 0 ? ` · ${recommendation.pointsToReallocate}P 재배분` : ''}`;

  return (
    <div className="recommendation-block">
      <strong>{goal}</strong>
      <span>현재안: {currentText}</span>
      <span>재배분안: {redistributionText}</span>
    </div>
  );
}

function formatDefenseOption(option: DefensePointRecommendation['redistributedOptions'][number], stat: 'def' | 'spd') {
  return `HP ${option.hp}P + ${STAT_LABELS[stat]} ${option.bulk}P${option.pointsToReallocate > 0 ? ` (${option.pointsToReallocate}P 재배분)` : ''}`;
}

function DefenseRecommendationView({
  recommendation,
  goal = '확정 생존 최소 SP',
}: {
  recommendation: DefensePointRecommendation;
  goal?: string;
}) {
  const currentText = recommendation.currentAddOptions.length > 0
    ? recommendation.currentAddOptions.map((option) => formatDefenseOption(option, recommendation.stat)).join(' / ')
    : '현재 배분에서 달성 불가';
  const redistributedText = recommendation.redistributedOptions.length > 0
    ? recommendation.redistributedOptions.map((option) => formatDefenseOption(option, recommendation.stat)).join(' / ')
    : `32P 최대 투자에서도 ${formatPercent(recommendation.maximumInvestment.maxPercent)}`;

  return (
    <div className="recommendation-block">
      <strong>{goal}</strong>
      <span>현재안: {currentText}</span>
      <span>재배분안: {redistributedText}</span>
    </div>
  );
}

function SampleMatchupCard({ result }: { result: SampleMatchupResult }) {
  const benchmarkSpecies = getSpeciesOption(result.benchmark.species);
  const strongest = result.strongestOutgoing;
  const dangerous = result.mostDangerousIncoming;

  return (
    <article className="matchup-card">
      <div className="matchup-card__header">
        <div>
          <span className="sample-kicker">BENCHMARK</span>
          <h3>{result.benchmark.name}</h3>
          <small>{benchmarkSpecies?.displayName ?? result.benchmark.species} · {result.benchmark.nature} · {totalStatPoints(result.benchmark.statPoints)}/66P</small>
        </div>
        <div className="type-list">
          {benchmarkSpecies?.types.map((type) => <TypeBadge key={type} type={type} />)}
        </div>
      </div>

      <div className="matchup-summary-grid">
        <div>
          <span>내 최고 화력</span>
          <strong>{strongest?.damage.move.displayName ?? '공격 기술 없음'}</strong>
          <small>{strongest ? `${formatPercent(strongest.damage.minPercent)}-${formatPercent(strongest.damage.maxPercent)} · ${CATEGORY_LABELS[strongest.damage.category]}` : '-'}</small>
        </div>
        <div>
          <span>최대 위협</span>
          <strong>{dangerous?.damage.move.displayName ?? '공격 기술 없음'}</strong>
          <small>{dangerous ? `${formatPercent(dangerous.damage.minPercent)}-${formatPercent(dangerous.damage.maxPercent)} · ${CATEGORY_LABELS[dangerous.damage.category]}` : '-'}</small>
        </div>
        <div>
          <span>스피드</span>
          <strong>{SPEED_CATEGORY_LABELS[result.speed.category]}</strong>
          <small>{result.speed.selfFinalSpeed} : {result.speed.targetFinalSpeed} ({formatSpeedMargin(result.speed.margin)})</small>
        </div>
      </div>

      <div className="matchup-recommendations">
        {strongest ? (
          <SingleStatRecommendationView
            recommendation={strongest.recommendation}
            goal="최고 기술 확정 KO 최소 SP"
          />
        ) : null}
        {dangerous ? (
          <DefenseRecommendationView
            recommendation={dangerous.recommendation}
            goal="최대 위협 확정 생존 최소 SP"
          />
        ) : null}
        <SingleStatRecommendationView recommendation={result.speed.recommendation} goal="추월 최소 SP" />
      </div>

      <details className="matchup-details">
        <summary>기술별 상세 비교</summary>
        <div className="matchup-details__section">
          <h4>내가 주는 피해</h4>
          {result.outgoing.length > 0 ? result.outgoing.map(({ damage, recommendation }) => (
            <div className="move-comparison" key={`out-${damage.move.id}`}>
              <div className="move-comparison__result">
                <strong>{damage.move.displayName}</strong>
                <span>{damage.minDamage}-{damage.maxDamage}</span>
                <span>{formatPercent(damage.minPercent)}-{formatPercent(damage.maxPercent)}</span>
                <span className={`verdict verdict--${damage.category}`}>{CATEGORY_LABELS[damage.category]}</span>
              </div>
              <SingleStatRecommendationView recommendation={recommendation} goal="확정 KO 최소 SP" />
            </div>
          )) : <div className="invalid-state">저장된 공격 기술이 없습니다.</div>}
        </div>

        <div className="matchup-details__section">
          <h4>내가 받는 피해</h4>
          {result.incoming.length > 0 ? result.incoming.map(({ damage, recommendation }) => (
            <div className="move-comparison" key={`in-${damage.move.id}`}>
              <div className="move-comparison__result">
                <strong>{damage.move.displayName}</strong>
                <span>{damage.minDamage}-{damage.maxDamage}</span>
                <span>{formatPercent(damage.minPercent)}-{formatPercent(damage.maxPercent)}</span>
                <span className={`verdict verdict--${damage.category}`}>{CATEGORY_LABELS[damage.category]}</span>
              </div>
              <DefenseRecommendationView recommendation={recommendation} />
            </div>
          )) : <div className="invalid-state">상대에게 저장된 공격 기술이 없습니다.</div>}
        </div>
      </details>
    </article>
  );
}

function App() {
  const [initialSampleStorage] = useState(() => loadSampleLibrary(window.localStorage));
  const [sampleLibrary, setSampleLibrary] = useState<SampleLibraryData>(initialSampleStorage.data);
  const [sampleDraft, setSampleDraft] = useState<BattleSample>(() => (
    initialSampleStorage.data.samples.find((sample) => sample.id === initialSampleStorage.data.activeSampleId)
      ?? initialSampleStorage.data.samples[0]
  ));
  const [storageWarning, setStorageWarning] = useState<string | null>(initialSampleStorage.warning);
  const [pendingSampleAction, setPendingSampleAction] = useState<PendingSampleAction | null>(null);
  const [activeTab, setActiveTab] = useState<TabKey>('compare');
  const [attack, setAttack] = useState<AttackConfig>(INITIAL_ATTACK);
  const [defense, setDefense] = useState<DefenseConfig>(INITIAL_DEFENSE);
  const [speed, setSpeed] = useState<SpeedConfig>(INITIAL_SPEED);
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
  const debouncedSampleDraft = useDebouncedValue(sampleDraft, INPUT_DEBOUNCE_MS);
  const debouncedDefenderBulk = useDebouncedValue(defenderBulk, INPUT_DEBOUNCE_MS);
  const debouncedTargetSearch = useDebouncedValue(targetSearch, SEARCH_DEBOUNCE_MS);
  const debouncedDefenseSearch = useDebouncedValue(defenseSearch, SEARCH_DEBOUNCE_MS);
  const debouncedSpeedSearch = useDebouncedValue(speedSearch, SEARCH_DEBOUNCE_MS);

  const activeSavedSample = sampleLibrary.samples.find((sample) => sample.id === sampleDraft.id) ?? null;
  const isSampleDirty = !activeSavedSample || !samplesEqual(sampleDraft, activeSavedSample);
  const sharedPokemonBuild = useMemo(() => ({
    pokemon: sampleDraft.species,
    nature: sampleDraft.nature,
    statPoints: sampleDraft.statPoints,
  }), [sampleDraft]);
  const debouncedSharedPokemonBuild = useMemo(() => ({
    pokemon: debouncedSampleDraft.species,
    nature: debouncedSampleDraft.nature,
    statPoints: debouncedSampleDraft.statPoints,
  }), [debouncedSampleDraft]);
  const selectedSharedPokemon = resolveSpeciesName(sampleDraft.species);
  const selectedSharedPokemonOption = selectedSharedPokemon ? getSpeciesOption(selectedSharedPokemon) : null;
  const selectedAttacker = selectedSharedPokemon;
  const selectedAttackerAbilities = selectedSharedPokemonOption?.abilities ?? EMPTY_ABILITY_OPTIONS;
  const selectedAttackerMoveOptions = useMemo(
    () => {
      const options = getLearnableAttackMoveOptionsForSpecies(selectedAttacker);
      const priority = new Map(sampleDraft.moves.map((move, index) => [move, index]));
      return [...options].sort((left, right) => {
        const leftPriority = priority.get(left.name);
        const rightPriority = priority.get(right.name);
        if (leftPriority !== undefined && rightPriority !== undefined) return leftPriority - rightPriority;
        if (leftPriority !== undefined) return -1;
        if (rightPriority !== undefined) return 1;
        return left.displayName.localeCompare(right.displayName, 'ko');
      });
    },
    [selectedAttacker, sampleDraft.moves],
  );
  const selectedMoveName = resolveMoveName(attack.move);
  const selectedMove = selectedMoveName ? getMoveOption(selectedMoveName) : null;
  const selectedMoveIsLearnable = selectedAttackerMoveOptions.some((move) => move.name === selectedMoveName);
  const selectedLearnableMove = selectedMoveIsLearnable ? selectedMove : null;
  const sampleAttackConfig = useMemo(() => ({
    ...attack,
    item: sampleDraft.item,
    ability: sampleDraft.ability,
    abilityEnabled: sampleDraft.abilityEnabled,
  }), [attack, sampleDraft.item, sampleDraft.ability, sampleDraft.abilityEnabled]);
  const selectedHitCount = resolveAttackHitCount(sampleAttackConfig, selectedLearnableMove);
  const selectedItem = getBattleItemOption(sampleDraft.item);
  const itemMultiplier = battleItemOffenseMultiplier(sampleDraft.item, selectedLearnableMove);
  const finalAttackMultiplier = itemMultiplier * attack.directMultiplier;
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

  const selectedSpeedItem = getBattleItemOption(sampleDraft.item);
  const selectedTargetSpeedItem = getSpeedItemOption(speed.targetItem);
  const finalSpeedMultiplier = selectedSpeedItem.speedMultiplier * speed.directMultiplier;
  const finalTargetSpeedMultiplier = selectedTargetSpeedItem.multiplier * speed.targetDirectMultiplier;

  const benchmarkSamples = useMemo(
    () => sampleLibrary.benchmarkIds
      .map((id) => sampleLibrary.samples.find((sample) => sample.id === id))
      .filter((sample): sample is BattleSample => Boolean(sample && sample.id !== sampleDraft.id)),
    [sampleLibrary.benchmarkIds, sampleLibrary.samples, sampleDraft.id],
  );
  const sampleMatchups = useMemo(
    () => benchmarkSamples.map((benchmark) => calculateSampleMatchup(debouncedSampleDraft, benchmark)),
    [benchmarkSamples, debouncedSampleDraft],
  );

  useEffect(() => {
    const warning = saveSampleLibrary(window.localStorage, sampleLibrary);
    if (warning) setStorageWarning(warning);
  }, [sampleLibrary]);

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
      item: debouncedSampleDraft.item,
      ability: debouncedSampleDraft.ability,
      abilityEnabled: debouncedSampleDraft.abilityEnabled,
      nature: debouncedSharedPokemonBuild.nature,
      attackStatPoints: {
        atk: debouncedSharedPokemonBuild.statPoints.atk,
        spa: debouncedSharedPokemonBuild.statPoints.spa,
      },
    };
  }, [debouncedAttack, debouncedSampleDraft, debouncedSharedPokemonBuild]);

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
      defenderAbility: debouncedSampleDraft.ability,
      defenderAbilityEnabled: debouncedSampleDraft.abilityEnabled,
      defenderItem: debouncedSampleDraft.item,
      statPoints: {
        hp: debouncedSharedPokemonBuild.statPoints.hp,
        def: debouncedSharedPokemonBuild.statPoints.def,
        spd: debouncedSharedPokemonBuild.statPoints.spd,
      },
    };
  }, [debouncedDefense, debouncedSampleDraft, debouncedSharedPokemonBuild]);

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
      item: debouncedSampleDraft.item,
      statPoints: {
        spe: debouncedSharedPokemonBuild.statPoints.spe,
      },
    };
  }, [debouncedSpeed, debouncedSampleDraft, debouncedSharedPokemonBuild]);

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
    const species = resolveSpeciesName(value);
    if (!species) return;
    setSampleDraft((current) => normalizeSampleForSpecies(current, species));
  }

  function setSharedNature(value: string) {
    setSampleDraft((current) => ({ ...current, nature: value }));
  }

  function setSharedStatPoint(stat: StatKey, value: number) {
    setSampleDraft((current) => {
      const next = updateStatPoint(current.statPoints, stat, value);
      return {
        ...current,
        statPoints: next,
      };
    });
  }

  function commitSample(library: SampleLibraryData, draft: BattleSample): SampleLibraryData {
    const normalized = sanitizeBattleSample(draft) ?? createDefaultBattleSample(draft.id);
    const exists = library.samples.some((sample) => sample.id === normalized.id);
    return {
      ...library,
      version: SAMPLE_STORAGE_VERSION,
      samples: exists
        ? library.samples.map((sample) => sample.id === normalized.id ? normalized : sample)
        : [...library.samples, normalized],
      activeSampleId: normalized.id,
      benchmarkIds: library.benchmarkIds.filter((id) => id !== normalized.id),
    };
  }

  function saveCurrentSample(): BattleSample {
    const normalized = sanitizeBattleSample(sampleDraft) ?? createDefaultBattleSample(sampleDraft.id);
    setSampleLibrary((current) => commitSample(current, normalized));
    setSampleDraft(normalized);
    return normalized;
  }

  function saveSampleAs(copyLabel = '새 이름'): void {
    const normalized = sanitizeBattleSample({
      ...sampleDraft,
      id: createSampleId(),
      name: `${sampleDraft.name} ${copyLabel}`.trim().slice(0, 40),
    }) ?? createDefaultBattleSample();
    setSampleLibrary((current) => commitSample(current, normalized));
    setSampleDraft(normalized);
  }

  function performSampleAction(action: PendingSampleAction, library = sampleLibrary): void {
    if (action.type === 'switch') {
      const target = library.samples.find((sample) => sample.id === action.sampleId);
      if (!target) return;
      setSampleLibrary({
        ...library,
        activeSampleId: target.id,
        benchmarkIds: library.benchmarkIds.filter((id) => id !== target.id),
      });
      setSampleDraft(target);
      return;
    }

    setSampleDraft(createDefaultBattleSample());
  }

  function requestSampleAction(action: PendingSampleAction): void {
    if (action.type === 'switch' && action.sampleId === sampleDraft.id) return;
    if (isSampleDirty) {
      setPendingSampleAction(action);
      return;
    }
    performSampleAction(action);
  }

  function saveAndContinuePendingAction(): void {
    if (!pendingSampleAction) return;
    const normalized = sanitizeBattleSample(sampleDraft) ?? createDefaultBattleSample(sampleDraft.id);
    const nextLibrary = commitSample(sampleLibrary, normalized);
    setPendingSampleAction(null);
    setSampleLibrary(nextLibrary);
    performSampleAction(pendingSampleAction, nextLibrary);
  }

  function discardAndContinuePendingAction(): void {
    if (!pendingSampleAction) return;
    const action = pendingSampleAction;
    setPendingSampleAction(null);
    performSampleAction(action);
  }

  function deleteCurrentSample(): void {
    const saved = sampleLibrary.samples.find((sample) => sample.id === sampleDraft.id);
    if (!saved) {
      const fallback = sampleLibrary.samples.find((sample) => sample.id === sampleLibrary.activeSampleId)
        ?? sampleLibrary.samples[0];
      if (fallback) setSampleDraft(fallback);
      return;
    }
    if (!window.confirm(`'${saved.name}' 샘플을 삭제할까요?`)) return;

    const remaining = sampleLibrary.samples.filter((sample) => sample.id !== saved.id);
    const fallback = remaining[0] ?? createDefaultBattleSample();
    setSampleLibrary({
      ...sampleLibrary,
      samples: remaining.length > 0 ? remaining : [fallback],
      activeSampleId: fallback.id,
      benchmarkIds: sampleLibrary.benchmarkIds.filter((id) => id !== saved.id),
    });
    setSampleDraft(fallback);
  }

  function toggleBenchmark(sampleId: string): void {
    if (sampleId === sampleDraft.id) return;
    setSampleLibrary((current) => ({
      ...current,
      benchmarkIds: current.benchmarkIds.includes(sampleId)
        ? current.benchmarkIds.filter((id) => id !== sampleId)
        : [...current.benchmarkIds, sampleId],
    }));
  }

  function setSampleMove(slot: number, value: string): void {
    const moveName = resolveMoveName(value);
    setSampleDraft((current) => {
      const slots = Array.from({ length: SAMPLE_MOVE_SLOT_COUNT }, (_, index) => current.moves[index] ?? '');
      slots[slot] = moveName ?? '';
      const moves = slots.filter((move, index) => move && slots.indexOf(move) === index);
      return { ...current, moves };
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

      {storageWarning ? (
        <div className="storage-warning" role="alert">
          <span>{storageWarning}</span>
          <button type="button" aria-label="저장소 경고 닫기" onClick={() => setStorageWarning(null)}>
            <X size={17} aria-hidden="true" />
          </button>
        </div>
      ) : null}

      <section className="sample-toolbar" aria-label="활성 샘플 도구 모음">
        <label className="sample-toolbar__selector">
          <span>활성 샘플</span>
          <select
            value={activeSavedSample ? sampleDraft.id : ''}
            onChange={(event) => requestSampleAction({ type: 'switch', sampleId: event.target.value })}
          >
            {!activeSavedSample ? <option value="">저장되지 않은 새 샘플</option> : null}
            {sampleLibrary.samples.map((sample) => (
              <option key={sample.id} value={sample.id}>{sample.name}</option>
            ))}
          </select>
        </label>
        <span className={isSampleDirty ? 'save-status save-status--dirty' : 'save-status'}>
          {isSampleDirty ? '저장되지 않은 변경' : '저장됨'}
        </span>
        <div className="sample-toolbar__actions">
          <button type="button" onClick={saveCurrentSample} disabled={!isSampleDirty} title="현재 샘플 저장">
            <Save size={17} aria-hidden="true" />
            <span>저장</span>
          </button>
          <button type="button" onClick={() => saveSampleAs()} title="다른 이름으로 저장">
            <Check size={17} aria-hidden="true" />
            <span>다른 이름</span>
          </button>
          <button type="button" onClick={() => requestSampleAction({ type: 'new' })} title="새 샘플">
            <Plus size={17} aria-hidden="true" />
            <span>새 샘플</span>
          </button>
          <button type="button" onClick={() => saveSampleAs('복제')} title="현재 샘플 복제">
            <Copy size={17} aria-hidden="true" />
            <span>복제</span>
          </button>
          <button type="button" onClick={deleteCurrentSample} title="현재 샘플 삭제">
            <Trash2 size={17} aria-hidden="true" />
            <span>삭제</span>
          </button>
        </div>
      </section>

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

      {activeTab === 'compare' ? (
        <section className="sample-workspace" aria-label="샘플 비교">
          <aside className="sample-editor">
            <section className="control-section">
              <div className="section-title">
                <BookOpen size={18} aria-hidden="true" />
                <h2>활성 샘플 편집</h2>
              </div>

              <label className="field-label">
                <span>샘플명</span>
                <input
                  value={sampleDraft.name}
                  maxLength={40}
                  onChange={(event) => setSampleDraft((current) => ({ ...current, name: event.target.value }))}
                />
              </label>

              <PokemonPicker
                label="포켓몬"
                value={sampleDraft.species}
                selected={selectedSharedPokemonOption}
                options={POKEMON_OPTIONS}
                onChange={setSharedPokemon}
              />

              <BaseStatsTable
                species={selectedSharedPokemonOption}
                nature={sampleDraft.nature}
                statPoints={sampleDraft.statPoints}
              />

              <NatureModifierPicker label="성격" value={sampleDraft.nature} onChange={setSharedNature} />

              <div className="stat-block">
                <div className="stat-block__header">
                  <span>Stat Points</span>
                  <strong>{sharedPointTotal}/{STAT_POINT_TOTAL_LIMIT}</strong>
                </div>
                {STAT_KEYS.map((stat) => (
                  <StatPointControl
                    key={stat}
                    stat={stat}
                    value={sampleDraft.statPoints[stat]}
                    total={sharedPointTotal}
                    onChange={(value) => setSharedStatPoint(stat, value)}
                  />
                ))}
              </div>

              <div className="ability-panel">
                <label className="ability-toggle">
                  <input
                    type="checkbox"
                    checked={sampleDraft.abilityEnabled}
                    disabled={selectedAttackerAbilities.length === 0}
                    onChange={(event) => setSampleDraft((current) => ({
                      ...current,
                      abilityEnabled: event.target.checked,
                    }))}
                  />
                  <span>
                    <strong>특성 적용</strong>
                    <small>{sampleDraft.abilityEnabled && sampleDraft.ability ? displayNameForAbility(sampleDraft.ability) : 'OFF'}</small>
                  </span>
                </label>
                <label className="field-label">
                  <span>특성</span>
                  <select
                    value={sampleDraft.ability}
                    disabled={selectedAttackerAbilities.length === 0}
                    onChange={(event) => setSampleDraft((current) => ({ ...current, ability: event.target.value }))}
                  >
                    {selectedAttackerAbilities.length === 0 ? <option value="">선택 가능 특성 없음</option> : null}
                    {selectedAttackerAbilities.map((ability) => (
                      <option key={ability} value={ability}>{displayNameForAbility(ability)}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field-label">
                <span>지닌 도구</span>
                <select
                  value={sampleDraft.item}
                  disabled={sampleDraft.item === MEGA_STONE_ITEM_ID}
                  onChange={(event) => setSampleDraft((current) => ({ ...current, item: event.target.value }))}
                >
                  {BATTLE_ITEM_OPTIONS
                    .filter((item) => item.id !== MEGA_STONE_ITEM_ID || sampleDraft.item === MEGA_STONE_ITEM_ID)
                    .map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
                {sampleDraft.item === MEGA_STONE_ITEM_ID ? <small>메가폼은 메가스톤 보유 상태로 고정됩니다.</small> : null}
              </label>

              <div className="sample-moves">
                <div className="stat-block__header">
                  <span>공격 기술</span>
                  <strong>{sampleDraft.moves.length}/{SAMPLE_MOVE_SLOT_COUNT}</strong>
                </div>
                {Array.from({ length: SAMPLE_MOVE_SLOT_COUNT }, (_, slot) => {
                  const moveName = sampleDraft.moves[slot] ?? '';
                  const selected = moveName ? getMoveOption(moveName) : null;
                  const usedMoves = new Set(sampleDraft.moves.filter((_, index) => index !== slot));
                  const options = selectedAttackerMoveOptions.filter((move) => !usedMoves.has(move.name));
                  return (
                    <div className="sample-move-slot" key={`sample-move-${slot}`}>
                      <MovePicker
                        label={`기술 ${slot + 1}`}
                        value={selected?.displayName ?? ''}
                        selected={selected}
                        options={options}
                        onChange={(value) => setSampleMove(slot, value)}
                      />
                      <button
                        type="button"
                        className="icon-button"
                        aria-label={`기술 ${slot + 1} 비우기`}
                        title="기술 비우기"
                        disabled={!moveName}
                        onClick={() => setSampleMove(slot, '')}
                      >
                        <X size={17} aria-hidden="true" />
                      </button>
                    </div>
                  );
                })}
              </div>
            </section>

            <section className="control-section benchmark-library">
              <div className="section-title">
                <Pin size={18} aria-hidden="true" />
                <h2>벤치마크 고정</h2>
              </div>
              <div className="benchmark-list">
                {sampleLibrary.samples.filter((sample) => sample.id !== sampleDraft.id).length > 0 ? (
                  sampleLibrary.samples.filter((sample) => sample.id !== sampleDraft.id).map((sample) => {
                    const species = getSpeciesOption(sample.species);
                    const checked = sampleLibrary.benchmarkIds.includes(sample.id);
                    return (
                      <label className={checked ? 'benchmark-option benchmark-option--selected' : 'benchmark-option'} key={sample.id}>
                        <input type="checkbox" checked={checked} onChange={() => toggleBenchmark(sample.id)} />
                        <span>
                          <strong>{sample.name}</strong>
                          <small>{species?.displayName ?? sample.species} · {formatNatureSummary(sample.nature)}</small>
                        </span>
                      </label>
                    );
                  })
                ) : (
                  <div className="benchmark-empty">비교할 저장 샘플을 추가하거나 현재 샘플을 복제하세요.</div>
                )}
              </div>
            </section>
          </aside>

          <section className="sample-results">
            <div className="results-header">
              <div>
                <p className="eyebrow">Sample Matchups</p>
                <h2>벤치마크 비교</h2>
              </div>
              <div className="result-count">{sampleMatchups.length}개 고정</div>
            </div>
            <p className="comparison-condition">Lv50 · 랭크 0 · 직접 배율 1x · 각 샘플의 특성 및 도구 적용</p>
            {sampleMatchups.length > 0 ? (
              <div className="matchup-list">
                {sampleMatchups.map((result) => <SampleMatchupCard key={result.benchmark.id} result={result} />)}
              </div>
            ) : (
              <div className="empty-panel">
                <Pin size={22} aria-hidden="true" />
                <strong>고정된 벤치마크가 없습니다.</strong>
                <span>저장된 다른 샘플을 왼쪽 목록에서 선택하세요.</span>
              </div>
            )}
          </section>
        </section>
      ) : activeTab === 'attack' ? (
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
                    checked={sampleDraft.abilityEnabled}
                    disabled={selectedAttackerAbilities.length === 0}
                    onChange={(event) => setSampleDraft((current) => ({ ...current, abilityEnabled: event.target.checked }))}
                  />
                  <span>
                    <strong>공격 특성 적용</strong>
                    <small>{sampleDraft.abilityEnabled && sampleDraft.ability ? displayNameForAbility(sampleDraft.ability) : 'OFF'}</small>
                  </span>
                </label>

                <label className="field-label">
                  <span>공격 특성</span>
                  <select
                    value={sampleDraft.ability}
                    disabled={selectedAttackerAbilities.length === 0}
                    onChange={(event) => setSampleDraft((current) => ({ ...current, ability: event.target.value }))}
                  >
                    {selectedAttackerAbilities.length === 0 ? (
                      <option value="">선택 가능 특성 없음</option>
                    ) : (
                      selectedAttackerAbilities.map((ability) => (
                        <option key={ability} value={ability}>{displayNameForAbility(ability)}</option>
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
                            { ...sampleAttackConfig, hitCount: 'auto' },
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
                <span>지닌 도구</span>
                <select
                  value={sampleDraft.item}
                  disabled={sampleDraft.item === MEGA_STONE_ITEM_ID}
                  onChange={(event) => setSampleDraft((current) => ({ ...current, item: event.target.value }))}
                >
                  {BATTLE_ITEM_OPTIONS
                    .filter((item) => item.id !== MEGA_STONE_ITEM_ID || sampleDraft.item === MEGA_STONE_ITEM_ID)
                    .map((item) => (
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

              <label className="ability-toggle condition-toggle">
                <input
                  type="checkbox"
                  checked={defenderBulk.targetHasHeldItem}
                  onChange={(event) => setDefenderBulk((current) => ({
                    ...current,
                    targetHasHeldItem: event.target.checked,
                  }))}
                />
                <span>
                  <strong>피격 대상 도구 보유</strong>
                  <small>{defenderBulk.targetHasHeldItem ? 'ON' : 'OFF'}</small>
                </span>
              </label>

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

              <div className="ability-panel">
                <label className="ability-toggle">
                  <input
                    type="checkbox"
                    checked={sampleDraft.abilityEnabled}
                    disabled={selectedAttackerAbilities.length === 0}
                    onChange={(event) => setSampleDraft((current) => ({ ...current, abilityEnabled: event.target.checked }))}
                  />
                  <span>
                    <strong>방어 특성 적용</strong>
                    <small>{sampleDraft.abilityEnabled && sampleDraft.ability ? displayNameForAbility(sampleDraft.ability) : 'OFF'}</small>
                  </span>
                </label>
                <label className="field-label">
                  <span>방어 특성</span>
                  <select
                    value={sampleDraft.ability}
                    disabled={selectedAttackerAbilities.length === 0}
                    onChange={(event) => setSampleDraft((current) => ({ ...current, ability: event.target.value }))}
                  >
                    {selectedAttackerAbilities.length === 0 ? <option value="">선택 가능 특성 없음</option> : null}
                    {selectedAttackerAbilities.map((ability) => (
                      <option key={ability} value={ability}>{displayNameForAbility(ability)}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="field-label">
                <span>지닌 도구</span>
                <select
                  value={sampleDraft.item}
                  disabled={sampleDraft.item === MEGA_STONE_ITEM_ID}
                  onChange={(event) => setSampleDraft((current) => ({ ...current, item: event.target.value }))}
                >
                  {BATTLE_ITEM_OPTIONS
                    .filter((item) => item.id !== MEGA_STONE_ITEM_ID || sampleDraft.item === MEGA_STONE_ITEM_ID)
                    .map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                </select>
              </label>

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
                  value={sampleDraft.item}
                  disabled={sampleDraft.item === MEGA_STONE_ITEM_ID}
                  onChange={(event) => setSampleDraft((current) => ({ ...current, item: event.target.value }))}
                >
                  {BATTLE_ITEM_OPTIONS
                    .filter((item) => item.id !== MEGA_STONE_ITEM_ID || sampleDraft.item === MEGA_STONE_ITEM_ID)
                    .map((item) => (
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
                <span>도구 {formatMultiplier(selectedSpeedItem.speedMultiplier)}</span>
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
                            <td>{result.selfFinalSpeed}<small className="stat-detail">기본 실수치 {result.selfBaseSpeed}</small></td>
                            <td>{result.targetFinalSpeed}<small className="stat-detail">기본 실수치 {result.targetBaseSpeed}</small></td>
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

      {pendingSampleAction ? (
        <div className="modal-backdrop" role="presentation">
          <section className="confirm-dialog" role="dialog" aria-modal="true" aria-labelledby="unsaved-dialog-title">
            <div>
              <p className="eyebrow">Unsaved Changes</p>
              <h2 id="unsaved-dialog-title">변경 사항을 저장할까요?</h2>
              <p>현재 샘플의 저장되지 않은 변경이 있습니다. 계속하기 전에 처리 방법을 선택하세요.</p>
            </div>
            <div className="confirm-dialog__actions">
              <button type="button" className="primary-button" onClick={saveAndContinuePendingAction}>
                <Save size={17} aria-hidden="true" />
                저장 후 계속
              </button>
              <button type="button" onClick={discardAndContinuePendingAction}>변경 취소</button>
              <button type="button" onClick={() => setPendingSampleAction(null)}>돌아가기</button>
            </div>
          </section>
        </div>
      ) : null}

    </main>
  );
}

export default App;



