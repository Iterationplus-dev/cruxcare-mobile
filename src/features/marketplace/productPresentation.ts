const SMALL_TITLE_WORDS = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'the', 'to', 'via']);

function capitalize(word: string): string {
  return word
    .split(/([-/])/)
    .map((part) => (part === '-' || part === '/' ? part : `${part.charAt(0).toUpperCase()}${part.slice(1)}`))
    .join('');
}

/** Normalizes legacy all-caps and inconsistent product names for display only. */
export function formatProductTitle(value: string): string {
  const words = value.trim().replace(/\s+/g, ' ').toLocaleLowerCase().split(' ');
  if (!words[0]) return '';

  return words
    .map((word, index) => {
      const isEdgeWord = index === 0 || index === words.length - 1;
      return !isEdgeWord && SMALL_TITLE_WORDS.has(word) ? word : capitalize(word);
    })
    .join(' ');
}
