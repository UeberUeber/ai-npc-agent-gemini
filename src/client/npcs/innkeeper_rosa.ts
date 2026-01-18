/**
 * 여관주인 로사 - NPC 정의
 *
 * 붉은 달 여관을 운영하는 중년 여성
 */

import { Persona, Scratch } from '../agent';
import { NpcDefinition, LocationDef, WallDef, ObjectDef, AreaDef } from './types';

// ============================================================
// 기본 정보
// ============================================================

export const innkeeperPersona: Persona = {
  id: 'innkeeper_rosa',
  name: '여관주인 로사',
  age: 38,
  occupation: '여관주인',
  location: '붉은 달 여관',
  traits: ['친절함', '수다스러움', '정보통', '요리솜씨'],
  backstory:
    '로사는 15년 전 남편과 함께 붉은 달 여관을 열었다. 5년 전 남편이 병으로 세상을 떠난 후 혼자 여관을 운영하고 있다. 마을을 오가는 상인과 여행자들에게 음식과 잠자리를 제공하며, 자연스럽게 마을의 정보통이 되었다. 특히 그녀가 만드는 보리 스튜는 마을 명물이다. 손님들의 이야기를 듣는 것을 좋아하고, 고민 상담도 잘 해준다.',
  currentGoals: ['새로운 요리 레시피 개발', '여관 2층 수리'],
  speechStyle: '따뜻하고 다정한 존댓말. 예: "어서 오세요~", "오늘 스튜가 잘 됐어요!", "뭐 좀 드실래요?" 가끔 수다가 길어짐.',
};

export const innkeeperScratch: Scratch = {
  currentLocation: '집',
  currentActivity: '잠자는 중',
  currentMood: 'neutral',
  currentTime: '06:00',
  isAwake: false,
};

// ============================================================
// 초기 지식 (메모리로 저장됨)
// ============================================================

export const innkeeperKnowledge: string[] = [
  // 장소 지식
  '나의 여관은 마을 남쪽에 있다. 붉은 달 여관이라고 불린다.',
  '여관 1층은 식당이고, 2층에는 손님방이 있다.',
  '여관 뒤편에 나의 침실이 있다. 거기서 잠을 잔다.',

  // 도구/오브젝트 지식
  '여관에는 주방이 있다. 주방에서 요리를 한다.',
  '여관에는 카운터가 있다. 카운터에서 손님을 맞이하고 계산을 한다.',
  '침실에는 침대가 있다. 침대에서 잠을 잔다.',

  // 가능한 활동 지식
  '나는 여관주인이다. 손님에게 음식과 숙박을 제공한다.',
  '주방에서 보리 스튜, 구운 고기, 빵 등을 만들 수 있다.',
  '손님들에게서 마을 소식과 바깥 세상 이야기를 듣는다.',
  '피곤하면 뒤편 침실에서 잠을 잔다.',

  // 관계 지식
  '대장장이 존은 오랜 단골이다. 과묵하지만 좋은 사람이다.',
];

// ============================================================
// 장소 매핑 (계획의 location → 실제 좌표)
// ============================================================

export const innkeeperLocations: Record<string, LocationDef> = {
  // 침실 관련
  '집': { position: { x: 12, y: 9 }, facing: 'left', description: '로사의 침실' },
  '침실': { position: { x: 12, y: 9 }, facing: 'left', description: '로사의 침실' },
  '침대': { position: { x: 12, y: 8 }, facing: 'left', description: '로사의 침대 옆' },

  // 여관 관련
  '여관': { position: { x: 4, y: 9 }, facing: 'down', description: '여관 메인 홀' },
  '붉은 달 여관': { position: { x: 4, y: 9 }, facing: 'down', description: '여관 메인 홀' },
  '카운터': { position: { x: 7, y: 8 }, facing: 'left', description: '접수 카운터' },
  '주방': { position: { x: 2, y: 8 }, facing: 'right', description: '주방 조리대 앞' },
  '식탁': { position: { x: 4, y: 9 }, facing: 'down', description: '손님 식탁 앞' },

  // 기타
  '마을 거리': { position: { x: 7, y: 5 }, facing: 'down', description: '마을 중앙' },
};

// ============================================================
// 영역 정의 (좌표 → 장소명 역변환용)
// ============================================================

export const innkeeperAreas: AreaDef[] = [
  // 침실이 여관보다 우선순위 높음 (더 구체적인 장소)
  { name: '침실', minX: 11, maxX: 12, minY: 8, maxY: 10, priority: 10 },
  // 여관 내부 전체
  { name: '여관', minX: 2, maxX: 7, minY: 8, maxY: 10, priority: 0 },
];

// ============================================================
// 월드 배치 정보 (여관: 8x5, 대장간 5x4보다 큼)
// ============================================================

