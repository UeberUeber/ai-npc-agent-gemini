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
| **Scratch** | NPC의 현재 상태 (위치, 활동, 기분, 시간) |
| **Memory Stream** | 대화/관찰 기록을 시간순으로 저장 |
| **Retrieval** | Recency × Importance × Relevance 점수로 관련 기억 검색 |
| **Reflection** | 10회 대화마다 기억을 종합하여 상위 수준 인사이트 생성 |
| **Emotion System** | 대화에 따라 감정 상태가 동적으로 변화 |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client-Only)                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────────┐  │
│  │   index.html │───▶│  app.ts      │───▶│   NPCAgent       │  │
│  │   (UI)       │    │  (Controller)│    │   (Core Logic)   │  │
│  └──────────────┘    └──────────────┘    └────────┬─────────┘  │
│                                                    │             │
│                           ┌────────────────────────┼─────────┐  │
│                           │                        │         │  │
│                           ▼                        ▼         ▼  │
│                    ┌────────────┐          ┌────────────────┐  │
│                    │  Persona   │          │  MemoryStore   │  │
│                    │  Scratch   │          │  (localStorage)│  │
│                    └────────────┘          └────────────────┘  │
│                                                    │             │
│                           ┌────────────────────────┘             │
│                           ▼                                      │
│                    ┌────────────────┐                            │
│                    │  GeminiClient  │◀─────── API Key (User)    │
│                    │  (LLM API)     │                            │
│                    └───────┬────────┘                            │
│                            │                                     │
└────────────────────────────┼─────────────────────────────────────┘
                             │
                             ▼
                   ┌──────────────────┐
                   │  Gemini API      │
                   │  (Google Cloud)  │
                   └──────────────────┘
```

## File Structure

```
src/
├── client/                    # 브라우저용 코드
│   ├── agent.ts              # NPCAgent 클래스 (핵심 로직)
│   ├── gemini.ts             # Gemini API 클라이언트
│   ├── memory.ts             # MemoryStore (localStorage)
│   └── npcs/
│       └── blacksmith.ts     # 대장장이 NPC 정의
├── web/
│   └── app.ts                # UI 컨트롤러
└── index.html                # 웹 UI
```

## Core Components

### 1. Persona (NPC 정체성)

```typescript
interface Persona {
  id: string;
  name: string;           // "대장장이 존"
  age: number;            // 45
  occupation: string;     // "대장장이"
  traits: string[];       // ["성실함", "과묵함", "장인정신"]
  backstory: string;      // 배경 스토리
  currentGoals: string[]; // 현재 목표
  speechStyle: string;    // 말투 지침
}
```

### 2. Scratch (현재 상태)

```typescript
interface Scratch {
  currentLocation: string;  // "대장간 내부, 모루 앞"
  currentActivity: string;  // "검 손잡이를 다듬는 중"
  currentMood: MoodType;    // "neutral" → 대화에 따라 동적 변화
  currentTime: string;      // "14:30"
}
```

### 3. Memory Stream

```typescript
interface Memory {
  id: string;
  type: 'observation' | 'reflection' | 'plan';
  content: string;
  timestamp: string;
  importance: number;     // 1-10 (LLM이 평가)
  lastAccess: string;     // 최근 접근 시간
  sources?: string[];     // Reflection의 경우 소스 메모리 ID
}
```

### 4. Retrieval (기억 검색)

관련 기억을 검색할 때 세 가지 점수를 조합합니다:

```
Score = Recency + Importance + Relevance
```

- **Recency**: 최근에 접근한 기억일수록 높은 점수 (지수 감쇠)
- **Importance**: LLM이 평가한 중요도 (1-10)
- **Relevance**: 쿼리와의 키워드 매칭 비율

### 5. Reflection (성찰)

10회 대화마다 자동으로 트리거됩니다:

1. 최근 기억들의 중요도를 LLM으로 재평가
2. 높은 중요도 기억들을 바탕으로 상위 수준 인사이트 생성
3. Reflection 타입으로 메모리에 저장 (높은 중요도)

### 6. Emotion System (감정 시스템)

LLM 응답에서 감정과 의도를 함께 파싱합니다:

```typescript
// LLM 응답 형식
{
  "response": "대화 내용",
  "mood": "happy",     // 감정 상태
  "intent": "help"     // 대화 의도
}
```

감정 변화는:
- UI에 실시간 반영
- 시스템 로그에 기록
- 메모리에 저장 (다음 대화에 영향)

## Tech Stack

- **Language**: TypeScript
- **Build**: Vite
- **LLM**: Google Gemini API (`@google/generative-ai`)
- **Storage**: localStorage (브라우저)

## Environment Variables

```bash
# .env
VITE_GEMINI_MODEL=gemini-2.0-flash-001
```

API 키는 사용자가 브라우저에서 직접 입력합니다 (localStorage 저장).

## Usage

### 1. 설치 및 실행

```bash
npm install
npm run dev
```

### 2. API 키 입력

브라우저에서 [Google AI Studio](https://aistudio.google.com/apikey)에서 발급받은 API 키를 입력합니다.

### 3. NPC와 대화

대장장이 존과 대화를 나눕니다:
- 무기 구매/수리 요청
- 마을 정보 질문
- 철광석 수급 문제 논의

### 4. 시스템 관찰

오른쪽 패널에서 확인할 수 있습니다:
- **페르소나**: NPC의 정체성
- **현재 상태**: 위치, 활동, 감정
- **대화 히스토리**: 최근 대화
- **메모리 스트림**: 저장된 기억들
- **시스템 로그**: Reflection, 감정 변화 등

## Extending

### 새 NPC 추가

```typescript
// src/client/npcs/merchant.ts
export const merchantPersona: Persona = {
  id: 'merchant_anna',
  name: '상인 안나',
  age: 32,
  occupation: '여행 상인',
  traits: ['사교적', '수완 좋음', '호기심'],
  // ...
};
```

### 메모리 저장소 교체

`MemoryStore` 클래스의 인터페이스를 유지하면서 Firestore, Supabase 등으로 교체 가능합니다.

## References

- [Generative Agents: Interactive Simulacra of Human Behavior](https://arxiv.org/abs/2304.03442)
- [Google Gemini API Documentation](https://ai.google.dev/docs)

## License

MIT
