/**
 * The civil flag of Spain (red, yellow, red in 1:2:1) without the coat of arms, drawn as SVG instead of
 * the flag emoji, which Windows browsers show as the letters "ES". It marks the app as being about the
 * Spanish test and carries no information of its own, so it is hidden from screen readers.
 */
export function Flag() {
  return (
    <svg class="flag" viewBox="0 0 3 2" width="1.5em" height="1em" aria-hidden="true" focusable="false">
      <rect width="3" height="2" fill="#aa151b" />
      <rect y="0.5" width="3" height="1" fill="#f1bf00" />
    </svg>
  );
}
