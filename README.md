# آسوده (Asoudeh)

سامانه مدیریت مالی شخصی با تمرکز بر تجربه کاربری سالمندان.

## Stack
- Frontend: Next.js + TypeScript + Tailwind CSS
- Backend: Node.js + Express.js + TypeScript
- Database: MongoDB + Mongoose
- API: REST
- Validation: Zod
- Testing: Vitest / Supertest / Playwright
- Git: GitHub

## ساختار
- `frontend/` رابط کاربری
- `backend/` API و منطق سمت سرور
- `docs/` مستندات پروژه
- `scripts/` اسکریپت‌های کمکی

## شروع سریع
پیش‌نیاز: Node.js `22.14.0` یا جدیدتر و MongoDB محلی. نسخه پایه Node در `.nvmrc` مشخص شده است.

1. اگر فایل‌های محیطی محلی از قبل وجود ندارند، `backend/.env.example` را به `backend/.env` و `frontend/.env.example` را به `frontend/.env.local` کپی کن.
2. مقدارهای محلی را فقط در فایل‌های محیطی خودت تنظیم کن؛ هرگز آن‌ها را commit نکن.
3. وابستگی‌ها را از ریشه نصب کن: `npm run install:all`
4. در دو ترمینال جدا اجرا کن: `npm run dev:backend` و `npm run dev:frontend`
5. Frontend: http://localhost:3000
6. Backend: http://localhost:5000
7. Health check: http://localhost:5000/api/v1/health

## بررسی کیفیت
- `npm run typecheck`
- `npm run lint`
- `npm run test:backend`
- `npm run build:backend`
- `npm run build:frontend`
- برای تست اتصال DB، دستورهای ایزوله‌شده در `docs/ENVIRONMENT.md` را اجرا کن.

## اصل توسعه
احراز هویت و پروفایل کاربر پیاده‌سازی شده‌اند. ادامهٔ MVP شامل تراکنش‌ها، دسته‌بندی‌ها، بودجه، یادآورها، گزارش‌ها و قابلیت مراقب است؛ این بخش‌ها هنوز پیاده‌سازی نشده‌اند.
قابلیت‌های OCR، Voice و Chatbot در نسخهٔ فعلی پیاده‌سازی نشده‌اند و در فازهای بعدی قابل بررسی هستند.

## Git
پیشنهاد branch:
- `main`: نسخه پایدار
- `develop`: توسعه
- `feature/*`: هر قابلیت مستقل

## وضعیت
زیرساخت فرانت‌اند و بک‌اند، health endpoint، ثبت‌نام و ورود با OTP، نشست‌ها و ویرایش پروفایل در کد موجودند. صفحه‌های داشبورد، تراکنش‌ها، بودجه، یادآورها، گزارش‌ها و مراقب و APIهای مربوط به آن‌ها هنوز placeholder یا برنامه‌ریزی‌شده‌اند؛ وجود مدل به‌تنهایی به معنی فعال‌بودن API نیست.

سرویس پیامک واقعی متصل نشده است. شبیه‌ساز OTP فقط در development و با فعال‌سازی صریح قابل استفاده است؛ ارسال OTP در production در دسترس نیست و API پاسخ unavailable می‌دهد. بنابراین ورود پیامکی برای استفادهٔ production آماده نیست.
