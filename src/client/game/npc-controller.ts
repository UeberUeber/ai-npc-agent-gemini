/**
 * NPC Controller
 *
 * NPC 하나를 담당하여 Planning → 실제 이동을 연동
 * - 장소명 → 좌표 변환
 * - 계획 변경 시 이동 트리거
 * - 상태 전이 관리 (자는 중 → 기상 → 이동 → 활동)
 */

import { NPCAgent, DailyPlanItem } from '../agent';
import { GameWorld, Position, Entity, NpcEntity, WorldObject } from './world';
import { NpcDefinition, NpcState, LocationDef } from '../npcs/types';

// 인식 캐시: 이미 본 것 추적 (델타 기반 관찰용)
interface PerceptionCache {
  // 엔티티: id → 마지막으로 본 위치 (변화 감지용)
  seenEntities: Map<string, { x: number; y: number }>;
  // 오브젝트: id → 마지막으로 본 상태
  seenObjects: Map<string, string>;
}

// 인식 결과
export interface PerceptionResult {
  newEntities: Array<{ entity: Entity; description: string }>;
  changedObjects: Array<{ object: WorldObject; description: string }>;
  exitedEntities: Array<{ id: string; description: string }>;
}

export interface NpcControllerOptions {
  onLog?: (message: string, type: 'info' | 'success' | 'warning') => void;
  onStateChange?: (state: NpcState, npcId: string) => void;
  onArrival?: (location: string, npcId: string) => void;
  onSpontaneousUtterance?: (utterance: string, npcId: string) => void;  // 자율 발화
  onNpcConversation?: (speakerId: string, speakerName: string, utterance: string) => void;  // NPC간 대화
  getOtherNpcAgent?: (npcId: string) => NPCAgent | null;  // 다른 NPC Agent 가져오기
}

export class NpcController {
  private definition: NpcDefinition;
  private agent: NPCAgent;
  private world: GameWorld;
  private state: NpcState = 'sleeping';
  private options: NpcControllerOptions;
  private currentTargetLocation: string | null = null;

  // 인식 캐시 (델타 기반 관찰)
  private perceptionCache: PerceptionCache = {
    seenEntities: new Map(),
    seenObjects: new Map(),
  };

  // NPC간 대화 추적 (중복 방지)
  private recentNpcConversations: Map<string, number> = new Map();  // npcId → timestamp
  private static NPC_CONVERSATION_COOLDOWN = 60000;  // 1분 쿨다운

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
   * 건물 내부 장소의 경우 입구를 먼저 경유
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

    // 입구가 정의된 경우: 입구 → 목적지 순서로 이동
    if (location.entrance) {
      // 현재 NPC 위치 확인
      const npc = this.world.getNpcs().find(n => n.id === this.definition.id);
      if (npc) {
        // 이미 건물 내부에 있는지 확인 (입구와의 거리로 판단)
        const distToEntrance = Math.abs(npc.position.x - location.entrance.x) +
                               Math.abs(npc.position.y - location.entrance.y);
        const distToTarget = Math.abs(npc.position.x - location.position.x) +
                             Math.abs(npc.position.y - location.position.y);

        // 목적지보다 입구가 멀면 이미 내부에 있을 가능성 → 직접 이동
        if (distToTarget < distToEntrance) {
          return this.world.moveNpcTo(this.definition.id, location.position, arrived);
        }
      }

      // 입구로 먼저 이동, 도착하면 최종 목적지로 이동
      this.log(`🚪 ${locationName} 입구로 이동`, 'info');
      return this.world.moveNpcTo(this.definition.id, location.entrance, () => {
        this.log(`🚪 입구 도착, 내부로 진입`, 'info');
        this.world.moveNpcTo(this.definition.id, location.position, arrived);
      });
    }

    // 입구가 없는 경우: 직접 이동
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
  // 인식 시스템 (Perception)
  // ============================================================

