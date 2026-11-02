import request from 'supertest';
import { afterEach, describe, expect, it, vi } from 'vitest';
import app from '../app.js';
import { env } from '../config/env.js';
import {
  findRelevantKnowledge,
} from '../services/assistantKnowledge.js';
import { OpenAiCompatibleAssistantProvider } from '../services/assistantProvider.js';

const originalApiKey = env.aiApiKey;
const originalModel = env.aiModel;
const originalBaseUrl = env.aiBaseUrl;

afterEach(() => {
  vi.unstubAllGlobals();
  env.aiApiKey = originalApiKey;
  env.aiModel = originalModel;
  env.aiBaseUrl = originalBaseUrl;
});

describe('assistant knowledge', () => {
  it('retrieves only relevant public help content', () => {
    const results = findRelevantKnowledge('آیا آسوده اتصال بانکی خودکار دارد؟');

    expect(results.length).toBeGreaterThan(0);
    expect(results[0]?.id).toBe('bank');
    expect(findRelevantKnowledge('سوال کاملاً نامرتبط')).toEqual([]);
  });
});

describe('OpenAI-compatible assistant provider', () => {
  it('sends only the submitted question and selected public references', async () => {
    env.aiApiKey = 'test-provider-secret';
    env.aiModel = 'test-model';
    env.aiBaseUrl = 'https://provider.example/v1/';
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        JSON.stringify({ choices: [{ message: { content: 'راهنمای ثبت هزینه.' } }] }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    );
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAiCompatibleAssistantProvider();
    const knowledge = findRelevantKnowledge('چطور هزینه ثبت کنم؟');

    await expect(provider.answer('چطور هزینه ثبت کنم؟', knowledge)).resolves.toBe(
      'راهنمای ثبت هزینه.',
    );
    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] ?? [];
    expect(String(url)).toBe('https://provider.example/v1/chat/completions');
    expect(new Headers(init?.headers).get('authorization')).toBe('Bearer test-provider-secret');
    const requestBody = JSON.parse(String(init?.body)) as {
      model: string;
      messages: Array<{ role: string; content: string }>;
    };
    expect(requestBody.model).toBe('test-model');
    expect(requestBody.messages[1]?.content).toContain('چطور هزینه ثبت کنم؟');
    expect(requestBody.messages[1]?.content).not.toContain('شماره همراه');
    expect(requestBody.messages[1]?.content).not.toContain('test-provider-secret');
  });

  it('rejects unsafe provider URLs and sanitizes provider failures', async () => {
    env.aiApiKey = 'test-provider-secret';
    env.aiModel = 'test-model';
    env.aiBaseUrl = 'http://provider.example/v1';
    const fetchMock = vi.fn<typeof fetch>();
    vi.stubGlobal('fetch', fetchMock);
    const provider = new OpenAiCompatibleAssistantProvider();

    await expect(provider.answer('سوال', [])).rejects.toMatchObject({
      code: 'ASSISTANT_UNAVAILABLE',
    });
    expect(fetchMock).not.toHaveBeenCalled();

    env.aiBaseUrl = 'https://provider.example/v1';
    fetchMock.mockResolvedValue(
      new Response('private provider response', { status: 401 }),
    );
    await expect(provider.answer('سوال', [])).rejects.toMatchObject({
      code: 'ASSISTANT_UNAVAILABLE',
      publicMessage: expect.not.stringContaining('private provider response'),
    });
  });
});

describe('assistant API access control', () => {
  it('requires an authenticated session and same-origin POSTs', async () => {
    const status = await request(app).get('/api/v1/assistant/status');
    const message = await request(app)
      .post('/api/v1/assistant/messages')
      .send({ message: 'آیا بانک متصل است؟' });

    expect(status.status).toBe(401);
    expect(status.body.error.code).toBe('AUTHENTICATION_REQUIRED');
    expect(message.status).toBe(403);
    expect(message.body.error.code).toBe('ORIGIN_REQUIRED');
  });
});
