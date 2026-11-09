'use client';

import { FormEvent, KeyboardEvent, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Bot, MessageCircle, Send, X } from 'lucide-react';
import { api, ensureCsrfToken } from '@/lib/api/client';
import { getApiErrorMessage } from '@/lib/api/errorMessage';

interface AssistantStatusResponse {
  data: { available: boolean };
}

interface AssistantMessageResponse {
  data: {
    answer: string;
    source?: { label: string; href: string };
  };
}

interface ChatMessage {
  id: number;
  role: 'user' | 'assistant' | 'error';
  text: string;
  source?: { label: string; href: string };
}

export function AssistantWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [availability, setAvailability] = useState<'idle' | 'loading' | 'available' | 'unavailable'>(
    'idle',
  );
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const nextId = useRef(0);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const transcriptRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    let active = true;
    setAvailability('loading');
    void api
      .get<AssistantStatusResponse>('/assistant/status')
      .then((response) => {
        if (active) {
          setAvailability(response.data.data.available ? 'available' : 'unavailable');
        }
      })
      .catch(() => {
        if (active) setAvailability('unavailable');
      });

    return () => {
      active = false;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const launcher = launcherRef.current;
    const panel = document.getElementById('assistant-panel');
    const firstFocusable = panel?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    );
    if (inputRef.current && !inputRef.current.disabled) inputRef.current.focus();
    else firstFocusable?.focus();

    function manageDialogKeys(event: globalThis.KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setIsOpen(false);
        return;
      }
      if (event.key !== 'Tab') return;

      const panel = document.getElementById('assistant-panel');
      const focusable = panel?.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable?.length) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    window.addEventListener('keydown', manageDialogKeys);
    return () => {
      window.removeEventListener('keydown', manageDialogKeys);
      if (previouslyFocused?.isConnected) previouslyFocused.focus();
      else launcher?.focus();
    };
  }, [isOpen]);

  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight });
  }, [messages, sending]);

  function appendMessage(next: Omit<ChatMessage, 'id'>) {
    nextId.current += 1;
    setMessages((current) => [...current, { ...next, id: nextId.current }]);
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const submittedMessage = message.trim();
    if (!submittedMessage || sending || availability !== 'available') return;

    setMessage('');
    setSending(true);
    appendMessage({ role: 'user', text: submittedMessage });
    try {
      await ensureCsrfToken();
      const response = await api.post<AssistantMessageResponse>('/assistant/messages', {
        message: submittedMessage,
      });
      appendMessage({
        role: 'assistant',
        text: response.data.data.answer,
        source: response.data.data.source,
      });
    } catch (error) {
      setMessage(submittedMessage);
      appendMessage({
        role: 'error',
        text: getApiErrorMessage(error),
      });
    } finally {
      setSending(false);
    }
  }

  function submitOnEnter(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    }
  }

  return (
    <div className="assistant-widget">
      {isOpen && (
        <section
          aria-labelledby="assistant-title"
          aria-modal="true"
          className="assistant-panel"
          id="assistant-panel"
          role="dialog"
        >
          <header className="assistant-panel-header">
            <Bot aria-hidden="true" className="assistant-header-icon" size={20} />
            <div>
              <h2 id="assistant-title">راهنمای آسوده</h2>
              <p>
                {availability === 'available'
                  ? 'پاسخ‌گویی به پرسش‌های راهنمای برنامه'
                  : 'دستیار متصل نیست'}
              </p>
            </div>
            <button
              aria-label="بستن دستیار"
              className="assistant-close"
              onClick={() => setIsOpen(false)}
              type="button"
            >
              <X aria-hidden="true" size={20} />
            </button>
          </header>

          <p className="assistant-privacy-note">
            آسوده مکالمه را ذخیره نمی‌کند. اگر سرویس فعال باشد، پیام برای پاسخ به ارائه‌دهندهٔ تنظیم‌شده
            فرستاده می‌شود؛ اطلاعات مالی یا شخصی نفرستید.
          </p>

          {availability === 'loading' && (
            <p className="assistant-status" role="status">
              در حال بررسی دسترسی…
            </p>
          )}
          {availability === 'unavailable' && (
            <p className="assistant-status" role="status">
              این دستیار هنوز برای سامانه پیکربندی نشده است. در این پنجره پاسخ خودکار ساخته نمی‌شود.
            </p>
          )}

          <div
            aria-label="گفت‌وگو"
            aria-live="polite"
            className="assistant-transcript"
            ref={transcriptRef}
            role="log"
          >
            {messages.length === 0 && availability === 'available' && (
              <p className="assistant-welcome">
                دربارهٔ امکانات و راهنمای استفاده از آسوده بپرسید.
              </p>
            )}
            {messages.map((item) => (
              <article className={`assistant-message is-${item.role}`} key={item.id}>
                <p>{item.text}</p>
                {item.source && (
                  <Link href={item.source.href}>{item.source.label}</Link>
                )}
              </article>
            ))}
            {sending && (
              <p className="assistant-status" role="status">
                در حال دریافت پاسخ…
              </p>
            )}
          </div>

          <form className="assistant-form" onSubmit={sendMessage}>
            <label className="sr-only" htmlFor="assistant-message">
              پرسش شما
            </label>
            <textarea
              disabled={availability !== 'available' || sending}
              id="assistant-message"
              maxLength={1000}
              onChange={(event) => setMessage(event.target.value)}
              onKeyDown={submitOnEnter}
              placeholder="پرسش خود را بنویسید…"
              ref={inputRef}
              rows={2}
              value={message}
            />
            <button
              aria-label="ارسال پرسش"
              disabled={availability !== 'available' || sending || !message.trim()}
              type="submit"
            >
              <Send aria-hidden="true" size={18} />
            </button>
          </form>
        </section>
      )}

      <button
        aria-controls="assistant-panel"
        aria-expanded={isOpen}
        aria-label={isOpen ? 'بستن راهنمای آسوده' : 'بازکردن راهنمای آسوده'}
        className="assistant-launcher"
        onClick={() => setIsOpen((open) => !open)}
        ref={launcherRef}
        type="button"
      >
        {isOpen ? <X aria-hidden="true" size={22} /> : <MessageCircle aria-hidden="true" size={22} />}
        <span>راهنمای آسوده</span>
      </button>
    </div>
  );
}
