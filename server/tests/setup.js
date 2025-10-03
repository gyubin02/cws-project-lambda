const test = require('node:test');
const fs = require('node:fs');
const path = require('node:path');

process.env['NODE_ENV'] = 'test';
process.env['MOCK'] = process.env['MOCK'] ?? '1';
process.env['PORT'] = process.env['PORT'] ?? '0';

const storePath = path.resolve(__dirname, '../.data/store.json');

test.beforeEach(() => {
  try {
    fs.unlinkSync(storePath);
  } catch {
    // ignore when store file is absent
  }
});
