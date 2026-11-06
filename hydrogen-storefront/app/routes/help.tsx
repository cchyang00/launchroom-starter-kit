import {useActiveProduct} from '~/content/navigation';
import {SupportShell} from '~/components/SupportShell';
import {
  ContactPanel,
  HelpCards,
  supportLine,
  TrustSignals,
  useSupportFlags,
} from '~/components/SupportCenter';
import {SupportEmail} from '~/components/SupportEmail';
export const meta = () => [{title: 'Help center | Merrivy'}];

/**
 * The help center (October 2): one phone-first hub, no search. Doors to Track
 * my order, Shipping, Returns & refunds, Contact us and the FAQ, then true
 * trust signals, the answers grouped by topic (scoped to the active product),
 * and the contact panel.
 */
export default function HelpPage() {
  const {chat} = useSupportFlags();
  const {activePacket} = useActiveProduct();
  const questions = activePacket.faq.items.map((item) => ({
    ...item,
    topic: item.topic || 'Product & fit',
  }));
  const topics = [...new Set(questions.map((item) => item.topic))];
  return (
    <SupportShell
      eyebrow="Help center"
      title={
        <>
          How can we
          <br />
          <em>help?</em>
        </>
      }
      intro={supportLine(chat)}
    >
      <HelpCards />
      <TrustSignals />
      <section className="help-faq" id="faq" aria-labelledby="help-faq-title">
        <span className="eyebrow">FAQ</span>
        <h2 id="help-faq-title">Quick answers.</h2>
        {topics.map((topic) => (
          <div key={topic} className="help-faq-group">
            <h3>{topic}</h3>
            <div className="faq-list help-answers">
              {questions
                .filter((item) => item.topic === topic)
                .map((item) => (
                  <details key={item.question}>
                    <summary>
                      {item.question}
                      <span aria-hidden="true">+</span>
                    </summary>
                    <p>{item.answer}</p>
                  </details>
                ))}
            </div>
          </div>
        ))}
        <p className="faq-still">
          Still have a question? Email <SupportEmail />
        </p>
      </section>
      <ContactPanel />
    </SupportShell>
  );
}
