import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Gauge, Search, Shield, SlidersHorizontal, Swords } from 'lucide-react';
import { useRef } from 'react';
import './App.css';
import {
  CATEGORY_LABELS,
  EMPTY_SPREAD,
  STAT_LABELS,
  STAT_KEYS,
  type AttackConfig,
  type DefenderBulkConfig,
  type SpeciesOption,
  type SortKey,
  type StatKey,
  type SurvivalCategory,
} from './domain/types';
import {
  MOVE_OPTIONS,
  NATURE_OPTIONS,
  POKEMON_OPTIONS,
  POKEMON_RULESET,
  getMoveOption,
  getSpeciesOption,
  resolveMoveName,
  resolveSpeciesName,
} from './domain/pokemonData';
import {
  calculateAttackResults,
  offensiveStatForCategory,
  sortResults,
} from './domain/damage';
import {
  STAT_POINT_PER_STAT_LIMIT,
  STAT_POINT_TOTAL_LIMIT,
  totalStatPoints,
  updateStatPoint,
} from './domain/statPoints';

type TabKey = 'attack' | 'defense' | 'speed';

type FilterState = Record<SurvivalCategory, boolean>;

interface SearchSelectOption {
  id: string;
  name: string;
  displayName: string;
}

const DIRECT_MULTIPLIERS = [0.25, 0.5, 0.75, 1, 1.5, 2, 3, 4];
const BOOST_STAGES = [-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6];
const CATEGORY_ORDER: SurvivalCategory[] = ['survives', 'roll', 'ko'];
const INITIAL_VISIBLE_RESULTS = 120;
const LOAD_MORE_RESULTS = 120;
const INPUT_DEBOUNCE_MS = 180;
const SEARCH_DEBOUNCE_MS = 120;
const SEARCH_SELECT_LIMIT = 40;
const POKEMON_PICKER_PAGE_SIZE = 10;

const INITIAL_ATTACK: AttackConfig = {
  attacker: '리자몽',
  move: '화염방사',
  nature: 'Modest',
  attackStatPoints: { atk: 0, spa: 31 },
  boostStage: 0,
  directMultiplier: 1,
};

const INITIAL_DEFENDER_BULK: DefenderBulkConfig = {
  nature: 'Serious',
  statPoints: { hp: 0, def: 0, spd: 0 },
};

