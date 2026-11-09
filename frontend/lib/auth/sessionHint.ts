export const SESSION_HINT_KEY = 'asoudeh.authenticated';
const SESSION_HINT_EVENT = 'asoudeh-session-hint-change';

export function setSessionHint(isAuthenticated: boolean): void {
  if (isAuthenticated) {
    window.localStorage.setItem(SESSION_HINT_KEY, 'true');
  } else {
    window.localStorage.removeItem(SESSION_HINT_KEY);
  }
  window.dispatchEvent(new Event(SESSION_HINT_EVENT));
}

export function hasSessionHint(): boolean {
  return window.localStorage.getItem(SESSION_HINT_KEY) === 'true';
}

export const sessionHintEvent = SESSION_HINT_EVENT;
