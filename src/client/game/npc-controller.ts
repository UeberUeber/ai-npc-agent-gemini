/**
 * NPC Controller
 *
 * NPC 하나를 담당하여 Planning → 실제 이동을 연동
 * - 장소명 → 좌표 변환
 * - 계획 변경 시 이동 트리거
 * - 상태 전이 관리 (자는 중 → 기상 → 이동 → 활동)
 */

import { NPCAgent, DailyPlanItem } from '../agent';
import { GameWorld, Position, Direction } from './world';
import { NpcDefinition, NpcState, LocationDef } from '../npcs/types';

export interface NpcControllerOptions {
  onLog?: (message: string, type: 'info' | 'success' | 'warning') => void;
  onStateChange?: (state: NpcState, npcId: string) => void;
  onArrival?: (location: string, npcId: string) => void;
}

export class NpcController {
  private definition: NpcDefinition;
  private agent: NPCAgent;
  private world: GameWorld;
  private state: NpcState = 'sleeping';
  private options: NpcControllerOptions;
  private currentTargetLocation: string | null = null;

  constructor(
    definition: NpcDefinition,
    agent: NPCAgent,
    world: GameWorld,
    options: NpcControllerOptions = {}
  ) {
    this.definition = definition;
    this.agent = agent;
    this.world = world;
    this.options = options;

    // Agent에 로그 콜백 연결
    if (options.onLog) {
      agent.setLogCallback(options.onLog);
    }
  }

  // ============================================================
  // 초기화
  // ============================================================

  /**
   * 월드에 NPC 배치 (벽, 오브젝트, NPC 스폰)
   */
  setupWorld(): void {
    const { worldSetup } = this.definition;

    // 벽 배치
    for (const wall of worldSetup.walls) {
      this.world.addBlockedTile(wall.position.x, wall.position.y, {
        label: wall.label,
        emoji: wall.emoji,
        blocksVision: wall.blocksVision,
      });
    }

    // 오브젝트 배치
    for (const obj of worldSetup.objects) {
      this.world.addObject({
        id: obj.id,
        name: obj.name,
        emoji: obj.emoji,
        position: obj.position,
        description: obj.description,
        state: obj.initialState,
        blocksMovement: obj.blocksMovement,
        blocksVision: obj.blocksVision,
      });
    }

    // NPC 스폰
    this.world.addNpc({
      id: this.definition.id,
      emoji: this.definition.emoji,
      position: worldSetup.spawnPosition,
      name: this.definition.persona.name,
      facing: worldSetup.spawnFacing ?? 'down',
      visionRange: worldSetup.visionRange ?? 3,
    });

    this.log(`${this.definition.persona.name} 월드 배치 완료`, 'success');
  }

  // ============================================================
  // 장소 변환
  // ============================================================

  /**
   * 장소명 → 좌표 변환
   * 부분 매칭 지원 (예: "대장간 내부, 모루 앞" → "대장간 내부" 또는 "모루")
   */
  resolveLocation(locationName: string): LocationDef | null {
    if (!locationName) return null;

    // 정확히 일치
    if (this.definition.locations[locationName]) {
      return this.definition.locations[locationName];
    }

    // 부분 매칭 (장소명이 location에 포함되어 있는지)
    for (const [key, value] of Object.entries(this.definition.locations)) {
      if (locationName.includes(key) || key.includes(locationName)) {
        return value;
      }
    }

    // 키워드 매칭
    const keywords = locationName.split(/[,\s]+/);
    for (const keyword of keywords) {
      if (keyword.length < 2) continue;
      for (const [key, value] of Object.entries(this.definition.locations)) {
        if (key.includes(keyword)) {
          return value;
        }
      }
    }

    return null;
  }

  // ============================================================
  // 상태 전이
  // ============================================================

  private setState(newState: NpcState): void {
    if (this.state !== newState) {
      this.state = newState;
      this.options.onStateChange?.(newState, this.definition.id);
    }
  }

