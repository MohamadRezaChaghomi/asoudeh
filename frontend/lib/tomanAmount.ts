import { normalizeDigits } from './normalizeDigits';

const MAX_SAFE_AMOUNT = BigInt(Number.MAX_SAFE_INTEGER);
const GROUPED_AMOUNT_PATTERN = /^\d{1,3}(?:[,\u066c\s]\d{3})+$/;
const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';

export function parseTomanAmount(value: string): number | undefined {
  const normalized = normalizeDigits(value.trim());
  if (!/^\d+$/.test(normalized) && !GROUPED_AMOUNT_PATTERN.test(normalized)) {
    return undefined;
  }

  const digits = normalized.replace(/[,\u066c\s]/g, '');
  const amount = BigInt(digits);
  return amount <= MAX_SAFE_AMOUNT ? Number(amount) : undefined;
}

export function formatTomanAmountInput(value: string): string {
  const normalized = normalizeDigits(value);
  if (!/^[\d,\u066c\s]*$/.test(normalized)) return normalized;

  const digits = normalized.replace(/[,\u066c\s]/g, '');
  if (!digits) return '';
  return digits
    .replace(/\B(?=(\d{3})+(?!\d))/g, '\u066c')
    .replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}

export function formatTomanAmountInputWithCaret(
  value: string,
  selectionStart: number | null,
  selectionEnd: number | null,
): { value: string; selectionStart: number; selectionEnd: number } {
  const formattedValue = formatTomanAmountInput(value);
  const start = selectionStart ?? value.length;
  const end = selectionEnd ?? start;

  return {
    value: formattedValue,
    selectionStart: getPositionAfterDigits(
      formattedValue,
      countDigits(value.slice(0, start)),
    ),
    selectionEnd: getPositionAfterDigits(
      formattedValue,
      countDigits(value.slice(0, end)),
    ),
  };
}

export function formatTomanAmount(value: number | string): string {
  return new Intl.NumberFormat('fa-IR').format(BigInt(value));
}

function countDigits(value: string): number {
  return normalizeDigits(value).replace(/\D/g, '').length;
}

function getPositionAfterDigits(value: string, count: number): number {
  if (count === 0) return 0;

  let digitsSeen = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/[0-9۰-۹٠-٩]/.test(value[index])) {
      digitsSeen += 1;
      if (digitsSeen === count) return index + 1;
    }
  }
  return value.length;
}
