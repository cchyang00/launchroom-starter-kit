import {useEffect, useId, useRef, useState} from 'react';
import {Icon} from './Icons';
import {SUPPORT_EMAIL} from '~/content/site';
import {OPEN_CHAT_EVENT} from './SupportCenter';

/**
 * The help chat bubble and panel (October 2). Rendered only when the server
 * says the chat is live (a server-side key, and the kill switch not off). Questions go
 * to /api/help-chat, which answers only from our own content. Order tracking
 * is a scripted step here: order number, then email, then /api/order-status.
 * Order numbers and emails never go to the AI.
 */

type Line = {
  id?: number;
  from: 'shopper' | 'merrivy';
  text: string;
  tracking?: {company: string | null; number: string | null; url: string | null}[];
  statusUrl?: string | null;
};
type Stage = 'chat' | 'order' | 'email' | 'busy';

const MAX_CHARS = 500;
let lineId = 0;
const GREETING =
  'Hi! I’m Merrivy Support. Ask me anything about the 2027 planner, paper & specs, shipping, or returns — or check on an order.';
const STARTERS: {label: string; track?: boolean; href?: string}[] = [
  {label: 'Where’s my order?', track: true},
  {label: 'What comes inside the box?'},
  {label: 'Will gel pens bleed through the pages?'},
  {label: 'How do shipping & returns work?'},
  {label: 'Open Help Center →', href: '/help'},
];

type HelpAction = {href: string; label: string};

function getHelpActions(text: string, isGreeting = false): HelpAction[] {
  if (isGreeting) return [];
  const actions: HelpAction[] = [];
  const add = (href: string, label: string) => {
    if (!actions.some((a) => a.href === href)) actions.push({href, label});
  };
  if (/\/help#contact|contact form|send us a message/i.test(text)) {
    add('/help#contact', 'Open Contact Form →');
  } else if (/\/delivery|\b(ship|shipping|transit|business days|arrive)\b/i.test(text)) {
    add('/delivery', 'Shipping Details →');
  } else if (/\/returns|\b(return|refund|exchange|30[- ]day)\b/i.test(text)) {
    add('/returns', 'Returns & Refunds →');
  } else if (/\/track\b/i.test(text)) {
    add('/track', 'Track My Order →');
  }
  add('/help', 'Open Help Center →');
  return actions.slice(0, 2);
}

