import site from './site.json';
import type {PacketImage} from './templates';

/**
 * Merrivy's own pictures for pages that are not about one product: the About
 * hero, the empty Journal, the error page and the store setup screen. The
 * error page and setup screen also show when no product packet applies.
 * Product pictures, including the product blocks on the Home, About and Help
 * pages, live in the product packet. `packet-tools.mjs check` checks both.
 */
export type SiteContent = {
  /** The footer line under the wordmark; a line break splits it. */
  tagline: string;
  /** Our story (/about): Merrivy's point of view; the product block below it
   *  comes from the packet's aboutProduct. Headings split on line breaks. */
  about: {
    eyebrow: string;
    heading: string;
    emphasis: string;
    intro: string;
    manifesto: {
      eyebrow: string;
      heading: string;
      emphasis: string;
      paragraphs: string[];
    };
    principles: {label: string; title: string; text: string}[];
  };
  aboutHero: {image: PacketImage};
  journal: {image: PacketImage};
  errorPage: {image: PacketImage};
  setupScreen: {image: PacketImage};
  /** Merrivy Support: the address, the reply time we promise and the short
   *  brand promise on Help, Track and the footer. The owner can edit these. */
  support: {email: string; replyTime: string; promise: string};
};
export const siteContent: SiteContent = site;

/** Merrivy Support (Zoho mailbox, see store/EMAIL.md). */
export const SUPPORT_EMAIL = siteContent.support.email;
/** How fast we answer, e.g. "1 business day". */
export const SUPPORT_REPLY_TIME = siteContent.support.replyTime;