const INITIAL_FILTERS: FilterState = {
  survives: true,
  roll: true,
  ko: true,
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

function matchesSearchOption(option: SearchSelectOption, query: string): boolean {
  const normalizedQuery = query.trim().toLowerCase();
  if (normalizedQuery.length === 0) return true;

  return (
    option.displayName.toLowerCase().includes(normalizedQuery) ||
    option.name.toLowerCase().includes(normalizedQuery) ||
    option.id.toLowerCase().includes(normalizedQuery)
  );
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

function SearchSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: SearchSelectOption[];
  onChange: (value: string) => void;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [showAllOptions, setShowAllOptions] = useState(false);
  const isInteractingWithList = useRef(false);
  const listboxId = `${label.replace(/\s+/g, '-')}-options`;
  const visibleOptions = useMemo(() => {
    const query = showAllOptions ? '' : value;
    const matches = options.filter((option) => matchesSearchOption(option, query));
    const currentOption = options.find((option) => option.displayName === value || option.name === value || option.id === value);

    if (showAllOptions && currentOption) {
      return [currentOption, ...matches.filter((option) => option.id !== currentOption.id)].slice(0, SEARCH_SELECT_LIMIT);
    }

    return matches.slice(0, SEARCH_SELECT_LIMIT);
  }, [options, showAllOptions, value]);

  useEffect(() => {
    setActiveIndex(0);
  }, [showAllOptions, value]);

  function selectOption(option: SearchSelectOption) {
    onChange(option.displayName);
    setIsOpen(false);
    setActiveIndex(0);
    setShowAllOptions(false);
    isInteractingWithList.current = false;
  }

  function releaseListInteraction() {
    window.setTimeout(() => {
      isInteractingWithList.current = false;
    }, 0);
  }

  return (
    <label className="field-label combo-field">
      <span>{label}</span>
      <div className="combo-field__control">
        <input
          value={value}
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          onFocus={(event) => {
            event.currentTarget.select();
            setShowAllOptions(true);
            setIsOpen(true);
          }}
          onBlur={() => {
            window.setTimeout(() => {
              if (!isInteractingWithList.current) {
                setIsOpen(false);
              }
            }, 0);
          }}
          onChange={(event) => {
            setShowAllOptions(false);
            onChange(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setIsOpen(true);
              setActiveIndex((current) => Math.min(current + 1, Math.max(visibleOptions.length - 1, 0)));
              return;
            }

            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
              return;
            }

            if (event.key === 'Enter' && isOpen && visibleOptions[activeIndex]) {
              event.preventDefault();
              selectOption(visibleOptions[activeIndex]);
              return;
            }

            if (event.key === 'Escape') {
              setIsOpen(false);
            }
          }}
        />
        {isOpen ? (
          <div
            className="combo-field__list"
            id={listboxId}
            role="listbox"
            onPointerDownCapture={() => {
              isInteractingWithList.current = true;
            }}
            onPointerUpCapture={releaseListInteraction}
            onPointerCancelCapture={releaseListInteraction}
          >
            {visibleOptions.length > 0 ? (
              visibleOptions.map((option, index) => (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  className={index === activeIndex ? 'combo-field__option combo-field__option--active' : 'combo-field__option'}
                  onMouseEnter={() => setActiveIndex(index)}
                  onMouseDown={(event) => event.preventDefault()}
                  onClick={() => selectOption(option)}
                >
                  <span>{option.displayName}</span>
                  <small>{option.name}</small>
                </button>
              ))
            ) : (
              <div className="combo-field__empty">검색 결과 없음</div>
            )}
          </div>
        ) : null}
      </div>
    </label>
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

function BaseStatsTable({ species }: { species: SpeciesOption | null }) {
  if (!species) return null;

  const total = baseStatTotal(species);

  return (
    <div className="base-stats-panel" aria-label={`${species.displayName} 종족값`}>
      <div className="base-stats-panel__title">
        <span>{species.displayName}</span>
        <small>{species.name}</small>
      </div>
      <table className="base-stats-table">
        <thead>
          <tr>
            {STAT_KEYS.map((stat) => (
              <th key={stat}>{STAT_LABELS[stat]}</th>
            ))}
            <th>합계</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {STAT_KEYS.map((stat) => (
              <td key={stat}>{species.baseStats[stat]}</td>
            ))}
            <td>{total}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function EmptyPanel({ title }: { title: string }) {
  return (
    <section className="empty-panel">
      <h2>{title}</h2>
      <p>준비 중</p>
    </section>
  );
}

function App() {
  const [activeTab, setActiveTab] = useState<TabKey>('attack');
  const [attack, setAttack] = useState<AttackConfig>(INITIAL_ATTACK);
  const [defenderBulk, setDefenderBulk] = useState<DefenderBulkConfig>(INITIAL_DEFENDER_BULK);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [targetSearch, setTargetSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('maxPercentDesc');
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE_RESULTS);

  const debouncedAttack = useDebouncedValue(attack, INPUT_DEBOUNCE_MS);
  const debouncedDefenderBulk = useDebouncedValue(defenderBulk, INPUT_DEBOUNCE_MS);
  const debouncedTargetSearch = useDebouncedValue(targetSearch, SEARCH_DEBOUNCE_MS);

  const selectedAttacker = resolveSpeciesName(attack.attacker);
  const selectedAttackerOption = selectedAttacker ? getSpeciesOption(selectedAttacker) : null;
  const selectedMoveName = resolveMoveName(attack.move);
  const selectedMove = selectedMoveName ? getMoveOption(selectedMoveName) : null;
  const activeAttackStat = selectedMove ? offensiveStatForCategory(selectedMove.category) : 'spa';

  const calculationAttack = useMemo<AttackConfig | null>(() => {
    const calculationAttacker = resolveSpeciesName(debouncedAttack.attacker);
    const calculationMove = resolveMoveName(debouncedAttack.move);

    if (!calculationAttacker || !calculationMove) return null;

    return {
      ...debouncedAttack,
      attacker: calculationAttacker,
      move: calculationMove,
    };
  }, [debouncedAttack]);

  const calculation = useMemo(() => {
    if (!calculationAttack) return { results: [], summary: { survives: 0, roll: 0, ko: 0, total: 0 } };
    return calculateAttackResults(calculationAttack, debouncedDefenderBulk);
  }, [calculationAttack, debouncedDefenderBulk]);

  const filteredResults = useMemo(() => {
    const query = debouncedTargetSearch.trim().toLowerCase();
    const visible = calculation.results.filter((result) => {
      const matchesCategory = filters[result.category];
      const matchesQuery = query.length === 0 || (result.displayName ?? result.name).toLowerCase().includes(query) || result.name.toLowerCase().includes(query);
      return matchesCategory && matchesQuery;
    });

    return sortResults(visible, sortKey);
  }, [calculation.results, filters, sortKey, debouncedTargetSearch]);

  useEffect(() => {
    setVisibleCount(INITIAL_VISIBLE_RESULTS);
  }, [calculation.results, filters, sortKey, debouncedTargetSearch]);

  const visibleResults = useMemo(
    () => filteredResults.slice(0, visibleCount),
    [filteredResults, visibleCount],
  );

  const attackPointSpread = toFullSpread(attack.attackStatPoints);
  const defensePointSpread = toFullSpread(defenderBulk.statPoints);
  const attackPointTotal = totalStatPoints(attackPointSpread);
  const defensePointTotal = totalStatPoints(defensePointSpread);

  function setAttackStatPoint(stat: 'atk' | 'spa', value: number) {
    setAttack((current) => {
      const next = updateStatPoint(toFullSpread(current.attackStatPoints), stat, value);
      return {
        ...current,
        attackStatPoints: { atk: next.atk, spa: next.spa },
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
                value={attack.attacker}
                selected={selectedAttackerOption}
                options={POKEMON_OPTIONS}
                onChange={(value) => setAttack((current) => ({ ...current, attacker: value }))}
              />

              <BaseStatsTable species={selectedAttackerOption} />

              <SearchSelect
                label="공격 기술"
                value={attack.move}
                options={MOVE_OPTIONS}
                onChange={(value) => setAttack((current) => ({ ...current, move: value }))}
              />

              {selectedMove ? (
                <div className="move-summary">
                  <TypeBadge type={selectedMove.type} />
                  <span>{selectedMove.category}</span>
                  <span>위력 {selectedMove.basePower}</span>
                </div>
              ) : null}

              <label className="field-label">
                <span>성격</span>
                <select
                  value={attack.nature}
                  onChange={(event) => setAttack((current) => ({ ...current, nature: event.target.value }))}
                >
                  {NATURE_OPTIONS.map((nature) => (
                    <option key={nature.name} value={nature.name}>{nature.label}</option>
                  ))}
                </select>
              </label>

              <div className="stat-block">
                <div className="stat-block__header">
                  <span>공격 Stat Points</span>
                  <strong>{STAT_LABELS[activeAttackStat]} 적용</strong>
                </div>
                <StatPointControl
                  stat="atk"
                  value={attack.attackStatPoints.atk}
                  total={attackPointTotal}
                  onChange={(value) => setAttackStatPoint('atk', value)}
                />
                <StatPointControl
                  stat="spa"
                  value={attack.attackStatPoints.spa}
                  total={attackPointTotal}
                  onChange={(value) => setAttackStatPoint('spa', value)}
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

              <label className="field-label">
                <span>성격</span>
                <select
                  value={defenderBulk.nature}
                  onChange={(event) => setDefenderBulk((current) => ({ ...current, nature: event.target.value }))}
                >
                  {NATURE_OPTIONS.map((nature) => (
                    <option key={nature.name} value={nature.name}>{nature.label}</option>
                  ))}
                </select>
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
              <div className="result-count">{visibleResults.length}/{filteredResults.length} 표시</div>
            </div>

            {!selectedAttacker || !selectedMoveName ? (
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
                      {visibleResults.map((result) => (
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
                      ))}
                    </tbody>
                  </table>
                </div>

                {visibleResults.length < filteredResults.length ? (
                  <button
                    type="button"
                    className="load-more-button"
                    onClick={() => setVisibleCount((current) => Math.min(current + LOAD_MORE_RESULTS, filteredResults.length))}
                  >
                    더 보기 ({(filteredResults.length - visibleResults.length).toLocaleString()}개 남음)
                  </button>
                ) : null}
              </>
            )}
          </section>
        </section>
      ) : activeTab === 'defense' ? (
        <EmptyPanel title="수비 계산" />
      ) : (
        <EmptyPanel title="스피드 계산" />
      )}

    </main>
  );
}

export default App;



