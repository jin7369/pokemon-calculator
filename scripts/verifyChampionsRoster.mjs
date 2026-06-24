import fs from 'node:fs';
import { Generations } from '@smogon/calc';

const RULESET_PATH = 'src/data/championsRulesets.ts';

const SOURCE_ROSTER_NAMES = [
  'Venusaur',
  'Charizard',
  'Blastoise',
  'Beedrill',
  'Pikachu',
  'Raichu',
  'Raichu',
  'Clefable',
  'Ninetales',
  'Ninetales',
  'Arcanine',
  'Arcanine',
  'Alakazam',
  'Victreebel',
  'Slowbro',
  'Slowbro',
  'Gengar',
  'Kangaskhan',
  'Starmie',
  'Pinsir',
  'Tauros',
  'Gyarados',
  'Ditto',
  'Vaporeon',
  'Jolteon',
  'Flareon',
  'Aerodactyl',
  'Snorlax',
  'Dragonite',
  'Meganium',
  'Typhlosion',
  'Feraligatr',
  'Ampharos',
  'Azumarill',
  'Politoed',
  'Espeon',
  'Umbreon',
  'Slowking',
  'Steelix',
  'Scizor',
  'Heracross',
  'Skarmory',
  'Houndoom',
  'Tyranitar',
  'Pelipper',
  'Gardevoir',
  'Sableye',
  'Aggron',
  'Torkoal',
  'Altaria',
  'Milotic',
  'Castform',
  'Absol',
  'Metagross',
  'Torterra',
  'Infernape',
  'Empoleon',
  'Lopunny',
  'Spiritomb',
  'Garchomp',
  'Lucario',
  'Hippowdon',
  'Abomasnow',
  'Weavile',
  'Rhyperior',
  'Leafeon',
  'Glaceon',
  'Gliscor',
  'Mamoswine',
  'Gallade',
  'Froslass',
  'Rotom',
  'Serperior',
  'Emboar',
  'Samurott',
  'Excadrill',
  'Audino',
  'Conkeldurr',
  'Whimsicott',
  'Krookodile',
  'Garbodor',
  'Zoroark',
  'Vanilluxe',
  'Emolga',
  'Chandelure',
  'Stunfisk',
  'Golurk',
  'Hydreigon',
  'Volcarona',
  'Chesnaught',
  'Delphox',
  'Greninja',
  'Diggersby',
  'Talonflame',
  'Vivillon',
  'Floette',
  'Furfrou',
  'Meowstic',
  'Aegislash',
  'Clawitzer',
  'Tyrantrum',
  'Aurorus',
  'Sylveon',
  'Hawlucha',
  'Goodra',
  'Klefki',
  'Trevenant',
  'Gourgeist',
  'Noivern',
  'Decidueye',
  'Decidueye',
  'Incineroar',
  'Primarina',
  'Toucannon',
  'Crabominable',
  'Lycanroc',
  'Toxapex',
  'Mudsdale',
  'Araquanid',
  'Tsareena',
  'Oranguru',
  'Mimikyu',
  'Drampa',
  'Kommo-o',
  'Corviknight',
  'Appletun',
  'Sandaconda',
  'Polteageist',
  'Hatterene',
  'Grimmsnarl',
  'Mr. Rime',
  'Runerigus',
  'Alcremie',
  'Morpeko',
  'Dragapult',
  'Kleavor',
  'Ursaluna',
  'Basculegion',
  'Sneasler',
  'Meowscarada',
  'Skeledirge',
  'Quaquaval',
  'Pawmot',
  'Maushold',
  'Garganacl',
  'Armarouge',
  'Ceruledge',
  'Scovillain',
  'Tinkaton',
  'Palafin',
  'Orthworm',
  'Glimmora',
  'Dondozo',
  'Tatsugiri',
  'Farigiraf',
  'Kingambit',
  'Sinistcha',
  'Archaludon',
  'Hydrapple',
];

const KNOWN_SOURCE_NORMALIZATIONS = [
  'GoodraKlefki -> Goodra + Klefki',
  'Mr.Rime -> Mr. Rime',
  'Aegislash -> Aegislash-Blade + Aegislash-Shield in @smogon/calc',
];

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

function sourceBaseNameFor(species) {
  if (species.name.startsWith('Aegislash-')) return 'Aegislash';
  if (species.baseSpecies?.startsWith('Aegislash-')) return 'Aegislash';
  return species.baseSpecies ?? species.name;
}

