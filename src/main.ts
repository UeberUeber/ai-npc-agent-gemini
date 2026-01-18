/**
 * 터미널 대화 테스트
 *
 * NPC와 대화하면서 기억이 쌓이는 것을 확인할 수 있습니다.
 *
 * 사용법:
 *   npx ts-node src/main.ts
 *
 * 명령어:
 *   /quit - 종료
 *   /memories - 현재 메모리 개수 확인
 *   /status - NPC 현재 상태 확인
 */

import * as readline from 'readline';
import 'dotenv/config';
import { NPCAgent } from './lib/npc/agent.js';

async function main() {
  console.log('====================================');
  console.log('  AI NPC 대화 시스템');
  console.log('====================================');
  console.log('');

  // NPC Agent 초기화
  const agent = new NPCAgent('blacksmith_john');

  console.log('');
  console.log(`${agent.getName()}의 대장간에 들어왔습니다.`);
  console.log('대화를 시작하세요. (종료: /quit, 메모리: /memories, 상태: /status)');
  console.log('');

  // readline 인터페이스 생성
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = () => {
    rl.question('나: ', async (input) => {
      const trimmed = input.trim();

      // 빈 입력 무시
      if (!trimmed) {
        prompt();
        return;
      }

      // 명령어 처리
      if (trimmed.startsWith('/')) {
        handleCommand(trimmed, agent);
        prompt();
        return;
      }

      // NPC와 대화
      try {
        const response = await agent.chat(trimmed);
        console.log(`\n${agent.getName()}: ${response}\n`);
      } catch (error) {
        console.error('오류 발생:', error);
      }

      prompt();
    });
  };

  prompt();
}

function handleCommand(command: string, agent: NPCAgent) {
  switch (command.toLowerCase()) {
    case '/quit':
    case '/exit':
    case '/q':
      console.log('\n대장간을 나갑니다. 안녕히 가세요.');
      process.exit(0);
      break;

    case '/memories':
    case '/memory':
    case '/m':
      console.log(`\n현재 메모리 개수: ${agent.getMemoryCount()}개\n`);
      break;

    case '/status':
    case '/s':
      const scratch = agent.getScratch();
      console.log('\n=== NPC 상태 ===');
      console.log(`위치: ${scratch.currentLocation}`);
      console.log(`활동: ${scratch.currentActivity}`);
      console.log(`기분: ${scratch.currentMood}`);
      console.log(`시간: ${scratch.currentTime}`);
      console.log('================\n');
      break;

    case '/help':
    case '/h':
      console.log('\n명령어:');
      console.log('  /quit    - 종료');
      console.log('  /memories - 메모리 개수 확인');
      console.log('  /status  - NPC 상태 확인');
      console.log('  /help    - 도움말\n');
      break;

    default:
      console.log(`\n알 수 없는 명령어: ${command}`);
      console.log('/help 로 명령어 목록을 확인하세요.\n');
  }
}

main().catch(console.error);
