import { toBritish } from './data/british';

/** The British wording of an English gloss, labelled "UK" so American readers know why it is there. Renders nothing when it matches. */
export function Uk({ en }: { en: string }) {
  const uk = toBritish(en);
  if (!uk) return null;
  return (
    <span class="uk" lang="en-GB" title="British English" aria-label={`British English: ${uk}`}>
      <abbr title="British English">UK</abbr> {uk}
    </span>
  );
}
