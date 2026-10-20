# آسوده (Asoudeh)

سامانه مدیریت مالی شخصی با تمرکز بر تجربه کاربری سالمندان.

## Stack
- Frontend: Next.js + TypeScript + Tailwind CSS
- Backend: Node.js + Express.js
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
1. MongoDB را آماده کن.
2. فایل‌های `.env.example` را به `.env` تبدیل و مقادیر را تنظیم کن.
3. در `backend`: `npm install` و سپس `npm run dev`
4. در `frontend`: `npm install` و سپس `npm run dev`
5. Frontend: http://localhost:3000
6. Backend: http://localhost:5000
7. Health check: http://localhost:5000/api/v1/health

## اصل توسعه
ابتدا MVP را کامل کن: Auth → Transactions → Categories → Budget → Reminder → Reports → Caregiver → Accessibility/Test.
قابلیت‌های OCR، Voice و Chatbot در Phase 2 هستند.

## Git
پیشنهاد branch:
- `main`: نسخه پایدار
- `develop`: توسعه
- `feature/*`: هر قابلیت مستقل

## وضعیت
این repository یک اسکلت آماده برای شروع کدنویسی است؛ منطق تجاری هنوز عمداً پیاده‌سازی نشده است.
