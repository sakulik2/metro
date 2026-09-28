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
 * 'intro' 是上车前的开场入口，只有头一回来的人会经过。
 * 'game' 是挂在某条线后面的小游戏，见 GAMES。
 */
export type Phase = 'intro' | 'ride' | 'game' | 'transfer' | 'end';
