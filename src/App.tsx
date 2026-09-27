import { useEffect, useReducer, useRef, useState } from 'react';
import { LINES, TOTAL_STOPS, gameAfter, lineTitle } from './data/lines';
import {
  answered,
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

export function App() {
  const [journey, dispatch] = useReducer(journeyReducer, initialJourney);
  const [showList, setShowList] = useState(false);

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

              {phase === 'game' && gameAfter(line) === 'booking' && <BookingOffice />}
              {phase === 'game' && gameAfter(line) === 'drawing' && <DrawingBoard />}

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
          nextLabel={phase === 'game' ? '回到线路' : nextLabel(journey)}
          nextDisabled={phase === 'ride' && !answered(journey)}
          onNext={() => dispatch({ type: 'advance' })}
        />
      )}
    </>
  );
}
