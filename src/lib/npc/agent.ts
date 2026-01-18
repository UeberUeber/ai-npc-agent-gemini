/**
 * NPC Agent - NPC 대화 및 행동 생성 시스템
 *
 * Generative Agents 아키텍처의 핵심 컴포넌트입니다.
 *
 * 대화 흐름:
 * 1. 사용자 입력 받음
 * 2. MemoryStore에서 관련 기억 검색 (Retrieval)
 * 3. Persona + Scratch + 기억을 조합하여 프롬프트 생성
 * 4. LLM에게 응답 요청
 * 5. 대화 내용을 새 기억으로 저장
 * 6. 응답 반환
 */

import * as fs from 'fs';
import * as path from 'path';
import { Persona, Scratch, ChatMessage } from './types';
import { MemoryStore } from '../memory/store';
import { RetrievedMemory } from '../memory/types';
import { gemini } from '../../api/gemini';

export class NPCAgent {
  private npcId: string;
  private persona: Persona;
  private scratch: Scratch;
  private memoryStore: MemoryStore;
  private conversationHistory: ChatMessage[] = [];

  /**
   * NPCAgent 생성자
   *
   * @param npcId - NPC 식별자 (예: "blacksmith_john")
   *
   * 초기화 시 해당 NPC의 persona.json, scratch.json, memories.jsonl을 로드합니다.
   */
  constructor(npcId: string) {
    this.npcId = npcId;
    this.persona = this.loadPersona();
    this.scratch = this.loadScratch();
    this.memoryStore = new MemoryStore(npcId);

    console.log(`[NPCAgent] ${this.persona.name} 초기화 완료`);
    console.log(`  - 메모리 수: ${this.memoryStore.count()}`);
    console.log(`  - 현재 활동: ${this.scratch.currentActivity}`);
  }

  /**
   * persona.json 파일을 로드합니다.
   */
  private loadPersona(): Persona {
    const personaPath = path.join(
      process.cwd(),
      'data',
      'npcs',
      this.npcId,
      'persona.json'
    );

    const content = fs.readFileSync(personaPath, 'utf-8');
    return JSON.parse(content) as Persona;
  }

  /**
   * scratch.json 파일을 로드합니다.
   */
  private loadScratch(): Scratch {
    const scratchPath = path.join(
      process.cwd(),
      'data',
      'npcs',
      this.npcId,
      'scratch.json'
    );

    const content = fs.readFileSync(scratchPath, 'utf-8');
    return JSON.parse(content) as Scratch;
  }

  /**
   * scratch.json 파일을 저장합니다.
   */
  private saveScratch(): void {
    const scratchPath = path.join(
      process.cwd(),
      'data',
      'npcs',
      this.npcId,
      'scratch.json'
    );

    fs.writeFileSync(scratchPath, JSON.stringify(this.scratch, null, 2), 'utf-8');
  }

