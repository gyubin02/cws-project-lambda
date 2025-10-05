const test = require('node:test');
const fs = require('node:fs/promises');
const path = require('node:path');

process.env['NODE_ENV'] = 'test';
process.env['MOCK'] = process.env['MOCK'] ?? '1';
process.env['PORT'] = process.env['PORT'] ?? '0';

const storePath = path.resolve(__dirname, '../.data/store.json');
const { profileService } = require('../dist/services/profile.service');

const DEFAULT_PROFILE = {
  user_id: 'tester',
  preferred_mode: 'car',
  tz: 'Asia/Seoul',
  home: { lat: 37.55, lon: 126.98, label: 'Home', district: 'Seoul' },
  work: { lat: 37.40, lon: 127.10, label: 'Office' },
};

test.beforeEach(async () => {
  try {
    await fs.unlink(storePath);
  } catch {
    // ignore missing store between tests
  }

  await profileService.saveProfile(DEFAULT_PROFILE);
});
