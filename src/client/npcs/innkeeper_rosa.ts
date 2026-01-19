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
  currentTime: '06:15',
  isAwake: false,
};

// ============================================================
// 초기 지식 (메모리로 저장됨)
// ============================================================

export const innkeeperKnowledge: string[] = [
  // 마을 지도 지식 (좌표계: x는 동서, y는 남북. 0,0이 북서쪽 모서리)
  '마을은 15x15 크기다. x좌표는 동쪽으로 갈수록, y좌표는 남쪽으로 갈수록 커진다.',

  // 여관 좌표 지식
  '나의 여관 "붉은 달 여관"은 마을 남쪽에 있다. 입구는 (4,11)이고, 내부 영역은 x:2-7, y:8-10이다.',
  '여관 안에 주방이 (2,9)에 있다. 주방에서 요리를 한다.',
  '여관 안에 카운터가 (4,10)에 있다. 카운터에서 손님을 맞이한다.',
  '여관에 식탁이 2개 있다. (7,8)과 (7,10)에 있다.',
  '여관에서 여행자에게 숙박을 제공한다. 2층에 객실이 있다.',
  '식사와 술을 판매한다. 보리 스튜가 가장 인기 있다.',
  '여행자들에게서 바깥 세상 소식을 들을 수 있다. 여관은 마을의 정보 중심지다.',
  '낮에는 여관에서 일을 해야 한다. 손님을 맞이하고 요리를 해야 여관이 운영된다.',

  // 집 좌표 지식
  '여관 동쪽에 나의 집이 있다. 입구는 (12,11)이고, 내부 영역은 x:11-12, y:8-10이다.',
  '집 안에 침대가 (11,8)에 있다. 침대에서 잠을 잔다.',

  // 대장간 관련 (방문 불가 - 여관 운영 때문)
  '대장장이 존이 마을 북쪽에서 대장간을 운영한다. 존은 오랜 단골이라 점심때 여관에 자주 온다.',
  '나는 여관을 비울 수 없어서 대장간에 직접 갈 일은 없다. 존이 여관으로 와야 한다.',

  // 가능한 활동 지식 (시간대별 위치 명시)
  '나는 여관주인이다. 손님에게 음식과 숙박을 제공한다.',
  '요리할 때는 반드시 "주방"으로 가야 한다. 주방에서 보리 스튜, 구운 고기, 빵 등을 만든다.',
  '손님을 맞이하거나 대기할 때는 반드시 "카운터"에 있어야 한다. 카운터에서 주문을 받고 대금을 받는다.',
  '오전(09:00~12:00)과 오후(13:00~17:00)에는 "카운터"에서 손님을 맞이한다.',
  '손님들에게서 마을 소식과 바깥 세상 이야기를 듣는다.',
  '밤에는 "집"에 가서 "침대"에서 잠을 잔다. 잠을 자야 피로가 풀리고 체력이 회복된다.',
];

// ============================================================
// 장소 매핑 (계획의 location → 실제 좌표)
// ============================================================

export const innkeeperLocations: Record<string, LocationDef> = {
  // 집 관련 (입구: x:12, y:11)
  '집': { position: { x: 12, y: 9 }, facing: 'left', description: '로사의 집', entrance: { x: 12, y: 11 } },
  '침대': { position: { x: 12, y: 8 }, facing: 'left', description: '로사의 침대 옆', entrance: { x: 12, y: 11 } },

  // 여관 관련 (입구: x:4-5, y:11)
  '여관': { position: { x: 4, y: 9 }, facing: 'down', description: '여관 메인 홀', entrance: { x: 4, y: 11 } },
  '붉은 달 여관': { position: { x: 4, y: 9 }, facing: 'down', description: '여관 메인 홀', entrance: { x: 4, y: 11 } },
  '카운터': { position: { x: 4, y: 10 }, facing: 'up', description: '접수 카운터', entrance: { x: 4, y: 11 } },
  '주방': { position: { x: 2, y: 9 }, facing: 'right', description: '주방 조리대 앞', entrance: { x: 4, y: 11 } },
  '식탁': { position: { x: 4, y: 9 }, facing: 'down', description: '손님 식탁 앞', entrance: { x: 4, y: 11 } },

  // 기타 (야외 장소는 entrance 없음)
  '마을 거리': { position: { x: 7, y: 5 }, facing: 'down', description: '마을 중앙' },
  // 대장간은 제거 - 로사는 여관을 운영해야 해서 대장간에 갈 일이 없음 (존이 점심에 여관으로 옴)
};

// ============================================================
// 영역 정의 (좌표 → 장소명 역변환용)
// ============================================================

export const innkeeperAreas: AreaDef[] = [
  // 집이 여관보다 우선순위 높음 (더 구체적인 장소)
  { name: '집', minX: 11, maxX: 12, minY: 8, maxY: 10, priority: 10 },
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
  // 식탁 (2개) - 손님이 식사하는 곳
  {
    id: 'table_1',
    name: '식탁',
    emoji: '🍽️',
    position: { x: 7, y: 8 },
    description: '손님이 식사할 수 있는 테이블',
    initialState: '비어 있음',
    blocksMovement: true,
    blocksVision: false,
  },
  {
    id: 'table_2',
    name: '식탁',
    emoji: '🍽️',
    position: { x: 7, y: 10 },
    description: '손님이 식사할 수 있는 테이블',
    initialState: '비어 있음',
    blocksMovement: true,
    blocksVision: false,
  },
  {
    id: 'counter_rosa',
    name: '카운터',
    emoji: '🧾',
    position: { x: 4, y: 10 },
    description: '손님을 맞이하고 주문을 받는 카운터',
    initialState: '영업 중',
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
