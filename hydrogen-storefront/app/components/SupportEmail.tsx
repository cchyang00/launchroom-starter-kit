import {SUPPORT_EMAIL} from '~/content/site';

/** support@merrivy.com as a mailto link, wherever shoppers look for help. */
export function SupportEmail({className}: {className?: string}) {
  return (
    <a className={className} href={`mailto:${SUPPORT_EMAIL}`}>
      {SUPPORT_EMAIL}
    </a>
  );
}
