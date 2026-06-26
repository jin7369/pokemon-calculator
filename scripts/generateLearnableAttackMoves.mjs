import fs from 'node:fs';
import { Dex } from '@pkmn/dex';
import { Generations as DataGenerations } from '@pkmn/data';
import { Generations as CalcGenerations } from '@smogon/calc';
import { CHAMPIONS_MOVE_OVERRIDES } from './championsMoveOverrides.mjs';

const RULESET_PATH = 'src/data/championsRulesets.ts';
const OUTPUT_PATH = 'src/data/learnableAttackMoves.ts';
const ATTACK_MOVES_OUTPUT_PATH = 'src/data/championsAttackMoves.ts';

function extractStringArray(source, propertyName) {
  const match = source.match(new RegExp(`${propertyName}: \\[([\\s\\S]*?)\\]`));
  if (!match) {
    throw new Error(`Could not find ${propertyName} in ${RULESET_PATH}`);
  }

  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'));
}

function uniquePreserveOrder(values) {
  return [...new Set(values)];
}

function fallbackLearnsetNames(species) {
  const names = [species.name, species.baseSpecies];
  const dexSpecies = Dex.species.get(species.name);

  names.push(dexSpecies.baseSpecies);

  if (species.name.includes('-Mega')) {
    names.push(species.name.replace(/-Mega.*$/, ''));
    names.push(species.baseSpecies?.replace(/-Mega.*$/, ''));
  }

  if (species.name.startsWith('Aegislash-')) {
    names.push('Aegislash');
  }

  return uniquePreserveOrder(names.filter(Boolean));
}

async function rawLearnsetMoveIdsForSpecies(species) {
  for (const name of fallbackLearnsetNames(species)) {
    const learnsetData = await Dex.learnsets.get(name);
    const moveIds = Object.keys(learnsetData.learnset ?? {});
    if (moveIds.length > 0) return moveIds;
  }

  return [];
}

async function interpretedLearnsetMoveIdsForSpecies(species, dataGen) {
  for (const name of fallbackLearnsetNames(species)) {
    const learnableMoves = await dataGen.learnsets.learnable(name);
    const moveIds = Object.keys(learnableMoves ?? {});
    if (moveIds.length > 0) return moveIds;
  }

  return rawLearnsetMoveIdsForSpecies(species);
}

function allOverrideMoveIds() {
  return uniqueSorted([
    ...(CHAMPIONS_MOVE_OVERRIDES.globalAddedMoveIds ?? []),
    ...(CHAMPIONS_MOVE_OVERRIDES.globalRemovedMoveIds ?? []),
    ...Object.values(CHAMPIONS_MOVE_OVERRIDES.species ?? {}).flatMap((override) => [
      ...(override.addedMoveIds ?? []),
      ...(override.removedMoveIds ?? []),
    ]),
  ]);
}

function validateOverrideMoveIds(overrideMoveIds, calcAttackMoveIds) {
  const invalidMoveIds = overrideMoveIds.filter((moveId) => !calcAttackMoveIds.has(moveId));

  if (invalidMoveIds.length > 0) {
    throw new Error(`Champions move overrides contain non-damaging or unknown move IDs: ${invalidMoveIds.join(', ')}`);
  }
}

function applyMoveOverrides(speciesName, moveIds, attackMoveIds) {
  const override = CHAMPIONS_MOVE_OVERRIDES.species?.[speciesName] ?? {};
  const moveSet = new Set(moveIds);

  for (const moveId of CHAMPIONS_MOVE_OVERRIDES.globalRemovedMoveIds ?? []) {
    moveSet.delete(moveId);
  }

  for (const moveId of override.removedMoveIds ?? []) {
    moveSet.delete(moveId);
  }

  for (const moveId of override.addedMoveIds ?? []) {
    if (attackMoveIds.has(moveId)) {
      moveSet.add(moveId);
    }
  }

  return uniqueSorted([...moveSet].filter((moveId) => attackMoveIds.has(moveId)));
}

