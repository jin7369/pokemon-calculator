import { getLearnableAttackMoveOptionsForSpecies, getSpeciesOption } from './pokemonData';
import { itemForSpecies, isBattleItemId, NO_BATTLE_ITEM_ID } from './battleItems';
import { normalizeStatPoints } from './statPoints';
import { EMPTY_SPREAD, type StatPointSpread } from './types';

export const SAMPLE_STORAGE_VERSION = 1;
export const SAMPLE_MOVE_SLOT_COUNT = 4;
export const SAMPLE_STORAGE_KEY = 'pokemon-calculator.samples.v1';

export interface BattleSample {
  id: string;
  name: string;
  species: string;
  nature: string;
  statPoints: StatPointSpread;
  ability: string;
  abilityEnabled: boolean;
  item: string;
  moves: string[];
}

export interface SampleLibraryData {
  version: typeof SAMPLE_STORAGE_VERSION;
  samples: BattleSample[];
  activeSampleId: string;
  benchmarkIds: string[];
}

export interface SampleStorageResult {
  data: SampleLibraryData;
  warning: string | null;
}

export interface SampleStorageAdapter {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function fallbackId(): string {
  return `sample-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function createSampleId(): string {
  return globalThis.crypto?.randomUUID?.() ?? fallbackId();
}

export function createDefaultBattleSample(id = createSampleId()): BattleSample {
  return {
    id,
    name: '리자몽 기본',
    species: 'Charizard',
    nature: 'Modest',
    statPoints: { ...EMPTY_SPREAD },
    ability: 'Blaze',
    abilityEnabled: false,
    item: NO_BATTLE_ITEM_ID,
    moves: ['Flamethrower'],
  };
}

export function createDefaultSampleLibrary(): SampleLibraryData {
  const sample = createDefaultBattleSample();
  return {
    version: SAMPLE_STORAGE_VERSION,
    samples: [sample],
    activeSampleId: sample.id,
    benchmarkIds: [],
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function sanitizeBattleSample(value: unknown): BattleSample | null {
  if (!isRecord(value)) return null;

  const speciesName = typeof value.species === 'string' ? value.species : '';
  const species = getSpeciesOption(speciesName);
  if (!species) return null;

  const learnableMoves = new Set(getLearnableAttackMoveOptionsForSpecies(species.name).map((move) => move.name));
  const moves = Array.isArray(value.moves)
    ? [...new Set(value.moves.filter((move): move is string => typeof move === 'string' && learnableMoves.has(move)))]
      .slice(0, SAMPLE_MOVE_SLOT_COUNT)
    : [];
  const abilities = species.abilities;
  const requestedAbility = typeof value.ability === 'string' ? value.ability : '';
  const ability = abilities.includes(requestedAbility) ? requestedAbility : (abilities[0] ?? '');
  const requestedItem = isBattleItemId(value.item) ? value.item : NO_BATTLE_ITEM_ID;
  const rawName = typeof value.name === 'string' ? value.name.trim().slice(0, 40) : '';

  return {
    id: typeof value.id === 'string' && value.id.length > 0 ? value.id : createSampleId(),
    name: rawName || `${species.displayName} 샘플`,
    species: species.name,
    nature: typeof value.nature === 'string' ? value.nature : 'Serious',
    statPoints: normalizeStatPoints(isRecord(value.statPoints) ? value.statPoints : EMPTY_SPREAD),
    ability,
    abilityEnabled: Boolean(value.abilityEnabled && ability),
    item: itemForSpecies(species.name, requestedItem),
    moves,
  };
}

export function normalizeSampleForSpecies(sample: BattleSample, speciesName: string): BattleSample {
  const species = getSpeciesOption(speciesName);
  if (!species) return sample;
  const learnableMoves = new Set(getLearnableAttackMoveOptionsForSpecies(species.name).map((move) => move.name));
  const ability = species.abilities.includes(sample.ability) ? sample.ability : (species.abilities[0] ?? '');

  return {
    ...sample,
    species: species.name,
    ability,
    abilityEnabled: Boolean(sample.abilityEnabled && ability),
    item: itemForSpecies(species.name, sample.item),
    moves: sample.moves.filter((move) => learnableMoves.has(move)).slice(0, SAMPLE_MOVE_SLOT_COUNT),
  };
}

export function samplesEqual(left: BattleSample, right: BattleSample): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function sanitizeSampleLibrary(value: unknown): SampleStorageResult {
  if (!isRecord(value) || value.version !== SAMPLE_STORAGE_VERSION || !Array.isArray(value.samples)) {
    return { data: createDefaultSampleLibrary(), warning: '저장된 샘플 형식을 읽을 수 없어 기본 샘플로 복구했습니다.' };
  }

  const seenIds = new Set<string>();
  const samples = value.samples
    .map(sanitizeBattleSample)
    .filter((sample): sample is BattleSample => Boolean(sample))
    .map((sample) => {
      if (!seenIds.has(sample.id)) {
        seenIds.add(sample.id);
        return sample;
      }
      const next = { ...sample, id: createSampleId() };
      seenIds.add(next.id);
      return next;
    });

  if (samples.length === 0) {
    return { data: createDefaultSampleLibrary(), warning: '유효한 샘플이 없어 기본 샘플로 복구했습니다.' };
  }

  const requestedActiveId = typeof value.activeSampleId === 'string' ? value.activeSampleId : '';
  const activeSampleId = samples.some((sample) => sample.id === requestedActiveId)
    ? requestedActiveId
    : samples[0].id;
  const validIds = new Set(samples.map((sample) => sample.id));
  const benchmarkIds = Array.isArray(value.benchmarkIds)
    ? [...new Set(value.benchmarkIds.filter((id): id is string => (
      typeof id === 'string' && id !== activeSampleId && validIds.has(id)
    )))]
    : [];

  return {
    data: { version: SAMPLE_STORAGE_VERSION, samples, activeSampleId, benchmarkIds },
    warning: samples.length === value.samples.length ? null : '일부 손상된 샘플을 제외하고 불러왔습니다.',
  };
}

export function loadSampleLibrary(storage: SampleStorageAdapter): SampleStorageResult {
  try {
    const raw = storage.getItem(SAMPLE_STORAGE_KEY);
    if (!raw) return { data: createDefaultSampleLibrary(), warning: null };
    return sanitizeSampleLibrary(JSON.parse(raw));
  } catch {
    return { data: createDefaultSampleLibrary(), warning: '브라우저 저장소를 읽지 못해 현재 실행에서만 샘플을 유지합니다.' };
  }
}

export function saveSampleLibrary(storage: SampleStorageAdapter, data: SampleLibraryData): string | null {
  try {
    storage.setItem(SAMPLE_STORAGE_KEY, JSON.stringify(data));
    return null;
  } catch {
    return '브라우저 저장소에 기록하지 못했습니다. 저장 공간과 브라우저 설정을 확인하세요.';
  }
}
