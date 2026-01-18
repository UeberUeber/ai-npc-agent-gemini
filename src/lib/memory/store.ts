/**
 * MemoryStore - NPC 메모리 저장 및 검색 시스템
 *
 * Generative Agents 논문의 Memory Stream + Retrieval 구현입니다.
 *
 * 주요 기능:
 * 1. add() - 새 메모리를 memories.jsonl에 추가
 * 2. retrieve() - 쿼리와 관련된 메모리를 스코어링하여 검색
 * 3. getAll() - 모든 메모리 로드
 *
 * 검색 스코어 공식 (논문 기반):
 *   score = α × recency + β × importance + γ × relevance
 *
 *   - recency: 0.995^(hours_since_last_access) - 최근 접근할수록 높음
 *   - importance: LLM이 평가한 1-10 점수를 0-1로 정규화
 *   - relevance: 쿼리와 메모리 내용의 키워드 매칭 (임베딩 대신 간단 구현)
 */

import * as fs from 'fs';
import * as path from 'path';
import { Memory, RetrievedMemory, AddMemoryInput } from './types';
import { gemini } from '../../api/gemini';

/** 스코어링 가중치 (논문 기본값: 모두 1) */
const WEIGHTS = {
  recency: 1,
  importance: 1,
  relevance: 1,
};

/** Recency 감쇠 계수 (논문: 0.995) */
const RECENCY_DECAY = 0.995;

export class MemoryStore {
  private npcId: string;
  private memoriesPath: string;
  private memories: Memory[] = [];

  /**
   * MemoryStore 생성자
   *
   * @param npcId - NPC 식별자 (예: "blacksmith_john")
   *                해당 NPC의 data/npcs/{npcId}/memories.jsonl 파일을 사용합니다.
   */
  constructor(npcId: string) {
    this.npcId = npcId;
    this.memoriesPath = path.join(
      process.cwd(),
      'data',
      'npcs',
      npcId,
      'memories.jsonl'
    );
    this.loadMemories();
  }

  /**
   * memories.jsonl 파일에서 모든 메모리를 로드합니다.
   * JSONL 형식: 한 줄에 하나의 JSON 객체
   */
  private loadMemories(): void {
    try {
      if (!fs.existsSync(this.memoriesPath)) {
        this.memories = [];
        return;
      }

      const content = fs.readFileSync(this.memoriesPath, 'utf-8');
      const lines = content.split('\n').filter((line) => line.trim());

      this.memories = lines.map((line) => JSON.parse(line) as Memory);
    } catch (error) {
      console.error(`[MemoryStore] 메모리 로드 실패 (${this.npcId}):`, error);
      this.memories = [];
    }
  }

  /**
   * 새 메모리를 추가합니다.
   *
   * @param input - 추가할 메모리 정보
   * @returns 생성된 메모리 객체
   *
   * 동작:
   * 1. 고유 ID 생성 (m001, m002, ...)
   * 2. 중요도가 없으면 LLM에게 평가 요청
   * 3. 타임스탬프 추가
   * 4. memories.jsonl 파일에 한 줄 추가
   * 5. 메모리 배열에도 추가 (캐시)
   */
  async add(input: AddMemoryInput): Promise<Memory> {
    // 고유 ID 생성
    const id = `m${String(this.memories.length + 1).padStart(3, '0')}`;
    const now = new Date().toISOString();

    // 중요도 평가 (없으면 LLM에게 요청)
    let importance = input.importance;
    if (importance === undefined) {
      importance = await gemini.rateImportance(input.content);
    }

    const memory: Memory = {
      id,
      type: input.type,
      content: input.content,
      timestamp: now,
      importance,
      lastAccess: now,
      ...(input.sources && { sources: input.sources }),
    };

    // 파일에 추가 (JSONL: 한 줄에 하나)
    const line = JSON.stringify(memory) + '\n';
    fs.appendFileSync(this.memoriesPath, line, 'utf-8');

    // 메모리 캐시에도 추가
    this.memories.push(memory);

    console.log(
      `[MemoryStore] 메모리 추가: ${id} (importance: ${importance})`
    );

    return memory;
  }

