import raw from './drawing.json';

/**
 * 贝克的绘图板，1931 年。
 *
 * 玩家逐段决定方向，把 1863 年那条歪扭的老线画成只有横、竖、45 度斜线的图。
 * 每段的「最接近真实走向的 45 度倍数」是唯一正解，真实方位角由坐标算出来，
 * 不是我定的（见 scripts/gen-drawing.mjs）。
 */

/** 八个合法方向。屏幕坐标：x 向右为东，y 向下为南。 */
export const DIRS = ['E', 'NE', 'N', 'NW', 'W', 'SW', 'S', 'SE'] as const;

export type Dir = (typeof DIRS)[number];

/** 每个方向在网格上走一步的位移。y 轴向下，所以「北」是 -1。 */
export const STEP: Record<Dir, { dx: number; dy: number }> = {
  E: { dx: 1, dy: 0 },
  NE: { dx: 1, dy: -1 },
  N: { dx: 0, dy: -1 },
  NW: { dx: -1, dy: -1 },
  W: { dx: -1, dy: 0 },
  SW: { dx: -1, dy: 1 },
  S: { dx: 0, dy: 1 },
  SE: { dx: 1, dy: 1 },
};

/**
 * 每个方向对应的角度，和 leg.bearing 同一套坐标：0° 是正东，逆时针为正。
 * 浮标上显示它，玩家自己拿去和真实走向比 —— 不直接告诉他偏了多少，
 * 那道取整是这一关要练的东西。
 */
export const DIR_ANGLE: Record<Dir, number> = DIRS.reduce(
  (m, d, i) => ({ ...m, [d]: i * 45 }),
  {} as Record<Dir, number>,
);

/** 方向在界面上怎么称呼。 */
export const DIR_NAME: Record<Dir, string> = {
  E: '正东',
  NE: '东北',
  N: '正北',
  NW: '西北',
  W: '正西',
  SW: '西南',
  S: '正南',
  SE: '东南',
};

/** 罗盘的 3×3 排布，中心留空。 */
export const COMPASS: (Dir | null)[] = ['NW', 'N', 'NE', 'W', null, 'E', 'SW', 'S', 'SE'];

export type Station = {
  name: string;
  historicName: string;
  lat: number;
  lon: number;
};

export type Leg = {
  from: string;
  to: string;
  /** 两站实际距离，公里。 */
  km: number;
  /** 真实方位角，0 = 正东，逆时针为正。 */
  bearing: number;
  /** 最接近的 45 度倍数，唯一正解。 */
  snap: Dir;
  /** 取直后偏了多少度。 */
  offBy: number;
};

export type Reveal = {
  title: string;
  spacing: string;
  distortion: string;
  history: string;
};

/**
 * 一条可画的线。
 *
 * 重玩换的是整条线，不只是少给提示 —— 同样七站、同样空间关系，第二遍考的是
 * 记性。而每条线的几何是不一样的谜题：伦敦一路向东，纽约走 Z 字，
 * 段长比 2.8× 对 16×。
 *
 * 注意「反着画同一条线」不算新内容：四舍五入在 180° 旋转下是对称的，
 * 反向画出来段长比、方向数、每段偏差全都一模一样，是完美镜像。
 */
export type LineSet = {
  station: string;
  title: string;
  year: number;
  who: string;
  intro: string;
  task: string;
  rule: string;
  /** 这条线的颜色。伦敦用大都会线真实色号，纽约那条是有理由的选择，见 colourNote。 */
  colour: string;
  colourHover: string;
  /** 颜色是怎么定的。只有需要交代的才写。 */
  colourNote?: string;
  /** 第三档收走影线之后那句提示的后半截，各条线自己说。 */
  blindHint: string;
  stations: Station[];
  legs: Leg[];
  reveal: Reveal;
  sources: string[];
};

