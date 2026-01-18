/**
 * 브라우저용 MemoryStore
 *
 * localStorage에 메모리를 저장합니다.
 * 나중에 Firestore로 쉽게 교체할 수 있도록 인터페이스를 동일하게 유지합니다.
 */

export type MemoryType = 'observation' | 'reflection' | 'plan' | 'knowledge';

export interface Memory {
  id: string;
  type: MemoryType;
  content: string;
  timestamp: string;
  importance?: number; // 미평가 시 undefined, 10개 대화 후 LLM이 1-10 평가
  lastAccess: string;
  sources?: string[];
}

export interface RetrievedMemory extends Memory {
  score: number;
}

const RECENCY_DECAY = 0.995;

export class MemoryStore {
  private npcId: string;
  private storageKey: string;

  constructor(npcId: string) {
    this.npcId = npcId;
    this.storageKey = `npc_memories_${npcId}`;
  }

  /**
   * localStorage에서 메모리 로드
   */
  private loadMemories(): Memory[] {
    const data = localStorage.getItem(this.storageKey);
    return data ? JSON.parse(data) : [];
  }

  /**
   * localStorage에 메모리 저장
   */
  private saveMemories(memories: Memory[]): void {
    localStorage.setItem(this.storageKey, JSON.stringify(memories));
  }

  /**
   * 새 메모리 추가
   * 중요도는 판단하지 않고 저장 (10개 쌓이면 LLM으로 일괄 평가)
   */
  add(input: {
    type: MemoryType;
    content: string;
    importance?: number;
    sources?: string[];
  }): Memory {
    const memories = this.loadMemories();
    const now = new Date().toISOString();

    // 중요도: 제공되면 사용, 아니면 미평가(undefined)
    const importance = input.importance;

    const memory: Memory = {
      id: `m${String(memories.length + 1).padStart(3, '0')}`,
      type: input.type,
      content: input.content,
      timestamp: now,
      importance,
      lastAccess: now,
      ...(input.sources && { sources: input.sources }),
    };

    memories.push(memory);
    this.saveMemories(memories);

    return memory;
  }

  /**
   * 관련 메모리 검색
   */
  retrieve(query: string, topK: number = 5): RetrievedMemory[] {
    const memories = this.loadMemories();
    if (memories.length === 0) return [];

    const now = new Date();

    const scored: RetrievedMemory[] = memories.map((memory) => {
      // Recency
      const lastAccess = new Date(memory.lastAccess);
      const hoursSince = (now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60);
      const recency = Math.pow(RECENCY_DECAY, hoursSince);

      // Importance (정규화) - 미평가 시 기본 0.5 (중간값)
      const importance = (memory.importance ?? 5) / 10;

      // Relevance (간단한 키워드 매칭)
      const queryWords = query.toLowerCase().split(/\s+/);
      const contentLower = memory.content.toLowerCase();
      let matchCount = 0;
      for (const word of queryWords) {
        if (word.length > 1 && contentLower.includes(word)) matchCount++;
      }
      const relevance = queryWords.length > 0 ? matchCount / queryWords.length : 0;

      const score = recency + importance + relevance;

      return { ...memory, score };
    });

    // 정렬 및 상위 K개 반환
    scored.sort((a, b) => b.score - a.score);
    const topMemories = scored.slice(0, topK);

    // lastAccess 업데이트
    const allMemories = this.loadMemories();
    const topIds = new Set(topMemories.map((m) => m.id));
    for (const memory of allMemories) {
      if (topIds.has(memory.id)) {
        memory.lastAccess = now.toISOString();
      }
    }
    this.saveMemories(allMemories);

    return topMemories;
  }

  /**
   * 모든 메모리 반환
   */
  getAll(): Memory[] {
    return this.loadMemories();
  }

  /**
   * 메모리 개수
   */
  count(): number {
    return this.loadMemories().length;
  }

  /**
   * 메모리 중요도 업데이트
   */
  updateImportance(id: string, importance: number): void {
    const memories = this.loadMemories();
    const memory = memories.find((m) => m.id === id);
    if (memory) {
      memory.importance = importance;
      this.saveMemories(memories);
    }
  }

  /**
   * 최근 중요도 합계 (Reflection 트리거 체크용)
   */
  getRecentImportanceSum(count: number = 20): number {
    const memories = this.loadMemories();
    return memories.slice(-count).reduce((sum, m) => sum + (m.importance ?? 5), 0);
  }

  /**
   * 특정 타입의 메모리만 반환
   */
  getByType(type: MemoryType): Memory[] {
    return this.loadMemories().filter(m => m.type === type);
  }

  /**
   * 지식(knowledge) 메모리만 반환
   * Planning 시 사용 가능한 활동/장소 파악용
   */
  getKnowledge(): Memory[] {
    return this.getByType('knowledge');
  }

  /**
   * 지식 메모리가 이미 있는지 확인 (중복 방지)
   */
  hasKnowledge(content: string): boolean {
    const knowledge = this.getKnowledge();
    return knowledge.some(k => k.content.includes(content));
  }

  /**
   * 메모리 초기화
   */
  clear(): void {
    localStorage.removeItem(this.storageKey);
  }
}
