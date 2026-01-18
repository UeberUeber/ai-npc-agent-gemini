/**
 * 브라우저용 NPC Agent
 *
 * Persona + Memory + Gemini를 조합하여 NPC 대화를 생성합니다.
 */

import { gemini } from './gemini';
import { MemoryStore, RetrievedMemory } from './memory';

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

// 일일 계획 아이템
export interface DailyPlanItem {
  time: string;           // "06:00", "08:00" 형식
  activity: string;       // "대장간 열기", "검 제작" 등
  location?: string;      // 선택적 위치
  duration: number;       // 분 단위 지속 시간
  status: 'pending' | 'in_progress' | 'completed' | 'skipped';
  goalRelated?: boolean;  // 목표와 연관된 활동 여부
}

// NPC 현재 상태
export interface Scratch {
  currentLocation: string;
  currentActivity: string;
  currentMood: string;
  currentTime: string;
  // Planning 관련
  dailyPlan?: DailyPlanItem[];    // 오늘의 계획
  currentPlanIndex?: number;       // 현재 수행 중인 계획 인덱스
  isAwake?: boolean;               // 기상 여부
}

// NPC가 수행 가능한 활동 (Planning용)
export interface AvailableActivity {
  activity: string;       // "모루에서 철 두드리기"
  location: string;       // "대장간 내부"
  duration?: number;      // 기본 소요 시간 (분)
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
  playerObservation?: string; // 대화에서 플레이어에 대해 새로 알게 된 것
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
   * 용사 스마게이 들어왔을 때 첫 인사
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
용사 스마게이 당신의 가게에 막 들어왔습니다. 하던 일을 하면서 용사 스마게에게 첫 인사를 건네세요.

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
    let playerObservation: string | undefined;

    try {
      const rawResponse = await gemini.generate(prompt);
      const parsed = this.parseJsonResponse(rawResponse);

      if (parsed) {
        responseText = parsed.response;
        newMood = parsed.mood;
        intent = parsed.intent;
        playerObservation = parsed.playerObservation || undefined;
      } else {
        // JSON 파싱 실패 시 원본 텍스트 사용
        responseText = rawResponse;
      }
    } catch (error) {
      console.error('LLM 응답 생성 실패:', error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      responseText = `(잠시 생각에 잠긴다)... 뭐라고 했지? (${errorMsg})`;
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
      content: `용사 스마게이 말했다: "${userMessage}"`,
    });

    this.memoryStore.add({
      type: 'observation',
      content: `나는 용사 스마게에게 말했다: "${responseText}"${intent ? ` (의도: ${intent})` : ''}`,
    });

    // 6. 플레이어에 대한 관찰이 있으면 저장
    if (playerObservation) {
      this.memoryStore.add({
        type: 'observation',
        content: `[용사 스마게에 대한 관찰] ${playerObservation}`,
      });
      this.log(`👁️ 관찰: ${playerObservation}`, 'info');
    }

    // 7. 대화 히스토리 업데이트
    this.conversationHistory.push({ speaker: 'user', content: userMessage, timestamp: now });
    this.conversationHistory.push({ speaker: 'npc', content: responseText, timestamp: now });

    // 8. 대화 카운트 증가 및 Reflection 체크
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
    // 미평가 메모리 중 최근 20개만 평가 (API 비용 절감 + 토큰 제한)
    const MAX_MEMORIES_TO_EVALUATE = 20;
    const recentMemories = memories.filter((m) => m.importance === undefined).slice(-MAX_MEMORIES_TO_EVALUATE);

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

