# CLAUDE.md

Claude Code 가이드 파일입니다.

## JD 요구사항 (✅ 전체 완료)

1. ✅ 페르소나/환경/대화 히스토리/기억 통합
2. ✅ 장단기 기억 저장 및 색인/추출 알고리즘 (Memory Stream + Retrieval)
3. ✅ 심리/감정/의도 추론 기반 NPC 자율 발화
4. ✅ Planning 시스템 (수면/기상 → 하루 계획 → 시간별 활동)
5. ✅ Reflection 시스템 (대화 10회마다 인사이트 생성)

## 프로젝트 개요

Stanford Generative Agents 논문(2023) 기반 RPG NPC 에이전트. Gemini API로 각 NPC가 고유한 페르소나, 감정, 기억 시스템을 가지고 대화한다.

## 기술 스택

- **언어**: TypeScript
- **빌드**: Vite
- **AI**: Google Gemini API
- **저장소**: localStorage

## 빌드 및 실행

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # 프로덕션 빌드
```

## 파일 구조

```
src/
├── client/
│   ├── agent.ts           # NPCAgent (대화, 감정, 리플렉션, Planning)
│   ├── memory.ts          # MemoryStore (localStorage)
│   ├── gemini.ts          # Gemini API 클라이언트
│   ├── game/
│   │   ├── world.ts       # GameWorld (타일맵, 시야)
│   │   ├── npc-controller.ts  # NpcController (계획→이동 연동)
│   │   └── time.ts        # GameTime (게임 내 시간)
│   ├── player/
│   │   └── hero_smage.ts  # 플레이어 정의
│   └── npcs/
│       ├── blacksmith_john.ts  # 대장장이 존
│       ├── innkeeper_rosa.ts   # 여관주인 로사
│       └── types.ts       # NpcDefinition 타입
└── web/
    └── app.ts             # UI 컨트롤러 + 게임 루프
```

## 핵심 개념

### NPC 정의

NPC는 `src/client/npcs/{직업}_{이름}.ts`에 정의:
- **Persona**: 정적 정체성 (이름, 성격, 배경, 말투)
- **Scratch**: 동적 상태 (위치, 활동, 기분)
- **Knowledge**: 세계 지식 (장소, 가능한 활동)
- **Locations**: 장소명 → 좌표 매핑
- **WorldSetup**: 벽, 오브젝트, 스폰 위치

### 기억 타입

| 타입 | 설명 |
|------|------|
| `observation` | 관찰/대화 기록 |
| `reflection` | 성찰/통찰 |
| `plan` | 계획 |
| `knowledge` | 세계 지식 |
| `thought` | 속마음/내면 판단 |

### 검색 점수

```
score = recency + importance + relevance
- recency: 0.995^(경과시간)
- importance: 1-10
- relevance: 키워드 매칭
```

## 주요 흐름

```
[대화]
사용자 입력 → 기억 검색 → 프롬프트 구성 → LLM → 감정 파싱 → 기억 저장 → 리플렉션 체크

[Planning]
기상(06:00) → 하루 계획 생성 → 시간별 활동 변경 → 취침(22:00)

[자율 발화]
플레이어 시야 진입 → shouldInitiateConversation() → generateSpontaneousUtterance()
```

## 미구현 기능

- [ ] 이벤트/트리거 시스템
- [ ] 영구 백엔드 저장소
- [ ] Phaser.js 게임 통합
- [ ] 임베딩 기반 relevance 검색

## 주의사항

- 브라우저 데이터 삭제 시 기억 소실
- API 키는 웹 모달로 입력 → localStorage 저장
- **UI 수정 룰**: `.claude/rules/ui-modification.md` 참조
