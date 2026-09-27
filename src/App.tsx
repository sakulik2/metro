import { useEffect, useReducer, useRef, useState } from 'react';
import { LINES, TOTAL_STOPS, gameAfter, lineTitle } from './data/lines';
import { panelHref } from './dev/testRoute';
import type { Stage } from './game/booking';
import type { Journey } from './state/journey';
import {
  answered,
  gameLabel,
  initialJourney,
  journeyReducer,
  lineScore,
  markAt,
  missedOn,
  nextLabel,
  pickAt,
  totalScore,
} from './state/journey';
import { BookingOffice } from './components/BookingOffice';
import { DrawingBoard } from './components/DrawingBoard';
import { LineMap } from './components/LineMap';
import { NetworkMap } from './components/NetworkMap';
import { PlatformEdge } from './components/PlatformEdge';
import { Station } from './components/Station';
import { StopList } from './components/StopList';
import { Transfer } from './components/Transfer';
import './App.css';

/** start / gameStage / gameSet 只有测试跳关会传，见 src/dev/testRoute.ts。 */
export function App({
  start,
  gameStage,
  gameSet,
  backToTest,
}: {
  start?: Journey;
  gameStage?: Stage;
  gameSet?: number;
  /** 从 /test 跳进小游戏时为 true：退出按钮回测试面板而不是继续流程。 */
  backToTest?: boolean;
} = {}) {
  const [journey, dispatch] = useReducer(journeyReducer, start ?? initialJourney);
  const [showList, setShowList] = useState(false);
  /*
   * 当前这一关玩完了没有。由游戏自己报上来（onDone），只用来决定站台边缘带
   * 那个按钮的文案 —— 不进 journey，那里不该多一个真相来源。
   */
  const [gameDone, setGameDone] = useState(false);

  const { line, stop, phase, tick } = journey;
  const currentLine = LINES[line];
  const question = currentLine?.questions[stop];
  const pick = pickAt(journey, line, stop);

  // 整页主色随当前线路切换。
  useEffect(() => {
    if (currentLine) {
      document.documentElement.style.setProperty('--line', currentLine.color);
    }
  }, [currentLine]);

  // 换站后把焦点送到该去的地方：答题时第一个选项，报分时标题。
  const carRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (showList) return;
    const car = carRef.current;
    if (!car) return;
    if (phase === 'game') return; // 票房自己管焦点
    if (phase === 'ride') car.querySelector<HTMLButtonElement>('.pick')?.focus();
    else car.querySelector<HTMLElement>('#result')?.focus();
  }, [tick, phase, showList]);

  if (!currentLine || !question) return null;

  const stopsOnLine = currentLine.questions.length;

  return (
    <>
      <header className="sign">
        <div className="col sign-row">
          <span className="badge" aria-hidden="true">
            {currentLine.id}
          </span>
          <h1 className="sign-name">地铁小测</h1>
          <button
            type="button"
            className="sign-toggle"
            aria-expanded={showList}
            onClick={() => setShowList((v) => !v)}
          >
            {showList ? '回到测验' : '站点一览'}
          </button>
        </div>
      </header>

      {!showList && phase !== 'end' && (
        <LineMap
          line={currentLine}
          title={lineTitle(line)}
          current={phase === 'ride' ? stop : null}
          markOf={(s) => markAt(journey, line, s)}
        />
      )}

      <main className="stage">
        <div className="col">
          {showList ? (
            <StopList pickAt={(l, s) => pickAt(journey, l, s)} />
          ) : (
            <div className="car" key={tick} ref={carRef}>
              {phase === 'ride' && (
                <Station
                  line={line}
                  stop={stop}
                  question={question}
                  stopsOnLine={stopsOnLine}
                  totalStops={TOTAL_STOPS}
                  pick={pick}
                  onChoose={(option) => dispatch({ type: 'choose', option })}
                />
              )}

              {phase === 'game' && gameAfter(line) === 'booking' && (
                <BookingOffice stage={gameStage} onDone={setGameDone} />
              )}
              {phase === 'game' && gameAfter(line) === 'drawing' && (
                <DrawingBoard set={gameSet} onDone={setGameDone} />
              )}

              {phase === 'transfer' && (
                <Transfer
                  line={line}
                  score={lineScore(journey, line)}
                  stopsOnLine={stopsOnLine}
                  missed={missedOn(journey, line)}
                />
              )}

              {phase === 'end' && (
                <NetworkMap
                  total={totalScore(journey)}
                  scoreOf={(l) => lineScore(journey, l)}
                  markOf={(l, s) => markAt(journey, l, s)}
                  onRestart={() => dispatch({ type: 'restart' })}
                />
              )}
            </div>
          )}
        </div>
      </main>

      {!showList && phase !== 'end' && (
        <PlatformEdge
          hint={phase === 'ride' && !answered(journey) ? question.hint : null}
          /*
           * 从 /test 直接跳进某个小游戏的，退出回测试面板 —— 跳关的人想回的是
           * 那张索引卡，不是接着走完整条线。
           *
           * 只作用于小游戏那一屏：跳到某一站（#/test/3-02）之后还要能正常往下
           * 走，否则跳关就没法用来试流程了。
           */
          nextLabel={
            phase === 'game'
              ? backToTest
                ? '回到测试入口'
                : gameLabel(journey, gameDone)
              : nextLabel(journey)
          }
          nextDisabled={phase === 'ride' && !answered(journey)}
          onNext={() => {
            if (phase === 'game' && backToTest) {
              window.location.href = panelHref();
              return;
            }
            dispatch({ type: 'advance' });
          }}
        />
      )}
    </>
  );
}