  /**
   * 시야 내 환경을 인식하고 변화를 감지
   * - 새로 나타난 엔티티 (플레이어, 다른 NPC)
   * - 상태가 변한 오브젝트
   * - 시야에서 사라진 엔티티
   */
  perceive(): PerceptionResult {
    const result: PerceptionResult = {
      newEntities: [],
      changedObjects: [],
      exitedEntities: [],
    };

    // NPC 엔티티 가져오기
    const npcEntity = this.world.getNpcs().find(n => n.id === this.definition.id);
    if (!npcEntity) return result;

    // 현재 시야 내 엔티티/오브젝트
    const { player, npcs } = this.world.getVisibleEntities(npcEntity);
    const visibleObjects = this.world.getVisibleObjects(npcEntity);

    // 현재 보이는 엔티티 ID 세트
    const currentlyVisible = new Set<string>();

    // 1. 플레이어 인식
    if (player) {
      currentlyVisible.add(player.id);
      const lastPos = this.perceptionCache.seenEntities.get(player.id);

      if (!lastPos) {
        // 새로 발견
        const desc = this.describeEntity(player, '시야에 나타났다');
        result.newEntities.push({ entity: player, description: desc });
        this.perceptionCache.seenEntities.set(player.id, { ...player.position });
      } else if (lastPos.x !== player.position.x || lastPos.y !== player.position.y) {
        // 위치 변경 (선택적: 움직임 추적)
        this.perceptionCache.seenEntities.set(player.id, { ...player.position });
      }
    }

    // 2. 다른 NPC 인식
    for (const otherNpc of npcs) {
      currentlyVisible.add(otherNpc.id);
      const lastPos = this.perceptionCache.seenEntities.get(otherNpc.id);

      if (!lastPos) {
        const desc = this.describeEntity(otherNpc, '시야에 나타났다');
        result.newEntities.push({ entity: otherNpc, description: desc });
        this.perceptionCache.seenEntities.set(otherNpc.id, { ...otherNpc.position });
      } else if (lastPos.x !== otherNpc.position.x || lastPos.y !== otherNpc.position.y) {
        this.perceptionCache.seenEntities.set(otherNpc.id, { ...otherNpc.position });
      }
    }

    // 3. 시야에서 사라진 엔티티 감지
    for (const [entityId, _pos] of this.perceptionCache.seenEntities) {
      if (!currentlyVisible.has(entityId)) {
        const desc = `${this.getEntityName(entityId)}이(가) 시야에서 사라졌다`;
        result.exitedEntities.push({ id: entityId, description: desc });
        this.perceptionCache.seenEntities.delete(entityId);
      }
    }

    // 4. 오브젝트 상태 변화 감지
    for (const obj of visibleObjects) {
      const lastState = this.perceptionCache.seenObjects.get(obj.id);
      const currentState = obj.state || '기본';

      if (lastState === undefined) {
        // 새로 발견한 오브젝트
        const desc = this.describeObject(obj);
        result.changedObjects.push({ object: obj, description: desc });
        this.perceptionCache.seenObjects.set(obj.id, currentState);
      } else if (lastState !== currentState) {
        // 상태 변화
        const desc = `${obj.name}의 상태가 '${lastState}'에서 '${currentState}'(으)로 바뀌었다`;
        result.changedObjects.push({ object: obj, description: desc });
        this.perceptionCache.seenObjects.set(obj.id, currentState);
      }
    }

    return result;
  }

  /**
   * 인식 결과를 메모리에 저장
   */
  async savePerceptions(result: PerceptionResult): Promise<void> {
    const observations: string[] = [];

    for (const { description } of result.newEntities) {
      observations.push(description);
    }
    for (const { description } of result.changedObjects) {
      observations.push(description);
    }
    for (const { description } of result.exitedEntities) {
      observations.push(description);
    }

    // 관찰 내용이 있으면 메모리에 저장
    for (const content of observations) {
      this.agent.addObservation(content);
      this.log(`👁️ ${content}`, 'info');
    }
  }

  /**
   * 인식 실행 + 메모리 저장 (한 번에)
   */
  async perceiveAndRemember(): Promise<PerceptionResult> {
    const result = this.perceive();

    // 기존: 관찰 저장
    if (result.newEntities.length > 0 ||
        result.changedObjects.length > 0 ||
        result.exitedEntities.length > 0) {
      await this.savePerceptions(result);
    }

    // 플레이어 감지 시 자율 발화 트리거
    const playerDetected = result.newEntities.find(e => e.entity.id === 'player');
    if (playerDetected) {
      await this.tryInitiateConversation(playerDetected.description);
    }

    // NPC 감지 시 NPC간 대화 트리거
    const npcDetected = result.newEntities.find(
      e => e.entity.id !== 'player' && e.entity.id !== this.definition.id
    );
    if (npcDetected) {
      await this.tryConversationWithNpc(npcDetected.entity.id, npcDetected.entity.name || npcDetected.entity.id, npcDetected.description);
    }

    return result;
  }

  /**
   * 자율 발화 시도 (논문: Reaction & Dialogue System)
   */
  private async tryInitiateConversation(observation: string): Promise<void> {
    this.log('🎯 플레이어 감지! 반응 판단 중...', 'info');

    const shouldReact = await this.agent.shouldInitiateConversation(observation);

    if (!shouldReact) {
      this.log('💭 반응하지 않기로 결정', 'info');
      return;
    }

    this.log('💬 자발적 발화 생성 중...', 'info');
    const utterance = await this.agent.generateSpontaneousUtterance(observation);

    // UI에 전달
    this.options.onSpontaneousUtterance?.(utterance, this.definition.id);
    this.log(`🗣️ "${utterance.slice(0, 30)}..."`, 'success');
  }

