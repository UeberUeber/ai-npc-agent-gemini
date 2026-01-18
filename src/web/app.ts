/**
 * 웹 UI 애플리케이션
 *
 * 서버 없이 브라우저에서 직접 동작합니다.
 * - Gemini API 직접 호출
 * - localStorage에 메모리 저장
 */

import { gemini } from '../client/gemini';
import { NPCAgent, DailyPlanItem } from '../client/agent';
import { blacksmithJohn } from '../client/npcs/blacksmith_john';
import { innkeeperRosa } from '../client/npcs/innkeeper_rosa';
import { NpcDefinition } from '../client/npcs/types';
import { GameWorld, Entity, TileInfo } from '../client/game/world';
import { GameTime, GameTimeState } from '../client/game/time';
import { NpcController } from '../client/game/npc-controller';

// NPC 정의 목록
const NPC_DEFINITIONS: NpcDefinition[] = [blacksmithJohn, innkeeperRosa];

// DOM 요소
const chatMessages = document.getElementById('chatMessages') as HTMLDivElement;
const userInput = document.getElementById('userInput') as HTMLInputElement;
const sendButton = document.getElementById('sendButton') as HTMLButtonElement;

// 페르소나 요소
const npcName = document.getElementById('npcName') as HTMLSpanElement;
const npcAge = document.getElementById('npcAge') as HTMLSpanElement;
const npcOccupation = document.getElementById('npcOccupation') as HTMLSpanElement;
const npcTraits = document.getElementById('npcTraits') as HTMLSpanElement;
const npcBackstory = document.getElementById('npcBackstory') as HTMLSpanElement;
const npcGoals = document.getElementById('npcGoals') as HTMLSpanElement;

// Scratch 요소
const npcLocation = document.getElementById('npcLocation') as HTMLSpanElement;
const npcActivity = document.getElementById('npcActivity') as HTMLSpanElement;
const npcMood = document.getElementById('npcMood') as HTMLSpanElement;
const npcTime = document.getElementById('npcTime') as HTMLSpanElement;

// 히스토리/메모리 요소
const historyList = document.getElementById('historyList') as HTMLDivElement;
const memoryCount = document.getElementById('memoryCount') as HTMLSpanElement;
const memoryList = document.getElementById('memoryList') as HTMLDivElement;
const clearMemoryBtn = document.getElementById('clearMemoryBtn') as HTMLButtonElement;

// 모달 요소
const apiKeyModal = document.getElementById('apiKeyModal') as HTMLDivElement;
const apiKeyInput = document.getElementById('apiKeyInput') as HTMLInputElement;
const apiKeySubmit = document.getElementById('apiKeySubmit') as HTMLButtonElement;

// 시스템 로그 요소
const systemLog = document.getElementById('systemLog') as HTMLDivElement;
const chatCounter = document.getElementById('chatCounter') as HTMLSpanElement;

// 게임 월드 요소
const gameGrid = document.getElementById('gameGrid') as HTMLDivElement;
const gameStatus = document.getElementById('gameStatus') as HTMLDivElement;

// 게임 시간 요소
const gameDay = document.getElementById('gameDay') as HTMLSpanElement;
const gameTimeDisplay = document.getElementById('gameTimeDisplay') as HTMLSpanElement;
const gamePeriod = document.getElementById('gamePeriod') as HTMLSpanElement;

// 계획 패널 요소
const planSection = document.getElementById('planSection') as HTMLDivElement;
const planDay = document.getElementById('planDay') as HTMLSpanElement;
const planList = document.getElementById('planList') as HTMLDivElement;

// 타일 정보 요소
const tileInfoPanel = document.getElementById('tileInfo') as HTMLDivElement;

// NPC Agent & Controller (다중 NPC 지원)
const agents = new Map<string, NPCAgent>();
const npcControllers = new Map<string, NpcController>();

// 현재 선택된 NPC (대화 대상)
let currentNpcId: string | null = null;

// 게임 월드
let gameWorld: GameWorld;
let nearbyNpc: Entity | null = null;

// 게임 시간
let gameTime: GameTime;