  /**
   * 쿼리와 관련된 메모리를 검색합니다.
   *
   * @param query - 검색 쿼리 (예: "철광석", "손님과의 대화")
   * @param topK - 반환할 최대 메모리 개수 (기본값: 5)
   * @returns 점수가 높은 순으로 정렬된 메모리 배열
   *
   * 스코어링:
   *   score = recency × importance × relevance
   *
   *   - recency: 최근에 접근한 메모리일수록 높음 (지수 감쇠)
   *   - importance: LLM이 평가한 중요도 (1-10 → 0-1 정규화)
   *   - relevance: 쿼리와 메모리 내용의 키워드 겹침 정도
   */
  retrieve(query: string, topK: number = 5): RetrievedMemory[] {
    if (this.memories.length === 0) {
      return [];
    }

    const now = new Date();

    // 각 메모리에 점수 계산
    const scored: RetrievedMemory[] = this.memories.map((memory) => {
      // 1. Recency 점수: 0.995^(hours_since_last_access)
      const lastAccess = new Date(memory.lastAccess);
      const hoursSinceAccess =
        (now.getTime() - lastAccess.getTime()) / (1000 * 60 * 60);
      const recencyScore = Math.pow(RECENCY_DECAY, hoursSinceAccess);

      // 2. Importance 점수: 1-10 → 0-1 정규화
      const importanceScore = memory.importance / 10;

      // 3. Relevance 점수: 간단한 키워드 매칭
      //    (실제 구현에서는 임베딩 코사인 유사도 사용)
      const relevanceScore = this.calculateRelevance(query, memory.content);

      // 가중합 계산
      const totalScore =
        WEIGHTS.recency * recencyScore +
        WEIGHTS.importance * importanceScore +
        WEIGHTS.relevance * relevanceScore;

      return {
        ...memory,
        score: totalScore,
        scoreBreakdown: {
          recency: recencyScore,
          importance: importanceScore,
          relevance: relevanceScore,
        },
      };
    });

    // 점수 높은 순 정렬 후 상위 K개 반환
    scored.sort((a, b) => b.score - a.score);
    const topMemories = scored.slice(0, topK);

    // 검색된 메모리의 lastAccess 업데이트
    this.updateLastAccess(topMemories.map((m) => m.id));

    return topMemories;
  }

  /**
   * 쿼리와 메모리 내용의 관련성 점수를 계산합니다.
   *
   * 현재 구현: 간단한 키워드 매칭
   * - 쿼리를 단어로 분리
   * - 메모리 내용에 포함된 단어 비율 계산
   *
   * TODO: 임베딩 기반 코사인 유사도로 개선
   */
  private calculateRelevance(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentLower = content.toLowerCase();

    let matchCount = 0;
    for (const word of queryWords) {
      if (word.length > 1 && contentLower.includes(word)) {
        matchCount++;
      }
    }

    return queryWords.length > 0 ? matchCount / queryWords.length : 0;
  }

  /**
   * 메모리의 lastAccess 시간을 현재 시간으로 업데이트합니다.
   * retrieve()에서 검색된 메모리들에 대해 호출됩니다.
   */
  private updateLastAccess(memoryIds: string[]): void {
    const now = new Date().toISOString();

    for (const id of memoryIds) {
      const memory = this.memories.find((m) => m.id === id);
      if (memory) {
        memory.lastAccess = now;
      }
    }

    // 파일 전체 다시 쓰기 (lastAccess 업데이트 반영)
    this.saveAllMemories();
  }

  /**
   * 모든 메모리를 파일에 다시 저장합니다.
   */
  private saveAllMemories(): void {
    const content = this.memories.map((m) => JSON.stringify(m)).join('\n') + '\n';
    fs.writeFileSync(this.memoriesPath, content, 'utf-8');
  }

  /**
   * 모든 메모리를 반환합니다.
   */
  getAll(): Memory[] {
    return [...this.memories];
  }

  /**
   * 메모리 개수를 반환합니다.
   */
  count(): number {
    return this.memories.length;
  }

  /**
   * 최근 중요도 합계를 계산합니다.
   * Reflection 트리거 조건 확인용 (합계 > 150이면 반성 생성)
   *
   * @param recentCount - 최근 몇 개의 메모리를 볼지 (기본값: 100)
   */
  getRecentImportanceSum(recentCount: number = 100): number {
    const recent = this.memories.slice(-recentCount);
    return recent.reduce((sum, m) => sum + m.importance, 0);
  }
}
