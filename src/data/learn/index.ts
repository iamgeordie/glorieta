import type { CheckQuestion, Lesson, Module } from './types';
import order from './order.json';

const files = import.meta.glob<Module>('./modules/*.json', { eager: true, import: 'default' });

/** The course, in teaching order. `order.json` is the one place that sets the order. */
export const modules: Module[] = (order as string[]).map((id) => {
  const m = files[`./modules/${id}.json`];
  if (!m) throw new Error(`order.json lists "${id}" but src/data/learn/modules/${id}.json does not exist`);
  return m;
});

export const moduleById = (id: string): Module | undefined => modules.find((m) => m.id === id);

export const lessonById = (moduleId: string, lessonId: string): { module: Module; lesson: Lesson; index: number } | undefined => {
  const module = moduleById(moduleId);
  const index = module ? module.lessons.findIndex((l) => l.id === lessonId) : -1;
  const lesson = module?.lessons[index];
  return module && lesson ? { module, lesson, index } : undefined;
};

/** Every check question in a lesson, in order, with the step it appears in. */
export function checksOf(lesson: Lesson): { q: CheckQuestion; step: number }[] {
  const out: { q: CheckQuestion; step: number }[] = [];
  lesson.steps.forEach((s, step) => {
    for (const b of s.blocks) if (b.t === 'check') out.push({ q: b.q, step });
  });
  return out;
}

export type Where = { moduleId: string; lessonId: string; step: number };

/**
 * Where a question is taught, so a missed quiz question can link back to the lesson.
 * A check points at its own step; a bank question points at the lesson that lists it in `covers`;
 * a sign question points at the first lesson that shows the sign.
 */
export const whereTaught: Map<string, Where> = (() => {
  const map = new Map<string, Where>();
  for (const m of modules) {
    for (const l of m.lessons) {
      for (const { q, step } of checksOf(l)) map.set(q.id, { moduleId: m.id, lessonId: l.id, step: step + 1 });
      for (const id of l.covers ?? []) if (!map.has(id)) map.set(id, { moduleId: m.id, lessonId: l.id, step: 1 });
      l.steps.forEach((s, step) => {
        for (const b of s.blocks) {
          if (b.t !== 'signs') continue;
          for (const id of b.ids) if (!map.has(`sign:${id}`)) map.set(`sign:${id}`, { moduleId: m.id, lessonId: l.id, step: step + 1 });
        }
      });
    }
  }
  return map;
})();
