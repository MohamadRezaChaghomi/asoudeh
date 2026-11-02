import { PublicStaticPage, publicPageMetadata } from '@/components/public/PublicStaticPage';
import { publicPages } from '@/lib/publicPages/content';

export const metadata = publicPageMetadata(publicPages.privacy);

export default function PrivacyPage() {
  return <PublicStaticPage page={publicPages.privacy} />;
}
