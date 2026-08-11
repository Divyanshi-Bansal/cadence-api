const Stripe = require('stripe');
require('dotenv').config();

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const plans = [
  {
    name: 'Free',
    description: 'Basic access for individuals. Includes 1 project and up to 2 members.',
    price: 0, // Free
  },
  {
    name: 'Pro',
    description: 'Perfect for small teams. Includes up to 10 projects and 10 members.',
    price: 1900, // $19.00 / month
  },
  {
    name: 'Enterprise',
    description: 'For large organizations. Unlimited projects and unlimited members.',
    price: 9900, // $99.00 / month
  },
];

async function seed() {
  if (!process.env.STRIPE_SECRET_KEY) {
    console.error('❌ Missing STRIPE_SECRET_KEY in .env file.');
    process.exit(1);
  }

  console.log('🌱 Seeding Stripe Products and Prices...');

  try {
    for (const plan of plans) {
      console.log(`Creating product: ${plan.name}...`);
      const product = await stripe.products.create({
        name: plan.name,
        description: plan.description,
      });

      console.log(`Creating price for ${plan.name}...`);
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: plan.price,
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
      });

      console.log(`✅ ${plan.name} Plan created!`);
      console.log(`   Product ID: ${product.id}`);
      console.log(`   Price ID: ${price.id}\n`);
    }

    console.log('🎉 Seeding complete! You can now view these in your Stripe Dashboard Product Catalog.');
    console.log('IMPORTANT: Save the Price IDs in your backend .env file to use them in the application.');
  } catch (error) {
    console.error('❌ Error seeding Stripe:', error.message);
  }
}

seed();
