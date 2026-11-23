import { getQuoteConfigCached } from '@/modules/quote-for-shop/lib/config'
import { SaveCartQuoteButton } from '@/modules/quote-for-shop/components/public/SaveCartQuoteButton'
import { ActiveQuotePanel } from '@/modules/quote-for-shop/components/public/ActiveQuotePanel'

// The second control this module contributes to shop's `shop.cart-header-actions`
// point: "Save cart as a quote", beside "Retrieve quote" on the basket's heading
// row.
//
// It is here rather than left purely as a block for the same reason the retrieve
// control is: a feature nobody can find is a feature nobody has. An owner who would
// rather put it somewhere else (in the totals column, next to the checkout button)
// turns this off in Shop settings > Quotes and places the block instead.
//
// The button hides itself on an empty basket, so a shopper with nothing in it sees
// only the heading.
export async function SaveCartHeaderAction() {
  const config = await getQuoteConfigCached()
  const showSave = config.saveCartEnabled && config.showSaveOnCart
  // Wrapped in the quote panel: once the basket has come from a quote, the
  // customer can view and download THAT quote here, and the save button drops
  // to a smaller "save as a new one" beneath it. With no quote involved the
  // panel renders the button alone, exactly as before. The panel shows even on
  // a shop that has switched the save button off: the quote is still theirs.
  return (
    <ActiveQuotePanel pdfEnabled={config.pdfEnabled} pdfLabel={config.pdfButtonLabel}>
      {showSave && (
        <SaveCartQuoteButton
          label={config.saveCartLabel}
          requireEmail={config.requireEmailToSave}
          pdfEnabled={config.pdfEnabled}
          pdfLabel={config.pdfButtonLabel}
        />
      )}
    </ActiveQuotePanel>
  )
}