      // JSON 배열 추출 (응답에 다른 텍스트가 섞여있을 수 있음)
      const jsonMatch = response.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        this.log('⚠️ 중요도 응답에서 JSON 배열을 찾을 수 없음', 'warning');
        return;
      }

      const ratings = JSON.parse(jsonMatch[0]) as Array<{ id: string; importance: number }>;

      // 유효성 검사
      if (!Array.isArray(ratings)) {
        this.log('⚠️ 중요도 응답이 배열이 아님', 'warning');
        return;
      }

      let updatedCount = 0;
      for (const rating of ratings) {
        if (rating.id && typeof rating.importance === 'number') {
          this.memoryStore.updateImportance(rating.id, Math.min(10, Math.max(1, rating.importance)));
          updatedCount++;
        }
      }

      this.log(`✓ ${updatedCount}개 메모리 중요도 업데이트됨`, 'success');
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

    // 높은 중요도 순으로 정렬 (미평가는 5로 간주)
    const sortedByImportance = [...recentMemories].sort((a, b) => (b.importance ?? 5) - (a.importance ?? 5));
    const topMemories = sortedByImportance.slice(0, 10);

    const prompt = `당신은 대장장이 존입니다. 최근 경험들을 돌아보며 깨달은 점이나 느낀 점을 정리해주세요.

최근 중요한 기억들:
${topMemories.map((m) => `- ${m.content} (중요도: ${m.importance})`).join('\n')}

위 기억들을 바탕으로:
1. 어떤 패턴이나 깨달음이 있는지
2. 용사 스마게에 대해 어떤 인상을 받았는지
3. 앞으로 어떻게 해야 할지

대장장이 존의 관점에서 1-2문장의 짧은 성찰을 작성하세요.
예시: "최근 용사 스마게들이 철광석에 대해 자주 물어보는군. 수급 문제를 해결해야겠어."

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

    // 2. 현재 상태 + 계획 컨텍스트
    const currentPlan = this.getCurrentPlanItem();
    const nextPlan = this.getNextPlanItem();

    let planContext = '';
    if (currentPlan) {
      planContext = `\n\n## 현재 일정
- 지금 하는 일: ${currentPlan.activity}
- 시작 시간: ${currentPlan.time}
- 예상 소요: ${currentPlan.duration}분
- 장소: ${currentPlan.location || s.currentLocation}`;
      if (currentPlan.goalRelated) {
        planContext += `\n- 이 일은 당신의 목표(${p.currentGoals[0]})와 관련 있습니다.`;
      }
      if (nextPlan) {
        planContext += `\n- 다음 일정: ${nextPlan.time}에 "${nextPlan.activity}"`;
      }
    }

    const state = `## 현재 상태
위치: ${s.currentLocation}
하고 있는 일: ${s.currentActivity}
기분: ${s.currentMood}
시간: ${s.currentTime}${planContext}`;

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
        .map((msg) => `${msg.speaker === 'user' ? '용사 스마게' : p.name}: ${msg.content}`)
        .join('\n');
    } else {
      history += '(이전 대화 없음 - 용사 스마게이 방금 들어왔다)';
    }

    // 5. 현재 발화
    const current = `## 용사 스마게의 말\n"${userMessage}"`;

    // 6. 응답 지침 (JSON 형식 요청)
    const activityHint = currentPlan
      ? `현재 "${currentPlan.activity}" 중이므로, 이 상황에 맞게 대화하세요. (예: 바쁘다고 하거나, 하던 일을 언급하거나, 잠깐 멈추고 대화하거나)`
      : `현재 하던 일(${s.currentActivity})을 하면서 대화하는 것처럼 반응하세요.`;

    const instruction = `## 응답 지침
- 당신은 ${p.name}입니다. 위 정체성과 상태에 맞게 대답하세요.
- 말투: ${p.speechStyle}
- 1-3문장으로 짧게 대답하세요.
- 관련 기억이 있으면 자연스럽게 언급할 수 있습니다.
- **현재 활동 반영**: ${activityHint}
- **중요**: 최근 대화나 관련 기억에서 이미 한 이야기는 반복하지 마세요. 같은 정보를 또 말하지 말고, 새로운 내용이나 다른 관점으로 대화하세요.

## 출력 형식
반드시 다음 JSON 형식으로만 출력하세요:
{"response": "대화 내용", "mood": "감정상태", "intent": "의도", "playerObservation": "관찰 또는 null"}

- response: 대화 내용 (행동 묘사나 따옴표 없이)
- mood: 대화 후 당신의 감정 (happy/neutral/sad/angry/fearful/excited/curious 중 하나)
- intent: 이 대화에서 당신의 의도 (sell/help/refuse/inquire/share_story/warn/chat 중 하나)
- playerObservation: 이 대화에서 용사 스마게에 대해 새로 알게 된 것이 있다면 1문장으로 작성. 없으면 null
  예: "용사 스마게는 기사단 출신이라고 한다", "이 용사는 검에 관심이 많은 것 같다", "허세가 있지만 나쁜 녀석은 아닌 듯"

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

  updateScratch(updates: Partial<Scratch>): void {
    this.scratch = { ...this.scratch, ...updates };
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

  // ========================================
  // Knowledge System (세계 지식)
  // ========================================

  /**
   * 초기 지식 시드
   * NPC가 세계에 대해 알고 있는 기본 사실들을 메모리에 저장
   * 중복 저장 방지 (이미 있는 지식은 건너뜀)
   */
  seedKnowledge(knowledgeList: string[]): number {
    let seededCount = 0;

    for (const knowledge of knowledgeList) {
      // 이미 같은 지식이 있는지 확인
      if (!this.memoryStore.hasKnowledge(knowledge)) {
        this.memoryStore.add({
          type: 'knowledge',
          content: knowledge,
          importance: 9, // 지식은 높은 중요도
        });
        seededCount++;
      }
    }

    if (seededCount > 0) {
      this.log(`📚 ${seededCount}개의 세계 지식 추가됨`, 'success');
    }

    return seededCount;
  }

  /**
   * 현재 저장된 지식 목록 반환
   */
  getKnowledge(): ReturnType<MemoryStore['getKnowledge']> {
    return this.memoryStore.getKnowledge();
  }

  // ========================================
  // Planning System (논문 기반 개선)
  // ========================================

  /**
   * Agent Summary 생성 (논문: "Agent summary")
   * 페르소나 요약 + 목표를 구조화하여 Planning의 입력으로 사용
   */
  private generateAgentSummary(): string {
    const p = this.persona;

    // 목표를 구조화
    const goalsFormatted = p.currentGoals.length > 0
      ? p.currentGoals.map((g, i) => `  ${i + 1}. ${g}`).join('\n')
      : '  (특별한 목표 없음)';

    return `## ${p.name} 요약