  getState(): NpcState {
    return this.state;
  }

  // ============================================================
  // 이동
  // ============================================================

  /**
   * NPC를 특정 장소로 이동
   */
  moveTo(locationName: string, onArrival?: () => void): boolean {
    const location = this.resolveLocation(locationName);

    if (!location) {
      this.log(`⚠️ 장소를 찾을 수 없음: ${locationName}`, 'warning');
      return false;
    }

    this.currentTargetLocation = locationName;
    this.setState('moving');

    const arrived = () => {
      this.setState('working');
      this.currentTargetLocation = null;

      // 방향 설정
      if (location.facing) {
        this.world.setNpcFacing(this.definition.id, location.facing);
      }

      this.options.onArrival?.(locationName, this.definition.id);
      onArrival?.();
    };

    return this.world.moveNpcTo(this.definition.id, location.position, arrived);
  }

  /**
   * 현재 이동 중단
   */
  stopMovement(): void {
    this.world.stopNpcMovement(this.definition.id);
    this.currentTargetLocation = null;
    this.setState('idle');
  }

  // ============================================================
  // Planning 연동
  // ============================================================

  /**
   * NPC 기상 (하루 시작)
   */
  async wakeUp(day: number): Promise<DailyPlanItem[]> {
    this.log('☀️ NPC 기상 중...', 'info');
    this.setState('waking_up');

    // 침대 상태 변경
    const bedId = `bed_${this.definition.id.split('_')[1]}`;
    this.world.updateObjectState(bedId, '비어있음');

    try {
      // 하루 계획 생성
      const plan = await this.agent.wakeUp('06:00');

      // 첫 번째 계획 장소로 이동
      if (plan.length > 0 && plan[0].location) {
        this.moveTo(plan[0].location, () => {
          this.log(`📍 ${plan[0].location} 도착, ${plan[0].activity}`, 'info');
        });
      }

      this.log(`📋 ${day}일차: ${plan.length}개 일정 생성`, 'success');
      return plan;
    } catch (error) {
      console.error('NPC 기상 오류:', error);
      this.log('⚠️ 계획 생성 실패', 'warning');
      this.setState('idle');
      return [];
    }
  }

  /**
   * NPC 취침 (하루 종료)
   */
  async sleep(): Promise<void> {
    this.log('🌙 NPC 취침 중... 침대로 이동', 'info');

    // 침대 위치로 이동
    this.moveTo('침대', async () => {
      this.log('🛏️ 침대 도착, 취침', 'info');
      this.setState('sleeping');

      // 침대 상태 변경
      const bedId = `bed_${this.definition.id.split('_')[1]}`;
      this.world.updateObjectState(bedId, `${this.definition.persona.name}이 자는 중`);

      try {
        await this.agent.sleep();
      } catch (error) {
        console.error('NPC 취침 오류:', error);
      }
    });
  }

  /**
   * 시간에 따라 계획 진행 및 이동
   */
  updatePlanProgress(currentTime: string): { changed: boolean; newActivity?: DailyPlanItem } {
    const result = this.agent.updatePlanProgress(currentTime);

    if (result.changed && result.newActivity) {
      const { activity, location } = result.newActivity;

      this.log(`📍 활동 변경: ${activity}`, 'info');

      // 장소가 변경되면 이동
      if (location) {
        this.moveTo(location, () => {
          this.log(`✓ ${location} 도착`, 'info');
        });
      }
    }

    return result;
  }

  // ============================================================
  // 유틸리티
  // ============================================================

  private log(message: string, type: 'info' | 'success' | 'warning'): void {
    this.options.onLog?.(message, type);
  }

  getId(): string {
    return this.definition.id;
  }

  getAgent(): NPCAgent {
    return this.agent;
  }

  getDefinition(): NpcDefinition {
    return this.definition;
  }

  getCurrentTargetLocation(): string | null {
    return this.currentTargetLocation;
  }
}