const walls: WallDef[] = [
  // 여관 건물 상단 (x:1-8, y:7)
  { position: { x: 1, y: 7 }, blocksVision: true },
  { position: { x: 2, y: 7 }, blocksVision: true },
  { position: { x: 3, y: 7 }, blocksVision: true },
  { position: { x: 4, y: 7 }, label: '붉은달여관', blocksVision: true },
  { position: { x: 5, y: 7 }, blocksVision: true },
  { position: { x: 6, y: 7 }, blocksVision: true },
  { position: { x: 7, y: 7 }, blocksVision: true },
  { position: { x: 8, y: 7 }, blocksVision: true },
  // 여관 측면
  { position: { x: 1, y: 8 }, blocksVision: true },
  { position: { x: 8, y: 8 }, blocksVision: true },
  { position: { x: 1, y: 9 }, blocksVision: true },
  { position: { x: 8, y: 9 }, blocksVision: true },
  { position: { x: 1, y: 10 }, blocksVision: true },
  { position: { x: 8, y: 10 }, blocksVision: true },
  // 여관 하단 (입구: x:4,5)
  { position: { x: 1, y: 11 }, blocksVision: true },
  { position: { x: 2, y: 11 }, blocksVision: true },
  { position: { x: 3, y: 11 }, blocksVision: true },
  { position: { x: 6, y: 11 }, blocksVision: true },
  { position: { x: 7, y: 11 }, blocksVision: true },
  { position: { x: 8, y: 11 }, blocksVision: true },

  // 로사의 침실 (여관 오른쪽, x:10-13, y:7-11)
  { position: { x: 10, y: 7 }, blocksVision: true },
  { position: { x: 11, y: 7 }, label: '로사의집', blocksVision: true },
  { position: { x: 12, y: 7 }, blocksVision: true },
  { position: { x: 13, y: 7 }, blocksVision: true },
  // 침실 측면
  { position: { x: 10, y: 8 }, blocksVision: true },
  { position: { x: 13, y: 8 }, blocksVision: true },
  { position: { x: 10, y: 9 }, blocksVision: true },
  { position: { x: 13, y: 9 }, blocksVision: true },
  { position: { x: 10, y: 10 }, blocksVision: true },
  { position: { x: 13, y: 10 }, blocksVision: true },
  // 침실 하단 (입구: x:12 -> 여관쪽 통로)
  { position: { x: 10, y: 11 }, blocksVision: true },
  { position: { x: 11, y: 11 }, blocksVision: true },
  { position: { x: 13, y: 11 }, blocksVision: true },
];

const objects: ObjectDef[] = [
  // 여관 오브젝트
  {
    id: 'kitchen_rosa',
    name: '주방',
    emoji: '🍳',
    position: { x: 2, y: 9 },
    description: '요리를 만드는 주방',
    initialState: '사용 가능',
    blocksMovement: true,
    blocksVision: false,
  },
  // 식탁 (여러 개) - 손님이 식사하는 곳
  {
    id: 'table_1',
    name: '식탁',
    emoji: '🍽️',
    position: { x: 3, y: 9 },
    description: '손님이 식사할 수 있는 테이블',
    initialState: '비어 있음',
    blocksMovement: true,
    blocksVision: false,
  },
  {
    id: 'table_2',
    name: '식탁',
    emoji: '🍽️',
    position: { x: 5, y: 9 },
    description: '손님이 식사할 수 있는 테이블',
    initialState: '비어 있음',
    blocksMovement: true,
    blocksVision: false,
  },
  {
    id: 'table_3',
    name: '식탁',
    emoji: '🍽️',
    position: { x: 4, y: 10 },
    description: '손님이 식사할 수 있는 테이블',
    initialState: '비어 있음',
    blocksMovement: true,
    blocksVision: false,
  },
  {
    id: 'table_4',
    name: '식탁',
    emoji: '🍽️',
    position: { x: 6, y: 10 },
    description: '손님이 식사할 수 있는 테이블',
    initialState: '비어 있음',
    blocksMovement: true,
    blocksVision: false,
  },

  // 침실 오브젝트
  {
    id: 'bed_rosa',
    name: '침대',
    emoji: '🛏️',
    position: { x: 11, y: 8 },
    description: '로사가 잠을 자는 침대',
    initialState: '로사가 자는 중',
    blocksMovement: true,
    blocksVision: false,
  },
];

// ============================================================
// 통합 NPC 정의 (NpcController에서 사용)
// ============================================================

export const innkeeperRosa: NpcDefinition = {
  id: 'innkeeper_rosa',
  emoji: '👩‍🍳',

  persona: innkeeperPersona,
  scratch: innkeeperScratch,
  knowledge: innkeeperKnowledge,

  locations: innkeeperLocations,
  areas: innkeeperAreas,

  worldSetup: {
    // 시작 위치: 침실에서 자는 상태
    spawnPosition: { x: 12, y: 8 },
    spawnFacing: 'left',
    visionRange: 2,

    walls,
    objects,
  },
};

// 기본 export
export default innkeeperRosa;
