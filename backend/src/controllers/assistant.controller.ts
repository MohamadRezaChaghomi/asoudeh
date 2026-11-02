import type { RequestHandler } from 'express';
import {
  answerAssistantQuestion,
  getAssistantStatus,
} from '../services/assistant.service.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { HttpError } from '../utils/httpError.js';
import type { AssistantMessageInput } from '../validators/assistant.validator.js';

function authenticatedUserId(req: Parameters<RequestHandler>[0]): string {
  if (!req.user) {
    throw new HttpError(401, 'AUTHENTICATION_REQUIRED', 'برای ادامه وارد حساب خود شوید.');
  }
  return req.user.userId;
}

export const getStatus: RequestHandler = asyncHandler(async (req, res) => {
  const status = await getAssistantStatus(authenticatedUserId(req));
  res.json({ success: true, data: status });
});

export const sendMessage: RequestHandler = asyncHandler(async (req, res) => {
  const result = await answerAssistantQuestion(
    authenticatedUserId(req),
    (req.body as AssistantMessageInput).message,
  );
  res.json({ success: true, data: result });
});
