/**
 * Memory Types
 *
 * Generative Agents 논문의 Memory Stream 구조를 정의합니다.
 * 각 메모리는 관찰(observation), 반성(reflection), 계획(plan) 중 하나입니다.
 */

/**
 * 메모리 타입 구분
 * - observation: NPC가 직접 경험하거나 관찰한 것 (예: "손님이 검에 대해 물었다")
 * - reflection: 관찰들로부터 추론한 상위 수준 인사이트 (예: "이 손님은 무기에 관심이 많다")
 * - plan: 미래 행동 계획 (예: "내일 아침에 철광석 주문해야겠다")
 */
export type MemoryType = 'observation' | 'reflection' | 'plan';

/**
 * 단일 메모리 레코드
 *
 * memories.jsonl 파일에 한 줄씩 JSON으로 저장됩니다.
 */
export interface Memory {
  /** 고유 식별자 (예: "m001", "m002") */
  id: string;

  /** 메모리 타입 */
  type: MemoryType;

  /** 메모리 내용 (자연어 설명) */
  content: string;

  /** 생성 시간 (ISO 8601 형식) */
  timestamp: string;

  /**
   * 중요도 점수 (1-10)
   * - 1: 일상적인 일 (양치질, 식사)
   * - 10: 매우 중요한 일 (큰 거래 성사, 중요한 만남)
   * LLM이 평가합니다.
   */
  importance: number;

  /** 마지막으로 이 메모리를 검색/사용한 시간 (Recency 계산용) */
  lastAccess: string;

  /**
   * reflection 타입인 경우, 이 반성의 근거가 된 메모리 ID들
   * 예: ["m001", "m002", "m003"]
   */
  sources?: string[];
}

/**
 * 메모리 검색 결과
 *
 * retrieve() 함수가 반환하는 형태입니다.
 * 원본 메모리에 검색 점수가 추가됩니다.
 */
export interface RetrievedMemory extends Memory {
  /**
   * 검색 점수 (0-1 범위로 정규화됨)
   * score = α × recency + β × importance + γ × relevance
   */
  score: number;

  /** 개별 점수 상세 (디버깅/분석용) */
  scoreBreakdown: {
    recency: number;    // 최신성 점수
    importance: number; // 중요도 점수 (정규화됨)
    relevance: number;  // 관련성 점수 (쿼리와의 유사도)
  };
}

/**
 * 메모리 추가 시 입력 파라미터
 */
export interface AddMemoryInput {
  /** 메모리 타입 */
  type: MemoryType;

  /** 메모리 내용 */
  content: string;

  /**
   * 중요도 (선택사항)
   * 제공하지 않으면 LLM이 자동으로 평가합니다.
   */
  importance?: number;

  /** reflection인 경우 근거 메모리 ID들 */
  sources?: string[];
}
