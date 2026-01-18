# Project Architecture - AI NPC Fantasy Village

## 프로젝트 설정

- **세계관**: 판타지 마을
- **NPC**: 대장장이, 초보 모험가
- **플레이어**: 베테랑 모험가
- **기술 스택**: Phaser.js + TypeScript + Gemini API

---

## 파일 구조

```
src/
├── main.ts                     # 엔트리 포인트
├── vite-env.d.ts               # Vite 타입 정의
│
├── api/
│   └── gemini.ts               # Gemini API 클라이언트 (완료)
│
├── core/                       # 핵심 시스템
│   ├── Agent.ts                # 에이전트 기본 클래스
│   ├── Memory.ts               # 메모리 스트림 시스템
│   ├── Retrieval.ts            # 메모리 검색 (Recency × Importance × Relevance)
│   └── Dialogue.ts             # 대화 시스템
│
├── entities/                   # 게임 엔티티
│   ├── NPC.ts                  # NPC 클래스 (Agent 확장)
│   ├── Player.ts               # 플레이어 클래스
│   └── characters/             # 캐릭터 정의
│       ├── Blacksmith.ts       # 대장장이 페르소나
│       └── RookieAdventurer.ts # 초보 모험가 페르소나
│
├── data/                       # 정적 데이터
│   ├── personas/               # 캐릭터 페르소나 JSON
│   │   ├── blacksmith.json
│   │   └── rookie-adventurer.json
│   └── world/                  # 월드 데이터
│       └── village.json
│
├── systems/                    # 게임 시스템
│   ├── InteractionSystem.ts    # 상호작용 관리
│   ├── TimeSystem.ts           # 게임 시간 관리
│   └── ObservationSystem.ts    # 관찰/인지 시스템
│
├── ui/                         # UI 컴포넌트
│   ├── DialogueBox.ts          # 대화창
│   ├── EmotionIndicator.ts     # 감정 표시
│   └── MemoryDebugPanel.ts     # 디버그용 메모리 패널
│
└── game/                       # Phaser 게임
    ├── Game.ts                 # Phaser 게임 설정
    ├── scenes/
    │   ├── BootScene.ts        # 로딩
    │   ├── VillageScene.ts     # 마을 메인 씬
    │   └── UIScene.ts          # UI 오버레이
    └── sprites/
        └── CharacterSprite.ts  # 캐릭터 스프라이트
```

---

## 핵심 데이터 구조

### 1. Agent (에이전트)

```typescript
interface Agent {
  id: string;
  name: string;
  persona: Persona;
  memories: MemoryStream;
  currentEmotion: Emotion;
  currentActivity: string;
  location: Location;
  relationships: Map<string, Relationship>;
}
```

### 2. Persona (페르소나)

```typescript
interface Persona {
  name: string;
  age: number;
  occupation: string;
  personality: string[];        // ["무뚝뚝한", "장인정신", "과묵한"]
  background: string;           // 배경 스토리
  speechStyle: string;          // 말투 설명
  goals: string[];              // 목표/동기
  quirks: string[];             // 특이한 버릇
  likes: string[];
  dislikes: string[];
}
```

### 3. Emotion (감정)

```typescript
interface Emotion {
  primary: EmotionType;         // 'happy' | 'sad' | 'angry' | 'fearful' | 'neutral' | ...
  intensity: number;            // 0-10
  cause?: string;               // 감정 원인
}

type EmotionType =
  | 'happy' | 'sad' | 'angry' | 'fearful'
  | 'surprised' | 'disgusted' | 'neutral'
  | 'curious' | 'proud' | 'embarrassed';
```

### 4. Memory (메모리)

```typescript
interface Memory {
  id: string;
  type: 'observation' | 'reflection' | 'plan' | 'dialogue';
  content: string;              // 자연어 설명
  timestamp: number;            // 생성 시간
  lastAccessed: number;         // 마지막 접근 시간
  importance: number;           // 1-10 (LLM 평가)
  embedding?: number[];         // 임베딩 벡터 (나중에)
  linkedMemories?: string[];    // 연결된 메모리 ID (Reflection용)
  participants?: string[];      // 관련 에이전트 ID
}
```

### 5. Relationship (관계)

```typescript
interface Relationship {
  targetId: string;
  targetName: string;
  familiarity: number;          // 0-10 (얼마나 아는지)
  affinity: number;             // -10 ~ 10 (호감도)
  lastInteraction: number;      // 마지막 대화 시간
  notes: string[];              // 이 사람에 대해 아는 것들
}
```

---

## 캐릭터 설정

### 대장장이 (Gorn)

