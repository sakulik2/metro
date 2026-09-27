import type { Line } from '../data/types';
import type { Mark } from '../state/journey';
import './LineMap.css';

type Props = {
  line: Line;
  title: string;
  /** 当前停在第几站。已走完整条线时传 null。 */
  current: number | null;
  markOf: (stop: number) => Mark;
};

/**
 * 车厢门上方的那张线路图。
 * 一条线 N 个站，一场测验 N 道题——进度就是乘车位置，不需要另做进度条。
 * 只画当前这条线，和真实车厢里的贴图一样。
 */
export function LineMap({ line, title, current, markOf }: Props) {
  const stops = line.questions.length;
  const done = current === null;
  const filled = done ? 1 : stops > 1 ? current / (stops - 1) : 1;

  return (
    <nav className="map" aria-label="线路图">
      <div className="col">
        <p className="map-tag">{title}</p>
        <div className="map-frame">
          <div
            className="map-inner"
            style={{ '--n': stops, '--filled': filled } as React.CSSProperties}
          >
            <div className="map-rail" />
            <div className="map-done" />
            <ol className="map-stops">
              {line.questions.map((q, stop) => {
                const mark = markOf(stop);
                return (
                  <li
                    key={q.station}
                    className="map-stop"
                    data-mark={mark}
                    aria-current={!done && stop === current ? 'step' : undefined}
                  >
                    <span className="map-node" />
                    <span className="map-label">{q.station}</span>
                  </li>
                );
              })}
            </ol>
          </div>
          <span className="map-arrow" data-end={done} aria-hidden="true" />
        </div>
      </div>
    </nav>
  );
}
