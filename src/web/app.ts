/**
 * 웹 UI 애플리케이션
 *
 * 서버 없이 브라우저에서 직접 동작합니다.
 * - Gemini API 직접 호출
 * - localStorage에 메모리 저장
 */

import { gemini } from '../client/gemini';
import { NPCAgent } from '../client/agent';
import { blacksmithPersona, blacksmithScratch } from '../client/npcs/blacksmith';

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

// NPC Agent
let agent: NPCAgent;

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
  avatar.textContent = type === 'user' ? '🧑' : type === 'npc' ? '🔨' : '⚙️';

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
        <div class="type">${msg.speaker === 'user' ? '손님' : agent.getName()}</div>
        <div>${msg.content}</div>
      </div>
    `
    )
    .join('');
}

// 중요도 표시 생성 (미평가/평가완료 구분 + 툴팁)
function renderImportance(memory: { type: string; importance: number }): string {
  // observation 타입이고 importance가 5(기본값)이면 미평가
  const isPending = memory.type === 'observation' && memory.importance === 5;
  // reflection은 생성 시 importance 8로 설정되므로 항상 평가됨

  const statusClass = isPending ? 'pending' : 'evaluated';
  const displayText = isPending ? '⏳ 미평가' : `✓ ${memory.importance}/10`;

  const tooltip = `
    <div class="importance-tooltip">
      <h4>📊 중요도 평가 시스템</h4>
      <p>NPC가 기억의 중요성을 1-10점으로 평가합니다. 중요한 기억일수록 대화에서 더 잘 떠올립니다.</p>

      <div class="section">
        <div class="section-title">평가 기준</div>
        <div class="scale">
          <div class="scale-item"><span class="num">1-3</span><br>일상 인사</div>
          <div class="scale-item"><span class="num">4-6</span><br>일반 대화</div>
          <div class="scale-item"><span class="num">7-10</span><br>중요 사건</div>
        </div>
      </div>

      <div class="section">
        <div class="section-title">왜 즉시 평가하지 않나요?</div>
        <div class="section-content">
          메모리 저장마다 LLM API를 호출하면 <strong>비용 증가</strong>와 <strong>응답 지연</strong>이 발생합니다.
          대신 기본값 <code>5</code>로 저장 후 일괄 평가하여 효율성을 높였습니다.
        </div>
      </div>

      <div class="section">
        <div class="section-title">평가 시점 (Reflection 트리거)</div>
        <div class="section-content">
          <strong>대화 10개가 쌓이면</strong> 자동으로:<br>
          1️⃣ 미평가 메모리들을 LLM에게 일괄 전송<br>
          2️⃣ 각 기억의 중요도 1-10점 평가<br>
          3️⃣ Reflection(성찰) 메모리 생성
        </div>
      </div>

      <div class="section">
        <div class="section-title">메모리 검색 시 활용</div>
        <div class="section-content">
          검색 스코어 공식:<br>
          <code>score = recency + importance + relevance</code><br>
          • recency: 최근 접근할수록 높음<br>
          • importance: 이 중요도 점수<br>
          • relevance: 쿼리와 유사할수록 높음
        </div>
      </div>

      <div class="section">
        <div class="section-title">현재 상태</div>
        <div class="section-content">
          ${isPending
            ? '⏳ <strong>미평가</strong> - 대화 10개 도달 시 평가 예정'
            : `✅ <strong>평가 완료</strong> - 중요도 ${memory.importance}점`}
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

  userInput.disabled = true;
  sendButton.disabled = true;
  userInput.value = '';

  addMessage('user', message, '나');
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

// 채팅 초기화
async function initChat() {
  agent = new NPCAgent(blacksmithPersona, blacksmithScratch);

  // 로그 콜백 설정
  agent.setLogCallback((message, type) => {
    addLog(message, type);
    updateMemoryUI(); // Reflection 후 메모리 UI 업데이트
  });

  // 전체 UI 초기화
  updateAllUI();
  chatCount = 0;
  updateChatCounter();

  // 시스템 로그 초기화
  systemLog.innerHTML = '';
  addLog('NPC Agent 초기화 완료', 'success');
  addLog(`대장장이 존 로드됨 (메모리: ${agent.getMemoryCount()}개)`, 'info');

  // LLM으로 첫 인사 생성
  addLog('LLM 인사 생성 중...', 'info');
  showTypingIndicator();
  const greeting = await agent.greet();
  hideTypingIndicator();
  addMessage('npc', greeting, agent.getName());
  addLog('인사 생성 완료', 'success');

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
