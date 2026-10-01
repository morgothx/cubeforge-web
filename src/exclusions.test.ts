/**
 * The things this dashboard deliberately does not do, held by scan.
 *
 * Requirements 9.5, 10.2 and 10.3 are claims about **absence**, and absence is
 * the one property no ordinary test notices losing. Nothing fails the day
 * somebody adds a "Rebuild now" button; the screen simply grows one, and the
 * boundary this feature argued for is gone without a line of the argument
 * being revisited.
 *
 * So the source is read. Both scans below are shown to bite by adding the very
 * thing they forbid and watching them turn red.
 */

const sources = import.meta.glob('./**/*.{ts,tsx}', {
  query: '?raw',
  import: 'default',
  eager: true,
});

/**
 * The source with its comments removed.
 *
 * Prose about an export reads exactly like an export. Every rule here is about
 * what the code *does*, and this file's own documentation is the proof that
 * writing about a forbidden thing has to stay allowed.
 */
function code(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

function applicationSources(): [string, string][] {
  return Object.entries(sources)
    .filter(([path]) => !/\.test\.tsx?$/.test(path))
    .map(([path, source]) => [path, code(source)]);
}

describe('the analytics change nothing (10.2)', () => {
  /**
   * The analytics are read-only. Inventory is written by machine clients
   * through the API, and a dashboard that could edit it would be a second way
   * in — one with none of the guarantees the sync API was built to give.
   *
   * Asked of the imports rather than of the screens: a mutation hook is how a
   * change would be made in this codebase, and it is far easier to see one
   * imported than to prove no control anywhere writes.
   */
  const ANALYTICS =
    /^\.\/(analytics\/|components\/analytics\/|screens\/Analytics|queries\/analytics)/;

  it('imports no mutation hook anywhere in the analytics', () => {
    const mutating = applicationSources()
      .filter(([path]) => ANALYTICS.test(path))
      .filter(([, source]) => /useMutation/.test(source))
      .map(([path]) => path);

    expect(mutating).toEqual([]);
  });

  it('finds the analytics modules it claims to be scanning', () => {
    // Without this the rule above passes just as well against a pattern that
    // matches nothing at all, which is the state a renamed directory produces.
    const scanned = applicationSources().filter(([path]) =>
      ANALYTICS.test(path),
    );

    expect(scanned.length).toBeGreaterThan(8);
  });
});

describe('no export and no rebuild can be triggered here (9.5, 10.3)', () => {
  /**
   * When data is exported, and when a prepared answer is rebuilt, are the
   * platform's business. The dashboard states how current an answer is and
   * offers no way to change it — a "refresh the data" control would promise
   * something this application cannot deliver and the platform never offered.
   *
   * The word itself is unavoidable in three places, and all three are the
   * platform's own vocabulary rather than an action: the answer state
   * `never-exported`, the provenance `exported-objects`, and the sentences
   * that say data has not arrived. Those are removed before the rule is
   * applied, so anything left is a use this feature did not sanction.
   */
  const PLATFORM_WORDS = [
    /'never-exported'/g,
    /'exported-objects'/g,
    /has been exported for it/g,
    /reading the exported data/g,
  ];

  /** ESM's own keyword, which is every second line and never an action. */
  const ESM_EXPORT =
    /\bexport\s+(?:const|function|type|interface|class|default|async|\{|\*)/g;

  function beyondThePlatformsWords(source: string): string {
    let rest = source.replace(ESM_EXPORT, ' ');
    for (const allowed of PLATFORM_WORDS) rest = rest.replace(allowed, ' ');
    return rest;
  }

  it('names no export and no rebuild the person could set off', () => {
    const offering = applicationSources()
      .filter(([, source]) =>
        /\bexport|\brebuild|refreshPreAggregations/i.test(
          beyondThePlatformsWords(source),
        ),
      )
      .map(([path]) => path);

    expect(offering).toEqual([]);
  });

  it('reads enough source for that to mean anything', () => {
    // The same guard as above: a rule over an empty set is not a rule.
    expect(applicationSources().length).toBeGreaterThan(30);
  });
});
