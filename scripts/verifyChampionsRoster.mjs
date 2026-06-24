import fs from 'node:fs';
import { Dex } from '@pkmn/dex';
import { Generations } from '@smogon/calc';

const RULESET_PATH = 'src/data/championsRulesets.ts';
const OFFICIAL_REGULATION_URL =
  'https://web-view.app.pokemonchampions.jp/battle/pages/regulations/r1780458vgoech/ko/pokemon.html';

const OFFICIAL_FORM_CODE_TO_CALC_NAME = {
  '0026-001': 'Raichu-Alola',
  '0038-001': 'Ninetales-Alola',
  '0059-001': 'Arcanine-Hisui',
  '0080-002': 'Slowbro-Galar',
  '0128-001': 'Tauros-Paldea-Combat',
  '0128-002': 'Tauros-Paldea-Blaze',
  '0128-003': 'Tauros-Paldea-Aqua',
  '0157-001': 'Typhlosion-Hisui',
  '0199-001': 'Slowking-Galar',
  '0479-001': 'Rotom-Heat',
  '0479-002': 'Rotom-Wash',
  '0479-003': 'Rotom-Frost',
  '0479-004': 'Rotom-Fan',
  '0479-005': 'Rotom-Mow',
  '0503-001': 'Samurott-Hisui',
  '0571-001': 'Zoroark-Hisui',
  '0618-001': 'Stunfisk-Galar',
  '0666-018': 'Vivillon-Fancy',
  '0670-005': 'Floette-Eternal',
  '0678-001': 'Meowstic-F',
  '0706-001': 'Goodra-Hisui',
  '0711-001': 'Gourgeist-Small',
  '0711-002': 'Gourgeist-Large',
  '0711-003': 'Gourgeist-Super',
  '0713-001': 'Avalugg-Hisui',
  '0724-001': 'Decidueye-Hisui',
  '0745-001': 'Lycanroc-Midnight',
  '0745-002': 'Lycanroc-Dusk',
  '0902-001': 'Basculegion-F',
};

function uniqueSorted(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right, 'en'));
}

function extractStringArray(source, propertyName) {
  const match = source.match(new RegExp(`${propertyName}: \\[([\\s\\S]*?)\\]`));
  if (!match) {
    throw new Error(`Could not find ${propertyName} in ${RULESET_PATH}`);
  }

  return [...match[1].matchAll(/'([^']+)'/g)].map((item) => item[1]);
}

function difference(left, right) {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function countDuplicates(values) {
  const counts = new Map();
  for (const value of values) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count > 1)
    .sort(([left], [right]) => left.localeCompare(right, 'en'));
}

function formatList(values) {
  return values.length > 0 ? values.join(', ') : 'none';
}

