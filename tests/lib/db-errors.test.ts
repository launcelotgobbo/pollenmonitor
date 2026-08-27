import { strict as assert } from 'node:assert';
import test from 'node:test';
import { dataErrorResponse, PUBLIC_DATA_ERROR_MESSAGE } from '@/lib/api-errors';
import {
  classifyDatabaseError,
  DatabaseOperationError,
} from '@/lib/db';

test('database errors distinguish connection failures from query failures', () => {
  assert.equal(classifyDatabaseError({ code: 'ENOTFOUND' }), 'connection');
  assert.equal(classifyDatabaseError({ code: '08006' }), 'connection');
  assert.equal(classifyDatabaseError({ code: '28P01' }), 'connection');
  assert.equal(classifyDatabaseError({ code: '22P02' }), 'query');
  assert.equal(classifyDatabaseError(new Error('syntax error')), 'query');
});

test('database failures log their category but return one generic public message', async () => {
  const originalError = console.error;
  const logs: unknown[][] = [];
  console.error = (...args: unknown[]) => logs.push(args);

  try {
    for (const failure of [
      new DatabaseOperationError('connection', 'ENOTFOUND', new Error('private host')),
      new DatabaseOperationError('query', '22P02', new Error('private query detail')),
    ]) {
      const response = dataErrorResponse('test', failure);
      assert.equal(response.status, 500);
      assert.deepEqual(await response.json(), { error: PUBLIC_DATA_ERROR_MESSAGE });
    }
  } finally {
    console.error = originalError;
  }

  assert.match(String(logs[0][0]), /database connection failed/);
  assert.match(String(logs[1][0]), /database query failed/);
  assert.equal(JSON.stringify(logs).includes('private'), false);
});
