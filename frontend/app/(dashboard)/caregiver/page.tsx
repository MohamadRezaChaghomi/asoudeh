'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { PageSkeleton } from '@/components/ui/PageSkeleton';
import { api, ensureCsrfToken } from '@/lib/api/client';

type Permission = 'VIEW_SUMMARY' | 'VIEW_TRANSACTIONS' | 'VIEW_REPORTS';
type LinkStatus = 'pending' | 'active' | 'revoked';

interface CaregiverLink {
  id: string;
  seniorId: string;
  caregiverPhone: string;
  status: LinkStatus;
  permissions: Permission[];
}

interface IncomingInvitation extends CaregiverLink {
  seniorName: string;
}

interface AccessibleSenior {
  seniorId: string;
  seniorName: string;
  permissions: Permission[];
}

interface CaregiverData {
  links: CaregiverLink[];
  invitations: IncomingInvitation[];
  seniors: AccessibleSenior[];
}

interface ApiErrorBody {
  error?: { message?: string };
}

const permissionLabels: Record<Permission, string> = {
  VIEW_SUMMARY: 'مشاهدهٔ خلاصهٔ مالی',
  VIEW_TRANSACTIONS: 'مشاهدهٔ تراکنش‌ها',
  VIEW_REPORTS: 'مشاهدهٔ گزارش‌ها',
};

function errorMessage(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    return error.response?.data.error?.message ?? 'ارتباط با سرور برقرار نشد. دوباره تلاش کنید.';
  }
  return 'خطای پیش‌بینی‌نشده‌ای رخ داد. دوباره تلاش کنید.';
}