이름: ${p.name} (${p.age}세)
직업: ${p.occupation}
위치: ${p.location}
성격: ${p.traits.join(', ')}

### 현재 목표
${goalsFormatted}

### 배경
${p.backstory}`;
  }

  /**
   * 어제 활동 기록 검색 (논문: "Yesterday's activities")
   */
  private getYesterdayActivities(): string {
    // plan 타입 메모리 중 최근 것 검색
    const allMemories = this.memoryStore.getAll();
    const planMemories = allMemories
      .filter(m => m.type === 'plan')
      .slice(-3); // 최근 3개 계획

    if (planMemories.length === 0) {
      return '(첫 번째 날 - 이전 기록 없음)';
    }

    // 가장 최근 하루 완료 기록 검색
    const completionMemories = allMemories
      .filter(m => m.content.includes('하루가 끝났다') || (m.content.includes('계획') && m.content.includes('완료')))
      .slice(-1);

    // 완료 기록 > 계획 기록 > 기본값 순서로 fallback
    if (completionMemories.length > 0) {
      return completionMemories[0].content;
    }
    if (planMemories.length > 0) {
      return planMemories[planMemories.length - 1].content;
    }
    return '(첫 번째 날 - 이전 기록 없음)';
  }

  /**
   * NPC 기상 - 하루 계획 생성
   */
  async wakeUp(currentTime: string = '06:00'): Promise<DailyPlanItem[]> {
    this.scratch.isAwake = true;
    this.scratch.currentTime = currentTime;
    this.log('☀️ 기상! 하루 계획 생성 중...', 'info');

    // 하루 계획 생성
    const plan = await this.generateDailyPlan();
    this.scratch.dailyPlan = plan;
    this.scratch.currentPlanIndex = 0;

    // 첫 번째 계획 시작
    if (plan.length > 0) {
      plan[0].status = 'in_progress';
      this.scratch.currentActivity = plan[0].activity;
      this.scratch.currentLocation = plan[0].location || this.scratch.currentLocation;
    }

    // 기상을 메모리에 기록
    this.memoryStore.add({
      type: 'observation',
      content: `아침 ${currentTime}에 일어났다. 오늘 할 일: ${plan.slice(0, 3).map(p => p.activity).join(', ')}...`,
      importance: 3,
    });

    this.log(`📋 ${plan.length}개의 일정 생성됨`, 'success');
    return plan;
  }

  /**
   * NPC 취침 - 하루 정리
   */
  async sleep(): Promise<void> {
    this.scratch.isAwake = false;
    this.log('🌙 취침 준비...', 'info');

    // 오늘 계획 완료율 계산
    const plan = this.scratch.dailyPlan || [];
    const completed = plan.filter(p => p.status === 'completed').length;
    const total = plan.length;

    // 하루 요약을 메모리에 저장
    this.memoryStore.add({
      type: 'observation',
      content: `하루가 끝났다. 계획 ${total}개 중 ${completed}개를 완료했다.`,
      importance: 4,
    });

    // 계획 초기화
    this.scratch.dailyPlan = undefined;
    this.scratch.currentPlanIndex = undefined;
    this.scratch.currentActivity = '잠자는 중';

    this.log(`😴 취침. 오늘 ${completed}/${total} 완료`, 'success');
  }

  /**
   * 하루 계획 생성 (LLM 사용) - 지식 기반 개선
   *
   * 입력:
   * 1. Agent Summary (페르소나 + 목표)
   * 2. World Knowledge (세계 지식 - 가능한 활동 제약)
   * 3. Yesterday's Activities (어제 활동)
   * 4. Recent Observations (최근 중요 관찰 - 지식 갱신)
   */
  private async generateDailyPlan(): Promise<DailyPlanItem[]> {
    const p = this.persona;

    // 1. Agent Summary 생성
    const agentSummary = this.generateAgentSummary();

    // 2. 세계 지식 조회 (NEW!)
    const knowledge = this.memoryStore.getKnowledge();
    const knowledgeContext = knowledge.length > 0
      ? knowledge.map(k => `- ${k.content}`).join('\n')
      : '(세계 지식 없음)';

    // 3. 어제 활동 검색
    const yesterdayActivities = this.getYesterdayActivities();

    // 4. 최근 중요 관찰 (importance >= 7) - 지식 갱신용 (NEW!)
    const recentObservations = this.memoryStore.getAll()
      .filter(m => m.type === 'observation' && (m.importance ?? 5) >= 7)
      .slice(-5);
    const observationContext = recentObservations.length > 0
      ? recentObservations.map(o => `- ${o.content}`).join('\n')
      : '(특별한 변화 없음)';

    // 5. 목표 관련 기억 검색
    const goalKeywords = p.currentGoals.join(' ');
    const relevantMemories = this.memoryStore.retrieve(goalKeywords, 3);
    const memoryContext = relevantMemories.length > 0
      ? relevantMemories.map(m => `- ${m.content}`).join('\n')
      : '(관련 기억 없음)';

    const prompt = `${agentSummary}

