# Pokemon Champions Battle Calculator

Pokemon Champions 기준의 웹 기반 배틀 스탯 계산기입니다.

배포 주소: https://jin7369.github.io/pokemon-calculator/

포트폴리오 문서: `PORTFOLIO.md`

패치노트: `PATCH_NOTES.md`

## 주요 기능

- 샘플 비교 워크스페이스
  - 포켓몬, 성격, 6개 Stat Points, 특성, 지닌 도구, 공격 기술 4개를 하나의 샘플로 저장합니다.
  - 저장된 여러 상대 샘플을 벤치마크로 고정해 양방향 데미지, 생존 판정, 스피드 차이를 비교합니다.
  - 확정 KO, 확정 생존, 추월에 필요한 최소 Stat Points를 현재 배분 추가안과 전체 재분배안으로 제시합니다.
  - 활성 샘플은 공격, 수비, 스피드 계산기의 포켓몬·성격·Stat Points·특성·도구 기준값으로 공유됩니다.
  - 샘플 전환 전에 저장되지 않은 변경이 있으면 저장, 변경 취소, 돌아가기를 선택할 수 있습니다.

- 공통 포켓몬 빌드
  - 공격, 수비, 스피드 계산기는 하나의 선택 포켓몬, 성격, Stat Points를 공유합니다.
  - 각 탭에서 필요한 능력치만 조정해도 같은 66포인트 배분 안에서 함께 반영됩니다.

- 공격 계산기
  - 공격 포켓몬, 성격, Stat Points, 랭크, 공격 기술을 지정합니다.
  - 선택한 포켓몬이 배울 수 있는 공격 기술만 표시합니다.
  - 공격자 특성을 선택하고 ON/OFF로 계산 적용 여부를 바꿀 수 있습니다.
  - 화력 아이템, 직접 배율, 최종 배율을 반영합니다.
  - 다단히트 기술은 직접 히트 수 지정, 스킬링크, 속임수주사위 보정을 지원합니다.
  - Pokemon Champions 출전 가능 포켓몬 전체를 대상으로 생존/난수/확정 KO를 분류합니다.

- 수비 계산기
  - 피격 포켓몬의 HP/방어/특방 Stat Points와 성격을 지정합니다.
  - 방어 측에서 받을 기술을 선택하면, 그 기술을 배울 수 있는 공격자들을 기준으로 피해량을 계산합니다.
  - 공격자 공통 조건으로 성격, Stat Points, 랭크, 아이템, 직접 배율을 지정할 수 있습니다.

- 스피드 계산기
  - 내 포켓몬과 비교 대상들의 스피드 Stat Points, 성격, 랭크, 도구/효과, 직접 배율을 비교합니다.
  - 추월/동속/추월당함을 분류하고, 기본 정렬은 추월 여유가 낮은 순입니다.

- 선택 UI
  - 포켓몬과 기술 선택은 검색 가능한 커스텀 목록 UI를 사용합니다.
  - 포켓몬 목록에는 타입과 종족값을 함께 표시합니다.
  - 결과 표는 페이지 단위로 넘길 수 있습니다.

## 계산 기준

- 계산 엔진: `@smogon/calc`
- 데이터 기준: Gen 9, Lv.50
- 룰셋: Pokemon Champions regulation `r1780458vgoech`
- 공식 출전 가능 포켓몬 목록:
  - https://web-view.app.pokemonchampions.jp/battle/pages/regulations/r1780458vgoech/ko/pokemon.html
- Stat Points:
  - 총합 제한: 66
  - 능력치당 제한: 32
  - 표시 실수치: Pokemon Champions 공식 적용
  - 계산 엔진 환산: `0-31P = Stat Point × 8 EV`, `32P = 252 EV`

현재 명시적으로 설정하지 않는 조건은 계산에서 일반 조건으로 두고 있습니다. 방어 측 특성, 날씨, 필드, 벽, 크리티컬 등은 별도 UI가 생기기 전까지 범용 계산 조건으로 취급하지 않습니다.

## 데이터 관리

