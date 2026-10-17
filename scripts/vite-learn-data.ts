import { readdirSync, readFileSync } from 'node:fs';
import { join, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

/**
 * Two virtual modules built from src/data/learn, so the course text itself (over a megabyte) can load
 * only when someone opens Learn, while Practice and the mock exam still get the lesson check questions:
 *
 *   virtual:learn-checks   every check question of every lesson, with its module as `cat`
 *   virtual:learn-index    module ids, and each module's lesson ids and minutes (for progress counts)
 */
export function learnData(root = process.cwd()): Plugin {
  const dir = resolve(root, 'src/data/learn');
  const CHECKS = '\0virtual:learn-checks';
  const INDEX = '\0virtual:learn-index';

  type Block = { t: string; q?: Record<string, unknown> };
  type Module = { id: string; lessons: { id: string; minutes: number; steps: { blocks: Block[] }[] }[] };

  const load = (): Module[] => {
    const order = JSON.parse(readFileSync(join(dir, 'order.json'), 'utf8')) as string[];
    const have = new Set(readdirSync(join(dir, 'modules')).map((f) => f.replace(/\.json$/, '')));
    return order.filter((id) => have.has(id)).map((id) => JSON.parse(readFileSync(join(dir, 'modules', `${id}.json`), 'utf8')) as Module);
  };

  return {
    name: 'learn-data',
    resolveId(id) {
      if (id === 'virtual:learn-checks') return CHECKS;
      if (id === 'virtual:learn-index') return INDEX;
      return null;
    },
    load(id) {
      if (id === CHECKS) {
        const checks = load().flatMap((m) =>
          m.lessons.flatMap((l) => l.steps.flatMap((s) => s.blocks.filter((b) => b.t === 'check').map((b) => ({ ...b.q, cat: m.id })))),
        );
        return `export default ${JSON.stringify(checks)};`;
      }
      if (id === INDEX) {
        const index = load().map((m) => ({ id: m.id, lessons: m.lessons.map((l) => ({ id: l.id, minutes: l.minutes })) }));
        return `export default ${JSON.stringify(index)};`;
      }
      return null;
    },
    // Editing a lesson in the dev server refreshes both virtual modules.
    handleHotUpdate({ file, server }) {
      if (!file.startsWith(dir + sep)) return;
      for (const id of [CHECKS, INDEX]) {
        const mod = server.moduleGraph.getModuleById(id);
        if (mod) server.moduleGraph.invalidateModule(mod);
      }
      server.ws.send({ type: 'full-reload' });
    },
  };
}
