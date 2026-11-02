import { PublicStaticPage, publicPageMetadata } from '@/components/public/PublicStaticPage';
import { publicPages } from '@/lib/publicPages/content';

export const metadata = publicPageMetadata(publicPages.terms);

export default function TermsPage() {
  return <PublicStaticPage page={publicPages.terms} />;
}