async function fetchOfficialPokemonRows() {
  const response = await fetch(OFFICIAL_REGULATION_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch official regulation page: ${response.status}`);
  }

  const html = await response.text();
  const match = html.match(/const pokemons = (\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error('Could not find official pokemons array');
  }

  return Function(`return ${match[1]}`)();
}

function buildBaseSpeciesByDexNumber() {
  const byNumber = new Map();

  for (const species of Dex.species.all()) {
    if (!species.exists || species.num <= 0 || species.forme) continue;
    byNumber.set(String(species.num).padStart(4, '0'), species.name);
  }

  return byNumber;
}

function mapOfficialCodeToCalcName(code, baseSpeciesByDexNumber) {
  const [dexNumber, formCode] = code.split('-');

  if (formCode === '000') {
    const baseName = baseSpeciesByDexNumber.get(dexNumber);
    return baseName === 'Aegislash' ? 'Aegislash-Blade' : baseName;
  }

  return OFFICIAL_FORM_CODE_TO_CALC_NAME[code];
}

const rulesetSource = fs.readFileSync(RULESET_PATH, 'utf8');
const baseSpecies = extractStringArray(rulesetSource, 'baseSpecies');
const exactSpecies = extractStringArray(rulesetSource, 'exactSpecies');
const derivedSpecies = extractStringArray(rulesetSource, 'derivedSpecies');

const officialRows = await fetchOfficialPokemonRows();
const baseSpeciesByDexNumber = buildBaseSpeciesByDexNumber();
const officialSpecies = officialRows.map(([code]) => {
  const calcName = mapOfficialCodeToCalcName(code, baseSpeciesByDexNumber);
  if (!calcName) {
    throw new Error(`Could not map official Pokemon code ${code}`);
  }

  return calcName;
});
const officialUniqueSpecies = uniqueSorted(officialSpecies);
const rulesetOfficialSpecies = uniqueSorted([...baseSpecies, ...exactSpecies]);

const genSpecies = Array.from(Generations.get(9).species);
const calcSpeciesNames = new Set(genSpecies.map((species) => species.name));
const allowedBaseSpecies = new Set(baseSpecies);
const allowedSpecies = genSpecies.filter((species) => {
  const baseName = species.baseSpecies ?? species.name;
  return (
    baseSpecies.includes(species.name) ||
    exactSpecies.includes(species.name) ||
    derivedSpecies.includes(species.name) ||
    (species.name.includes('-Mega') && allowedBaseSpecies.has(baseName))
  );
});
const autoMegaSpecies = allowedSpecies
  .filter((species) => species.name.includes('-Mega'))
  .map((species) => species.name)
  .sort((left, right) => left.localeCompare(right, 'en'));

const missingFromRuleset = difference(officialUniqueSpecies, rulesetOfficialSpecies);
const extraInRuleset = difference(rulesetOfficialSpecies, officialUniqueSpecies);
const invalidBaseSpecies = baseSpecies.filter((name) => !calcSpeciesNames.has(name));
const invalidExactSpecies = exactSpecies.filter((name) => !calcSpeciesNames.has(name));
const invalidDerivedSpecies = derivedSpecies.filter((name) => !calcSpeciesNames.has(name));
const duplicateRulesetNames = countDuplicates([...baseSpecies, ...exactSpecies, ...derivedSpecies]);
const duplicateOfficialNames = countDuplicates(officialSpecies);

console.log('Pokemon Champions roster verification');
console.log('');
console.log(`Official regulation URL: ${OFFICIAL_REGULATION_URL}`);
console.log(`Official page entries: ${officialRows.length}`);
console.log(`Official unique calc names: ${officialUniqueSpecies.length}`);
console.log(`Ruleset official entries: ${rulesetOfficialSpecies.length}`);
console.log(`Ruleset baseSpecies entries: ${baseSpecies.length}`);
console.log(`Ruleset exactSpecies entries: ${exactSpecies.length}`);
console.log(`Ruleset derivedSpecies entries: ${derivedSpecies.length}`);
console.log(`Final selectable calc species: ${allowedSpecies.length}`);
console.log(`Auto-included Mega species: ${autoMegaSpecies.length}`);
console.log('');
console.log(`Missing from ruleset vs official page: ${formatList(missingFromRuleset)}`);
console.log(`Extra in ruleset vs official page: ${formatList(extraInRuleset)}`);
console.log(`Invalid baseSpecies calc names: ${formatList(invalidBaseSpecies)}`);
console.log(`Invalid exactSpecies calc names: ${formatList(invalidExactSpecies)}`);
console.log(`Invalid derivedSpecies calc names: ${formatList(invalidDerivedSpecies)}`);
console.log(`Duplicate ruleset names: ${formatList(duplicateRulesetNames.map(([name, count]) => `${name} x${count}`))}`);
console.log(`Duplicate official calc names: ${formatList(duplicateOfficialNames.map(([name, count]) => `${name} x${count}`))}`);
console.log('');
console.log(`Derived calculation-only species: ${formatList(derivedSpecies)}`);
console.log(`Auto Mega English names: ${formatList(autoMegaSpecies)}`);

if (
  missingFromRuleset.length > 0 ||
  extraInRuleset.length > 0 ||
  invalidBaseSpecies.length > 0 ||
  invalidExactSpecies.length > 0 ||
  invalidDerivedSpecies.length > 0 ||
  duplicateRulesetNames.length > 0
) {
  process.exitCode = 1;
}
