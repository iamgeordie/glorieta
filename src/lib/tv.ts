const KEY = 'glorieta-tv';

/**
 * TV mode (bigger type, a banner that clears the browser's own toolbar) is opt-in: open the site with `?tv`
 * once and it is remembered on that device; `?tv=0` turns it off. A recording on a monitor stays compact.
 */
export function applyTvMode() {
  const asked = new URLSearchParams(location.search).get('tv');
  let on = asked !== null && asked !== '0' && asked !== 'off';
  try {
    if (asked !== null) localStorage.setItem(KEY, on ? '1' : '0');
    else on = localStorage.getItem(KEY) === '1';
  } catch {
    // Storage blocked: the query alone decides for this page load.
  }
  document.documentElement.classList.toggle('tv', on);
}

/** True in TV mode. Billing stays off the TV entirely. */
export const isTv = (): boolean => document.documentElement.classList.contains('tv');