const INLINE_TOKEN_RE =
  /(https?:\/\/merrivy\.com\/(?:help(?:#[a-z]+)?|track|delivery|returns|about|privacy|terms)|merrivy\.com\/(?:help(?:#[a-z]+)?|track|delivery|returns)|\/(?:help(?:#[a-z]+)?|track|delivery|returns|about)\b|support@merrivy\.com)/gi;

function renderFormattedText(text: string, onNavigate: () => void) {
  const parts = text.split(INLINE_TOKEN_RE);
  return parts.map((part, idx) => {
    if (!part) return null;
    const lower = part.toLowerCase();
    if (lower === 'support@merrivy.com') {
      return (
        <a key={idx} href={`mailto:${SUPPORT_EMAIL}`}>
          {part}
        </a>
      );
    }
    if (
      lower.startsWith('/') ||
      lower.startsWith('merrivy.com/') ||
      lower.startsWith('https://merrivy.com/') ||
      lower.startsWith('http://merrivy.com/')
    ) {
      const href = lower
        .replace(/^https?:\/\/merrivy\.com/i, '')
        .replace(/^merrivy\.com/i, '');
      return (
        <a key={idx} href={href || '/help'} onClick={onNavigate}>
          {part}
        </a>
      );
    }
    return part;
  });
}
/** "Where's my order?", "track my package", "order status"... */
export const TRACK_INTENT =
  /\b(where('?s| is)? my (order|package|parcel)|track(ing)?\b.*\b(order|package|parcel|number)|order status|has my order|did my order)/i;
const ASK_ORDER =
  'I can check that. What’s your order number? It’s in your order confirmation email, like #1001.';

export function HelpChat() {
  const [open, setOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([{id: 0, from: 'merrivy', text: GREETING}]);
  // What the AI sees: questions and its own answers, never order details.
  const [history, setHistory] = useState<{role: 'user' | 'assistant'; content: string}[]>([]);
  const [stage, setStage] = useState<Stage>('chat');
  const [draft, setDraft] = useState('');
  const order = useRef('');
  const input = useRef<HTMLInputElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const panelId = useId();

  // Help pages and the product page can open the chat (openHelpChat).
  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_CHAT_EVENT, show);
    return () => window.removeEventListener(OPEN_CHAT_EVENT, show);
  }, []);
  useEffect(() => {
    if (open) input.current?.focus({preventScroll: true});
  }, [open, stage]);
  useEffect(() => {
    list.current?.scrollTo({top: list.current.scrollHeight});
  }, [lines, open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const say = (line: Line) =>
    setLines((current) => [...current, {...line, id: ++lineId}]);

  function startTracking() {
    say({from: 'merrivy', text: ASK_ORDER});
    setStage('order');
  }

  async function ask(question: string) {
    const next = [...history, {role: 'user' as const, content: question}];
    setStage('busy');
    try {
      const response = await fetch('/api/help-chat', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({messages: next}),
      });
      const data = (await response.json()) as {reply?: string; track?: boolean};
      const reply = data.reply || `Please email ${SUPPORT_EMAIL} and a person will help.`;
      say({from: 'merrivy', text: reply});
      if (response.ok)
        setHistory([...next, {role: 'assistant', content: reply}]);
      setStage(data.track ? 'order' : 'chat');
    } catch {
      say({from: 'merrivy', text: `Sorry, I hit a snag. Email ${SUPPORT_EMAIL} and our team will sort it out.`});
      setStage('chat');
    }
  }

  async function track(email: string) {
    setStage('busy');
    try {
      const response = await fetch('/api/order-status', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({orderNumber: order.current, email}),
      });
      const data = (await response.json()) as Line & {reply?: string};
      say({
        from: 'merrivy',
        text: data.reply || `I can’t look that up right now — email ${SUPPORT_EMAIL}.`,
        tracking: data.tracking,
        statusUrl: data.statusUrl,
      });
    } catch {
      say({from: 'merrivy', text: `I can’t look that up right now — email ${SUPPORT_EMAIL}.`});
    }
    order.current = '';
    setStage('chat');
  }

  function submit(text: string) {
    const value = text.trim().slice(0, MAX_CHARS);
    if (!value || stage === 'busy') return;
    setDraft('');
    if (stage === 'order') {
      say({from: 'shopper', text: value});
      if (!/^#?[A-Za-z0-9-]{1,24}$/.test(value.replace(/\s+/g, ''))) {
        say({from: 'merrivy', text: 'That doesn’t look like an order number. It looks like #1001.'});
        return;
      }
      order.current = value;
      say({from: 'merrivy', text: 'Thanks. And the email you used at checkout?'});
      setStage('email');
      return;
    }
    if (stage === 'email') {
      // Show the email only partly in the chat.
      say({from: 'shopper', text: value.replace(/^(.).*(@.*)$/, '$1•••$2')});
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
        say({from: 'merrivy', text: 'That email doesn’t look right. Could you check it?'});
        return;
      }
      void track(value);
      return;
    }
    say({from: 'shopper', text: value});
    // Order questions go straight to the lookup, without the AI.
    if (TRACK_INTENT.test(value)) startTracking();
    else void ask(value);
  }

  const placeholder =
    stage === 'order'
      ? 'Order number, like #1001'
      : stage === 'email'
        ? 'Email used at checkout'
        : 'Ask a question';

  return (
    <>
      <button
        type="button"
        className={`help-chat-bubble ${open ? 'is-open' : ''}`}
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={open ? 'Close help chat' : 'Open help chat'}
        onClick={() => setOpen(!open)}
      >
        <Icon name={open ? 'close' : 'chat'} size={22} />
      </button>
      <section
        id={panelId}
        className={`help-chat-panel ${open ? 'is-open' : ''}`}
        role="dialog"
        aria-label="Merrivy help"
        hidden={!open}
      >
        <header className="help-chat-head">
          <div>
            <strong>Merrivy Support</strong>
            <span>
              Here 24/7 ·{' '}
              <a href="/help" onClick={() => setOpen(false)}>
                Help Center
              </a>{' '}
              · <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
            </span>
          </div>
          <button type="button" aria-label="Close help chat" onClick={() => setOpen(false)}>
            <Icon name="close" size={18} />
          </button>
        </header>
        <div className="help-chat-lines" ref={list} aria-live="polite">
          {lines.map((line) => {
            const isOrderPrompt =
              line.text === ASK_ORDER ||
              line.text.includes('order number') ||
              line.text.includes('email you used at checkout');
            const actions =
              line.from === 'merrivy' && !isOrderPrompt
                ? getHelpActions(line.text, line.id === 0)
                : [];
            return (
              <div key={line.id} className={`help-chat-line is-${line.from}`}>
                <p>{renderFormattedText(line.text, () => setOpen(false))}</p>
                {line.tracking?.map((t) => (
                  <p key={`${t.number}-${t.url}`} className="help-chat-tracking">
                    {[t.company, t.number].filter(Boolean).join(' ')}
                    {t.url ? (
                      <>
                        {' '}
                        <a href={t.url} target="_blank" rel="noopener noreferrer">
                          Track it ↗
                        </a>
                      </>
                    ) : null}
                  </p>
                ))}
                {line.statusUrl ? (
                  <p className="help-chat-tracking">
                    <a href={line.statusUrl} target="_blank" rel="noopener noreferrer">
                      See your full order status ↗
                    </a>
                  </p>
                ) : null}
                {actions.length > 0 && (
                  <div className="help-chat-actions">
                    {actions.map((action) => (
                      <a
                        key={action.href}
                        href={action.href}
                        className="help-chat-action-pill"
                        onClick={() => setOpen(false)}
                      >
                        {action.label}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {stage === 'busy' && (
            <div className="help-chat-line is-merrivy is-typing" aria-label="Typing">
              <p>
                <span />
                <span />
                <span />
              </p>
            </div>
          )}
        </div>
        {lines.length === 1 && stage === 'chat' && (
          <div className="help-chat-starters">
            {STARTERS.map((starter) =>
              starter.href ? (
                <a
                  key={starter.label}
                  href={starter.href}
                  className="help-chat-chip is-link"
                  onClick={() => setOpen(false)}
                >
                  {starter.label}
                </a>
              ) : (
                <button
                  type="button"
                  key={starter.label}
                  className="help-chat-chip"
                  onClick={() => {
                    say({from: 'shopper', text: starter.label});
                    if (starter.track) startTracking();
                    else void ask(starter.label);
                  }}
                >
                  {starter.label}
                </button>
              ),
            )}
          </div>
        )}
        {(stage === 'order' || stage === 'email') && (
          <button
            type="button"
            className="help-chat-cancel"
            onClick={() => {
              order.current = '';
              setStage('chat');
              say({from: 'merrivy', text: 'No problem. Anything else I can help with?'});
            }}
          >
            Cancel order lookup
          </button>
        )}
        <form
          className="help-chat-form"
          onSubmit={(event) => {
            event.preventDefault();
            submit(draft);
          }}
        >
          <input
            ref={input}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            maxLength={MAX_CHARS}
            placeholder={placeholder}
            aria-label={placeholder}
            type={stage === 'email' ? 'email' : 'text'}
            inputMode={stage === 'email' ? 'email' : 'text'}
            autoComplete={stage === 'email' ? 'email' : 'off'}
            enterKeyHint="send"
          />
          <button
            type="submit"
            className="help-chat-send"
            aria-label="Send"
            disabled={!draft.trim() || stage === 'busy'}
          >
            <Icon name="arrow" size={18} />
          </button>
        </form>
      </section>
    </>
  );
}
