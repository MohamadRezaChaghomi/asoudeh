# API Contract

Base URL:
`/api/v1`

## Health
GET `/health`

## Auth
POST `/auth/login`
POST `/auth/logout`
GET `/me`

## Transactions
GET `/transactions`
POST `/transactions`
PATCH `/transactions/:id`
DELETE `/transactions/:id`

## Categories
GET `/categories`
POST `/categories`

## Budgets
GET `/budgets`
POST `/budgets`
PATCH `/budgets/:id`
DELETE `/budgets/:id`

## Reminders
GET `/reminders`
POST `/reminders`
PATCH `/reminders/:id`
DELETE `/reminders/:id`

## Reports
GET `/reports/summary`

## Caregiver
GET `/caregiver/links`
POST `/caregiver/links`
DELETE `/caregiver/links/:id`

Response convention:
`{ success, data, message, meta }`

Error convention:
`{ success: false, error: { code, message, details? } }`