// 감정 상태 한글 변환
const moodKorean: Record<string, string> = {
  happy: '기쁨',
  neutral: '평온',
  sad: '슬픔',
  angry: '화남',
  fearful: '두려움',
  excited: '흥분',
  tired: '피곤',
  curious: '호기심',
};

// NPC 아이콘 매핑 (중앙화) - ID 또는 이름으로 아이콘 반환
const NPC_ICONS: Record<string, string> = {
  'blacksmith_john': '👨‍🔧',
  'innkeeper_rosa': '👩‍🍳',
  '존': '👨‍🔧',
  'john': '👨‍🔧',
  '로사': '👩‍🍳',
  'rosa': '👩‍🍳',
};

function getNpcIcon(npcIdOrName: string): string {
  const lowerName = npcIdOrName.toLowerCase();
  // 정확히 매칭되는 경우
  if (NPC_ICONS[lowerName]) return NPC_ICONS[lowerName];
  if (NPC_ICONS[npcIdOrName]) return NPC_ICONS[npcIdOrName];
  // 부분 매칭 (이름에 포함된 경우)
  for (const [key, icon] of Object.entries(NPC_ICONS)) {
    if (lowerName.includes(key) || npcIdOrName.includes(key)) {
      return icon;
    }
  }
  return '🧑';  // 기본 NPC 아이콘
}

// 대화 카운터
let chatCount = 0;

// 현재 대화 중인 NPC의 Agent 가져오기
function getCurrentAgent(): NPCAgent | null {
  if (!currentNpcId) return null;
  return agents.get(currentNpcId) || null;
}

// 시스템 로그 추가 (최신이 위에 표시)
function addLog(message: string, type: 'info' | 'success' | 'warning' = 'info') {
  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const logItem = document.createElement('div');
  logItem.className = `log-item ${type}`;
  logItem.innerHTML = `<span class="timestamp">[${time}]</span>${message}`;
  // 최신 로그를 맨 위에 추가
  systemLog.prepend(logItem);

  // 최대 50개 로그 유지 (오래된 것부터 삭제)
  while (systemLog.children.length > 50) {
    systemLog.removeChild(systemLog.lastChild!);
  }
}

// Reflection 카운터 업데이트 (10회 대화 후 Reflection 자동 실행)
function updateChatCounter() {
  chatCounter.textContent = `Reflection: ${chatCount}/10`;
}

// 메시지 추가
function addMessage(type: 'user' | 'npc' | 'system', content: string, sender: string) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  // 메시지 타입별 아이콘 결정
  let avatarIcon = '⚙️';  // system
  if (type === 'user') {
    avatarIcon = '🦸';
  } else if (type === 'npc') {
    avatarIcon = getNpcIcon(sender);
  }
  avatar.textContent = avatarIcon;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  const senderDiv = document.createElement('div');
  senderDiv.className = 'message-sender';
  senderDiv.textContent = sender;

  const textDiv = document.createElement('div');
  textDiv.textContent = content;

  contentDiv.appendChild(senderDiv);
  contentDiv.appendChild(textDiv);
  messageDiv.appendChild(avatar);
  messageDiv.appendChild(contentDiv);

  chatMessages.appendChild(messageDiv);
  // 부모 컨테이너(.panel-content)가 스크롤 가능하므로 부모를 스크롤
  const scrollContainer = chatMessages.parentElement;
  if (scrollContainer) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }
}

// 타이핑 인디케이터
function showTypingIndicator(npcId?: string) {
  const indicator = document.createElement('div');
  indicator.className = 'message npc';
  indicator.id = 'typingIndicator';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = npcId ? getNpcIcon(npcId) : '🧑';

  const typing = document.createElement('div');
  typing.className = 'typing-indicator';
  typing.innerHTML = '<span></span><span></span><span></span>';

  indicator.appendChild(avatar);
  indicator.appendChild(typing);
  chatMessages.appendChild(indicator);
  // 부모 컨테이너(.panel-content)가 스크롤 가능하므로 부모를 스크롤
  const scrollContainer = chatMessages.parentElement;
  if (scrollContainer) {
    scrollContainer.scrollTop = scrollContainer.scrollHeight;
  }
}

function hideTypingIndicator() {
  document.getElementById('typingIndicator')?.remove();
}