/** 读一条线，并逐项校验。抛错时指名是第几条，而不是渲染出一张坏图。 */
function readLineSet(v: unknown, i: number): LineSet {
  const where = `第 ${i + 1} 条线`;
  if (typeof v !== 'object' || v === null) throw new Error(`${where} 不是对象`);
  const o = v as Record<string, unknown>;

  const str = (key: string): string => {
    const s = o[key];
    if (typeof s !== 'string' || !s) throw new Error(`${where} 缺 ${key}`);
    return s;
  };

  const stations = o.stations;
  if (!Array.isArray(stations) || stations.length < 3) {
    throw new Error(`${where} 至少要三个站`);
  }
  const legs: unknown = o.legs;
  if (!Array.isArray(legs) || legs.length !== stations.length - 1) {
    const got = Array.isArray(legs) ? legs.length : '缺失';
    throw new Error(`${where} 段数应为站数减一（${stations.length - 1}），实际 ${got}`);
  }
  (legs as Leg[]).forEach((l, n) => {
    if (!DIRS.includes(l.snap)) {
      throw new Error(`${where} 第 ${n + 1} 段的 snap 不是合法方向：${l.snap}`);
    }
  });

  const sources = o.sources;
  if (!Array.isArray(sources) || sources.length === 0) {
    throw new Error(`${where} 没写来源`);
  }

  return {
    station: str('station'),
    title: str('title'),
    year: Number(o.year),
    who: str('who'),
    intro: str('intro'),
    task: str('task'),
    rule: str('rule'),
    colour: str('colour'),
    colourHover: str('colourHover'),
    ...(typeof o.colourNote === 'string' && o.colourNote ? { colourNote: o.colourNote } : {}),
    blindHint: str('blindHint'),
    stations: stations as Station[],
    legs: legs as Leg[],
    reveal: o.reveal as Reveal,
    sources: sources as string[],
  };
}

const src = raw as Record<string, unknown>;

/**
 * 全部可画的线。这是模块级的不变量 —— 对应售票窗口的 ROUNDS，
 * 具体用哪一条由 setOf(run) 决定。
 */
export const LINE_SETS: LineSet[] = (src.lines as unknown[]).map(readLineSet);

export const SET_COUNT = LINE_SETS.length;

/**
 * 第 run 遍画哪一条。
 *
 * 取模循环，线用完就从头来 —— 但难度已经封顶在第三档，所以第三遍之后是
 * 「最难的规则 + 换过的线」，不会退回简单。
 */
export function setOf(run: number): LineSet {
  const i = ((run % SET_COUNT) + SET_COUNT) % SET_COUNT;
  const s = LINE_SETS[i];
  if (!s) throw new Error(`第 ${i + 1} 条线不存在`);
  return s;
}

/* ── 玩一局 ─────────────────────────────────────── */

export type Board = {
  /**
   * 画的是第几条线（LINE_SETS 的下标）。
   *
   * 存在板子里，而不是只存在组件里，是为了「重画一遍」能保住这条线 ——
   * 丢了它就会悄悄跳回第一条。售票窗口那边同一个坑由 check-tiers 钉着。
   */
  set: number;
  /** 每段选了什么方向，null 表示还没画。 */
  drawn: (Dir | null)[];
  /** 当前在画第几段。全部画完等于这条线的段数。 */
  at: number;
  /** 画完之后才翻开代价那一页。 */
  revealed: boolean;
  /**
   * 当前这一段按过几次提示。画下一段就归零 ——
   * 一段想不通不该让整条线都降难度。
   */
  hintsUsed: number;
};

/** 这块板子画的是哪条线。 */
export const lineOf = (board: Board): LineSet => setOf(board.set);

export const newBoard = (set = 0): Board => ({
  set,
  drawn: setOf(set).legs.map(() => null),
  at: 0,
  revealed: false,
  hintsUsed: 0,
});

export type Stroke =
  | { type: 'draw'; dir: Dir }
  | { type: 'undo' }
  | { type: 'hint' }
  | { type: 'reveal' }
  | { type: 'restart' };

