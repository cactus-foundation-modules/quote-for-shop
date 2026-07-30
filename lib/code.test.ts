import { describe, expect, it } from 'vitest'
import {
  formatQuoteCode,
  generateQuoteCode,
  looksLikeQuoteCode,
  normaliseQuoteCode,
  QUOTE_CODE_ALPHABET,
  QUOTE_CODE_LENGTH,
} from '@/modules/quote-for-shop/lib/code'

describe('quote codes', () => {
  it('generates readable codes from the unambiguous alphabet only', () => {
    for (let i = 0; i < 200; i++) {
      const code = generateQuoteCode()
      expect(code).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/)
      const bare = code.replace('-', '')
      expect(bare).toHaveLength(QUOTE_CODE_LENGTH)
      for (const ch of bare) expect(QUOTE_CODE_ALPHABET).toContain(ch)
      expect(looksLikeQuoteCode(code)).toBe(true)
    }
  })

  it('excludes every look-alike character in both directions', () => {
    for (const ch of ['0', 'O', '1', 'I', 'L', '2', 'Z', '5', 'S', '8', 'B']) {
      expect(QUOTE_CODE_ALPHABET).not.toContain(ch)
    }
  })

  it('accepts a code typed back in any case, spacing or punctuation', () => {
    expect(normaliseQuoteCode('acdefghj')).toBe('ACDE-FGHJ')
    expect(normaliseQuoteCode('ACDE-FGHJ')).toBe('ACDE-FGHJ')
    expect(normaliseQuoteCode('  acde fghj  ')).toBe('ACDE-FGHJ')
    expect(normaliseQuoteCode('ACDE_FGHJ')).toBe('ACDE-FGHJ')
  })

  it('drops characters no code can contain rather than guessing at them', () => {
    // A shopper typing an O has typed something that is in no code at all: both O
    // and 0 are excluded, so there is nothing to fold it onto. Dropping it makes
    // the lookup miss, which beats guessing and handing over the wrong basket.
    expect(normaliseQuoteCode('ACDEFGHO')).toBe('ACDE-FGH')
    expect(looksLikeQuoteCode(normaliseQuoteCode('ACDEFGHO'))).toBe(false)
  })

  it('rejects codes of the wrong length', () => {
    expect(looksLikeQuoteCode('ACDE-FGH')).toBe(false)
    expect(looksLikeQuoteCode('ACDE-FGHJK')).toBe(false)
    expect(looksLikeQuoteCode('')).toBe(false)
  })

  it('formats short input without inventing a separator', () => {
    expect(formatQuoteCode('AC')).toBe('AC')
    expect(formatQuoteCode('ACDE')).toBe('ACDE')
    expect(formatQuoteCode('ACDEF')).toBe('ACDE-F')
  })
})
