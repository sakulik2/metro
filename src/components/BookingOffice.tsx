import { useReducer } from 'react';
import {
  DECIMAL_DAY,
  DRAWER,
  INTRO,
  ROUNDS,
  TITLE,
  YEAR,
  changeDue,
  fewestCount,
  isExact,
  newGame,
  play,
  trayGap,
  trayTotal,
  type Stage,
} from '../game/booking';
import { coinById, tally } from '../money/coins';
import { format, formatNewPence, slash, toStatutoryNewPence } from '../money/lsd';
import { CoinFace } from './CoinFace';
import './BookingOffice.css';

/**
 * 1863 年的售票窗口。乘客递钱，玩家从抽屉里拣零钱。
 * 最后跳到 1971 年 2 月 15 日：同一笔钱，四种都说得通的十进制答案。
 */
/** stage 只有测试跳关会传，见 src/dev/testRoute.ts。 */
export function BookingOffice({ stage }: { stage?: Stage } = {}) {
  const [game, move] = useReducer(play, stage, newGame);

  const round = ROUNDS[game.round];
  const due = changeDue(game);
  const inTray = trayTotal(game);
  const gap = trayGap(game);
  const exact = isExact(game);

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
              <div>
                <dt>该找</dt>
                <dd className="slip-due">{format(due)}</dd>
              </div>
            </dl>
          </div>

          {/* 找零托盘 */}
          <div className="tray" data-state={game.stage === 'settled' ? 'done' : exact ? 'exact' : 'open'}>
            <div className="tray-coins">
              {game.tray.length === 0 ? (
                <p className="tray-empty">从下面的钱屉里点硬币，凑够 {format(due)}。</p>
              ) : (
                tally(game.tray).map(({ coin, count }) => (
                  <CoinFace key={coin.id} coin={coin} count={count} />
                ))
              )}
            </div>

            <p className="tray-sum" aria-live="polite">
              {game.tray.length === 0
                ? '托盘是空的'
                : exact
                  ? `托盘里 ${format(inTray)}，正好`
                  : gap > 0
                    ? `托盘里 ${format(inTray)}，多了 ${format(gap)}`
                    : `托盘里 ${format(inTray)}，还差 ${format(-gap)}`}
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

              <div className="booking-acts">
                <button
                  type="button"
                  className="brass"
                  disabled={!exact}
                  onClick={() => move({ type: 'settle' })}
                >
                  交给乘客
                </button>
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

              <p className="decimal-check">
                这个库算出来：精确 {formatNewPence(DECIMAL_DAY.fare)}，法定{' '}
                {toStatutoryNewPence(DECIMAL_DAY.fare)}p。
              </p>

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
