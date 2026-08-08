import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Used by Vitest (tests/unit, tests/component) — see tests/setup.ts. */
export const server = setupServer(...handlers);
