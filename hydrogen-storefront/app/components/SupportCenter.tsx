import {useState} from 'react';
import {Link, useRouteLoaderData} from 'react-router';
import type {RootLoader} from '~/root';
import {siteContent, SUPPORT_EMAIL, SUPPORT_REPLY_TIME} from '~/content/site';
import {useActiveProduct, withProductParam} from '~/content/navigation';
import {isSampleCatalog} from '~/lib/store-policies';
import {Icon} from './Icons';

/**
 * Merrivy's support center pieces (October 2). Owner: "make sure our merrivy
 * site has the support system built into there ... making it legit like a
 * big brand", in a confident voice ("secure checkout, 30-day returns, and a
 * 24/7 support team"). The truth stays underneath: "24/7" appears only while
 * the help chat is live (it answers any time; the team replies by email), and
 * there are no press logos, review counts, customer numbers or awards.
 */

/** Ask the help chat bubble (when it is live) to open. */
export const OPEN_CHAT_EVENT = 'merrivy:open-help-chat';
export function openHelpChat() {
  window.dispatchEvent(new Event(OPEN_CHAT_EVENT));
}

/** Whether the help chat is live, and whether this is the sample catalog. */
export function useSupportFlags() {
  const root = useRouteLoaderData<RootLoader>('root');
  return {
    chat: Boolean(root?.helpChat),
    isSample: isSampleCatalog(root?.publicStoreDomain ?? 'mock.shop'),
  };
}

/** "24/7 support" while the chat is live; otherwise "Fast, friendly support". */
export function supportLabel(chat: boolean) {
  return chat ? '24/7 support' : 'Fast, friendly support';
}

/** The one-line support promise for help pages. */
export function supportLine(chat: boolean) {
  return chat
    ? `Our support team is here 24/7: chat with us any time, or email ${SUPPORT_EMAIL}.`
    : `Email ${SUPPORT_EMAIL}, we reply within ${SUPPORT_REPLY_TIME}.`;
}

/** Fill the {support} copy token (announcement bar, trust lists). */
export function fillSupport(text: string, chat: boolean) {
  return text.replaceAll('{support}', supportLabel(chat));
}

/** The help center's doors: where every support question starts. */
export function HelpCards() {
  const {chat} = useSupportFlags();
  const {productPath} = useActiveProduct();
  const cards = [
    {to: '/track', icon: 'truck', title: 'Track my order', text: 'See where your order is.'},
    {to: '/delivery', icon: 'box', title: 'Shipping', text: 'Rates, timing and tracking.'},
    {to: '/returns', icon: 'return', title: 'Returns & refunds', text: '30 days to change your mind.'},
    {
      to: '/help#contact',
      icon: 'chat',
      title: 'Contact us',
      text: chat ? 'Chat any time, or email us.' : `Replies within ${SUPPORT_REPLY_TIME}.`,
    },
    {to: '/help#faq', icon: 'check', title: 'FAQ', text: 'Fit, care, delivery and more.'},
  ] as const;
  return (
    <nav className="help-hub-cards" aria-label="Help topics">
      {cards.map((card) => (
        <Link key={card.to} to={withProductParam(card.to, productPath)} className="help-hub-card">
          <span className="help-hub-icon" aria-hidden="true">
            <Icon name={card.icon} size={22} />
          </span>
          <span>
            <strong>{card.title}</strong>
            <small>{card.text}</small>
          </span>
          <Icon name="arrow" size={16} />
        </Link>
      ))}
    </nav>
  );
}

/** Secure checkout · 30-day returns · 24/7 support, plus the brand promise. */
export function TrustSignals() {
  const {chat} = useSupportFlags();
  const {productPath} = useActiveProduct();
  const signals = [
    {icon: 'lock', title: 'Secure checkout', text: 'Encrypted payment on Shopify.'},
    {icon: 'return', title: '30-day returns', text: 'Change your mind within 30 days of delivery.', to: '/returns'},
    {
      icon: 'chat',
      title: supportLabel(chat),
      text: chat ? 'Chat with us any time.' : `Replies within ${SUPPORT_REPLY_TIME}.`,
    },
  ] as const;
  return (
    <section className="trust-signals" aria-label="Shopping with Merrivy">
      <ul>
        {signals.map((signal) => (
          <li key={signal.icon}>
            <Icon name={signal.icon} size={20} />
            <span>
              <strong>
                {'to' in signal ? (
                  <Link to={withProductParam(signal.to, productPath)}>{signal.title}</Link>
                ) : (
                  signal.title
                )}
              </strong>
              <small>{signal.text}</small>
            </span>
          </li>
        ))}
      </ul>
      <p className="trust-promise">{siteContent.support.promise}</p>
    </section>
  );
}

