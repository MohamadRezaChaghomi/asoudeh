export function decimalIntegerToBigInt(value: string): bigint {
  const match = /^(-?)(\d+)(?:\.(\d+))?(?:[eE]([+-]?\d+))?$/.exec(value);
  if (!match) {
    throw new Error('A financial total was not represented as a decimal number.');
  }

  const [, sign, whole, fraction = '', exponentText = '0'] = match;
  const exponent = Number(exponentText);
  const digits = `${whole}${fraction}`;
  const scale = fraction.length - exponent;

  if (scale <= 0) {
    return BigInt(`${sign}${digits}${'0'.repeat(-scale)}`);
  }
  if (scale >= digits.length) {
    if ([...digits].some((digit) => digit !== '0')) {
      throw new Error('A financial total was not an integer.');
    }
    return 0n;
  }

  const fractionalDigits = digits.slice(-scale);
  if ([...fractionalDigits].some((digit) => digit !== '0')) {
    throw new Error('A financial total was not an integer.');
  }

  return BigInt(`${sign}${digits.slice(0, -scale)}`);
}
