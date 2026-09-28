import { useEffect, useReducer, useRef, useState } from 'react';
import {
  COMPASS,
  DIR_ANGLE,
  DIR_NAME,
  SET_COUNT,
  aidFor,
  CELL,
  PAD,
  allDrawn,
  blendFrame,
  canvasOf,
  draw,
  fullFrame,
  geoPolyline,
  hintLevelOf,
  hintText,
  idealPolyline,
  lineOf,
  newBoard,
  openingFrame,
  polyline,
  rightCount,
  spread,
  tierNote,
  verdictOf,
  type Dir,
} from '../game/drawing';
import { markCleared, runFor, tierOf } from '../state/cleared';
import './DrawingBoard.css';

/** 画完第 1 段之后停多久再拉远：先让玩家看清自己画了什么，塌缩才有对照。 */
const HOLD_MS = 2000;
/** 拉远本身多长。 */
const ZOOM_MS = 900;

const reducedMotion = (): boolean => {
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

/** 先慢后快再慢，镜头推拉的常见曲线。 */
const ease = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

/**
 * 绘图室。画哪条线由通关次数决定，见 src/game/drawing.ts 的 setOf()。
 *
 * 大胆只花在一处：死板的方格纸上，那条线随玩家一段段亮起。
 * 线色由数据集给（--route），因为每条线有自己的色号 —— 伦敦那条是大都会线
 * 真实色号，不是挑来装饰的。
 */
/** 鼠标悬停时跟着走的浮标。方向名不再常驻九个格子里，读的时候才出现。 */
type Float = { dir: Dir; x: number; y: number };

/**
 * set 只有测试跳关会传，见 src/dev/testRoute.ts。
 * onDone 让站台边缘带知道玩完了没有，决定按钮说「先跳过」还是「本线走完」。
 */
export function DrawingBoard({
  set,
  onDone,
}: { set?: number; onDone?: (done: boolean) => void } = {}) {
  /*
   * 通关次数只在挂载时读一次，一局之内定死。
   *
   * 它同时决定两件事：画哪条线（内容），和拆掉多少提示（难度）。
   * 每次渲染都去读的话，本局通关把次数 +1，线会在玩家眼前换掉。
   */
  const [run] = useState(() => runFor('drawing'));
  const idx = set ?? run % SET_COUNT;

  const [board, stroke] = useReducer(draw, undefined, () => newBoard(idx));
  const [float, setFloat] = useState<Float | null>(null);
  const compassRef = useRef<HTMLDivElement>(null);

  const line = lineOf(board);
  const tier = tierOf(run);
  const aid = aidFor(tier);
  const note = tierNote(tier, line);

  /*
   * 全部段画完就算通关，记一次；同时告诉外面，好让站台边缘带换文案
   * （没画完是「先跳过」，画完是「本线走完」）。翻不翻开代价是玩家的事。
   */
  const counted = useRef(false);
  useEffect(() => {
    if (allDrawn(board) && !counted.current) {
      counted.current = true;
      markCleared('drawing');
    }
    onDone?.(allDrawn(board));
  }, [board, onDone]);

  /**
   * 浮标的落点算成相对罗盘，而不是相对视口。
   * position:fixed 会被任何带 transform 的祖先劫持成相对那个祖先 ——
   * .car 上的进站动画正是这样一个祖先，所以 fixed 那版偏了一整段。
   */
  const follow = (dir: Dir, clientX: number, clientY: number) => {
    const box = compassRef.current?.getBoundingClientRect();
    if (!box) return;
    setFloat({ dir, x: clientX - box.left, y: clientY - box.top });
  };

  const done = allDrawn(board);
  const drawnPts = polyline(board);
  const idealPts = idealPolyline(line.legs);
  const geoPts = geoPolyline(line.stations, line.legs);

  // 画布范围把三条折线都算进去：地理实况、正解、玩家画的
  const all = [...idealPts, ...drawnPts, ...geoPts];
  const { w, h } = canvasOf(all);

  /*
   * 取景：zoom 是 0（开局放大）到 1（全图）之间的进度。
   * 存进度而不是存取景本身，因为全图的范围会随玩家画出去的线变大。
   * 这条线不需要放大时（伦敦）opening 是 null，zoom 恒为 1。
   */
  const opening = openingFrame(line);
  const [zoom, setZoom] = useState(opening ? 0 : 1);
  const zoomRef = useRef(zoom);
  zoomRef.current = zoom;

  /*
   * 第 1 段没画之前放大；画完停一下再拉远。擦回第 0 段就再推回去，
   * 「重画一遍」也一样 —— 塌缩每画一遍都要重新看到一次。
   * 已经画到第 2 段还没拉远（停顿时连按两下），就不再等。
   */
  const openAt = opening ? board.at : 1;
  useEffect(() => {
    const target = openAt === 0 ? 0 : 1;
    const from = zoomRef.current;
    if (from === target) return;

    if (reducedMotion()) {
      const id = window.setTimeout(() => setZoom(target), target === 1 && openAt === 1 ? HOLD_MS : 0);
      return () => window.clearTimeout(id);
    }

    let raf = 0;
    let start = 0;
    const step = (now: number) => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / ZOOM_MS);
      setZoom(from + (target - from) * ease(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    const id = window.setTimeout(
      () => (raf = requestAnimationFrame(step)),
      target === 1 && openAt === 1 ? HOLD_MS : 0,
    );
    return () => {
      window.clearTimeout(id);
      cancelAnimationFrame(raf);
    };
  }, [openAt]);

  const full = fullFrame(all);
  const frame = opening ? blendFrame(opening, full, zoom) : full;

  // 取景中心落在画布中心。全图时和原来的固定画法逐像素相同。
  const px = (x: number) => w / 2 + (x - frame.cx) * frame.cell;
  const py = (y: number) => h / 2 + (y - frame.cy) * frame.cell;
  // 方格跟着内容一起缩放，锚在全图时的原点上
  const minX = Math.min(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const gridX = px(minX) - (PAD * frame.cell) / CELL;
  const gridY = py(minY) - (PAD * frame.cell) / CELL;

  const leg = line.legs[board.at];
  const { min, max, ratio } = spread(line.legs);
  const hint = leg ? hintText(leg, hintLevelOf(board.hintsUsed)) : null;

  return (
    <section
      className="board"
      /* 线色跟着数据集走。内联写在这里，和 TestPanel 给每条线上色同一个做法。 */
      style={
        { '--route': line.colour, '--route-hover': line.colourHover } as React.CSSProperties
      }
    >
      <div className="board-head">
        <p className="board-year">{line.year}</p>
        <h2 className="board-title">{line.title}</h2>
        <p className="board-who">{line.who}</p>
      </div>

      <div className="board-body">
        {!board.revealed && (
          <>
            <p className="board-intro">{line.intro}</p>
            <p className="board-rule">{line.rule}</p>
            {note && <p className="board-tier">{note}</p>}
          </>
        )}

        {/* 方格纸 */}
        <div className="sheet">
          <svg
            className="sheet-svg"
            viewBox={`0 0 ${w} ${h}`}
            width={w}
            height={h}
            role="img"
            aria-label={`线路图草稿，已画 ${board.at} 段，共 ${line.legs.length} 段`}
          >
            <defs>
              <pattern
                id="grid"
                x={gridX}
                y={gridY}
                width={frame.cell / 2}
                height={frame.cell / 2}
                patternUnits="userSpaceOnUse"
              >
                <path
                  d={`M ${frame.cell / 2} 0 L 0 0 0 ${frame.cell / 2}`}
                  fill="none"
                  stroke="var(--grid)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width={w} height={h} fill="url(#grid)" />

            {/* 地理实况：一开始就摊在纸上，贝克做的是把它取直，不是凭空画 */}
            {aid.ghost && geoPts.length > 1 && (
              <polyline
                points={geoPts.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
                fill="none"
                stroke="var(--ghost)"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/*
              地理实况上的站位，小空心点。

              点画得比正解上的小一圈，因为真实站距可以非常近：1904 年 IRT 的
              市政厅到布鲁克林桥只有 0.17 公里，在任何诚实的缩放下这两点都会挨上。
              那个挨上是真的（市政厅站 1945 年停用，原因之一正是离布鲁克林桥站
              太近），所以缩点不缩距 —— 改缩放会把这个事实抹掉。
            */}
            {aid.ghost && geoPts.map((p, i) => (
              <circle
                key={`geo-${line.stations[i]?.name ?? i}`}
                cx={px(p.x)}
                cy={py(p.y)}
                r="3"
                fill="var(--paper)"
                stroke="var(--ghost)"
                strokeWidth="1.5"
              />
            ))}

            {/* 画完之后叠上正解，供对比 */}
            {board.revealed && (
              <polyline
                points={idealPts.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
                fill="none"
                stroke="var(--ghost)"
                strokeWidth="10"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray="2 14"
              />
            )}

            {/* 玩家画的线：一段段亮起 */}
            {drawnPts.length > 1 && (
              <polyline
                className="ink"
                points={drawnPts.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
                fill="none"
                stroke="var(--route)"
                strokeWidth="9"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* 下一段的落点，虚线提示 */}
            {!done && drawnPts.length > 0 && (
              <circle
                cx={px(drawnPts[drawnPts.length - 1]?.x ?? 0)}
                cy={py(drawnPts[drawnPts.length - 1]?.y ?? 0)}
                r="15"
                fill="none"
                stroke="var(--graphite)"
                strokeWidth="2"
                strokeDasharray="3 4"
              />
            )}

            {/* 站点：画到哪里露到哪里 */}
            {drawnPts.map((p, i) => {
              const st = line.stations[i];
              if (!st) return null;
              const last = i === line.stations.length - 1;
              return (
                <g key={st.name}>
                  <circle
                    cx={px(p.x)}
                    cy={py(p.y)}
                    r={last || i === 0 ? 9 : 7}
                    fill="var(--paper)"
                    stroke="var(--graphite)"
                    strokeWidth={last || i === 0 ? 5 : 4}
                  />
                  <text
                    className="sheet-label"
                    x={px(p.x)}
                    y={py(p.y) - 20}
                    textAnchor="middle"
                  >
                    {st.name}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>

        {/* 还在画：罗盘 */}
        {!done && leg && (
          <div className="draw-now">
            <p className="draw-task">{line.task}</p>
            <p className="draw-leg">
              第 {board.at + 1} 段　{leg.from} → {leg.to}
            </p>
            {aid.bearing ? (
              <p className="draw-true">
                真实走向 {leg.bearing}°，实际距离 {leg.km} 公里
              </p>
            ) : hint ? (
              /* 要过提示：把读数还给他，或直接说方向 */
              <p className="draw-hint" aria-live="polite">
                {hint}
              </p>
            ) : (
              <p className="draw-blind">这一段的真实走向没有给你 —— 自己判断。</p>
            )}

            <div
              ref={compassRef}
              className="compass"
              role="group"
              aria-label="选一个方向"
              onPointerLeave={() => setFloat(null)}
            >
              {COMPASS.map((dir, i) =>
                dir === null ? (
                  <span key={`c${i}`} className="compass-hub" aria-hidden="true" />
                ) : (
                  <button
                    key={dir}
                    type="button"
                    className="compass-key"
                    data-dir={dir}
                    aria-label={`${DIR_NAME[dir]}，${DIR_ANGLE[dir]} 度`}
                    onClick={() => stroke({ type: 'draw', dir })}
                    onPointerMove={(e) => follow(dir, e.clientX, e.clientY)}
                    onFocus={(e) => {
                      // 键盘走到这里也要出浮标，落点取格子右上角
                      const r = e.currentTarget.getBoundingClientRect();
                      follow(dir, r.right - 8, r.top + 8);
                    }}
                    onBlur={() => setFloat(null)}
                  >
                    <span className="compass-arm" aria-hidden="true" />
                  </button>
                ),
              )}

              {/*
                浮标必须在罗盘里面：它是相对罗盘定位的，放到外面就会去找别的
                祖先当原点，从而飘到页面另一头。
              */}
              {float && (
                <span
                  className="float"
                  style={{ left: float.x, top: float.y }}
                  aria-hidden="true"
                >
                  <b>{DIR_NAME[float.dir]}</b>
                  <i>{DIR_ANGLE[float.dir]}°</i>
                </span>
              )}
            </div>

            <div className="draw-acts">
              {board.at > 0 && (
                <button type="button" className="pencil" onClick={() => stroke({ type: 'undo' })}>
                  擦掉上一段
                </button>
              )}

              {/*
                卡住了的退路，只在拆了读数之后才有：
                第一遍那行读数一直摊着，再给提示按钮是多余的。
              */}
              {!aid.bearing && board.hintsUsed < 2 && (
                <button type="button" className="pencil" onClick={() => stroke({ type: 'hint' })}>
                  {board.hintsUsed === 0 ? '看不出来' : '直接告诉我'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 画完了，还没翻开代价 */}
        {done && !board.revealed && (
          <div className="draw-done" aria-live="polite">
            <p className="done-call">
              {line.stations.length} 个站连起来了。{rightCount(board)} 段取了最接近真实走向的方向，共{' '}
              {line.legs.length} 段。
            </p>
            <ul className="legs">
              {line.legs.map((l, i) => {
                const v = verdictOf(board, i);
                const picked = board.drawn[i];
                return (
                  <li key={`${l.from}-${l.to}`} data-verdict={v ?? undefined}>
                    <b>
                      {l.from} → {l.to}
                    </b>
                    <span>
                      {picked ? DIR_NAME[picked] : '—'}
                      {v === 'off' && `，最接近的是${DIR_NAME[l.snap]}`}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="board-acts">
              <button type="button" className="ink-btn" onClick={() => stroke({ type: 'reveal' })}>
                看看代价
              </button>
              <button type="button" className="pencil" onClick={() => stroke({ type: 'restart' })}>
                重画一遍
              </button>
            </div>
          </div>
        )}

        {/* 揭示：图好用，但代价是距离全没了 */}
        {board.revealed && (
          <div className="reveal" aria-live="polite">
            <h3 className="reveal-title">{line.reveal.title}</h3>

            {/* 段长条形图：图上等长，地面上不等 */}
            <ul className="bars">
              {line.legs.map((l) => (
                <li key={`${l.from}-${l.to}`} className="bar-row">
                  <span className="bar-name">
                    {l.from} → {l.to}
                  </span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ width: `${(l.km / max) * 100}%` }} />
                  </span>
                  <span className="bar-km">{l.km} km</span>
                </li>
              ))}
            </ul>
            <p className="bars-note">
              图上每段一格，地面上 {min} 到 {max} 公里，差 {ratio} 倍。
            </p>

            <p className="reveal-text">{line.reveal.spacing}</p>
            <p className="reveal-text">{line.reveal.distortion}</p>
            <p className="reveal-history">{line.reveal.history}</p>

            <button type="button" className="pencil" onClick={() => stroke({ type: 'restart' })}>
              重画一遍
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
