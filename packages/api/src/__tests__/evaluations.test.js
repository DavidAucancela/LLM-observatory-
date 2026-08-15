const request = require('supertest');
const { app }  = require('../index');
const { resetDb, createOrg, createMember } = require('./helpers');

beforeEach(resetDb);
afterEach(() => jest.restoreAllMocks());

const VALID_METRIC = {
  provider: 'anthropic', model: 'claude-sonnet-4-6',
  input_tokens: 100, output_tokens: 50, total_tokens: 150,
  cost_usd: 0.00045, latency_ms: 320, status_code: 200,
};

async function createApiCall(obsToken, overrides = {}) {
  const res = await request(app)
    .post('/api/metrics')
    .set('Authorization', `Bearer ${obsToken}`)
    .send({ ...VALID_METRIC, ...overrides });
  return res.body.data.id;
}

describe('POST /api/evaluations', () => {
  it('creates a human evaluation and returns 201', async () => {
    const { obsToken, jwt } = await createOrg('Eval Org');
    const callId = await createApiCall(obsToken);

    const res = await request(app)
      .post('/api/evaluations')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ api_call_id: callId, score: 85, reasoning: 'Looks good' });

    expect(res.status).toBe(201);
    expect(res.body.data.method).toBe('human');
    expect(res.body.data.name).toBe('quality');
    expect(parseFloat(res.body.data.score)).toBe(85);
  });

  it('rejects a score outside 0-100', async () => {
    const { obsToken, jwt } = await createOrg('Eval Range Org');
    const callId = await createApiCall(obsToken);

    const res = await request(app)
      .post('/api/evaluations')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ api_call_id: callId, score: 150 });
    expect(res.status).toBe(400);
  });

  it('returns 404 when api_call_id belongs to another org', async () => {
    const orgA = await createOrg('Eval Org A');
    const orgB = await createOrg('Eval Org B');
    const callId = await createApiCall(orgB.obsToken);

    const res = await request(app)
      .post('/api/evaluations')
      .set('Authorization', `Bearer ${orgA.jwt}`)
      .send({ api_call_id: callId, score: 50 });
    expect(res.status).toBe(404);
  });

  it('returns 401 without auth', async () => {
    const res = await request(app).post('/api/evaluations').send({ api_call_id: 1, score: 50 });
    expect(res.status).toBe(401);
  });

  it('returns 403 for an observatory token (dashboard-only action)', async () => {
    const { obsToken } = await createOrg('Eval Obs Org');
    const callId = await createApiCall(obsToken);

    const res = await request(app)
      .post('/api/evaluations')
      .set('Authorization', `Bearer ${obsToken}`)
      .send({ api_call_id: callId, score: 50 });
    expect(res.status).toBe(403);
  });
});

describe('GET /api/evaluations', () => {
  it('lists evaluations scoped to the requesting org', async () => {
    const orgA = await createOrg('Eval List A');
    const orgB = await createOrg('Eval List B');
    const callA = await createApiCall(orgA.obsToken);
    const callB = await createApiCall(orgB.obsToken);

    await request(app).post('/api/evaluations').set('Authorization', `Bearer ${orgA.jwt}`)
      .send({ api_call_id: callA, score: 90 });
    await request(app).post('/api/evaluations').set('Authorization', `Bearer ${orgB.jwt}`)
      .send({ api_call_id: callB, score: 10 });

    const resA = await request(app)
      .get(`/api/evaluations?api_call_id=${callA}`)
      .set('Authorization', `Bearer ${orgA.jwt}`);
    expect(resA.body.evaluations).toHaveLength(1);
    expect(parseFloat(resA.body.evaluations[0].score)).toBe(90);
  });
});

describe('POST /api/evaluations/judge', () => {
  it('rejects non-admin members', async () => {
    const { obsToken, orgId } = await createOrg('Judge Admin Org');
    const member = await createMember(orgId);
    const callId = await createApiCall(obsToken, { response_full: 'The answer is 42.' });

    const res = await request(app)
      .post('/api/evaluations/judge')
      .set('Authorization', `Bearer ${member.jwt}`)
      .send({ api_call_id: callId });
    expect(res.status).toBe(403);
  });

  it('returns 400 when the request has no captured response text', async () => {
    const { obsToken, jwt } = await createOrg('Judge NoResponse Org');
    const callId = await createApiCall(obsToken); // no response_full

    const res = await request(app)
      .post('/api/evaluations/judge')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ api_call_id: callId });
    expect(res.status).toBe(400);
  });

  it('returns 400 when no sdk credential is configured', async () => {
    const { obsToken, jwt } = await createOrg('Judge NoCred Org');
    const callId = await createApiCall(obsToken, { response_full: 'The answer is 42.' });

    const res = await request(app)
      .post('/api/evaluations/judge')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ api_call_id: callId });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/clave SDK/);
  });

  it('scores the call via the judge and records the judge call itself as billable spend', async () => {
    const { obsToken, jwt } = await createOrg('Judge Success Org');
    const callId = await createApiCall(obsToken, { response_full: 'The answer is 42.' });

    await request(app).post('/api/credentials').set('Authorization', `Bearer ${jwt}`)
      .send({ provider: 'openai', key_type: 'sdk', label: 'Judge Key', value: 'sk-proj-FAKEFAKEFAKEFAKE0000' });

    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        choices: [{ message: { content: '{"score": 88, "reasoning": "Correct and concise."}' } }],
        usage: { prompt_tokens: 40, completion_tokens: 15 },
      }),
    });

    const res = await request(app)
      .post('/api/evaluations/judge')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ api_call_id: callId });

    expect(res.status).toBe(201);
    expect(res.body.data.method).toBe('llm_judge');
    expect(parseFloat(res.body.data.score)).toBe(88);
    expect(res.body.data.reasoning).toBe('Correct and concise.');
    expect(res.body.data.evaluator_model).toBe('gpt-4o-mini');

    // Judge call itself must be visible on the dashboard, not silent spend
    const list = await request(app).get('/api/metrics').set('Authorization', `Bearer ${jwt}`);
    const judgeRow = list.body.data.find(r => r.prompt_preview === 'eval:judge');
    expect(judgeRow).toBeDefined();
    expect(judgeRow.model).toBe('gpt-4o-mini');
    expect(judgeRow.input_tokens).toBe(40);
    expect(judgeRow.output_tokens).toBe(15);
  });

  it('returns 502 when the judge response is not valid JSON', async () => {
    const { obsToken, jwt } = await createOrg('Judge BadJSON Org');
    const callId = await createApiCall(obsToken, { response_full: 'The answer is 42.' });

    await request(app).post('/api/credentials').set('Authorization', `Bearer ${jwt}`)
      .send({ provider: 'openai', key_type: 'sdk', label: 'Judge Key', value: 'sk-proj-FAKEFAKEFAKEFAKE0000' });

    jest.spyOn(globalThis, 'fetch').mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({
        choices: [{ message: { content: 'not json at all' } }],
        usage: { prompt_tokens: 40, completion_tokens: 15 },
      }),
    });

    const res = await request(app)
      .post('/api/evaluations/judge')
      .set('Authorization', `Bearer ${jwt}`)
      .send({ api_call_id: callId });
    expect(res.status).toBe(502);
  });
});