  /**
   * 사용자와 대화합니다.
   *
   * @param userMessage - 사용자가 한 말
   * @returns NPC의 응답
   *
   * 동작 순서:
   * 1. 사용자 메시지와 관련된 기억 검색 (Retrieval)
   * 2. 시스템 프롬프트 생성 (Persona + Scratch + 기억 + 대화 히스토리)
   * 3. LLM에게 응답 요청
   * 4. 대화 내용을 메모리에 저장 (관찰로 기록)
   * 5. 대화 히스토리 업데이트
   */
  async chat(userMessage: string): Promise<string> {
    // 1. 관련 기억 검색
    const relevantMemories = this.memoryStore.retrieve(userMessage, 5);

    // 2. 프롬프트 생성
    const prompt = this.buildPrompt(userMessage, relevantMemories);

    // 3. LLM 응답 생성
    let response: string;
    try {
      response = await gemini.generate(prompt);
    } catch (error) {
      console.error('[NPCAgent] LLM 응답 생성 실패:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      response = `(잠시 생각에 잠긴다)... 뭐라고 했지? (${errorMsg})`;
    }

    // 4. 대화 내용을 메모리에 저장
    const now = new Date().toISOString();

    // 사용자 발화를 관찰로 저장
    await this.memoryStore.add({
      type: 'observation',
      content: `손님이 말했다: "${userMessage}"`,
    });

    // NPC 응답을 관찰로 저장
    await this.memoryStore.add({
      type: 'observation',
      content: `나는 손님에게 말했다: "${response}"`,
    });

    // 5. 대화 히스토리 업데이트
    this.conversationHistory.push({
      speaker: 'user',
      content: userMessage,
      timestamp: now,
    });

    this.conversationHistory.push({
      speaker: this.npcId,
      content: response,
      timestamp: now,
    });

    return response;
  }

  /**
   * LLM에 전달할 프롬프트를 구성합니다.
   *
   * 프롬프트 구조:
   * 1. NPC 정체성 (이름, 직업, 성격, 배경)
   * 2. 현재 상태 (위치, 활동, 감정, 시간)
   * 3. 관련 기억들
   * 4. 최근 대화 히스토리
   * 5. 사용자의 현재 발화
   * 6. 응답 지침 (말투, 길이 등)
   */
  private buildPrompt(
    userMessage: string,
    relevantMemories: RetrievedMemory[]
  ): string {
    // 1. NPC 정체성
    const identitySection = `## 당신의 정체
이름: ${this.persona.name}
나이: ${this.persona.age}세
직업: ${this.persona.occupation}
성격: ${this.persona.traits.join(', ')}
배경: ${this.persona.backstory}
현재 목표: ${this.persona.currentGoals.join(' / ')}
말투: ${this.persona.speechStyle}`;

    // 2. 현재 상태
    const stateSection = `## 현재 상태
위치: ${this.scratch.currentLocation}
하고 있는 일: ${this.scratch.currentActivity}
기분: ${this.scratch.currentMood}
시간: ${this.scratch.currentTime}`;

    // 3. 관련 기억
    let memoriesSection = '## 관련 기억\n';
    if (relevantMemories.length > 0) {
      memoriesSection += relevantMemories
        .map((m) => `- ${m.content} (중요도: ${m.importance})`)
        .join('\n');
    } else {
      memoriesSection += '(관련된 기억 없음)';
    }

    // 4. 대화 히스토리 (최근 6개)
    let historySection = '## 최근 대화\n';
    const recentHistory = this.conversationHistory.slice(-6);
    if (recentHistory.length > 0) {
      historySection += recentHistory
        .map((msg) => {
          const speaker = msg.speaker === 'user' ? '손님' : this.persona.name;
          return `${speaker}: ${msg.content}`;
        })
        .join('\n');
    } else {
      historySection += '(이전 대화 없음 - 손님이 방금 들어왔다)';
    }

    // 5. 현재 발화
    const currentSection = `## 손님의 말
"${userMessage}"`;

    // 6. 응답 지침
    const instructionSection = `## 응답 지침
- 당신은 ${this.persona.name}입니다. 위 정체성과 상태에 맞게 대답하세요.
- 말투: ${this.persona.speechStyle}
- 1-3문장으로 짧게 대답하세요.
- 관련 기억이 있으면 자연스럽게 언급할 수 있습니다.
- 현재 하던 일(${this.scratch.currentActivity})을 하면서 대화하는 것처럼 반응하세요.
- 대화 내용만 출력하세요. 행동 묘사나 따옴표는 넣지 마세요.`;

    return [
      identitySection,
      stateSection,
      memoriesSection,
      historySection,
      currentSection,
      instructionSection,
    ].join('\n\n');
  }

  /**
   * NPC 이름을 반환합니다.
   */
  getName(): string {
    return this.persona.name;
  }

  /**
   * 현재 상태(Scratch)를 반환합니다.
   */
  getScratch(): Scratch {
    return this.scratch;
  }

  /**
   * 현재 감정 상태를 업데이트합니다.
   */
  setMood(mood: Scratch['currentMood']): void {
    this.scratch.currentMood = mood;
    this.saveScratch();
  }

  /**
   * 메모리 개수를 반환합니다.
   */
  getMemoryCount(): number {
    return this.memoryStore.count();
  }

  /**
   * 대화 히스토리를 초기화합니다.
   * (세션 리셋용, 메모리는 유지됨)
   */
  clearConversationHistory(): void {
    this.conversationHistory = [];
  }
}