// 페르소나 UI 업데이트 (대장장이 존)
function updatePersonaUI() {
  const johnAgent = agents.get('blacksmith_john');
  if (!johnAgent) return;
  const persona = johnAgent.getPersona();
  npcName.textContent = persona.name;
  npcAge.textContent = `${persona.age}세`;
  npcOccupation.textContent = persona.occupation;
  npcTraits.textContent = persona.traits.join(', ');
  npcBackstory.textContent = persona.backstory;
  npcGoals.textContent = persona.currentGoals.join(' / ');
}

// Scratch(환경/상태) UI 업데이트 (대장장이 존)
function updateScratchUI() {
  const johnAgent = agents.get('blacksmith_john');
  if (!johnAgent) return;
  const scratch = johnAgent.getScratch();
  npcLocation.textContent = scratch.currentLocation;
  npcActivity.textContent = scratch.currentActivity;
  npcMood.textContent = moodKorean[scratch.currentMood] || scratch.currentMood;
  npcTime.textContent = scratch.currentTime;
}

// 로사 Scratch UI 업데이트
function updateRosaScratchUI() {
  const rosaAgent = agents.get('innkeeper_rosa');
  if (!rosaAgent) return;
  const scratch = rosaAgent.getScratch();
  const rosaLocation = document.getElementById('rosaLocation');
  const rosaActivity = document.getElementById('rosaActivity');
  const rosaMood = document.getElementById('rosaMood');
  const rosaTime = document.getElementById('rosaTime');
  if (rosaLocation) rosaLocation.textContent = scratch.currentLocation;
  if (rosaActivity) rosaActivity.textContent = scratch.currentActivity;
  if (rosaMood) rosaMood.textContent = moodKorean[scratch.currentMood] || scratch.currentMood;
  if (rosaTime) rosaTime.textContent = scratch.currentTime;
}

// 대화 히스토리 UI 업데이트 (현재 대화 중인 NPC)
function updateHistoryUI() {
  const agent = getCurrentAgent();
  if (!agent) {
    historyList.innerHTML = '<div class="empty-state">아직 대화가 없습니다</div>';
    return;
  }

  const history = agent.getConversationHistory();

  if (history.length === 0) {
    historyList.innerHTML = '<div class="empty-state">아직 대화가 없습니다</div>';
    return;
  }

  historyList.innerHTML = history
    .slice(-10)
    .map(
      (msg) => `
      <div class="memory-item">
        <div class="type">${msg.speaker === 'user' ? '용사 스마게' : agent.getName()}</div>
        <div>${msg.content}</div>
      </div>
    `
    )
    .join('');
}