const rulesetSource = fs.readFileSync(RULESET_PATH, 'utf8');
const baseSpecies = extractStringArray(rulesetSource, 'baseSpecies');
const exactSpecies = extractStringArray(rulesetSource, 'exactSpecies');
const derivedSpecies = extractStringArray(rulesetSource, 'derivedSpecies');
const includeMegaForms = /includeMegaForms:\s*true/.test(rulesetSource);

const calcGen = CalcGenerations.get(9);
const dataGen = new DataGenerations(Dex).get(9);
const calcAttackMoveIds = new Set(
  Array.from(calcGen.moves)
    .filter((move) => (move.category === 'Physical' || move.category === 'Special') && (move.basePower ?? 0) > 0)
    .map((move) => move.id),
);
validateOverrideMoveIds(allOverrideMoveIds(), calcAttackMoveIds);

const globalAddedMoveIds = new Set(CHAMPIONS_MOVE_OVERRIDES.globalAddedMoveIds ?? []);
const globalRemovedMoveIds = new Set(CHAMPIONS_MOVE_OVERRIDES.globalRemovedMoveIds ?? []);
const speciesAddedMoveIds = new Set(
  Object.values(CHAMPIONS_MOVE_OVERRIDES.species ?? {}).flatMap((override) => override.addedMoveIds ?? []),
);
const attackMoveIds = new Set(
  [
    ...Array.from(dataGen.moves)
      .filter((move) => (move.category === 'Physical' || move.category === 'Special') && (move.basePower ?? 0) > 0)
      .map((move) => move.id),
    ...globalAddedMoveIds,
    ...speciesAddedMoveIds,
  ]
    .filter((moveId) => calcAttackMoveIds.has(moveId))
    .filter((moveId) => !globalRemovedMoveIds.has(moveId)),
);
const baseSpeciesSet = new Set(baseSpecies);
const selectableSpecies = new Set([...baseSpecies, ...exactSpecies, ...derivedSpecies]);
const speciesList = Array.from(calcGen.species)
  .filter((species) => {
    if (!species.name || !species.baseStats?.hp) return false;
    if (selectableSpecies.has(species.name)) return true;

    const baseName = species.baseSpecies ?? species.name;
    return includeMegaForms && species.name.includes('-Mega') && baseSpeciesSet.has(baseName);
  })
  .sort((left, right) => left.name.localeCompare(right.name, 'en'));

const output = {};
const emptySpecies = [];

for (const species of speciesList) {
  const learnsetMoveIds = await interpretedLearnsetMoveIdsForSpecies(species, dataGen);
  const attackMoves = applyMoveOverrides(species.name, learnsetMoveIds, attackMoveIds);
  output[species.name] = attackMoves;

  if (attackMoves.length === 0) {
    emptySpecies.push(species.name);
  }
}

const attackMovesContent = `// Generated by scripts/generateLearnableAttackMoves.mjs.\n// Move IDs include standard Gen 9 damaging moves plus explicit Pokemon Champions overrides.\n\nexport const CHAMPIONS_ATTACK_MOVE_IDS = ${JSON.stringify(uniqueSorted([...attackMoveIds]), null, 2)} as const;\n`;

const content = `// Generated by scripts/generateLearnableAttackMoves.mjs.\n// Move IDs are scoped to Pokemon Champions species, standard Gen 9 damaging moves, and explicit Champions overrides.\n\nexport const LEARNABLE_ATTACK_MOVE_IDS_BY_SPECIES = ${JSON.stringify(output, null, 2)} as const;\n`;

fs.writeFileSync(ATTACK_MOVES_OUTPUT_PATH, attackMovesContent);
fs.writeFileSync(OUTPUT_PATH, content);

console.log(JSON.stringify({
  species: speciesList.length,
  attackMoves: attackMoveIds.size,
  emptySpecies,
  attackMovesOutputPath: ATTACK_MOVES_OUTPUT_PATH,
  outputPath: OUTPUT_PATH,
}, null, 2));
