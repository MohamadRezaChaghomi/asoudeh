import { createHash } from 'node:crypto';
import AssistantRateLimit from '../models/AssistantRateLimit.js';
import { HttpError } from '../utils/httpError.js';
import { isDuplicateKeyError } from '../utils/isDuplicateKeyError.js';
import { findRelevantKnowledge } from './assistantKnowledge.js';
import { isAssistantConfigured, OpenAiCompatibleAssistantProvider } from './assistantProvider.js';

const REQUEST_LIMIT = 10;
const WINDOW_MS = 60_000;

function rateLimitId(userId: string, now: Date): string {
  const subject = createHash('sha256').update(userId).digest('hex');
  return `${subject}:${Math.floor(now.getTime() / WINDOW_MS)}`;
}

async function consumeAssistantRequest(userId: string, now: Date): Promise<void> {
  const id = rateLimitId(userId, now);
  let result: { requestCount: number } | null;
  try {
    result = await AssistantRateLimit.findOneAndUpdate(
      { _id: id },
      {
        $inc: { requestCount: 1 },
        $setOnInsert: { expiresAt: new Date(now.getTime() + WINDOW_MS * 2) },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
      .select('requestCount')
      .lean();
  } catch (error) {
    if (isDuplicateKeyError(error)) {
      result = await AssistantRateLimit.findOneAndUpdate(
        { _id: id },
        { $inc: { requestCount: 1 } },
        { new: true },
      )
        .select('requestCount')
        .lean();
    } else {
      throw error;
    }
  }

  if (!result) {
    throw new HttpError(503, 'RATE_LIMIT_UNAVAILABLE', 'امکان بررسی درخواست وجود ندارد.');
  }
  if (result.requestCount > REQUEST_LIMIT) {
    throw new HttpError(
      429,
      'ASSISTANT_RATE_LIMITED',
      'تعداد پرسش‌ها بیش از حد مجاز است. کمی بعد دوباره تلاش کنید.',
      Math.max(1, Math.ceil((WINDOW_MS - (now.getTime() % WINDOW_MS)) / 1000)),
    );
  }
}

export async function getAssistantStatus(userId: string): Promise<{ available: boolean }> {
  if (!userId) throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.');
  return { available: isAssistantConfigured() };
}

export async function answerAssistantQuestion(
  userId: string,
  question: string,
): Promise<{ answer: string; source?: { label: string; href: string } }> {
  if (!isAssistantConfigured()) {
    throw new HttpError(
      503,
      'ASSISTANT_UNAVAILABLE',
      'دستیار راهنما هنوز برای این سامانه پیکربندی نشده است.',
    );
  }

  await consumeAssistantRequest(userId, new Date());
  const knowledge = findRelevantKnowledge(question);
  if (!knowledge.length) {
    return {
      answer: 'برای این پرسش در راهنمای آسوده اطلاعات قابل اتکایی ندارم. لطفاً راهنمای برنامه را ببینید.',
      source: { label: 'راهنمای آسوده', href: '/guide' },
    };
  }

  const provider = new OpenAiCompatibleAssistantProvider();
  const answer = await provider.answer(question, knowledge);
  return {
    answer,
    source: { label: 'اطلاعات راهنمای آسوده', href: knowledge[0].href },
  };
}
