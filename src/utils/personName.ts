/**
 * Shows a person's name in name case — "EMMANUEL NSE FRED" and
 * "linda okoro" become "Emmanuel Nse Fred" and "Linda Okoro" — so a list
 * reads uniformly whatever was typed at signup.
 *
 * Only words typed all in capitals or all in lowercase are re-cased. A word
 * with its own mix ("McDonald", "DeShawn") was almost certainly written that
 * way on purpose, and re-casing it would get it wrong. Each part after a
 * hyphen or apostrophe is capitalised ("Ade-Bayo", "O'Neil"), and roman
 * numerals stay in capitals ("III"). Display only: what is stored is untouched.
 */
const ROMAN_NUMERAL = /^(i{2,3}|iv|vi{0,3}|ix|x)$/i;

function caseWord(word: string): string {
  const letters = word.replace(/[^\p{L}]/gu, '');
  const uniform = letters === letters.toUpperCase() || letters === letters.toLowerCase();
  if (!letters || !uniform) return word;
  if (ROMAN_NUMERAL.test(word.replace(/\.$/, ''))) return word.toUpperCase();

  return word
    .toLowerCase()
    .replace(/(^|[-'’])(\p{L})/gu, (_, before: string, letter: string) => before + letter.toUpperCase());
}

export function formatPersonName(name: string | null | undefined): string {
  if (!name) return '';
  return name.trim().split(/\s+/).map(caseWord).join(' ');
}
