const KEY = 'glorieta.splash-seen';

export function hasSeenSplash(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    // Storage blocked: treat as seen, so the splash never becomes a wall people cannot get past.
    return true;
  }
}

export function markSplashSeen() {
  try {
    localStorage.setItem(KEY, '1');
  } catch {
    // The next visit may show the splash again; nothing is lost.
  }
}
