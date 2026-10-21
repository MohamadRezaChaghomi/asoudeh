import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { env } from '../config/env.js';
import { HttpError } from './httpError.js';

function requireAuthHashSecret(): string {
  if (!env.authHashSecret || Buffer.byteLength(env.authHashSecret) < 32) {
    throw new HttpError(
      503,
      'AUTH_NOT_CONFIGURED',
      'سرویس احراز هویت هنوز پیکربندی نشده است.',
    );
  }

  return env.authHashSecret;
}

export function normalizeIranianMobile(input: string): string | null {
  const asciiDigits = input
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
  const compact = asciiDigits.replace(/[\s()-]/g, '');
  let canonical = compact;

  if (/^\+989\d{9}$/.test(compact)) {
    canonical = `0${compact.slice(3)}`;
  } else if (/^00989\d{9}$/.test(compact)) {
    canonical = `0${compact.slice(4)}`;
  } else if (/^989\d{9}$/.test(compact)) {
    canonical = `0${compact.slice(2)}`;
  } else if (/^9\d{9}$/.test(compact)) {
    canonical = `0${compact}`;
  }

  return /^09\d{9}$/.test(canonical) ? canonical : null;
}

export function generateOtp(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

export function generateOpaqueToken(): string {
  return randomBytes(32).toString('base64url');
}

export function generateId(): string {
  return randomBytes(24).toString('base64url');
}

export function hashAuthValue(purpose: string, value: string): string {
  return createHmac('sha256', requireAuthHashSecret())
    .update(`${purpose}\0${value}`)
    .digest('hex');
}

export function secureStringEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export function hashOtp(phone: string, code: string): string {
  return hashAuthValue('otp', `${phone}\0${code}`);
}