```json
{
  "id": "blacksmith-gorn",
  "name": "Gorn",
  "age": 45,
  "occupation": "대장장이",
  "personality": ["무뚝뚝한", "장인정신", "과묵한", "정직한"],
  "background": "30년간 이 마을에서 대장간을 운영해온 베테랑 장인. 아버지에게서 기술을 물려받았다. 말은 적지만 좋은 무기를 만드는 것에 자부심이 있다.",
  "speechStyle": "짧고 단호하게 말함. 불필요한 말을 싫어함. '음', '그래' 같은 짧은 대답을 자주 함.",
  "goals": ["최고의 무기를 만들고 싶다", "기술을 후대에 전수하고 싶다"],
  "quirks": ["망치를 만지작거리는 습관", "일할 때 콧노래를 흥얼거림"],
  "likes": ["좋은 재료", "성실한 사람", "조용한 환경"],
  "dislikes": ["수다쟁이", "건방진 태도", "싸구려 무기"]
}
```

### 초보 모험가 (Lily)

```json
{
  "id": "adventurer-lily",
  "name": "Lily",
  "age": 18,
  "occupation": "초보 모험가",
  "personality": ["호기심 많은", "열정적", "약간 덜렁거림", "순수한"],
  "background": "농촌 마을에서 올라온 신입 모험가. 영웅이 되고 싶은 꿈을 품고 있지만 아직 경험이 부족하다. 대장장이 Gorn에게 첫 무기를 주문하러 왔다.",
  "speechStyle": "밝고 활기차게 말함. 질문이 많음. '와!', '정말요?' 같은 감탄사를 자주 씀.",
  "goals": ["유명한 모험가가 되고 싶다", "드래곤을 잡고 싶다", "마을을 지키고 싶다"],
  "quirks": ["모험 이야기에 눈이 반짝임", "실수하면 볼이 빨개짐"],
  "likes": ["모험 이야기", "새로운 경험", "선배 모험가들"],
  "dislikes": ["무시당하는 것", "지루한 일", "포기하라는 말"]
}
```

### 플레이어 (베테랑 모험가)

```json
{
  "id": "player",
  "name": "{{PLAYER_NAME}}",
  "occupation": "베테랑 모험가",
  "reputation": "마을에서 존경받는 숙련된 모험가. 여러 던전을 클리어한 실력자.",
  "knownBy": {
    "blacksmith-gorn": "단골 손님. 좋은 무기를 알아보는 눈이 있다고 인정함.",
    "adventurer-lily": "동경하는 선배 모험가. 언젠가 저렇게 되고 싶다고 생각함."
  }
}
```

---

## 상호작용 흐름

```
┌─────────────────────────────────────────────────────────────┐
│                    INTERACTION FLOW                          │
└─────────────────────────────────────────────────────────────┘

1. NPC ↔ NPC (자동)
   ┌─────────┐              ┌─────────┐
   │  Gorn   │◄────────────►│  Lily   │
   └────┬────┘              └────┬────┘
        │                        │
        │  근접 시 대화 트리거    │
        │  (랜덤 or 시간대별)     │
        └────────────────────────┘

2. Player → NPC (클릭)
   ┌─────────┐    클릭     ┌─────────┐
   │ Player  │───────────►│   NPC   │
   └─────────┘             └────┬────┘
                                │
                          Retrieve memories
                          about Player
                                │
                          Generate response
                                │
                          Store as observation

3. NPC → Player (자율)
   ┌─────────┐              ┌─────────┐
   │   NPC   │───────────►│ Player  │
   └────┬────┘   접근       └─────────┘
        │
   Player 근처에서 반응
   (인사, 질문, 부탁 등)
```

---

## MVP 구현 순서

### Phase 1: 기반 시스템
1. ✅ Gemini API 클라이언트
2. ⬜ Agent + Persona 데이터 구조
3. ⬜ Memory Stream 기본
4. ⬜ Retrieval (단순 버전: Recency + Importance)

### Phase 2: 대화 시스템
5. ⬜ Dialogue 시스템
6. ⬜ NPC-Player 대화
7. ⬜ NPC-NPC 대화

### Phase 3: 게임 환경
8. ⬜ Phaser 기본 씬
9. ⬜ 캐릭터 스프라이트
10. ⬜ 대화 UI

### Phase 4: 고급 기능 (선택)
11. ⬜ Reflection
12. ⬜ Planning
13. ⬜ Emotion 시스템
14. ⬜ 시간 흐름

---

## 논문 기능 적용 범위

| 논문 기능 | 적용 | 비고 |
|-----------|------|------|
| Memory Stream | ✅ | 핵심 |
| Retrieval (R×I×Rel) | ✅ | Relevance는 단순화 가능 |
| Importance Rating | ✅ | Gemini로 평가 |
| Reflection | ⚠️ | 나중에 추가 |
| Planning 3단계 | ❌ | 복잡, 생략 |
| 자율 대화 | ✅ | NPC끼리 + NPC→Player |
| 정보 확산 | ⚠️ | 2명이라 의미 약함 |
