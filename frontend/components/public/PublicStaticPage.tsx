import Link from 'next/link';
import type { Metadata } from 'next';
import type { PublicPageContent } from '@/lib/publicPages/content';

export function publicPageMetadata(page: PublicPageContent): Metadata {
  return {
    title: `${page.title.replace(/ آسوده$/, '')} | آسوده`,
    description: page.description,
  };
}

export function PublicStaticPage({ page }: { page: PublicPageContent }) {
  return (
    <main className="public-main" id="public-main">
      <article className="public-article">
        <nav aria-label="مسیر صفحه" className="public-breadcrumbs">
          <Link href="/">صفحه اصلی</Link>
          <span aria-hidden="true">/</span>
          <span aria-current="page">{page.title}</span>
        </nav>

        <header className="public-page-heading">
          <p className="public-eyebrow">آسوده · اطلاعات و راهنما</p>
          <h1>{page.title}</h1>
          <p className="public-page-description">{page.description}</p>
          {page.notice && (
            <aside className="public-notice" role="note">
              <strong>یادآوری</strong>
              <p>{page.notice}</p>
            </aside>
          )}
        </header>

        {page.sections.length > 5 && (
          <details className="public-toc">
            <summary>فهرست مطالب</summary>
            <nav aria-label="فهرست مطالب این صفحه">
              <ol>
                {page.sections.map((section) => (
                  <li key={section.id}>
                    <Link href={`#${section.id}`}>{section.title}</Link>
                  </li>
                ))}
              </ol>
            </nav>
          </details>
        )}

        <div className="public-content">
          {page.sections.map((section) => (
            <section aria-labelledby={`${section.id}-heading`} id={section.id} key={section.id}>
              <h2 id={`${section.id}-heading`}>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
              {section.items && (
                section.ordered ? (
                  <ol>
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ol>
                ) : (
                  <ul>
                    {section.items.map((item) => <li key={item}>{item}</li>)}
                  </ul>
                )
              )}
              {section.links && (
                <ul className="public-section-links">
                  {section.links.map((link) => (
                    <li key={link.href}>
                      <Link href={link.href}>{link.label}</Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>

        {page.relatedLinks.length > 0 && (
          <nav aria-label="صفحات مرتبط" className="public-related-links">
            <h2>مطالب مرتبط</h2>
            <ul>
              {page.relatedLinks.map((link) => (
                <li key={link.href}>
                  <Link href={link.href}>{link.label}</Link>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </article>
    </main>
  );
}
