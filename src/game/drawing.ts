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

const src = raw as Record<string, unknown>;

function str(key: string): string {
  const v = src[key];
  if (typeof v !== 'string' || !v) throw new Error(`绘图板数据缺 ${key}`);
  return v;
}

export const STATION_LABEL = str('station');
export const TITLE = str('title');
export const YEAR = Number(src.year);
export const WHO = str('who');
export const INTRO = str('intro');
export const TASK = str('task');
export const RULE = str('rule');

export const STATIONS = src.stations as Station[];

export const LEGS = (src.legs as Leg[]).map((l, i) => {
  if (!DIRS.includes(l.snap)) throw new Error(`第 ${i + 1} 段的 snap 不是合法方向：${l.snap}`);
  return l;
});

export const REVEAL = src.reveal as {
  title: string;
  spacing: string;
  distortion: string;
  history: string;
};

/* ── 玩一局 ─────────────────────────────────────── */

export type Board = {
  /** 每段选了什么方向，null 表示还没画。 */
  drawn: (Dir | null)[];
  /** 当前在画第几段。全部画完等于 LEGS.length。 */
  at: number;
  /** 画完之后才翻开代价那一页。 */
  revealed: boolean;
  /**
   * 当前这一段按过几次提示。画下一段就归零 ——
   * 一段想不通不该让整条线都降难度。
   */
  hintsUsed: number;
};

export const newBoard = (): Board => ({
  drawn: LEGS.map(() => null),
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
  switch (stroke.type) {
    /* 画下一段，提示次数归零 */
    case 'draw': {
      if (board.at >= LEGS.length) return board;
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
      return board.at < LEGS.length && board.hintsUsed < 2
        ? { ...board, hintsUsed: board.hintsUsed + 1 }
        : board;

    case 'reveal':
      return board.at >= LEGS.length ? { ...board, revealed: true } : board;

    case 'restart':
      return newBoard();
  }
}

/** 某一段画对了没有。没画过返回 null。 */
export const verdictOf = (board: Board, leg: number): 'right' | 'off' | null => {
  const picked = board.drawn[leg];
  if (!picked) return null;
  return picked === LEGS[leg]?.snap ? 'right' : 'off';
};

export const allDrawn = (board: Board): boolean => board.at >= LEGS.length;

export const rightCount = (board: Board): number =>
  LEGS.reduce((n, _, i) => n + (verdictOf(board, i) === 'right' ? 1 : 0), 0);

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
 * 从一开始就画在纸上：贝克手里本来就摊着地理图，他做的是把它取直，不是凭空画线。
 * 这条淡影线同时也让空白的方格纸在第一眼就有内容。
 */
export function geoPolyline(): { x: number; y: number }[] {
  const first = STATIONS[0];
  if (!first) return [];

  const lat0 = STATIONS.reduce((s, st) => s + st.lat, 0) / STATIONS.length;
  const kx = Math.cos((lat0 * Math.PI) / 180);

  // 先投影成东-北坐标，再翻 y 轴（屏幕上 y 向下）
  const raw = STATIONS.map((st) => ({
    x: (st.lon - first.lon) * kx,
    y: -(st.lat - first.lat),
  }));

  // 缩放到和取直后的折线同样的横向跨度，两者才好叠着比
  const ideal = idealPolyline();
  const idealSpan = Math.max(...ideal.map((p) => p.x)) - Math.min(...ideal.map((p) => p.x));
  const rawSpan = Math.max(...raw.map((p) => p.x)) - Math.min(...raw.map((p) => p.x));
  const scale = rawSpan === 0 ? 1 : idealSpan / rawSpan;

  return raw.map((p) => ({ x: p.x * scale, y: p.y * scale }));
}

/** 正解的折线，用来在画完后叠上去对比。 */
export function idealPolyline(): { x: number; y: number }[] {
  const pts = [{ x: 0, y: 0 }];
  let x = 0;
  let y = 0;
  for (const leg of LEGS) {
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
 * 2  什么都没有，只剩站名              —— 凭记忆和伦敦地理
 *
 * 拿掉的只有提示，正解始终是同一个（由坐标算出来的 snap），
 * 所以 check:drawing 不受影响，史实也没有被动过。
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

/** 这一档在界面上怎么说。第一遍不提，免得把「还有更难的」变成噪音。 */
export const TIER_NOTE: Record<0 | 1 | 2, string | null> = {
  0: null,
  1: '第二遍：不给真实走向了。纸上那条淡影线就是地理实况，自己看着取直。',
  2: '第三遍：影线也收走了。只剩七个站名 —— 贝克画图时靠的也不是随手可查的坐标。',
};

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
export const spread = (): { min: number; max: number; ratio: number } => {
  const ks = LEGS.map((l) => l.km);
  const min = Math.min(...ks);
  const max = Math.max(...ks);
  return { min, max, ratio: Math.round((max / min) * 10) / 10 };
};
