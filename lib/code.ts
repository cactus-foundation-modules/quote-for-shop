import { randomInt } from 'crypto'

// The retrieval code, and the only interesting thing about it: it is read off a
// phone screen, written on the back of an envelope, and dictated down a telephone
// to somebody in a warehouse. So the alphabet leaves out every character that
// gets mistaken for another when handwritten or spoken: 0 and O, 1 and I and L,
// 2 and Z, 5 and S, 8 and B.
//
// Because those are excluded in PAIRS, there is nothing to fold on the way in: a
// shopper who types an O has not typed a character that means something else
// here, since neither O nor 0 is ever in a code. Normalising therefore drops
// them, and the lookup misses - which is the honest answer, rather than guessing
// which of two codes they meant and possibly handing over somebody else's basket.
//
// 8 characters from this 25-symbol alphabet is about 1.5e11 codes. A shop holding
// 100,000 saved quotes has roughly a one-in-a-million chance of a single
// collision, and the insert retries on the unique-constraint violation anyway
// (see lib/db/quotes.ts) - so this never has to be clever, only clear.

const ALPHABET = 'ACDEFGHJKMNPQRTUVWXY34679'
const LENGTH = 8

/** A fresh code, formatted the way it is shown to shoppers: two groups of four
 *  separated by a hyphen, which is what makes an 8-character string readable. */
export function generateQuoteCode(): string {
  let raw = ''
  // randomInt, not Math.random: a guessable code is a link to somebody else's
  // basket, name and email address.
  for (let i = 0; i < LENGTH; i++) raw += ALPHABET[randomInt(0, ALPHABET.length)]
  return formatQuoteCode(raw)
}

/** Groups a bare code for display: ABCD-EFGH. */
export function formatQuoteCode(raw: string): string {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, '')
  if (clean.length <= 4) return clean
  return `${clean.slice(0, 4)}-${clean.slice(4)}`
}

/**
 * What a typed-in code is compared as: uppercase, spaces and hyphens ignored,
 * and anything outside the alphabet dropped. Returns '' when nothing usable is
 * left, which the caller treats as "not found" without troubling the database.
 */
export function normaliseQuoteCode(input: string): string {
  const kept = [...input.toUpperCase().replace(/[^A-Z0-9]/g, '')]
    .filter((ch) => ALPHABET.includes(ch))
    .join('')
  return formatQuoteCode(kept)
}

/** Cheap shape check before a database round-trip. */
export function looksLikeQuoteCode(code: string): boolean {
  const clean = code.toUpperCase().replace(/[^A-Z0-9]/g, '')
  return clean.length === LENGTH && [...clean].every((ch) => ALPHABET.includes(ch))
}

export const QUOTE_CODE_LENGTH = LENGTH
export const QUOTE_CODE_ALPHABET = ALPHABET