// 중요도 표시 생성 (미평가/평가완료 구분 + 툴팁)
function renderImportance(memory: { type: string; importance?: number }): string {
  // importance가 undefined이면 미평가
  const isPending = memory.importance === undefined;
  // reflection은 생성 시 importance 8로 설정되므로 항상 평가됨

  const statusClass = isPending ? 'pending' : 'evaluated';
  const displayText = isPending ? '⏳ 미평가' : `✓ ${memory.importance}/10`;

  const tooltip = `
    <div class="importance-tooltip">
      <h4>📊 중요도 평가 시스템</h4>
      <p>Stanford Generative Agents 논문 기반. <strong>LLM이 각 기억의 중요성을 1-10점으로 평가</strong>합니다.</p>

      <div class="section">
        <div class="section-title">🤖 LLM 평가 방식</div>
        <div class="section-content">
          Gemini API에게 기억 목록을 전송하고 중요도를 질문합니다:<br>
          <code>"이 기억의 중요도를 1-10으로 평가해주세요"</code><br>
          LLM은 기억 내용만 보고 NPC 관점에서 평가합니다.
        </div>
      </div>

      <div class="section">
        <div class="section-title">📝 초기값 vs LLM 평가</div>
        <div class="section-content">
          • <strong>저장 시</strong>: 타입별 기본값 (대화=4, 지식=9 등)<br>
          • <strong>Reflection 시</strong>: LLM이 실제 내용 보고 재평가<br>
          → 중요한 대화는 4→8로 상향될 수 있음
        </div>
      </div>

      <div class="section">
        <div class="section-title">평가 기준 (LLM 프롬프트)</div>
        <div class="scale">
          <div class="scale-item"><span class="num">1-3</span><br>일상 인사</div>
          <div class="scale-item"><span class="num">4-6</span><br>일반 대화</div>
          <div class="scale-item"><span class="num">7-10</span><br>중요 사건</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">⏰ 왜 즉시 평가하지 않나요?</div>
        <div class="section-content">
          매 저장마다 LLM 호출 → <strong>비용↑ 지연↑</strong><br>
          대신 <strong>대화 10개마다</strong> 미평가 기억들을 일괄 평가합니다.
        </div>
      </div>

      <div class="section">
        <div class="section-title">🔍 메모리 검색 시 활용</div>
        <div class="section-content">
          <code>score = recency + importance + relevance</code><br>
          • recency: 최근 접근한 기억일수록 높음<br>
          • importance: LLM이 평가한 중요도 (1-10)<br>
          • relevance: 현재 대화와 관련될수록 높음
        </div>
      </div>

      <div class="section">
        <div class="section-title">현재 상태</div>
        <div class="section-content">
          ${isPending
            ? '⏳ <strong>미평가</strong> - 대화 10개 도달 시 LLM 평가 예정'
            : `✅ <strong>평가 완료</strong> - LLM이 ${memory.importance}점으로 평가`}
        </div>
      </div>
    </div>
  `;

  return `<div class="importance ${statusClass}">${displayText}${tooltip}</div>`;
}

// 메모리 스트림 UI 업데이트 (대장장이 존)
function updateMemoryUI() {
  const johnAgent = agents.get('blacksmith_john');
  if (!johnAgent) return;

  const memories = johnAgent.getRecentMemories(10);
  memoryCount.textContent = `${johnAgent.getMemoryCount()}개`;

  if (memories.length === 0) {
    memoryList.innerHTML = '<div class="empty-state">아직 기억이 없습니다</div>';
    return;
  }

  memoryList.innerHTML = memories
    .map(
      (m) => `
      <div class="memory-item ${m.type === 'reflection' ? 'reflection' : m.type === 'thought' ? 'thought' : ''}">
        <div class="type">${m.type}</div>
        <div>${m.content}</div>
        ${renderImportance(m)}
      </div>
    `
    )
    .join('');
}

// 로사 메모리 스트림 UI 업데이트
function updateRosaMemoryUI() {
  const rosaAgent = agents.get('innkeeper_rosa');
  const rosaMemoryCount = document.getElementById('rosaMemoryCount');
  const rosaMemoryList = document.getElementById('rosaMemoryList');
  if (!rosaAgent || !rosaMemoryList || !rosaMemoryCount) return;

  const memories = rosaAgent.getRecentMemories(10);
  rosaMemoryCount.textContent = `${rosaAgent.getMemoryCount()}개`;

  if (memories.length === 0) {
    rosaMemoryList.innerHTML = '<div class="empty-state">아직 기억이 없습니다</div>';
    return;
  }

  rosaMemoryList.innerHTML = memories
    .map(
      (m) => `
      <div class="memory-item ${m.type === 'reflection' ? 'reflection' : m.type === 'thought' ? 'thought' : ''}">
        <div class="type">${m.type}</div>
        <div>${m.content}</div>
        ${renderImportance(m)}
      </div>
    `
    )
    .join('');
}

// 로사 대화 히스토리 UI 업데이트
function updateRosaHistoryUI() {
  const rosaAgent = agents.get('innkeeper_rosa');
  const rosaHistoryList = document.getElementById('rosaHistoryList');
  if (!rosaAgent || !rosaHistoryList) return;

  const history = rosaAgent.getConversationHistory();

  if (history.length === 0) {
    rosaHistoryList.innerHTML = '<div class="empty-state">아직 대화가 없습니다</div>';
    return;
  }

  rosaHistoryList.innerHTML = history
    .slice(-10)
    .map(
      (msg) => `
      <div class="memory-item">
        <div class="type">${msg.speaker === 'user' ? '용사 스마게' : rosaAgent.getName()}</div>
        <div>${msg.content}</div>
      </div>
    `
    )
    .join('');
}

