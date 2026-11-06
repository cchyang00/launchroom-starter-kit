// Keep this short list tied to the canonical store checklist. These are checks
// an agent can advance before a product is selected; the checklist owns status.
const PRE_PRODUCT_IDS = ['D02','D03','D06','E04','E07','E06','C05','E08'];
const OWNER_DEPENDENCY_IDS = ['F06','E03','E05','M02'];

// One concrete next check per open store row. Completion still comes only from
// the canonical launch checklist and its evidence, never from this display.
export const PRE_PRODUCT_NEXT = {
  D02: 'Apply the prepared mark privately; inspect header, favicon and email branding on desktop/mobile.',
  D03: 'Review the full home, About, contact, header and footer journey in the private theme.',
  D06: 'Finish the shared cart/popup/template audit; leave real-product content for the selected product.',
  E04: 'Check support details and prove contact-form delivery with an owner-controlled test.',
  E07: 'Review the saved notification previews; prove delivery and links with an approved test order later.',
  E06: 'Review Shop reminders, Messaging overlap and consent/opt-out behavior for the intended market.',
  C05: 'Confirm statement/contact settings now; finish totals and methods with the real offer.',
  E08: 'Name the order/support operator and rehearse one exception using the saved SOP.',
};

export const PRE_PRODUCT_LABEL = {
  D02: 'Brand and email logo',
  D03: 'Private storefront shell',
  D06: 'Shared theme safety',
  E04: 'Support contact route',
  E07: 'Order notifications',
  E06: 'Privacy and reminders',
  C05: 'Payment baseline',
  E08: 'Order and support owner',
};

export function storePreflight(groups = []) {
  const items = groups.flatMap(group => group.items || []);
  const byId = new Map(items.map(item => [item.id, item]));
  return {
    now: PRE_PRODUCT_IDS.map(id => byId.get(id)).filter(item => item && !item.done),
    owner: OWNER_DEPENDENCY_IDS.map(id => byId.get(id)).filter(item => item && !item.done),
    later: items.filter(item => !item.done && !PRE_PRODUCT_IDS.includes(item.id) && !OWNER_DEPENDENCY_IDS.includes(item.id)),
  };
}
