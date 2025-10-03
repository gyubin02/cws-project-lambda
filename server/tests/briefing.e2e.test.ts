import request from 'supertest';
import app from '../src/app';

describe('GET /api/v1/briefing', () => {
  it('works without keys (mock or missing_api_key graceful)', async () => {
    const res = await request(app).get('/api/v1/briefing')
      .query({ lat: 37.55, lon: 126.98, from: '강남역', to: '서울역' })
      .expect(200);
    expect(res.body).toHaveProperty('summary');
    expect(res.body).toHaveProperty('notices');
  });

  it('validates required parameters', async () => {
    const res = await request(app).get('/api/v1/briefing')
      .query({ lat: 37.55 })
      .expect(400);
    expect(res.body).toHaveProperty('error', 'bad_request');
  });

  it('handles partial failures gracefully', async () => {
    const res = await request(app).get('/api/v1/briefing')
      .query({ lat: 37.55, lon: 126.98, from: '강남역', to: '서울역' })
      .expect(200);
    
    // Should have summary even if some services fail
    expect(res.body.summary).toBeDefined();
    expect(typeof res.body.summary).toBe('string');
  });
});
