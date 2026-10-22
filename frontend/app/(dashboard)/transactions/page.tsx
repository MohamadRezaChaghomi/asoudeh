'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { api, ensureCsrfToken } from '@/lib/api/client';
import {
  getJalaliMonthDays,
  getJalaliParts,
  getTehranTodayIso,
} from '@/lib/jalaliDate';

type TransactionType = 'income' | 'expense';
type CategoryType = TransactionType | 'both';

interface Category {
  id: string;
  name: string;
  type: CategoryType;
  isActive: boolean;
  isDefault: boolean;
}

interface Transaction {
  id: string;
  type: TransactionType;
  amount: number;
  categoryId: string;
  categoryName: string;
  date: string;
  note: string;
}

interface Pagination {
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
}

interface PendingUndo {
  id: string;
  undoExpiresAt: string;
}

interface TransactionDraft {
  version: 1;
  type: TransactionType;
  amount: string;
  categoryId: string;
  date: string;
  note: string;
  step: 1 | 2 | 3;
}

type TransactionSortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc';

interface TransactionFilters {
  search: string;
  sortBy: 'date' | 'amount';
  sortOrder: 'asc' | 'desc';
}

const DEFAULT_TRANSACTION_FILTERS: TransactionFilters = {
  search: '',
  sortBy: 'date',
  sortOrder: 'desc',
};

function isTransactionDraft(value: unknown): value is TransactionDraft {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('version' in value) ||
    value.version !== 1 ||
    !('type' in value) ||
    (value.type !== 'income' && value.type !== 'expense') ||
    !('amount' in value) ||
    typeof value.amount !== 'string' ||
    !('categoryId' in value) ||
    typeof value.categoryId !== 'string' ||
    !('date' in value) ||
    typeof value.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value.date) ||
    !('note' in value) ||
    typeof value.note !== 'string' ||
    !('step' in value) ||
    (value.step !== 1 && value.step !== 2 && value.step !== 3)
  ) {
    return false;
  }
  try {
    getJalaliParts(value.date);
    return value.date <= todayDate();
  } catch (error) {
    if (error instanceof RangeError) return false;
    throw error;
  }
}

interface ApiErrorBody {
  error?: { message?: string };
}

function toAsciiDigits(value: string): string {
  return value
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660));
}

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data.error?.message ?? 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.';
  }
  return 'خطای پیش‌بینی‌نشده‌ای رخ داد. دوباره تلاش کنید.';
}

function todayDate(): string {
  return getTehranTodayIso();
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat('fa-IR').format(amount);
}

function formatAmountInput(value: string): string {
  const normalized = toAsciiDigits(value).replace(/[^\d]/g, '');
  return normalized ? new Intl.NumberFormat('fa-IR').format(Number(normalized)) : '';
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    dateStyle: 'medium',
    timeZone: 'UTC',
  }).format(new Date(`${date}T00:00:00.000Z`));
}

