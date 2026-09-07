import { Controller, Post, Get, Body, Req, Res, Query, UseGuards, Logger, RawBodyRequest } from '@nestjs/common';
import { StripeService } from './stripe.service';
import { PrismaService } from '../prisma/prisma.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { Request, Response } from 'express';
import Stripe from 'stripe';

@Controller('stripe')
export class StripeController {
  private readonly logger = new Logger(StripeController.name);

  constructor(
    private readonly stripeService: StripeService,
    private readonly prisma: PrismaService,
  ) {}

  @UseGuards(JwtAuthGuard)
  @Post('checkout')
  async createCheckoutSession(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const { priceId } = body;
      const userId = req.userId;

      if (!userId || !priceId) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      let customerId = subscription?.stripeCustomerId;

      const session = await this.stripeService.stripeClient.checkout.sessions.create({
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
      this.logger.error("Stripe Checkout Error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('portal')
  async getPortalSession(@Req() req: Request, @Res() res: Response) {
    try {
      const userId = req.userId;

      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (!subscription?.stripeCustomerId) {
        return res.status(404).json({ error: "No billing record found" });
      }

      const portalSession = await this.stripeService.stripeClient.billingPortal.sessions.create({
        customer: subscription.stripeCustomerId,
        return_url: `${process.env.FRONTEND_URL}/projects/billing`,
      });

      res.json({ url: portalSession.url });
    } catch (error: any) {
      this.logger.error("Stripe Portal Error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  // Webhook needs raw body.
  @Post('webhook')
  async handleWebhook(@Req() req: RawBodyRequest<Request>, @Res() res: Response) {
    const sig = req.headers["stripe-signature"];
    const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET || process.env.STRIPE_WEBHOOK_KEY;

    let event: Stripe.Event;

    try {
      if (!endpointSecret) {
        throw new Error("Missing STRIPE_WEBHOOK_SECRET or STRIPE_WEBHOOK_KEY");
      }
      
      // Attempt to use req.rawBody if NestJS rawBody is enabled, fallback to req.body (assuming external middleware might parse it as Buffer)
      const body = req.rawBody || req.body;
      event = this.stripeService.stripeClient.webhooks.constructEvent(body, sig as string, endpointSecret);
    } catch (err: any) {
      this.logger.error(`Webhook Signature Error: ${err.message}`);
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
            const subResponse = await this.stripeService.stripeClient.subscriptions.retrieve(subscriptionId);
            const sub = subResponse as Stripe.Subscription;
            const priceId = sub.items.data[0]?.price?.id;

            await this.prisma.subscription.upsert({
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

          await this.prisma.subscription.updateMany({
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
          this.logger.log(`Unhandled event type ${event.type}`);
      }
    } catch (error: any) {
      this.logger.error("Error processing webhook:", error);
      return res.status(500).json({ error: "Webhook handler failed" });
    }

    res.json({ received: true });
  }

  @UseGuards(JwtAuthGuard)
  @Get('plan')
  async getSubscriptionPlan(@Query('session_id') sessionId: string, @Req() req: Request, @Res() res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      await this.stripeService.syncUserSubscriptionFromStripe(userId, sessionId);

      const plan = await this.stripeService.getUserPlan(userId);
      res.json({ plan });
    } catch (error: any) {
      this.logger.error("Get Subscription Plan Error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('history')
  async getBillingHistory(@Query('session_id') sessionId: string, @Req() req: Request, @Res() res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({ error: "Unauthorized" });
      }

      await this.stripeService.syncUserSubscriptionFromStripe(userId, sessionId);

      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (!subscription || !subscription.stripeCustomerId) {
        return res.json({ invoices: [] });
      }

      const invoices = await this.stripeService.stripeClient.invoices.list({
        customer: subscription.stripeCustomerId,
        limit: 100,
      });

      res.json({ invoices: invoices.data });
    } catch (error: any) {
      this.logger.error("Get Billing History Error:", error);
      res.status(500).json({ error: error.message });
    }
  }

  @UseGuards(JwtAuthGuard)
  @Get('preview-proration')
  async previewProration(@Query('priceId') priceId: string, @Req() req: Request, @Res() res: Response) {
    try {
      const userId = req.userId;

      if (!userId || !priceId) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      if (priceId === process.env.STRIPE_PRICE_ID_FREE || priceId === "tier-free") {
        return res.json({ amountDue: 0 });
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      if (!subscription || !subscription.stripeSubscriptionId || !subscription.stripeCustomerId) {
        const price = await this.stripeService.stripeClient.prices.retrieve(priceId as string);
        return res.json({ amountDue: price.unit_amount || 0 });
      }

      const stripeSub = await this.stripeService.stripeClient.subscriptions.retrieve(subscription.stripeSubscriptionId);
      
      const upcomingInvoice = await this.stripeService.stripeClient.invoices.createPreview({
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
      this.logger.warn("Preview Proration Warning:", error.message);
      try {
        const price = await this.stripeService.stripeClient.prices.retrieve(priceId as string);
        return res.json({ amountDue: price.unit_amount || 0 });
      } catch {
        return res.json({ amountDue: 0 });
      }
    }
  }

  @UseGuards(JwtAuthGuard)
  @Post('update-subscription')
  async updateSubscription(@Body() body: any, @Req() req: Request, @Res() res: Response) {
    try {
      const { priceId } = body;
      const userId = req.userId;

      if (!userId || !priceId) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const subscription = await this.prisma.subscription.findUnique({
        where: { userId },
      });

      // Handle Downgrade to FREE
      if (priceId === process.env.STRIPE_PRICE_ID_FREE || priceId === "tier-free") {
        if (subscription?.stripeSubscriptionId) {
          try {
            await this.stripeService.stripeClient.subscriptions.cancel(subscription.stripeSubscriptionId);
          } catch (err: any) {
            this.logger.warn("Stripe cancellation warning:", err.message);
          }
        }

        await this.prisma.subscription.upsert({
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
        const session = await this.stripeService.stripeClient.checkout.sessions.create({
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
      const stripeSub = await this.stripeService.stripeClient.subscriptions.retrieve(subscription.stripeSubscriptionId);
      
      const updatedSubscription = await this.stripeService.stripeClient.subscriptions.update(
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
      await this.prisma.subscription.update({
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
      this.logger.error("Update Subscription Error:", error);
      res.status(500).json({ error: error.message });
    }
  }
}
