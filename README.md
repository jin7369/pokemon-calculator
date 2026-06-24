# Pokemon Champions Battle Calculator

포켓몬 챔피언스 기준의 웹 기반 배틀 스탯 계산기입니다. 현재 v1은 공격 계산기를 구현하며, 수비 계산과 스피드 계산은 탭과 준비 상태만 제공합니다.

## 실행

```bash
npm install
npm run dev
```

로컬 주소는 기본적으로 `http://127.0.0.1:5173`입니다.

## v1 범위

- 룰 기본값: 싱글 배틀, Lv50, Gen9 전체 포켓몬/폼 대상
- 계산 엔진: `@smogon/calc`
- Stat Points: 총합 66, 능력치당 31, 계산식은 `1 Stat Point = 8 EV` 환산
- 포함 보정: 성격, Stat Points, 기술 타입/STAB/상성, 공격/특공 랭크, 직접 배율
- 제외 보정: 아이템, 특성, 날씨, 필드, 벽, 크리티컬, 레귤레이션별 출전 제한

## 검증

```bash
npm test
npm run lint
npm run build
```

## 한글 이름 갱신

포켓몬/기술 한글 이름은 PokeAPI에서 가져와 정적 파일로 저장합니다. 런타임에는 외부 API를 호출하지 않습니다.

```bash
npm run generate:korean-names
npm run generate:move-names
```

PokeAPI에 없는 CAP/비공식 포켓몬은 영문명으로 표시됩니다. PokeAPI가 제공하지 않는 일부 기술은 웹에서 확인한 이름을 `src/data/moveNameOverrides.ts`에 수동 보강합니다. 아직 확인되지 않은 기술은 `UNMAPPED_MOVE_NAMES`에 남기고 영문명으로 표시합니다.
