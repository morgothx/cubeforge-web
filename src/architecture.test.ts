/**
 * The dependency direction, as a test rather than as a sentence in a document.
 *
 * `design.md` stated an order and the code did not follow it — not because the
 * code was wrong but because the document had `routing` below the screens it
 * routes to, which no route table can honour. Nothing noticed for nineteen
 * tasks, because a dependency direction is exactly the kind of claim that is
 * either mechanised or merely believed.
 *
 * The rule: a module may import from any layer below it and none above.
 */

const LAYERS: readonly (readonly [string, string])[] = [
  ['types', 'src/api/types'],
  ['refusal', 'src/api/refusal'],
  ['access', 'src/access/'],
  ['session-store', 'src/api/session'],
  ['http', 'src/api/http'],
  ['endpoints', 'src/api/endpoints'],
  // The provider sits below the queries, not above them: `useStanding` asks
  // whether a session is established before it asks anything of the backend,
  // and nothing in the provider reaches for a query.
  ['session', 'src/session/'],
  ['queries', 'src/queries/'],
  // Reading the address and remembering the selection: routing primitives the
  // frame consults, and deliberately not the table itself.
  ['routing primitives', 'src/routes/'],
  ['components', 'src/components/'],
  ['screens', 'src/screens/'],
  // The composition root. It imports every screen by definition.
  //
  // Named without its extension on purpose: an import is written extensionless,
  // so a prefix carrying `.tsx` matches the file and never the imports *of* it —
  // which is a layer that can only ever be found innocent. A probe importing
  // the table from a screen is what found that.
  ['route table', 'src/routes/AppRoutes'],
];

const sources = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/** `./api/http.ts` → `src/api/http.ts`, which is what the layers are named in. */
function asSourcePath(globKey: string): string {
  return globKey.replace(/^\.\//, 'src/');
}

function layerOf(path: string): number {
  let found = -1;
  LAYERS.forEach(([, prefix], index) => {
    if (path.startsWith(prefix)) found = index;
  });
  return found;
}

function importsOf(source: string, from: string): string[] {
  const directory = from.slice(0, from.lastIndexOf('/'));
  return [...source.matchAll(/from '(\.[^']+)'/g)].map((match) => {
    const parts = `${directory}/${match[1]}`.split('/');
    const resolved: string[] = [];
    for (const part of parts) {
      if (part === '.') continue;
      if (part === '..') resolved.pop();
      else resolved.push(part);
    }
    return resolved.join('/');
  });
}

describe('the dependency direction', () => {
  it('runs one way', () => {
    const upward: string[] = [];

    for (const [key, source] of Object.entries(sources)) {
      const path = asSourcePath(key);
      if (/\.test\.tsx?$/.test(path)) continue;
      const from = layerOf(path);
      if (from === -1) continue;

      for (const target of importsOf(source, path)) {
        const to = layerOf(target);
        if (to > from) {
          upward.push(
            `${path} (${LAYERS[from]?.[0] ?? '?'}) imports ${target} (${LAYERS[to]?.[0] ?? '?'})`,
          );
        }
      }
    }

    expect(upward).toEqual([]);
  });
});
