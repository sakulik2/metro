/** 一道题 = 线路上的一站。 */
export type Question = {
  /** 线路图上的短标签。只说这站问什么，绝不能透露答案。 */
  station: string;
  q: string;
  options: string[];
  /** options 的下标。 */
  answer: number;
  hint: string;
  explain: string;
};

/** 一条线路 = 一个题目模块。 */
export type Line = {
  id: number;
  name: string;
  /** 线路色，#RRGGBB。整页主色随当前线路切换。 */
  color: string;
  questions: Question[];
};

/** 每站的作答记录：null 表示还没答。 */
export type Picks = (number | null)[][];

/**
 * 旅程所处的阶段。
 * 'game' 是 1 号线走完后的售票窗口，那一关用 1863 年的真实票价练 £sd 找零。
 */
export type Phase = 'ride' | 'game' | 'transfer' | 'end';