function JalaliDatePicker({
  value,
  onChange,
  maxDate,
}: {
  value: string;
  onChange: (date: string) => void;
  maxDate: string;
}) {
  const selectedDate = getJalaliParts(value);
  const [visibleMonth, setVisibleMonth] = useState({
    year: selectedDate.year,
    month: selectedDate.month,
  });

  useEffect(() => {
    const parts = getJalaliParts(value);
    setVisibleMonth({ year: parts.year, month: parts.month });
  }, [value]);

  const monthDays = getJalaliMonthDays(visibleMonth.year, visibleMonth.month);
  const firstDayOffset = (new Date(`${monthDays[0]}T00:00:00.000Z`).getUTCDay() + 1) % 7;
  const monthTitle = new Intl.DateTimeFormat('fa-IR-u-ca-persian', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${monthDays[0]}T00:00:00.000Z`));

  function moveMonth(direction: -1 | 1) {
    const month = visibleMonth.month + direction;
    const nextMonth =
      month < 1
        ? { year: visibleMonth.year - 1, month: 12 }
        : month > 12
          ? { year: visibleMonth.year + 1, month: 1 }
          : { year: visibleMonth.year, month };
    if (nextMonth.year >= 1200 && nextMonth.year <= 1600) {
      setVisibleMonth(nextMonth);
    }
  }

  return (
    <div className="rounded-lg border border-slate-300 p-3" dir="rtl">
      <div className="mb-3 flex items-center justify-between">
        <button
          aria-label="ماه بعد"
          className="rounded-lg border border-slate-300 px-3 py-1"
          onClick={() => moveMonth(1)}
          type="button"
        >
          بعد
        </button>
        <p className="font-semibold" aria-live="polite">{monthTitle}</p>
        <button
          aria-label="ماه قبل"
          className="rounded-lg border border-slate-300 px-3 py-1"
          onClick={() => moveMonth(-1)}
          type="button"
        >
          قبل
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-sm">
        {['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'].map((weekday) => (
          <span className="app-muted py-1" key={weekday}>{weekday}</span>
        ))}
        {Array.from({ length: firstDayOffset }, (_, index) => (
          <span aria-hidden="true" key={`blank-${index}`} />
        ))}
        {monthDays.map((isoDate) => {
          const day = getJalaliParts(isoDate).day;
          const isSelected = isoDate === value;
          const isFuture = isoDate > maxDate;
          return (
            <button
              aria-pressed={isSelected}
              className={`rounded-lg py-2 ${
                isSelected ? 'bg-asoudeh-navy text-white' : 'hover:bg-slate-100'
              } disabled:cursor-not-allowed disabled:opacity-40`}
              disabled={isFuture}
              key={isoDate}
              onClick={() => onChange(isoDate)}
              type="button"
            >
              {new Intl.NumberFormat('fa-IR').format(day)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export default function TransactionsPage() {
  const router = useRouter();
  const [userId, setUserId] = useState<string>();
  const [draftReady, setDraftReady] = useState(false);
  const [saveDraftLocally, setSaveDraftLocally] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    pageSize: 20,
    totalItems: 0,
    totalPages: 0,
  });
  const [page, setPage] = useState(1);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [sortOption, setSortOption] = useState<TransactionSortOption>('date-desc');
  const [filters, setFilters] = useState(DEFAULT_TRANSACTION_FILTERS);
  const [type, setType] = useState<TransactionType>('expense');
  const [amount, setAmount] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [date, setDate] = useState(todayDate);
  const [note, setNote] = useState('');
  const [editingId, setEditingId] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [filtering, setFiltering] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restoringId, setRestoringId] = useState<string>();
  const [pendingUndoItems, setPendingUndoItems] = useState<PendingUndo[]>([]);
  const [currentTime, setCurrentTime] = useState(Date.now());
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const activeCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.isActive &&
          (category.type === type || category.type === 'both'),
      ),
    [categories, type],
  );
  const selectedCategory = categories.find((category) => category.id === categoryId);
  const canUseSelectedCategory =
    activeCategories.some((category) => category.id === categoryId) ||
    Boolean(
      editingId &&
        selectedCategory &&
        !selectedCategory.isActive &&
        (selectedCategory.type === type || selectedCategory.type === 'both'),
    );

  const loadData = useCallback(async (
    requestedPage = 1,
    requestedFilters: TransactionFilters = DEFAULT_TRANSACTION_FILTERS,
  ): Promise<void> => {
    const [transactionResponse, categoryResponse] = await Promise.all([
      api.get<{
        success: true;
        data: { transactions: Transaction[]; pagination: Pagination };
      }>('/transactions', {
        params: {
          page: requestedPage,
          pageSize: 20,
          sortBy: requestedFilters.sortBy,
          sortOrder: requestedFilters.sortOrder,
          ...(requestedFilters.search ? { search: requestedFilters.search } : {}),
        },
      }),
      api.get<{ success: true; data: { categories: Category[] } }>('/categories'),
    ]);
    const result = transactionResponse.data.data;
    const lastAvailablePage = Math.max(1, result.pagination.totalPages);
    if (requestedPage > lastAvailablePage) {
      setPage(lastAvailablePage);
      await loadData(lastAvailablePage, requestedFilters);
      return;
    }
    setPage(requestedPage);
    setTransactions(result.transactions);
    setPagination(result.pagination);
    setCategories(categoryResponse.data.data.categories);
  }, []);

  useEffect(() => {
    try {
      const storedItems = window.sessionStorage.getItem('asoudeh.transactionUndo.v1');
      if (!storedItems) return;
      const parsed: unknown = JSON.parse(storedItems);
      if (
        !Array.isArray(parsed) ||
        !parsed.every(
          (item) =>
            typeof item?.id === 'string' &&
            /^[0-9a-f]{24}$/i.test(item.id) &&
            typeof item?.undoExpiresAt === 'string' &&
            Number.isFinite(Date.parse(item.undoExpiresAt)),
        )
      ) {
        throw new SyntaxError('Invalid transaction undo state.');
      }
      setPendingUndoItems(
        parsed.filter((item: PendingUndo) => Date.parse(item.undoExpiresAt) > Date.now()),
      );
    } catch (storageError) {
      console.error('Unable to read pending transaction undo state.', storageError);
      setError('وضعیت بازگردانی تراکنش‌ها از حافظهٔ مرورگر خوانده نشد.');
    }
  }, []);

  useEffect(() => {
    if (!pendingUndoItems.length) return;
    const timer = window.setInterval(() => setCurrentTime(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [pendingUndoItems.length]);

  useEffect(() => {
    const requestedType = new URLSearchParams(window.location.search).get('type');
    if (requestedType === 'income' || requestedType === 'expense') {
      setType(requestedType);
    }
  }, []);

  useEffect(() => {
    let active = true;

    async function initialize() {
      setLoading(true);
      try {
        let draftError = '';
        const profileResponse = await api.get<{
          success: true;
          data: { profile: { id: string } };
        }>('/me');
        if (!active) return;
        const currentUserId = profileResponse.data.data.profile.id;
        if (!/^[0-9a-f]{24}$/i.test(currentUserId)) {
          throw new Error('شناسهٔ حساب از سرور معتبر نیست.');
        }
        setUserId(currentUserId);
        try {
          const key = `asoudeh.transactionDraft.v1.${currentUserId}`;
          const storedDraft = window.sessionStorage.getItem(key);
          if (storedDraft) {
            const draft: unknown = JSON.parse(storedDraft);
            if (!isTransactionDraft(draft)) {
              window.sessionStorage.removeItem(key);
              draftError = 'پیش‌نویس ذخیره‌شده معتبر نبود و حذف شد.';
            } else {
              setType(draft.type);
              setAmount(draft.amount);
              setCategoryId(draft.categoryId);
              setDate(draft.date);
              setNote(draft.note);
              setStep(draft.step);
              setSaveDraftLocally(true);
              setNotice('پیش‌نویس محلی این حساب بازیابی شد؛ هنوز در سرور ثبت نشده است.');
            }
          }
        } catch (storageError) {
          console.error('Unable to restore the opted-in transaction draft.', storageError);
          draftError = 'خواندن پیش‌نویس محلی ممکن نشد؛ اطلاعات سرور همچنان در دسترس است.';
        }
        setDraftReady(true);
        await loadData();
        if (!active) return;
        if (draftError) setError(draftError);
      } catch (loadError) {
        if (!active) return;
        if (axios.isAxiosError(loadError) && loadError.response?.status === 401) {
          router.replace('/login');
          return;
        }
        setError(errorMessage(loadError));
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();
    return () => {
      active = false;
    };
  }, [loadData, router]);

  useEffect(() => {
    const updateOnline = () => setIsOnline(navigator.onLine);
    updateOnline();
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    if (!draftReady || !userId) return;
    const key = `asoudeh.transactionDraft.v1.${userId}`;
    try {
      if (saveDraftLocally && !editingId) {
        const draft: TransactionDraft = {
          version: 1,
          type,
          amount,
          categoryId,
          date,
          note,
          step,
        };
        window.sessionStorage.setItem(key, JSON.stringify(draft));
      } else {
        window.sessionStorage.removeItem(key);
      }
    } catch (storageError) {
      console.error('Unable to save the opted-in transaction draft.', storageError);
      setError('ذخیرهٔ پیش‌نویس در این نشست مرورگر ممکن نشد.');
    }
  }, [amount, categoryId, date, draftReady, editingId, note, saveDraftLocally, step, type, userId]);

  useEffect(() => {
    if (!activeCategories.some((category) => category.id === categoryId)) {
      const selectedCategory = categories.find((category) => category.id === categoryId);
      if (
        editingId &&
        selectedCategory &&
        !selectedCategory.isActive &&
        (selectedCategory.type === type || selectedCategory.type === 'both')
      ) {
        return;
      }
      setCategoryId(activeCategories[0]?.id ?? '');
    }
  }, [activeCategories, categories, categoryId, editingId, type]);

  function replacePendingUndoItems(items: PendingUndo[]) {
    setPendingUndoItems(items);
    try {
      if (items.length) {
        window.sessionStorage.setItem('asoudeh.transactionUndo.v1', JSON.stringify(items));
      } else {
        window.sessionStorage.removeItem('asoudeh.transactionUndo.v1');
      }
    } catch (storageError) {
      console.error('Unable to save pending transaction undo state.', storageError);
      setError('ذخیرهٔ مهلت بازگردانی در حافظهٔ مرورگر ممکن نشد.');
    }
  }

  useEffect(() => {
    const unexpiredItems = pendingUndoItems.filter(
      (item) => Date.parse(item.undoExpiresAt) > currentTime,
    );
    if (unexpiredItems.length !== pendingUndoItems.length) {
      replacePendingUndoItems(unexpiredItems);
    }
  }, [currentTime, pendingUndoItems]);

  function resetForm() {
    setEditingId(undefined);
    setType('expense');
    setAmount('');
    setCategoryId('');
    setDate(todayDate());
    setNote('');
    setStep(1);
    setSaveDraftLocally(false);
  }

  function startEditing(transaction: Transaction) {
    setSaveDraftLocally(false);
    setEditingId(transaction.id);
    setType(transaction.type);
    setAmount(formatAmount(transaction.amount));
    setCategoryId(transaction.categoryId);
    setDate(transaction.date);
    setNote(transaction.note);
    setStep(1);
    setError('');
    setNotice('');
  }

  function validatedAmount(): number | undefined {
    setError('');
    const normalizedAmount = toAsciiDigits(amount).replace(/[,\s٬]/g, '');
    if (!/^\d+$/.test(normalizedAmount)) {
      setError('مبلغ باید عدد صحیح مثبت به تومان باشد.');
      return undefined;
    }
    const numericAmount = Number(normalizedAmount);
    if (
      !Number.isSafeInteger(numericAmount) ||
      numericAmount < 1 ||
      numericAmount > 1_000_000_000_000
    ) {
      setError('مبلغ باید بین ۱ تا ۱٬۰۰۰٬۰۰۰٬۰۰۰٬۰۰۰ تومان باشد.');
      return undefined;
    }
    return numericAmount;
  }

  function advanceStep() {
    setError('');
    if (step === 1) {
      if (validatedAmount() !== undefined) setStep(2);
      return;
    }
    if (!canUseSelectedCategory) {
      setError('برای این نوع تراکنش، دسته‌بندی فعالی انتخاب کنید.');
      return;
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || date > todayDate()) {
      setError('تاریخ انتخاب‌شده معتبر نیست.');
      return;
    }
    setStep(3);
  }

  async function saveTransaction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');

    const numericAmount = validatedAmount();
    if (numericAmount === undefined || !categoryId) {
      if (!categoryId) setError('برای این نوع تراکنش، دسته‌بندی فعالی وجود ندارد.');
      return;
    }

    setSaving(true);
    try {
      await ensureCsrfToken();
      const isEditing = Boolean(editingId);
      const payload = {
        type,
        amount: numericAmount,
        categoryId,
        date,
        ...(note.trim() ? { note: note.trim() } : {}),
      };
      if (editingId) {
        await api.patch(`/transactions/${editingId}`, payload);
      } else {
        await api.post('/transactions', payload);
      }
      resetForm();
      const refreshPage = isEditing ? page : 1;
      if (!isEditing) {
        setPage(1);
      }
      try {
        await loadData(refreshPage, filters);
      } catch (refreshError) {
        if (axios.isAxiosError(refreshError) && refreshError.response?.status === 401) {
          router.replace('/login');
          return;
        }
        setError('تراکنش ذخیره شد، اما تازه‌سازی فهرست ممکن نشد. دوباره صفحه را بارگذاری کنید.');
        return;
      }
      setNotice(isEditing ? 'تراکنش ویرایش شد.' : 'تراکنش ثبت شد.');
    } catch (saveError) {
      if (axios.isAxiosError(saveError) && saveError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(errorMessage(saveError));
    } finally {
      setSaving(false);
    }
  }

  function handleFormSubmit(event: FormEvent<HTMLFormElement>) {
    if (step < 3) {
      event.preventDefault();
      advanceStep();
      return;
    }
    void saveTransaction(event);
  }

  async function updateTransactionFilters(nextFilters: TransactionFilters) {
    if (saving || filtering) return;
    setError('');
    setNotice('');
    setFiltering(true);
    try {
      await loadData(1, nextFilters);
      setFilters(nextFilters);
    } catch (filterError) {
      if (axios.isAxiosError(filterError) && filterError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(errorMessage(filterError));
    } finally {
      setFiltering(false);
    }
  }

  function handleFilterSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const sortBy = sortOption.startsWith('amount') ? 'amount' : 'date';
    const sortOrder = sortOption.endsWith('asc') ? 'asc' : 'desc';
    void updateTransactionFilters({
      search: searchInput.trim(),
      sortBy,
      sortOrder,
    });
  }

  function clearTransactionFilters() {
    setSearchInput('');
    setSortOption('date-desc');
    void updateTransactionFilters(DEFAULT_TRANSACTION_FILTERS);
  }

  async function removeTransaction(transaction: Transaction) {
    if (!window.confirm('این تراکنش حذف شود؟')) return;

    setError('');
    setNotice('');
    setSaving(true);
    try {
      await ensureCsrfToken();
      const response = await api.delete<{
        data: { deletedAt: string; undoExpiresAt: string };
      }>(`/transactions/${transaction.id}`);
      replacePendingUndoItems([
        ...pendingUndoItems.filter(({ id }) => id !== transaction.id),
        { id: transaction.id, undoExpiresAt: response.data.data.undoExpiresAt },
      ]);
      await loadData(page, filters);
      if (editingId === transaction.id) resetForm();
      setNotice('تراکنش حذف شد. تا ۱۰ ثانیه می‌توانید آن را بازگردانید.');
    } catch (deleteError) {
      if (axios.isAxiosError(deleteError) && deleteError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(errorMessage(deleteError));
    } finally {
      setSaving(false);
    }
  }

  async function restoreTransaction(item: PendingUndo) {
    if (Date.parse(item.undoExpiresAt) <= Date.now()) {
      replacePendingUndoItems(pendingUndoItems.filter(({ id }) => id !== item.id));
      setError('مهلت بازگردانی این تراکنش به پایان رسیده است.');
      return;
    }

    setError('');
    setNotice('');
    setSaving(true);
    setRestoringId(item.id);
    try {
      await ensureCsrfToken();
      await api.post(`/transactions/${item.id}/restore`);
      replacePendingUndoItems(pendingUndoItems.filter(({ id }) => id !== item.id));
      await loadData(page, filters);
      setNotice('تراکنش بازگردانده شد.');
    } catch (restoreError) {
      if (axios.isAxiosError(restoreError) && restoreError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      if (axios.isAxiosError(restoreError) && restoreError.response?.status === 410) {
        replacePendingUndoItems(pendingUndoItems.filter(({ id }) => id !== item.id));
      }
      setError(errorMessage(restoreError));
    } finally {
      setRestoringId(undefined);
      setSaving(false);
    }
  }

  async function changePage(nextPage: number) {
    if (nextPage < 1 || nextPage > pagination.totalPages || saving) return;
    setError('');
    setLoading(true);
    try {
      await loadData(nextPage, filters);
    } catch (loadError) {
      if (axios.isAxiosError(loadError) && loadError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(errorMessage(loadError));
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <main className="min-h-screen p-5 sm:p-6">
        <PageSkeleton label="در حال بارگذاری تراکنش‌ها…" variant="transactions" />
      </main>
    );
  }

  return (
    <main className="min-h-screen p-5">
      <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)]">
        <section className="app-panel order-2 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:order-1 sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="app-muted text-sm">مدیریت مالی</p>
              <h1 className="mt-1 text-2xl font-bold text-asoudeh-navy">تراکنش‌ها</h1>
            </div>
            <Link className="rounded-lg border border-slate-300 px-4 py-2 font-medium" href="/categories">
              مدیریت دسته‌ها
            </Link>
          </div>

          {error && <p className="mt-4 rounded-lg bg-red-50 p-3 text-red-800" role="alert">{error}</p>}
          {notice && <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-emerald-800" role="status">{notice}</p>}

          {pendingUndoItems.length > 0 && (
            <ul className="mt-4 space-y-2" aria-label="تراکنش‌های حذف‌شدهٔ قابل‌بازگردانی">
              {pendingUndoItems.map((item) => {
                const secondsRemaining = Math.max(
                  0,
                  Math.ceil((Date.parse(item.undoExpiresAt) - currentTime) / 1000),
                );
                return (
                  <li
                    className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-amber-50 p-3 text-amber-950"
                    key={item.id}
                    role="status"
                  >
                    <span>برای بازگردانی {formatAmount(secondsRemaining)} ثانیه فرصت دارید.</span>
                    <button
                      className="rounded-lg border border-amber-700 px-3 py-2 font-medium disabled:opacity-50"
                      disabled={saving || restoringId === item.id || secondsRemaining === 0}
                      onClick={() => void restoreTransaction(item)}
                      type="button"
                    >
                      {restoringId === item.id ? 'در حال بازگردانی…' : 'بازگردانی'}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}

          <h2 className="mt-7 text-xl font-bold text-asoudeh-navy">فهرست تراکنش‌ها</h2>
          <form
            className="mt-4 grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-[minmax(12rem,1fr)_minmax(12rem,auto)_auto_auto]"
            onSubmit={handleFilterSubmit}
            aria-busy={filtering}
          >
            <div>
              <label className="mb-1 block font-medium" htmlFor="transaction-search">
                جست‌وجو در توضیحات یا نام گروه مالی
              </label>
              <input
                className="w-full rounded-lg border border-slate-300 bg-transparent px-3"
                id="transaction-search"
                maxLength={100}
                onChange={(event) => setSearchInput(event.target.value)}
                value={searchInput}
              />
            </div>
            <div>
              <label className="mb-1 block font-medium" htmlFor="transaction-sort">
                مرتب‌سازی فهرست
              </label>
              <select
                className="w-full rounded-lg border border-slate-300 bg-transparent px-3"
                id="transaction-sort"
                onChange={(event) => {
                  const value = event.target.value;
                  if (
                    value === 'date-desc' ||
                    value === 'date-asc' ||
                    value === 'amount-desc' ||
                    value === 'amount-asc'
                  ) {
                    setSortOption(value);
                  }
                }}
                value={sortOption}
              >
                <option value="date-desc">جدیدترین تاریخ</option>
                <option value="date-asc">قدیمی‌ترین تاریخ</option>
                <option value="amount-desc">بیشترین مبلغ</option>
                <option value="amount-asc">کمترین مبلغ</option>
              </select>
            </div>
            <button
              className="self-end rounded-lg bg-asoudeh-navy px-4 font-medium text-white disabled:opacity-60"
              disabled={filtering || saving}
              type="submit"
            >
              {filtering ? 'در حال جست‌وجو…' : 'اعمال جست‌وجو'}
            </button>
            <button
              className="self-end rounded-lg border border-slate-300 px-4 font-medium disabled:opacity-60"
              disabled={filtering || saving}
              onClick={clearTransactionFilters}
              type="button"
            >
              پاک‌کردن
            </button>
          </form>
          {transactions.length === 0 ? (
            <p className="app-muted mt-4 rounded-lg bg-slate-50 p-4">
              {filters.search
                ? 'تراکنشی با این عبارت پیدا نشد. عبارت را تغییر دهید یا فیلترها را پاک کنید.'
                : 'هنوز تراکنشی ثبت نشده است. از فرم کنار صفحه اولین مورد را ثبت کنید.'}
            </p>
          ) : (
            <ul className="mt-4 space-y-3">
              {transactions.map((transaction) => (
                <li
                  className="rounded-xl border border-slate-200 p-4"
                  key={transaction.id}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{transaction.categoryName}</p>
                      <p className="app-muted mt-1 text-sm">
                        {formatDate(transaction.date)}
                        {transaction.note ? ` · ${transaction.note}` : ''}
                      </p>
                    </div>
                    <p
                      className={`font-bold ${
                        transaction.type === 'income' ? 'text-emerald-700' : 'text-rose-700'
                      }`}
                    >
                      {transaction.type === 'income' ? '+' : '−'}
                      {formatAmount(transaction.amount)} تومان
                    </p>
                  </div>
                  <div className="mt-3 flex gap-2">
                    <button
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium"
                      disabled={saving}
                      onClick={() => startEditing(transaction)}
                      type="button"
                    >
                      ویرایش
                    </button>
                    <button
                      className="rounded-lg border border-rose-300 px-3 py-2 text-sm font-medium text-rose-800"
                      disabled={saving}
                      onClick={() => void removeTransaction(transaction)}
                      type="button"
                    >
                      حذف
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
          {pagination.totalPages > 1 && (
            <nav
              aria-label="صفحه‌بندی تراکنش‌ها"
              className="mt-5 flex items-center justify-between gap-3"
              dir="rtl"
            >
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50"
                disabled={page <= 1 || loading}
                onClick={() => changePage(page - 1)}
                type="button"
              >
                قبلی
              </button>
              <span aria-live="polite">
                صفحهٔ {formatAmount(page)} از {formatAmount(pagination.totalPages)}
                {' · '}
                {formatAmount(pagination.totalItems)} تراکنش
              </span>
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 disabled:opacity-50"
                disabled={page >= pagination.totalPages || loading}
                onClick={() => changePage(page + 1)}
                type="button"
              >
                بعدی
              </button>
            </nav>
          )}
        </section>

        <section className="app-panel order-1 h-fit rounded-2xl border border-slate-200 bg-white p-6 shadow-sm lg:order-2 sm:p-8">
          <h2 className="text-xl font-bold text-asoudeh-navy">
            {editingId ? 'ویرایش تراکنش' : 'ثبت تراکنش'}
          </h2>
          <ol className="mt-4 flex gap-2 text-sm" aria-label="مراحل ثبت تراکنش">
            {['مبلغ', 'دسته و تاریخ', 'بازبینی'].map((label, index) => (
              <li
                aria-current={step === index + 1 ? 'step' : undefined}
                className={`rounded-full px-3 py-1 ${
                  step === index + 1 ? 'bg-asoudeh-navy text-white' : 'bg-slate-100'
                }`}
                key={label}
              >
                {formatAmount(index + 1)}. {label}
              </li>
            ))}
          </ol>
          <form className="mt-5 space-y-4" onSubmit={handleFormSubmit}>
            {!isOnline && (
              <p className="rounded-lg bg-amber-50 p-3 text-amber-950" role="status">
                اتصال اینترنت برقرار نیست. ثبت یا ویرایش تراکنش تا اتصال دوباره انجام نمی‌شود.
              </p>
            )}
            {!editingId && (
              <div className="rounded-lg bg-slate-50 p-3">
                <label className="flex items-start gap-3 font-medium" htmlFor="saveTransactionDraft">
                  <input
                    checked={saveDraftLocally}
                    className="mt-1"
                    disabled={!userId}
                    id="saveTransactionDraft"
                    onChange={(event) => setSaveDraftLocally(event.target.checked)}
                    type="checkbox"
                  />
                  ذخیرهٔ موقت این پیش‌نویس در نشست فعلی مرورگر
                </label>
                <p className="app-muted mt-2 text-sm">
                  این گزینه خاموش است مگر اینکه خودتان فعالش کنید. پیش‌نویس فقط در sessionStorage همین مرورگر و برای این حساب ذخیره می‌شود؛ تا ثبت موفق باقی می‌ماند و با پایان نشست مرورگر پاک می‌شود.
                </p>
              </div>
            )}
            {step === 1 && (
              <>
                <div>
                  <label className="mb-2 block font-medium" htmlFor="transactionType">نوع</label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-4"
                    id="transactionType"
                    onChange={(event) =>
                      setType(event.target.value === 'income' ? 'income' : 'expense')
                    }
                    value={type}
                  >
                    <option value="expense">هزینه</option>
                    <option value="income">درآمد</option>
                  </select>
                </div>
                <div>
                  <label className="mb-2 block font-medium" htmlFor="transactionAmount">
                    مبلغ (تومان)
                  </label>
                  <input
                    autoComplete="off"
                    className="w-full rounded-lg border border-slate-300 bg-transparent px-4"
                    dir="ltr"
                    id="transactionAmount"
                    inputMode="numeric"
                    onChange={(event) => setAmount(formatAmountInput(event.target.value))}
                    placeholder="۲۰۰٬۰۰۰"
                    required
                    value={amount}
                  />
                </div>
              </>
            )}
            {step === 2 && (
              <>
                <div>
                  <label className="mb-2 block font-medium" htmlFor="transactionCategory">
                    دسته‌بندی
                  </label>
                  <select
                    className="w-full rounded-lg border border-slate-300 bg-white px-4"
                    disabled={!activeCategories.length}
                    id="transactionCategory"
                    onChange={(event) => setCategoryId(event.target.value)}
                    required
                    value={categoryId}
                  >
                    {activeCategories.length === 0 ? (
                      <option value="">دستهٔ فعال موجود نیست</option>
                    ) : (
                      activeCategories.map((category) => (
                        <option key={category.id} value={category.id}>{category.name}</option>
                      ))
                    )}
                    {editingId &&
                      categories.some(
                        (category) =>
                          category.id === categoryId &&
                          !category.isActive &&
                          (category.type === type || category.type === 'both'),
                      ) && (
                        <option value={categoryId}>
                          {categories.find((category) => category.id === categoryId)?.name} (غیرفعال؛ دستهٔ فعال انتخاب کنید)
                        </option>
                      )}
                  </select>
                  {!activeCategories.length && (
                    <Link className="mt-2 inline-block text-sm text-asoudeh-teal underline" href="/categories">
                      ابتدا یک دسته‌بندی فعال ایجاد کنید
                    </Link>
                  )}
                </div>
                <div>
                  <p className="mb-2 block font-medium" id="transactionDateLabel">تاریخ شمسی</p>
                  <JalaliDatePicker
                    maxDate={todayDate()}
                    onChange={setDate}
                    value={date}
                  />
                  <p className="app-muted mt-2 text-sm" aria-labelledby="transactionDateLabel">
                    {formatDate(date)}
                  </p>
                </div>
              </>
            )}
            {step === 3 && (
              <>
                <dl className="space-y-3 rounded-lg bg-slate-50 p-4">
                  <div className="flex justify-between gap-3">
                    <dt className="app-muted">نوع</dt>
                    <dd>{type === 'income' ? 'درآمد' : 'هزینه'}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="app-muted">مبلغ</dt>
                    <dd className="font-semibold">{formatAmount(Number(toAsciiDigits(amount).replace(/[^\d]/g, '')))} تومان</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="app-muted">دسته</dt>
                    <dd>{activeCategories.find((category) => category.id === categoryId)?.name ?? categories.find((category) => category.id === categoryId)?.name}</dd>
                  </div>
                  <div className="flex justify-between gap-3">
                    <dt className="app-muted">تاریخ</dt>
                    <dd>{formatDate(date)}</dd>
                  </div>
                </dl>
                <div>
                  <label className="mb-2 block font-medium" htmlFor="transactionNote">
                    توضیح (اختیاری)
                  </label>
                  <textarea
                    className="w-full rounded-lg border border-slate-300 bg-transparent px-4 py-3"
                    id="transactionNote"
                    maxLength={200}
                    onChange={(event) => setNote(event.target.value)}
                    rows={3}
                    value={note}
                  />
                </div>
              </>
            )}
            <div className="flex flex-wrap gap-3">
              {step > 1 && (
                <button
                  className="rounded-lg border border-slate-300 px-5 py-3 font-medium"
                  disabled={saving}
                  onClick={() => setStep((step - 1) as 1 | 2)}
                  type="button"
                >
                  بازگشت
                </button>
              )}
              {step < 3 ? (
                <button
                  className="rounded-lg bg-asoudeh-navy px-5 py-3 font-semibold text-white disabled:opacity-60"
                  disabled={saving || (step === 2 && !canUseSelectedCategory)}
                  onClick={(event) => {
                    event.preventDefault();
                    advanceStep();
                  }}
                  type="button"
                >
                  ادامه
                </button>
              ) : (
                <button
                  className="rounded-lg bg-asoudeh-navy px-5 py-3 font-semibold text-white disabled:opacity-60"
                  disabled={saving || !categoryId}
                  type="submit"
                >
                  {saving ? 'در حال ذخیره…' : editingId ? 'ذخیرهٔ تغییرات' : 'ثبت تراکنش'}
                </button>
              )}
              {editingId && (
                <button
                  className="rounded-lg border border-slate-300 px-5 py-3 font-medium"
                  disabled={saving}
                  onClick={resetForm}
                  type="button"
                >
                  انصراف از ویرایش
                </button>
              )}
            </div>
          </form>
        </section>
      </div>
    </main>
  );
}
