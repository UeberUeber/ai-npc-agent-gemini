/**
 * 브라우저용 NPC Agent
 *
 * Persona + Memory + Gemini를 조합하여 NPC 대화를 생성합니다.
 */

import { gemini } from './gemini';
import { MemoryStore, RetrievedMemory, Memory } from './memory';

// NPC 페르소나 타입
export interface Persona {
  id: string;
  name: string;
  age: number;
  occupation: string;
  location: string;
  traits: string[];
  backstory: string;
  currentGoals: string[];
  speechStyle: string;
}

// NPC 현재 상태
export interface Scratch {
  currentLocation: string;
  currentActivity: string;
  currentMood: string;
  currentTime: string;
}

// 대화 메시지
export interface ChatMessage {
  speaker: 'user' | 'npc';
  content: string;
  timestamp: string;
}

// 시스템 로그 콜백 타입
export type LogCallback = (message: string, type: 'info' | 'success' | 'warning') => void;

// 감정 타입
export type MoodType = 'happy' | 'neutral' | 'sad' | 'angry' | 'fearful' | 'excited' | 'curious';

// LLM 응답 타입
interface ChatResponse {
  response: string;
  mood: MoodType;
  intent?: string;
}

export class NPCAgent {
  private persona: Persona;
  private scratch: Scratch;
  private memoryStore: MemoryStore;
  private conversationHistory: ChatMessage[] = [];
  private chatCount: number = 0;
  private isReflecting: boolean = false;
  private onLog?: LogCallback;

  constructor(persona: Persona, scratch: Scratch) {
    this.persona = persona;
    this.scratch = scratch;
    this.memoryStore = new MemoryStore(persona.id);
  }

  /**
   * 로그 콜백 설정
   */
  setLogCallback(callback: LogCallback): void {
    this.onLog = callback;
  }

  private log(message: string, type: 'info' | 'success' | 'warning' = 'info'): void {
    this.onLog?.(message, type);
  }

  /**
   * 손님이 들어왔을 때 첫 인사
   */
  async greet(): Promise<string> {
    const p = this.persona;
    const s = this.scratch;

    const prompt = `## 당신의 정체
이름: ${p.name}
나이: ${p.age}세
직업: ${p.occupation}
성격: ${p.traits.join(', ')}
말투: ${p.speechStyle}

## 현재 상태
위치: ${s.currentLocation}
하고 있는 일: ${s.currentActivity}
기분: ${s.currentMood}

## 상황
손님이 당신의 가게에 막 들어왔습니다. 하던 일을 하면서 손님에게 첫 인사를 건네세요.

## 응답 지침
- 1-2문장으로 짧게
- 말투: ${p.speechStyle}
- 현재 하던 일(${s.currentActivity})을 하면서 인사하는 것처럼
- 대화 내용만 출력 (행동 묘사나 따옴표 없이)`;

    try {
      const response = await gemini.generate(prompt);
      return response;
    } catch (error) {
      console.error('인사 생성 실패:', error);
      return '...어서 오게.';
    }
  }

  /**
   * NPC와 대화
   */
  async chat(userMessage: string): Promise<string> {
    // 1. 관련 기억 검색
    const relevantMemories = this.memoryStore.retrieve(userMessage, 5);

    // 2. 프롬프트 생성
    const prompt = this.buildPrompt(userMessage, relevantMemories);

    // 3. LLM 응답 생성 및 감정 파싱
    let responseText: string;
    let newMood: MoodType = this.scratch.currentMood as MoodType;
    let intent: string | undefined;

    try {
      const rawResponse = await gemini.generate(prompt);
      const parsed = this.parseJsonResponse(rawResponse);

      if (parsed) {
        responseText = parsed.response;
        newMood = parsed.mood;
        intent = parsed.intent;
      } else {
        // JSON 파싱 실패 시 원본 텍스트 사용
        responseText = rawResponse;
      }
    } catch (error) {
      console.error('LLM 응답 생성 실패:', error);
      responseText = '(잠시 생각에 잠긴다)... 뭐라고 했지?';
    }

    // 4. 감정 변화 처리
    const oldMood = this.scratch.currentMood;
    if (oldMood !== newMood) {
      this.scratch.currentMood = newMood;
      this.log(`😊 감정 변화: ${oldMood} → ${newMood}`, 'info');

      // 감정 변화를 메모리에 기록
      this.memoryStore.add({
        type: 'observation',
        content: `나의 기분이 ${oldMood}에서 ${newMood}로 바뀌었다.`,
        importance: 4,
      });
    }

    // 5. 대화 내용을 메모리에 저장
    const now = new Date().toISOString();

    this.memoryStore.add({
      type: 'observation',
      content: `손님이 말했다: "${userMessage}"`,
    });

    this.memoryStore.add({
      type: 'observation',
      content: `나는 손님에게 말했다: "${responseText}"${intent ? ` (의도: ${intent})` : ''}`,
    });

    // 6. 대화 히스토리 업데이트
    this.conversationHistory.push({ speaker: 'user', content: userMessage, timestamp: now });
    this.conversationHistory.push({ speaker: 'npc', content: responseText, timestamp: now });

    // 7. 대화 카운트 증가 및 Reflection 체크
    this.chatCount++;
    if (this.chatCount >= 10 && !this.isReflecting) {
      this.triggerReflection();
    }

    return responseText;
  }

