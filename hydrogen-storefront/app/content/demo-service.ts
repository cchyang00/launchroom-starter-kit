import {campaign as defaultPacket, type CampaignPacket} from './templates';

/**
 * Build the service terms for any product's CampaignPacket (Delivery, Returns,
 * checkout preview, and help chat).
 */
export function serviceForPacket(packet: CampaignPacket = defaultPacket) {
  const service = packet.service;
  return {
    shippingFee: packet.offer?.shippingFee ?? 10,
    freeShippingAt: packet.offer?.freeShippingOver ?? 150,
    currency: packet.offer?.currency ?? 'USD',
    processing: service?.processing || '1-2 business days',
    transit: service?.transit || '5-8 business days',
    returnDays: 30,
    /** One line on the shipping rate; empty means "use the fee and threshold". */
    shippingRate: service?.shippingRate ?? '',
    returnCondition: service?.returnCondition || 'Unworn, with tags',
    returnConditionText:
      service?.returnConditionText ||
      'Items must be unworn, unwashed and have their original tags.',
    returnShipping:
      service?.returnShipping ||
      'You pay return shipping for a change of mind or size. Original shipping charges are not refunded. Approved refunds go to the original payment method after inspection; allow 5–10 business days for the payment provider to process them.',
    exchange: service
      ? service.exchange
      : {
          heading: 'Prefer a different size?',
          text: 'Request a return, then place a new order for your preferred size when it is available. Check the garment measurements first to help choose your fit.',
        },
  };
}

export const demoService = serviceForPacket(defaultPacket);