## 내가 아는 세계 (World Knowledge)
${knowledgeContext}

## 최근 중요한 일 (Recent Observations)
${observationContext}

⚠️ **중요**: 위의 "내가 아는 세계"와 "최근 중요한 일"이 충돌하면, 최근 관찰을 우선합니다.
예: 지식에 "침대가 있다"고 되어 있어도, 최근 "침대가 불탔다"는 관찰이 있으면 침대는 사용 불가입니다.

## 어제 활동
${yesterdayActivities}

## 관련 기억
${memoryContext}

## 요청
위의 정보를 바탕으로 오늘 하루의 계획을 만들어주세요.

### 핵심 제약 조건
1. **"내가 아는 세계"에 있는 장소와 도구만 사용** (없는 것은 계획 불가!)
2. "최근 중요한 일"에 변화가 있으면 반영
3. 목표 달성을 위한 활동을 최소 1개 포함
   - 목표: ${p.currentGoals.join(', ')}

### 계획 조건
- 06:00 기상부터 22:00 취침까지
- ${p.occupation}의 일과에 맞게
- 각 활동은 30분~2시간 단위

## 출력 형식
반드시 다음 JSON 배열로만 출력하세요:
[
  {"time": "06:00", "activity": "활동 내용", "location": "장소", "duration": 60, "goalRelated": true},
  ...
]

- time: "HH:MM" 형식
- activity: 구체적인 활동
- location: **반드시 "내가 아는 세계"에 있는 장소만 사용**
- duration: 분 단위
- goalRelated: 목표와 관련된 활동이면 true

