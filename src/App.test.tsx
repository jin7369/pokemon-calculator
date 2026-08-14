// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import App from './App';
import {
  SAMPLE_STORAGE_VERSION,
  createDefaultBattleSample,
  saveSampleLibrary,
  type BattleSample,
} from './domain/battleSamples';

function createVenusaurSample(): BattleSample {
  return {
    ...createDefaultBattleSample('venusaur'),
    name: '이상해꽃 내구 샘플',
    species: 'Venusaur',
    nature: 'Bold',
    ability: 'Overgrow',
    moves: ['Sludge Bomb'],
  };
}

beforeEach(() => {
  window.localStorage.clear();
});

afterEach(() => {
  cleanup();
  window.localStorage.clear();
});

describe('active battle sample integration', () => {
  it('shares the selected sample with attack, defense and speed calculators', () => {
    const charizard = createDefaultBattleSample('charizard');
    const venusaur = createVenusaurSample();
    saveSampleLibrary(window.localStorage, {
      version: SAMPLE_STORAGE_VERSION,
      samples: [charizard, venusaur],
      activeSampleId: charizard.id,
      benchmarkIds: [],
    });

    render(<App />);
    fireEvent.change(screen.getByLabelText('활성 샘플'), { target: { value: venusaur.id } });

    for (const tab of ['공격', '수비', '스피드']) {
      fireEvent.click(screen.getByRole('button', { name: tab }));
      const workspace = screen.getByLabelText(`${tab} 계산기`);
      expect(within(workspace).getAllByText('이상해꽃').length).toBeGreaterThan(0);
    }
  });

  it('protects an unsaved draft before creating another sample', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('샘플명'), { target: { value: '수정 중 샘플' } });
    fireEvent.click(screen.getByRole('button', { name: '새 샘플' }));

    const dialog = screen.getByRole('dialog', { name: '변경 사항을 저장할까요?' });
    expect(within(dialog).getByRole('button', { name: '저장 후 계속' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: '변경 취소' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: '돌아가기' })).toBeTruthy();

    fireEvent.click(within(dialog).getByRole('button', { name: '돌아가기' }));
    expect((screen.getByLabelText('샘플명') as HTMLInputElement).value).toBe('수정 중 샘플');
  });

  it('persists the current draft before continuing to a new sample', () => {
    render(<App />);

    fireEvent.change(screen.getByLabelText('샘플명'), { target: { value: '저장할 샘플' } });
    fireEvent.click(screen.getByRole('button', { name: '새 샘플' }));
    fireEvent.click(screen.getByRole('button', { name: '저장 후 계속' }));

    expect((screen.getByLabelText('샘플명') as HTMLInputElement).value).toBe('리자몽 기본');
    expect(screen.getByRole('option', { name: '저장할 샘플' })).toBeTruthy();
  });
});
