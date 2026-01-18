# Generative Agents: Interactive Simulacra of Human Behavior

## 논문 정보
- **저자**: Joon Sung Park, Joseph C. O'Brien, Carrie J. Cai, Meredith Ringel Morris, Percy Liang, Michael S. Bernstein
- **기관**: Stanford University, Google Research
- **출처**: UIST '23 (ACM Symposium on User Interface Software and Technology)
- **arXiv**: https://arxiv.org/abs/2304.03442
- **GitHub**: https://github.com/joonspk-research/generative_agents

---

## 개요

Generative Agents는 LLM을 확장하여 **믿을 수 있는 인간 행동을 시뮬레이션**하는 컴퓨터 에이전트입니다.
25명의 에이전트가 "Smallville"이라는 가상 마을에서 자율적으로 생활하며 상호작용합니다.

### 에이전트가 하는 일
- 아침에 일어나서 아침식사 준비
- 출근하고 일하기
- 서로를 인식하고 대화 시작
- 과거 경험을 기억하고 반성
- 다음 날 계획 수립

---

## 핵심 아키텍처 다이어그램

### Figure 5: Agent Architecture (논문 핵심 다이어그램)

에이전트가 환경을 인지하고, 메모리에 저장하고, 관련 정보를 검색하여 행동을 결정하는 전체 흐름입니다.

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           GENERATIVE AGENT ARCHITECTURE                       │
└──────────────────────────────────────────────────────────────────────────────┘

    ┌─────────┐
    │  Agent  │
    │  (예:   │
    │  Klaus) │
    └────┬────┘
         │ perceive
         ▼
┌─────────────────┐
│   Environment   │  "Klaus saw a library book on the table"
│   Observation   │  "Klaus talked to Maria about research"
└────────┬────────┘
         │ store
         ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                            MEMORY STREAM                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐ │
│  │ [Obs] Klaus is reading a book about physics (importance: 5)             │ │
│  │ [Obs] Klaus talked to Maria about his research (importance: 7)          │ │
│  │ [Obs] Klaus ate lunch at the cafe (importance: 2)                       │ │
│  │ [Ref] Klaus is dedicated to his research on physics (importance: 8)     │ │
│  │ [Plan] 2pm: Continue working on research paper (importance: 6)          │ │
│  │ ...                                                                      │ │
│  └─────────────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
         │                              │                              │
         │ retrieve                     │ synthesize                   │ generate
         ▼                              ▼                              ▼
┌─────────────────┐           ┌─────────────────┐            ┌─────────────────┐
│    RETRIEVAL    │           │   REFLECTION    │            │    PLANNING     │
│                 │           │                 │            │                 │
│ Query: "What    │           │ "Klaus is       │            │ Daily → Hourly  │
│ does Klaus know │           │  passionate     │            │ → 5-15 min      │
│ about Maria?"   │           │  about physics" │            │   actions       │
│                 │           │                 │            │                 │
│ Score = α×R +   │           │ Trigger: when   │            │                 │
│   α×I + α×Rel   │           │ importance_sum  │            │                 │
│                 │           │   > 150         │            │                 │
└────────┬────────┘           └────────┬────────┘            └────────┬────────┘
         │                              │                              │
         └──────────────────────────────┼──────────────────────────────┘
                                        │
                                        ▼
                              ┌─────────────────┐
                              │     ACTION      │
                              │                 │
                              │ "Klaus walks to │
                              │  the library"   │
                              │                 │
                              │ OR              │
                              │                 │
                              │ "Klaus says:    │
                              │  Hi Maria!"     │
                              └─────────────────┘
