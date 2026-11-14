import { bi } from './i18n';

/** Interface text for the support plan, in both languages. */
export const b = {
  navSupport: bi('Apoyar', 'Support'),
  title: bi('Apoya Glorieta', 'Support Glorieta'),
  free: bi(
    'Glorieta es gratis y lo seguirá siendo: todas las preguntas, lecciones, simulacros y vocabulario son para todo el mundo, con o sin plan. El código y el contenido son abiertos.',
    'Glorieta is free and will stay free: every question, lesson, mock exam and word list is for everyone, with or without a plan. The code and the content are open.',
  ),
  paysFor: bi(
    'Si te ha ayudado, un plan de apoyo paga el alojamiento, la revisión de las preguntas cuando cambian las normas de la DGT y las lecciones nuevas.',
    'If it has helped you, a support plan pays for hosting, for reviewing the questions when the DGT rules change, and for new lessons.',
  ),
  perks: bi('A cambio, una insignia de mecenas en tu cuenta y nuestro agradecimiento.', 'In return, a supporter badge on your account and our thanks.'),
  monthly: bi('Mensual', 'Monthly'),
  annual: bi('Anual', 'Annual'),
  perMonth: bi('al mes', 'a month'),
  perYear: bi('al año', 'a year'),
  choose: bi('Elegir', 'Choose'),
  signInFirst: bi('Inicia sesión para empezar un plan de apoyo.', 'Sign in to start a support plan.'),
  signInButton: bi('Iniciar sesión', 'Sign in'),
  stripeNote: bi(
    'El pago lo gestiona Stripe. Puedes cambiar de tarjeta, pasar de mensual a anual o cancelar cuando quieras, sin escribir a nadie.',
    'Stripe handles the payment. You can change card, switch between monthly and annual, or cancel whenever you like, without writing to anyone.',
  ),
  loadingPlans: bi('Cargando los planes…', 'Loading the plans…'),
  redirecting: bi('Abriendo Stripe…', 'Opening Stripe…'),
  active: bi('Tienes un plan de apoyo activo. ¡Gracias!', 'You have an active support plan. Thank you!'),
  manage: bi('Gestionar mi plan', 'Manage my plan'),
  manageHint: bi('Cambia de tarjeta, de plan o cancélalo en Stripe.', 'Change card or plan, or cancel it, in Stripe.'),
  thanks: bi(
    '¡Gracias por apoyar Glorieta! Tu insignia de mecenas aparecerá en cuanto Stripe confirme el pago, normalmente en unos segundos.',
    'Thank you for supporting Glorieta! Your supporter badge appears as soon as Stripe confirms the payment, usually within seconds.',
  ),
  cancelled: bi('No se ha hecho ningún cargo. Puedes volver cuando quieras.', 'Nothing was charged. You can come back whenever you like.'),
  badge: bi('Mecenas', 'Supporter'),
  cardTitle: bi('Plan de apoyo', 'Support plan'),
  cardNone: bi('No tienes un plan de apoyo. Todo Glorieta es gratis igualmente.', 'You have no support plan. All of Glorieta is free anyway.'),
  cardSee: bi('Ver los planes', 'See the plans'),
  eraseNote: bi(
    'Si tienes un plan de apoyo, borrar tus datos lo cancela en Stripe al momento.',
    'If you have a support plan, deleting your data cancels it in Stripe at once.',
  ),
};
