export interface Position {
  x: number;
  y: number;
}

// 시야 방향 (상하좌우)
export type Direction = 'up' | 'down' | 'left' | 'right';

export interface Entity {
  id: string;
  emoji: string;
  position: Position;
  name: string;
}

// 월드 오브젝트 (모루, 화덕 등)
export interface WorldObject {
  id: string;
  name: string;           // "모루", "화덕"
  emoji: string;          // ⚒️, 🔥
  position: Position;
  description?: string;   // "철을 두드리는 모루"
  state?: string;         // "사용 중", "비어 있음"
  blocksMovement?: boolean; // 이동 불가 여부
  blocksVision?: boolean;   // 시야 차단 여부
}

export interface NpcEntity extends Entity {
  // 시야 관련
  facing?: Direction;      // 바라보는 방향
  visionRange?: number;    // 시야 거리 (기본 3)
  // 목적지 이동 (계획 기반, 틱마다 한 칸 이동)
  targetPosition?: Position;  // 이동 목적지
  onArrival?: () => void;     // 도착 시 콜백
  recentTiles?: string[];     // 최근 방문 타일 (사이클 방지)
}

export type TileType = 'empty' | 'blocked' | 'player' | 'npc' | 'object';

export interface BlockedTile {
  label?: string;
  emoji?: string;
  blocksVision?: boolean; // 벽은 시야도 차단
}

// 타일 정보 (클릭 시 표시용)
export interface TileInfo {
  position: Position;
  type: TileType;
  isEmpty: boolean;
  isInNpcVision: boolean;
  blocked?: BlockedTile;
  npc?: NpcEntity;
  object?: WorldObject;
  isPlayerHere: boolean;
}

export interface GameWorldOptions {
  gridSize: number;
  onPlayerMove?: (position: Position, nearbyNpc: Entity | null) => void;
  onNpcInteract?: (npc: Entity) => void;
  onTileClick?: (tileInfo: TileInfo) => void;
}

export class GameWorld {
  private gridSize: number;
  private gridElement: HTMLElement;
  private statusElement: HTMLElement;
  private tiles: HTMLElement[][] = [];
  private player: Entity;
  private playerFacing: Direction = 'down';  // 플레이어 방향
  private npcs: NpcEntity[] = [];
  private objects: WorldObject[] = [];
  private blockedTiles: Map<string, BlockedTile> = new Map();
  private onPlayerMove?: (position: Position, nearbyNpc: Entity | null) => void;
  private onNpcInteract?: (npc: Entity) => void;
  private onTileClick?: (tileInfo: TileInfo) => void;

  constructor(
    gridElement: HTMLElement,
    statusElement: HTMLElement,
    options: GameWorldOptions
  ) {
    this.gridElement = gridElement;
    this.statusElement = statusElement;
    this.gridSize = options.gridSize;
    this.onPlayerMove = options.onPlayerMove;
    this.onNpcInteract = options.onNpcInteract;
    this.onTileClick = options.onTileClick;

    // 플레이어 초기 위치
    this.player = {
      id: 'player',
      emoji: '🦸',
      position: { x: 5, y: 5 },
      name: '플레이어',
    };

    this.initGrid();
    this.initKeyboardControls();
  }

  private initGrid(): void {
    this.gridElement.innerHTML = '';
    this.tiles = [];

    for (let y = 0; y < this.gridSize; y++) {
      this.tiles[y] = [];
      for (let x = 0; x < this.gridSize; x++) {
        const tile = document.createElement('div');
        tile.className = 'game-tile';
        tile.dataset.x = x.toString();
        tile.dataset.y = y.toString();

        tile.addEventListener('click', () => this.handleTileClick(x, y));

        this.tiles[y][x] = tile;
        this.gridElement.appendChild(tile);
      }
    }

    this.render();
  }

