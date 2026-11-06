import {SupportShell, ServiceSummary} from '~/components/SupportShell';
import {Link} from 'react-router';
import {serviceForPacket} from '~/content/demo-service';
import {useActiveProduct, withProductParam} from '~/content/navigation';
import {moneyLocale} from '~/lib/money';
export const meta = () => [{title: 'Delivery | Merrivy'}];

export default function DeliveryPage() {
  const {activePacket, productPath} = useActiveProduct();
  const svc = serviceForPacket(activePacket);
  const money = (value: number) =>
    new Intl.NumberFormat(moneyLocale(svc.currency), {
      style: 'currency',
      currency: svc.currency,
    }).format(value);
  const shippingRateLine = () => {
    if (svc.freeShippingAt <= 0) return 'Shipping is free on every order.';
    return `Standard shipping is ${money(svc.shippingFee)}. Orders with a merchandise subtotal of ${money(svc.freeShippingAt)} or more ship free.`;
  };
  return (
    <SupportShell
      eyebrow="Delivery"
      title={
        <>
          Your order,
          <br />
          <em>on its way.</em>
        </>
      }
      intro="Simple rates, clear timing and tracking from the day it ships."
    >
      <ServiceSummary
        items={[
          {label: 'Destinations', value: 'US, CA, UK, AU & NZ'},
          {label: 'Preparation', value: svc.processing},
          {label: 'Standard transit', value: svc.transit},
        ]}
      />
      <section>
        <h2>Your delivery, at a glance.</h2>
        <table className="size-chart">
          <thead>
            <tr>
              <th>Destination</th>
              <th>Preparation</th>
              <th>Transit</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>United States, Canada, UK, Australia &amp; New Zealand</td>
              <td>{svc.processing}</td>
              <td>{svc.transit}</td>
            </tr>
          </tbody>
        </table>
        <p>
          Business days exclude weekends and public holidays. We deliver with
          door-to-door tracked shipping across the United States, Canada, the
          United Kingdom, Australia, and New Zealand.
        </p>
      </section>
      <section>
        <h2>A simple shipping rate.</h2>
        <p>
          {svc.shippingRate || shippingRateLine()} You’ll see your
          shipping amount at checkout before you pay.
        </p>
      </section>
      <section>
        <h2>Follow every step.</h2>
        <p>
          When your order ships, we email you its tracking link.
          Allow up to two business days for the carrier’s first scan. If an
          estimated arrival has passed, contact support with your order number
          so we can look into it.
        </p>
      </section>
      <section>
        <h2>A change of plans?</h2>
        <p>
          Contact us as soon as possible to request an address correction.
          Changes may not be possible once an order has been dispatched.
        </p>
        <Link className="text-link" to={withProductParam('/help', productPath)}>
          Contact & common questions ↗
        </Link>
      </section>
    </SupportShell>
  );
}