JSON 배열만 출력:`;

    try {
      const response = await gemini.generate(prompt);
      const jsonMatch = response.match(/\[[\s\S]*\]/);

      if (!jsonMatch) {
        throw new Error('JSON 배열을 찾을 수 없음');
      }

      const rawPlan = JSON.parse(jsonMatch[0]) as Array<{
        time: string;
        activity: string;
        location?: string;
        duration: number;
        goalRelated?: boolean;
      }>;

      // DailyPlanItem으로 변환 (status 추가)
      const plan: DailyPlanItem[] = rawPlan.map(item => ({
        time: item.time,
        activity: item.activity,
        location: item.location,
        duration: item.duration || 60,
        status: 'pending' as const,
        goalRelated: item.goalRelated,
      }));

      // 목표 관련 활동 추출
      const goalActivities = plan.filter(p => p.goalRelated);
      const goalNote = goalActivities.length > 0
        ? ` [목표 관련: ${goalActivities.map(g => g.activity).join(', ')}]`
        : '';

      // 계획을 메모리에 저장
      this.memoryStore.add({
        type: 'plan',
        content: `오늘의 계획: ${plan.map(p => `${p.time} ${p.activity}`).join(' → ')}${goalNote}`,
        importance: 5,
      });

      return plan;
    } catch (error) {
      console.error('계획 생성 실패:', error);
      this.log('⚠️ 계획 생성 실패, 기본 일과 사용', 'warning');

      // 기본 일과 반환
      return this.getDefaultDailyPlan();
    }
  }

  /**
   * 기본 일과 (LLM 실패 시)
   */
  private getDefaultDailyPlan(): DailyPlanItem[] {
    return [
      { time: '06:00', activity: '기상 및 아침 준비', location: '집', duration: 60, status: 'pending' },
      { time: '07:00', activity: '아침 식사', location: '집', duration: 30, status: 'pending' },
      { time: '07:30', activity: '대장간으로 이동', location: '마을 거리', duration: 15, status: 'pending' },
      { time: '08:00', activity: '대장간 열기 및 불 피우기', location: '대장간', duration: 30, status: 'pending' },
      { time: '08:30', activity: '주문받은 물건 제작', location: '대장간 내부', duration: 180, status: 'pending' },
      { time: '12:00', activity: '점심 식사', location: '대장간 뒤편', duration: 60, status: 'pending' },
      { time: '13:00', activity: '오후 작업 - 수리 및 제작', location: '대장간 내부', duration: 240, status: 'pending' },
      { time: '17:00', activity: '대장간 정리', location: '대장간', duration: 60, status: 'pending' },
      { time: '18:00', activity: '저녁 식사', location: '집', duration: 60, status: 'pending' },
      { time: '19:00', activity: '개인 시간', location: '집', duration: 120, status: 'pending' },
      { time: '21:00', activity: '취침 준비', location: '집', duration: 60, status: 'pending' },
    ];
  }

  /**
   * 시간에 따라 현재 계획 업데이트
   */
  updatePlanProgress(currentTime: string): { changed: boolean; newActivity?: DailyPlanItem } {
    if (!this.scratch.dailyPlan || !this.scratch.isAwake) {
      return { changed: false };
    }

    const plan = this.scratch.dailyPlan;
    const currentMinutes = this.timeToMinutes(currentTime);

    // 현재 시간에 맞는 계획 찾기
    let targetIndex = -1;
    for (let i = 0; i < plan.length; i++) {
      const planMinutes = this.timeToMinutes(plan[i].time);
      const endMinutes = planMinutes + plan[i].duration;

      if (currentMinutes >= planMinutes && currentMinutes < endMinutes) {
        targetIndex = i;
        break;
      }
    }

    // 마지막 계획 시간을 지났으면 마지막 계획 유지
    if (targetIndex === -1 && plan.length > 0) {
      const lastPlan = plan[plan.length - 1];
      const lastEndMinutes = this.timeToMinutes(lastPlan.time) + lastPlan.duration;
      if (currentMinutes >= lastEndMinutes) {
        // 모든 계획 완료
        return { changed: false };
      }
    }

    const currentIndex = this.scratch.currentPlanIndex ?? 0;

    // 계획이 변경되었는지 확인
    if (targetIndex !== currentIndex && targetIndex !== -1) {
      // 이전 계획 완료 처리
      for (let i = currentIndex; i < targetIndex; i++) {
        if (plan[i].status === 'in_progress') {
          plan[i].status = 'completed';
        } else if (plan[i].status === 'pending') {
          plan[i].status = 'skipped';
        }
      }

      // 새 계획 시작
      plan[targetIndex].status = 'in_progress';
      this.scratch.currentPlanIndex = targetIndex;
      this.scratch.currentActivity = plan[targetIndex].activity;
      const newLocation = plan[targetIndex].location;
      if (newLocation) {
        this.scratch.currentLocation = newLocation;
      }
      this.scratch.currentTime = currentTime;

      this.log(`📍 활동 변경: ${plan[targetIndex].activity}`, 'info');

      return { changed: true, newActivity: plan[targetIndex] };
    }

    this.scratch.currentTime = currentTime;
    return { changed: false };
  }

  /**
   * 시간 문자열을 분 단위로 변환
   */
  private timeToMinutes(time: string): number {
    const [hours, minutes] = time.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * 현재 계획 가져오기
   */
  getDailyPlan(): DailyPlanItem[] | undefined {
    return this.scratch.dailyPlan;
  }

  /**
   * 현재 진행 중인 계획 아이템
   */
  getCurrentPlanItem(): DailyPlanItem | undefined {
    if (!this.scratch.dailyPlan || this.scratch.currentPlanIndex === undefined) {
      return undefined;
    }
    return this.scratch.dailyPlan[this.scratch.currentPlanIndex];
  }

  /**
   * 다음 계획 아이템 (현재 일정 다음에 할 일)
   */
  getNextPlanItem(): DailyPlanItem | undefined {
    if (!this.scratch.dailyPlan || this.scratch.currentPlanIndex === undefined) {
      return undefined;
    }
    const nextIndex = this.scratch.currentPlanIndex + 1;
    if (nextIndex >= this.scratch.dailyPlan.length) {
      return undefined;
    }
    return this.scratch.dailyPlan[nextIndex];
  }

  /**
   * 관찰 내용을 메모리에 추가 (외부에서 호출용)
   * 예: "플레이어가 대장간 앞에서 시야에 나타났다"
   */
  addObservation(content: string, importance: number = 4): void {
    this.memoryStore.add({
      type: 'observation',
      content,
      importance,
    });
  }

  // ========================================
  // 자율 발화 시스템 (Autonomous Speech)
  // 논문: Reaction & Dialogue System
  // ========================================

  /**
   * 반응할지 판단 (논문: "Should agent react?")
   * 규칙 기반 사전 필터 + LLM 최종 판단
   */
  async shouldInitiateConversation(observation: string): Promise<boolean> {
    // 1. 규칙 기반 사전 필터 (LLM 비용 절감)
    if (!this.scratch.isAwake) return false;  // 자는 중
    if (this.scratch.currentMood === 'angry') return false;  // 화난 상태

    // 2. 관련 기억 검색
    const memories = this.memoryStore.retrieve(observation, 3);

    // 3. LLM 판단
    const prompt = `당신은 ${this.persona.name}입니다.