// 로사 계획 패널 UI 업데이트
function updateRosaPlanUI(day: number = 1) {
  const rosaAgent = agents.get('innkeeper_rosa');
  const rosaPlanSection = document.getElementById('rosaPlanSection') as HTMLDivElement;
  const rosaPlanDay = document.getElementById('rosaPlanDay') as HTMLSpanElement;
  const rosaPlanList = document.getElementById('rosaPlanList') as HTMLDivElement;
  if (!rosaAgent || !rosaPlanSection || !rosaPlanDay || !rosaPlanList) return;

  const plan = rosaAgent.getDailyPlan();

  if (!plan || plan.length === 0) {
    rosaPlanSection.style.display = 'none';
    return;
  }

  rosaPlanSection.style.display = 'block';
  rosaPlanDay.textContent = `${day}일차`;

  const statusIcon = (status: DailyPlanItem['status']): string => {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '▶️';
      case 'skipped': return '⏭️';
      default: return '⏳';
    }
  };

  rosaPlanList.innerHTML = plan
    .map(
      (item) => `
      <div class="plan-item ${item.status}${item.goalRelated ? ' goal-related' : ''}">
        <span class="plan-status">${statusIcon(item.status)}</span>
        <span class="plan-time">${item.time}</span>
        <span class="plan-activity">${item.activity}${item.goalRelated ? ' 🎯' : ''}</span>
        ${item.location ? `<span class="plan-location">${item.location}</span>` : ''}
      </div>
    `
    )
    .join('');

  // 현재 진행 중인 항목으로 스크롤
  const inProgressItem = rosaPlanList.querySelector('.plan-item.in_progress');
  if (inProgressItem) {
    inProgressItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// 계획 패널 UI 업데이트 (대장장이 존)
function updatePlanUI(day: number = 1) {
  const johnAgent = agents.get('blacksmith_john');
  if (!johnAgent) return;

  const plan = johnAgent.getDailyPlan();

  if (!plan || plan.length === 0) {
    planSection.style.display = 'none';
    return;
  }

  planSection.style.display = 'block';
  planDay.textContent = `${day}일차`;

  const statusIcon = (status: DailyPlanItem['status']): string => {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '▶️';
      case 'skipped': return '⏭️';
      default: return '⏳';
    }
  };

  planList.innerHTML = plan
    .map(
      (item) => `
      <div class="plan-item ${item.status}${item.goalRelated ? ' goal-related' : ''}">
        <span class="plan-status">${statusIcon(item.status)}</span>
        <span class="plan-time">${item.time}</span>
        <span class="plan-activity">${item.activity}${item.goalRelated ? ' 🎯' : ''}</span>
        ${item.location ? `<span class="plan-location">${item.location}</span>` : ''}
      </div>
    `
    )
    .join('');

  // 현재 진행 중인 항목으로 스크롤
  const inProgressItem = planList.querySelector('.plan-item.in_progress');
  if (inProgressItem) {
    inProgressItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

// 게임 시간 UI 업데이트
function updateGameTimeUI(state: GameTimeState) {
  gameDay.textContent = `${state.day}일차`;
  gameTimeDisplay.textContent = state.formatted;
  gamePeriod.textContent = state.periodKorean;

  // 모든 NPC의 Scratch에 현재 시간 반영
  for (const agent of agents.values()) {
    agent.updateScratch({ currentTime: state.formatted });
  }
  updateScratchUI();
  updateRosaScratchUI();
}

// 타일 정보 UI 업데이트
function updateTileInfoUI(tileInfo: TileInfo) {
  const typeLabels: Record<string, string> = {
    empty: '빈 타일',
    blocked: '장애물',
    npc: 'NPC',
    object: '오브젝트',
    player: '플레이어',
  };

  const visionStatus = tileInfo.isInNpcVision ? '👁️ NPC 시야 내' : '🔒 시야 밖';

  let content = `
    <div class="tile-info-header">
      <span class="tile-coords">(${tileInfo.position.x}, ${tileInfo.position.y})</span>
      <span class="tile-type">${typeLabels[tileInfo.type] || tileInfo.type}</span>
    </div>
    <div class="tile-info-vision">${visionStatus}</div>
  `;

  if (tileInfo.isPlayerHere) {
    content += `<div class="tile-info-item player">🦸 용사 스마게</div>`;
  }

  if (tileInfo.npc) {
    content += `
      <div class="tile-info-item npc">
        <span class="emoji">${tileInfo.npc.emoji}</span>
        <span class="name">${tileInfo.npc.name}</span>
        <span class="facing">방향: ${tileInfo.npc.facing || '없음'}</span>
      </div>
    `;
  }

  if (tileInfo.object) {
    content += `
      <div class="tile-info-item object">
        <span class="emoji">${tileInfo.object.emoji}</span>
        <span class="name">${tileInfo.object.name}</span>
        <span class="state">상태: ${tileInfo.object.state || '없음'}</span>
        ${tileInfo.object.description ? `<span class="desc">${tileInfo.object.description}</span>` : ''}
      </div>
    `;
  }

  if (tileInfo.blocked) {
    content += `
      <div class="tile-info-item blocked">
        <span class="emoji">🧱</span>
        <span class="name">${tileInfo.blocked.label || '벽'}</span>
        <span class="vision">${tileInfo.blocked.blocksVision ? '시야 차단' : '시야 통과'}</span>
      </div>
    `;
  }

  if (tileInfo.isEmpty && !tileInfo.isPlayerHere) {
    content += `<div class="tile-info-empty">이동 가능한 빈 공간</div>`;
  }

  tileInfoPanel.innerHTML = content;
}

// 전체 UI 업데이트
function updateAllUI() {
  updatePersonaUI();
  updateScratchUI();
  updateRosaScratchUI();
  updateHistoryUI();
  updateRosaHistoryUI();
  updateMemoryUI();
  updateRosaMemoryUI();
}

// 메시지 전송
async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  // NPC 근처가 아니면 메시지 전송 불가
  if (!nearbyNpc || !currentNpcId) {
    addMessage('system', 'NPC 근처로 이동해야 대화할 수 있습니다.', '시스템');
    return;
  }

  const agent = getCurrentAgent();
  if (!agent) {
    addMessage('system', 'NPC를 찾을 수 없습니다.', '시스템');
    return;
  }

  userInput.disabled = true;
  sendButton.disabled = true;
  userInput.value = '';

  addMessage('user', message, '용사 스마게');
  showTypingIndicator(currentNpcId || undefined);

  try {
    const response = await agent.chat(message);
    hideTypingIndicator();
    addMessage('npc', response, agent.getName());
    chatCount = agent.getChatCount();
    updateChatCounter();
    // 해당 NPC UI 업데이트
    if (currentNpcId === 'blacksmith_john') {
      updateScratchUI();
      updateMemoryUI();
      updateHistoryUI();
    } else if (currentNpcId === 'innkeeper_rosa') {
      updateRosaScratchUI();
      updateRosaMemoryUI();
      updateRosaHistoryUI();
    }
  } catch (error) {
    hideTypingIndicator();
    console.error('대화 오류:', error);
    addMessage('system', '오류가 발생했습니다. API 키를 확인해주세요.', '시스템');
  }

  userInput.disabled = false;
  sendButton.disabled = false;
  userInput.focus();
}

// 메모리 초기화
function clearMemory() {
  if (confirm('모든 NPC의 메모리를 삭제하시겠습니까?')) {
    for (const agent of agents.values()) {
      agent.clearAllMemories();
    }
    chatMessages.innerHTML = '';
    chatCount = 0;
    updateChatCounter();
    updateHistoryUI();
    updateMemoryUI();
    updateRosaMemoryUI();
    addMessage('system', '메모리가 초기화되었습니다.', '시스템');
    addLog('메모리 및 대화 기록 초기화됨', 'warning');
  }
}

// API 키 모달 표시
function showApiKeyModal() {
  apiKeyModal.style.display = 'flex';
  apiKeyInput.focus();
}

// API 키 모달 숨김
function hideApiKeyModal() {
  apiKeyModal.style.display = 'none';
}

// API 키 설정
function submitApiKey() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) return;

  gemini.setApiKey(apiKey);
  hideApiKeyModal();
  initChat();
}

