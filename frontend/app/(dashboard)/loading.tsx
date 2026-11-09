import { PageSkeleton } from '@/components/ui/PageSkeleton';

export default function DashboardLoading() {
  return (
    <main className="min-h-screen p-5 sm:p-6">
      <PageSkeleton label="در حال بارگذاری صفحه…" variant="dashboard" />
    </main>
  );
}