  private initKeyboardControls(): void {
    document.addEventListener('keydown', (e) => {
      // 입력 필드에 포커스되어 있으면 무시
      if (
        document.activeElement?.tagName === 'INPUT' ||
        document.activeElement?.tagName === 'TEXTAREA'
      ) {
        return;
      }

      let dx = 0;
      let dy = 0;

      switch (e.key.toLowerCase()) {
        case 'w':
        case 'arrowup':
          dy = -1;
          break;
        case 's':
        case 'arrowdown':
          dy = 1;
          break;
        case 'a':
        case 'arrowleft':
          dx = -1;
          break;
        case 'd':
        case 'arrowright':
          dx = 1;
          break;
        case 'enter':
        case ' ':
          this.tryInteract();
          return;
        default:
          return;
      }

      if (dx !== 0 || dy !== 0) {
        e.preventDefault();
        this.movePlayer(dx, dy);
      }
    });
  }

  private handleTileClick(x: number, y: number): void {
    // 타일 정보만 표시 (이동은 WASD/화살표로만)
    const tileInfo = this.getTileInfo(x, y);
    this.onTileClick?.(tileInfo);
  }

  // 특정 좌표의 타일 정보 가져오기
  getTileInfo(x: number, y: number): TileInfo {
    const position = { x, y };
    const key = `${x},${y}`;

    // 기본값
    let type: TileType = 'empty';
    let isEmpty = true;
    const blocked = this.blockedTiles.get(key);
    const npc = this.npcs.find(n => n.position.x === x && n.position.y === y);
    const object = this.objects.find(o => o.position.x === x && o.position.y === y);
    const isPlayerHere = this.player.position.x === x && this.player.position.y === y;

    // NPC 시야 안에 있는지 체크
    let isInNpcVision = false;
    for (const n of this.npcs) {
      const visionTiles = this.getVisionTiles(n);
      if (visionTiles.some(t => t.x === x && t.y === y)) {
        isInNpcVision = true;
        break;
      }
    }

    // 타입 결정 (우선순위: player > npc > object > blocked > empty)
    if (isPlayerHere) {
      type = 'player';
      isEmpty = false;
    } else if (npc) {
      type = 'npc';
      isEmpty = false;
    } else if (object) {
      type = 'object';
      isEmpty = false;
    } else if (blocked) {
      type = 'blocked';
      isEmpty = false;
    }

    return {
      position,
      type,
      isEmpty,
      isInNpcVision,
      blocked,
      npc,
      object,
      isPlayerHere,
    };
  }

  private movePlayer(dx: number, dy: number): void {
    const newX = this.player.position.x + dx;
    const newY = this.player.position.y + dy;

    // 방향 업데이트 (이동 성공 여부와 관계없이)
    if (dy < 0) this.playerFacing = 'up';
    else if (dy > 0) this.playerFacing = 'down';
    else if (dx < 0) this.playerFacing = 'left';
    else if (dx > 0) this.playerFacing = 'right';

    // 범위 체크
    if (newX < 0 || newX >= this.gridSize || newY < 0 || newY >= this.gridSize) {
      this.render(); // 방향만 변경
      return;
    }

    // 장애물 체크
    const key = `${newX},${newY}`;
    if (this.blockedTiles.has(key)) {
      this.render(); // 방향만 변경
      return;
    }

    // NPC와 충돌 체크
    const npcAtPosition = this.npcs.find(
      (npc) => npc.position.x === newX && npc.position.y === newY
    );
    if (npcAtPosition) {
      this.render(); // 방향만 변경
      return;
    }

    // 이동
    this.player.position.x = newX;
    this.player.position.y = newY;

    this.render();

    // 근처 NPC 확인
    const nearbyNpc = this.getNearbyNpc();
    this.onPlayerMove?.(this.player.position, nearbyNpc);
    this.updateStatus(nearbyNpc);
  }

  private tryInteract(): void {
    const nearbyNpc = this.getNearbyNpc();
    if (nearbyNpc) {
      this.onNpcInteract?.(nearbyNpc);
    }
  }

  // 상하좌우 인접 여부 확인 (대각선 제외)
  private isAdjacent(pos1: Position, pos2: Position): boolean {
    const dx = Math.abs(pos1.x - pos2.x);
    const dy = Math.abs(pos1.y - pos2.y);
    // 상하좌우만: (dx=1, dy=0) 또는 (dx=0, dy=1)
    return (dx === 1 && dy === 0) || (dx === 0 && dy === 1);
  }

