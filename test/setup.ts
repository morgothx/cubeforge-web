import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest does not unmount between tests, and a component left in the document
// makes the next test's query ambiguous rather than failing outright — which
// is the kind of failure that gets diagnosed as flakiness.
afterEach(cleanup);