  /**
   * NPC간 대화 시도
   */
  private async tryConversationWithNpc(targetId: string, targetName: string, observation: string): Promise<void> {
    // 쿨다운 체크 (최근에 대화했으면 스킵)
    const lastConvo = this.recentNpcConversations.get(targetId);
    if (lastConvo && Date.now() - lastConvo < NpcController.NPC_CONVERSATION_COOLDOWN) {
      return;
    }

    // 자는 중이면 스킵
    if (!this.agent.getScratch().isAwake) {
      return;
    }

    this.log(`🤝 ${targetName} 감지! 대화 시도...`, 'info');

    // 1. 이 NPC가 먼저 말 걸기
    const utterance1 = await this.agent.initiateNpcConversation(targetName, observation);
    this.options.onNpcConversation?.(this.definition.id, this.agent.getName(), utterance1);
    this.log(`💬 "${utterance1.slice(0, 30)}..."`, 'info');

    // 2. 상대 NPC가 응답
    const targetAgent = this.options.getOtherNpcAgent?.(targetId);
    if (targetAgent) {
      const utterance2 = await targetAgent.respondToNpc(this.agent.getName(), utterance1);
      this.options.onNpcConversation?.(targetId, targetAgent.getName(), utterance2);
      this.log(`💬 ${targetName}: "${utterance2.slice(0, 30)}..."`, 'info');

      // 3. 한 턴 더 (선택적)
      const utterance3 = await this.agent.respondToNpc(targetAgent.getName(), utterance2);
      this.options.onNpcConversation?.(this.definition.id, this.agent.getName(), utterance3);
      this.log(`💬 "${utterance3.slice(0, 30)}..."`, 'info');
    }

    // 쿨다운 기록
    this.recentNpcConversations.set(targetId, Date.now());
    this.log(`✅ ${targetName}과(와) 대화 완료`, 'success');
  }

  // ============================================================
  // 자연어 변환 헬퍼
  // ============================================================

  /**
   * 엔티티를 자연어로 설명
   * 예: "플레이어가 대장간 앞에서 시야에 나타났다"
   */
  private describeEntity(entity: Entity, action: string): string {
    const name = entity.name || entity.id;
    const location = this.getLocationName(entity.position);
    return `${name}이(가) ${location}에서 ${action}`;
  }

  /**
   * 오브젝트를 자연어로 설명
   * 예: "모루가 사용 중이다"
   */
  private describeObject(obj: WorldObject): string {
    if (obj.state) {
      return `${obj.name}이(가) ${obj.state} 상태이다`;
    }
    return `${obj.name}이(가) 있다`;
  }

  /**
   * 좌표를 장소명으로 변환
   * 1. 영역(Area) 기반 매칭 (우선순위 높은 것 먼저)
   * 2. 점(Point) 기반 매칭 (정확한 좌표 또는 ±1 범위)
   */
  private getLocationName(pos: Position): string {
    // 1. 영역 기반 매칭 (areas가 정의된 경우)
    if (this.definition.areas && this.definition.areas.length > 0) {
      // 우선순위 내림차순 정렬
      const sortedAreas = [...this.definition.areas].sort(
        (a, b) => (b.priority ?? 0) - (a.priority ?? 0)
      );

      for (const area of sortedAreas) {
        if (pos.x >= area.minX && pos.x <= area.maxX &&
            pos.y >= area.minY && pos.y <= area.maxY) {
          return area.name;
        }
      }
    }

    // 2. 정확한 좌표 매칭
    for (const [name, loc] of Object.entries(this.definition.locations)) {
      if (loc.position.x === pos.x && loc.position.y === pos.y) {
        return name;
      }
    }

    // 3. 근처 (±1 타일) 매칭
    for (const [name, loc] of Object.entries(this.definition.locations)) {
      if (Math.abs(loc.position.x - pos.x) <= 1 && Math.abs(loc.position.y - pos.y) <= 1) {
        return `${name} 근처`;
      }
    }

    return `(${pos.x}, ${pos.y})`;
  }

  /**
   * 엔티티 ID로 이름 가져오기
   */
  private getEntityName(entityId: string): string {
    if (entityId === 'player') return '플레이어';
    const npc = this.world.getNpcs().find(n => n.id === entityId);
    return npc?.name || entityId;
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