  private getNearbyNpc(): Entity | null {
    for (const npc of this.npcs) {
      if (this.isAdjacent(this.player.position, npc.position)) {
        return npc;
      }
    }
    return null;
  }

  // 플레이어가 바라보는 방향의 인접 오브젝트 가져오기
  getAdjacentObject(): WorldObject | null {
    const facingPos = this.getFacingPosition();
    return this.objects.find(obj =>
      obj.position.x === facingPos.x && obj.position.y === facingPos.y
    ) || null;
  }

  // 플레이어가 바라보는 방향의 좌표 반환
  private getFacingPosition(): Position {
    const { x, y } = this.player.position;
    switch (this.playerFacing) {
      case 'up': return { x, y: y - 1 };
      case 'down': return { x, y: y + 1 };
      case 'left': return { x: x - 1, y };
      case 'right': return { x: x + 1, y };
    }
  }

  // 상하좌우 인접한 모든 오브젝트 가져오기
  getAdjacentObjects(): WorldObject[] {
    const { x, y } = this.player.position;
    const adjacentPositions = [
      { x, y: y - 1 },  // 상
      { x, y: y + 1 },  // 하
      { x: x - 1, y },  // 좌
      { x: x + 1, y },  // 우
    ];
    return this.objects.filter(obj =>
      adjacentPositions.some(pos => pos.x === obj.position.x && pos.y === obj.position.y)
    );
  }

  private updateStatus(nearbyNpc: Entity | null): void {
    if (nearbyNpc) {
      this.statusElement.textContent = `${nearbyNpc.name}과 대화 가능! (Enter/Space)`;
      this.statusElement.className = 'game-status can-talk';
    } else {
      this.statusElement.textContent = '이동: WASD 또는 방향키 / 클릭';
      this.statusElement.className = 'game-status';
    }
  }

  private render(): void {
    // 모든 타일 초기화
    for (let y = 0; y < this.gridSize; y++) {
      for (let x = 0; x < this.gridSize; x++) {
        const tile = this.tiles[y][x];
        tile.className = 'game-tile';
        tile.textContent = '';
        tile.style.fontSize = ''; // 리셋

        const key = `${x},${y}`;
        const blocked = this.blockedTiles.get(key);
        if (blocked) {
          tile.classList.add('blocked');
          if (blocked.emoji) {
            tile.textContent = blocked.emoji;
          } else if (blocked.label) {
            tile.textContent = blocked.label;
            tile.style.fontSize = '0.6rem';
          }
        }
      }
    }

    // 오브젝트 렌더링
    for (const obj of this.objects) {
      const tile = this.tiles[obj.position.y][obj.position.x];
      tile.classList.add('object');
      tile.textContent = obj.emoji;
    }

    // NPC 시야 영역 렌더링 (오버레이)
    for (const npc of this.npcs) {
      const visionTiles = this.getVisionTiles(npc);
      for (const pos of visionTiles) {
        const tile = this.tiles[pos.y][pos.x];
        tile.classList.add('npc-vision');
      }
    }

    // NPC 렌더링
    const nearbyNpc = this.getNearbyNpc();
    for (const npc of this.npcs) {
      const tile = this.tiles[npc.position.y][npc.position.x];
      tile.classList.add('npc');
      tile.classList.add(`facing-${npc.facing || 'down'}`);
      tile.textContent = npc.emoji;
      // 방향 화살표 추가
      const dirArrow = document.createElement('span');
      dirArrow.className = 'npc-direction';
      dirArrow.textContent = this.getDirectionArrow(npc.facing);
      tile.appendChild(dirArrow);
      if (nearbyNpc?.id === npc.id) {
        tile.classList.add('nearby');
      }
    }

    // 플레이어 렌더링
    const playerTile = this.tiles[this.player.position.y][this.player.position.x];
    playerTile.classList.add('player');
    playerTile.classList.add(`facing-${this.playerFacing}`);
    playerTile.textContent = this.player.emoji;
    // 방향 화살표 추가
    const playerArrow = document.createElement('span');
    playerArrow.className = 'player-direction';
    playerArrow.textContent = this.getDirectionArrow(this.playerFacing);
    playerTile.appendChild(playerArrow);
  }

