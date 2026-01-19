# 핵심 요구사항 및 구현 매핑

## 개발요건

1. **페르소나/환경/대화 히스토리/기억을 통합한 AI NPC 발화·행동 생성 엔진 개발**
2. **게임 지식과 NPC 경험 기반 장·단기 기억 저장 및 색인·추출 알고리즘 연구**
3. **심리/감정/의도 추론 기반 NPC 자율 발화 및 의사결정 모델 개발**
4. **LLM 기반 NPC 대화 모델 Fine-tuning, Prompt Engineering, RLHF 적용을 통한 대화 성능 향상**
5. **RAG 및 LLM 기반 지능형 에이전트/대화 시스템 설계 및 개발**
6. **AI 시스템 아키텍처 설계 및 대화형 인터페이스 구현**

---

## 구현 매핑 (Generative Agents 기반)

| 개발요건 | 구현 컴포넌트 | 파일/모듈 |
|------------|--------------|----------|
| 페르소나/환경/대화히스토리/기억 통합 | Persona + Memory Stream + Retrieval | `persona.json` + `memories.jsonl` + `MemoryStore` |
| 장단기 기억 저장 및 색인/추출 | Memory Stream + Retrieval 스코어링 (Recency × Importance × Relevance) | `src/lib/memory/store.ts` |
| 심리/감정/의도 추론 | Reflection 시스템 + 감정 상태 추적 | `src/lib/npc/personality.ts` + `scratch.json` |
| NPC 자율 발화 및 의사결정 | Planning + Reaction 시스템 | `src/lib/npc/agent.ts` |
| RAG 기반 대화 시스템 | 메모리 검색 → LLM 컨텍스트 주입 | `MemoryStore.retrieve()` → `GeminiClient` |
| Prompt Engineering | 각 기능별 프롬프트 설계 | `src/api/gemini.ts` 내 프롬프트들 |

---

## 핵심 아키텍처 (Generative Agents 논문 기반)

### 데이터 구조
```
data/npcs/{npc_id}/
├── persona.json      # 고정 정체성 (이름, 직업, 성격, 배경)
├── memories.jsonl    # 장기 기억 (관찰/반성/계획 - 누적)
└── scratch.json      # 현재 상태 (위치, 행동, 오늘 계획 - 덮어씀)
```

### 메모리 검색 공식
```
score = α_recency × recency + α_importance × importance + α_relevance × relevance

- recency: 0.995^(hours_since_last_access) - 지수 감쇠
- importance: LLM이 평가한 1-10 점수
- relevance: 코사인 유사도 (임베딩 기반)
```

### 핵심 프로세스
1. **Observation** → 환경 인지, 메모리에 저장
2. **Retrieval** → 현재 상황에 관련된 메모리 검색
3. **Reflection** → 중요도 합계 > 150 시 상위 인사이트 생성
4. **Planning** → 일일 → 시간별 → 분 단위 계획 분해
5. **Reaction** → 관찰에 반응할지 결정, 대화 생성

---

## 면접 시연 포인트

1. **RAG 구현**: 메모리 검색 알고리즘 (Recency/Importance/Relevance 스코어링)
2. **프롬프트 엔지니어링**: 각 기능별 프롬프트 설계 및 최적화
3. **에이전트 아키텍처**: Generative Agents 논문 기반 설계
4. **실제 동작 데모**: 대장장이 NPC와 대화, 기억 축적, 반성 생성
