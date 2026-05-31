# Stripe Setup Guide for MacZen

This guide will help you set up Stripe for handling subscriptions in MacZen.

## Prerequisites

- A Stripe account (sign up at https://stripe.com)
- Stripe CLI installed (optional, for testing webhooks locally)

## Step 1: Get Your Stripe API Keys

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com)
2. Click on "Developers" in the left sidebar
3. Click on "API keys"
4. Copy your **Publishable key** and **Secret key**
5. Add them to your `.env` file in the `marketing-site` directory:

```env
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
```

## Step 2: Create Products and Prices

### Create Products in Stripe Dashboard

1. Go to [Products](https://dashboard.stripe.com/products) in your Stripe Dashboard
2. Click "Add product"

#### Pro Monthly

- **Name**: MacZen Pro (Monthly)
- **Description**: Unlimited screenshots with advanced AI features
- **Pricing**: Recurring
- **Price**: $9.00 USD
- **Billing period**: Monthly
- After creation, copy the **Price ID** (starts with `price_`)

#### Pro Yearly

- **Name**: MacZen Pro (Yearly)
- **Description**: Unlimited screenshots with advanced AI features - Save 27%!
- **Pricing**: Recurring
- **Price**: $79.00 USD
- **Billing period**: Yearly
- After creation, copy the **Price ID**

#### Lifetime

- **Name**: MacZen Lifetime
- **Description**: Pay once, own forever with all Pro features
- **Pricing**: One-time
- **Price**: $199.00 USD
- After creation, copy the **Price ID**

### Add Price IDs to `.env`

```env
STRIPE_PRICE_ID_PRO_MONTHLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_ID_PRO_YEARLY=price_xxxxxxxxxxxxx
STRIPE_PRICE_ID_LIFETIME=price_xxxxxxxxxxxxx
```

## Step 3: Set Up Webhooks

Webhooks allow Stripe to notify your app about subscription changes.

### For Production

1. Go to [Webhooks](https://dashboard.stripe.com/webhooks) in your Stripe Dashboard
2. Click "Add endpoint"
3. Enter your webhook URL: `https://yourdomain.com/api/webhooks/stripe`
4. Select events to listen for:
   - `checkout.session.completed`
   - `customer.subscription.created`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
   - `invoice.payment_succeeded`
   - `invoice.payment_failed`
5. Click "Add endpoint"
6. Copy the **Signing secret** (starts with `whsec_`)
7. Add it to your `.env`:

```env
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxxx
```

### For Local Development

1. Install Stripe CLI: `brew install stripe/stripe-cli/stripe`
2. Login: `stripe login`
3. Forward events to your local server:
   ```bash
   stripe listen --forward-to localhost:30051/api/webhooks/stripe
   ```
4. Copy the webhook signing secret from the output
5. Add it to your `.env`

## Step 4: Test the Integration

### Test Checkout Flow

1. Start your dev server: `bun run dev`
2. Go to http://localhost:30051/pricing
3. Click "Start 14-Day Free Trial" on the Pro plan
4. Enter your email
5. Use Stripe test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Any zip code
6. Complete the checkout
7. You should be redirected to the success page

### Test Cards

- **Success**: 4242 4242 4242 4242
- **Decline**: 4000 0000 0000 0002
- **Requires authentication**: 4000 0025 0000 3155

### Verify Webhook Events

Check your Stripe CLI or Dashboard to see webhook events being received:

```bash
stripe listen --print-json
```

## Step 5: Production Deployment

Before going to production:

1. **Switch to live mode** in Stripe Dashboard
2. Get your **live API keys** (they start with `pk_live_` and `sk_live_`)
3. Update your production environment variables
4. Set up production webhook endpoint
5. Test with real payment methods

## Common Issues

### Webhooks not working

- Ensure your webhook URL is publicly accessible
- Check that the signing secret matches
- Verify events are selected in webhook settings
- Check Stripe CLI for error messages

### Checkout session fails

- Verify price IDs are correct
- Ensure `NEXT_PUBLIC_APP_URL` is set correctly
- Check browser console for errors

### Subscription not activating

- Check webhook logs in Stripe Dashboard
- Verify database connection
- Ensure Prisma client is generated

## Security Best Practices

1. **Never commit `.env` files** - Use `.env.example` as a template
2. **Use environment variables** - Don't hardcode API keys
3. **Validate webhook signatures** - Already implemented in the webhook handler
4. **Use HTTPS in production** - Required for Stripe webhooks
5. **Rotate keys regularly** - Generate new API keys periodically

## Additional Resources

- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Testing](https://stripe.com/docs/testing)
- [Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Stripe CLI](https://stripe.com/docs/stripe-cli)

## Support

If you run into issues:

1. Check [Stripe Dashboard logs](https://dashboard.stripe.com/logs)
2. Review webhook event history
3. Test with Stripe CLI
4. Contact Stripe support

## License Key Email Template

When a customer purchases a lifetime license, send them this email:

```
Subject: Your MacZen Lifetime License

Hi there,

Thank you for purchasing MacZen Lifetime! 🎉

Your License Key: XXXX-XXXX-XXXX-XXXX

To activate:
1. Download MacZen from https://maczen.app/download
2. Open the app
3. Go to Preferences > License
4. Enter your license key above

Your license includes:
✓ Unlimited screenshots
✓ All Pro features
✓ Lifetime updates
✓ Priority support

Need help? Reply to this email or visit our support page.

Happy organizing!
The MacZen Team
```