  /**
   * NPC 이동 한 칸 (틱 기반)
   * - 목적지가 없으면 이동 안 함 (랜덤 이동 없음)
   * - 계획에 의한 목적지로만 이동
   */
  private moveNpcOneStep(npc: NpcEntity): void {
    // 목적지가 없으면 이동 안 함
    if (!npc.targetPosition) {
      return;
    }

    // 목적지 도착 체크
    if (npc.position.x === npc.targetPosition.x && npc.position.y === npc.targetPosition.y) {
      const callback = npc.onArrival;
      npc.targetPosition = undefined;
      npc.onArrival = undefined;
      callback?.();
      return;
    }

    // 목적지 방향으로 이동
    const tdx = npc.targetPosition.x - npc.position.x;
    const tdy = npc.targetPosition.y - npc.position.y;
    const directions: { dx: number; dy: number }[] = [];

    // 목적지 방향을 우선순위로
    if (tdx !== 0) directions.push({ dx: Math.sign(tdx), dy: 0 });
    if (tdy !== 0) directions.push({ dx: 0, dy: Math.sign(tdy) });

    // 모든 방향을 fallback으로 추가 (막다른 곳 탈출용)
    const allDirs = [
      { dx: 1, dy: 0 }, { dx: -1, dy: 0 },
      { dx: 0, dy: 1 }, { dx: 0, dy: -1 }
    ];
    // fallback 방향을 섞어서 사이클 방지
    for (let i = allDirs.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [allDirs[i], allDirs[j]] = [allDirs[j], allDirs[i]];
    }
    for (const d of allDirs) {
      if (!directions.some(existing => existing.dx === d.dx && existing.dy === d.dy)) {
        directions.push(d);
      }
    }

    // 최근 타일 초기화 (없으면)
    if (!npc.recentTiles) npc.recentTiles = [];

    // 이동 가능한 타일 찾기
    const validMoves: { dx: number; dy: number; isRecent: boolean }[] = [];

    for (const dir of directions) {
      const newX = npc.position.x + dir.dx;
      const newY = npc.position.y + dir.dy;
      const tileKey = `${newX},${newY}`;

      // 범위 체크
      if (newX < 0 || newX >= this.gridSize || newY < 0 || newY >= this.gridSize) {
        continue;
      }

      // 장애물 체크
      if (this.blockedTiles.has(tileKey)) {
        continue;
      }

      // 오브젝트 체크 (blocksMovement가 true인 것)
      const blockingObject = this.objects.find(
        obj => obj.blocksMovement && obj.position.x === newX && obj.position.y === newY
      );
      if (blockingObject) {
        continue;
      }

      // 플레이어 위치 체크
      if (newX === this.player.position.x && newY === this.player.position.y) {
        continue;
      }

      // 다른 NPC 체크
      const otherNpc = this.npcs.find(
        (other) => other.id !== npc.id && other.position.x === newX && other.position.y === newY
      );
      if (otherNpc) {
        continue;
      }

      // 이동 가능! 최근 방문 여부 체크
      const isRecent = npc.recentTiles.includes(tileKey);
      validMoves.push({ ...dir, isRecent });
    }

    // 이동할 곳이 없으면 종료
    if (validMoves.length === 0) return;

    // 최근 방문하지 않은 타일 우선, 없으면 아무거나
    const move = validMoves.find(m => !m.isRecent) || validMoves[0];

    // 이동
    const newX = npc.position.x + move.dx;
    const newY = npc.position.y + move.dy;
    npc.position.x = newX;
    npc.position.y = newY;

    // 최근 타일 기록 (최대 4개 유지 - 막다른 곳 탈출용)
    npc.recentTiles.push(`${newX},${newY}`);
    if (npc.recentTiles.length > 4) {
      npc.recentTiles.shift();
    }

    // 방향 업데이트
    if (move.dy < 0) npc.facing = 'up';
    else if (move.dy > 0) npc.facing = 'down';
    else if (move.dx < 0) npc.facing = 'left';
    else if (move.dx > 0) npc.facing = 'right';

    this.render();

    // 플레이어가 근처에 왔는지 확인하고 콜백
    const nearbyNpc = this.getNearbyNpc();
    this.updateStatus(nearbyNpc);
    this.onPlayerMove?.(this.player.position, nearbyNpc);
  }