  /**
   * JSON 응답 파싱
   */
  private parseJsonResponse(raw: string): ChatResponse | null {
    try {
      // JSON 부분만 추출 (혹시 다른 텍스트가 섞여있을 경우)
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      if (!jsonMatch) return null;

      const parsed = JSON.parse(jsonMatch[0]) as ChatResponse;

      // 유효성 검사
      if (typeof parsed.response !== 'string') return null;

      // mood 유효성 검사
      const validMoods: MoodType[] = ['happy', 'neutral', 'sad', 'angry', 'fearful', 'excited', 'curious'];
      if (!validMoods.includes(parsed.mood)) {
        parsed.mood = 'neutral';
      }

      return parsed;
    } catch (error) {
      console.warn('JSON 파싱 실패:', error);
      return null;
    }
  }

  /**
   * Reflection 트리거 (비동기)
   */
  private async triggerReflection(): Promise<void> {
    this.isReflecting = true;
    this.log('🔄 Reflection 시작... (대화 10개 도달)', 'info');

    try {
      // 1. 최근 메모리들의 중요도 비동기 평가
      await this.evaluateRecentImportance();

      // 2. Reflection 생성
      await this.generateReflection();

      this.chatCount = 0; // 카운트 리셋
      this.log('✅ Reflection 완료!', 'success');
    } catch (error) {
      console.error('Reflection 오류:', error);
      this.log('⚠️ Reflection 중 오류 발생', 'warning');
    } finally {
      this.isReflecting = false;
    }
  }

  /**
   * 최근 메모리들의 중요도 LLM으로 평가
   */
  private async evaluateRecentImportance(): Promise<void> {
    const memories = this.memoryStore.getAll();
    const recentMemories = memories.filter((m) => m.importance === 5).slice(-20); // 기본값 5인 최근 메모리만

    if (recentMemories.length === 0) {
      this.log('평가할 새 메모리 없음', 'info');
      return;
    }

    this.log(`📊 ${recentMemories.length}개 메모리 중요도 평가 중...`, 'info');

    const prompt = `다음은 대장장이 NPC의 기억들입니다. 각 기억의 중요도를 1-10 척도로 평가해주세요.
1: 일상적인 인사, 무의미한 대화
5: 일반적인 대화, 정보 교환
10: 매우 중요한 사건, 감정적으로 의미있는 순간, 핵심 정보

각 기억의 ID와 중요도를 JSON 배열로만 출력하세요.
예시: [{"id": "m001", "importance": 3}, {"id": "m002", "importance": 7}]

기억 목록:
${recentMemories.map((m) => `- [${m.id}] ${m.content}`).join('\n')}

JSON 배열만 출력:`;

    try {
      const response = await gemini.generate(prompt);
      const ratings = JSON.parse(response) as Array<{ id: string; importance: number }>;

      for (const rating of ratings) {
        if (rating.id && typeof rating.importance === 'number') {
          this.memoryStore.updateImportance(rating.id, Math.min(10, Math.max(1, rating.importance)));
        }
      }

      this.log(`✓ ${ratings.length}개 메모리 중요도 업데이트됨`, 'success');
    } catch (error) {
      console.error('중요도 평가 오류:', error);
      this.log('⚠️ 중요도 평가 실패', 'warning');
    }
  }

