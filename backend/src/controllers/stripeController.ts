import { Request, Response } from "express";
import Stripe from "stripe";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-04-10" as any, // Use latest stable
});

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

export const createCheckoutSession = async (req: Request, res: Response) => {
  try {
    const { priceId } = req.body;
    const userId = req.user?.id;
    const email = req.user?.emailHash; // We have emailHash, or we might need to decrypt email, but let's just pass userId in client_reference_id

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
    const userId = req.user?.id;

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
          const sub = await stripe.subscriptions.retrieve(subscriptionId);
          const priceId = sub.items.data[0].price.id;

          await prisma.subscription.upsert({
            where: { userId },
            create: {
              userId,
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              stripePriceId: priceId,
              status: sub.status,
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            },
            update: {
              stripeCustomerId: customerId,
              stripeSubscriptionId: subscriptionId,
              stripePriceId: priceId,
              status: sub.status,
              currentPeriodEnd: new Date(sub.current_period_end * 1000),
            },
          });
        }
        break;
      }
      
      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        
        const customerId = subscription.customer as string;
        const priceId = subscription.items.data[0].price.id;

        await prisma.subscription.updateMany({
          where: { stripeCustomerId: customerId },
          data: {
            stripeSubscriptionId: subscription.id,
            stripePriceId: priceId,
            status: subscription.status,
            currentPeriodEnd: new Date(subscription.current_period_end * 1000),
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