export default function CaregiverPage() {
  const router = useRouter();
  const [data, setData] = useState<CaregiverData>({ links: [], invitations: [], seniors: [] });
  const [phone, setPhone] = useState('');
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [actionId, setActionId] = useState<string>();
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadData = useCallback(async () => {
    const [links, invitations, seniors] = await Promise.all([
      api.get<{ success: true; data: { links: CaregiverLink[] } }>('/caregiver/links'),
      api.get<{ success: true; data: { invitations: IncomingInvitation[] } }>('/caregiver/invitations'),
      api.get<{ success: true; data: { seniors: AccessibleSenior[] } }>('/caregiver/seniors'),
    ]);
    setData({
      links: links.data.data.links,
      invitations: invitations.data.data.invitations,
      seniors: seniors.data.data.seniors,
    });
  }, []);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      setError('');
      try {
        const [links, invitations, seniors] = await Promise.all([
          api.get<{ success: true; data: { links: CaregiverLink[] } }>('/caregiver/links'),
          api.get<{ success: true; data: { invitations: IncomingInvitation[] } }>('/caregiver/invitations'),
          api.get<{ success: true; data: { seniors: AccessibleSenior[] } }>('/caregiver/seniors'),
        ]);
        if (!active) return;
        setData({
          links: links.data.data.links,
          invitations: invitations.data.data.invitations,
          seniors: seniors.data.data.seniors,
        });
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
    void load();
    return () => {
      active = false;
    };
  }, [router]);

  function togglePermission(permission: Permission) {
    setPermissions((current) =>
      current.includes(permission)
        ? current.filter((value) => value !== permission)
        : [...current, permission],
    );
  }

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setNotice('');
    if (!permissions.length) {
      setError('حداقل یک سطح دسترسی را انتخاب کنید.');
      return;
    }
    setSaving(true);
    try {
      await ensureCsrfToken();
      await api.post('/caregiver/links', { phone, permissions });
      await loadData();
      setPhone('');
      setPermissions([]);
      setNotice('دعوت ثبت شد. فرد دعوت‌شده می‌تواند پس از ورود با همین شماره، آن را بپذیرد.');
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

  async function respond(invitation: IncomingInvitation, decision: 'accept' | 'reject') {
    setError('');
    setNotice('');
    setActionId(invitation.id);
    try {
      await ensureCsrfToken();
      await api.patch(`/caregiver/invitations/${invitation.id}`, { decision });
      await loadData();
      setNotice(decision === 'accept' ? 'دعوت پذیرفته شد.' : 'دعوت رد شد.');
    } catch (actionError) {
      if (axios.isAxiosError(actionError) && actionError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(errorMessage(actionError));
    } finally {
      setActionId(undefined);
    }
  }

  async function revoke(link: CaregiverLink) {
    if (!window.confirm('دسترسی این مراقب فوراً لغو شود؟')) return;
    setError('');
    setNotice('');
    setActionId(link.id);
    try {
      await ensureCsrfToken();
      await api.delete(`/caregiver/links/${link.id}`);
      await loadData();
      setNotice('دسترسی مراقب لغو شد.');
    } catch (actionError) {
      if (axios.isAxiosError(actionError) && actionError.response?.status === 401) {
        router.replace('/login');
        return;
      }
      setError(errorMessage(actionError));
    } finally {
      setActionId(undefined);
    }
  }

  function permissionText(values: Permission[]): string {
    return values.map((value) => permissionLabels[value]).join('، ');
  }

  return (
    <main className="min-h-screen p-5 sm:p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="app-panel flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div>
            <p className="app-muted text-sm">همراهی با اجازهٔ شما</p>
            <h1 className="mt-1 text-2xl font-bold text-asoudeh-navy">مدیریت مراقب</h1>
          </div>
          <Link className="rounded-lg border border-slate-300 px-4 py-2 font-medium" href="/dashboard">
            بازگشت به داشبورد
          </Link>
        </header>

        {error && <p className="rounded-lg bg-red-50 p-3 text-red-800" role="alert">{error}</p>}
        {notice && <p className="rounded-lg bg-emerald-50 p-3 text-emerald-800" role="status">{notice}</p>}

        {loading ? (
          <PageSkeleton label="در حال بارگذاری دسترسی‌ها…" showHeader={false} variant="caregiver" />
        ) : (
          <>
            <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-bold text-asoudeh-navy">دعوت از مراقب</h2>
              <p className="app-muted mt-2">
                فرد دعوت‌شده باید دعوت را بپذیرد. دسترسی‌ها فقط برای مشاهده هستند و هر زمان قابل لغو خواهند بود.
              </p>
              <form className="mt-5 space-y-4" onSubmit={(event) => void invite(event)}>
                <div>
                  <label className="mb-1 block font-medium" htmlFor="caregiver-phone">شماره همراه مراقب</label>
                  <input
                    autoComplete="tel"
                    className="w-full rounded-lg border border-slate-300 px-4 py-3"
                    dir="ltr"
                    id="caregiver-phone"
                    inputMode="tel"
                    onChange={(event) => setPhone(event.target.value)}
                    required
                    value={phone}
                  />
                </div>
                <fieldset className="space-y-3">
                  <legend className="mb-2 font-medium">انتخاب دسترسی‌ها</legend>
                  {(Object.keys(permissionLabels) as Permission[]).map((permission) => (
                    <label className="flex min-h-11 items-center gap-3" key={permission}>
                      <input
                        checked={permissions.includes(permission)}
                        onChange={() => togglePermission(permission)}
                        type="checkbox"
                      />
                      <span>{permissionLabels[permission]}</span>
                    </label>
                  ))}
                </fieldset>
                <button
                  className="rounded-lg bg-asoudeh-teal px-5 py-3 font-semibold text-white disabled:opacity-60"
                  disabled={saving}
                  type="submit"
                >
                  {saving ? 'در حال ثبت…' : 'ثبت دعوت'}
                </button>
              </form>
              <p className="app-muted mt-4 text-sm">
                ارسال پیامک دعوت در این نسخه فعال نیست؛ شمارهٔ دعوت‌شده باید جداگانه از ثبت دعوت مطلع شود.
              </p>
            </section>

            <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-bold text-asoudeh-navy">دعوت‌های دریافتی</h2>
              {data.invitations.length === 0 ? (
                <p className="app-muted mt-4">دعوت در انتظاری ندارید.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.invitations.map((invitation) => (
                    <li className="rounded-xl border border-slate-200 p-4" key={invitation.id}>
                      <p className="font-semibold">{invitation.seniorName} شما را به‌عنوان مراقب دعوت کرده است.</p>
                      <p className="app-muted mt-1 text-sm">{permissionText(invitation.permissions)}</p>
                      <div className="mt-3 flex gap-2">
                        <button
                          className="rounded-lg bg-emerald-700 px-4 py-2 font-semibold text-white disabled:opacity-60"
                          disabled={actionId === invitation.id}
                          onClick={() => void respond(invitation, 'accept')}
                          type="button"
                        >
                          پذیرفتن
                        </button>
                        <button
                          className="rounded-lg border border-slate-300 px-4 py-2 font-semibold disabled:opacity-60"
                          disabled={actionId === invitation.id}
                          onClick={() => void respond(invitation, 'reject')}
                          type="button"
                        >
                          رد کردن
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-bold text-asoudeh-navy">دعوت‌ها و دسترسی‌های من</h2>
              {data.links.length === 0 ? (
                <p className="app-muted mt-4">هنوز دعوتی ثبت نکرده‌اید.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.links.map((link) => (
                    <li className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 p-4" key={link.id}>
                      <div>
                        <p className="font-semibold" dir="ltr">{link.caregiverPhone}</p>
                        <p className="app-muted mt-1 text-sm">{permissionText(link.permissions)}</p>
                        <p className="mt-1 text-sm">
                          وضعیت: {link.status === 'pending' ? 'در انتظار پذیرش' : link.status === 'active' ? 'فعال' : 'لغوشده'}
                        </p>
                      </div>
                      {link.status !== 'revoked' && (
                        <button
                          className="rounded-lg border border-rose-300 px-4 py-2 font-semibold text-rose-800 disabled:opacity-60"
                          disabled={actionId === link.id}
                          onClick={() => void revoke(link)}
                          type="button"
                        >
                          لغو دسترسی
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="app-panel rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <h2 className="text-xl font-bold text-asoudeh-navy">حساب‌هایی که به آن‌ها دسترسی دارم</h2>
              {data.seniors.length === 0 ? (
                <p className="app-muted mt-4">دسترسی فعالی برای مراقبت از حساب دیگری ندارید.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {data.seniors.map((senior) => (
                    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 p-4" key={senior.seniorId}>
                      <div>
                        <p className="font-semibold">{senior.seniorName}</p>
                        <p className="app-muted mt-1 text-sm">{permissionText(senior.permissions)}</p>
                      </div>
                      <Link
                        className="rounded-lg border border-slate-300 px-4 py-2 font-semibold"
                        href={`/caregiver/${senior.seniorId}`}
                      >
                        مشاهدهٔ مجاز
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
