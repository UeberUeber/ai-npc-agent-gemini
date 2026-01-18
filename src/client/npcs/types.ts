/**
 * NPC 정의 타입
 *
 * 새 NPC 추가 시 이 인터페이스를 구현하면 됨
 */

import { Persona, Scratch } from '../agent';
import { Position, Direction } from '../game/world';

// 장소 정의
export interface LocationDef {
  position: Position;
  facing?: Direction;  // 도착 시 바라볼 방향
  description?: string;
}

// 벽 정의
export interface WallDef {
  position: Position;
  label?: string;
  emoji?: string;
  blocksVision?: boolean;
}

// 오브젝트 정의
export interface ObjectDef {
  id: string;
  name: string;
  emoji: string;
  position: Position;
  description?: string;
  initialState?: string;
  blocksMovement?: boolean;
  blocksVision?: boolean;
}

// NPC 월드 배치 정보
export interface NpcWorldSetup {
  // NPC 스폰 정보
  spawnPosition: Position;
  spawnFacing?: Direction;
  visionRange?: number;

  // 소유 건물/영역
  walls: WallDef[];
  objects: ObjectDef[];
}

// NPC 전체 정의
export interface NpcDefinition {
  // 기본 정보
  id: string;
  emoji: string;

  // Agent 관련
  persona: Persona;
  scratch: Scratch;
  knowledge: string[];  // 초기 지식

  // 장소 매핑 (계획의 location → 실제 좌표)
  locations: Record<string, LocationDef>;

  // 월드 배치
  worldSetup: NpcWorldSetup;
}

// NPC 상태 (런타임)
export type NpcState =
  | 'sleeping'      // 자는 중
  | 'waking_up'     // 기상 중
  | 'moving'        // 이동 중
  | 'working'       // 활동 중
  | 'idle';         // 대기

// NPC 이벤트
export interface NpcEvent {
  type: 'arrival' | 'activity_change' | 'state_change';
  npcId: string;
  data?: unknown;
}
