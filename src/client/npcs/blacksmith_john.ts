/**
 * 대장장이 존 - NPC 정의
 *
 * 새 NPC 추가 시 이 파일을 참고하여 동일한 구조로 만들면 됨
 */

import { Persona, Scratch } from '../agent';
import { NpcDefinition, LocationDef, WallDef, ObjectDef, AreaDef } from './types';

// ============================================================
// 기본 정보
// ============================================================

export const blacksmithPersona: Persona = {
  id: 'blacksmith_john',
  name: '대장장이 존',
  age: 45,
  occupation: '대장장이',
  location: '마을 동쪽 대장간',
  traits: ['성실함', '과묵함', '장인정신', '완고함'],
  backstory:
    '존은 20년간 윈터홀드 마을의 유일한 대장장이로 일해왔다. 그의 아버지도, 할아버지도 대장장이였다. 젊은 시절 왕국 기사단의 검을 만들어 명성을 얻었지만, 10년 전 아내를 잃은 후로는 마을에 틀어박혀 조용히 일만 한다. 말수가 적지만, 좋은 무기를 알아보는 손님에게는 은근히 호감을 보인다. 최근 마을에 몬스터 출몰이 잦아져 무기 주문이 늘었지만, 철광석 수급이 어려워 고민이 많다.',
  currentGoals: ['철광석 안정적 수급처 찾기', '아버지에게 물려받은 룬 각인 검 제작법 완성하기'],
  speechStyle: '짧고 직설적인 반말. 예: "왔나.", "뭐 필요해?", "이건 좋은 물건이야." 무기 이야기할 때만 말이 길어짐.',
};

export const blacksmithScratch: Scratch = {
  currentLocation: '집',
  currentActivity: '잠자는 중',
  currentMood: 'neutral',
  currentTime: '06:00',
  isAwake: false,  // 시작 시 자는 상태
};

// ============================================================
// 초기 지식 (메모리로 저장됨)
// ============================================================

export const blacksmithKnowledge: string[] = [
  // 마을 지도 지식 (좌표계: x는 동서, y는 남북. 0,0이 북서쪽 모서리)
  '마을은 15x15 크기다. x좌표는 동쪽으로 갈수록, y좌표는 남쪽으로 갈수록 커진다.',

  // 대장간 좌표 지식
  '나의 대장간은 마을 북쪽에 있다. 입구는 (3,4)이고, 내부 영역은 x:2-4, y:2-3이다.',
  '대장간 안에 모루가 (4,2)에 있다. 모루에서 무기를 만든다.',

  // 집 좌표 지식
  '대장간 바로 옆 동쪽에 나의 집이 있다. 입구는 (8,4)이고, 내부 영역은 x:7-8, y:2-3이다.',
  '집 안에 침대가 (7,2)에 있다. 침대에서 잠을 잔다.',

  // 여관 좌표 지식
  '붉은 달 여관은 마을 남쪽에 있다. 입구는 (4,11)이고, 내부 영역은 x:2-7, y:8-10이다.',
  '여관주인 로사가 운영한다. 점심때 자주 간다.',

  // 가능한 활동 지식
  '나는 대장장이다. 모루에서 검, 도끼, 갑옷 등을 만들 수 있다.',
  '손님이 오면 대장간에서 물건을 팔 수 있다.',
  '피곤하면 집에 가서 잠을 잔다.',
];

// ============================================================
// 장소 매핑 (계획의 location → 실제 좌표)
// ============================================================

export const blacksmithLocations: Record<string, LocationDef> = {
  // 집 관련 (입구: x:8, y:4)
  '집': { position: { x: 8, y: 3 }, facing: 'left', description: '존의 집 내부', entrance: { x: 8, y: 4 } },
  '침대': { position: { x: 8, y: 2 }, facing: 'left', description: '존의 침대 옆', entrance: { x: 8, y: 4 } },

  // 대장간 관련 (입구: x:3, y:4)
  '대장간': { position: { x: 3, y: 3 }, facing: 'right', description: '대장간 작업 공간', entrance: { x: 3, y: 4 } },
  '대장간 내부': { position: { x: 3, y: 3 }, facing: 'right', description: '대장간 작업 공간', entrance: { x: 3, y: 4 } },
  '모루': { position: { x: 3, y: 2 }, facing: 'right', description: '모루 앞', entrance: { x: 3, y: 4 } },
  '대장간 뒤편': { position: { x: 2, y: 3 }, facing: 'down', description: '대장간 뒤', entrance: { x: 3, y: 4 } },

  // 기타 (야외 장소는 entrance 없음)
  '마을 거리': { position: { x: 5, y: 5 }, facing: 'down', description: '마을 중앙' },

  // 다른 NPC 장소 (여관 입구: x:4-5, y:11)
  '여관': { position: { x: 4, y: 9 }, facing: 'down', description: '붉은 달 여관', entrance: { x: 4, y: 11 } },
  '붉은 달 여관': { position: { x: 4, y: 9 }, facing: 'down', description: '붉은 달 여관', entrance: { x: 4, y: 11 } },
};

