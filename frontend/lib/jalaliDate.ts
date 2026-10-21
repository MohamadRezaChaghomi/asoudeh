export interface JalaliDate {
  year: number;
  month: number;
  day: number;
}

const persianPartsFormatter = new Intl.DateTimeFormat('en-US-u-ca-persian-nu-latn', {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
  timeZone: 'UTC',
});

const monthStartCache = new Map<string, string>();

export function getJalaliParts(isoDate: string): JalaliDate {
  const date = new Date(`${isoDate}T00:00:00.000Z`);
  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== isoDate
  ) {
    throw new RangeError('Invalid Gregorian date.');
  }

  const parts = persianPartsFormatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);
  return { year: value('year'), month: value('month'), day: value('day') };
}

function getJalaliMonthStart(year: number, month: number): string {
  const key = `${year}-${month}`;
  const cached = monthStartCache.get(key);
  if (cached) return cached;

  const firstPossibleDate = Date.UTC(year + 621, 2, 1);
  const lastPossibleDate = Date.UTC(year + 622, 3, 30);
  for (let timestamp = firstPossibleDate; timestamp <= lastPossibleDate; timestamp += 86_400_000) {
    const date = new Date(timestamp);
    const isoDate = date.toISOString().slice(0, 10);
    const parts = getJalaliParts(isoDate);
    if (parts.year === year && parts.month === month && parts.day === 1) {
      monthStartCache.set(key, isoDate);
      return isoDate;
    }
  }

  throw new RangeError('Invalid Jalali month.');
}

export function jalaliToGregorianIso({ year, month, day }: JalaliDate): string {
  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    year < 1200 ||
    year > 1600 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31
  ) {
    throw new RangeError('Invalid Jalali date.');
  }

  const monthStart = getJalaliMonthStart(year, month);
  const timestamp = Date.parse(`${monthStart}T00:00:00.000Z`) + (day - 1) * 86_400_000;
  const isoDate = new Date(timestamp).toISOString().slice(0, 10);
  const actual = getJalaliParts(isoDate);
  if (actual.year !== year || actual.month !== month || actual.day !== day) {
    throw new RangeError('Invalid Jalali date.');
  }
  return isoDate;
}

export function getJalaliMonthDays(year: number, month: number): string[] {
  const days: string[] = [];
  for (let day = 1; day <= 31; day += 1) {
    try {
      days.push(jalaliToGregorianIso({ year, month, day }));
    } catch (error) {
      if (error instanceof RangeError) break;
      throw error;
    }
  }
  return days;
}

export function getTehranTodayIso(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'Asia/Tehran',
  }).formatToParts(new Date());
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? '';
  return `${value('year')}-${value('month')}-${value('day')}`;
}
