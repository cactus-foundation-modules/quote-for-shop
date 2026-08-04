import { describe, expect, it } from 'vitest'
import { leadTimeValue, readDeliveryPromise, restateDelivery } from '@/modules/quote-for-shop/lib/delivery-timing'
import type { QuoteLine } from '@/modules/quote-for-shop/lib/types'

const promise = { detailLabel: 'Delivery', text: 'Delivered and installed', leadDays: 10 }

// `delivery` is deliberately required rather than defaulted: a default parameter
// fires on an explicit `undefined` too, which would have quietly turned the
// "quote saved before this existed" case back into the restatable one.
function lineWith(detail: QuoteLine['detail'], delivery: QuoteLine['delivery']): QuoteLine {
  return {
    productId: 'p1', name: 'Oak desk', sku: null, slug: null, imageUrl: null,
    quantity: 1, unitPrice: 100, lineTotal: 100,
    detail, lineId: null, meta: null, delivery,
  }
}

describe('readDeliveryPromise', () => {
  it('reads a namespaced resolver bag entry and names the row it belongs to', () => {
    const result = readDeliveryPromise({
      fields: [{ label: 'Delivery', value: 'Delivered and installed - by Friday 14th of August' }],
      data: { ashDelivery: { tierKey: 'installed', tierText: 'Delivered and installed', leadDays: 10, targetDate: '2026-08-14', isPreOrder: false } },
    })
    expect(result).toEqual({ detailLabel: 'Delivery', text: 'Delivered and installed', leadDays: 10 })
  })

  it('does not care which key the entry is filed under', () => {
    const result = readDeliveryPromise({
      fields: [{ label: 'Shipping', value: 'Next day - by Tuesday' }],
      data: { someOtherModule: { tierText: 'Next day', leadDays: 1 } },
    })
    expect(result).toEqual({ detailLabel: 'Shipping', text: 'Next day', leadDays: 1 })
  })

  it('leaves a pre-order alone - its date comes from stock, not from dispatch timing', () => {
    expect(readDeliveryPromise({
      fields: [{ label: 'Delivery', value: 'Standard - by Friday' }],
      data: { ashDelivery: { tierText: 'Standard', leadDays: 30, isPreOrder: true } },
    })).toBeNull()
  })

  it('ignores a bag with nothing restatable in it', () => {
    expect(readDeliveryPromise({ fields: [], data: { engraving: { text: 'For Dad' } } })).toBeNull()
    expect(readDeliveryPromise({ fields: [], data: { x: { tierText: 'Standard' } } })).toBeNull()
    expect(readDeliveryPromise({ fields: [], data: { x: { leadDays: 3 } } })).toBeNull()
    expect(readDeliveryPromise({ fields: [], data: { x: null } })).toBeNull()
    expect(readDeliveryPromise({ fields: [], data: {} })).toBeNull()
    expect(readDeliveryPromise(null)).toBeNull()
  })

  it('refuses to guess when no prose row was built from the promise', () => {
    // Nothing to replace later, so recording it would strand the figures.
    expect(readDeliveryPromise({
      fields: [{ label: 'Options', value: 'Oak / Silver legs' }],
      data: { ashDelivery: { tierText: 'Standard', leadDays: 3 } },
    })).toBeNull()
  })

  it('rounds a fractional lead time and never records a negative one', () => {
    expect(readDeliveryPromise({
      fields: [{ label: 'Delivery', value: 'Standard - by Friday' }],
      data: { ashDelivery: { tierText: 'Standard', leadDays: -2 } },
    })).toEqual({ detailLabel: 'Delivery', text: 'Standard', leadDays: 0 })
    expect(readDeliveryPromise({
      fields: [{ label: 'Delivery', value: 'Standard - by Friday' }],
      data: { ashDelivery: { tierText: 'Standard', leadDays: 2.6 } },
    })).toEqual({ detailLabel: 'Delivery', text: 'Standard', leadDays: 3 })
  })
})

describe('leadTimeValue', () => {
  it('counts working days, singular and plural', () => {
    expect(leadTimeValue(promise)).toBe('Delivered and installed - 10 working days from order')
    expect(leadTimeValue({ ...promise, leadDays: 1 })).toBe('Delivered and installed - 1 working day from order')
  })

  it('takes the owner\'s own wording after the number', () => {
    expect(leadTimeValue(promise, 'from receipt of order')).toBe('Delivered and installed - 10 working days from receipt of order')
    expect(leadTimeValue(promise, '   ')).toBe('Delivered and installed - 10 working days from order')
  })

  it('says nothing about days when there are none to count', () => {
    expect(leadTimeValue({ ...promise, leadDays: 0 })).toBe('Delivered and installed')
  })
})

describe('restateDelivery', () => {
  const detail = [
    { label: 'Options', value: 'Oak / Silver legs' },
    { label: 'Delivery', value: 'Delivered and installed - by Friday 14th of August' },
  ]

  it('replaces only the row the promise built', () => {
    expect(restateDelivery(lineWith(detail, promise), 'lead')).toEqual([
      { label: 'Options', value: 'Oak / Silver legs' },
      { label: 'Delivery', value: 'Delivered and installed - 10 working days from order' },
    ])
  })

  it('prints the quoted dates when that is what the document asks for', () => {
    expect(restateDelivery(lineWith(detail, promise), 'dates')).toEqual(detail)
    expect(restateDelivery(lineWith(detail, promise), undefined)).toEqual(detail)
  })

  it('leaves an older quote exactly as it was quoted', () => {
    // No figures were recorded when this one was saved, so there is nothing to
    // restate and nothing is invented.
    expect(restateDelivery(lineWith(detail, null), 'lead')).toEqual(detail)
    expect(restateDelivery(lineWith(detail, undefined), 'lead')).toEqual(detail)
  })
})
