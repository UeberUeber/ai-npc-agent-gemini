/**
 * 용사 스마게 - 플레이어 캐릭터 데이터
 */

import { Persona, Scratch } from '../agent';

export const heroPersona: Persona = {
  id: 'hero_smage',
  name: '용사 스마게',
  age: 24,
  occupation: '떠돌이 용사',
  location: '윈터홀드 마을',
  traits: ['정의감', '호기심', '낙천적', '덤벙거림'],
  backstory:
    '스마게는 변방 마을 출신의 청년으로, 어린 시절 마을을 습격한 고블린 무리로부터 떠돌이 기사에게 구출된 후 용사가 되기로 결심했다. 왕국 기사단에서 3년간 수련했으나, 정식 기사 서임식 직전 "책상머리 기사보단 진짜 모험가가 되겠다"며 뛰쳐나왔다. 검술은 중급 수준이지만, 위기 상황에서 포기하지 않는 끈기와 어디서든 친구를 만드는 친화력이 강점이다. 최근 윈터홀드 마을에 몬스터가 자주 출몰한다는 소문을 듣고 첫 모험지로 삼아 찾아왔다.',
  currentGoals: ['마을 주변 몬스터 소탕하기', '제대로 된 무기 장만하기', '용사로서 명성 쌓기'],
  speechStyle: '밝고 씩씩한 반말. 예: "안녕!", "뭔가 도와줄 일 없어?", "이 정도는 식은 죽 먹기지!" 흥분하면 허세가 심해짐.',
};

export const heroScratch: Scratch = {
  currentLocation: '윈터홀드 마을 광장',
  currentActivity: '마을 구경 중',
  currentMood: 'curious',
  currentTime: '14:30',
};

// 플레이어 이름 상수 (다른 모듈에서 사용)
export const PLAYER_NAME = '용사 스마게';
