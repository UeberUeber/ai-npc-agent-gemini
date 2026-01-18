/**
 * NPC Types
 *
 * NPC의 페르소나, 현재 상태(scratch) 등의 타입을 정의합니다.
 */

/**
 * NPC 페르소나 (고정된 정체성)
 *
 * data/npcs/{npcId}/persona.json 파일에 저장됩니다.
 * 게임 진행 중 변하지 않는 NPC의 핵심 특성입니다.
 */
export interface Persona {
  /** 고유 식별자 (예: "blacksmith_john") */
  id: string;

  /** NPC 이름 (예: "대장장이 존") */
  name: string;

  /** 나이 */
  age: number;

  /** 직업 */
  occupation: string;

  /** 위치 (예: "마을 동쪽 대장간") */
  location: string;

  /**
   * 성격 특성 배열
   * 예: ["성실함", "과묵함", "장인정신", "완고함"]
   */
  traits: string[];

  /**
   * 배경 스토리
   * NPC의 과거, 현재 상황, 동기 등을 자연어로 설명
   */
  backstory: string;

  /**
   * 현재 목표들
   * 예: ["철광석 안정적 수급처 찾기", "룬 각인 검 제작법 완성하기"]
   */
  currentGoals: string[];

  /**
   * 말투 스타일
   * 예: "짧고 직설적인 문장. 존댓말과 반말을 섞어 씀."
   */
  speechStyle: string;
}

/**
 * NPC 감정 상태
 */
export type Mood =
  | 'happy'      // 기쁨
  | 'neutral'    // 평온
  | 'sad'        // 슬픔
  | 'angry'      // 화남
  | 'fearful'    // 두려움
  | 'excited'    // 흥분
  | 'tired'      // 피곤
  | 'curious';   // 호기심

/**
 * NPC 현재 상태 (Scratch)
 *
 * data/npcs/{npcId}/scratch.json 파일에 저장됩니다.
 * 자주 변경되는 현재 상태 정보입니다.
 */
export interface Scratch {
  /** 현재 위치 (예: "대장간 내부, 모루 앞") */
  currentLocation: string;

  /** 현재 하고 있는 행동 (예: "검 손잡이를 다듬는 중") */
  currentActivity: string;

  /** 현재 감정 상태 */
  currentMood: Mood;

  /**
   * 오늘의 계획 (시간별)
   * 예: ["07:00 - 기상", "08:00 - 대장간 화덕 점화", ...]
   */
  todaysPlan: string[];

  /** 현재 시뮬레이션 시간 (예: "14:30") */
  currentTime: string;

  /** 깨어있는지 여부 */
  awake: boolean;
}

/**
 * 대화 메시지
 */
export interface ChatMessage {
  /** 발화자 ("user" 또는 NPC id) */
  speaker: string;

  /** 메시지 내용 */
  content: string;

  /** 발화 시간 */
  timestamp: string;
}
