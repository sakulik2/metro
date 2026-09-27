import { useReducer } from 'react';
import {
  COMPASS,
  DIR_NAME,
  INTRO,
  LEGS,
  REVEAL,
  RULE,
  STATIONS,
  TASK,
  TITLE,
  WHO,
  YEAR,
  allDrawn,
  draw,
  geoPolyline,
  idealPolyline,
  newBoard,
  polyline,
  rightCount,
  spread,
  verdictOf,
  type Dir,
} from '../game/drawing';
import './DrawingBoard.css';

/** 网格一格多少像素，以及画布四周留白。 */
const CELL = 74;
const PAD = 52;

/**
 * 贝克的绘图板，1931 年。
 *
 * 大胆只花在一处：死板的方格纸上，那条洋红线随玩家一段段亮起。
 * 洋红 #9B0056 是大都会线的真实色号，不是挑来装饰的。
 */
export function DrawingBoard() {
  const [board, stroke] = useReducer(draw, undefined, newBoard);

  const done = allDrawn(board);
  const drawnPts = polyline(board);
  const idealPts = idealPolyline();
  const geoPts = geoPolyline();

  // 画布范围把三条折线都算进去：地理实况、正解、玩家画的
  const all = [...idealPts, ...drawnPts, ...geoPts];
  const minX = Math.min(...all.map((p) => p.x));
  const maxX = Math.max(...all.map((p) => p.x));
  const minY = Math.min(...all.map((p) => p.y));
  const maxY = Math.max(...all.map((p) => p.y));

  const w = (maxX - minX) * CELL + PAD * 2;
  const h = (maxY - minY) * CELL + PAD * 2;
  const px = (x: number) => (x - minX) * CELL + PAD;
  const py = (y: number) => (y - minY) * CELL + PAD;

  const leg = LEGS[board.at];
  const { min, max, ratio } = spread();

  return (
    <section className="board">
      <div className="board-head">
        <p className="board-year">{YEAR}</p>
        <h2 className="board-title">{TITLE}</h2>
        <p className="board-who">{WHO}</p>
      </div>

      <div className="board-body">
        {!board.revealed && (
          <>
            <p className="board-intro">{INTRO}</p>
            <p className="board-rule">{RULE}</p>
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
            aria-label={`线路图草稿，已画 ${board.at} 段，共 ${LEGS.length} 段`}
          >
            <defs>
              <pattern id="grid" width={CELL / 2} height={CELL / 2} patternUnits="userSpaceOnUse">
                <path
                  d={`M ${CELL / 2} 0 L 0 0 0 ${CELL / 2}`}
                  fill="none"
                  stroke="var(--grid)"
                  strokeWidth="1"
                />
              </pattern>
            </defs>
            <rect width={w} height={h} fill="url(#grid)" />

            {/* 地理实况：一开始就摊在纸上，贝克做的是把它取直，不是凭空画 */}
            {geoPts.length > 1 && (
              <polyline
                points={geoPts.map((p) => `${px(p.x)},${py(p.y)}`).join(' ')}
                fill="none"
                stroke="var(--ghost)"
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
              />
            )}

            {/* 地理实况上的站位，小空心点 */}
            {geoPts.map((p, i) => (
              <circle
                key={`geo-${STATIONS[i]?.name ?? i}`}
                cx={px(p.x)}
                cy={py(p.y)}
                r="4"
                fill="var(--paper)"
                stroke="var(--ghost)"
                strokeWidth="2"
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
                stroke="var(--met)"
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
              const st = STATIONS[i];
              if (!st) return null;
              const last = i === STATIONS.length - 1;
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
            <p className="draw-task">{TASK}</p>
            <p className="draw-leg">
              第 {board.at + 1} 段　{leg.from} → {leg.to}
            </p>
            <p className="draw-true">
              真实走向 {leg.bearing}°，实际距离 {leg.km} 公里
            </p>

            <div className="compass" role="group" aria-label="选一个方向">
              {COMPASS.map((dir, i) =>
                dir === null ? (
                  <span key={`c${i}`} className="compass-hub" aria-hidden="true" />
                ) : (
                  <button
                    key={dir}
                    type="button"
                    className="compass-key"
                    data-dir={dir}
                    onClick={() => stroke({ type: 'draw', dir: dir as Dir })}
                  >
                    <span className="compass-arm" aria-hidden="true" />
                    <span className="compass-name">{DIR_NAME[dir]}</span>
                  </button>
                ),
              )}
            </div>

            {board.at > 0 && (
              <button type="button" className="pencil" onClick={() => stroke({ type: 'undo' })}>
                擦掉上一段
              </button>
            )}
          </div>
        )}

        {/* 画完了，还没翻开代价 */}
        {done && !board.revealed && (
          <div className="draw-done" aria-live="polite">
            <p className="done-call">
              七个站连起来了。{rightCount(board)} 段取了最接近真实走向的方向，共 {LEGS.length} 段。
            </p>
            <ul className="legs">
              {LEGS.map((l, i) => {
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
            <h3 className="reveal-title">{REVEAL.title}</h3>

            {/* 段长条形图：图上等长，地面上不等 */}
            <ul className="bars">
              {LEGS.map((l) => (
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

            <p className="reveal-text">{REVEAL.spacing}</p>
            <p className="reveal-text">{REVEAL.distortion}</p>
            <p className="reveal-history">{REVEAL.history}</p>

            <button type="button" className="pencil" onClick={() => stroke({ type: 'restart' })}>
              重画一遍
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
