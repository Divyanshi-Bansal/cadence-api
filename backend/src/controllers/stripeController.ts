import { Request, Response } from "express";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";
import { getUserPlan } from "../services/subscriptionService";
const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-04-10" as any, // Use latest stable
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

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
      payment_method_types: ["card"],
      mode: "subscription",
      customer: customerId ? customerId : undefined,
      client_reference_id: userId,
      line_items: [
        {
          price: priceId,
          quantity: 1,
        },
      ],
      success_url: `${process.env.FRONTEND_URL}/projects?checkout_success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/pricing?checkout_canceled=true`,
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
      return_url: `${process.env.FRONTEND_URL}/projects`,
    });

    res.json({ url: portalSession.url });
  } catch (error: any) {
    console.error("Stripe Portal Error:", error);
    res.status(500).json({ error: error.message });
  }
};

export const handleWebhook = async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"];

  let event: Stripe.Event;

  try {
    if (!endpointSecret) {
      throw new Error("Missing STRIPE_WEBHOOK_SECRET");
    }
    // req.body must be raw buffer here
    event = stripe.webhooks.constructEvent(req.body, sig as string, endpointSecret);
  } catch (err: any) {
    console.error(`Webhook Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        
        // When checkout completes, we link the stripeCustomerId to our user
        const userId = session.client_reference_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;

        if (userId) {
          // Retrieve the subscription to get the price ID and end date
          const subResponse = await stripe.subscriptions.retrieve(subscriptionId);
          const sub = subResponse as Stripe.Subscription;
          const priceId = sub.items.data[0].price.id;

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
        const priceId = subEvent.items.data[0].price.id;

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
    console.error("Preview Proration Error:", error);
    res.status(500).json({ error: error.message });
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

    if (!subscription || !subscription.stripeSubscriptionId) {
      const session = await stripe.checkout.sessions.create({
        payment_method_types: ["card"],
        mode: "subscription",
        customer: subscription?.stripeCustomerId ? subscription.stripeCustomerId : undefined,
        client_reference_id: userId,
        line_items: [
          {
            price: priceId,
            quantity: 1,
          },
        ],
        success_url: `${process.env.FRONTEND_URL}/projects?checkout_success=true`,
        cancel_url: `${process.env.FRONTEND_URL}/projects/billing?checkout_canceled=true`,
      });
      return res.json({ url: session.url });
    }

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
        expand: ['latest_invoice'],
      }
    );

    const latestInvoice = updatedSubscription.latest_invoice as Stripe.Invoice;

    if (latestInvoice && latestInvoice.status === 'open' && latestInvoice.hosted_invoice_url) {
      return res.json({ url: latestInvoice.hosted_invoice_url });
    }

    res.json({ success: true });
  } catch (error: any) {
    console.error("Update Subscription Error:", error);
    res.status(500).json({ error: error.message });
  }
};
