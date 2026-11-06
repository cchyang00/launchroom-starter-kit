import {campaign, type CampaignPacket} from '~/content/templates';
import {demoService} from '~/content/demo-service';
import {SUPPORT_EMAIL} from '~/content/site';

/**
 * Everything the help chat may say, built from our own content: the bound
 * product packet (product details, FAQ, guarantee) and the service terms the
 * Delivery and Returns pages show. Swap the packet and the chat follows.
 * Discounts and sale prices are left out on purpose: the page and checkout
 * show them, and the chat must never quote one.
 */
export function helpChatKnowledge(
  packet: CampaignPacket = campaign,
  isSample = false,
) {
  const currency = packet.offer?.currency ?? 'USD';
  const money = (value: number) =>
    new Intl.NumberFormat(currency === 'CAD' ? 'en-CA' : 'en-US', {
      style: 'currency',
      currency,
      maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
    }).format(value);
  const lines: string[] = [];
  const add = (heading: string, items: (string | undefined | null)[]) => {
    const kept = items.filter((item): item is string => Boolean(item?.trim()));
    if (kept.length) lines.push('', `## ${heading}`, ...kept.map((i) => `- ${i}`));
  };
  const flat = (text?: string) => (text ?? '').replace(/\s+/g, ' ').trim();

  lines.push(
    `Store: Merrivy (merrivy.com), a small online store selling one product: ${flat(packet.navLabel)}.`,
    `Support email: ${SUPPORT_EMAIL}. A person answers; include the order number for order questions.`,
  );
  if (isSample)
    lines.push(
      'Orders: the store is not taking orders yet. Checkout says so, no card is asked for and nothing is charged.',
    );
  add('The product', [
    flat(packet.hero?.headline),
    ...(packet.hero?.benefits ?? []).map((b) => flat(b.text)),
    flat(packet.purchase?.description),
  ]);
  // Regular pack prices from the packet's catalog (the planned Shopify
  // prices, the same ones the page and the bag show). Never a discount.
  const catalog = packet.catalog;
  add(
    'Prices (the page and the bag show the same; never quote a discount)',
    (catalog?.variants ?? []).map(
      (v) =>
        `${Object.values(v.options ?? {}).join(' / ') || flat(catalog?.title)}: ${money(v.price)}`,
    ),
  );
  const fit = packet.fitCheck;
  add(
    fit?.heading ? `${flat(fit.eyebrow || 'Fit check')} (on the product page)` : 'Fit check',
    fit
      ? [
          flat(fit.intro),
          ...(fit.steps ?? []).map((s) => `${flat(s.title)} ${flat(s.text)}`),
          flat(fit.note),
        ]
      : [],
  );
  add(
    'Details and specs',
    (packet.specs?.items ?? []).map((s) => `${flat(s.label)}: ${flat(s.value)}`),
  );
  add(
    'In the box',
    (packet.inTheBox?.items ?? []).map(
      (i) => `${flat(i.qty)} ${flat(i.name)}${i.text ? ` (${flat(i.text)})` : ''}`,
    ),
  );
  add(
    'How to use',
    (packet.howToUse?.steps ?? []).map((s) => `${flat(s.title)}: ${flat(s.text)}`),
  );
  add(
    'Questions and answers',
    (packet.faq?.items ?? []).map((q) => `Q: ${flat(q.question)} A: ${flat(q.answer)}`),
  );
  add('Delivery (see /delivery)', [
    'We deliver within the United States.',
    `Orders are prepared in ${demoService.processing}, then take ${demoService.transit} in transit. Business days exclude weekends and public holidays. These are the only timings; never promise a specific date.`,
    demoService.freeShippingAt <= 0
      ? 'Shipping is free on every order. The shipping amount shows at checkout before paying.'
      : `Standard shipping is ${money(demoService.shippingFee)}; orders with a merchandise subtotal of ${money(demoService.freeShippingAt)} or more ship free. The shipping amount shows at checkout before paying.`,
    'When an order ships we email its tracking link. Allow up to two business days for the carrier’s first scan. If an estimated arrival has passed, contact support with the order number.',
    'Address changes: contact support as soon as possible; changes may not be possible once an order has shipped.',
  ]);
  add('Returns (see /returns)', [
    flat(packet.guarantee?.days ? packet.guarantee.text : ''),
    `Request a return within ${demoService.returnDays} days of delivery by emailing support with the order number, the item and the reason. Wait for return instructions and the return address before sending anything.`,
    demoService.returnConditionText,
    demoService.returnShipping,
    'Wrong or damaged item: email support with a description and clear photos; we cover return shipping for a confirmed wrong or damaged item and arrange a replacement or refund.',
    demoService.exchange.heading
      ? `${demoService.exchange.heading} ${demoService.exchange.text}`
      : '',
  ]);
  add('Pages', [
    'Help and contact: /help (the Help tab in the top header — has topic-grouped FAQs at /help#faq, order tracking at /track, shipping timings at /delivery, 30-day return instructions at /returns, and a direct message contact form at /help#contact).',
    'Help and contact: /help. Delivery: /delivery. Returns: /returns. Privacy: /privacy. Terms: /terms. Our story: /about.',
  ]);
  return lines.join('\n').trim();
}