  /**
   * 게임 틱: 모든 NPC 한 칸씩 이동 (게임 시간 시스템에서 호출)
   */
  tick(): void {
    for (const npc of this.npcs) {
      this.moveNpcOneStep(npc);
    }
  }

  /**
   * NPC 목적지 설정 (틱마다 이동, 타이머 없음)
   */
  moveNpcTo(npcId: string, target: Position, onArrival?: () => void): boolean {
    const npc = this.npcs.find(n => n.id === npcId);
    if (!npc) return false;

    npc.targetPosition = target;
    npc.onArrival = onArrival;
    return true;
  }

  /**
   * NPC 이동 중단
   */
  stopNpcMovement(npcId: string): void {
    const npc = this.npcs.find(n => n.id === npcId);
    if (npc) {
      npc.targetPosition = undefined;
      npc.onArrival = undefined;
    }
  }

  // 8타일 시야: 전방 3열×2행 + 좌우 각 1개
  getVisionTiles(npc: NpcEntity): Position[] {
    const facing = npc.facing ?? 'down';
    const { x: nx, y: ny } = npc.position;
    const visible: Position[] = [];

    // 방향별 오프셋 정의
    // front: 전방 방향 벡터, side: 측면 방향 벡터
    let frontDx = 0, frontDy = 0;
    let sideDx = 0, sideDy = 0;

    switch (facing) {
      case 'up':
        frontDx = 0; frontDy = -1;
        sideDx = 1; sideDy = 0;
        break;
      case 'down':
        frontDx = 0; frontDy = 1;
        sideDx = 1; sideDy = 0;
        break;
      case 'left':
        frontDx = -1; frontDy = 0;
        sideDx = 0; sideDy = 1;
        break;
      case 'right':
        frontDx = 1; frontDy = 0;
        sideDx = 0; sideDy = 1;
        break;
    }

    // 전방 2행 × 3열 (6타일)
    for (let depth = 1; depth <= 2; depth++) {
      for (let offset = -1; offset <= 1; offset++) {
        const tx = nx + frontDx * depth + sideDx * offset;
        const ty = ny + frontDy * depth + sideDy * offset;

        if (tx < 0 || tx >= this.gridSize || ty < 0 || ty >= this.gridSize) continue;
        if (this.isVisionBlocked(npc.position, { x: tx, y: ty })) continue;

        visible.push({ x: tx, y: ty });
      }
    }

    // 좌우 측면 (2타일) - NPC 바로 옆
    for (const offset of [-1, 1]) {
      const tx = nx + sideDx * offset;
      const ty = ny + sideDy * offset;

      if (tx < 0 || tx >= this.gridSize || ty < 0 || ty >= this.gridSize) continue;

      visible.push({ x: tx, y: ty });
    }

    return visible;
  }

  // 두 점 사이 시야 차단 체크 (간단한 브레젠험)
  private isVisionBlocked(from: Position, to: Position): boolean {
    const dx = Math.abs(to.x - from.x);
    const dy = Math.abs(to.y - from.y);
    const sx = from.x < to.x ? 1 : -1;
    const sy = from.y < to.y ? 1 : -1;
    let err = dx - dy;
    let cx = from.x;
    let cy = from.y;

    while (cx !== to.x || cy !== to.y) {
      const e2 = 2 * err;
      if (e2 > -dy) {
        err -= dy;
        cx += sx;
      }
      if (e2 < dx) {
        err += dx;
        cy += sy;
      }

      // 목적지 도달 전에 벽 체크
      if (cx === to.x && cy === to.y) break;

      const key = `${cx},${cy}`;
      const blocked = this.blockedTiles.get(key);
      if (blocked?.blocksVision !== false && blocked) {
        return true; // 벽에 막힘
      }

      // 오브젝트 체크
      const obj = this.objects.find(o => o.position.x === cx && o.position.y === cy);
      if (obj?.blocksVision) {
        return true;
      }
    }

    return false;
  }

