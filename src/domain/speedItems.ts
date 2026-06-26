export interface SpeedItemOption {
  id: string;
  label: string;
  multiplier: number;
}

export const NO_SPEED_ITEM_ID = 'none';

export const SPEED_ITEM_OPTIONS: SpeedItemOption[] = [
  { id: NO_SPEED_ITEM_ID, label: '없음', multiplier: 1 },
  { id: 'choice-scarf', label: '구애스카프', multiplier: 1.5 },
  { id: 'booster-energy-speed', label: '부스트에너지(스피드)', multiplier: 1.5 },
  { id: 'quick-powder', label: '스피드파우더', multiplier: 2 },
  { id: 'iron-ball', label: '검은철구', multiplier: 0.5 },
  { id: 'macho-brace-power-item', label: '교정깁스/파워계열', multiplier: 0.5 },
];

const speedItemById = new Map(SPEED_ITEM_OPTIONS.map((item) => [item.id, item]));

export function getSpeedItemOption(id: string | undefined): SpeedItemOption {
  return speedItemById.get(id ?? NO_SPEED_ITEM_ID) ?? SPEED_ITEM_OPTIONS[0];
}

export function speedItemMultiplier(itemId: string | undefined): number {
  return getSpeedItemOption(itemId).multiplier;
}