Pokemon Champions 룰셋은 `src/data/championsRulesets.ts`에서 관리합니다.

- `baseSpecies`: 공식 페이지에 기본 종으로 등재된 포켓몬
- `exactSpecies`: 공식 페이지와 매칭되는 별도 리전/폼
- `derivedSpecies`: 계산 편의를 위해 포함한 전투 폼
- `includeMegaForms`: 메가진화 폼 포함 여부

Pokemon Champions에서 포켓몬이 추가/삭제되면 우선 이 파일만 수정하도록 구조를 분리했습니다.

기술 습득 데이터와 공격 기술 목록은 아래 파일을 사용합니다.

- `src/data/championsAttackMoves.ts`
- `src/data/learnableAttackMoves.ts`

## 한글 이름 데이터

포켓몬/기술/특성 한글 이름은 PokeAPI에서 가져와 정적 TypeScript 파일로 저장합니다. 런타임에는 외부 API를 호출하지 않습니다.

```bash
npm run generate:korean-names
npm run generate:move-names
npm run generate:abilities
npm run generate:ability-names
npm run generate:learnable-moves
```

PokeAPI에 없는 이름은 override 파일로 보강합니다.

- 포켓몬 이름: `src/data/pokemonKoreanNames.ts`
- 기술 이름: `src/data/moveKoreanNames.ts`
- 특성 이름: `src/data/abilityKoreanNames.ts`
- 수동 보강: `src/data/moveNameOverrides.ts`

## 샘플 저장 범위

- 샘플 라이브러리, 활성 샘플 선택, 벤치마크 선택은 브라우저 `localStorage`에 버전과 함께 저장됩니다.
- 저장 데이터는 같은 브라우저·같은 프로필·같은 사이트 주소에서만 유지되며 기기나 브라우저 간에 동기화되지 않습니다.
- 시크릿 모드 종료, 브라우저 사이트 데이터 삭제, 저장 공간 정리 시 샘플이 삭제될 수 있습니다.
- 손상되거나 지원하지 않는 버전의 데이터는 검증 후 기본 샘플로 복구하며 화면에 경고를 표시합니다.
- 현재 기능 브랜치에는 파일 내보내기나 계정 기반 클라우드 백업이 포함되어 있지 않습니다.

## 로컬 실행

```bash
npm install
npm run dev
```

기본 로컬 주소는 `http://127.0.0.1:5173`입니다.

같은 네트워크의 모바일 기기에서 접속하려면 개발 서버를 외부 바인딩으로 실행합니다.

```bash
npm run dev -- --host 0.0.0.0
```

그 다음 PC의 내부 IP와 포트를 사용합니다.

```text
http://<PC-IP>:5173
```

## 검증

```bash
npm run lint
npm test
npm run build
```

Pokemon Champions 데이터 검증:

```bash
npm run verify:champions-roster
npm run verify:champions-moves
```

## 배포와 PWA

`main` 브랜치에 푸시하면 GitHub Actions가 정적 빌드를 만들고 GitHub Pages로 배포합니다.

배포 workflow:

- `.github/workflows/pages.yml`

PWA 관련 파일:

- `public/manifest.webmanifest`
- `public/service-worker.js`
- `public/app-icon-192.png`
- `public/app-icon-512.png`
- `src/registerServiceWorker.ts`

GitHub Pages 배포 주소는 HTTPS이므로 모바일 브라우저에서 홈 화면 추가/PWA 설치가 가능합니다.

`feature/next-implementation` 브랜치의 샘플 비교 기능은 검토용이며, 별도 승인 전까지 `main` 및 위 GitHub Pages 주소에는 배포하지 않습니다.

## 라이선스 고지

프로덕션 번들에 포함되는 런타임 의존성은 MIT/ISC 계열로 확인했습니다. 배포용 고지는 아래 파일에 정리합니다.

- `THIRD_PARTY_NOTICES.md`
- `public/third-party-notices.txt`

## 기술 스택

- React
- TypeScript
- Vite
- Vitest
- oxlint
- `@smogon/calc`
- `@pkmn/dex`
- `@pkmn/data`