  /**
   * Reflection 메모리 생성
   */
  private async generateReflection(): Promise<void> {
    const memories = this.memoryStore.getAll();
    const recentMemories = memories.slice(-20);

    if (recentMemories.length < 5) {
      this.log('Reflection할 메모리 부족', 'info');
      return;
    }

    this.log('💭 Reflection 생성 중...', 'info');

    // 높은 중요도 순으로 정렬
    const sortedByImportance = [...recentMemories].sort((a, b) => b.importance - a.importance);
    const topMemories = sortedByImportance.slice(0, 10);

    const prompt = `당신은 대장장이 존입니다. 최근 경험들을 돌아보며 깨달은 점이나 느낀 점을 정리해주세요.

최근 중요한 기억들:
${topMemories.map((m) => `- ${m.content} (중요도: ${m.importance})`).join('\n')}

위 기억들을 바탕으로:
1. 어떤 패턴이나 깨달음이 있는지
2. 손님에 대해 어떤 인상을 받았는지
3. 앞으로 어떻게 해야 할지

대장장이 존의 관점에서 1-2문장의 짧은 성찰을 작성하세요.
예시: "최근 손님들이 철광석에 대해 자주 물어보는군. 수급 문제를 해결해야겠어."

성찰 내용만 출력:`;

    try {
      const reflection = await gemini.generate(prompt);

      // Reflection을 높은 중요도로 저장
      this.memoryStore.add({
        type: 'reflection',
        content: reflection,
        importance: 8,
        sources: topMemories.map((m) => m.id),
      });

      this.log(`💡 Reflection: "${reflection.slice(0, 50)}..."`, 'success');
    } catch (error) {
      console.error('Reflection 생성 오류:', error);
      this.log('⚠️ Reflection 생성 실패', 'warning');
    }
  }

  private buildPrompt(userMessage: string, relevantMemories: RetrievedMemory[]): string {
    const p = this.persona;
    const s = this.scratch;

    // 1. NPC 정체성
    const identity = `## 당신의 정체
이름: ${p.name}
나이: ${p.age}세
직업: ${p.occupation}
성격: ${p.traits.join(', ')}
배경: ${p.backstory}
현재 목표: ${p.currentGoals.join(' / ')}
말투: ${p.speechStyle}`;

    // 2. 현재 상태
    const state = `## 현재 상태
위치: ${s.currentLocation}
하고 있는 일: ${s.currentActivity}
기분: ${s.currentMood}
시간: ${s.currentTime}`;

    // 3. 관련 기억
    let memories = '## 관련 기억\n';
    if (relevantMemories.length > 0) {
      memories += relevantMemories.map((m) => `- ${m.content} (중요도: ${m.importance})`).join('\n');
    } else {
      memories += '(관련된 기억 없음)';
    }

    // 4. 대화 히스토리 (최근 6개)
    let history = '## 최근 대화\n';
    const recent = this.conversationHistory.slice(-6);
    if (recent.length > 0) {
      history += recent
        .map((msg) => `${msg.speaker === 'user' ? '손님' : p.name}: ${msg.content}`)
        .join('\n');
    } else {
      history += '(이전 대화 없음 - 손님이 방금 들어왔다)';
    }

    // 5. 현재 발화
    const current = `## 손님의 말\n"${userMessage}"`;

    // 6. 응답 지침 (JSON 형식 요청)
    const instruction = `## 응답 지침
- 당신은 ${p.name}입니다. 위 정체성과 상태에 맞게 대답하세요.
- 말투: ${p.speechStyle}
- 1-3문장으로 짧게 대답하세요.
- 관련 기억이 있으면 자연스럽게 언급할 수 있습니다.
- 현재 하던 일(${s.currentActivity})을 하면서 대화하는 것처럼 반응하세요.

## 출력 형식
반드시 다음 JSON 형식으로만 출력하세요:
{"response": "대화 내용", "mood": "감정상태", "intent": "의도"}

- response: 대화 내용 (행동 묘사나 따옴표 없이)
- mood: 대화 후 당신의 감정 (happy/neutral/sad/angry/fearful/excited/curious 중 하나)
- intent: 이 대화에서 당신의 의도 (sell/help/refuse/inquire/share_story/warn/chat 중 하나)

JSON만 출력:`;

    return [identity, state, memories, history, current, instruction].join('\n\n');
  }

  // Getters
  getName(): string {
    return this.persona.name;
  }

  getPersona(): Persona {
    return { ...this.persona };
  }

  getScratch(): Scratch {
    return { ...this.scratch };
  }

  getConversationHistory(): ChatMessage[] {
    return [...this.conversationHistory];
  }

  getMemoryCount(): number {
    return this.memoryStore.count();
  }

  getRecentMemories(count: number = 10): ReturnType<MemoryStore['getAll']> {
    return this.memoryStore.getAll().slice(-count).reverse();
  }

  getChatCount(): number {
    return this.chatCount;
  }

  clearConversationHistory(): void {
    this.conversationHistory = [];
  }

  clearAllMemories(): void {
    this.memoryStore.clear();
    this.conversationHistory = [];
    this.chatCount = 0;
  }
}
