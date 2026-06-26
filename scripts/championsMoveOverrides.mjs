// Pokemon Champions move-learnset differences that are not represented in @pkmn/data yet.
// Keep move IDs lowercase and punctuation-free, matching @pkmn/dex/@smogon/calc IDs.
//
// Official regulation r1780458vgoech currently exposes global move eligibility pages,
// but not per-Pokemon learnset deltas. Add confirmed Champions-specific changes here.
export const CHAMPIONS_MOVE_OVERRIDES = {
  globalAddedMoveIds: [],
  globalRemovedMoveIds: [],
  species: {
    // Example:
    // Charizard: {
    //   addedMoveIds: ['examplemove'],
    //   removedMoveIds: ['hiddenpower'],
    // },
  },
};
