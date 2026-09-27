import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { TestPanel } from './dev/TestPanel';
import { journeyFor, readRoute } from './dev/testRoute';
import './styles/tokens.css';

const host = document.getElementById('root');
if (!host) throw new Error('缺少 #root 挂载点');

const root = createRoot(host);

/**
 * /test 开头的地址交给跳关入口，其余走正常流程。
 * 哈希变了就重新渲染，所以面板上的链接点了立刻生效，不必刷新。
 */
function render() {
  const route = readRoute();

  const view =
    route.mode === 'panel' ? (
      <TestPanel />
    ) : route.mode === 'unknown' ? (
      <TestPanel unknown={route.raw} />
    ) : route.mode === 'jump' ? (
      <App
        start={journeyFor(route.target)}
        gameStage={route.target.kind === 'game' ? route.target.stage : undefined}
        gameSet={route.target.kind === 'game' ? route.target.set : undefined}
        /* 只有直接跳进小游戏的才回测试面板；跳到某一站的还要能正常往下走 */
        backToTest={route.target.kind === 'game'}
      />
    ) : (
      <App />
    );

  root.render(<StrictMode>{view}</StrictMode>);
}

window.addEventListener('hashchange', render);
render();
