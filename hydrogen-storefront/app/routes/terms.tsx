import {SupportShell} from '~/components/SupportShell';
import {Link} from 'react-router';

export const meta = () => [
  {title: 'Terms | Merrivy'},
  {
    name: 'description',
    content: 'The essentials of shopping with Merrivy.',
  },
];

export default function TermsPage() {
  return (
    <SupportShell
      eyebrow="Terms"
      title={
        <>
          The small print.
          <br />
          <em>Made clear.</em>
        </>
      }
      intro="The essentials of shopping with Merrivy."
      note="Last updated October 2, 2026"
    >
      <section>
        <h2>Orders.</h2>
        <p>
          An order is placed only when you complete checkout and we email you
          an order confirmation. Adding something to your bag doesn’t reserve
          it or take a payment.
        </p>
      </section>
      <section>
        <h2>Prices and offers.</h2>
        <p>
          Prices and offers can change. The total shown at checkout, before
          you pay, is the price you pay.
        </p>
      </section>
      <section>
        <h2>Delivery, returns and privacy.</h2>
        <p>
          Read our{' '}
          <Link className="text-link" to="/delivery">
            delivery
          </Link>
          ,{' '}
          <Link className="text-link" to="/returns">
            returns
          </Link>{' '}
          and{' '}
          <Link className="text-link" to="/privacy">
            privacy
          </Link>{' '}
          pages for how each works.
        </p>
      </section>
      <section>
        <h2>Questions or feedback.</h2>
        <p>We’d love to hear from you, about an order or anything else.</p>
        <Link className="text-link" to="/help">
          Visit help & contact <span aria-hidden="true">↗</span>
        </Link>
      </section>
    </SupportShell>
  );
}
