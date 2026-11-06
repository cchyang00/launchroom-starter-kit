import {SupportShell} from '~/components/SupportShell';
import {Link} from 'react-router';

export const meta = () => [
  {title: 'Privacy | Merrivy'},
  {
    name: 'description',
    content: 'What Merrivy collects, why, and how to reach us.',
  },
];

export default function PrivacyPage() {
  return (
    <SupportShell
      eyebrow="Privacy"
      title={
        <>
          Your information.
          <br />
          <em>Clearly explained.</em>
        </>
      }
      intro="What we collect, why we collect it and how to reach us."
      note="Last updated October 2, 2026"
    >
      <section>
        <h2>What we collect.</h2>
        <p>
          When you browse or add something to your bag, our store platform,
          Shopify, remembers your bag with a cookie or session identifier and
          loads product images from its content servers. Checkout on this site
          does not ask for payment details or a delivery address.
        </p>
      </section>
      <section>
        <h2>Cookies and measurement.</h2>
        <p>
          We use the cookies the store needs to work, such as the one that
          keeps your bag. We don’t run advertising measurement on this site.
          Like any website, the services that deliver our pages may record
          basic technical information about each request.
        </p>
      </section>
      <section>
        <h2>If you email us.</h2>
        <p>
          The contact link opens your email app. Sending a message shares the
          information you choose to include with Merrivy Support through the
          email services involved. Opening the link alone does not send a
          message.
        </p>
      </section>
      <section>
        <h2>Questions about your information.</h2>
        <p>
          Write to us and we’ll tell you what we hold about you, if anything,
          and remove it on request.
        </p>
        <Link className="text-link" to="/help">
          Contact Merrivy Support <span aria-hidden="true">↗</span>
        </Link>
      </section>
    </SupportShell>
  );
}
