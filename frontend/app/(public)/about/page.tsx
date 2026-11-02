import { PublicStaticPage, publicPageMetadata } from '@/components/public/PublicStaticPage';
import { publicPages } from '@/lib/publicPages/content';

export const metadata = publicPageMetadata(publicPages.about);

export default function AboutPage() {
  return <PublicStaticPage page={publicPages.about} />;
}