// 모든 NPC 기상 (하루 시작)
async function npcWakeUp(day: number) {
  for (const [npcId, controller] of npcControllers.entries()) {
    try {
      await controller.wakeUp(day);
      addLog(`${npcId} 기상 완료`, 'info');
    } catch (error) {
      console.error(`NPC ${npcId} 기상 오류:`, error);
      addLog(`⚠️ ${npcId} 계획 생성 실패`, 'warning');
    }
  }
  updatePlanUI(day);
  updateRosaPlanUI(day);
  updateScratchUI();
  updateRosaScratchUI();
  updateMemoryUI();
  updateRosaMemoryUI();
}

// 모든 NPC 취침 (하루 종료)
async function npcSleep() {
  for (const [npcId, controller] of npcControllers.entries()) {
    try {
      await controller.sleep();
      addLog(`${npcId} 취침 완료`, 'info');
    } catch (error) {
      console.error(`NPC ${npcId} 취침 오류:`, error);
    }
  }
  updatePlanUI();
  updateRosaPlanUI();
  updateScratchUI();
  updateRosaScratchUI();
  updateMemoryUI();
  updateRosaMemoryUI();
}

// 게임 시간 초기화
function initGameTime() {
  gameTime = new GameTime({
    startDay: 1,
    startHour: 6, // 새벽 6시 시작
    startMinute: 0,
    timeScale: 1, // 실시간 1초 = 게임 1분
    onTimeChange: (state) => {
      updateGameTimeUI(state);

      // NPC 이동 틱 (게임 1분마다 한 칸 이동)
      gameWorld.tick();

      // 모든 NPC의 계획 진행 상황 업데이트
      for (const [npcId, controller] of npcControllers.entries()) {
        const result = controller.updatePlanProgress(state.formatted24);
        if (result.changed && result.newActivity) {
          if (npcId === 'blacksmith_john') {
            updatePlanUI(state.day);
            updateScratchUI();
          } else if (npcId === 'innkeeper_rosa') {
            updateRosaPlanUI(state.day);
            updateRosaScratchUI();
          }
        }
      }
    },
    onPeriodChange: (_period, state) => {
      addLog(`시간대 변경: ${state.periodKorean}`, 'info');

      // 22:00 취침 체크
      const hour = state.hour;
      if (hour === 22 && agents.size > 0) {
        npcSleep();
      }
    },
    onDayChange: (day, _state) => {
      addLog(`🌅 ${day}일차 시작!`, 'success');
      // 새 날 시작 시 모든 NPC 기상
      if (agents.size > 0) {
        npcWakeUp(day);
      }
    },
  });

  // 초기 UI 업데이트
  updateGameTimeUI(gameTime.getState());

  // 시간 흐름 시작
  gameTime.start();
  addLog('게임 시간 시작 (1초 = 1분)', 'info');

  // 시간 일시정지 버튼
  const timeToggleBtn = document.getElementById('timeToggleBtn') as HTMLButtonElement;
  timeToggleBtn.addEventListener('click', () => {
    if (gameTime.isRunning()) {
      gameTime.pause();
      timeToggleBtn.textContent = '▶️';
      timeToggleBtn.classList.add('paused');
      addLog('시간 일시정지', 'warning');
    } else {
      gameTime.start();
      timeToggleBtn.textContent = '⏸️';
      timeToggleBtn.classList.remove('paused');
      addLog('시간 재개', 'info');
    }
  });
}

