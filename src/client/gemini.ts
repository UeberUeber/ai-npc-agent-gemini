/**
 * 브라우저용 Gemini API Client
 *
 * 서버 없이 브라우저에서 직접 Gemini API를 호출합니다.
 * API 키는 사용자가 직접 입력하며 localStorage에만 저장됩니다.
 */

import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';

const MODEL_NAME = import.meta.env.VITE_GEMINI_MODEL || 'gemini-3-flash-preview';
const API_KEY_STORAGE_KEY = 'gemini_api_key';

export class GeminiClient {
  private model: GenerativeModel | null = null;
  private apiKey: string | null = null;

  constructor() {
    // localStorage에서 저장된 API 키 로드
    this.apiKey = localStorage.getItem(API_KEY_STORAGE_KEY);

    if (this.apiKey) {
      this.initModel(this.apiKey);
    }
  }

  /**
   * API 키 설정 (사용자 입력용)
   */
  setApiKey(apiKey: string): void {
    this.apiKey = apiKey;
    localStorage.setItem(API_KEY_STORAGE_KEY, apiKey);
    this.initModel(apiKey);
  }

  /**
   * API 키가 설정되어 있는지 확인
   */
  hasApiKey(): boolean {
    return this.apiKey !== null && this.apiKey.length > 0;
  }

  /**
   * 저장된 API 키 삭제
   */
  clearApiKey(): void {
    this.apiKey = null;
    this.model = null;
    localStorage.removeItem(API_KEY_STORAGE_KEY);
  }

  private initModel(apiKey: string): void {
    const genAI = new GoogleGenerativeAI(apiKey);
    this.model = genAI.getGenerativeModel({ model: MODEL_NAME });
  }

  async generate(prompt: string): Promise<string> {
    if (!this.model) {
      throw new Error('API 키가 설정되지 않았습니다.');
    }
    const result = await this.model.generateContent(prompt);
    return result.response.text();
  }

  async rateImportance(memory: string): Promise<number> {
    const prompt = `1부터 10까지 점수로 다음 기억의 중요도를 평가하세요.
1: 일상적인 일 (양치질, 식사)
10: 매우 중요한 일 (큰 거래, 중요한 만남)

기억: "${memory}"

숫자만 답하세요.`;

    try {
      const response = await this.generate(prompt);
      const score = parseInt(response.trim(), 10);
      return isNaN(score) ? 5 : Math.min(10, Math.max(1, score));
    } catch {
      return 5;
    }
  }
}

export const gemini = new GeminiClient();