현재: ${this.scratch.currentActivity} (기분: ${this.scratch.currentMood})
관찰: ${observation}
관련 기억: ${memories.map(m => m.content).join('; ') || '없음'}

이 상황에서 플레이어에게 먼저 말을 걸어야 할까요?
당신의 성격(${this.persona.traits.join(', ')})을 고려하세요.

YES 또는 NO만 답하세요:`;

    try {
      const response = await gemini.generate(prompt);
      return response.toUpperCase().includes('YES');
    } catch (error) {
      console.error('반응 판단 실패:', error);
      return false;
    }
  }

  /**
   * 자발적 발화 생성 (논문: "Dialogue Generation - Turn 1")
   */
  async generateSpontaneousUtterance(observation: string): Promise<string> {
    // 이전 자율 발화 기억 검색 (중복 인사 방지용)
    const previousUtterances = this.memoryStore.retrieve('플레이어에게 먼저 말을 걸었다', 3);
    // 최근 대화 히스토리 (실제 대화만 - 인식 기록 제외)
    const recentHistory = this.conversationHistory.slice(-6);
    const historyText = recentHistory.length > 0
      ? recentHistory.map(m => `${m.speaker === 'user' ? '플레이어' : '나'}: ${m.content}`).join('\n')
      : '(아직 대화 없음)';

    const prompt = `## 당신의 정체
이름: ${this.persona.name}
성격: ${this.persona.traits.join(', ')}
말투: ${this.persona.speechStyle}

## 현재 상태
활동: ${this.scratch.currentActivity}
기분: ${this.scratch.currentMood}
위치: ${this.scratch.currentLocation}

## 상황
${observation}

## 최근 대화 히스토리
${historyText}

## 이전에 플레이어에게 한 인사
${previousUtterances.map(m => `- ${m.content}`).join('\n') || '(없음)'}