// 채팅 초기화
async function initChat() {
  // 게임 시간 초기화 - NPC 생성보다 먼저
  initGameTime();

  // 게임 월드 초기화 (15x12 맵)
  gameWorld = new GameWorld(gameGrid, gameStatus, {
    gridSize: 15, // 확장된 맵 크기
    onPlayerMove: (_position, npc) => {
      nearbyNpc = npc;
      if (npc) {
        // 근처 NPC를 현재 대화 대상으로 설정
        currentNpcId = npc.id;
        userInput.placeholder = `${npc.name}에게 말하기... (근처에 있음!)`;
      } else {
        currentNpcId = null;
        userInput.placeholder = 'NPC 근처로 이동하세요...';
      }

      // 플레이어 이동 시 모든 NPC의 인식 체크
      for (const controller of npcControllers.values()) {
        controller.perceiveAndRemember();
      }
    },
    onNpcInteract: (npc) => {
      if (npc) {
        currentNpcId = npc.id;
        userInput.focus();
        addLog(`${npc.name}과 대화 시작`, 'info');
      }
    },
    onTileClick: (tileInfo) => {
      updateTileInfoUI(tileInfo);
    },
  });

  // 플레이어 시작 위치 (맵 중앙)
  gameWorld.setPlayerPosition(7, 5);

  // 모든 NPC에 대해 Agent와 Controller 생성
  for (const npcDef of NPC_DEFINITIONS) {
    // Agent 생성
    const agent = new NPCAgent(npcDef.persona, npcDef.scratch);
    agent.seedKnowledge(npcDef.knowledge);
    agents.set(npcDef.id, agent);

    // Controller 생성 및 월드 배치
    const controller = new NpcController(npcDef, agent, gameWorld, {
      onLog: (message, type) => {
        addLog(message, type);
        if (npcDef.id === 'blacksmith_john') {
          updateMemoryUI();
        } else if (npcDef.id === 'innkeeper_rosa') {
          updateRosaMemoryUI();
        }
      },
      // 자율 발화 콜백 (논문: Reaction & Dialogue System)
      onSpontaneousUtterance: (utterance, npcId) => {
        const npcAgent = agents.get(npcId);
        const npcName = npcAgent?.getName() || 'NPC';

        // 1. 메시지 표시
        addMessage('npc', utterance, npcName);

        // 2. 현재 NPC 설정 및 채팅 활성화
        currentNpcId = npcId;
        userInput.disabled = false;
        userInput.placeholder = `${npcName}에게 답하기...`;
        userInput.focus();

        // 3. 메모리 UI 업데이트 (자율 발화가 메모리에 저장되므로)
        if (npcId === 'blacksmith_john') {
          updateMemoryUI();
        } else if (npcId === 'innkeeper_rosa') {
          updateRosaMemoryUI();
        }
      },
      // NPC간 대화 콜백
      onNpcConversation: (speakerId, speakerName, utterance) => {
        addMessage('npc', utterance, speakerName);
        // 메모리 UI 업데이트
        if (speakerId === 'blacksmith_john') {
          updateMemoryUI();
        } else if (speakerId === 'innkeeper_rosa') {
          updateRosaMemoryUI();
        }
      },
      // 다른 NPC Agent 가져오기
      getOtherNpcAgent: (npcId) => {
        return agents.get(npcId) || null;
      },
    });
    controller.setupWorld();
    npcControllers.set(npcDef.id, controller);

    addLog(`${npcDef.persona.name} 로드됨 (메모리: ${agent.getMemoryCount()}개)`, 'info');
  }

  addLog('게임 월드 초기화 완료', 'success');

  // 전체 UI 초기화
  updateAllUI();
  chatCount = 0;
  updateChatCounter();

  // 시스템 로그 초기화
  systemLog.innerHTML = '';
  addLog('NPC Agent 초기화 완료', 'success');
  addLog(`${NPC_DEFINITIONS.length}명의 NPC 로드됨`, 'info');

  // 모든 NPC 기상 및 하루 계획 생성 (게임 시작 = 06:00)
  await npcWakeUp(gameTime.getState().day);

  // 안내 메시지
  addMessage('system', 'NPC 근처로 이동하면 대화할 수 있습니다. (WASD/방향키)', '시스템');
  userInput.placeholder = 'NPC 근처로 이동하세요...';

  userInput.focus();
}

// 이벤트 리스너
sendButton.addEventListener('click', sendMessage);
userInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    sendMessage();
  }
});

apiKeySubmit.addEventListener('click', submitApiKey);
apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    submitApiKey();
  }
});

clearMemoryBtn.addEventListener('click', clearMemory);

// 초기화
function init() {
  if (!gemini.hasApiKey()) {
    showApiKeyModal();
  } else {
    initChat();
  }
}

init();
