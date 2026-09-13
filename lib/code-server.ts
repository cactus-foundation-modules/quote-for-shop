import { randomInt } from 'crypto'
import { QUOTE_CODE_ALPHABET, QUOTE_CODE_LENGTH, formatQuoteCode } from '@/modules/quote-for-shop/lib/code'

// The half of the quote code rules that needs Node. Kept apart from code.ts so
// that the client components which format and check codes never import `crypto`
// - see the note in code.ts for what that import cost every page.

/** A fresh code, formatted the way it is shown to shoppers: two groups of four
 *  separated by a hyphen, which is what makes an 8-character string readable. */
export function generateQuoteCode(): string {
  let raw = ''
  // randomInt, not Math.random: a guessable code is a link to somebody else's
  // basket, name and email address.
  for (let i = 0; i < QUOTE_CODE_LENGTH; i++) raw += QUOTE_CODE_ALPHABET[randomInt(0, QUOTE_CODE_ALPHABET.length)]
  return formatQuoteCode(raw)
}
