/**
 * API 서버
 *
 * 웹 UI와 NPC Agent를 연결하는 HTTP 서버입니다.
 *
 * 엔드포인트:
 * - POST /api/chat - NPC와 대화
 * - GET /api/npc/:id/status - NPC 상태 조회
 * - GET /api/npc/:id/memories - NPC 메모리 조회
 */

import http from 'http';
import 'dotenv/config';
import { NPCAgent } from './lib/npc/agent.js';

const PORT = 3001;

// NPC 에이전트 인스턴스 (싱글톤으로 유지)
const agents: Map<string, NPCAgent> = new Map();

function getAgent(npcId: string): NPCAgent {
  if (!agents.has(npcId)) {
    agents.set(npcId, new NPCAgent(npcId));
  }
  return agents.get(npcId)!;
}

// CORS 헤더 추가
function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

// JSON 응답 헬퍼
function sendJson(res: http.ServerResponse, data: unknown, status = 200) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

// 요청 바디 파싱
async function parseBody(req: http.IncomingMessage): Promise<unknown> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => (body += chunk));
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch {
        reject(new Error('Invalid JSON'));
      }
    });
    req.on('error', reject);
  });
}

const server = http.createServer(async (req, res) => {
  setCorsHeaders(res);

  // OPTIONS 요청 처리 (CORS preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url || '/', `http://localhost:${PORT}`);
  const path = url.pathname;

  try {
    // POST /api/chat - NPC와 대화
    if (req.method === 'POST' && path === '/api/chat') {
      const body = (await parseBody(req)) as { npcId: string; message: string };

      if (!body.npcId || !body.message) {
        sendJson(res, { error: 'npcId and message are required' }, 400);
        return;
      }

      const agent = getAgent(body.npcId);
      const response = await agent.chat(body.message);

      sendJson(res, {
        npcId: body.npcId,
        npcName: agent.getName(),
        response,
        memoryCount: agent.getMemoryCount(),
      });
      return;
    }

    // GET /api/npc/:id/status - NPC 상태 조회
    const statusMatch = path.match(/^\/api\/npc\/([^/]+)\/status$/);
    if (req.method === 'GET' && statusMatch) {
      const npcId = statusMatch[1];
      const agent = getAgent(npcId);
      const scratch = agent.getScratch();

      sendJson(res, {
        npcId,
        npcName: agent.getName(),
        status: scratch,
        memoryCount: agent.getMemoryCount(),
      });
      return;
    }

    // GET /api/npc/:id/memories - NPC 메모리 조회
    const memoriesMatch = path.match(/^\/api\/npc\/([^/]+)\/memories$/);
    if (req.method === 'GET' && memoriesMatch) {
      const npcId = memoriesMatch[1];
      const agent = getAgent(npcId);

      // MemoryStore에 직접 접근할 수 없으므로 agent를 통해 가져오도록 수정 필요
      // 일단은 메모리 파일 직접 읽기
      const fs = await import('fs');
      const pathModule = await import('path');
      const memoriesPath = pathModule.join(
        process.cwd(),
        'data',
        'npcs',
        npcId,
        'memories.jsonl'
      );

      let memories: unknown[] = [];
      if (fs.existsSync(memoriesPath)) {
        const content = fs.readFileSync(memoriesPath, 'utf-8');
        const lines = content.split('\n').filter((line) => line.trim());
        memories = lines.map((line) => JSON.parse(line));
      }

      // 최근 10개만 반환 (역순)
      const recentMemories = memories.slice(-10).reverse();

      sendJson(res, {
        npcId,
        totalCount: memories.length,
        memories: recentMemories,
      });
      return;
    }

    // 404 Not Found
    sendJson(res, { error: 'Not Found' }, 404);
  } catch (error) {
    console.error('Server Error:', error);
    sendJson(res, { error: 'Internal Server Error' }, 500);
  }
});

server.listen(PORT, () => {
  console.log('====================================');
  console.log('  AI NPC API 서버');
  console.log('====================================');
  console.log(`서버 실행 중: http://localhost:${PORT}`);
  console.log('');
  console.log('엔드포인트:');
  console.log('  POST /api/chat          - NPC와 대화');
  console.log('  GET  /api/npc/:id/status   - NPC 상태 조회');
  console.log('  GET  /api/npc/:id/memories - NPC 메모리 조회');
  console.log('');
});
