/**
 * Capitalize the first letter of every word. Same rule as the "Aa" button on TTC's
 * own form: TTC requires title-cased story and author names.
 */
export function toTitleCase(text: string): string {
  return text.replace(
    /(^|[\s([{"“‘«])(\p{Ll})/gu,
    (_match, lead: string, letter: string) => lead + letter.toLocaleUpperCase('vi'),
  );
}
