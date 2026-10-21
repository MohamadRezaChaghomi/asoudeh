import type { Request, RequestHandler } from 'express';
import { secureStringEqual } from '../utils/authCrypto.js';
import { HttpError } from '../utils/httpError.js';

export function getCookie(req: Request, name: string): string | undefined {
  const cookieHeader = req.headers.cookie;

  if (!cookieHeader) {
    return undefined;
  }

  for (const cookie of cookieHeader.split(';')) {
    const separator = cookie.indexOf('=');

    if (separator < 0 || cookie.slice(0, separator).trim() !== name) {
      continue;
    }

    try {
      return decodeURIComponent(cookie.slice(separator + 1).trim());
    } catch {
      return undefined;
    }
  }

  return undefined;
}

export const requireCsrf: RequestHandler = (req, _res, next) => {
  const cookieToken = getCookie(req, 'asoudeh_csrf');
  const headerToken = req.get('X-CSRF-Token');

  if (!cookieToken || !headerToken || !secureStringEqual(cookieToken, headerToken)) {
    next(new HttpError(403, 'CSRF_VALIDATION_FAILED', 'اعتبار درخواست تأیید نشد.'));
    return;
  }

  next();
};
