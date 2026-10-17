/**
 * Where someone who opens the bare address should land: the welcome splash, unless they are signed in,
 * in which case straight to the home screen. Pure, so the rule can be tested; App.tsx acts on it.
 */
export type LandingStatus = 'disabled' | 'loading' | 'out' | 'in';
export type Landing = 'wait' | 'home' | 'splash';

export function landingFor(input: { status: LandingStatus; storedSession: boolean }): Landing {
  switch (input.status) {
    case 'in':
      return 'home';
    case 'out':
    case 'disabled':
      return 'splash';
    case 'loading':
      // Sign-in is still being worked out. With no saved session on this device there is nothing to wait for;
      // with one, wait for Supabase to say whether it is still good.
      return input.storedSession ? 'wait' : 'splash';
  }
}

/** True when Supabase has left a session in this browser (it may be expired; only the server can say). */
export function hasStoredSession(): boolean {
  try {
    for (let i = 0; i < localStorage.length; i++) {
      if (/^sb-.+-auth-token$/.test(localStorage.key(i) ?? '')) return true;
    }
  } catch {
    // Storage blocked: there is no session we could restore.
  }
  return false;
}
