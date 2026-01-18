# AI NPC Agent - Generative Agents Style

Google Gemini API를 활용한 RPG/판타지 세계관 NPC 에이전트 시스템입니다.
[Generative Agents (Stanford, 2023)](https://arxiv.org/abs/2304.03442) 논문의 아키텍처를 참고하여 구현했습니다.

## Demo

브라우저에서 직접 실행: API 키 입력 후 NPC와 대화할 수 있습니다.

```bash
npm install
npm run dev
```

## Features

| 기능 | 설명 |
|------|------|
| **Persona** | NPC의 정체성 (이름, 나이, 직업, 성격, 배경, 목표, 말투) |
| **Scratch** | NPC의 현재 상태 (위치, 활동, 기분, 시간) - 동적으로 변화 |
| **Memory Stream** | 대화/관찰/감정변화를 시간순으로 localStorage에 저장 |
| **Retrieval** | Recency + Importance + Relevance 점수로 관련 기억 검색 |
| **Reflection** | 10회 대화마다 LLM으로 중요도 재평가 후 상위 수준 인사이트 생성 |
| **Emotion System** | JSON 응답에서 mood/intent 파싱, 감정 변화를 메모리에 기록 |

## Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                        Browser (Client-Only)                         │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────────────────┐  │
│  │  index.html  │───▶│   app.ts     │───▶│      NPCAgent         │  │
│  │  (UI + CSS)  │    │ (Controller) │    │    (Core Logic)       │  │
│  └──────────────┘    └──────────────┘    └───────────┬───────────┘  │
│                                                      │               │
│                    ┌─────────────────────────────────┼───────────┐  │
│                    │                                 │           │  │
│                    ▼                                 ▼           ▼  │
│             ┌────────────┐                   ┌─────────────────┐   │
│             │  Persona   │                   │   MemoryStore   │   │
│             │  (정적)    │                   │  (localStorage) │   │
│             ├────────────┤                   ├─────────────────┤   │
│             │  Scratch   │◀──── 감정 변화 ───│  - observation  │   │
│             │  (동적)    │                   │  - reflection   │   │
│             └────────────┘                   └─────────────────┘   │
│                                                      │               │
│                    ┌─────────────────────────────────┘               │
│                    ▼                                                 │
│             ┌─────────────────┐                                      │
│             │  GeminiClient   │◀────────── API Key (User Input)     │
│             │  (LLM API)      │                                      │
│             └────────┬────────┘                                      │
│                      │                                               │
└──────────────────────┼───────────────────────────────────────────────┘
                       │
                       ▼
              ┌──────────────────┐
              │   Gemini API     │
              │  (Google Cloud)  │
              └──────────────────┘
```

## File Structure

```
.
├── index.html                 # 웹 UI (HTML + CSS 포함)
├── src/
│   ├── client/                # 브라우저용 코드
│   │   ├── agent.ts          # NPCAgent 클래스 (핵심 로직)
│   │   │                     # - chat(): 대화 + 감정 파싱 + 메모리 저장
│   │   │                     # - greet(): 첫 인사 생성
│   │   │                     # - triggerReflection(): 10회마다 성찰
│   │   │                     # - buildPrompt(): 프롬프트 조합
│   │   ├── gemini.ts         # Gemini API 클라이언트
│   │   │                     # - API 키 localStorage 관리
│   │   │                     # - generate(): 텍스트 생성
│   │   ├── memory.ts         # MemoryStore (localStorage 기반)
│   │   │                     # - add(): 메모리 추가
│   │   │                     # - retrieve(): 관련 기억 검색
│   │   │                     # - updateImportance(): 중요도 갱신
│   │   └── npcs/
│   │       └── blacksmith.ts # 대장장이 NPC (Persona + Scratch)
│   └── web/
│       └── app.ts            # UI 컨트롤러
│                             # - DOM 이벤트 핸들링
│                             # - 시스템 로그 표시
│                             # - 실시간 상태 UI 업데이트
├── .env                       # 환경변수 (VITE_GEMINI_MODEL)
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
  currentMood: MoodType;      // "neutral" → 대화에 따라 동적 변화!
  currentTime: string;        // "14:30"
}

// 감정 타입 (7가지)
type MoodType = 'happy' | 'neutral' | 'sad' | 'angry' | 'fearful' | 'excited' | 'curious';
```

### 3. Memory Stream

```typescript
interface Memory {
  id: string;                 // "m001", "m002", ...
  type: MemoryType;           // 'observation' | 'reflection' | 'plan'
  content: string;            // "손님이 말했다: '검이 필요해'"
  timestamp: string;          // ISO 8601 형식
  importance: number;         // 1-10 (기본값 5, LLM이 재평가)
  lastAccess: string;         // 최근 접근 시간 (Recency 계산용)
  sources?: string[];         // Reflection의 경우 소스 메모리 ID들
}
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

### 7. Emotion System (감정 피드백 루프)

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
VITE_GEMINI_MODEL=gemini-3-flash-preview
```

API 키는 사용자가 브라우저에서 직접 입력 → localStorage에 저장됩니다.

## Usage

### 1. 설치 및 실행

```bash
npm install
npm run dev
```

### 2. API 키 입력

[Google AI Studio](https://aistudio.google.com/apikey)에서 API 키 발급 → 브라우저 모달에 입력

### 3. NPC와 대화

대장장이 존과 대화:
- "검이 필요해" → 판매 의도로 응답, 감정 변화
- "요즘 장사는 어때?" → 철광석 수급 고민 이야기
- "아버지한테 뭘 배웠어?" → 룬 각인 검 이야기

### 4. 시스템 관찰 (우측 패널)

- **페르소나**: NPC의 고정 정체성
- **현재 상태**: 위치, 활동, **감정 (실시간 변화)**
- **대화 히스토리**: 최근 10개 대화
- **메모리 스트림**: 저장된 기억들 (Reflection은 보라색 강조)
- **시스템 로그**: 감정 변화, Reflection 진행 상황

## Extending

### 새 NPC 추가

```typescript
// src/client/npcs/merchant.ts
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
import { merchantPersona, merchantScratch } from '../client/npcs/merchant';

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

## References

- [Generative Agents: Interactive Simulacra of Human Behavior (Stanford, 2023)](https://arxiv.org/abs/2304.03442)
- [Google Gemini API Documentation](https://ai.google.dev/docs)

## License

MIT