```

### Figure 6: Memory Retrieval 상세

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         MEMORY RETRIEVAL MECHANISM                            │
└──────────────────────────────────────────────────────────────────────────────┘

Query: "What is Klaus's relationship with Maria?"

MEMORY STREAM (수백 개의 메모리)              SCORING & RANKING
┌────────────────────────────────┐          ┌─────────────────────────────────┐
│ • Klaus woke up at 7am        │    ──►   │                                 │
│ • Klaus brushed his teeth     │          │   Recency × Importance ×        │
│ • Klaus saw Maria at cafe     │    ──►   │   Relevance                     │
│ • Klaus ate breakfast         │          │                                 │
│ • Klaus talked to Maria       │    ──►   │   = 0.8 × 0.7 × 0.9 = 0.504     │
│   about research project      │          │                                 │
│ • Klaus walked to library     │          │                                 │
│ • Maria asked Klaus for help  │    ──►   │   = 0.6 × 0.8 × 0.95 = 0.456    │
│ • Klaus is reading a book     │          │                                 │
│ • ...                         │          │                                 │
└────────────────────────────────┘          └─────────────────────────────────┘
                                                           │
                                                           ▼
                                            ┌─────────────────────────────────┐
                                            │     TOP-K RETRIEVED MEMORIES    │
                                            │                                 │
                                            │ 1. Klaus talked to Maria about  │
                                            │    research project (0.504)     │
                                            │                                 │
                                            │ 2. Maria asked Klaus for help   │
                                            │    with physics (0.456)         │
                                            │                                 │
                                            │ 3. Klaus and Maria discussed    │
                                            │    collaboration (0.421)        │
                                            └─────────────────────────────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│                           SCORING FORMULA                                     │
│                                                                               │
│   score = α_recency × recency + α_importance × importance + α_rel × relevance │
│                                                                               │
│   where:                                                                      │
│   • recency = 0.995^(hours_since_last_access)     [지수 감쇠]                 │
│   • importance = LLM rating (1-10 scale)          [LLM 평가]                  │
│   • relevance = cosine_similarity(mem, query)     [코사인 유사도]             │
│   • α weights = 1 (default)                                                   │
│                                                                               │
│   Final: min-max normalize to [0,1], select top-k fitting context window     │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Figure 7: Reflection Tree (Klaus Mueller 예시)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                    REFLECTION TREE - Klaus Mueller                            │
└──────────────────────────────────────────────────────────────────────────────┘

                    ┌─────────────────────────────────────┐
                    │  "Klaus Mueller is dedicated to     │  ◄── Level 3
                    │   his research on Gentrification"   │       (High-level
                    └──────────────────┬──────────────────┘        Reflection)
                                       │
              ┌────────────────────────┼────────────────────────┐
              │                        │                        │
              ▼                        ▼                        ▼
┌──────────────────────┐  ┌──────────────────────┐  ┌──────────────────────┐
│ "Klaus is writing a  │  │ "Klaus is passionate │  │ "Klaus is making    │  ◄── Level 2
│  research paper"     │  │  about his research" │  │  progress on his    │      (Mid-level
└──────────┬───────────┘  └──────────┬───────────┘  │  dissertation"      │       Reflection)
           │                         │              └──────────┬───────────┘
     ┌─────┴─────┐             ┌─────┴─────┐             ┌─────┴─────┐
     │           │             │           │             │           │
     ▼           ▼             ▼           ▼             ▼           ▼
┌─────────┐ ┌─────────┐   ┌─────────┐ ┌─────────┐   ┌─────────┐ ┌─────────┐
│ Klaus   │ │ Klaus   │   │ Klaus   │ │ Klaus   │   │ Klaus   │ │ Klaus   │  ◄── Level 1
│ is      │ │ is      │   │ men-    │ │ is      │   │ dis-    │ │ talked  │      (Observations
│ writing │ │ reading │   │ tioned  │ │ excited │   │ cussed  │ │ to his  │       = Leaf Nodes)
│ at his  │ │ books   │   │ his     │ │ about   │   │ his     │ │ advi-   │
│ desk    │ │ on      │   │ thesis  │ │ his     │   │ thesis  │ │ sor     │
│         │ │ gentri- │   │ to      │ │ findings│   │ with    │ │ about   │
│         │ │ fication│   │ Maria   │ │         │   │ Maria   │ │ his     │
│         │ │         │   │         │ │         │   │         │ │ progress│
└─────────┘ └─────────┘   └─────────┘ └─────────┘   └─────────┘ └─────────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ REFLECTION TRIGGER: sum(importance of recent events) > 150                    │
│                                                                               │
│ PROCESS:                                                                      │
│ 1. Take 100 most recent memories                                              │
│ 2. Ask LLM: "What are 3 most salient high-level questions?"                  │
│ 3. Use questions as retrieval queries                                         │
│ 4. Ask LLM: "What 5 high-level insights can you infer?"                      │
│ 5. Store reflection with pointers to source observations                      │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Planning Hierarchy (계획 계층 분해)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                         PLANNING DECOMPOSITION                                │
└──────────────────────────────────────────────────────────────────────────────┘

LEVEL 1: Daily Plan (일일 계획)
┌──────────────────────────────────────────────────────────────────────────────┐
│ Input: Agent summary + Yesterday's activities                                 │
│ Prompt: "Here is Klaus's plan today in broad strokes: 1)"                    │
│                                                                               │
│ Output (5-8 chunks):                                                          │
│ ┌────────────────────────────────────────────────────────────────┐           │
│ │ 1. Wake up and morning routine (7:00-8:00am)                   │           │
│ │ 2. Work on research at library (9:00am-12:00pm)                │           │
│ │ 3. Lunch break (12:00-1:00pm)                                  │           │
│ │ 4. Continue research and writing (1:00-5:00pm)                 │           │
│ │ 5. Dinner and evening activities (6:00-9:00pm)                 │           │
│ └────────────────────────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ decompose
                                        ▼
LEVEL 2: Hourly Plan (시간별 계획)
┌──────────────────────────────────────────────────────────────────────────────┐
│ Decompose "Work on research at library (9:00am-12:00pm)":                    │
│                                                                               │
│ ┌────────────────────────────────────────────────────────────────┐           │
│ │ 9:00am  - Review notes from yesterday                          │           │
│ │ 10:00am - Read new research papers                             │           │
│ │ 11:00am - Write draft of methodology section                   │           │
│ └────────────────────────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        │ decompose
                                        ▼
LEVEL 3: Minute-Level Actions (분 단위 행동)
┌──────────────────────────────────────────────────────────────────────────────┐
│ Decompose "Review notes from yesterday (9:00-10:00am)":                      │
│                                                                               │
│ ┌────────────────────────────────────────────────────────────────┐           │
│ │ 9:00am  - Walk to the library                                  │  (5 min)  │
│ │ 9:05am  - Find a seat and settle down                          │  (5 min)  │
│ │ 9:10am  - Open laptop and pull up notes                        │  (5 min)  │
│ │ 9:15am  - Review yesterday's research findings                 │  (20 min) │
│ │ 9:35am  - Make annotations and highlights                      │  (15 min) │
│ │ 9:50am  - Organize notes for today's work                      │  (10 min) │
│ └────────────────────────────────────────────────────────────────┘           │
└──────────────────────────────────────────────────────────────────────────────┘

 실제 시뮬레이션에서는 이 분 단위 행동들이 실행됨
```

