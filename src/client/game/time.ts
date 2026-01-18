/**
 * 게임 내 시간 시스템
 *
 * 실시간 → 게임 시간 변환
 * 예: timeScale=1 이면 실시간 1초 = 게임 1분
 *     timeScale=60 이면 실시간 1초 = 게임 1시간
 */

export type TimePeriod = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

export interface GameTimeState {
  day: number;
  hour: number;
  minute: number;
  period: TimePeriod;
  formatted: string; // "2:30 PM"
  formatted24: string; // "14:30"
  periodKorean: string; // "오후"
}

export interface GameTimeOptions {
  startDay?: number; // 시작 일차 (기본 1)
  startHour?: number; // 시작 시간 (기본 6)
  startMinute?: number; // 시작 분 (기본 0)
  timeScale?: number; // 실시간 1초 = 게임 N분 (기본 1)
  onTimeChange?: (state: GameTimeState) => void;
  onPeriodChange?: (period: TimePeriod, state: GameTimeState) => void;
  onDayChange?: (day: number, state: GameTimeState) => void;
}

const PERIOD_KOREAN: Record<TimePeriod, string> = {
  dawn: '새벽',
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
  night: '밤',
};

export class GameTime {
  private day: number;
  private hour: number;
  private minute: number;
  private timeScale: number;
  private intervalId: number | null = null;
  private lastPeriod: TimePeriod;

  private onTimeChange?: (state: GameTimeState) => void;
  private onPeriodChange?: (period: TimePeriod, state: GameTimeState) => void;
  private onDayChange?: (day: number, state: GameTimeState) => void;

  constructor(options: GameTimeOptions = {}) {
    this.day = options.startDay ?? 1;
    this.hour = options.startHour ?? 6;
    this.minute = options.startMinute ?? 0;
    this.timeScale = options.timeScale ?? 1;
    this.onTimeChange = options.onTimeChange;
    this.onPeriodChange = options.onPeriodChange;
    this.onDayChange = options.onDayChange;
    this.lastPeriod = this.getPeriod();
  }

  /**
   * 시간대 판별
   */
  private getPeriod(): TimePeriod {
    if (this.hour >= 5 && this.hour < 7) return 'dawn';
    if (this.hour >= 7 && this.hour < 12) return 'morning';
    if (this.hour >= 12 && this.hour < 18) return 'afternoon';
    if (this.hour >= 18 && this.hour < 21) return 'evening';
    return 'night';
  }

  /**
   * 현재 상태 반환
   */
  getState(): GameTimeState {
    const period = this.getPeriod();
    return {
      day: this.day,
      hour: this.hour,
      minute: this.minute,
      period,
      formatted: this.formatTime12h(),
      formatted24: this.formatTime24h(),
      periodKorean: PERIOD_KOREAN[period],
    };
  }

  /**
   * 24시간 형식 (HH:MM)
   */
  formatTime24h(): string {
    const h = this.hour.toString().padStart(2, '0');
    const m = this.minute.toString().padStart(2, '0');
    return `${h}:${m}`;
  }

  /**
   * 12시간 형식 (H:MM AM/PM)
   */
  formatTime12h(): string {
    const isPM = this.hour >= 12;
    const h12 = this.hour % 12 || 12; // 0시 → 12, 13시 → 1
    const m = this.minute.toString().padStart(2, '0');
    return `${h12}:${m} ${isPM ? 'PM' : 'AM'}`;
  }

  /**
   * 시간 경과 (분 단위)
   */
  advance(minutes: number = 1): void {
    this.minute += minutes;

    // 분 → 시간 변환
    while (this.minute >= 60) {
      this.minute -= 60;
      this.hour++;
    }
    while (this.minute < 0) {
      this.minute += 60;
      this.hour--;
    }

    // 시간 → 일 변환
    while (this.hour >= 24) {
      this.hour -= 24;
      this.day++;
      this.onDayChange?.(this.day, this.getState());
    }
    while (this.hour < 0) {
      this.hour += 24;
      this.day--;
    }

    // 시간대 변경 체크
    const currentPeriod = this.getPeriod();
    if (currentPeriod !== this.lastPeriod) {
      this.lastPeriod = currentPeriod;
      this.onPeriodChange?.(currentPeriod, this.getState());
    }

    this.onTimeChange?.(this.getState());
  }

  /**
   * 특정 시간으로 설정
   */
  setTime(hour: number, minute: number = 0): void {
    this.hour = Math.max(0, Math.min(23, hour));
    this.minute = Math.max(0, Math.min(59, minute));
    this.advance(0); // 콜백 트리거
  }

  /**
   * 특정 일차로 설정
   */
  setDay(day: number): void {
    this.day = Math.max(1, day);
    this.onDayChange?.(this.day, this.getState());
    this.onTimeChange?.(this.getState());
  }

  /**
   * 자동 시간 경과 시작
   */
  start(): void {
    if (this.intervalId !== null) return;

    this.intervalId = window.setInterval(() => {
      this.advance(this.timeScale);
    }, 1000);
  }

  /**
   * 자동 시간 경과 일시정지
   */
  pause(): void {
    if (this.intervalId !== null) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  /**
   * 실행 중인지 확인
   */
  isRunning(): boolean {
    return this.intervalId !== null;
  }

  /**
   * 시간 배속 설정
   */
  setTimeScale(scale: number): void {
    this.timeScale = Math.max(0.1, scale);
  }

  /**
   * 정리
   */
  destroy(): void {
    this.pause();
  }
}
