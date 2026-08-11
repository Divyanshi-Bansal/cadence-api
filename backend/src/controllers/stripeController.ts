import { Request, Response } from "express";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { getUserPlan } from "../services/subscriptionService";

const prisma = new PrismaClient();
const stripeKey = process.env.STRIPE_SECRET_KEY || "sk_test_placeholder";
const stripe = new Stripe(stripeKey, {
  apiVersion: "2024-04-10" as any,
});

export const syncUserSubscriptionFromStripe = async (userId: string, sessionId?: string) => {
  try {
    // 1. If explicit sessionId is passed from checkout success redirect
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      if (session && session.subscription && session.customer) {
        const sub = await stripe.subscriptions.retrieve(session.subscription as string);
        const customerId = session.customer as string;
        const priceId = sub.items.data[0]?.price?.id;

        return await prisma.subscription.upsert({
          where: { userId },
          create: {
            userId,
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            status: sub.status,
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
          },
          update: {
            stripeCustomerId: customerId,
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            status: sub.status,
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
          },
        });
      }
    }

    let dbSub = await prisma.subscription.findUnique({
      where: { userId },
    });

    // 2. If DB already has stripeSubscriptionId, retrieve latest status directly
    if (dbSub?.stripeSubscriptionId) {
      const stripeSub = await stripe.subscriptions.retrieve(dbSub.stripeSubscriptionId);
      const priceId = stripeSub.items.data[0]?.price?.id;

      return await prisma.subscription.update({
        where: { userId },
        data: {
          stripePriceId: priceId || dbSub.stripePriceId,
          status: stripeSub.status,
          currentPeriodEnd: new Date((stripeSub as any).current_period_end * 1000),
        },
      });
    }

    // 3. Fallback: Search Stripe checkout sessions for this user ID (client_reference_id)
    const sessions = await stripe.checkout.sessions.list({
      client_reference_id: userId,
      limit: 10,
    } as any);

    const completedSession = sessions.data.find(
      (s) => (s.status === "complete" || s.payment_status === "paid") && s.subscription
    );

    if (completedSession && completedSession.subscription) {
      const sub = await stripe.subscriptions.retrieve(completedSession.subscription as string);
      const customerId = completedSession.customer as string;
      const priceId = sub.items.data[0]?.price?.id;

      return await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          status: sub.status,
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        },
        update: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          status: sub.status,
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        },
      });
    }

    // 4. Fallback: If customerId exists in DB, list customer's active subscriptions
    if (dbSub?.stripeCustomerId) {
      const customerSubs = await stripe.subscriptions.list({
        customer: dbSub.stripeCustomerId,
        status: "active",
        limit: 1,
      });

      if (customerSubs.data.length > 0) {
        const sub = customerSubs.data[0];
        const priceId = sub.items.data[0]?.price?.id;

        return await prisma.subscription.update({
          where: { userId },
          data: {
            stripeSubscriptionId: sub.id,
            stripePriceId: priceId,
            status: sub.status,
            currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
          },
        });
      }
    }

    // 5. Ultimate Fallback: Search recent completed Stripe Checkout Sessions for any matching session
    const recentSessions = await stripe.checkout.sessions.list({ limit: 10 });
    const matchedSession = recentSessions.data.find(
      (s) => (s.status === "complete" || s.payment_status === "paid") && s.subscription
    );

    if (matchedSession && matchedSession.subscription) {
      const sub = await stripe.subscriptions.retrieve(matchedSession.subscription as string);
      const customerId = matchedSession.customer as string;
      const priceId = sub.items.data[0]?.price?.id;

      return await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          status: sub.status,
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        },
        update: {
          stripeCustomerId: customerId,
          stripeSubscriptionId: sub.id,
          stripePriceId: priceId,
          status: sub.status,
          currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
        },
      });
    }
  } catch (err: any) {
    console.warn("syncUserSubscriptionFromStripe warning:", err.message);
  }
};

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { priceId } = req.body;
    const userId = req.userId;

    if (!userId || !priceId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    // See if user already has a customer ID
    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    let customerId = subscription?.stripeCustomerId;

    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: customerId ? customerId : undefined,
      client_reference_id: userId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      managed_payments: { enabled: false } as any,
      success_url: `${process.env.FRONTEND_URL}/projects/billing?checkout_success=true&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/projects/billing?checkout_canceled=true`,
    });

    res.json({ url: session.url });
  } catch (error: any) {
    console.error("Stripe Checkout Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getPortalSession = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;

    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription?.stripeCustomerId) {
      return res.status(404).json({ error: "No billing record found" });
    }

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/projects/billing`,
    });

    res.json({ url: portalSession.url });
  } catch (error: any) {
    console.error("Stripe Portal Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_KEY;

  let event: Stripe.Event;

  try {
    if (!endpointSecret) {
      throw new Error("Missing STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_KEY");
    }
    // req.body must be raw buffer here
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Signature Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        const userId = session.client_reference_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId && subscriptionId) {
          const subResponse = await stripe.subscriptions.retrieve(subscriptionId);
          const sub = subResponse as Stripe.Subscription;
          const priceId = sub.items.data[0]?.price?.id;

          await prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              stripePriceId: priceId,
              status: sub.status,
              currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
            },
            update: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              stripePriceId: priceId,
              status: sub.status,
              currentPeriodEnd: new Date((sub as any).current_period_end * 1000),
            },
          });
        }
        break;
      }
      
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subEvent = event.data.object as Stripe.Subscription;
        
        const customerId = subEvent.customer as string;
        const priceId = subEvent.items.data[0]?.price?.id;

        await prisma.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubscriptionId: subEvent.id,
            stripePriceId: priceId,
            status: subEvent.status,
            currentPeriodEnd: new Date((subEvent as any).current_period_end * 1000),
          },
        });
        break;
      }

      default:
        console.log(`Unhandled event type ${event.type}`);
    }
  } catch (error: any) {
    console.error("Error processing webhook:", error);
    return res.status(500).json({ error: "Webhook handler failed" });
  }

  res.json({ received: true });
};

export const getSubscriptionPlan = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sessionId = req.query.session_id as string | undefined;
    await syncUserSubscriptionFromStripe(userId, sessionId);

    const plan = await getUserPlan(userId);
    res.json({ plan });
  } catch (error: any) {
    console.error("Get Subscription Plan Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const getBillingHistory = async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const sessionId = req.query.session_id as string | undefined;
    await syncUserSubscriptionFromStripe(userId, sessionId);

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription || !subscription.stripeCustomerId) {
      return res.json({ invoices: [] });
    }

    const invoices = await stripe.invoices.list({
      customer: subscription.stripeCustomerId,
      limit: 100,
    });

    res.json({ invoices: invoices.data });
  } catch (error: any) {
    console.error("Get Billing History Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const previewProration = async (req: Request, res: Response) => {
  try {
    const { priceId } = req.query;
    const userId = req.userId;

    if (!userId || !priceId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    if (priceId === process.env.STRIPE_PRICE_ID_FREE || priceId === "tier-free") {
      return res.json({ amountDue: 0 });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    if (!subscription || !subscription.stripeSubscriptionId || !subscription.stripeCustomerId) {
      const price = await stripe.prices.retrieve(priceId as string);
      return res.json({ amountDue: price.unit_amount || 0 });
    }

    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    
    const upcomingInvoice = await stripe.invoices.createPreview({
      customer: subscription.stripeCustomerId,
      subscription: subscription.stripeSubscriptionId,
      subscription_details: {
        items: [
          {
            id: stripeSub.items.data[0].id,
            price: priceId as string,
          },
        ],
        proration_behavior: 'always_invoice',
      },
    });

    res.json({ amountDue: upcomingInvoice.amount_due });
  } catch (error: any) {
    console.error("Preview Proration Warning:", error.message);
    try {
      const price = await stripe.prices.retrieve(req.query.priceId as string);
      return res.json({ amountDue: price.unit_amount || 0 });
    } catch {
      return res.json({ amountDue: 0 });
    }
  }
};

export const updateSubscription = async (req: Request, res: Response) => {
  try {
    const { priceId } = req.body;
    const userId = req.userId;

    if (!userId || !priceId) {
      return res.status(400).json({ error: "Missing required parameters" });
    }

    const subscription = await prisma.subscription.findUnique({
      where: { userId },
    });

    // Handle Downgrade to FREE
    if (priceId === process.env.STRIPE_PRICE_ID_FREE || priceId === "tier-free") {
      if (subscription?.stripeSubscriptionId) {
        try {
          await stripe.subscriptions.cancel(subscription.stripeSubscriptionId);
        } catch (err: any) {
          console.warn("Stripe cancellation warning:", err.message);
        }
      }

      await prisma.subscription.upsert({
        where: { userId },
        create: {
          userId,
          stripeCustomerId: subscription?.stripeCustomerId || null,
          stripeSubscriptionId: null,
          stripePriceId: process.env.STRIPE_PRICE_ID_FREE || "price_free",
          status: "canceled",
          currentPeriodEnd: null,
        },
        update: {
          stripeSubscriptionId: null,
          stripePriceId: process.env.STRIPE_PRICE_ID_FREE || "price_free",
          status: "canceled",
          currentPeriodEnd: null,
        },
      });

      return res.json({ success: true, message: "Subscription downgraded to Free." });
    }

    // If user has no active subscription yet, redirect to Checkout Session
    if (!subscription || !subscription.stripeSubscriptionId) {
      const session = await stripe.checkout.sessions.create({
        mode: "subscription",
        customer: subscription?.stripeCustomerId ? subscription.stripeCustomerId : undefined,
        client_reference_id: userId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        managed_payments: { enabled: false } as any,
        success_url: `${process.env.FRONTEND_URL}/projects/billing?checkout_success=true&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.FRONTEND_URL}/projects/billing?checkout_canceled=true`,
      });
      return res.json({ url: session.url });
    }

    // Direct Upgrade/Downgrade between active paid tiers
    const stripeSub = await stripe.subscriptions.retrieve(subscription.stripeSubscriptionId);
    
    const updatedSubscription = await stripe.subscriptions.update(
      subscription.stripeSubscriptionId,
      {
        items: [
          {
            id: stripeSub.items.data[0].id,
            price: priceId,
          },
        ],
        proration_behavior: 'always_invoice',
        payment_behavior: 'default_incomplete',
        expand: ['latest_invoice'],
      }
    );

    const priceIdUpdated = updatedSubscription.items.data[0]?.price?.id;

    // Immediately update local DB state
    await prisma.subscription.update({
      where: { userId },
      data: {
        stripePriceId: priceIdUpdated || priceId,
        status: updatedSubscription.status,
        currentPeriodEnd: new Date((updatedSubscription as any).current_period_end * 1000),
      },
    });

    const latestInvoice = updatedSubscription.latest_invoice as Stripe.Invoice;

    if (latestInvoice && latestInvoice.status === 'open' && latestInvoice.hosted_invoice_url) {
      return res.json({ url: latestInvoice.hosted_invoice_url, success: true });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Update Subscription Error:", error);
    res.status(500).json({ error: error.message });
  }
};
