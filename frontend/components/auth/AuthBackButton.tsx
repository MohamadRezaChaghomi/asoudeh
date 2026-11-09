'use client';

import { ArrowRight } from 'lucide-react';

export function AuthBackButton({ onClick }: { onClick: () => void }) {
  return (
    <button aria-label="بازگشت" className="auth-back-button" onClick={onClick} type="button">
      <ArrowRight aria-hidden="true" size={18} />
      <span>بازگشت</span>
    </button>
  );
}