function formatList(values) {
  return values.length > 0 ? values.join(', ') : 'none';
}

const rulesetSource = fs.readFileSync(RULESET_PATH, 'utf8');
const baseSpecies = extractStringArray(rulesetSource, 'baseSpecies');
const exactSpecies = extractStringArray(rulesetSource, 'exactSpecies');
const sourceRoster = uniqueSorted(SOURCE_ROSTER_NAMES);
const rulesetComparableRoster = uniqueSorted([
  ...baseSpecies,
  ...(exactSpecies.includes('Aegislash-Blade') && exactSpecies.includes('Aegislash-Shield') ? ['Aegislash'] : []),
]);

const genSpecies = Array.from(Generations.get(9).species);
const speciesByName = new Map(genSpecies.map((species) => [species.name, species]));
const calcSpeciesNames = new Set(genSpecies.map((species) => species.name));
const calcBaseNames = new Set(genSpecies.map((species) => species.baseSpecies ?? species.name));
const allowedBaseSpecies = new Set(baseSpecies);
const allowedExactSpecies = new Set([...baseSpecies, ...exactSpecies]);
const allowedSpecies = genSpecies.filter((species) => {
  const baseName = species.baseSpecies ?? species.name;
  return allowedExactSpecies.has(species.name) || (species.name.includes('-Mega') && allowedBaseSpecies.has(baseName));
});
const autoMegaSpecies = allowedSpecies
  .filter((species) => species.name.includes('-Mega'))
  .map((species) => species.name)
  .sort((left, right) => left.localeCompare(right, 'en'));
const exactFormSourceBases = uniqueSorted(
  exactSpecies
    .map((name) => speciesByName.get(name))
    .filter(Boolean)
    .map(sourceBaseNameFor),
);

const invalidBaseSpecies = baseSpecies.filter((name) => !calcSpeciesNames.has(name) && !calcBaseNames.has(name));
const invalidExactSpecies = exactSpecies.filter((name) => !calcSpeciesNames.has(name));
const duplicateRulesetNames = countDuplicates([...baseSpecies, ...exactSpecies]);
const sourceDuplicates = countDuplicates(SOURCE_ROSTER_NAMES);
const missingFromRuleset = difference(sourceRoster, rulesetComparableRoster);
const extraInRuleset = difference(rulesetComparableRoster, sourceRoster);
const exactFormsWithoutSourceBase = difference(exactFormSourceBases, sourceRoster);

console.log('Pokemon Champions roster verification');
console.log('');
console.log(`Source unique English names: ${sourceRoster.length}`);
console.log(`Ruleset comparable English names: ${rulesetComparableRoster.length}`);
console.log(`Ruleset baseSpecies entries: ${baseSpecies.length}`);
console.log(`Ruleset exactSpecies entries: ${exactSpecies.length}`);
console.log(`Final selectable calc species: ${allowedSpecies.length}`);
console.log(`Auto-included Mega species: ${autoMegaSpecies.length}`);
console.log('');
console.log(`Missing from ruleset vs source: ${formatList(missingFromRuleset)}`);
console.log(`Extra in ruleset vs source: ${formatList(extraInRuleset)}`);
console.log(`Invalid baseSpecies calc names: ${formatList(invalidBaseSpecies)}`);
console.log(`Invalid exactSpecies calc names: ${formatList(invalidExactSpecies)}`);
console.log(`Duplicate ruleset names: ${formatList(duplicateRulesetNames.map(([name, count]) => `${name} x${count}`))}`);
console.log(`Duplicate source rows: ${formatList(sourceDuplicates.map(([name, count]) => `${name} x${count}`))}`);
console.log(`Exact form source bases not present in source: ${formatList(exactFormsWithoutSourceBase)}`);
console.log('');
console.log('Known English-name normalizations:');
for (const normalization of KNOWN_SOURCE_NORMALIZATIONS) {
  console.log(`- ${normalization}`);
}
console.log('');
console.log(`Auto Mega English names: ${formatList(autoMegaSpecies)}`);

if (
  missingFromRuleset.length > 0 ||
  extraInRuleset.length > 0 ||
  invalidBaseSpecies.length > 0 ||
  invalidExactSpecies.length > 0 ||
  duplicateRulesetNames.length > 0 ||
  exactFormsWithoutSourceBase.length > 0
) {
  process.exitCode = 1;
}
