# AI NPC Agent - Generative Agents Style

Google Gemini API를 활용한 RPG/판타지 세계관 NPC 에이전트 시스템입니다.
[Generative Agents (Stanford, 2023)](https://arxiv.org/abs/2304.03442) 논문의 아키텍처를 참고하여 구현했습니다.

## 실행 방법

브라우저에서 직접 실행: API 키 입력 후 NPC와 대화할 수 있습니다.

```bash
npm install
npm run dev
```

브라우저에서 `http://localhost:3000` 접속 → API 키 입력 → 대화 시작

## 주요 기능

| 기능 | 설명 |
|------|------|
| **Multi-NPC** | 다중 NPC 동시 활동 (대장장이 존, 여관주인 로사) - 각자 독립적 메모리/계획 |
| **Persona** | NPC의 정체성 (이름, 나이, 직업, 성격, 배경, 목표, 말투) |
| **Scratch** | NPC의 현재 상태 (위치, 활동, 기분, 시간) - 동적으로 변화 |
| **Memory Stream** | 대화/관찰/감정변화를 시간순으로 localStorage에 저장 |
| **Knowledge** | NPC의 세계 지식 (장소, 도구, 가능한 활동) - Planning 제약 조건 |
| **Retrieval** | Recency + Importance + Relevance 점수로 관련 기억 검색 |
| **Reflection** | 10회 대화마다 LLM으로 중요도 재평가 후 상위 수준 인사이트 생성 |
| **Planning** | 지식 기반 하루 계획 생성 (Knowledge + Goals + Yesterday's Activities) |
| **Autonomous Speech** | 플레이어 감지 시 NPC가 먼저 말 걸기 (논문: Reaction & Dialogue System) |
| **NPC-NPC Dialogue** | NPC끼리 시야에서 만나면 3턴 대화 (쿨다운 60초) |
| **Conversation State** | 대화 시작 시 이동 정지 → 대화 종료 후 이동 재개 |
| **Thought Memory** | 내적 판단/혼잣말을 thought 타입으로 메모리에 저장 |
| **Emotion System** | JSON 응답에서 mood/intent 파싱, 감정 변화를 메모리에 기록 |
| **Perception** | 시야 내 엔티티/오브젝트 감지 → 변화만 자연어로 메모리 저장 (델타 기반) |
| **Plan-Aware Response** | 대화 응답 시 현재 계획 컨텍스트 반영 (하는 일, 시간, 다음 일정) |

## Architecture

```
┌──────────────────────────────────────────────────────────────────────────┐
│                          Browser (Client-Only)                            │
├──────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌────────────────────────────┐  │
│  │  index.html  │───▶│   app.ts     │───▶│        GameWorld           │  │
│  │  (UI + CSS)  │    │ (Controller) │    │  (타일맵 + 엔티티 + 시야)  │  │
│  └──────────────┘    └──────────────┘    └─────────────┬──────────────┘  │
│                                                        │                  │
│                           ┌────────────────────────────┼────────┐        │
│                           ▼                            ▼        ▼        │
│                    ┌──────────────┐           ┌──────────────────┐       │
│                    │ NpcController│──────────▶│     NPCAgent     │       │
│                    │ (계획→이동)  │           │   (대화/감정)    │       │
│                    └──────────────┘           └────────┬─────────┘       │
│                           │                            │                  │
│         ┌─────────────────┼────────────────────────────┤                  │
│         ▼                 ▼                            ▼                  │
│  ┌────────────┐    ┌────────────┐              ┌─────────────────┐       │
│  │  GameTime  │    │  Persona   │              │   MemoryStore   │       │
│  │ (게임 시간)│    │   (정적)   │              │  (localStorage) │       │
│  └────────────┘    ├────────────┤              ├─────────────────┤       │
│                    │  Scratch   │◀── 감정 ────│  - observation  │       │
│                    │   (동적)   │              │  - reflection   │       │
│                    └────────────┘              │  - thought      │       │
│                                                │  - knowledge    │       │
│                                                └────────┬────────┘       │
│                    ┌───────────────────────────────────┘                 │
│                    ▼                                                      │
│             ┌─────────────────┐                                          │
│             │  GeminiClient   │◀─────────── API Key (User Input)         │
│             │   (LLM API)     │                                          │
│             └────────┬────────┘                                          │
│                      │                                                    │
└──────────────────────┼────────────────────────────────────────────────────┘
                       ▼
              ┌──────────────────┐
              │   Gemini API     │
              │  (Google Cloud)  │
              └──────────────────┘
```

## File Structure

```
.
├── .claude/
│   └── rules/
│       └── ui-modification.md    # UI/디자인 수정 룰 (Claude Code용)
├── index.html                     # 웹 UI (HTML + CSS 포함)
├── src/
│   ├── client/                    # 브라우저용 핵심 코드
│   │   ├── agent.ts              # NPCAgent 클래스 (핵심 로직)
│   │   │                         # - chat(): 대화 + 감정 파싱 + 메모리 저장
│   │   │                         # - triggerReflection(): 10회마다 성찰
│   │   │                         # - shouldInitiateConversation(): 자율 발화 판단
│   │   ├── gemini.ts             # Gemini API 클라이언트
│   │   ├── memory.ts             # MemoryStore (localStorage 기반)
│   │   ├── game/                 # 게임 시뮬레이션
│   │   │   ├── world.ts          # GameWorld - 타일맵, 엔티티, 이동, 시야
│   │   │   ├── npc-controller.ts # NpcController - 계획→이동 연동, 상태 전이
│   │   │   └── time.ts           # GameTime - 게임 내 시간 흐름
│   │   ├── player/
│   │   │   └── hero_smage.ts     # 플레이어 캐릭터 정의
│   │   └── npcs/
│   │       ├── blacksmith_john.ts # 대장장이 존 (Persona + Scratch + Knowledge + WorldSetup)
│   │       ├── innkeeper_rosa.ts  # 여관주인 로사
│   │       └── types.ts           # NPC 정의 타입 (NpcDefinition 등)
│   └── web/
│       └── app.ts                # UI 컨트롤러 + 게임 루프
├── .env                           # (선택) 모델 설정 - 없어도 기본값 사용
├── vite.config.ts                 # Vite 설정
└── package.json
```

## Core Components

### 1. Persona (NPC 정체성) - 정적

```typescript
interface Persona {
  id: string;                 // "blacksmith_john"
  name: string;               // "대장장이 존"
  age: number;                // 45
  occupation: string;         // "대장장이"
  location: string;           // "마을 동쪽 대장간"
  traits: string[];           // ["성실함", "과묵함", "장인정신", "완고함"]
  backstory: string;          // 20년간 대장장이로 일해온 배경...
  currentGoals: string[];     // ["철광석 수급처 찾기", "룬 각인 검 완성"]
  speechStyle: string;        // "짧고 직설적인 반말. 예: '왔나.', '뭐 필요해?'"
}
```

### 2. Scratch (현재 상태) - 동적

```typescript
interface Scratch {
  currentLocation: string;    // "대장간 내부, 모루 앞"
  currentActivity: string;    // "검 손잡이를 다듬는 중"
  currentMood: string;        // "neutral" → 대화에 따라 동적 변화!
  currentTime: string;        // "14:30"
}

// 감정 타입 (7가지) - LLM 응답 파싱 시 사용
type MoodType = 'happy' | 'neutral' | 'sad' | 'angry' | 'fearful' | 'excited' | 'curious';
```

### 3. Memory Stream

```typescript
interface Memory {
  id: string;                 // "m001", "m002", ...
  type: MemoryType;           // 'observation' | 'reflection' | 'knowledge' | 'plan' | 'thought'
  content: string;            // "손님이 말했다: '검이 필요해'"
  timestamp: string;          // ISO 8601 형식
  importance: number;         // 1-10 (기본값 5, LLM이 재평가)
  lastAccess: string;         // 최근 접근 시간 (Recency 계산용)
  sources?: string[];         // Reflection의 경우 소스 메모리 ID들
}
```

#### Memory Type 위계 (동일 계층)

**핵심**: 모든 메모리 타입은 **동일한 계층**에서 관리됩니다. `type` 필드만 다를 뿐, 검색 시 동등하게 취급됩니다.

```
┌─────────────────────────────────────────────────────────────────────┐
│                       Memory Stream (단일 스트림)                      │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌───────────┐  │
│   │ observation │  │ reflection  │  │  knowledge  │  │   plan    │  │
│   │ (관찰/경험) │  │  (통찰)     │  │ (기본지식)  │  │ (계획)    │  │
│   └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └─────┬─────┘  │
│          │                │                │               │        │
│          └────────────────┴────────────────┴───────────────┘        │
│                                    │                                 │
│                                    ▼                                 │
│                    retrieve(query, topK) → 동일한 점수 공식 적용      │
│                    score = recency + importance + relevance          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

| 타입 | 생성 시점 | 중요도 | 예시 |
|------|----------|--------|------|
| `observation` | 대화/인식 발생 시 | 5 (기본) → LLM 재평가 | "손님이 검을 샀다" |
| `reflection` | 10회 대화마다 | 8 (고정) | "손님들은 주로 무기를 원한다" |
| `knowledge` | 초기화 시 1회 | 7 (고정) | "대장간에 모루가 있다" |
| `plan` | 매일 06:00 기상 시 | 6 (기본) | "오전에 검 제작, 오후에 손님 응대" |
| `thought` | 내적 판단/혼잣말 시 | 3-5 | "슬슬 가봐야겠는데..." |

#### 검색 시 동작

```typescript
// retrieve("검", 5) 호출 시
// → observation, reflection, knowledge, plan 모두 동등하게 검색
// → 점수 높은 상위 5개 반환 (타입 무관)
```

### 4. Importance Scoring (중요도 평가)

#### 왜 즉시 평가하지 않나요?

메모리를 저장할 때마다 LLM API를 호출하면:
- ❌ **비용 증가**: 대화 1회당 2개 메모리 저장 → API 호출 2배
- ❌ **응답 지연**: 사용자가 응답을 기다리는 시간 증가
- ❌ **비효율**: 사소한 인사말도 매번 평가

#### 해결책: 지연 일괄 평가 (Deferred Batch Evaluation)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     중요도 평가 타이밍                               │
├─────────────────────────────────────────────────────────────────────┤
│                                                                     │
│   메모리 저장 시                    대화 10개 도달 시               │
│   ─────────────                    ─────────────────               │
│                                                                     │
│   importance = 5 (기본값)          1. evaluateRecentImportance()   │
│   → 즉시 저장, API 호출 없음         → importance===5인 메모리 필터 │
│                                      → LLM에게 일괄 전송           │
│                                      → 1-10점 평가 받음            │
│                                                                     │
│                                    2. generateReflection()         │
│                                      → 높은 중요도 기준 정렬        │
│                                      → 상위 인사이트 추출           │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

#### 평가 기준 (1-10점)

| 점수 | 의미 | 예시 |
|------|------|------|
| 1-3 | 일상적 | "안녕", "잘 가", 단순 인사 |
| 4-6 | 일반적 | 정보 교환, 일반 대화 |
| 7-10 | 중요 | 큰 거래, 감정적 순간, 핵심 정보 |

#### 평가 프롬프트 예시

```typescript
const prompt = `다음은 대장장이 NPC의 기억들입니다. 각 기억의 중요도를 1-10 척도로 평가해주세요.
1: 일상적인 인사, 무의미한 대화
5: 일반적인 대화, 정보 교환
10: 매우 중요한 사건, 감정적으로 의미있는 순간, 핵심 정보

각 기억의 ID와 중요도를 JSON 배열로만 출력하세요.
예시: [{"id": "m001", "importance": 3}, {"id": "m002", "importance": 7}]

기억 목록:
- [m001] 손님이 말했다: "안녕"
- [m002] 손님이 철광석 거래를 제안했다
- [m003] 나는 손님에게 룬 각인 검 이야기를 했다
...`;
```

#### UI 표시

메모리 스트림에서 각 기억의 중요도 표시:
- **⏳ 미평가**: `importance === 5`이고 `type === 'observation'`인 경우
- **✓ 7/10**: 평가 완료된 경우

마우스 오버 시 툴팁으로 평가 시스템 전체 설명을 보여줍니다.

### 5. Retrieval (기억 검색)

```typescript
// memory.ts의 retrieve() 메서드
Score = Recency + Importance + Relevance

// Recency: 시간 기반 지수 감쇠
const hoursSince = (now - lastAccess) / (1000 * 60 * 60);
const recency = Math.pow(0.995, hoursSince);

// Importance: 정규화된 중요도
const importance = memory.importance / 10;

// Relevance: 키워드 매칭 비율
const relevance = matchCount / queryWords.length;
```

### 6. Reflection (성찰) - 10회 대화마다

```typescript
// agent.ts의 triggerReflection()
async triggerReflection() {
  // 1. 최근 기억들의 중요도 LLM으로 재평가
  await this.evaluateRecentImportance();

  // 2. 높은 중요도 순으로 정렬 → 상위 10개 선택
  // 3. LLM으로 성찰 생성
  await this.generateReflection();

  // 4. Reflection 타입으로 저장 (importance: 8)
}
```

### 7. Knowledge System (세계 지식)

NPC가 세계에 대해 알고 있는 **사실(Semantic Memory)**입니다. Planning 시 가능한 활동을 제한합니다.

#### 에피소드 vs 시맨틱 기억

```
┌──────────────────────────────────────────────────────────────────────┐
│              Memory Stream의 4가지 메모리 타입                         │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│   에피소드 기억 (시간 흐름)              시맨틱 기억 (사실)            │
│   ─────────────────────────            ─────────────────────          │
│   • observation: 관찰/경험              • knowledge: 세계 지식        │
│   • reflection: 통찰/반성               "대장간에 모루가 있다"        │
│   • plan: 하루 계획                     "집에 침대가 있다"            │
│                                                                       │
│   "어제 용사가 검을 샀다" ← 축적됨      "모루에서 일할 수 있다" ← 사실 │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

#### 지식 예시 (대장장이 존)

```typescript
// npcs/blacksmith_john.ts
export const blacksmithKnowledge: string[] = [
  // 장소 지식
  '나의 대장간은 마을 동쪽에 있다. 대장간 내부에서 일한다.',
  '대장간 바로 옆에 나의 집이 있다. 집에서 잠을 잔다.',

  // 도구/오브젝트 지식
  '대장간에는 모루가 있다. 모루에서 무기를 만들고 수리한다.',
  '집에는 침대가 있다. 침대에서 잠을 잔다.',

  // 가능한 활동 지식
  '나는 대장장이다. 모루에서 검, 도끼, 갑옷 등을 만들 수 있다.',
];
```

#### 지식 갱신 (세계 변화 대응)

```
기존 knowledge: "집에 침대가 있다"
새 observation: "내 침대가 불에 타서 사라졌다!" (importance: 10)

Planning 시:
→ knowledge + 최근 high-importance observation 함께 검색
→ LLM이 추론: "침대 있었는데 불탔으니 못 씀"
→ 다른 계획 생성 (바닥에서 자기 등)
```

### 8. Planning System (하루 계획 - 지식 기반)

NPC는 매일 아침(06:00) **지식 기반 하루 계획**을 생성합니다.

#### 입력 데이터 (개선)

```
┌─────────────────────────────────────────────────────────────────────┐
│                     Planning 입력 데이터                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│   1. Agent Summary              2. World Knowledge (NEW!)            │
│   ─────────────────            ────────────────────────             │
│   • 이름, 나이, 직업            • knowledge 타입 메모리              │
│   • 성격 특성                   • "모루에서 일할 수 있다"            │
│   • **현재 목표**               • "침대에서 잘 수 있다"              │
│   • 배경 스토리                 → 가능한 활동 제약!                  │
│                                                                      │
│   3. Yesterday's Activities     4. Recent Observations               │
│   ──────────────────           ─────────────────────                │
│   • 어제 하루 완료 기록          • 최근 중요 관찰                     │
│   • 연속성 확보                  • 지식 갱신 정보 (침대 불탔다 등)    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

#### 목표 → 계획 연결

```typescript
// DailyPlanItem 인터페이스
interface DailyPlanItem {
  time: string;           // "06:00", "14:00"
  activity: string;       // "철광석 상인 찾아보기"
  location?: string;      // "마을 시장"
  duration: number;       // 분 단위
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  goalRelated?: boolean;  // 🎯 목표와 연관된 활동
}
```

#### 계획 생성 흐름

```
06:00 기상
    ↓
wakeUp() 호출
    ↓
┌─────────────────────────────────────┐
│ 1. generateAgentSummary()           │
│    → 페르소나 + 목표 구조화         │
│                                     │
│ 2. getYesterdayActivities()         │
│    → 어제 활동 기록 검색            │
│                                     │
│ 3. 목표 키워드로 메모리 검색        │
│    → retrieve(goalKeywords, 5)      │
└─────────────────────────────────────┘
    ↓
LLM에게 계획 생성 요청
"목표 달성을 위한 활동을 최소 1-2개 포함하세요"
    ↓
계획 JSON 파싱 + 메모리에 저장
    ↓
시간별 자동 활동 변경 (updatePlanProgress)
    ↓
22:00 취침 → 하루 완료율 기록
```

#### UI 표시

- 🎯 : 목표 관련 활동 (보라색 테두리)
- ▶️ : 현재 진행 중 (노란색 강조)
- ✅ : 완료
- ⏭️ : 스킵됨
- ⏳ : 대기 중

### 8. Emotion System (감정 피드백 루프)

```typescript
// LLM 응답 형식 (JSON)
{
  "response": "검이 필요하다고? 마침 좋은 게 있어.",
  "mood": "happy",           // 7가지 중 하나
  "intent": "sell"           // 대화 의도
}

// Intent 타입 (7가지)
type Intent = 'sell' | 'help' | 'refuse' | 'inquire' | 'share_story' | 'warn' | 'chat';
```

**감정 변화 처리 흐름:**
```
사용자 입력 → LLM 응답 (JSON) → mood 파싱
                                    ↓
                              oldMood !== newMood?
                                    ↓ (Yes)
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
              scratch.mood    시스템 로그       메모리 저장
               업데이트        표시            (observation)
                    ↓
              다음 대화 프롬프트에 반영
```

### 9. Perception System (환경 인식)

NPC가 시야 내 환경을 인식하고, **변화만** 메모리에 저장합니다 (델타 기반).

#### 인식 대상

| 대상 | 감지 조건 | 저장 예시 |
|------|----------|----------|
| 플레이어 | 시야에 진입/퇴장 | "플레이어이(가) 대장간 근처에서 시야에 나타났다" |
| 다른 NPC | 시야에 진입/퇴장 | "여관주인 로사이(가) 시야에서 사라졌다" |
| 오브젝트 | 상태 변화 | "침대의 상태가 '비어있음'에서 '사용 중'으로 바뀌었다" |

#### 델타 기반 (PerceptionCache)

```typescript
interface PerceptionCache {
  seenEntities: Map<string, { x: number; y: number }>;  // 이미 본 엔티티
  seenObjects: Map<string, string>;                      // 이미 본 오브젝트 상태
}

// 변화 감지 로직
if (!lastPos) {
  // 새로 발견 → 메모리 저장
  "플레이어이(가) 대장간 근처에서 시야에 나타났다"
} else if (lastPos !== currentPos) {
  // 위치 변경 → 캐시만 업데이트 (저장 안 함)
}
```

#### 자연어 변환

좌표 기반 데이터를 자연어로 변환하여 저장합니다:

```typescript
// describeEntity(): 엔티티 → 자연어
"플레이어이(가) 대장간 근처에서 시야에 나타났다"

// describeObject(): 오브젝트 → 자연어
"모루이(가) 사용 중 상태이다"

// getLocationName(): 좌표 → 장소명
{ x: 3, y: 3 } → "대장간 근처"
```

#### 인식 트리거

```
플레이어 이동
    ↓
모든 NPC의 perceiveAndRemember() 호출
    ↓
┌─────────────────────────────────────┐
│ 1. perceive()                       │
│    → 시야 내 엔티티/오브젝트 스캔   │
│    → 캐시와 비교하여 변화 감지      │
│                                     │
│ 2. savePerceptions()                │
│    → 자연어 변환                    │
│    → observation으로 메모리 저장    │
│                                     │
│ 3. 플레이어 감지 시 자율 발화 트리거│
│    → tryInitiateConversation()      │
└─────────────────────────────────────┘
```

### 10. Autonomous Speech (자율 발화)

NPC가 플레이어를 시야에서 감지하면 **먼저 말을 거는** 시스템입니다.
(논문: Reaction & Dialogue System)

#### 흐름

```
플레이어가 NPC 시야에 진입
    ↓
perceive() → newEntities에 player 감지
    ↓
tryInitiateConversation()
    ↓
┌─────────────────────────────────────┐
│ 1. shouldInitiateConversation()     │
│    → 규칙 기반 필터 (자는 중? 화남?)│
│    → LLM 판단: "말 걸어야 할까?"    │
│    → YES / NO                       │
│                                     │
│ 2. generateSpontaneousUtterance()   │ (YES인 경우)
│    → 관련 기억 검색                 │
│    → 자발적 발화 생성               │
│    → 메모리에 저장                  │
│                                     │
│ 3. onSpontaneousUtterance 콜백      │
│    → UI에 메시지 표시               │
│    → 채팅 입력 활성화               │
└─────────────────────────────────────┘
```

#### 규칙 기반 사전 필터 (LLM 비용 절감)

```typescript
// 자동 거부 조건
if (!this.scratch.isAwake) return false;  // 자는 중
if (this.scratch.currentMood === 'angry') return false;  // 화난 상태
```

#### 시스템 로그 표시

- 🎯 플레이어 감지! 반응 판단 중...
- 💭 반응하지 않기로 결정 (NO인 경우)
- 💬 자발적 발화 생성 중... (YES인 경우)
- 🗣️ "어서 오게..." (발화 표시)

## Conversation Flow

```
1. 사용자 입력: "검이 필요해"
                 ↓
2. 관련 기억 검색 (retrieve)
   - "이전에 검을 샀던 손님" (score: 2.3)
   - "철광석이 부족하다고 했던 기억" (score: 1.8)
                 ↓
3. 프롬프트 조합 (buildPrompt)
   - Persona (정체성)
   - Scratch (현재 상태 + 감정)
   - **현재 계획 컨텍스트** (하는 일, 시간, 다음 일정)
   - 관련 기억들
   - 최근 대화 히스토리 (6개)
   - 사용자 발화
   - JSON 출력 지시
                 ↓
4. LLM 호출 → JSON 파싱
   {"response": "...", "mood": "happy", "intent": "sell"}
                 ↓
5. 감정 변화 처리
   - scratch.currentMood 업데이트
   - 시스템 로그 기록
   - 메모리에 감정 변화 저장
                 ↓
6. 대화 내용 메모리 저장
   - 사용자 발화 (observation)
   - NPC 응답 + intent (observation)
                 ↓
7. 대화 카운트 증가
   - 10회 도달 시 Reflection 트리거
                 ↓
8. UI 업데이트
   - 채팅 창, 감정 표시, 메모리 목록, 시스템 로그
```

## Tech Stack

| 구분 | 기술 |
|------|------|
| Language | TypeScript |
| Build | Vite |
| LLM | Google Gemini API (`@google/generative-ai`) |
| Storage | localStorage (브라우저) |
| UI | Vanilla HTML/CSS/JS |

## Environment Variables

```bash
# .env
VITE_GEMINI_MODEL=gemini-2.0-flash-001
```

- `VITE_GEMINI_MODEL`: 사용할 Gemini 모델 (기본값: `gemini-2.0-flash-001`)
- API 키는 사용자가 브라우저에서 직접 입력 → localStorage에 저장됩니다.

## Usage

### 1. 설치 및 실행

```bash
npm install
npm run dev
# → http://localhost:3000 에서 실행
```

### 2. API 키 입력

[Google AI Studio](https://aistudio.google.com/apikey)에서 API 키 발급 → 브라우저 모달에 입력

### 3. NPC와 대화

대장장이 존과 대화:
- "검이 필요해" → 판매 의도로 응답, 감정 변화
- "요즘 장사는 어때?" → 철광석 수급 고민 이야기
- "아버지한테 뭘 배웠어?" → 룬 각인 검 이야기

#### 대화 예시 (메모리 시스템 동작)

```
┌─────────────────────────────────────────────────────────────────────┐
│ 예시 1: 기본 대화 → observation 저장                                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 플레이어: "검이 필요해"                                               │
│                                                                      │
│ [시스템 동작]                                                         │
│ 1. retrieve("검", 5) → knowledge "모루에서 검을 만든다" 검색됨        │
│ 2. LLM 응답 생성                                                      │
│ 3. observation 저장: "손님이 말했다: '검이 필요해'" (importance: 5)    │
│                                                                      │
│ 대장장이 존: "검? 지금 만들고 있는 게 있어. 잠깐 기다려."              │
│                                                                      │
│ [시스템 동작]                                                         │
│ 4. observation 저장: "나는 손님에게 검을 팔겠다고 했다" (importance: 5)│
│ 5. mood: neutral → 변화 없음                                          │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 예시 2: 감정 변화 → mood 업데이트 + observation 저장                   │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ 플레이어: "검 솜씨가 마을에서 제일이라던데?"                            │
│                                                                      │
│ 대장장이 존: "...그렇게 말해주니 고맙군. 아버지한테 배운 거야."         │
│                                                                      │
│ [시스템 동작]                                                         │
│ 1. LLM 응답: { "response": "...", "mood": "happy", "intent": "chat" } │
│ 2. mood 변화 감지: neutral → happy                                    │
│ 3. scratch.currentMood = "happy"                                      │
│ 4. observation 저장: "감정이 neutral에서 happy로 변했다.               │
│    이유: 손님이 내 검 솜씨를 칭찬했다" (importance: 6)                 │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 예시 3: 10회 대화 후 → reflection 생성                                │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ [10회째 대화 완료]                                                    │
│                                                                      │
│ [시스템 동작: triggerReflection()]                                    │
│ 1. evaluateRecentImportance()                                         │
│    → importance=5인 기억들 LLM에게 일괄 평가 요청                      │
│    → "검이 필요해" → 5, "철광석 거래 제안" → 8 등                      │
│                                                                      │
│ 2. generateReflection()                                               │
│    → 고중요도 기억 상위 10개 선택                                     │
│    → LLM: "최근 손님들은 무기에 관심이 많다. 철광석 확보가 중요하다"    │
│                                                                      │
│ 3. reflection 저장:                                                   │
│    type: "reflection"                                                 │
│    content: "최근 손님들은 무기에 관심이 많다..."                       │
│    importance: 8 (고정)                                               │
│    sources: ["m001", "m003", "m007", ...]                             │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────┐
│ 예시 4: knowledge 활용 (Planning)                                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│ [06:00 기상 시]                                                       │
│                                                                      │
│ [시스템 동작: generateDailyPlan()]                                    │
│ 1. knowledge 검색: "모루에서 일할 수 있다", "침대에서 잔다"            │
│ 2. 목표 검색: "철광석 수급처 찾기" 관련 기억                           │
│ 3. 어제 활동 검색: plan 타입 기억                                     │
│                                                                      │
│ [LLM 계획 생성]                                                       │
│ - 06:00~07:00: 기상, 준비 (집)                                        │
│ - 07:00~12:00: 검 제작 (대장간 모루) ← knowledge 기반                  │
│ - 12:00~13:00: 점심 식사 (여관)                                       │
│ - 13:00~14:00: 철광석 상인 찾아보기 (마을 시장) 🎯 ← 목표 관련         │
│ - 14:00~22:00: 손님 응대 (대장간)                                      │
│ - 22:00: 취침 (집 침대)                                               │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 4. 시스템 관찰 (우측 패널)

- **페르소나**: NPC의 고정 정체성
- **현재 상태**: 위치, 활동, **감정 (실시간 변화)**
- **대화 히스토리**: 최근 10개 대화
- **메모리 스트림**: 저장된 기억들 (Reflection은 보라색 강조)
- **시스템 로그**: 감정 변화, Reflection 진행 상황

## Extending

### 새 NPC 추가

```typescript
// src/client/npcs/merchant_anna.ts
import { Persona, Scratch } from '../agent';

export const merchantPersona: Persona = {
  id: 'merchant_anna',
  name: '상인 안나',
  age: 32,
  occupation: '여행 상인',
  location: '마을 광장',
  traits: ['사교적', '수완 좋음', '호기심'],
  backstory: '각지를 돌아다니며 희귀한 물건을 거래하는 상인...',
  currentGoals: ['희귀 아이템 수집', '새로운 거래처 개척'],
  speechStyle: '친근하고 활발한 존댓말. 예: "어서 오세요~", "이건 정말 특별한 물건이에요!"',
};

export const merchantScratch: Scratch = {
  currentLocation: '마을 광장, 마차 옆',
  currentActivity: '물건을 정리하는 중',
  currentMood: 'happy',
  currentTime: '10:00',
};
```

### app.ts에서 NPC 교체

```typescript
// src/web/app.ts
import { merchantPersona, merchantScratch } from '../client/npcs/merchant_anna';

agent = new NPCAgent(merchantPersona, merchantScratch);
```

### 메모리 저장소 교체

`MemoryStore` 클래스의 인터페이스를 유지하면서 Firestore, Supabase 등으로 교체 가능:

```typescript
// 필수 메서드
add(input: { type, content, importance?, sources? }): Memory
retrieve(query: string, topK: number): RetrievedMemory[]
getAll(): Memory[]
count(): number
updateImportance(id: string, importance: number): void
clear(): void
```

## Changelog

### 2025-01-19 (대화 지속 판단 & 재플래닝)
- **Conversation Continuation Decision**: NPC가 대화 매 턴마다 계속할지 판단
  - 성격(성실 vs 사교적), 다음 일정 중요도, 대화 내용 고려
  - 내적 판단을 thought 메모리로 저장 ("슬슬 가봐야겠는데...")
  - false 시 작별 인사 후 자동 대화 종료
  - `checkShouldContinue()` → `shouldContinueConversation()` 체인
- **Post-Conversation Replanning**: 긴 대화 후 자동 재플래닝
  - 게임 내 30분 이상 대화 시 `updatePlanProgress()` 호출
  - 새 활동 위치로 자동 이동
  - `conversationStartTime` 추적, `checkNeedsReplanning()` 로직

### 2025-01-19 (계획 기반 대화 응답)
- **Plan-Aware Response**: 대화 응답 시 현재 계획 컨텍스트를 LLM에게 전달
  - 현재 하는 일, 시작 시간, 예상 소요 시간, 장소
  - 목표와 관련된 활동 여부
  - 다음 일정 정보
  - 예: "지금 요리 중이라 바빠요" 같은 상황 인식 응답 가능
- **수정된 파일**
  - `agent.ts`: `buildPrompt()`에 `getCurrentPlanItem()`, `getNextPlanItem()` 활용
  - 응답 지침에 "현재 활동 반영" 힌트 추가

### 2025-01-18 (대화 시스템 고도화)
- **NPC-NPC 대화 시스템**: NPC끼리 시야에서 만나면 자동 대화
  - 3턴 대화 (인사 → 응답 → 마무리)
  - 양방향 쿨다운 60초 (같은 NPC 쌍은 1분간 재대화 안 함)
  - `initiateNpcConversation()`, `respondToNpc()` 메서드
- **대화 중 이동 정지**: `conversing` 상태 추가
  - `startConversation()`: 이동 중지, 이전 상태 저장
  - `endConversation()`: 이전 상태 복원, 이동 재개
  - `moveTo()`: 대화 중이면 이동 차단 (목적지만 저장)
- **Thought 메모리 타입**: 내적 판단/혼잣말 저장
  - `MemoryType`에 `thought` 추가
  - `addThought()`: 내적 판단 저장
  - `shouldContinueConversation()`: 대화 계속 여부 LLM 판단
  - `generateSelfTalk()`: 혼자 있을 때 혼잣말 생성 (20% 확률)
  - UI에 파란색 이탤릭으로 표시
- **플레이어 자율 발화 쿨다운**: 30초 쿨다운 추가 (반복 인사 방지)
- **자율 발화 반복 방지**: 이전 발화 검색 후 "같은 말 하지 마" 지시

### 2025-01-18 (UI 개선: 스크롤/아이콘/시간 컨트롤)
- **메모리 스트림 스크롤 추가**: 메모리가 많아지면 스크롤로 탐색
  - `.memory-list`에 `max-height: 200px`, `overflow-y: auto` 적용
- **대화 아이콘 NPC별 분기**: 망치(🔨) 대신 화자별 아이콘 표시
  - 대장장이 존: 👨‍🔧
  - 여관주인 로사: 👩‍🍳
  - 플레이어: 🦸
  - 시스템: ⚙️
- **시간 일시정지 버튼 추가**: 타이머 옆 ⏸️/▶️ 토글 버튼
  - 클릭 시 게임 시간 멈춤/재개
  - 일시정지 상태에서 빨간색 배경으로 표시
  - NPC 이동도 함께 멈춤 (틱 기반)

### 2025-01-18 (README 개선: Memory System 설명)
- **Memory Type 위계 다이어그램 추가**: observation, reflection, knowledge, plan이 동일 계층임을 시각화
  - 4가지 타입의 생성 시점, 중요도, 예시 테이블
  - 검색 시 모든 타입이 동등하게 취급됨을 명시
- **대화 예시 4가지 추가** (Usage 섹션)
  - 기본 대화 → observation 저장
  - 감정 변화 → mood 업데이트 + observation
  - 10회 대화 후 → reflection 생성
  - knowledge 활용 (Planning)

### 2025-01-18 (자율 발화 시스템)
- **Autonomous Speech 구현** (Generative Agents 논문: Reaction & Dialogue System)
  - 플레이어가 NPC 시야에 들어오면 NPC가 먼저 말 걸기
  - `shouldInitiateConversation()`: 규칙 기반 필터 + LLM 판단 (YES/NO)
  - `generateSpontaneousUtterance()`: 자발적 발화 생성
  - `tryInitiateConversation()`: 인식 → 판단 → 발화 → UI 전달
- **수정된 파일**
  - `agent.ts`: 자율 발화 메서드 2개 추가
  - `npc-controller.ts`: `perceiveAndRemember()` 수정, `onSpontaneousUtterance` 콜백
  - `app.ts`: 자율 발화 콜백 연결 (채팅 UI 표시)

### 2025-01-18 (UI/레이아웃 개선)
- **게임 그리드 반응형 개선**: 지도가 화면에 스크롤 없이 꽉 차게 표시
  - `height: calc(100vh - 320px)` 로 뷰포트 기준 크기 계산
  - `aspect-ratio: 1` 유지하며 정사각형 그리드
- **Perception 시스템 개선**: 플레이어 이동 시 NPC 인식 체크 추가
  - `onPlayerMove` 콜백에서 모든 NPC의 `perceiveAndRemember()` 호출
- **다중 NPC Controller**: 각 NPC별 독립적인 월드 배치 및 시야 관리

### 2025-01-18 (다중 NPC 시스템)
- **다중 NPC 지원**: 2명의 NPC가 동시에 활동
  - 대장장이 존 (blacksmith_john): 마을 동쪽 대장간
  - 여관주인 로사 (innkeeper_rosa): 마을 서쪽 여관
  - 각 NPC별 독립적인 Agent, Controller, 메모리, 계획
- **NPC 정의 구조화**: `NpcDefinition` 타입 도입
  - Persona, Scratch, Knowledge, WorldSetup 통합 관리
  - 장소 좌표 매핑 (`locations`)
  - 월드 오브젝트/벽 배치 (`worldSetup`)
- **Planning 시스템 툴팁 추가**: 계획 패널 제목 옆 ℹ️ 아이콘
  - 호버 시 Planning 입력/출력/검색 방식 상세 설명
  - LLM에게 전달되는 5가지 컨텍스트 설명
  - 목표 관련 기억 검색 공식 (`score = recency + importance + relevance`)
- **UI 개선**
  - 계획 패널: 제목 고정, 목록만 스크롤
  - 로사 전용 탭 UI (Scratch, 계획, 히스토리, 메모리)

### 2025-01-18 (Knowledge 시스템)
- **세계 지식(Knowledge) 시스템 추가**: NPC가 알고 있는 세계 사실을 메모리에 저장
  - `MemoryType`에 `knowledge` 타입 추가 (observation, reflection, plan과 함께)
  - NPC별 초기 지식 정의 (`blacksmithKnowledge[]`)
  - Planning 시 지식을 기반으로 가능한 활동 제한
- **지식 갱신 메커니즘**: 세계 변화 시 observation으로 기록 → LLM이 추론
  - 예: "침대 있음" + "침대 불탔다" → "침대 사용 불가" 추론
- **README 작성 룰 추가**: `.claude/rules/readme-writing.md`
  - 발표자료처럼 작성하는 원칙

### 2025-01-18 (인물 탭 시스템)
- **인물 탭 UI 추가**: 오른쪽 패널을 "인물" 탭으로 변경
  - 👨‍🔧 대장장이 존 / ⚔️ 용사 스마게 탭 전환
  - 각 캐릭터별 페르소나, 환경/상태 정보 표시
  - NPC 탭: 기존 정보 (계획, 히스토리, 메모리, 로그)
  - 플레이어 탭: 페르소나 + 환경/상태 (소지금 포함)
- **플레이어 아이콘 통일**: 지도/대화/타일정보/탭 모두 ⚔️ 아이콘 사용

### 2025-01-18 (Planning 시스템)
- **Planning 시스템 구현** (Generative Agents 논문 기반)
  - `wakeUp()` / `sleep()`: 기상/취침 라이프사이클
  - `generateDailyPlan()`: 목표 기반 하루 계획 생성
  - `updatePlanProgress()`: 시간별 자동 활동 변경
  - Agent Summary + Yesterday's Activities 입력 구조화
  - 목표 관련 활동 표시 (`goalRelated: true` + 🎯 아이콘)
- **GameTime 시스템 추가**: 게임 내 시간 흐름 (실시간 1초 = 게임 5분)
  - 시간대별 UI 업데이트 (새벽/오전/오후/저녁/밤)
  - 06:00 자동 기상, 22:00 자동 취침

### 2025-01-18
- **Claude Code 룰 시스템 추가**: `.claude/rules/` 디렉토리로 작업 룰 관리
  - `ui-modification.md`: UI/디자인 수정 시 필수 준수 사항
  - 수정 범위 제한, 위치 키워드 해석, 요소 이동 체크리스트 등
- **방향 화살표 표시**: 플레이어와 NPC 모두 바라보는 방향을 화살표(▲▼◀▶)로 표시
  - 플레이어: 이동 방향 또는 시도한 방향으로 화살표 업데이트
  - NPC: facing 속성에 따라 방향 표시
- **상호작용 시스템 개선**: 상하좌우 인접만 상호작용 가능 (대각선 제외)
  - `isAdjacent()`: 상하좌우 4방향만 인접으로 판단
  - `getAdjacentObject()`: 플레이어가 바라보는 방향의 오브젝트 반환
  - `getAdjacentObjects()`: 상하좌우 모든 인접 오브젝트 반환
- **타일 정보 패널 추가**: 마을 지도 옆에 타일 클릭 시 정보 표시 패널 추가
  - 클릭한 타일의 좌표, 타입, NPC 시야 여부 표시
  - NPC/오브젝트/플레이어 정보 상세 표시
  - 벽 타일의 시야 차단 여부 표시
  - `getTileInfo()`: 타일의 모든 정보를 반환하는 메서드
  - `onTileClick` 콜백: 타일 클릭 시 호출되는 이벤트 핸들러
- **패널 리사이저 추가**: 3개 패널(마을/대화/NPC 정보) 사이에 드래그 가능한 리사이저 추가
  - 마우스 드래그로 각 패널 너비 동적 조절 가능
  - 최소 너비 200px 보장
  - 호버/드래그 시 시각적 피드백 (파란색 강조)
- **대화창 기본 폭 축소**: flex 1.2 → 0.8로 변경하여 더 컴팩트한 레이아웃
- **NPC 시야 시스템 추가**: NPC의 시야 범위 시각화 (노란색 하이라이트)
- **오브젝트 타일 추가**: 게임 월드에 상호작용 가능한 오브젝트 표시

## Known Limitations (알려진 제한사항)

### API 관련

| 제한사항 | 현재 동작 | 권장 개선 |
|---------|----------|----------|
| **API 할당량 초과** | 에러 메시지만 표시 (`(잠시 생각에 잠긴다)...`) | 규칙 기반 폴백 응답 |
| **API 응답 지연** | 타이핑 인디케이터 표시 | 타임아웃 + 재시도 로직 |
| **JSON 파싱 실패** | 원본 텍스트로 폴백 | 에러 로깅 + 안전한 기본 응답 |

### 메모리 시스템

| 제한사항 | 현재 동작 | 권장 개선 |
|---------|----------|----------|
| **localStorage 용량** | 5MB 초과 시 저장 실패 | IndexedDB 또는 서버 저장소 |
| **Reflection 트리거** | 10회 대화마다 (고정) | 중요도 합계 > 150 (논문 방식) |
| **Relevance 계산** | 키워드 매칭 | 임베딩 코사인 유사도 |

### Planning 시스템

| 제한사항 | 현재 동작 | 권장 개선 |
|---------|----------|----------|
| **Reflection 미반영** | 계획 생성 시 성찰 결과 미사용 | 최근 reflection 포함 |
| **Planning 디버깅** | 왜 특정 활동 선택했는지 추적 어려움 | 계획 생성 근거 로깅 |

### UI/UX

| 제한사항 | 현재 동작 | 권장 개선 |
|---------|----------|----------|
| **NPC 하드코딩** | 2명 NPC가 15곳 이상 하드코딩 | NPC 레지스트리 패턴 |
| **오타 입력** | 관련 기억 0개 → 이상한 응답 | 퍼지 매칭 |
| **자율 발화 쿨다운** | 30초 후 같은 인사 가능 | 이동 거리 체크 추가 |

### 확장성

```
현재: 2 NPC, localStorage
권장: N NPC, 서버 DB, 임베딩 검색
```

## References

- [Generative Agents: Interactive Simulacra of Human Behavior (Stanford, 2023)](https://arxiv.org/abs/2304.03442)
- [Google Gemini API Documentation](https://ai.google.dev/docs)

## License

MIT
