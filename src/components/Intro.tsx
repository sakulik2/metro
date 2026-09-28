import { GAMES, LINES, TOTAL_STOPS } from '../data/lines';
import './Intro.css';

/** 游戏 id → 站内叫法，和 nextLabel() 里「去售票窗口」「去绘图室」同一套词。 */
const GAME_NAMES: Record<string, string> = {
  booking: '售票窗口',
  drawing: '绘图室',
};

/**
 * 开场入口：上车之前说清这是什么、有几条线、哪几条线后面挂着小游戏。
 *
 * 线路、站数、游戏全部从数据读，不写死 —— 加一条线或挂一个游戏，这里跟着变。
 * 只在头一回来时出现，见 src/state/boarded.ts。
 */
export function Intro() {
  const games = Object.keys(GAMES).length;

  return (
    <>
      <h2 className="intro-title" id="result" tabIndex={-1}>
        伦敦地铁，{LINES.length} 条线 {TOTAL_STOPS} 站
      </h2>
      <p className="intro-sub">
        每一站是一道选择题，答完看解释，再往下一站。
        {games > 0 && <>其中 {games} 条线走完有个小游戏，不想玩随时可以跳过。</>}
      </p>

      <ul className="intro-lines">
        {LINES.map((l, line) => {
          const game = GAMES[line];
          return (
            <li key={l.id} style={{ '--line': l.color } as React.CSSProperties}>
              <span className="badge badge-sm">{l.id}</span>
              <span className="intro-name">{l.name}</span>
              <span className="intro-count">{l.questions.length} 站</span>
              {game && <span className="intro-game">＋ {GAME_NAMES[game] ?? game}</span>}
            </li>
          );
        })}
      </ul>

      <p className="intro-note">下次再来会直接从第一站开始。</p>
    </>
  );
}
