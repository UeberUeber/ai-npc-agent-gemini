# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

Gemini API를 활용한 RPG/판타지 세계관 NPC 에이전트 시스템. 다중 NPC를 관리하며, 각 NPC는 고유한 퍼소널리티와 감정 상태를 가지고 대화 기록을 유지한다.

## 기술 스택

- **언어**: TypeScript
- **프레임워크**: Next.js (App Router)
- **AI**: Google Gemini API (`@google/generative-ai`)
- **저장소**: 로컬 MD 파일 (대화 기록 및 NPC 설정)

## 빌드 및 실행

```bash
# 의존성 설치
npm install

# 개발 서버 실행
npm run dev

# 프로덕션 빌드
npm run build

# 타입 체크
npm run type-check

# 린트
npm run lint
```

## 아키텍처

```
src/
├── app/                    # Next.js App Router 페이지
│   ├── api/               # API 라우트
│   │   ├── chat/          # NPC 대화 엔드포인트
│   │   ├── npc/           # NPC CRUD
│   │   └── events/        # 이벤트/트리거 처리
│   └── (pages)/           # UI 페이지
├── lib/
│   ├── gemini/            # Gemini API 클라이언트 및 설정
│   ├── npc/
│   │   ├── manager.ts     # 다중 NPC 관리자
│   │   ├── personality.ts # 퍼소널리티/감정 시스템
│   │   └── types.ts       # NPC 타입 정의
│   ├── memory/
│   │   ├── store.ts       # MD 파일 기반 기억 저장소
│   │   └── context.ts     # 대화 컨텍스트 관리
│   └── events/
│       ├── triggers.ts    # 이벤트 트리거 정의
│       └── handler.ts     # 이벤트 핸들러
├── data/
│   ├── npcs/              # NPC 설정 MD 파일들
│   └── conversations/     # 대화 기록 MD 파일들
└── types/                 # 전역 타입 정의
```

## 핵심 개념

### NPC 정의 (MD 파일 형식)
```markdown
---
id: "blacksmith_john"
name: "대장장이 존"
personality:
  traits: ["성실함", "과묵함", "장인정신"]
  mood: "neutral"
  backstory: "20년간 마을의 무기를 만들어온 베테랑 대장장이"
---
```

### 감정 상태
NPC는 대화에 따라 감정 상태가 변화함: `happy`, `neutral`, `sad`, `angry`, `fearful`, `excited`

### 기억 시스템
- 단기 기억: 현재 세션의 대화 컨텍스트
- 장기 기억: MD 파일에 저장된 중요 대화 요약

### 스트리밍 응답
Gemini의 `streamGenerateContent`를 사용하여 실시간 타이핑 효과 구현

### NPC 간 대화
`/api/chat/npc-to-npc` 엔드포인트로 NPC들이 서로 대화하는 시나리오 지원

## 환경 변수

```env
GEMINI_API_KEY=your_api_key_here
```

## 주의사항

- NPC 프롬프트에 세계관 일관성 유지를 위한 시스템 프롬프트 필수 포함
- 감정 상태 변화는 대화 내용 분석 후 자동 업데이트
- MD 파일 파싱 시 frontmatter 형식 준수 (gray-matter 라이브러리 사용)