export function draw(board: Board, stroke: Stroke): Board {
  const legs = lineOf(board).legs;

  switch (stroke.type) {
    /* 画下一段，提示次数归零 */
    case 'draw': {
      if (board.at >= legs.length) return board;
      const drawn = board.drawn.slice();
      drawn[board.at] = stroke.dir;
      return { ...board, drawn, at: board.at + 1, hintsUsed: 0 };
    }

    /*
     * 擦掉上一段。提示次数也归零 —— 擦回去是重新考虑那一段，
     * 不该把刚才要来的提示一直挂在那里。
     */
    case 'undo': {
      if (board.at === 0) return board;
      const drawn = board.drawn.slice();
      drawn[board.at - 1] = null;
      return { ...board, drawn, at: board.at - 1, hintsUsed: 0 };
    }

    /* 要提示。两次到顶。 */
    case 'hint':
      return board.at < legs.length && board.hintsUsed < 2
        ? { ...board, hintsUsed: board.hintsUsed + 1 }
        : board;

    case 'reveal':
      return board.at >= legs.length ? { ...board, revealed: true } : board;

    /* 重画。必须把 set 带上，否则会跳回第一条线。 */
    case 'restart':
      return newBoard(board.set);
  }
}

/** 某一段画对了没有。没画过返回 null。 */
export const verdictOf = (board: Board, leg: number): 'right' | 'off' | null => {
  const picked = board.drawn[leg];
  if (!picked) return null;
  return picked === lineOf(board).legs[leg]?.snap ? 'right' : 'off';
};

export const allDrawn = (board: Board): boolean => board.at >= lineOf(board).legs.length;

export const rightCount = (board: Board): number =>
  lineOf(board).legs.reduce((n, _, i) => n + (verdictOf(board, i) === 'right' ? 1 : 0), 0);

/**
 * 把已画的段折成网格顶点。每段走一格，所以图上段段等长 ——
 * 这正是后面要揭示的那个代价。
 */
export function polyline(board: Board): { x: number; y: number }[] {
  const pts = [{ x: 0, y: 0 }];
  let x = 0;
  let y = 0;
  for (const dir of board.drawn) {
    if (!dir) break;
    const s = STEP[dir];
    x += s.dx;
    y += s.dy;
    pts.push({ x, y });
  }
  return pts;
}

/**
 * 地理实况折线，投影到同一片网格上。
 *
 * 从一开始就画在纸上：绘图员手里本来就摊着地理图，做的是把它取直，不是凭空画线。
 * 这条淡影线同时也让空白的方格纸在第一眼就有内容。
 */
export function geoPolyline(stations: Station[], legs: Leg[]): { x: number; y: number }[] {
  const first = stations[0];
  if (!first) return [];

  const lat0 = stations.reduce((s, st) => s + st.lat, 0) / stations.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);

  // 先投影成东-北坐标，再翻 y 轴（屏幕上 y 向下）
  const raw = stations.map((st) => ({
    x: (st.lon - first.lon) * kx,
    y: -(st.lat - first.lat),
  }));

  /*
   * 缩放到取直后那条折线的范围内，两者才好叠着比。
   *
   * 必须**两轴都量，取较紧的那个**。只按横向跨度缩放的话，遇到南北长东西窄的
   * 线（曼哈顿就是）会把竖向拉爆：横向对齐了，竖向冲出格子好几倍，
   * 而画布尺寸是按三条折线的并集算的，于是整张纸被撑成细长条。
   */
  const ideal = idealPolyline(legs);
  const span = (pts: { x: number; y: number }[], axis: 'x' | 'y') =>
    Math.max(...pts.map((p) => p[axis])) - Math.min(...pts.map((p) => p[axis]));

  const fit = (axis: 'x' | 'y') => {
    const r = span(raw, axis);
    return r === 0 ? Infinity : span(ideal, axis) / r;
  };

  const scale = Math.min(fit('x'), fit('y'));
  if (!Number.isFinite(scale)) return raw;

  return raw.map((p) => ({ x: p.x * scale, y: p.y * scale }));
}

