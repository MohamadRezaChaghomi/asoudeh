export interface JalaliDate {
  year: number;
  month: number;
  day: number;
}

function parseJalaliMonthKey(monthKey: string): { month: number; year: number } {
  const match = /^(0[1-9]|1[0-2])-(\d{4})$/.exec(monthKey);
  const month = Number(match?.[1]);
  const year = Number(match?.[2]);
  if (!match || year < 1200 || year > 1600) {
    throw new RangeError('Invalid Jalali month.');
  }
  return { month, year };
}

export function formatJalaliYear(year: number): string {
  if (!Number.isInteger(year) || year < 0) {
    throw new RangeError('Invalid Jalali year.');
  }
  return new Intl.NumberFormat('fa-IR', {
    useGrouping: false,
    minimumIntegerDigits: 4,
    maximumFractionDigits: 0,
  }).format(year);
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

export function getCurrentJalaliMonthKey(): string {
  const { year, month } = getJalaliParts(getTehranTodayIso());
  return `${String(month).padStart(2, '0')}-${year}`;
}

export function shiftJalaliMonthKey(monthKey: string, delta: -1 | 1): string {
  const { month: currentMonth, year: currentYear } = parseJalaliMonthKey(monthKey);
  const timestamp = Date.UTC(currentYear, currentMonth - 1 + delta, 1);
  const date = new Date(timestamp);
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const year = date.getUTCFullYear();
  return year < 1200 || year > 1600 ? monthKey : `${month}-${year}`;
}

export function isCurrentOrFutureJalaliMonth(monthKey: string): boolean {
  const month = parseJalaliMonthKey(monthKey);
  const current = parseJalaliMonthKey(getCurrentJalaliMonthKey());
  return month.year > current.year || (month.year === current.year && month.month >= current.month);
}

export function formatJalaliMonth(monthKey: string): string {
  const { month, year } = parseJalaliMonthKey(monthKey);
  const firstDay = jalaliToGregorianIso({ year, month, day: 1 });
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${firstDay}T00:00:00.000Z`));
}