### Reaction & Dialogue Flow (반응 및 대화 흐름)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                      REACTION & DIALOGUE SYSTEM                               │
└──────────────────────────────────────────────────────────────────────────────┘

Every simulation timestep:

┌─────────────┐      ┌──────────────────────────────────────────────────────┐
│    AGENT    │ ───► │  OBSERVATION: "Maria is approaching Klaus"           │
│   (Klaus)   │      └──────────────────────────────────────────────────────┘
└─────────────┘                              │
                                             ▼
                    ┌──────────────────────────────────────────────────────┐
                    │                   RETRIEVE CONTEXT                    │
                    │                                                       │
                    │  Query 1: "What is Klaus's relationship with Maria?" │
                    │  Query 2: "Maria is approaching Klaus"               │
                    │                                                       │
                    │  Retrieved memories:                                  │
                    │  - "Klaus and Maria are research colleagues"          │
                    │  - "Maria helped Klaus with data analysis"            │
                    │  - "Klaus enjoys talking with Maria about research"   │
                    └──────────────────────────────────────────────────────┘
                                             │
                                             ▼
                    ┌──────────────────────────────────────────────────────┐
                    │              SHOULD AGENT REACT?                      │
                    │                                                       │
                    │  LLM Prompt:                                          │
                    │  "Klaus is working on research. Maria is approaching │
                    │   Klaus. Given their relationship and Klaus's         │
                    │   current activity, should Klaus react to the         │
                    │   observation, and if so, what would be appropriate?" │
                    └──────────────────────────────────────────────────────┘
                                             │
                           ┌─────────────────┴─────────────────┐
                           ▼                                   ▼
                    ┌─────────────┐                     ┌─────────────┐
                    │    NO       │                     │    YES      │
                    │  Continue   │                     │   React!    │
                    │  current    │                     │             │
                    │  plan       │                     └──────┬──────┘
                    └─────────────┘                            │
                                                               ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                           DIALOGUE GENERATION                                 │
