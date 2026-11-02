'use client';

import { useMemo, useState } from 'react';
import { faqGroups } from '@/lib/publicPages/faq';

function normalizeSearchText(value: string): string {
  return value
    .toLocaleLowerCase('fa')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/\u200c/g, ' ')
    .trim();
}

export function FaqSearch() {
  const [query, setQuery] = useState('');
  const [openQuestion, setOpenQuestion] = useState<string | null>(null);
  const normalizedQuery = normalizeSearchText(query);
  const visibleGroups = useMemo(
    () =>
      faqGroups
        .map((group) => ({
          ...group,
          questions: group.questions.filter((question) => {
            const searchableText = normalizeSearchText(
              `${group.title} ${question.question} ${question.answer}`,
            );
            return searchableText.includes(normalizedQuery);
          }),
        }))
        .filter((group) => group.questions.length > 0),
    [normalizedQuery],
  );
  const resultCount = visibleGroups.reduce((count, group) => count + group.questions.length, 0);

  return (
    <section aria-label="جست‌وجو در سؤالات متداول" className="public-faq">
      <div className="public-faq-search">
        <label htmlFor="faq-search">جست‌وجو در پرسش‌ها و پاسخ‌ها</label>
        <div className="public-faq-input-wrap">
          <input
            autoComplete="off"
            id="faq-search"
            onChange={(event) => {
              setQuery(event.target.value);
              setOpenQuestion(null);
            }}
            placeholder="مثلاً بودجه، یادآور یا حذف حساب"
            type="search"
            value={query}
          />
          {query && (
            <button onClick={() => setQuery('')} type="button">
              پاک‌کردن جست‌وجو
            </button>
          )}
        </div>
        <p aria-live="polite" className="public-faq-count">
          {normalizedQuery
            ? `${new Intl.NumberFormat('fa-IR').format(resultCount)} پرسش پیدا شد`
            : `${new Intl.NumberFormat('fa-IR').format(resultCount)} پرسش`}
        </p>
      </div>

      {visibleGroups.length > 0 ? (
        <div className="public-faq-groups">
          {visibleGroups.map((group) => (
            <section aria-labelledby={`faq-group-${group.id}`} key={group.id}>
              <h2 id={`faq-group-${group.id}`}>{group.title}</h2>
              <div className="public-faq-list">
                {group.questions.map((question) => {
                  const isOpen = openQuestion === question.id;
                  const answerId = `${question.id}-answer`;
                  return (
                    <article className="public-faq-item" key={question.id}>
                      <h3>
                        <button
                          aria-controls={answerId}
                          aria-expanded={isOpen}
                          className="public-faq-question"
                          onClick={() => setOpenQuestion(isOpen ? null : question.id)}
                          type="button"
                        >
                          <span>{question.question}</span>
                          <span aria-hidden="true" className="public-faq-toggle">
                            {isOpen ? '−' : '+'}
                          </span>
                        </button>
                      </h3>
                      <div
                        className="public-faq-answer"
                        hidden={!isOpen}
                        id={answerId}
                      >
                        <p>{question.answer}</p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      ) : (
        <div className="public-faq-empty" role="status">
          <h2>پرسشی پیدا نشد</h2>
          <p>عبارت دیگری را امتحان کنید یا جست‌وجو را پاک کنید تا همه پرسش‌ها نمایش داده شوند.</p>
          <button onClick={() => setQuery('')} type="button">
            پاک‌کردن جست‌وجو
          </button>
        </div>
      )}
    </section>
  );
}
