const MAX_SAFE_AMOUNT = BigInt(Number.MAX_SAFE_INTEGER);
const GROUPED_AMOUNT_PATTERN = /^\d{1,3}(?:[,\u066c\s]\d{3})+$/;

function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

export function parseTomanAmount(value: string): number | undefined {
  const normalized = toAsciiDigits(value.trim());
  if (!/^\d+$/.test(normalized) && !GROUPED_AMOUNT_PATTERN.test(normalized)) {
    return undefined;
  }

  const digits = normalized.replace(/[,\u066c\s]/g, '');
  const amount = BigInt(digits);
  return amount <= MAX_SAFE_AMOUNT ? Number(amount) : undefined;
}

export function formatTomanAmountInput(value: string): string {
  const normalized = toAsciiDigits(value);
  if (!/^[\d,\u066c\s]*$/.test(normalized)) return normalized;

  const digits = normalized.replace(/[,\u066c\s]/g, '');
  if (!digits) return '';
  if (parseTomanAmount(normalized) === undefined) return normalized;
  return new Intl.NumberFormat('fa-IR').format(BigInt(digits));
}
