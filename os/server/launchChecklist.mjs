import { promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

// The Launch Checklist (owner, Nov 4): "Checklist is the place where I get to see
// all the ads we're going to run and everything about how the site looks ... we
// cannot launch if those checklists aren't completed to ensure we have no bugs.
// Once those launch checklists are all 10 out of 10, we know, 'Okay we're good to go.'"
// Draft v1, for the owner to adjust; workflow/LAUNCH-CHECKLIST.md explains each item.
// `maps` names the CHECKS.md gates each item covers.
export const LAUNCH_CHECKLIST_VERSION = 'v3-7point-store-shopify-amy-2026-11-04';
export const LAUNCH_CHECKLIST = [
  { id: 'phone', group: '1 · Storefront, Copy & Upsells', title: 'Flawless Mobile Design (375px)', detail: 'Mobile hero, sticky Add-to-Cart bar, gallery photos, and sections render cleanly on a 375px phone screen with zero cut-off text or visual bugs.', maps: 'B1, B2' },
  { id: 'copy', group: '1 · Storefront, Copy & Upsells', title: 'Strong, High-Converting Copy & Angles', detail: 'Above-the-fold reveal hook, benefit bullets, comparison table, FAQs, and customer reviews use strong, high-converting buyer angles that sell the transformation.', maps: 'B2, C2' },
  { id: 'cart', group: '1 · Storefront, Copy & Upsells', title: '1-Kit / 2-Kit Upsell & $4.99 Shipping/Protection Correct', detail: 'Only 1-Kit and 2-Kit options are active (no 3-Kit tier and no physical add-on headaches), and the $4.99 shipping/protection items and cart drawer upsells are set up and displaying accurately.', maps: 'B4, B5' },
  { id: 'offer', group: '1 · Storefront, Copy & Upsells', title: 'Page Layout & Quality-of-Life Checks', detail: 'Everything on the page is laid out cleanly in the right order—spacing, badges, gallery slides, video players, reviews, and sticky bars work smoothly with zero friction.', maps: 'B1, B5' },
  { id: 'ads', group: '2 · Shopify Backend & Meta Pixel', title: 'Shopify Admin Product, Variants & Descriptions Correct', detail: 'Shopify Admin has the right product title, descriptions, photos, and active 1-Kit / 2-Kit variants and prices synced to the Online Store (Shopify payment runs naturally from this).', maps: 'B1, B4' },
  { id: 'pixel', group: '2 · Shopify Backend & Meta Pixel', title: 'Meta Pixel Connected Correctly with Shopify', detail: 'Meta Pixel (955359040485060) and Shopify CAPI are connected and firing ViewContent, AddToCart, InitiateCheckout, and Purchase.', maps: 'L3' },
  { id: 'test-sheet', group: '3 · Supplier Check', title: 'Checked with Amy / Exists on CJ to Source', detail: 'Confirmed with Amy or verified the exact product exists on CJdropshipping so she or the supplier can source and fulfill it as orders come in.', maps: 'P2, P3' },
];

const fail = (status, message, code = 'INVALID_INPUT') => Object.assign(new Error(message), { status, code });
const PRODUCT_ID = /^[PL]\d{3,}$/;
const PACKET = /^[a-z0-9][a-z0-9-]{0,80}\.json$/;

export function createLaunchChecklists({ root }) {
  const file = path.join(root, 'os', 'data', 'launch-checklists.json');
  let queue = Promise.resolve();
  async function read() {
    try {
      const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
      return { revision: Number(parsed.revision) || 0, products: parsed.products && typeof parsed.products === 'object' ? parsed.products : {} };
    } catch (error) {
      if (error.code === 'ENOENT') return { revision: 0, products: {} };
      throw fail(500, 'os/data/launch-checklists.json is unreadable. Repair it before ticking items; nothing was reset.', 'CORRUPT_DATA');
    }
  }
  async function view() {
    return { version: LAUNCH_CHECKLIST_VERSION, items: LAUNCH_CHECKLIST, ...(await read()) };
  }
  /** Tick or untick one item, or link the product's page packet. Agents can't tick the owner's go. */
  async function save(input = {}, { agent = false } = {}) {
    const productId = String(input.productId || '').trim();
    if (!PRODUCT_ID.test(productId)) throw fail(400, 'Name the product as P### or L###.');
    const run = queue.catch(() => {}).then(async () => {
      const state = await read();
      const record = state.products[productId] || { items: {} };
      record.items ||= {};
      if (input.packet !== undefined) {
        if (input.packet !== '' && !PACKET.test(String(input.packet))) throw fail(400, 'Pick a product page file (name.json).');
        record.packet = String(input.packet);
      }
      if (input.itemId !== undefined) {
        const item = LAUNCH_CHECKLIST.find(entry => entry.id === input.itemId);
        if (!item) throw fail(400, 'That is not a Launch Checklist item.');
        if (item.ownerOnly && agent) throw fail(403, 'Only the owner ticks "Owner says go". The manager records it with os.mjs owner-said when the owner says it in chat.', 'OWNER_DECISION_ONLY');
        const note = String(input.note ?? record.items[item.id]?.note ?? '').trim().slice(0, 600);
        if (input.done && agent && !note) throw fail(400, 'An agent ticks an item only with its evidence in the note (what was checked, where it is saved).', 'EVIDENCE_REQUIRED');
        record.items[item.id] = { done: Boolean(input.done), note, by: agent ? 'agent' : 'owner', at: new Date().toISOString() };
      }
      state.products[productId] = record;
      state.revision += 1;
      await fs.mkdir(path.dirname(file), { recursive: true });
      const temporary = `${file}.${randomUUID()}.tmp`;
      await fs.writeFile(temporary, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
      await fs.rename(temporary, file);
    });
    queue = run;
    await run;
    return view();
  }
  return { view, save };
}
