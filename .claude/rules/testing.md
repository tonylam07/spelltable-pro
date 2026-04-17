# Testing Conventions

## Setup
- Framework: Jest + supertest
- Test files: `tests/*.test.js`
- Run: `npm test` (all) or `npm run test:coverage`

## Mocking models
Always mock at the module level. Use `jest.mock` before imports.

```js
jest.mock('../api/models', () => ({
  Game: {
    find: jest.fn(),
    findOne: jest.fn(),
    deleteOne: jest.fn()
  }
}));
```

**Critical**: Variables referenced inside `jest.mock()` factory functions
MUST be prefixed with `mock` (lowercase ok). Jest hoists mock calls and
blocks access to out-of-scope variables otherwise.

```js
// WRONG — will throw "not allowed to reference out-of-scope variables"
const findOne = jest.fn();
jest.mock('../api/models', () => ({ Game: { findOne: (...a) => findOne(...a) } }));

// CORRECT
const mockFindOne = jest.fn();
jest.mock('../api/models', () => ({ Game: { findOne: (...a) => mockFindOne(...a) } }));
```

## Mocking auth middleware
Always stub authenticate to inject a test user:

```js
jest.mock('../api/middleware/auth', () => ({
  authenticate: (req, _res, next) => { req.user = { id: 'TEST_USER_ID' }; next(); },
  JWT_SECRET: 'test'
}));
```

## Mocking validation middleware
```js
jest.mock('../api/middleware/validation', () => ({
  validateGameId: (_req, _res, next) => next(),
  validatePlayerId: (_req, _res, next) => next()
}));
```

## Building test apps
```js
function buildApp() {
  const app = express();
  app.use(express.json());
  app.use('/api/route', routes);
  return app;
}
```

## Coverage thresholds (enforced)
```
statements: 75%
branches:   60%
functions:  70%
lines:      75%
```
Coverage is scoped to: `api/routes/detect.js`, `api/routes/cards.js`, `api/services/**`

## What to test
- Happy path (200/201)
- Auth guard (401 when not mocked)
- Not found (404)
- Conflict (409)
- Forbidden (403) — especially host-only actions
- Bad input (400) — invalid IDs, missing fields
- Error paths (500) — mock rejections

## What NOT to test
- Third-party libs (sharp, tesseract, mongoose internals)
- The mock itself
