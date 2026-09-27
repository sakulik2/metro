import type { Line, Question } from './types';

// 加一条线：在 src/data/lines/ 放一个 JSON，然后在这里 import 并加进 RAW。
// 顺序就是乘车顺序。
import origins from './lines/1-origins.json';
import engineering from './lines/2-engineering.json';
import drawings from './lines/3-drawings.json';
import operations from './lines/4-operations.json';

const RAW: unknown[] = [origins, engineering, drawings, operations];

const HEX = /^#[0-9A-Fa-f]{6}$/;

function fail(where: string, why: string): never {
  throw new Error(`题库有问题 · ${where}：${why}`);
}

function readQuestion(where: string, raw: unknown): Question {
  if (typeof raw !== 'object' || raw === null) fail(where, '这一题不是对象');
  const q = raw as Record<string, unknown>;

  for (const key of ['station', 'q', 'hint', 'explain'] as const) {
    const v = q[key];
    if (typeof v !== 'string' || v.trim() === '') fail(where, `${key} 缺失或为空`);
  }

  const options = q.options;
  if (!Array.isArray(options) || options.length < 2) fail(where, 'options 至少要两项');
  options.forEach((o, i) => {
    if (typeof o !== 'string' || o.trim() === '') fail(where, `第 ${i + 1} 个选项为空`);
  });

  const answer = q.answer;
  if (typeof answer !== 'number' || !Number.isInteger(answer)) fail(where, 'answer 不是整数');
  if (answer < 0 || answer >= options.length) fail(where, `answer=${answer} 超出选项范围`);

  return {
    station: q.station as string,
    q: q.q as string,
    options: options as string[],
    answer,
    hint: q.hint as string,
    explain: q.explain as string,
  };
}

function readLine(raw: unknown, idx: number): Line {
  const at = `第 ${idx + 1} 条线`;
  if (typeof raw !== 'object' || raw === null) fail(at, '不是对象');
  const l = raw as Record<string, unknown>;

  const name = l.name;
  if (typeof name !== 'string' || name.trim() === '') fail(at, 'name 缺失');

  const color = l.color;
  if (typeof color !== 'string' || !HEX.test(color)) fail(`${at} ${name}`, 'color 要写成 #RRGGBB');

  const questions = l.questions;
  if (!Array.isArray(questions) || questions.length === 0) fail(`${at} ${name}`, '一条线至少一站');

  return {
    id: typeof l.id === 'number' ? l.id : idx + 1,
    name,
    color,
    questions: questions.map((q, i) =>
      readQuestion(`${name} 第 ${i + 1} 站`, q),
    ),
  };
}

export const LINES: Line[] = RAW.map(readLine);

export const TOTAL_STOPS = LINES.reduce((n, l) => n + l.questions.length, 0);

/**
 * 哪条线走完之后挂哪个小游戏（键是线的下标，0 = 1 号线）。
 * 加一个游戏：写好组件，在这里挂上线号，再去 App.tsx 加一个分支。
 * 详见 ROADMAP.md。
 */
export const GAMES: Record<number, string> = {
  0: 'booking',  // 1863 售票窗口，练 £sd 找零
  2: 'drawing',  // 1931 贝克的绘图板，45 度取直
};

/** 这条线走完之后有游戏吗？ */
export const gameAfter = (line: number): string | undefined => GAMES[line];

/** A、B、C… 选项编号。 */
export const KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

/** 站号，形如 3-02：第 3 号线第 2 站。 */
export const stopCode = (line: number, stop: number): string =>
  `${line + 1}-${String(stop + 1).padStart(2, '0')}`;

/** 线路全名，用在线路图标签和换乘页。 */
export const lineTitle = (line: number): string => {
  const l = LINES[line];
  if (!l) return '';
  return `${l.id} 号线　${l.name}`;
};
