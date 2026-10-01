# Premium Shopify Starter

Reusable headless Shopify storefront built with Next.js for Vercel.

## What it includes

- Premium responsive storefront
- Shopify Storefront API product feed
- Product detail pages
- Shopify cart creation + hosted Shopify checkout
- Vercel-ready environment configuration
- No Lovable dependency

## Shopify setup

Create a Storefront API access token in Shopify, then add:

```
SHOPIFY_STORE_DOMAIN=your-store.myshopify.com
SHOPIFY_STOREFRONT_ACCESS_TOKEN=your_token
NEXT_PUBLIC_STORE_NAME=Your Store
NEXT_PUBLIC_STORE_TAGLINE=Your tagline
```

## Deploy on Vercel

Import this GitHub repository as a new Vercel project and set the **Root Directory** to:

```
premium-shopify-starter
```

Then add the environment variables above and deploy.

For each future store, duplicate the starter, change the environment variables and branding, and deploy as a separate Vercel project.