├──────────────────────────────────────────────────────────────────────────────┤
│                                                                               │
│  TURN 1 - Klaus (initiator):                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Context: Klaus summary + status + observation + relationship memories  │  │
│  │ Prompt: "Klaus sees Maria approaching. What would Klaus say?"          │  │
│  │ Output: "Hey Maria! How's your research coming along?"                 │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                        │
│                                      ▼                                        │
│  TURN 2 - Maria (responder):                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐  │
│  │ Context: Maria summary + status + Klaus relationship + dialogue history│  │
│  │ Prompt: "Klaus said 'Hey Maria! How's your research coming along?'     │  │
│  │          What would Maria say?"                                         │  │
│  │ Output: "Hi Klaus! It's going well. I found some interesting data..."  │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
│                                      │                                        │
│                                      ▼                                        │
│                              (Continue until one agent decides to end)        │
│                                                                               │
└──────────────────────────────────────────────────────────────────────────────┘
                                             │
                                             ▼
                    ┌──────────────────────────────────────────────────────┐
                    │              UPDATE PLAN & MEMORY                     │
                    │                                                       │
                    │  • Store dialogue as new observations in memory       │
                    │  • Re-generate plan from current moment forward       │
                    └──────────────────────────────────────────────────────┘
```

### Smallville World Structure (환경 구조)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                     SMALLVILLE - ENVIRONMENT TREE                             │
└──────────────────────────────────────────────────────────────────────────────┘

                              ┌─────────────┐
                              │  Smallville │  ◄── World (Root)
                              │   (World)   │
                              └──────┬──────┘
                                     │
       ┌─────────────┬───────────────┼───────────────┬─────────────┐
       │             │               │               │             │
       ▼             ▼               ▼               ▼             ▼
┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐
│   Cafe    │ │  Library  │ │   Park    │ │  Houses   │ │   Dorm    │  ◄── Areas
└─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘
      │             │             │             │             │
   ┌──┴──┐       ┌──┴──┐       ┌──┴──┐       ┌──┴──┐       ┌──┴──┐
   │     │       │     │       │     │       │     │       │     │
   ▼     ▼       ▼     ▼       ▼     ▼       ▼     ▼       ▼     ▼
┌─────┐┌────┐ ┌─────┐┌────┐ ┌─────┐┌────┐ ┌─────┐┌────┐ ┌─────┐┌────┐
│Table││Bar │ │Desk ││Book│ │Bench││Tree│ │Bed  ││Desk│ │Bed  ││Desk│  ◄── Objects
└─────┘└────┘ └─────┘│Shelf└─────┘└────┘ └─────┘└────┘ └─────┘└────┘
                     └────┘

┌──────────────────────────────────────────────────────────────────────────────┐
│ 각 에이전트는 자신이 관찰한 세계의 일부(subgraph)만 메모리에 저장함            │
│                                                                               │
│ 예: Klaus가 Library만 방문했다면 Klaus의 world knowledge:                     │
│     Smallville → Library → [Desk, Bookshelf]                                 │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Information Diffusion Example (정보 확산 예시)

```
┌──────────────────────────────────────────────────────────────────────────────┐
│           INFORMATION DIFFUSION - Valentine's Day Party                       │
└──────────────────────────────────────────────────────────────────────────────┘

Day 1, Morning:
                              ┌──────────────┐
                              │   Isabella   │
                              │   (Host)     │
                              │ "I want to   │
                              │  throw a     │
                              │  Valentine's │
                              │  party!"     │
                              └──────┬───────┘
                                     │ tells
                    ┌────────────────┼────────────────┐
                    ▼                ▼                ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │   Tom    │    │  Maria   │    │  Klaus   │
              └────┬─────┘    └────┬─────┘    └────┬─────┘
                   │               │               │
Day 1, Afternoon:  │ tells         │ tells         │ tells
                   ▼               ▼               ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │  John    │    │  Eddy    │    │  Sam     │
              └────┬─────┘    └────┬─────┘    └────┬─────┘
                   │               │               │
Day 2:             │               │               │
                   ▼               ▼               ▼
              ┌──────────┐    ┌──────────┐    ┌──────────┐
              │  Mei     │    │ Jennifer │    │ Wolfgang │
              └──────────┘    └──────────┘    └──────────┘
                   ⋮               ⋮               ⋮

