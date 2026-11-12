import assert from 'node:assert/strict';
import test from 'node:test';
import { createHealthResponse } from './health';

test('API health payload is explicit about missing database setup', () => {
  const now = new Date('2026-11-12T00:00:00.000Z');
  const actual = createHealthResponse(now);

  assert.deepEqual(actual, {
    status: 'ok',
    service: 'business-os-api',
    checkedAt: '2026-11-12T00:00:00.000Z',
    database: 'not_configured'
  });
});
