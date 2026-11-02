export interface AssistantKnowledgeItem {
  id: string;
  question: string;
  answer: string;
  href: string;
}

export const assistantKnowledge: readonly AssistantKnowledgeItem[] = [
  {
    id: 'login',
    question: 'چطور وارد حساب شوم؟',
    answer:
      'شماره همراه را در صفحه ورود وارد کنید و کد یک‌بارمصرف ارسال‌شده را در صفحه تأیید بنویسید. اگر برای این شماره حسابی وجود نداشته باشد، برای تکمیل ثبت‌نام نام نمایشی خواسته می‌شود.',
    href: '/faq',
  },
  {
    id: 'otp',
    question: 'کد یک‌بارمصرف چه زمانی منقضی می‌شود؟',
    answer:
      'کد ورود پس از پنج دقیقه منقضی می‌شود و فقط یک بار قابل استفاده است. محدودیت ارسال دوباره و تعداد تلاش‌های ناموفق نیز اعمال می‌شود.',
    href: '/faq',
  },
  {
    id: 'transactions',
    question: 'چطور درآمد یا هزینه ثبت کنم؟',
    answer:
      'از صفحه تراکنش‌ها گزینه ثبت تراکنش را انتخاب کنید و نوع، مبلغ، دسته‌بندی و تاریخ را وارد کنید. یادداشت اختیاری است.',
    href: '/guide',
  },
  {
    id: 'budget',
    question: 'بودجه‌ها برای چه دوره‌ای تعریف می‌شوند؟',
    answer:
      'بودجه‌ها ماهانه و برای دسته‌بندی‌های انتخابی تعریف می‌شوند. مبلغ مصرف‌شده بر پایه هزینه‌های ثبت‌شده در همان دوره محاسبه می‌شود.',
    href: '/faq',
  },
  {
    id: 'reports',
    question: 'گزارش ماهانه بر چه اساسی محاسبه می‌شود؟',
    answer:
      'گزارش درآمد و هزینه از تراکنش‌هایی ساخته می‌شود که در آسوده ثبت کرده‌اید؛ برنامه در نسخه فعلی اطلاعات را از حساب بانکی دریافت نمی‌کند.',
    href: '/faq',
  },
  {
    id: 'reminders',
    question: 'یادآورها چه نوع تکراری دارند؟',
    answer:
      'می‌توانید یادآور بدون تکرار، ماهانه یا سالانه بسازید. برای یادآور، مبلغ نیز در صورت نیاز قابل ثبت است.',
    href: '/faq',
  },
  {
    id: 'caregiver',
    question: 'همراه چه اطلاعاتی را می‌تواند ببیند؟',
    answer:
      'دسترسی همراه فقط پس از پذیرش دعوت فعال می‌شود و خواندنی است. اطلاعات قابل مشاهده به مجوزهایی بستگی دارد که برای آن همراه فعال شده‌اند؛ دسترسی را می‌توانید از بخش همراهان لغو کنید.',
    href: '/faq',
  },
  {
    id: 'bank',
    question: 'آیا آسوده به حساب بانکی متصل می‌شود؟',
    answer:
      'خیر. امکانات فعلی بر پایه اطلاعاتی است که خودتان در برنامه ثبت می‌کنید و اتصال بانکی خودکار در نسخه فعلی وجود ندارد.',
    href: '/faq',
  },
];

const stopWords = new Set([
  'از',
  'با',
  'برای',
  'در',
  'را',
  'شد',
  'شود',
  'یک',
  'چه',
  'چطور',
  'چگونه',
  'که',
  'می',
  'من',
  'و',
  'آسوده',
  'آیا',
  'خودکار',
  'دارد',
]);

function tokenize(value: string): string[] {
  return value
    .normalize('NFKC')
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[\u064B-\u065F\u0670\u200c]/g, ' ')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 1 && !stopWords.has(token));
}

export function findRelevantKnowledge(question: string): AssistantKnowledgeItem[] {
  const terms = new Set(tokenize(question));
  if (!terms.size) return [];

  return assistantKnowledge
    .map((item) => ({
      item,
      score: tokenize(`${item.question} ${item.answer}`).reduce(
        (score, token) => score + (terms.has(token) ? 1 : 0),
        0,
      ),
    }))
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ item }) => item);
}
