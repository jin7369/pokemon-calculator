import fs from 'node:fs';
import { Generations } from '@smogon/calc';
import { CHAMPIONS_MOVE_OVERRIDES } from './championsMoveOverrides.mjs';

const OFFICIAL_MOVES_URL =
  'https://web-view.app.pokemonchampions.jp/battle/pages/regulations/r1780458vgoech/ko/waza.html';
const ATTACK_MOVES_PATH = 'src/data/championsAttackMoves.ts';
const LEARNABLE_MOVES_PATH = 'src/data/learnableAttackMoves.ts';

function parseGeneratedObject(source, exportName) {
  const startMarker = `export const ${exportName} = `;
  const start = source.indexOf(startMarker);
  if (start === -1) {
    throw new Error(`Could not find ${exportName}`);
  }

  const objectStart = start + startMarker.length;
  const objectEnd = source.indexOf(' as const;', objectStart);
  if (objectEnd === -1) {
    throw new Error(`Could not find ${exportName} terminator`);
  }

  return Function(`return ${source.slice(objectStart, objectEnd)}`)();
}

function stripHtml(value) {
  return value
    .replace(/<script[\s\S]*?<\/script>/g, '')
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function extractBlockText(html, id) {
  const match = html.match(new RegExp(`<div id="${id}"[^>]*>([\\s\\S]*?)</div>`));
  return match ? stripHtml(match[1]) : '';
}

async function fetchOfficialMoveBlocks() {
  const response = await fetch(OFFICIAL_MOVES_URL);
  if (!response.ok) {
    throw new Error(`Failed to fetch official moves page: ${response.status}`);
  }

  const html = await response.text();
  return {
    eligibleText: extractBlockText(html, 'can'),
    bannedText: extractBlockText(html, 'cannot'),
  };
}

const attackMoveIds = parseGeneratedObject(
  fs.readFileSync(ATTACK_MOVES_PATH, 'utf8'),
  'CHAMPIONS_ATTACK_MOVE_IDS',
);
const learnableMoves = parseGeneratedObject(
  fs.readFileSync(LEARNABLE_MOVES_PATH, 'utf8'),
  'LEARNABLE_ATTACK_MOVE_IDS_BY_SPECIES',
);
const attackMoveIdSet = new Set(attackMoveIds);
const calcAttackMoveIds = new Set(
  Array.from(Generations.get(9).moves)
    .filter((move) => (move.category === 'Physical' || move.category === 'Special') && (move.basePower ?? 0) > 0)
    .map((move) => move.id),
);
const globalRemovedMoveIds = new Set(CHAMPIONS_MOVE_OVERRIDES.globalRemovedMoveIds ?? []);
const invalidAttackMoveIds = attackMoveIds.filter((moveId) => !calcAttackMoveIds.has(moveId));
const invalidLearnsetEntries = [];
const bannedLearnsetEntries = [];
const emptySpecies = [];

for (const [species, moveIds] of Object.entries(learnableMoves)) {
  if (moveIds.length === 0) {
    emptySpecies.push(species);
  }

  for (const moveId of moveIds) {
    if (!attackMoveIdSet.has(moveId)) {
      invalidLearnsetEntries.push(`${species}:${moveId}`);
    }

    if (globalRemovedMoveIds.has(moveId)) {
      bannedLearnsetEntries.push(`${species}:${moveId}`);
    }
  }
}

const officialBlocks = await fetchOfficialMoveBlocks();

console.log('Pokemon Champions move verification');
console.log('');
console.log(`Official moves URL: ${OFFICIAL_MOVES_URL}`);
console.log(`Official eligible block text: ${officialBlocks.eligibleText || 'empty'}`);
console.log(`Official banned block text: ${officialBlocks.bannedText || 'empty'}`);
console.log(`Generated damaging move options: ${attackMoveIds.length}`);
console.log(`Generated species learnsets: ${Object.keys(learnableMoves).length}`);
console.log(`Species without damaging moves: ${emptySpecies.length > 0 ? emptySpecies.join(', ') : 'none'}`);
console.log(`Invalid generated move IDs: ${invalidAttackMoveIds.length > 0 ? invalidAttackMoveIds.join(', ') : 'none'}`);
console.log(`Learnset entries outside generated move options: ${invalidLearnsetEntries.length > 0 ? invalidLearnsetEntries.join(', ') : 'none'}`);
console.log(`Learnset entries using globally removed moves: ${bannedLearnsetEntries.length > 0 ? bannedLearnsetEntries.join(', ') : 'none'}`);

if (
  officialBlocks.eligibleText ||
  officialBlocks.bannedText ||
  invalidAttackMoveIds.length > 0 ||
  invalidLearnsetEntries.length > 0 ||
  bannedLearnsetEntries.length > 0
) {
  process.exitCode = 1;
}