┌──────────────────────────────────────────────────────────────────────────────┐
│ 결과: 2 게임 일 후, 25명 중 12명이 파티에 대해 알게 됨                         │
│                                                                               │
│ 창발적 행동:                                                                  │
│ • 에이전트들이 자발적으로 초대장을 전달                                        │
│ • 새로운 관계 형성                                                            │
│ • 서로에게 파티 데이트 신청                                                    │
│ • 정해진 시간에 함께 파티에 참석                                              │
└──────────────────────────────────────────────────────────────────────────────┘
```

---

## 컴포넌트 상세 설명

## 1. Memory Stream (메모리 스트림)

에이전트의 모든 경험을 **자연어**로 저장하는 장기 기억 데이터베이스입니다.

### 메모리 객체 구조
각 메모리는 다음을 포함합니다:
- **자연어 설명**: 이벤트에 대한 설명
- **생성 타임스탬프**: 메모리가 생성된 시간
- **최근 접근 타임스탬프**: 마지막으로 접근한 시간

### 메모리 타입
| 타입 | 설명 | 예시 |
|------|------|------|
| **Observations** | 직접 인지한 것 | "Isabella Rodriguez is setting out pastries" |
| **Reflections** | 관찰에서 추론한 상위 수준 인사이트 | "Klaus Mueller is dedicated to his research" |
| **Plans** | 미래 행동 계획 (위치, 시작 시간, 지속 시간 포함) | "1:00pm: brainstorm composition ideas" |

---

## 2. Retrieval (검색/회수)

현재 상황에 관련된 메모리를 찾아오는 메커니즘입니다.

### 검색 점수 공식

```
score = α_recency × recency + α_importance × importance + α_relevance × relevance
```

모든 α 가중치는 기본값 **1**입니다.

### 세 가지 스코어링 요소

#### 2.1 Recency (최신성)
- 최근에 접근한 메모리에 높은 점수 부여
- **지수 감쇠(Exponential Decay)** 사용
- 감쇠 계수: **0.995** (게임 내 시간 단위)

```python
recency_score = 0.995 ^ (hours_since_last_access)
```

#### 2.2 Importance (중요도)
- LLM에 직접 물어서 **1-10점** 척도로 평가
- 1점: 일상적인 일 (예: 양치질)
- 10점: 매우 중요한 일 (예: 이별, 대학 입학)

```
프롬프트 예시:
"On the scale of 1 to 10, where 1 is purely mundane (e.g., brushing teeth)
and 10 is extremely poignant (e.g., a break up), rate the likely poignancy
of the following piece of memory."
```

#### 2.3 Relevance (관련성)
- **코사인 유사도(Cosine Similarity)** 사용
- 메모리 설명의 임베딩 벡터와 쿼리 컨텍스트 비교

```python
relevance_score = cosine_similarity(memory_embedding, query_embedding)
```

### 최종 처리
1. 모든 점수를 **min-max 정규화**로 [0,1] 범위로 변환
2. 상위 랭킹 메모리 중 **컨텍스트 윈도우에 맞는 만큼** 선택

---

## 3. Reflection (반성/성찰)

메모리를 상위 수준의 추상적 인사이트로 합성하는 메커니즘입니다.

### 트리거 조건
- 최근 인지한 이벤트들의 **중요도 합계가 임계값(150)을 초과**할 때
- 보통 하루에 **2-3회** 발생

### 반성 프로세스

```
Step 1: 질문 생성
┌────────────────────────────────────────────────────────────┐
│ 최근 100개 메모리 → LLM에 전달                              │
│ "Given only the information above, what are 3 most        │
│  salient high-level questions we can answer about         │
│  the subjects?"                                            │
└────────────────────────────────────────────────────────────┘
                          ↓
Step 2: 관련 메모리 검색
┌────────────────────────────────────────────────────────────┐
│ 생성된 질문들을 쿼리로 사용하여 관련 메모리 검색             │
└────────────────────────────────────────────────────────────┘
                          ↓
Step 3: 인사이트 추출
┌────────────────────────────────────────────────────────────┐
│ "What 5 high-level insights can you infer from            │
│  the above statements?"                                    │
│ → 근거 인용과 함께 인사이트 생성                            │
└────────────────────────────────────────────────────────────┘
                          ↓
Step 4: 저장
┌────────────────────────────────────────────────────────────┐
│ 반성 결과를 메모리 스트림에 저장                            │
│ (원본 관찰들에 대한 포인터 포함)                            │
└────────────────────────────────────────────────────────────┘
```

### 반성의 계층 구조
```
        [상위 수준 반성]
              │
    ┌─────────┴─────────┐
    │                   │
[하위 반성]         [하위 반성]
    │                   │
┌───┴───┐           ┌───┴───┐
│       │           │       │
[관찰] [관찰]       [관찰] [관찰]
```

---

## 4. Planning (계획 수립)

계획을 **계층적으로 분해**하여 고수준에서 저수준 행동으로 변환합니다.

### 3단계 계층 구조

#### Level 1: 일일 아젠다 (Daily Agenda)
- 에이전트 요약 + 전날 활동을 프롬프트로 사용
- **5-8개의 큰 덩어리**로 하루 계획 생성

```
프롬프트: "{Intro of an agent X}. Here is X's plan today in broad strokes: 1)"

