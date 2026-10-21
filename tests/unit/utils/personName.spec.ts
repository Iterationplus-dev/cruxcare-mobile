import { describe, expect, it } from 'vitest';
import { formatPersonName } from '@/utils/personName';

describe('formatPersonName', () => {
  it.each([
    ['EMMANUEL NSE FRED', 'Emmanuel Nse Fred'],
    ['linda okoro', 'Linda Okoro'],
    ['Joe Mawuko', 'Joe Mawuko'],
    ['  utitofon   akpan ', 'Utitofon Akpan'],
    ['ADE-BAYO OGUN', 'Ade-Bayo Ogun'],
    ["mary o'neil", "Mary O'Neil"],
    ['DOUGLAS JR.', 'Douglas Jr.'],
    ['john smith iii', 'John Smith III'],
  ])('%s → %s', (input, expected) => {
    expect(formatPersonName(input)).toBe(expected);
  });

  it('leaves a word with its own mixed case alone', () => {
    expect(formatPersonName('ronald McDonald')).toBe('Ronald McDonald');
  });

  it('is empty for no name', () => {
    expect(formatPersonName(null)).toBe('');
    expect(formatPersonName(undefined)).toBe('');
  });
});