const TOPICS = ['An order', 'Shipping', 'A return or refund', 'The product', 'Something else'];

/** Build the pre-filled email the contact form opens. Nothing is sent by us. */
export function contactMailto({
  name,
  email,
  order,
  topic,
  message,
}: {
  name: string;
  email: string;
  order: string;
  topic: string;
  message: string;
}) {
  const subject = `${topic}${order.trim() ? ` · order ${order.trim()}` : ''}`;
  const details = [
    name.trim() ? `Name: ${name.trim()}` : '',
    email.trim() ? `Reply to: ${email.trim()}` : '',
    order.trim() ? `Order number: ${order.trim()}` : '',
  ].filter(Boolean);
  const body = [
    message.trim(),
    ...(details.length ? ['', '—', ...details] : []),
  ].join('\n');
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/** Contact us: the address, the reply time and a form that opens an email. */
export function ContactPanel() {
  const {chat} = useSupportFlags();
  const [opened, setOpened] = useState(false);
  return (
    <section className="help-contact-panel" id="contact">
      <span className="eyebrow">Contact us</span>
      <h2>We’re here to help.</h2>
      <p>{supportLine(chat)}</p>
      {chat && (
        <button type="button" className="button-primary" onClick={openHelpChat}>
          Chat with us now <Icon name="arrow" />
        </button>
      )}
      <h3 className="contact-form-title">Or send us a message</h3>
      <form
        className="contact-form"
        onSubmit={(event) => {
          event.preventDefault();
          const data = new FormData(event.currentTarget);
          const value = (key: string) => String(data.get(key) ?? '');
          window.location.href = contactMailto({
            name: value('name'),
            email: value('email'),
            order: value('order'),
            topic: value('topic'),
            message: value('message'),
          });
          setOpened(true);
        }}
      >
        <label>
          Your name
          <input name="name" autoComplete="name" maxLength={80} />
        </label>
        <label>
          Your email
          <input name="email" type="email" autoComplete="email" inputMode="email" maxLength={254} />
        </label>
        <label>
          Order number <small>(if you have one)</small>
          <input name="order" placeholder="#1001" maxLength={24} />
        </label>
        <label>
          What’s it about?
          <select name="topic" defaultValue={TOPICS[0]}>
            {TOPICS.map((topic) => (
              <option key={topic}>{topic}</option>
            ))}
          </select>
        </label>
        <label className="contact-form-message">
          Your message
          <textarea name="message" rows={4} required maxLength={2000} />
        </label>
        <button type="submit" className="button-primary">
          Send message <Icon name="arrow" />
        </button>
        <small role="status">
          {opened
            ? `Your message is ready in your email app. Press send and we’ll take it from there.`
            : 'Your message opens in your email app, ready to send.'}
        </small>
      </form>
    </section>
  );
}

/** "Questions? We’re here": the small help strip at the end of the product page. */
export function QuestionsStrip() {
  const {chat} = useSupportFlags();
  const {productPath} = useActiveProduct();
  return (
    <aside className="questions-strip" aria-label="Help">
      <div>
        <strong>Questions? We’re here.</strong>
        <span>
          {chat
            ? 'Our support team is here 24/7.'
            : `We reply within ${SUPPORT_REPLY_TIME}.`}
        </span>
      </div>
      <div className="questions-strip-actions">
        <Link to={withProductParam('/help', productPath)} className="questions-strip-link">
          Help center
        </Link>
        <Link to={withProductParam('/track', productPath)} className="questions-strip-link">
          Track my order
        </Link>
        {chat ? (
          <button type="button" className="questions-strip-link" onClick={openHelpChat}>
            Chat with us
          </button>
        ) : (
          <a href={`mailto:${SUPPORT_EMAIL}`} className="questions-strip-link">
            Email us
          </a>
        )}
      </div>
    </aside>
  );
}