예시 출력:
1. wake up at 7am
2. attend classes 10am-12pm
3. work on composition 1-5pm
4. dinner with friends 6-7pm
```

#### Level 2: 시간별 분해 (Hourly Breakdown)
- 각 큰 덩어리를 **1시간 단위** 활동으로 분해

```
예시:
1:00pm: brainstorm composition ideas
2:00pm: write melody drafts
3:00pm: refine harmonies
4:00pm: take break
```

#### Level 3: 분 단위 행동 (Minute-Level Actions)
- **5-15분 단위**의 세부 행동으로 분해

```
예시:
4:00pm: grab snack
4:05pm: take short walk
4:15pm: check messages
4:30pm: rest
4:50pm: clean workspace
```

---

## 5. Reaction & Dialogue (반응 및 대화)

### 반응 메커니즘

매 시뮬레이션 타임스텝마다:

```
1. 에이전트가 관찰을 인지
2. 시스템이 LLM에 질문:
   "Should [Agent] react to the observation,
    and if so, what would be an appropriate reaction?"

3. 컨텍스트로 제공되는 정보:
   - 에이전트 요약
   - 현재 상태
   - 관찰 내용
   - 관련 메모리 (관계, 행동 관련성 등)

4. 반응 결정 시 → 해당 시점부터 계획 재생성
```

### 대화 생성

```
Speaker 1 (대화 시작):
┌─────────────────────────────────────────────────────────────┐
│ 입력: 에이전트 요약 + 상태 + 관찰 + 관계 요약               │
│ 프롬프트: "John is asking Eddy about his composition       │
│           project. What would he say?"                      │
└─────────────────────────────────────────────────────────────┘
                            ↓
Speaker 2 (응답):
┌─────────────────────────────────────────────────────────────┐
│ 입력: 에이전트 요약 + 상태 + 관찰 + Speaker 1과의 관계      │
│       + 대화 히스토리                                       │
│ → 응답 생성                                                 │
└─────────────────────────────────────────────────────────────┘
                            ↓
                    (반복, 한 쪽이 종료 결정할 때까지)
```

---

## 기술 구현

### 사용 기술
- **LLM**: GPT-3.5
- **Backend**: Python 3.9.12
- **Frontend**: Django
- **지도 에디터**: Tiled (게임 맵 편집)

### 시스템 구조
```
generative_agents/
├── reverie/
│   └── backend_server/
│       └── reverie.py          # 핵심 시뮬레이션 서버
├── environment/
│   └── frontend_server/
│       ├── static_dirs/assets/ # 게임 에셋
│       └── storage/            # 시뮬레이션 데이터
└── utils.py                    # OpenAI API 설정
```

### 시뮬레이션 실행
- 1 step = 10 게임 초
- `run <step-count>` 명령으로 실행

---

## 검증 결과 (Ablation Study)

각 컴포넌트가 **에이전트 행동의 believability에 중요하게 기여**함을 확인:

| 컴포넌트 | 제거 시 영향 |
|----------|-------------|
| Observation | 상황 인식 능력 저하 |
| Planning | 일관성 없는 행동 (예: 점심을 여러 번 먹음) |
| Reflection | 장기적 목표 추구 능력 저하 |

### 주요 오류 유형
1. 관련 메모리 검색 실패
2. 메모리에 없는 내용 지어냄 (embellishment)
3. LLM으로부터 물려받은 지나치게 격식체 언어

---

## 창발적 행동 예시

단일 시드 설정: "Isabella wants to throw a Valentine's Day party"

→ 에이전트들이 자발적으로:
1. 파티 초대장을 돌림
2. 새로운 사람들과 친해짐
3. 서로에게 파티 데이트 신청
4. 정해진 시간에 함께 파티에 참석

---

## 참고 자료

- [arXiv 논문](https://arxiv.org/abs/2304.03442)
- [GitHub 저장소](https://github.com/joonspk-research/generative_agents)
- [ACM 정식 출판](https://dl.acm.org/doi/10.1145/3586183.3606763)
- [Stanford HAI 기사](https://hai.stanford.edu/news/computational-agents-exhibit-believable-humanlike-behavior)
- [Lil'Log - LLM Powered Autonomous Agents](https://lilianweng.github.io/posts/2023-06-23-agent/)
