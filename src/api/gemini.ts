/**
 * Gemini API Client
 * Generative Agents 프로젝트용 LLM 인터페이스
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

// 환경 변수에서 설정 로드
// Vite 환경: import.meta.env 사용
// Node.js 환경: process.env 사용
const GEMINI_API_KEY =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_API_KEY) ||
  process.env.VITE_GEMINI_API_KEY ||
  process.env.GEMINI_API_KEY;

const GEMINI_MODEL =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_MODEL) ||
  process.env.VITE_GEMINI_MODEL ||
  'gemini-1.5-flash';

if (!GEMINI_API_KEY) {
  console.error('VITE_GEMINI_API_KEY is not set. Please check your .env file.');
}

// Gemini 클라이언트 초기화
const genAI = new GoogleGenerativeAI(GEMINI_API_KEY || '');

/**
 * Gemini API 클라이언트 클래스
 */
export class GeminiClient {
  private model: GenerativeModel;

  constructor(modelName: string = GEMINI_MODEL) {
    this.model = genAI.getGenerativeModel({ model: modelName });
  }

  /**
   * 텍스트 생성 (단순 프롬프트)
   */
  async generate(prompt: string): Promise<string> {
    try {
      const result = await this.model.generateContent(prompt);
      const response = result.response;
      return response.text();
    } catch (error) {
      console.error('Gemini API Error:', error);
      throw error;
    }
  }

  /**
   * 메모리 중요도 평가 (1-10)
   * Generative Agents의 importance scoring에 사용
   */
  async rateImportance(memory: string): Promise<number> {
    const prompt = `On the scale of 1 to 10, where 1 is purely mundane (e.g., brushing teeth, eating breakfast) and 10 is extremely poignant (e.g., a break up, getting a job offer, a major life event), rate the likely poignancy of the following piece of memory.

Memory: "${memory}"

Respond with only a single number between 1 and 10.`;

    try {
      const response = await this.generate(prompt);
      const score = parseInt(response.trim(), 10);
      return isNaN(score) ? 5 : Math.min(10, Math.max(1, score));
    } catch {
      return 5; // 기본값
    }
  }

  /**
   * 에이전트 대화 생성
   */
  async generateDialogue(
    agentName: string,
    agentDescription: string,
    context: string,
    recentMemories: string[],
    currentSituation: string
  ): Promise<string> {
    const memoriesText = recentMemories.length > 0
      ? `Recent memories:\n${recentMemories.map(m => `- ${m}`).join('\n')}`
      : 'No recent memories.';

    const prompt = `You are ${agentName}. ${agentDescription}

${memoriesText}

Current situation: ${context}
${currentSituation}

What would ${agentName} say? Respond in character, keeping the response brief and natural (1-2 sentences).`;

    return this.generate(prompt);
  }

  /**
   * 반성(Reflection) 생성
   * 최근 관찰들로부터 상위 수준 인사이트 추출
   */
  async generateReflection(
    agentName: string,
    recentObservations: string[]
  ): Promise<string[]> {
    const observationsText = recentObservations
      .map((obs, i) => `${i + 1}. ${obs}`)
      .join('\n');

    const prompt = `Statements about ${agentName}:
${observationsText}

What 3 high-level insights can you infer from the above statements?
Format your response as a numbered list (1. 2. 3.)`;

    try {
      const response = await this.generate(prompt);
      // 번호로 시작하는 라인 파싱
      const insights = response
        .split('\n')
        .filter(line => /^\d+\./.test(line.trim()))
        .map(line => line.replace(/^\d+\.\s*/, '').trim());

      return insights.length > 0 ? insights : [response.trim()];
    } catch {
      return [];
    }
  }

  /**
   * 일일 계획 생성
   */
  async generateDailyPlan(
    agentName: string,
    agentDescription: string,
    yesterdaysSummary: string
  ): Promise<string[]> {
    const prompt = `${agentName} is ${agentDescription}.
Yesterday: ${yesterdaysSummary}

Here is ${agentName}'s plan today in broad strokes (provide 5-8 activities with approximate times):
1.`;

    try {
      const response = await this.generate(prompt);
      const plans = response
        .split('\n')
        .filter(line => line.trim().length > 0)
        .map(line => line.replace(/^\d+\.\s*/, '').trim());

      return plans;
    } catch {
      return ['Wake up and start the day'];
    }
  }

  /**
   * 반응 결정
   * 에이전트가 관찰에 반응해야 하는지 결정
   */
  async shouldReact(
    agentName: string,
    currentActivity: string,
    observation: string,
    relationshipContext: string
  ): Promise<{ shouldReact: boolean; reaction?: string }> {
    const prompt = `${agentName} is currently ${currentActivity}.
Observation: ${observation}
${relationshipContext}

Should ${agentName} react to this observation? If yes, what would be an appropriate reaction?

Respond in this format:
REACT: YES or NO
REACTION: (only if YES) brief description of reaction`;

    try {
      const response = await this.generate(prompt);
      const shouldReact = response.toUpperCase().includes('REACT: YES');

      let reaction: string | undefined;
      if (shouldReact) {
        const reactionMatch = response.match(/REACTION:\s*(.+)/i);
        reaction = reactionMatch ? reactionMatch[1].trim() : undefined;
      }

      return { shouldReact, reaction };
    } catch {
      return { shouldReact: false };
    }
  }
}

// 싱글톤 인스턴스 export
export const gemini = new GeminiClient();
