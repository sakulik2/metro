import { useEffect, useReducer, useRef, useState } from 'react';
import {
  DECIMAL_DAY,
  DRAWER,
  INTRO,
  ROUNDS,
  TIER_NOTE,
  TITLE,
  YEAR,
  aidFor,
  canSettle,
  changeDue,
  fewestCount,
  hintLevelOf,
  hintText,
  isExact,
  newGame,
  play,
  rejectionOf,
  roundOf,
  trayGap,
  trayTotal,
  type Stage,
} from '../game/booking';
import { coinById, tally } from '../money/coins';
import { format, slash } from '../money/lsd';
import { markCleared, runFor, tierOf } from '../state/cleared';
import { CoinFace } from './CoinFace';
import './BookingOffice.css';

/**
 * 1863 年的售票窗口。乘客递钱，玩家从抽屉里拣零钱。
 * 最后跳到 1971 年 2 月 15 日：同一笔钱，四种都说得通的十进制答案。
 */
/**
 * stage 只有测试跳关会传，见 src/dev/testRoute.ts。
 * onDone 让站台边缘带知道玩完了没有，决定按钮说「先跳过」还是「本线走完」。
 */
export function BookingOffice({
  stage,
  onDone,
}: { stage?: Stage; onDone?: (done: boolean) => void } = {}) {
  /*
   * 通关次数只在挂载时读一次，一局之内定死。
   *
   * 它同时决定两件事：用哪一套乘客（内容），和拆掉多少提示（难度）。
   * 每次渲染都去读的话，本局通关把次数 +1，乘客会在玩家眼前换人。
   */
  const [run] = useState(() => runFor('booking'));
  const [game, move] = useReducer(play, undefined, () => newGame(stage, run));

  const tier = tierOf(run);
  const aid = aidFor(tier);
  const note = TIER_NOTE[tier];

  // 这一遍这一位乘客用哪一套：买几张、递什么钱，都在这里换
  const round = roundOf(game);
  const due = changeDue(game);
  const inTray = trayTotal(game);
  const gap = trayGap(game);
  const exact = isExact(game);
  const settleable = canSettle(game, aid);
  const hint = hintText(game, aid, hintLevelOf(game.hintsUsed));
  const rejection = rejectionOf(game, aid);

  /*
   * 走到 1971 那一幕就算把 1863 这五位乘客做完了，记一次。
   *
   * 从 /test/decimal 直接进来的不算：那是跳关，没数过一枚硬币，
   * 记上去会让难度凭空涨一档。
   */
  const counted = useRef(stage === 'decimal' || stage === 'closed');
  useEffect(() => {
    if ((game.stage === 'decimal' || game.stage === 'closed') && !counted.current) {
      counted.current = true;
      markCleared('booking');
    }
    // 走到 1971 那一幕就算这一关玩完了
    onDone?.(game.stage === 'decimal' || game.stage === 'closed');
  }, [game.stage, onDone]);

  if (!round) return null;

  // 1971 那两幕换一整套配色，见 BookingOffice.css 里的 data-era。
  const era = game.stage === 'decimal' || game.stage === 'closed' ? '1971' : '1863';

  return (
    <section className="booking" data-era={era}>
      <div className="booking-head">
        {era === '1971' ? (
          <BrBand />
        ) : (
          <>
            <p className="booking-year">{YEAR}</p>
            <h2 className="booking-title">{TITLE}</h2>
          </>
        )}
      </div>

      {game.stage === 'brief' && (
        <div className="booking-body">
          <p className="booking-intro">{INTRO}</p>
          {note && <p className="booking-tier">{note}</p>}
          <button type="button" className="brass" onClick={() => move({ type: 'begin' })}>
            打开窗口
          </button>
        </div>
      )}

      {(game.stage === 'counting' || game.stage === 'settled') && (
        <div className="booking-body">
          {/* 乘客说的话 */}
          <div className="fare-slip">
            <p className="slip-who">{round.who}</p>
            <p className="slip-asks">「{round.asks}」</p>
            <dl className="slip-sums">
              <div>
                <dt>票价</dt>
                <dd>{round.fareNote}</dd>
              </div>
              <div>
                <dt>他给的</dt>
                <dd className="slip-paid">
                  {round.paid.map((id, i) => {
                    const c = coinById(id);
                    return c ? <CoinFace key={`${id}-${i}`} coin={c} /> : null;
                  })}
                  <span>{format(trayTotalOf(round.paid))}</span>
                </dd>
              </div>
              {/* 第二遍起这一行留着位置但不给数：减法交给玩家 */}
              <div>
                <dt>该找</dt>
                <dd className={aid.due ? 'slip-due' : 'slip-due slip-blind'}>
                  {aid.due ? format(due) : '自己算'}
                </dd>
              </div>
            </dl>
          </div>

          {/*
            找零托盘。
            data-state 在第二遍起只在交割之后才转「正好」—— 否则托盘边框一变色
            就等于替玩家宣布算对了，那道减法白拆。
          */}
          <div
            className="tray"
            data-state={
              game.stage === 'settled' ? 'done' : aid.gap && exact ? 'exact' : 'open'
            }
          >
            <div className="tray-coins">
              {game.tray.length === 0 ? (
                <p className="tray-empty">
                  {aid.due
                    ? `从下面的钱屉里点硬币，凑够 ${format(due)}。`
                    : '从下面的钱屉里点硬币，凑出该找的数。'}
                </p>
              ) : (
                tally(game.tray).map(({ coin, count }) => (
                  <CoinFace key={coin.id} coin={coin} count={count} />
                ))
              )}
            </div>

            <p className="tray-sum" aria-live="polite">
              {game.tray.length === 0
                ? '托盘是空的'
                : aid.gap
                  ? exact
                    ? `托盘里 ${format(inTray)}，正好`
                    : gap > 0
                      ? `托盘里 ${format(inTray)}，多了 ${format(gap)}`
                      : `托盘里 ${format(inTray)}，还差 ${format(-gap)}`
                  : /* 只报托盘里有多少，不说离目标差多少 */
                    `托盘里 ${format(inTray)}`}
            </p>
          </div>

          {game.stage === 'counting' && (
            <>
              {/* 钱屉，按面值从小到大，和真实钱屉一样 */}
              <div className="drawer">
                {DRAWER.map((coin) => (
                  <div key={coin.id} className="drawer-slot">
                    {/* 固定高度的壳，让大小不一的硬币落在同一条搁板线上 */}
                    <span className="drawer-rest">
                      <CoinFace coin={coin} onClick={() => move({ type: 'put', coin: coin.id })} />
                    </span>
                    <span className="drawer-name">{coin.name}</span>
                    <span className="drawer-mm">{coin.diameter}mm</span>
                  </div>
                ))}
              </div>

              {/*
                乘客退回来那句话，优先于提示 —— 它是刚发生的事。
                提示只在拆了脚手架之后才有：第一遍托盘一直在报差额，
                再加个提示按钮是多余的。
              */}
              {game.rejected && rejection && (
                <p className="booking-reject" aria-live="polite">
                  {rejection}
                </p>
              )}
              {!aid.gap && !game.rejected && hint && (
                <p className="booking-hint" aria-live="polite">
                  {hint}
                </p>
              )}

              <div className="booking-acts">
                {/*
                  第二遍起不按金额禁用：按钮一亮就等于替玩家宣布算对了，
                  和实时报差是同一种泄露。照交，由乘客数完退回来。
                */}
                <button
                  type="button"
                  className="brass"
                  disabled={aid.gap ? !settleable : game.tray.length === 0}
                  onClick={() => move({ type: 'settle', aid })}
                >
                  交给乘客
                </button>

                {/* 卡住了的退路。两次到顶，按完就消失。 */}
                {!aid.gap && game.hintsUsed < 2 && (
                  <button type="button" className="plain" onClick={() => move({ type: 'hint' })}>
                    {game.hintsUsed === 0 ? '算不出来' : '再说明白点'}
                  </button>
                )}

                <button
                  type="button"
                  className="plain"
                  disabled={game.tray.length === 0}
                  onClick={() => move({ type: 'take' })}
                >
                  收回一枚
                </button>
                <button
                  type="button"
                  className="plain"
                  disabled={game.tray.length === 0}
                  onClick={() => move({ type: 'clear' })}
                >
                  全部收回
                </button>
              </div>
            </>
          )}

          {game.stage === 'settled' && (
            <div className="settled" aria-live="polite">
              <p className="settled-call">
                找对了 —— {format(due)}
                {game.tray.length === fewestCount(game)
                  ? `，${game.tray.length} 枚，最少枚数`
                  : `，用了 ${game.tray.length} 枚，最少 ${fewestCount(game)} 枚`}
              </p>
              <p className="settled-teach">{round.teach}</p>
              <button type="button" className="brass" onClick={() => move({ type: 'nextPassenger' })}>
                {game.round === ROUNDS.length - 1 ? '下一位……等等，1971 年了' : '下一位乘客'}
              </button>
            </div>
          )}
        </div>
      )}

      {(game.stage === 'decimal' || game.stage === 'closed') && (
        <div className="booking-body decimal">
          <p className="decimal-year">{DECIMAL_DAY.title}</p>
          <p className="booking-intro">{DECIMAL_DAY.intro}</p>

          <div className="decimal-fare">
            <span className="decimal-old">{slash(DECIMAL_DAY.fare)}</span>
            <span className="decimal-eq">记成</span>
            <span className="decimal-new">？</span>
          </div>

          <div className="decimal-picks" role="group" aria-label="半克朗该记多少新便士">
            {DECIMAL_DAY.choices.map((c) => {
              const picked = game.decimalPick === c.id;
              const answered = game.decimalPick !== null;
              const right = c.id === DECIMAL_DAY.answer;
              return (
                <button
                  key={c.id}
                  type="button"
                  className="decimal-pick"
                  data-verdict={answered ? (right ? 'right' : picked ? 'wrong' : 'other') : undefined}
                  aria-disabled={answered || undefined}
                  onClick={answered ? undefined : () => move({ type: 'pickDecimal', choice: c.id })}
                >
                  <span className="pick-amount">{c.label}</span>
                  <span className="pick-sub">{c.sub}</span>
                </button>
              );
            })}
          </div>

          {game.decimalPick !== null && (
            <div className="decimal-why" aria-live="polite">
              {DECIMAL_DAY.choices.map((c) => (
                <p key={c.id} data-verdict={c.id === DECIMAL_DAY.answer ? 'right' : undefined}>
                  <b>
                    {c.label} · {c.sub}
                  </b>
                  {c.why}
                </p>
              ))}

              <p className="decimal-closing">{DECIMAL_DAY.closing}</p>

              <button type="button" className="plain" onClick={() => move({ type: 'restart' })}>
                重开窗口
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/**
 * 1971 年的抬头：一条珠灰车身窗带，双箭头 + 站名压在上面。
 *
 * 站名到这一年已经不是 Farringdon Street 了 —— 1922 年随新站房改叫
 * Farringdon & High Holborn，1936 年定为 Farringdon。同一个窗口，第三个名字。
 */
function BrBand() {
  return (
    <div className="br-band">
      <svg
        className="br-arrow"
        viewBox="0 0 64 28"
        fill="none"
        stroke="currentColor"
        strokeWidth="4.6"
        strokeLinecap="butt"
        strokeLinejoin="miter"
        role="img"
        aria-label="British Rail"
      >
        {/*
          1965 年那个双箭头的几何近似。
          要紧的是两道斜线平行 —— 平行才读成双向的轨，交叉就成了别的记号。
          下面那支是上面那支绕画布中心 (32,14) 转 180° 得来的，所以必然平行。
          箭头做到斜线三倍粗：再窄就和杆糊成一根，读不出是箭。
        */}
        {/* 上行：自左下斜上，转平，向右出头 */}
        <path d="M6 23.5 L20 9.5 H45" />
        <path d="M44 2.5 L62 9.5 L44 16.5 Z" fill="currentColor" stroke="none" />
        {/* 下行：上面那支转 180° */}
        <path d="M58 4.5 L44 18.5 H19" />
        <path d="M20 11.5 L2 18.5 L20 25.5 Z" fill="currentColor" stroke="none" />
      </svg>
      <div className="br-where">
        <p className="br-station">{DECIMAL_DAY.station}</p>
        <p className="br-renamed">{DECIMAL_DAY.renamed}</p>
      </div>
    </div>
  );
}

/** 乘客递过来那把钱一共多少 —— 只为显示，逻辑在 booking.ts 里。 */
function trayTotalOf(ids: string[]): number {
  return ids.reduce((n, id) => n + (coinById(id)?.value ?? 0), 0);
}
