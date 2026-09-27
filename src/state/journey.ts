import { LINES, gameAfter } from '../data/lines';
import type { Phase, Picks } from '../data/types';

/**
 * 旅程状态。line / stop / phase 之外的一切都从 picks 推导出来，
 * 所以没有「两份状态不同步」这种问题。
 */
export type Journey = {
  line: number;
  stop: number;
  phase: Phase;
  picks: Picks;
  /** 每换一站就 +1，用来触发进站动画。 */
  tick: number;
};

export type Action =
  | { type: 'choose'; option: number }
  | { type: 'advance' }
  | { type: 'restart' }
  | { type: 'jump'; to: Journey };

const emptyPicks = (): Picks => LINES.map((l) => l.questions.map(() => null));

export const initialJourney: Journey = {
  line: 0,
  stop: 0,
  phase: 'ride',
  picks: emptyPicks(),
  tick: 0,
};

/** 当前这条线有几站。 */
const stopsOn = (line: number): number => LINES[line]?.questions.length ?? 0;

export function journeyReducer(state: Journey, action: Action): Journey {
  switch (action.type) {
    case 'choose': {
      if (state.phase !== 'ride') return state;
      if (pickAt(state, state.line, state.stop) !== null) return state;

      const picks = state.picks.map((row, l) =>
        l === state.line
          ? row.map((p, s) => (s === state.stop ? action.option : p))
          : row,
      );
      return { ...state, picks };
    }

    case 'advance': {
      if (state.phase === 'end') return state;

      if (state.phase === 'transfer') {
        return {
          ...state,
          line: state.line + 1,
          stop: 0,
          phase: 'ride',
          tick: state.tick + 1,
        };
      }

      // 从售票窗口出来：接着换乘，或者这已经是最后一条线
      if (state.phase === 'game') {
        const lastLine = state.line === LINES.length - 1;
        return { ...state, phase: lastLine ? 'end' : 'transfer', tick: state.tick + 1 };
      }

      // 没答完不能走
      if (pickAt(state, state.line, state.stop) === null) return state;

      const last = state.stop === stopsOn(state.line) - 1;
      if (!last) {
        return { ...state, stop: state.stop + 1, tick: state.tick + 1 };
      }

      // 这条线如果挂着小游戏，先去玩，再谈换乘
      if (gameAfter(state.line)) {
        return { ...state, phase: 'game', tick: state.tick + 1 };
      }

      const lastLine = state.line === LINES.length - 1;
      return {
        ...state,
        phase: lastLine ? 'end' : 'transfer',
        tick: state.tick + 1,
      };
    }

    case 'restart':
      return { ...initialJourney, picks: emptyPicks(), tick: state.tick + 1 };

    // 测试跳关用，见 src/dev/testRoute.ts
    case 'jump':
      return { ...action.to, tick: state.tick + 1 };
  }
}

/* ── 推导出来的读法 ─────────────────────────────── */

export const pickAt = (j: Journey, line: number, stop: number): number | null =>
  j.picks[line]?.[stop] ?? null;

/** 当前站答过了没有。 */
export const answered = (j: Journey): boolean =>
  pickAt(j, j.line, j.stop) !== null;

/** 某站答对了没有。没答过返回 false。 */
export const isRight = (j: Journey, line: number, stop: number): boolean => {
  const pick = pickAt(j, line, stop);
  if (pick === null) return false;
  return pick === LINES[line]?.questions[stop]?.answer;
};

/** 线路图上一个节点的样子：答对填实、答错空心、没答过是小灰点。 */
export type Mark = 'right' | 'wrong' | undefined;

export const markAt = (j: Journey, line: number, stop: number): Mark => {
  if (pickAt(j, line, stop) === null) return undefined;
  return isRight(j, line, stop) ? 'right' : 'wrong';
};

export const lineScore = (j: Journey, line: number): number =>
  (j.picks[line] ?? []).reduce<number>(
    (n, _, stop) => n + (isRight(j, line, stop) ? 1 : 0),
    0,
  );

export const totalScore = (j: Journey): number =>
  LINES.reduce((n, _, line) => n + lineScore(j, line), 0);

/** 这条线答错的站，用在换乘页。 */
export const missedOn = (j: Journey, line: number) =>
  (LINES[line]?.questions ?? [])
    .map((q, stop) => ({ q, stop }))
    .filter(({ stop }) => !isRight(j, line, stop));

/**
 * 小游戏那一屏，站台边缘带上主按钮的文案。
 *
 * 原来不分情况一律写「回到线路」，但它出现在两个意思完全不同的时刻：
 * 还没玩完时按是**跳过**，玩完了按是**继续往下走**。后者读起来像退回去，
 * 而实际上按下去是前进到换乘或终点。
 *
 * 所以按「玩完了没有」分两句。done 由各游戏自己的 reducer 判断并传进来 ——
 * 不进 journey，避免多一个真相来源。
 */
export const gameLabel = (j: Journey, done: boolean): string => {
  if (done) return j.line === LINES.length - 1 ? '到终点' : '本线走完';
  return '先跳过';
};

/** 站台边缘带上主按钮的文案。动作叫什么，按钮就叫什么。 */
export const nextLabel = (j: Journey): string => {
  if (j.phase === 'transfer') return `换乘 ${j.line + 2} 号线`;
  const last = j.stop === stopsOn(j.line) - 1;
  if (!last) return '下一站';
  const game = gameAfter(j.line);
  if (game === 'booking') return '去售票窗口';
  if (game === 'drawing') return '去绘图室';
  return j.line === LINES.length - 1 ? '到终点' : '本线走完';
};
