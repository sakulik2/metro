/**
 * 上过车没有，存在 localStorage 里。
 *
 * 只服务开场入口：头一回来看一眼介绍，之后直接进第一站 —— 入口不能变成
 * 每次都要过的一道门。
 *
 * 单独一个键，不塞进 metro:cleared：那里记的是每个游戏通关几次，
 * 「来过没有」不是任何一关的进度，粒度不一样。
 *
 * 读写同样全部包 try/catch（隐私模式下会直接抛）。读不到就当头一回来：
 * 代价只是多看一次介绍。
 */

const KEY = 'metro:boarded';

export function hasBoarded(): boolean {
  try {
    return localStorage.getItem(KEY) !== null;
  } catch {
    return false;
  }
}

export function markBoarded(): void {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // 存不进去就算了：这一次已经上车，只是下次还会看到介绍
  }
}

