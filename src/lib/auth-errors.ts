import type { Bi } from '../i18n';

const bi = (es: string, en: string): Bi => ({ es, en });

/**
 * Turns a Supabase auth error into a message in both languages. Known codes get
 * a plain explanation. Anything else is shown with its code, so a new failure is
 * visible and traceable instead of hidden behind a generic message.
 */
const known: Record<string, Bi> = {
  invalid_credentials: bi('Correo o contraseña incorrectos.', 'Wrong email or password.'),
  email_not_confirmed: bi('Aún no has confirmado tu correo. Revisa tu bandeja de entrada.', 'You have not confirmed your email yet. Check your inbox.'),
  user_already_exists: bi('Ya existe una cuenta con ese correo. Prueba a iniciar sesión.', 'An account with that email already exists. Try signing in.'),
  weak_password: bi('La contraseña es demasiado débil o aparece en filtraciones conocidas. Elige otra.', 'That password is too weak or appears in known leaks. Choose another.'),
  same_password: bi('La nueva contraseña debe ser distinta de la actual.', 'The new password must differ from the current one.'),
  email_address_invalid: bi('Ese correo no es válido.', 'That email address is not valid.'),
  validation_failed: bi('Revisa los datos del formulario.', 'Check the form details.'),
  signup_disabled: bi('El registro está desactivado ahora mismo.', 'Sign-up is turned off right now.'),
  over_request_rate_limit: bi('Demasiados intentos. Espera un momento y vuelve a probar.', 'Too many attempts. Wait a moment and try again.'),
  over_email_send_rate_limit: bi('Se han enviado demasiados correos. Espera unos minutos.', 'Too many emails were sent. Wait a few minutes.'),
  otp_expired: bi('El enlace ha caducado. Pide uno nuevo.', 'The link has expired. Request a new one.'),
  session_not_found: bi('Tu sesión ha caducado. Inicia sesión de nuevo.', 'Your session has expired. Sign in again.'),
};

export function describeAuthError(err: unknown): Bi {
  const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code?: unknown }).code ?? '') : '';
  const hit = code ? known[code] : undefined;
  if (hit) return hit;
  // Supabase auth errors are Error instances; PostgREST errors are plain objects with a message.
  const message =
    err instanceof Error
      ? err.message
      : typeof err === 'object' && err !== null && 'message' in err
        ? String((err as { message?: unknown }).message ?? '')
        : String(err);
  const detail = [code, message].filter(Boolean).join(': ');
  return bi(`No se pudo completar la acción (${detail}).`, `The action could not be completed (${detail}).`);
}