// ============================================================
// 영역 정의 (좌표 → 장소명 역변환용)
// ============================================================

export const blacksmithAreas: AreaDef[] = [
  // 대장간 내부 (벽 x:1-5, y:1-4 → 내부 x:2-4, y:2-3)
  { name: '대장간', minX: 2, maxX: 4, minY: 2, maxY: 3, priority: 0 },
  // 존의 집 내부 (벽 x:6-9, y:1-4 → 내부 x:7-8, y:2-3)
  { name: '집', minX: 7, maxX: 8, minY: 2, maxY: 3, priority: 0 },
];

// ============================================================
// 월드 배치 정보
// ============================================================

const walls: WallDef[] = [
  // 대장간 건물
  { position: { x: 1, y: 1 }, blocksVision: true },
  { position: { x: 2, y: 1 }, blocksVision: true },
  { position: { x: 3, y: 1 }, label: '대장간', blocksVision: true },
  { position: { x: 4, y: 1 }, blocksVision: true },
  { position: { x: 5, y: 1 }, blocksVision: true },
  // 대장간 측면
  { position: { x: 1, y: 2 }, blocksVision: true },
  { position: { x: 5, y: 2 }, blocksVision: true },
  { position: { x: 1, y: 3 }, blocksVision: true },
  { position: { x: 5, y: 3 }, blocksVision: true },
  // 대장간 하단 (입구: x:3)
  { position: { x: 1, y: 4 }, blocksVision: true },
  { position: { x: 2, y: 4 }, blocksVision: true },
  { position: { x: 4, y: 4 }, blocksVision: true },
  { position: { x: 5, y: 4 }, blocksVision: true },

  // 존의 집 건물
  { position: { x: 6, y: 1 }, blocksVision: true },
  { position: { x: 7, y: 1 }, label: '존의집', blocksVision: true },
  { position: { x: 8, y: 1 }, blocksVision: true },
  { position: { x: 9, y: 1 }, blocksVision: true },
  // 집 측면
  { position: { x: 6, y: 2 }, blocksVision: true },
  { position: { x: 9, y: 2 }, blocksVision: true },
  { position: { x: 6, y: 3 }, blocksVision: true },
  { position: { x: 9, y: 3 }, blocksVision: true },
  // 집 하단 (입구: x:8)
  { position: { x: 6, y: 4 }, blocksVision: true },
  { position: { x: 7, y: 4 }, blocksVision: true },
  { position: { x: 9, y: 4 }, blocksVision: true },
];

const objects: ObjectDef[] = [
  // 대장간 오브젝트
  {
    id: 'anvil_john',
    name: '모루',
    emoji: '⚒️',
    position: { x: 4, y: 2 },
    description: '철을 두드려 무기를 만드는 모루',
    initialState: '사용 가능',
    blocksMovement: true,
    blocksVision: false,
  },

  // 집 오브젝트
  {
    id: 'bed_john',
    name: '침대',
    emoji: '🛏️',
    position: { x: 7, y: 2 },
    description: '존이 잠을 자는 침대',
    initialState: '존이 자는 중',  // 시작 시 자는 상태
    blocksMovement: true,
    blocksVision: false,
  },
];

// ============================================================
// 통합 NPC 정의 (NpcController에서 사용)
// ============================================================

export const blacksmithJohn: NpcDefinition = {
  id: 'blacksmith_john',
  emoji: '👨‍🔧',

  persona: blacksmithPersona,
  scratch: blacksmithScratch,
  knowledge: blacksmithKnowledge,

  locations: blacksmithLocations,
  areas: blacksmithAreas,

  worldSetup: {
    // 시작 위치: 집에서 자는 상태
    spawnPosition: { x: 8, y: 2 },
    spawnFacing: 'left',
    visionRange: 2,

    walls,
    objects,
  },
};

// 기본 export
export default blacksmithJohn;