  // 공개 API
  addNpc(npc: Omit<NpcEntity, 'id'> & { id?: string }): NpcEntity {
    const entity: NpcEntity = {
      id: npc.id || `npc_${Date.now()}`,
      emoji: npc.emoji,
      position: { ...npc.position },
      name: npc.name,
      facing: npc.facing ?? 'down',
      visionRange: npc.visionRange ?? 3,
    };
    this.npcs.push(entity);
    this.render();
    this.updateStatus(this.getNearbyNpc());
    return entity;
  }

  addObject(obj: Omit<WorldObject, 'id'> & { id?: string }): WorldObject {
    const object: WorldObject = {
      id: obj.id || `obj_${Date.now()}`,
      name: obj.name,
      emoji: obj.emoji,
      position: { ...obj.position },
      description: obj.description,
      state: obj.state,
      blocksMovement: obj.blocksMovement ?? true,
      blocksVision: obj.blocksVision ?? false,
    };
    this.objects.push(object);
    this.render();
    return object;
  }

  getObjects(): WorldObject[] {
    return [...this.objects];
  }

  // NPC가 현재 볼 수 있는 오브젝트들
  getVisibleObjects(npc: NpcEntity): WorldObject[] {
    const visionTiles = this.getVisionTiles(npc);
    return this.objects.filter(obj =>
      visionTiles.some(t => t.x === obj.position.x && t.y === obj.position.y)
    );
  }

  // NPC가 현재 볼 수 있는 엔티티들 (플레이어 + 다른 NPC)
  getVisibleEntities(npc: NpcEntity): { player: Entity | null; npcs: NpcEntity[] } {
    const visionTiles = this.getVisionTiles(npc);

    // 플레이어가 시야 내에 있는지
    const playerVisible = visionTiles.some(
      t => t.x === this.player.position.x && t.y === this.player.position.y
    );

    // 다른 NPC가 시야 내에 있는지
    const visibleNpcs = this.npcs.filter(other =>
      other.id !== npc.id &&
      visionTiles.some(t => t.x === other.position.x && t.y === other.position.y)
    );

    return {
      player: playerVisible ? this.player : null,
      npcs: visibleNpcs,
    };
  }

  // NPC 방향 변경
  setNpcFacing(npcId: string, direction: Direction): void {
    const npc = this.npcs.find(n => n.id === npcId);
    if (npc) {
      npc.facing = direction;
      this.render();
    }
  }

  setPlayerPosition(x: number, y: number): void {
    this.player.position.x = x;
    this.player.position.y = y;
    this.render();
    this.updateStatus(this.getNearbyNpc());
  }

  addBlockedTile(x: number, y: number, options?: BlockedTile): void {
    this.blockedTiles.set(`${x},${y}`, options || {});
    this.render();
  }

  getPlayerPosition(): Position {
    return { ...this.player.position };
  }

  getNpcs(): NpcEntity[] {
    return [...this.npcs];
  }

  // 방향 화살표 반환
  private getDirectionArrow(direction?: Direction): string {
    switch (direction) {
      case 'up': return '▲';
      case 'down': return '▼';
      case 'left': return '◀';
      case 'right': return '▶';
      default: return '▼';
    }
  }

  // 오브젝트 상태 업데이트
  updateObjectState(objectId: string, state: string): boolean {
    const obj = this.objects.find(o => o.id === objectId);
    if (!obj) return false;
    obj.state = state;
    return true;
  }

  // 오브젝트 가져오기
  getObject(objectId: string): WorldObject | undefined {
    return this.objects.find(o => o.id === objectId);
  }

  // 정리
  destroy(): void {
    // 타이머 없음 - 틱 기반이므로 별도 정리 불필요
  }
}