/** 正解的折线，用来在画完后叠上去对比。 */
export function idealPolyline(legs: Leg[]): { x: number; y: number }[] {
  const pts = [{ x: 0, y: 0 }];
  let x = 0;
  let y = 0;
  for (const leg of legs) {
    const s = STEP[leg.snap];
    x += s.dx;
    y += s.dy;
    pts.push({ x, y });
  }
  return pts;
}

/* ── 第二遍开始拆脚手架 ─────────────────────────── */

/**
 * 每一档拿掉什么。
 *
 * 0  真实走向的度数 + 地理实况淡影线   —— 第一遍：照着读数取整
 * 1  只有淡影线                        —— 自己看影线判断
 * 2  什么都没有，只剩站名              —— 凭记忆和这座城市的地理
 *
 * 拿掉的只有提示，正解始终是同一个（由坐标算出来的 snap），
 * 所以 check:drawing 不受影响，史实也没有被动过。
 *
 * 难度和「画哪条线」共用通关次数，但这一档封顶在 2，线却继续轮换 ——
 * 见 setOf()。
 */
export type Aid = {
  /** 显示「真实走向 122.3°，实际距离 1.2 公里」这一行。 */
  bearing: boolean;
  /** 纸上摊着地理实况那条淡影线。 */
  ghost: boolean;
};

export const aidFor = (tier: 0 | 1 | 2): Aid => ({
  bearing: tier === 0,
  ghost: tier < 2,
});

/**
 * 这一档在界面上怎么说。第一遍返回 null，免得把「还有更难的」变成噪音。
 *
 * 站数和最后那半句都从数据集来：每条线站数不同，而「靠什么画」这件事
 * 各条线的答案也不一样（blindHint）。
 */
export function tierNote(tier: 0 | 1 | 2, set: LineSet): string | null {
  switch (tier) {
    case 0:
      return null;
    case 1:
      return '第二遍：不给真实走向了。纸上那条淡影线就是地理实况，自己看着取直。';
    case 2:
      return `第三遍：影线也收走了。只剩${set.stations.length}个站名 —— ${set.blindHint}`;
  }
}

/**
 * 卡住了怎么办。
 *
 * 这一关本来就不会真卡死 —— 八个方向随便点都能往下走，画完自然看到对错。
 * 但「随便点」不是玩法，所以给一条明确的退路：当前这一段可以要提示，
 * 分两步，和售票窗口同一套节奏。
 *
 *   1 次  把这一段的真实走向读数还给你（即第一遍那行）
 *   2 次  直接说该往哪个方向
 *
 * 只作用于当前段，下一段重新计数：一段想不通，不该让整条线都降难度。
 */
export type HintLevel = 0 | 1 | 2;

export const hintLevelOf = (used: number): HintLevel =>
  used >= 2 ? 2 : used >= 1 ? 1 : 0;

/** 提示说什么。level 0 不显示。 */
export function hintText(leg: Leg, level: HintLevel): string | null {
  if (level === 0) return null;
  if (level === 1) {
    return `这一段真实走向 ${leg.bearing}°，实际距离 ${leg.km} 公里。八个方向里哪个最近？`;
  }
  return `最接近的是${DIR_NAME[leg.snap]}（${DIR_ANGLE[leg.snap]}°），偏 ${Math.abs(leg.offBy)}°。`;
}

/** 最短和最长段的倍数关系，揭示环节要用。 */
export const spread = (legs: Leg[]): { min: number; max: number; ratio: number } => {
  const ks = legs.map((l) => l.km);
  const min = Math.min(...ks);
  const max = Math.max(...ks);
  return { min, max, ratio: Math.round((max / min) * 10) / 10 };
};
