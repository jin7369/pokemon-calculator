import { Generations } from '@smogon/calc';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const API = 'https://pokeapi.co/api/v2';
const GEN = Generations.get(9);
const OUTPUT = path.join(process.cwd(), 'src', 'data', 'pokemonKoreanNames.ts');
const LANGUAGE = 'ko';

const FORM_ALIASES = new Map([
  ['Necrozma-Dawn-Wings', { slug: 'necrozma-dawn' }],
  ['Necrozma-Dusk-Mane', { slug: 'necrozma-dusk' }],
  ['Pikachu-Alola', { slug: 'pikachu-alola-cap' }],
  ['Pikachu-Hoenn', { slug: 'pikachu-hoenn-cap' }],
  ['Pikachu-Kalos', { slug: 'pikachu-kalos-cap' }],
  ['Pikachu-Original', { slug: 'pikachu-original-cap' }],
  ['Pikachu-Partner', { slug: 'pikachu-partner-cap' }],
  ['Pikachu-Sinnoh', { slug: 'pikachu-sinnoh-cap' }],
  ['Pikachu-Unova', { slug: 'pikachu-unova-cap' }],
  ['Pikachu-World', { slug: 'pikachu-world-cap' }],
  ['Maushold-Four', { slug: 'maushold-family-of-four' }],
  ['Darmanitan-Galar', { slug: 'darmanitan-galar-standard' }],
  ['Minior-Meteor', { slug: 'minior-red-meteor' }],
  ['Rockruff-Dusk', { slug: 'rockruff-own-tempo' }],
  ['Mimikyu-Totem', { slug: 'mimikyu-totem-disguised' }],
  ['Mimikyu-Busted-Totem', { slug: 'mimikyu-totem-busted' }],
  ['Marowak-Alola-Totem', { slug: 'marowak-totem' }],
  ['Raticate-Alola-Totem', { slug: 'raticate-totem-alola' }],
  ['Vivillon-Pokeball', { slug: 'vivillon-poke-ball' }],
  ['Toxtricity-Gmax', { slug: 'toxtricity-amped-gmax' }],
  ['Urshifu-Gmax', { slug: 'urshifu-single-strike-gmax' }],
  ['Urshifu-Rapid-Strike-Gmax', { slug: 'urshifu-rapid-strike-gmax' }],
  ['Ogerpon-Wellspring', { slug: 'ogerpon-wellspring-mask' }],
  ['Ogerpon-Hearthflame', { slug: 'ogerpon-hearthflame-mask' }],
  ['Ogerpon-Cornerstone', { slug: 'ogerpon-cornerstone-mask' }],
  ['Ogerpon-Teal-Tera', { slug: 'ogerpon', suffix: '테라' }],
  ['Ogerpon-Wellspring-Tera', { slug: 'ogerpon-wellspring-mask', suffix: '테라' }],
  ['Ogerpon-Hearthflame-Tera', { slug: 'ogerpon-hearthflame-mask', suffix: '테라' }],
  ['Ogerpon-Cornerstone-Tera', { slug: 'ogerpon-cornerstone-mask', suffix: '테라' }],
]);

function normalizeKey(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/[^a-z0-9]/g, '');
}

function simpleSlug(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[:.%]/g, '')
    .replace(/♀/g, 'f')
    .replace(/♂/g, 'm')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function koName(entries = []) {
  return entries.find((entry) => entry.language?.name === LANGUAGE)?.name ?? null;
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Request failed ${response.status}: ${url}`);
  }
  return response.json();
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let cursor = 0;

  async function worker() {
    while (cursor < items.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(items[index], index);
    }
  }

  await Promise.all(Array.from({ length: limit }, worker));
  return results;
}

function buildResourceIndex(resources) {
  const exact = new Map();
  const normalized = new Map();

  for (const resource of resources) {
    exact.set(resource.name, resource);
    normalized.set(normalizeKey(resource.name), resource);
  }

  return { exact, normalized };
}

function pickResource(name, formIndex, speciesIndex) {
  const alias = FORM_ALIASES.get(name);
  if (alias) {
    return {
      resource: formIndex.exact.get(alias.slug),
      kind: 'form',
      suffix: alias.suffix,
    };
  }

  const slug = simpleSlug(name);
  const normalized = normalizeKey(name);
  const exactForm = formIndex.exact.get(slug);
  if (exactForm) return { resource: exactForm, kind: 'form' };

  const exactSpecies = speciesIndex.exact.get(slug);
  if (exactSpecies) return { resource: exactSpecies, kind: 'species' };

  const normalizedForm = formIndex.normalized.get(normalized);
  if (normalizedForm) return { resource: normalizedForm, kind: 'form' };

  const normalizedSpecies = speciesIndex.normalized.get(normalized);
  if (normalizedSpecies) return { resource: normalizedSpecies, kind: 'species' };

  return { resource: null, kind: null };
}

function combineKoreanName(speciesName, formName, suffix) {
  let display = speciesName;

  if (formName) {
    display = formName.includes(speciesName) ? formName : `${speciesName} (${formName})`;
  }

  return suffix ? `${display} ${suffix}` : display;
}

async function main() {
  const [formList, speciesList] = await Promise.all([
    fetchJson(`${API}/pokemon-form?limit=3000`),
    fetchJson(`${API}/pokemon-species?limit=2000`),
  ]);
  const formIndex = buildResourceIndex(formList.results);
  const speciesIndex = buildResourceIndex(speciesList.results);
  const speciesCache = new Map();
  const formCache = new Map();
  const pokemonCache = new Map();
  const smogonSpecies = Array.from(GEN.species).map((species) => species.name).sort((a, b) => a.localeCompare(b, 'en'));

  const entries = await mapLimit(smogonSpecies, 16, async (name) => {
    const picked = pickResource(name, formIndex, speciesIndex);
    if (!picked.resource) return [name, name];

    if (picked.kind === 'species') {
      const species = speciesCache.get(picked.resource.url) ?? await fetchJson(picked.resource.url);
      speciesCache.set(picked.resource.url, species);
      return [name, koName(species.names) ?? name];
    }

    const form = formCache.get(picked.resource.url) ?? await fetchJson(picked.resource.url);
    formCache.set(picked.resource.url, form);
    const pokemonUrl = form.pokemon?.url;
    if (!pokemonUrl) return [name, name];

    const pokemon = pokemonCache.get(pokemonUrl) ?? await fetchJson(pokemonUrl);
    pokemonCache.set(pokemonUrl, pokemon);
    const speciesUrl = pokemon.species?.url;
    if (!speciesUrl) return [name, name];

    const species = speciesCache.get(speciesUrl) ?? await fetchJson(speciesUrl);
    speciesCache.set(speciesUrl, species);

    const speciesName = koName(species.names) ?? name;
    const formName = koName(form.form_names) ?? koName(form.names);
    return [name, combineKoreanName(speciesName, formName, picked.suffix)];
  });

  const mapping = Object.fromEntries(entries);
  const unmappedCount = Object.entries(mapping).filter(([name, korean]) => name === korean).length;
  const content = `// Generated by scripts/generateKoreanPokemonNames.mjs.\n// PokeAPI does not include CAP/fan-made species, so those fall back to English.\n\nexport const POKEMON_KOREAN_NAMES = ${JSON.stringify(mapping, null, 2)} as const;\n`;

  await mkdir(path.dirname(OUTPUT), { recursive: true });
  await writeFile(OUTPUT, content, 'utf8');
  console.log(`Wrote ${OUTPUT}`);
  console.log(`Mapped ${entries.length - unmappedCount}/${entries.length}; fallback ${unmappedCount}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

