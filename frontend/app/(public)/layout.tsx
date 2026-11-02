import { PublicPagesLayout } from '@/components/public/PublicPagesLayout';

export default function PublicLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <PublicPagesLayout>{children}</PublicPagesLayout>;
}