## 지시
위 상황에서 플레이어에게 먼저 말을 거세요.
- 1-2문장으로 짧게
- 말투: ${this.persona.speechStyle}
- 현재 하던 일을 하면서 말하는 것처럼
- **중요**: 최근 대화 내용을 고려하세요. 플레이어가 이미 거절한 것을 다시 권유하지 마세요.
- **중요**: 위 "이전에 플레이어에게 한 인사"와 같거나 비슷한 말은 절대 하지 마세요. 완전히 다른 인사를 하세요.
- 대화 내용만 출력 (행동 묘사나 따옴표 없이)`;

    try {
      const response = await gemini.generate(prompt);

      // 메모리에 저장
      this.memoryStore.add({
        type: 'observation',
        content: `나는 플레이어에게 먼저 말을 걸었다: "${response}"`,
        importance: 5,
      });

      return response;
    } catch (error) {
      console.error('자발적 발화 생성 실패:', error);
      return '...어서 오게.';  // 폴백
    }
  }

  // ========================================
  // NPC간 대화 시스템 (NPC-to-NPC Dialogue)
  // ========================================

  /**
   * 다른 NPC에게 먼저 말 걸기
   */
  async initiateNpcConversation(targetName: string, observation: string): Promise<string> {
    const memories = this.memoryStore.retrieve(`${targetName} 대화`, 3);

    const prompt = `## 당신의 정체
이름: ${this.persona.name}
성격: ${this.persona.traits.join(', ')}
말투: ${this.persona.speechStyle}

## 현재 상태
활동: ${this.scratch.currentActivity}
기분: ${this.scratch.currentMood}

## 상황
${observation}

## ${targetName}에 대한 기억
${memories.map(m => `- ${m.content}`).join('\n') || '(특별한 기억 없음)'}

## 지시
${targetName}에게 먼저 말을 거세요.
- 1-2문장으로 짧게
- 말투: ${this.persona.speechStyle}
- 대화 내용만 출력 (행동 묘사나 따옴표 없이)`;

    try {
      const response = await gemini.generate(prompt);

      // 메모리에 저장
      this.memoryStore.add({
        type: 'observation',
        content: `나는 ${targetName}에게 말을 걸었다: "${response}"`,
        importance: 4,
      });

      return response;
    } catch (error) {
      console.error('NPC 대화 시작 실패:', error);
      return '...';
    }
  }

  /**
   * 다른 NPC의 말에 응답하기
   */
  async respondToNpc(speakerName: string, utterance: string): Promise<string> {
    const memories = this.memoryStore.retrieve(`${speakerName}`, 3);

    const prompt = `## 당신의 정체
이름: ${this.persona.name}
성격: ${this.persona.traits.join(', ')}
말투: ${this.persona.speechStyle}

## 현재 상태
활동: ${this.scratch.currentActivity}
기분: ${this.scratch.currentMood}

## 상황
${speakerName}이(가) 당신에게 말했습니다: "${utterance}"

## ${speakerName}에 대한 기억
${memories.map(m => `- ${m.content}`).join('\n') || '(특별한 기억 없음)'}

## 지시
${speakerName}의 말에 응답하세요.
- 1-2문장으로 짧게
- 말투: ${this.persona.speechStyle}
- 대화 내용만 출력 (행동 묘사나 따옴표 없이)`;

    try {
      const response = await gemini.generate(prompt);

      // 메모리에 저장
      this.memoryStore.add({
        type: 'observation',
        content: `${speakerName}이(가) 나에게 말했다: "${utterance}"`,
        importance: 4,
      });
      this.memoryStore.add({
        type: 'observation',
        content: `나는 ${speakerName}에게 대답했다: "${response}"`,
        importance: 4,
      });

      return response;
    } catch (error) {
      console.error('NPC 응답 실패:', error);
      return '...그래.';
    }
  }

  // ========================================
  // 내적 판단 시스템 (Thought/Inner Monologue)
  // ========================================

  /**
   * 내적 판단/혼잣말 저장
   */
  addThought(content: string, importance: number = 4): void {
    this.memoryStore.add({
      type: 'thought',
      content: content,
      importance: importance,
    });
  }

  /**
   * 대화 계속 여부 판단 (논문: Reaction System)
   * - NPC 성격, 다음 일정 중요도, 대화 내용을 고려
   * - 내적 판단을 thought로 저장
   */
  async shouldContinueConversation(
    nextPlan: DailyPlanItem | null,
    minutesUntilNext: number,
    conversationTurns: number
  ): Promise<{ continue: boolean; utterance?: string }> {
    // 다음 일정이 없거나 30분 이상 남았으면 계속
    if (!nextPlan || minutesUntilNext > 30) {
      return { continue: true };
    }

    // 대화가 짧으면 (3턴 미만) 계속
    if (conversationTurns < 3) {
      return { continue: true };
    }

    const recentHistory = this.conversationHistory.slice(-4)
      .map(m => `${m.speaker === 'user' ? '상대방' : '나'}: ${m.content}`)
      .join('\n');

    const prompt = `## 당신의 정체
