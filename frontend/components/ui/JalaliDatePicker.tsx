'use client';

import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import {
  formatJalaliYear,
  getJalaliMonthDays,
  getJalaliParts,
  getTehranTodayIso,
} from '@/lib/jalaliDate';

interface JalaliDatePickerProps {
  value: string;
  onChange: (date: string) => void;
  label: string;
  maxDate?: string;
}

const WEEKDAYS = ['شنبه', 'یکشنبه', 'دوشنبه', 'سه‌شنبه', 'چهارشنبه', 'پنجشنبه', 'جمعه'];

function formatDate(value: string) {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00.000Z`));
}

function shiftIsoDate(value: string, days: number) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function JalaliDatePicker({
  value,
  onChange,
  label,
  maxDate,
}: JalaliDatePickerProps) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [focusedDate, setFocusedDate] = useState(value);
  const focusParts = getJalaliParts(focusedDate);
  const today = getTehranTodayIso();
  const days = useMemo(
    () => getJalaliMonthDays(focusParts.year, focusParts.month),
    [focusParts.month, focusParts.year],
  );
  const firstDayOffset = (new Date(`${days[0]}T00:00:00.000Z`).getUTCDay() + 1) % 7;
  const monthTitle = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${days[0]}T00:00:00.000Z`));
  const cells: Array<string | null> = [
    ...Array.from({ length: firstDayOffset }, () => null),
    ...days,
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  useEffect(() => {
    if (!open) return;
    const focusedButton = dialogRef.current?.querySelector<HTMLButtonElement>(
      `[data-date="${focusedDate}"]`,
    );
    focusedButton?.focus();
  }, [focusedDate, open]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!dialogRef.current?.contains(target) && !triggerRef.current?.contains(target)) {
        setOpen(false);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  function closePicker(returnFocus: boolean) {
    setOpen(false);
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  }

  function moveMonth(direction: -1 | 1) {
    const month = focusParts.month + direction;
    const next = month < 1
      ? { year: focusParts.year - 1, month: 12 }
      : month > 12
        ? { year: focusParts.year + 1, month: 1 }
        : { year: focusParts.year, month };
    if (next.year < 1200 || next.year > 1600) return;
    const nextDays = getJalaliMonthDays(next.year, next.month);
    const nextDay = Math.min(focusParts.day, nextDays.length);
    setFocusedDate(nextDays[nextDay - 1]);
  }

  function selectDate(date: string) {
    if (maxDate && date > maxDate) return;
    onChange(date);
    closePicker(true);
  }

  function handleCalendarKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closePicker(true);
      return;
    }
    const movement: Record<string, number> = {
      ArrowRight: -1,
      ArrowLeft: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    const shift = movement[event.key];
    if (shift !== undefined) {
      event.preventDefault();
      const nextDate = shiftIsoDate(focusedDate, shift);
      setFocusedDate(maxDate && nextDate > maxDate ? maxDate : nextDate);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      const target = event.target as HTMLElement;
      if (target.hasAttribute('data-date')) {
        event.preventDefault();
        selectDate(target.getAttribute('data-date') ?? focusedDate);
      }
      return;
    }
    if (event.key === 'Tab' && dialogRef.current) {
      const controls = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>('button:not(:disabled)'),
      );
      const first = controls[0];
      const last = controls.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }
  }

  const hasActiveDay = days.some((day) => day === focusedDate);

  return (
    <div className="jalali-date-picker relative" dir="rtl">
      <button
        aria-controls={`${label}-calendar`}
        aria-expanded={open}
        aria-haspopup="dialog"
        className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-4 text-start text-[var(--text)] shadow-sm hover:border-[var(--brand-700)]"
        onClick={() => {
          setFocusedDate(value);
          setOpen(true);
        }}
        ref={triggerRef}
        type="button"
      >
        <span>{formatDate(value)}</span>
        <span className="app-muted text-sm">تغییر تاریخ</span>
      </button>
      {open && (
        <>
          <button
            aria-label="بستن انتخاب تاریخ"
            className="jalali-calendar-backdrop"
            onClick={() => closePicker(false)}
            tabIndex={-1}
            type="button"
          />
          <div
            aria-label={label}
            aria-modal="true"
            className="jalali-calendar-popover"
            id={`${label}-calendar`}
            onKeyDown={handleCalendarKeyDown}
            ref={dialogRef}
            role="dialog"
          >
            <header className="mb-3 flex items-center justify-between gap-2">
              <button
                aria-label="ماه قبل"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--surface-muted)]"
                onClick={() => moveMonth(-1)}
                type="button"
              >
                <ChevronRight aria-hidden="true" size={20} />
              </button>
              <p aria-live="polite" className="text-center font-semibold">
                {monthTitle} {formatJalaliYear(focusParts.year)}
              </p>
              <button
                aria-label="ماه بعد"
                className="flex size-11 shrink-0 items-center justify-center rounded-lg hover:bg-[var(--surface-muted)]"
                onClick={() => moveMonth(1)}
                type="button"
              >
                <ChevronLeft aria-hidden="true" size={20} />
              </button>
            </header>
            <div className="jalali-calendar-grid" role="grid" aria-label="روزهای ماه">
              <div className="grid grid-cols-7 gap-1 text-center" role="row">
                {WEEKDAYS.map((weekday) => (
                  <span
                    className="app-muted flex min-h-10 items-center justify-center text-xs"
                    key={weekday}
                    role="columnheader"
                  >
                    {weekday}
                  </span>
                ))}
              </div>
              {Array.from({ length: cells.length / 7 }, (_, row) => (
                <div className="grid grid-cols-7 gap-1 text-center" key={`week-${row}`} role="row">
                  {cells.slice(row * 7, row * 7 + 7).map((day, column) => {
                    if (!day) return <span aria-hidden="true" key={`blank-${row}-${column}`} role="gridcell" />;
                    const dayNumber = getJalaliParts(day).day;
                    const selectedDate = day === value;
                    const isToday = day === today;
                    const isDisabled = Boolean(maxDate && day > maxDate);
                    return (
                      <span
                        aria-selected={selectedDate}
                        className="flex items-center justify-center"
                        key={day}
                        role="gridcell"
                      >
                        <button
                          aria-current={isToday ? 'date' : undefined}
                          aria-label={`${new Intl.NumberFormat('fa-IR').format(dayNumber)} ${monthTitle}`}
                          aria-pressed={selectedDate}
                          className={`relative flex min-h-11 w-full items-center justify-center rounded-lg font-medium hover:bg-[var(--surface-muted)] focus-visible:z-10 ${
                            selectedDate
                              ? 'bg-[var(--brand-action)] text-[var(--text-on-action)]'
                              : 'text-[var(--text)]'
                          } ${isToday && !selectedDate ? 'ring-2 ring-[var(--focus)] ring-inset' : ''}`}
                          data-date={day}
                          data-day={dayNumber}
                          disabled={isDisabled}
                          onClick={() => selectDate(day)}
                          tabIndex={day === focusedDate || (!hasActiveDay && day === days[0]) ? 0 : -1}
                          type="button"
                        >
                          {new Intl.NumberFormat('fa-IR').format(dayNumber)}
                          {isToday && (
                            <span
                              aria-hidden="true"
                              className="absolute bottom-1 block size-1 rounded-full bg-current"
                            />
                          )}
                        </button>
                      </span>
                    );
                  })}
                </div>
              ))}
            </div>
            {maxDate && (
              <p className="app-muted mt-3 text-center text-xs">
                امروز: {formatDate(today)}
              </p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
