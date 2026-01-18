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
import { GameWorld, Entity, TileInfo } from '../client/game/world';
import { GameTime, GameTimeState } from '../client/game/time';
import { NpcController } from '../client/game/npc-controller';

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

// NPC Agent & Controller
let agent: NPCAgent;
let npcController: NpcController;

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

// 대화 카운터
let chatCount = 0;

// 시스템 로그 추가
function addLog(message: string, type: 'info' | 'success' | 'warning' = 'info') {
  const time = new Date().toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const logItem = document.createElement('div');
  logItem.className = `log-item ${type}`;
  logItem.innerHTML = `<span class="timestamp">[${time}]</span>${message}`;
  systemLog.appendChild(logItem);
  systemLog.scrollTop = systemLog.scrollHeight;

  // 최대 50개 로그 유지
  while (systemLog.children.length > 50) {
    systemLog.removeChild(systemLog.firstChild!);
  }
}

// 대화 카운터 업데이트
function updateChatCounter() {
  chatCounter.textContent = `대화: ${chatCount}/10`;
}

// 메시지 추가
function addMessage(type: 'user' | 'npc' | 'system', content: string, sender: string) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${type}`;

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = type === 'user' ? '🦸' : type === 'npc' ? '🔨' : '⚙️';

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
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// 타이핑 인디케이터
function showTypingIndicator() {
  const indicator = document.createElement('div');
  indicator.className = 'message npc';
  indicator.id = 'typingIndicator';

  const avatar = document.createElement('div');
  avatar.className = 'message-avatar';
  avatar.textContent = '🔨';

  const typing = document.createElement('div');
  typing.className = 'typing-indicator';
  typing.innerHTML = '<span></span><span></span><span></span>';

  indicator.appendChild(avatar);
  indicator.appendChild(typing);
  chatMessages.appendChild(indicator);
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

function hideTypingIndicator() {
  document.getElementById('typingIndicator')?.remove();
}

// 페르소나 UI 업데이트
function updatePersonaUI() {
  const persona = agent.getPersona();
  npcName.textContent = persona.name;
  npcAge.textContent = `${persona.age}세`;
  npcOccupation.textContent = persona.occupation;
  npcTraits.textContent = persona.traits.join(', ');
  npcBackstory.textContent = persona.backstory;
  npcGoals.textContent = persona.currentGoals.join(' / ');
}

// Scratch(환경/상태) UI 업데이트
function updateScratchUI() {
  const scratch = agent.getScratch();
  npcLocation.textContent = scratch.currentLocation;
  npcActivity.textContent = scratch.currentActivity;
  npcMood.textContent = moodKorean[scratch.currentMood] || scratch.currentMood;
  npcTime.textContent = scratch.currentTime;
}

// 대화 히스토리 UI 업데이트
function updateHistoryUI() {
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

// 메모리 스트림 UI 업데이트
function updateMemoryUI() {
  const memories = agent.getRecentMemories(10);
  memoryCount.textContent = `${agent.getMemoryCount()}개`;

  if (memories.length === 0) {
    memoryList.innerHTML = '<div class="empty-state">아직 기억이 없습니다</div>';
    return;
  }

  memoryList.innerHTML = memories
    .map(
      (m) => `
      <div class="memory-item ${m.type === 'reflection' ? 'reflection' : ''}">
        <div class="type">${m.type}</div>
        <div>${m.content}</div>
        ${renderImportance(m)}
      </div>
    `
    )
    .join('');
}

// 계획 패널 UI 업데이트
function updatePlanUI(day: number = 1) {
  const plan = agent.getDailyPlan();

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

  // NPC의 Scratch에 현재 시간 반영
  if (agent) {
    agent.updateScratch({ currentTime: state.formatted });
    updateScratchUI();
  }
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
  updateHistoryUI();
  updateMemoryUI();
}

// 메시지 전송
async function sendMessage() {
  const message = userInput.value.trim();
  if (!message) return;

  // NPC 근처가 아니면 메시지 전송 불가
  if (!nearbyNpc) {
    addMessage('system', 'NPC 근처로 이동해야 대화할 수 있습니다.', '시스템');
    return;
  }

  userInput.disabled = true;
  sendButton.disabled = true;
  userInput.value = '';

  addMessage('user', message, '용사 스마게');
  showTypingIndicator();

  try {
    const response = await agent.chat(message);
    hideTypingIndicator();
    addMessage('npc', response, agent.getName());
    chatCount = agent.getChatCount(); // Agent의 카운트와 동기화
    updateChatCounter();
    updateScratchUI(); // 감정 변화 반영
    updateHistoryUI();
    updateMemoryUI();
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
  if (confirm('모든 메모리를 삭제하시겠습니까?')) {
    agent.clearAllMemories();
    chatMessages.innerHTML = '';
    chatCount = 0;
    updateChatCounter();
    updateHistoryUI();
    updateMemoryUI();
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

// NPC 기상 (하루 시작)
async function npcWakeUp(day: number) {
  try {
    await npcController.wakeUp(day);
    updatePlanUI(day);
    updateScratchUI();
    updateMemoryUI();
  } catch (error) {
    console.error('NPC 기상 오류:', error);
    addLog('⚠️ 계획 생성 실패', 'warning');
  }
}

// NPC 취침 (하루 종료)
async function npcSleep() {
  try {
    await npcController.sleep();
    updatePlanUI();
    updateScratchUI();
    updateMemoryUI();
  } catch (error) {
    console.error('NPC 취침 오류:', error);
  }
}

// 게임 시간 초기화
function initGameTime() {
  gameTime = new GameTime({
    startDay: 1,
    startHour: 6, // 새벽 6시 시작
    startMinute: 0,
    timeScale: 5, // 실시간 1초 = 게임 5분
    onTimeChange: (state) => {
      updateGameTimeUI(state);

      // 계획 진행 상황 업데이트 (NpcController가 이동도 처리)
      if (npcController) {
        const result = npcController.updatePlanProgress(state.formatted24);
        if (result.changed && result.newActivity) {
          updatePlanUI(state.day);
          updateScratchUI();
        }
      }
    },
    onPeriodChange: (_period, state) => {
      addLog(`시간대 변경: ${state.periodKorean}`, 'info');

      // 22:00 취침, 06:00 기상 체크
      const hour = state.hour;
      if (hour === 22 && agent) {
        npcSleep();
      }
    },
    onDayChange: (day, _state) => {
      addLog(`🌅 ${day}일차 시작!`, 'success');
      // 새 날 시작 시 NPC 기상
      if (agent) {
        npcWakeUp(day);
      }
    },
  });

  // 초기 UI 업데이트
  updateGameTimeUI(gameTime.getState());

  // 시간 흐름 시작
  gameTime.start();
  addLog('게임 시간 시작 (1초 = 5분)', 'info');
}

// 채팅 초기화
async function initChat() {
  // NPC 정의에서 Agent 생성
  const npcDef = blacksmithJohn;
  agent = new NPCAgent(npcDef.persona, npcDef.scratch);

  // 세계 지식 시드 (NPC가 아는 장소, 도구, 가능한 활동)
  agent.seedKnowledge(npcDef.knowledge);

  // 게임 월드 초기화 (GameTime 포함) - NpcController보다 먼저
  initGameTime();

  gameWorld = new GameWorld(gameGrid, gameStatus, {
    gridSize: 10,
    onPlayerMove: (_position, npc) => {
      nearbyNpc = npc;
      if (npc) {
        userInput.placeholder = `${npc.name}에게 말하기... (근처에 있음!)`;
      } else {
        userInput.placeholder = 'NPC 근처로 이동하세요...';
      }
    },
    onNpcInteract: (npc) => {
      if (npc) {
        userInput.focus();
        addLog(`${npc.name}과 대화 시작`, 'info');
      }
    },
    onTileClick: (tileInfo) => {
      updateTileInfoUI(tileInfo);
    },
  });

  // 플레이어 시작 위치
  gameWorld.setPlayerPosition(5, 7);

  // NpcController 생성 및 월드 배치
  npcController = new NpcController(npcDef, agent, gameWorld, {
    onLog: (message, type) => {
      addLog(message, type);
      updateMemoryUI();
    },
  });
  npcController.setupWorld();

  addLog('게임 월드 초기화 완료', 'success');

  // 전체 UI 초기화
  updateAllUI();
  chatCount = 0;
  updateChatCounter();

  // 시스템 로그 초기화
  systemLog.innerHTML = '';
  addLog('NPC Agent 초기화 완료', 'success');
  addLog(`대장장이 존 로드됨 (메모리: ${agent.getMemoryCount()}개)`, 'info');

  // NPC 기상 및 하루 계획 생성 (게임 시작 = 06:00)
  await npcWakeUp(gameTime.getState().day);

  // NPC 근처가 아니면 인사 건너뜀
  if (!nearbyNpc) {
    addMessage('system', 'NPC 근처로 이동하면 대화할 수 있습니다. (WASD/방향키/클릭)', '시스템');
    userInput.placeholder = 'NPC 근처로 이동하세요...';
  } else {
    // LLM으로 첫 인사 생성
    addLog('LLM 인사 생성 중...', 'info');
    showTypingIndicator();
    const greeting = await agent.greet();
    hideTypingIndicator();
    addMessage('npc', greeting, agent.getName());
    addLog('인사 생성 완료', 'success');
  }

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
