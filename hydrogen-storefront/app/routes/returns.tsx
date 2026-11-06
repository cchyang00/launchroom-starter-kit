import {SupportShell, ServiceSummary} from '~/components/SupportShell';
import {Link} from 'react-router';
import {guaranteeContent, type CampaignPacket} from '~/content/templates';
import {serviceForPacket} from '~/content/demo-service';
import {useActiveProduct} from '~/content/navigation';
export const meta = () => [{title: 'Returns & refunds | Merrivy'}];
/** The packet's promise ("Fits your tub, or it goes back."), else 30 days. */
function ReturnsTitle({packet}: {packet: CampaignPacket}) {
  const promise = guaranteeContent(packet)?.heading.split('\n') ?? [];
  const [first, ...rest] = promise.length
    ? promise
    : ['30 days to', 'change your mind.'];
  return (
    <>
      {first}
      <br />
      <em>{rest.join(' ')}</em>
    </>
  );
}
export default function ReturnsPage() {
  const {activePacket, productPath} = useActiveProduct();
  const svc = serviceForPacket(activePacket);
  return (
    <SupportShell
      eyebrow="Returns & refunds"
      title={<ReturnsTitle packet={activePacket} />}
      intro="A clear process, should you need it."
    >
      <ServiceSummary
        items={[
          {label: 'Return request', value: 'Within 30 days'},
          {label: 'Item condition', value: svc.returnCondition},
          {label: 'Start with', value: 'Our support team'},
        ]}
      />
      <section>
        <h2>30 days to request a return.</h2>
        <p>
          Contact us within 30 days of delivery.{' '}
          {svc.returnConditionText} Keep your order number handy.
        </p>
      </section>
      <section>
        <h2>Three simple steps.</h2>
        <ol>
          <li>
            Contact support with your order number, the item and your reason for
            returning it.
          </li>
          <li>
            Wait for return instructions and the correct return address before
            sending anything.
          </li>
          <li>
            Pack the item securely and keep the carrier receipt. We’ll confirm
            when it arrives.
          </li>
        </ol>
      </section>
      <section>
        <h2>Shipping & refunds.</h2>
        <p>{svc.returnShipping}</p>
      </section>
      <section>
        <h2>Wrong or damaged item?</h2>
        <p>
          Send a description and clear photos when you contact support. We cover
          return shipping for a confirmed wrong or
          damaged item and arrange the appropriate replacement or refund.
        </p>
      </section>
      <section>
        {svc.exchange.heading ? (
          <>
            <h2>{svc.exchange.heading}</h2>
            <p>{svc.exchange.text}</p>
          </>
        ) : null}
        <Link className="text-link" to={`${productPath}#choose`}>
          {`${activePacket.helpProduct.returnsLink} ↗`}
        </Link>
      </section>
    </SupportShell>
  );
}
