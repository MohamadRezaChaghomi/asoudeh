export const SESSION_HINT_KEY = 'asoudeh.authenticated';
const SESSION_HINT_EVENT = 'asoudeh-session-hint-change';
const PUBLIC_RETURN_PATH_KEY = 'asoudeh.publicReturnPath';
const PROTECTED_ROUTE_PREFIXES = [
  '/dashboard',
  '/transactions',
  '/categories',
  '/budgets',
  '/reminders',
  '/reports',
  '/caregiver',
  '/settings',
];

export function setSessionHint(isAuthenticated: boolean): void {
  if (isAuthenticated) {
    window.localStorage.setItem(SESSION_HINT_KEY, 'true');
  } else {
    window.localStorage.removeItem(SESSION_HINT_KEY);
    try {
      window.sessionStorage.removeItem(PUBLIC_RETURN_PATH_KEY);
    } catch (error) {
      console.error('Could not clear the public-page return path.', error);
    }
  }
  window.dispatchEvent(new Event(SESSION_HINT_EVENT));
}

export function hasSessionHint(): boolean {
  return window.localStorage.getItem(SESSION_HINT_KEY) === 'true';
}

export function rememberPublicReturnPath(pathname: string): void {
  if (!isProtectedPath(pathname)) return;

  try {
    window.sessionStorage.setItem(PUBLIC_RETURN_PATH_KEY, pathname);
  } catch (error) {
    console.error('Could not save the public-page return path.', error);
  }
}

export function getPublicReturnPath(): string {
  try {
    const pathname = window.sessionStorage.getItem(PUBLIC_RETURN_PATH_KEY);
    return isProtectedPath(pathname) ? pathname : '/dashboard';
  } catch (error) {
    console.error('Could not read the public-page return path.', error);
    return '/dashboard';
  }
}

function isProtectedPath(pathname: string | null): pathname is string {
  return Boolean(
    pathname &&
      !/[?#\\]/.test(pathname) &&
      PROTECTED_ROUTE_PREFIXES.some(
        (route) => pathname === route || pathname.startsWith(`${route}/`),
      ),
  );
}

export const sessionHintEvent = SESSION_HINT_EVENT;
