export const fa = {
  glossary: {
    toman: 'تومان',
    expense: 'هزینه',
    income: 'درآمد',
    reminder: 'یادآور',
    caregiver: 'مراقب',
  },
  errors: {
    configuration: 'پیکربندی محیط معتبر نیست.',
    invalidValue: 'قالب یا مقدار واردشده معتبر نیست.',
    valueTooSmall: 'مقدار واردشده کمتر از حد مجاز است.',
    valueTooLarge: 'مقدار واردشده بیشتر از حد مجاز است.',
    unsupportedField: 'درخواست شامل فیلد پشتیبانی‌نشده است.',
    invalidChoice: 'یکی از گزینه‌های مجاز را انتخاب کنید.',
    invalidBody: 'اطلاعات واردشده معتبر نیست.',
  },
  confirmations: {
    reminderCompleted: 'انجام یادآور ثبت شد.',
    reminderArchived: 'یادآور بایگانی شد.',
    transactionDeleted: 'تراکنش حذف شد.',
  },
} as const;

export function formatZodIssueMessage(
  issue: { code: string; message: string },
): string {
  if (issue.code === 'custom' && /[\u0600-\u06FF]/u.test(issue.message)) {
    return issue.message;
  }

  if (!/[A-Za-z]/.test(issue.message)) {
    return issue.message;
  }

  if (issue.code === 'too_small') return fa.errors.valueTooSmall;
  if (issue.code === 'too_big') return fa.errors.valueTooLarge;
  if (issue.code === 'invalid_enum_value' || issue.code === 'invalid_value') {
    return fa.errors.invalidChoice;
  }
  if (issue.code === 'unrecognized_keys') return fa.errors.unsupportedField;
  return fa.errors.invalidValue;
}
