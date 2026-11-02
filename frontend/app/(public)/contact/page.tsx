import { PublicStaticPage, publicPageMetadata } from '@/components/public/PublicStaticPage';
import { publicPages } from '@/lib/publicPages/content';

export const metadata = publicPageMetadata(publicPages.contact);

export default function ContactPage() {
  return <PublicStaticPage page={publicPages.contact} />;
}
