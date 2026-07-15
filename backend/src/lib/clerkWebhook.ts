import { Webhook } from 'svix';
import { Request, Response } from 'express';
import { userRepository } from '../repositories/userRepository';

interface ClerkEmailAddress {
  email_address: string;
  id: string;
}

interface ClerkUserData {
  id: string;
  email_addresses: ClerkEmailAddress[];
  primary_email_address_id: string;
  first_name: string | null;
  last_name: string | null;
  image_url: string;
}

interface ClerkWebhookEvent {
  type: string;
  data: ClerkUserData;
}

function getPrimaryEmail(data: ClerkUserData): string {
  const primary = data.email_addresses.find(
    (e) => e.id === data.primary_email_address_id
  );
  return primary?.email_address ?? '';
}

function getDisplayName(data: ClerkUserData): string | null {
  const parts = [data.first_name, data.last_name].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : null;
}

// ──────────────────────────────────────────────────────────────────────────────
// handleClerkWebhook
//
// Mounted at:  POST /api/webhooks/clerk
// Body parser: express.raw({ type: 'application/json' })  ← must use raw body
//              so that svix can verify the HMAC signature.
//
// Required env:  CLERK_WEBHOOK_SECRET   (from Clerk Dashboard → Webhooks)
//
// Events handled:
//   user.created  → upsert User row in DB
//   user.updated  → update email / name in DB
//   user.deleted  → delete User row from DB (cascades via Prisma relations)
// ──────────────────────────────────────────────────────────────────────────────
export async function handleClerkWebhook(req: Request, res: Response): Promise<void> {
  const secret = process.env.CLERK_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[clerkWebhook] CLERK_WEBHOOK_SECRET is not set');
    res.status(500).json({ error: 'Webhook secret not configured.' });
    return;
  }

  const svixId = req.headers['svix-id'] as string | undefined;
  const svixTimestamp = req.headers['svix-timestamp'] as string | undefined;
  const svixSignature = req.headers['svix-signature'] as string | undefined;

  if (!svixId || !svixTimestamp || !svixSignature) {
    res.status(400).json({ error: 'Missing svix headers.' });
    return;
  }

  let event: ClerkWebhookEvent;
  try {
    const wh = new Webhook(secret);
    event = wh.verify(req.body as Buffer, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkWebhookEvent;
  } catch (err) {
    console.error('[clerkWebhook] Signature verification failed:', err);
    res.status(400).json({ error: 'Invalid webhook signature.' });
    return;
  }

  const { type, data } = event;
  console.log(`[clerkWebhook] Received event: ${type} for clerkId=${data.id}`);

  try {
    switch (type) {
      case 'user.created': {
        const email = getPrimaryEmail(data);
        const name  = getDisplayName(data);

        await userRepository.upsert({ clerkId: data.id, email, name });

        console.log(`[clerkWebhook] Created/synced user clerkId=${data.id}`);
        break;
      }

      case 'user.updated': {
        const email = getPrimaryEmail(data);
        const name  = getDisplayName(data);

        await userRepository.upsert({ clerkId: data.id, email, name });

        console.log(`[clerkWebhook] Updated user clerkId=${data.id}`);
        break;
      }

      case 'user.deleted': {
        await userRepository.deleteByClerkId(data.id);
        console.log(`[clerkWebhook] Deleted user clerkId=${data.id}`);
        break;
      }

      default:
        console.log(`[clerkWebhook] Unhandled event type: ${type}`);
    }

    res.status(200).json({ received: true });
  } catch (err) {
    console.error(`[clerkWebhook] DB operation failed for event ${type}:`, err);
    res.status(500).json({ error: 'Internal server error processing webhook.' });
  }
}
