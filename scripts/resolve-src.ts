/**
 * 让校验脚本能 import 应用代码。
 *
 * src/ 里的相对 import 不写扩展名（`from '../money/coins'`）—— 这是 Vite 的
 * 解析规则，tsconfig 里 moduleResolution 设成 bundler 就是这个意思。Node 不认，
 * 所以直接 import 会 ERR_MODULE_NOT_FOUND。
 *
 * 这个钩子只补一件事：解析不到的相对路径，试着加 .ts / .tsx / index.ts。
 * 影响范围仅限加载了它的那个脚本进程，不改应用代码，也不改 tsconfig ——
 * 44 处 import 全部补上扩展名只为让脚本能跑，是让工具去支配源码。
 *
 * 用法：脚本开头 `import './resolve-src.ts';`，要在 import 应用代码之前。
 */

import { registerHooks } from 'node:module';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const TRIES = ['.ts', '.tsx', '/index.ts', '/index.tsx'];

registerHooks({
  resolve(specifier, context, next) {
    /*
     * JSON 也要补：Node 要求 `with { type: 'json' }`，Vite 靠 resolveJsonModule
     * 不要求，所以 `import raw from './rounds.json'` 在 Node 下会报
     * ERR_IMPORT_ATTRIBUTE_MISSING。这里替它把属性加上。
     */
    if (specifier.endsWith('.json')) {
      const r = next(specifier, { ...context, importAttributes: { type: 'json' } });
      return { ...r, importAttributes: { type: 'json' } };
    }

    try {
      return next(specifier, context);
    } catch (err) {
      // 只管相对路径的「找不到」，别的错误照原样抛出去
      if ((err as { code?: string }).code !== 'ERR_MODULE_NOT_FOUND') throw err;
      if (!specifier.startsWith('.')) throw err;

      for (const ext of TRIES) {
        const url = new URL(specifier + ext, context.parentURL);
        if (existsSync(fileURLToPath(url))) {
          return { url: url.href, shortCircuit: true };
        }
      }
      throw err;
    }
  },
});
