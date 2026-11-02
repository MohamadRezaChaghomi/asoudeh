import { PublicStaticPage, publicPageMetadata } from '@/components/public/PublicStaticPage';
import { publicPages } from '@/lib/publicPages/content';

export const metadata = publicPageMetadata(publicPages.guide);

export default function GuidePage() {
  return <PublicStaticPage page={publicPages.guide} />;
}
