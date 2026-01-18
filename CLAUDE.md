# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 개발 의사결정 원칙

**중요**: 새 기능 개발이나 설계 결정 시 반드시 `reference-docs/jd-requirements.md`를 참고하여 JD 요구사항 충족 여부를 확인할 것.

### JD 핵심 요구사항 체크리스트
1. 페르소나/환경/대화 히스토리/기억 통합 → ✅ 구현됨
2. 장단기 기억 저장 및 색인/추출 알고리즘 → ✅ Memory Stream + Retrieval
3. 심리/감정/의도 추론 기반 NPC 자율 발화 → ✅ 구현됨 (shouldInitiateConversation + generateSpontaneousUtterance)
4. Planning 시스템 → ✅ 구현됨 (wakeUp/sleep, generateDailyPlan, updatePlanProgress)

### 우선순위 (JD 기준)
1. ~~**Planning 시스템**: 수면/기상 → 하루 계획 생성 → 시간별 activity 변경~~ ✅ 완료
2. ~~**자율 발화**: NPC가 플레이어를 인식하고 먼저 말 걸기~~ ✅ 완료
3. **중요도 합계 기반 Reflection**: 현재 "대화 10개"가 아닌 "중요도 합 > 150"으로 변경

## 프로젝트 개요

Stanford Generative Agents 논문(2023) 기반의 RPG/판타지 세계관 NPC 에이전트 시스템. Google Gemini API를 활용하여 각 NPC가 고유한 페르소나, 감정 상태, 기억 시스템을 가지고 대화한다.

## 기술 스택

- **언어**: TypeScript
- **빌드 도구**: Vite
- **AI**: Google Gemini API (`@google/generative-ai`)
- **저장소**: localStorage (브라우저)

## 빌드 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행 (http://localhost:3000)
npm run dev

# 프로덕션 빌드
npm run build

# 빌드 미리보기
npm run preview

# CLI 테스트 실행
npx tsx src/main.ts
```

## 아키텍처

```
src/
├── client/                 # 브라우저용 구현 (메인)
│   ├── agent.ts           # NPC 에이전트 (대화, 감정, 리플렉션, Planning, 자율발화)
│   ├── memory.ts          # localStorage 기반 기억 저장소
│   ├── gemini.ts          # Gemini API 클라이언트 (브라우저)
│   ├── game/              # 게임 월드 시스템
│   │   ├── npc-controller.ts  # NPC 행동 제어 (이동, 인지, 대화 상태)
│   │   └── world.ts       # 타일맵 월드, 시야 시스템
│   └── npcs/
│       ├── types.ts       # NPC 타입 정의 (Persona, Scratch, NpcState)
│       ├── blacksmith_john.ts  # 대장장이 존 NPC 정의
│       └── innkeeper_rosa.ts   # 여관주인 로사 NPC 정의
├── lib/                    # 서버용 구현 (대안)
│   ├── npc/
│   │   ├── agent.ts       # 서버 사이드 NPC 에이전트
│   │   └── types.ts       # NPC 타입 정의
│   └── memory/
│       ├── store.ts       # JSONL 파일 기반 기억 저장소
│       └── types.ts       # 기억 타입 정의
├── api/
│   └── gemini.ts          # Gemini API 클라이언트 (서버)
├── web/
│   └── app.ts             # UI 컨트롤러, NPC 관리
├── main.ts                # CLI 인터페이스
└── server.ts              # HTTP API 서버
```

## 핵심 개념

### NPC 정의 (TypeScript)

NPC는 `src/client/npcs/{직업}_{이름}.ts` 형식으로 저장.

**Persona** (고정된 정체성):
```typescript
export const blacksmithPersona: Persona = {
  id: 'blacksmith_john',
  name: '대장장이 존',
  age: 45,
  occupation: '대장장이',
  traits: ['성실함', '과묵함', '장인정신'],
  backstory: '20년간 마을의 무기를 만들어온 베테랑 대장장이',
  currentGoals: ['철광석 수급처 찾기'],
  speechStyle: '짧고 직설적인 문장'
};
```

**Scratch** (동적 상태):
```typescript
export const blacksmithScratch: Scratch = {
  currentLocation: '대장간 내부',
  currentActivity: '검 손잡이를 다듬는 중',
  currentMood: 'neutral',
  currentTime: '14:30'
};
```

### 감정 상태

NPC는 대화에 따라 감정 상태가 자동 변화: `happy`, `neutral`, `sad`, `angry`, `fearful`, `excited`, `curious`

### 기억 시스템

**기억 타입**:
- `observation`: 관찰/대화 기록
- `reflection`: 성찰/통찰
- `plan`: 계획
- `knowledge`: 세계 지식 (장소, 다른 NPC 정보 등)
- `thought`: 속마음/내면 판단 (혼잣말, 대화 지속 여부 판단 등)

**검색 점수 계산**:
```
score = recency + importance + relevance
- recency: 0.995^(경과 시간) - 최근 접근 기억 우선
- importance: 1-10 정규화 점수
- relevance: 키워드 매칭 비율
```

### 리플렉션 시스템

10회 대화마다 자동으로 리플렉션 트리거:
1. 최근 기억들의 중요도 재평가 (LLM)
2. 고중요도 기억에서 통찰 생성
3. 리플렉션 기억으로 저장 (importance: 8)

## 환경 변수

```env
VITE_GEMINI_API_KEY=your_api_key_here
VITE_GEMINI_MODEL=gemini-2.0-flash-001
```

**참고**: API 키는 브라우저에서 최초 접속 시 모달로 입력받아 localStorage에 저장됨.

## 대화 흐름

```
사용자 입력
    ↓
[검색] 관련 기억 검색 (상위 5개)
    ↓
[프롬프트 구성] Persona + Scratch + 기억 + 대화 이력
    ↓
[LLM 생성] Gemini API → JSON 응답
    ↓
[감정 처리] 감정 변화 감지 및 업데이트
    ↓
[기억 저장] 사용자 발화 + NPC 응답 저장
    ↓
[리플렉션 체크] 10회 대화 시 자동 성찰
    ↓
[UI 업데이트] 응답 표시 + 상태 패널 갱신
```

## 미구현 기능

- [x] ~~다중 NPC 지원~~ → 구현됨 (blacksmith_john, innkeeper_rosa)
- [x] ~~NPC 간 대화~~ → 구현됨 (시야 내 NPC 인식 → 자발적 대화)
- [ ] 이벤트/트리거 시스템
- [ ] 영구 백엔드 저장소
- [ ] Phaser.js 게임 통합
- [ ] 임베딩 기반 relevance 검색 (현재 키워드 매칭)

## 주의사항

- 브라우저 데이터 삭제 시 기억 소실됨
- API 키는 localStorage에 저장되므로 공유 환경에서 주의
- 감정 상태 변화는 LLM 응답의 JSON 파싱으로 자동 처리
- **UI/디자인 수정 룰**: `.claude/rules/ui-modification.md` 참조
