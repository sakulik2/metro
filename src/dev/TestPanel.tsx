import { useState } from 'react';
import { GAMES, LINES } from '../data/lines';
import { LINE_SETS } from '../game/drawing';
import { forgetCleared, readCleared, setCleared } from '../state/cleared';
import { describe, exitHref, hrefFor, parseTarget } from './testRoute';
import './TestPanel.css';

/**
 * 跳关索引，走 /test。
 *
 * 材料跟着绘图室走：方格纸、铅笔描边、零圆角 —— 它是钉在绘图室墙上的一张
 * 索引卡，不是通用 debug 面板。
 */
/**
 * 游戏 id → URL 里的短名。写在这里而不是数据里：这是测试入口的词汇表，
 * 游戏本身不该知道自己在地址栏里叫什么。
 */
const GAME_SLUGS: Record<string, string> = { booking: 'ticket', drawing: 'drawing' };

/** 绘图室每条线的短名，下标对应 LINE_SETS。 */
const DRAWING_SLUGS = ['beck', 'irt'];

export function TestPanel({ unknown }: { unknown?: string }) {
  // 改完立刻重读，这样按钮上的当前档位是真的
  const [cleared, refresh] = useState(readCleared);

  const setTier = (game: string, n: number) => {
    setCleared(game, n);
    refresh(readCleared());
  };

  return (
    <div className="tp">
      <div className="tp-card">
        <p className="tp-year">测试入口</p>
        <h1 className="tp-title">跳到任意一站</h1>

        {unknown !== undefined && (
          <p className="tp-miss">
            <code>{unknown}</code> 不是有效的去处。下面这些可以。
          </p>
        )}

        <p className="tp-how">
          地址栏里写 <code>#/test/3-02</code>，就是 3 号线第 2 站。站号和界面上那块
          站号牌是同一套写法，看到什么码就能敲什么码。
        </p>

        {/* 游戏排在最前，它们是最常要跳的去处 */}
        <section className="tp-group">
          <h2 className="tp-group-name">游戏</h2>
          <ul className="tp-list">
            {Object.entries(GAMES).map(([line, id]) => {
              const slug = GAME_SLUGS[id] ?? id;
              return (
                <li key={id}>
                  <a href={hrefFor(slug)}>
                    <code>{slug}</code>
                    <span>{describe({ kind: 'game', line: Number(line) })}</span>
                  </a>
                </li>
              );
            })}
            {/* 售票窗口跨两个年代，1971 那两幕单列一行 */}
            <li>
              <a href={hrefFor('decimal')}>
                <code>decimal</code>
                <span>{describe({ kind: 'game', line: 0, stage: 'decimal' })}</span>
              </a>
            </li>
            {/* 绘图室每条线各给一个直达入口，免得为了看第二条线去改通关次数 */}
            {LINE_SETS.map((s, set) => {
              const slug = DRAWING_SLUGS[set] ?? String(set);
              return (
                <li key={s.title}>
                  <a href={hrefFor(slug)}>
                    <code>{slug}</code>
                    <span>
                      {s.title}（{s.year}）
                    </span>
                  </a>
                </li>
              );
            })}
            <li>
              <a href={hrefFor('end')}>
                <code>end</code>
                <span>终点，线网图</span>
              </a>
            </li>
          </ul>
        </section>

        {/*
          重玩难度。
          难度是靠通关次数攒出来的，所以测三个档位本来得真玩三遍；
          这里直接改那个数。对玩家也是退路：卡在第三档能退回去。
        */}
        <section className="tp-group">
          <h2 className="tp-group-name">重玩难度</h2>
          <p className="tp-how">
            游戏第二遍开始收走提示，同时换内容。这里改的是「通关过几次」那个数，存在
            localStorage 的 <code>metro:cleared</code> 里。绘图室的线也跟着这个数轮换（
            {LINE_SETS.map((s) => s.title).join(' → ')} → 循环），难度封顶在第三档。
          </p>
          <ul className="tp-tiers">
            {[
              { id: 'booking', name: '售票窗口', tiers: ['给全部提示', '不给该找多少', '还要求最少枚数'] },
              { id: 'drawing', name: '绘图室', tiers: ['给读数和影线', '只给影线', '只给站名'] },
            ].map((g) => {
              const now = cleared[g.id] ?? 0;
              return (
                <li key={g.id}>
                  <span className="tp-tier-name">{g.name}</span>
                  <span className="tp-tier-btns">
                    {g.tiers.map((label, n) => (
                      <button
                        key={n}
                        type="button"
                        className="tp-tier"
                        aria-pressed={Math.min(now, 2) === n}
                        onClick={() => setTier(g.id, n)}
                      >
                        第 {n + 1} 遍
                        <i>{label}</i>
                      </button>
                    ))}
                  </span>
                </li>
              );
            })}
          </ul>
          <p className="tp-also">
            通关次数：
            {Object.keys(cleared).length === 0
              ? '还没有记录'
              : Object.entries(cleared)
                  .map(([k, v]) => `${k} ${v} 次`)
                  .join('，')}
            {'　'}
            <button
              type="button"
              className="tp-forget"
              onClick={() => {
                forgetCleared();
                refresh(readCleared());
              }}
            >
              全部忘掉
            </button>
          </p>
        </section>

        {/* 四条线，每条列出全部站 */}
        {LINES.map((l, line) => (
          <section key={l.id} className="tp-group" style={{ '--line': l.color } as React.CSSProperties}>
            <h2 className="tp-group-name">
              <span className="tp-badge">{l.id}</span>
              {l.name}
            </h2>
            <ul className="tp-list">
              {l.questions.map((q, stop) => {
                const code = `${l.id}-${String(stop + 1).padStart(2, '0')}`;
                return (
                  <li key={q.station}>
                    <a href={hrefFor(code)}>
                      <code>{code}</code>
                      <span>{q.station}</span>
                    </a>
                  </li>
                );
              })}
              {line < LINES.length - 1 && (
                <li>
                  <a href={hrefFor(`${l.id}-x`)}>
                    <code>{l.id}-x</code>
                    <span>本线走完，换乘页</span>
                  </a>
                </li>
              )}
            </ul>
          </section>
        ))}

        <p className="tp-also">
          也认线路短名：<code>origins</code> <code>engineering</code>{' '}
          <code>drawings</code> <code>operations</code>，跳到那条线开头。
          单个数字 <code>{parseTarget('3') ? '3' : ''}</code> 是 3 号线第一站。
        </p>

        <p className="tp-back">
          <a href={exitHref()}>回到正常流程</a>
        </p>
      </div>
    </div>
  );
}