이름: ${this.persona.name}
성격: ${this.persona.traits.join(', ')}
말투: ${this.persona.speechStyle}

## 다음 일정
시간: ${nextPlan.time}
활동: ${nextPlan.activity}
장소: ${nextPlan.location}

## 현재 상황
- 다음 일정까지 약 ${minutesUntilNext}분 남음
- 현재 대화 ${conversationTurns}턴 진행 중

## 최근 대화
${recentHistory}

## 판단 기준
- 당신의 성격(${this.persona.traits.join(', ')})을 고려하세요
- 다음 일정이 중요하면 가야 합니다
- 대화 내용이 급하거나 중요하면 일정을 미룰 수 있습니다
- 성격이 성실하면 일정을 중시, 사교적이면 대화를 중시

## 응답 형식 (JSON)
{
  "thought": "내적 판단 (예: '슬슬 가야하는데... 근데 이 사람 할 말이 더 있는 것 같아')",
  "continue": true/false,
  "utterance": "대화를 끊을 경우 할 말 (continue가 false일 때만)"
}`;

    try {
      const response = await gemini.generate(prompt);
      const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
      const result = JSON.parse(cleaned);

      // 내적 판단을 thought로 저장
      if (result.thought) {
        this.addThought(result.thought, 5);
      }

      return {
        continue: result.continue,
        utterance: result.utterance,
      };
    } catch (error) {
      console.error('대화 계속 판단 실패:', error);
      return { continue: true };
    }
  }

  /**
   * 대화 지속 여부 체크 (간편 래퍼)
   * - 현재 시간과 대화 턴수만 전달하면 내부에서 다음 일정 계산
   */
  async checkShouldContinue(
    currentTime: string,
    conversationTurns: number
  ): Promise<{ continue: boolean; utterance?: string }> {
    if (!this.scratch.dailyPlan || this.scratch.dailyPlan.length === 0) {
      return { continue: true };
    }

    const currentMinutes = this.timeToMinutes(currentTime);
    const currentIndex = this.scratch.currentPlanIndex ?? 0;

    // 다음 일정 찾기
    let nextPlan: DailyPlanItem | null = null;
    let minutesUntilNext = 999;

    if (currentIndex + 1 < this.scratch.dailyPlan.length) {
      nextPlan = this.scratch.dailyPlan[currentIndex + 1];
      const nextMinutes = this.timeToMinutes(nextPlan.time);
      minutesUntilNext = nextMinutes - currentMinutes;
      if (minutesUntilNext < 0) minutesUntilNext += 24 * 60;
    }

    return this.shouldContinueConversation(nextPlan, minutesUntilNext, conversationTurns);
  }

  /**
   * 혼잣말 생성 (혼자 있을 때)
   */
  async generateSelfTalk(): Promise<string | null> {
    // 20% 확률로만 혼잣말
    if (Math.random() > 0.2) {
      return null;
    }

    const recentMemories = this.memoryStore.retrieve(this.scratch.currentActivity, 3);

    const prompt = `## 당신의 정체
이름: ${this.persona.name}
성격: ${this.persona.traits.join(', ')}

## 현재 상태
활동: ${this.scratch.currentActivity}
위치: ${this.scratch.currentLocation}
기분: ${this.scratch.currentMood}

## 최근 기억
${recentMemories.map(m => `- ${m.content}`).join('\n') || '(없음)'}

## 지시
혼자 일하면서 할 수 있는 짧은 혼잣말을 생성하세요.
- 현재 하는 일에 대한 생각
- 최근 있었던 일에 대한 회상
- 오늘 계획에 대한 생각
- 1문장으로 짧게
- 혼잣말이므로 "..." 이나 "음..." 같은 표현 가능
- 대화체가 아닌 독백체로`;

    try {
      const selfTalk = await gemini.generate(prompt);

      // thought로 저장
      this.addThought(`(혼잣말) ${selfTalk}`, 3);

      return selfTalk;
    } catch (error) {
      console.error('혼잣말 생성 실패:', error);
      return null;
    }
  }
}
