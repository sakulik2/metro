import { GAMES, LINES } from '../data/lines';
import type { Picks } from '../data/types';
import type { Journey } from '../state/journey';

/**
 * 测试用跳关路由。
 *
 * 两种写法都认，因为它们各有各的去处：
 *   /test/ticket     路径式，Vite dev server 会回落到 index.html
 *   #/test/ticket    哈希式，静态托管（GitHub Pages）上唯一可靠的一种
 *
 * 站号沿用界面上那块站号牌的写法（stopCode，形如 3-02），
 * 所以你在屏幕上看到什么码，就能把什么码敲进地址栏。
 */

export type Target =
  | { kind: 'stop'; line: number; stop: number }
  | { kind: 'game'; line: number }
  | { kind: 'transfer'; line: number }
  | { kind: 'end' };

/** 别名 → 目标。名字取自游戏和线路自己的叫法，不另造一套词。 */
const ALIASES: Record<string, () => Target | null> = {
  // 游戏
  ticket: () => gameTarget('booking'),
  booking: () => gameTarget('booking'),
  售票: () => gameTarget('booking'),
  drawing: () => gameTarget('drawing'),
  beck: () => gameTarget('drawing'),
  绘图: () => gameTarget('drawing'),
  // 终点
  end: () => ({ kind: 'end' }),
  finish: () => ({ kind: 'end' }),
  终点: () => ({ kind: 'end' }),
};

/** 找出挂着某个游戏的那条线。 */
function gameTarget(id: string): Target | null {
  const entry = Object.entries(GAMES).find(([, g]) => g === id);
  if (!entry) return null;
  return { kind: 'game', line: Number(entry[0]) };
}

/** 线路的英文短名，取自题库文件名，可以直接写在 URL 里。 */
const LINE_SLUGS = ['origins', 'engineering', 'drawings', 'operations'];

const validStop = (line: number, stop: number): boolean =>
  line >= 0 && line < LINES.length && stop >= 0 && stop < (LINES[line]?.questions.length ?? 0);

/**
 * 解析一段路由。认这些写法：
 *   3-02   第 3 号线第 2 站        3       第 3 号线第 1 站
 *   1-x    1 号线走完的换乘页      ticket  售票窗口
 *   drawings        按线路短名跳到那条线开头
 */
export function parseTarget(raw: string): Target | null {
  const key = decodeURIComponent(raw).trim().toLowerCase();
  if (!key) return null;

  const alias = ALIASES[key];
  if (alias) return alias();

  const slug = LINE_SLUGS.indexOf(key);
  if (slug >= 0 && slug < LINES.length) return { kind: 'stop', line: slug, stop: 0 };

  // 1-x：这条线走完之后的换乘页
  const xfer = /^(\d+)-x$/.exec(key);
  if (xfer?.[1]) {
    const line = Number(xfer[1]) - 1;
    if (line >= 0 && line < LINES.length - 1) return { kind: 'transfer', line };
    return null;
  }

  // 3-02 或 3-2
  const code = /^(\d+)-(\d+)$/.exec(key);
  if (code?.[1] && code[2]) {
    const line = Number(code[1]) - 1;
    const stop = Number(code[2]) - 1;
    return validStop(line, stop) ? { kind: 'stop', line, stop } : null;
  }

  // 单个数字：那条线的第一站
  const only = /^(\d+)$/.exec(key);
  if (only?.[1]) {
    const line = Number(only[1]) - 1;
    return validStop(line, 0) ? { kind: 'stop', line, stop: 0 } : null;
  }

  return null;
}

export type Route =
  | { mode: 'app' }
  | { mode: 'panel' }
  | { mode: 'jump'; target: Target; raw: string }
  | { mode: 'unknown'; raw: string };

/**
 * 从当前地址读出路由。
 *
 * 哈希优先，因为它在静态托管上总是可用；路径式只在 dev server 回落到
 * index.html 时才成立。两者都写了就听哈希的，这样 /test#/test/drawing
 * 这种地址也有确定的解释。
 */
export function readRoute(loc: { pathname: string; hash: string } = window.location): Route {
  const fromHash = loc.hash.replace(/^#\/?/, '');
  const fromPath = loc.pathname.replace(/^\/+/, '');
  const source = /^test(\/|$)/i.test(fromHash) ? fromHash : fromPath;

  const parts = source.split('/').filter(Boolean);
  if (parts[0]?.toLowerCase() !== 'test') return { mode: 'app' };

  const rest = parts.slice(1).join('/');
  if (!rest) return { mode: 'panel' };

  const target = parseTarget(rest);
  return target ? { mode: 'jump', target, raw: rest } : { mode: 'unknown', raw: rest };
}

/**
 * 面板上每个去处的链接。
 *
 * 跟着当前入口方式走：从 /test 路径进来就继续用路径，从 #/test 进来就用哈希。
 * 写死哈希会拼出 /test#/test/drawing 这种两段地址，两边都能匹配，反而乱。
 */
export function hrefFor(slug: string, loc: { pathname: string } = window.location): string {
  return /^\/test(\/|$)/i.test(loc.pathname) ? `/test/${slug}` : `#/test/${slug}`;
}

/**
 * 把目标变成一份完整的旅程状态。
 *
 * 之前的站按正确答案填上：换乘页要列漏掉的站，线网图要按线报分，
 * 一路留空的话这两屏全是零，等于测不到东西。
 */
export function journeyFor(target: Target): Journey {
  const picks: Picks = LINES.map((l) => l.questions.map(() => null));

  /** 把某条线某一段填成已答对。 */
  const fill = (line: number, upto: number) => {
    const qs = LINES[line]?.questions ?? [];
    for (let s = 0; s < Math.min(upto, qs.length); s++) {
      const row = picks[line];
      if (row) row[s] = qs[s]?.answer ?? null;
    }
  };

  const line = target.kind === 'end' ? LINES.length - 1 : target.line;

  // 目标之前的整条线都走完
  for (let l = 0; l < line; l++) fill(l, LINES[l]?.questions.length ?? 0);

  switch (target.kind) {
    case 'stop':
      fill(line, target.stop);
      return { line, stop: target.stop, phase: 'ride', picks, tick: 1 };

    case 'game':
    case 'transfer': {
      const last = (LINES[line]?.questions.length ?? 1) - 1;
      fill(line, last + 1);
      return { line, stop: last, phase: target.kind, picks, tick: 1 };
    }

    case 'end': {
      fill(line, LINES[line]?.questions.length ?? 0);
      return { line, stop: (LINES[line]?.questions.length ?? 1) - 1, phase: 'end', picks, tick: 1 };
    }
  }
}

/** 目标的人话描述，面板和错误提示共用。 */
export function describe(target: Target): string {
  switch (target.kind) {
    case 'stop': {
      const line = LINES[target.line];
      const q = line?.questions[target.stop];
      return `${line?.id} 号线 ${line?.name}　第 ${target.stop + 1} 站${q ? `　${q.station}` : ''}`;
    }
    case 'game': {
      const id = GAMES[target.line];
      return id === 'booking' ? '售票窗口（1863）' : '绘图室（1931）';
    }
    case 'transfer':
      return `${LINES[target.line]?.id} 号线走完，换乘页`;
    case 'end':
      return '终点，线网图';
  }
}
