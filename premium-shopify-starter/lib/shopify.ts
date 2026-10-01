const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_STOREFRONT_ACCESS_TOKEN;

export async function shopifyFetch<T>(query: string, variables: Record<string, unknown> = {}): Promise<T> {
  if (!domain || !token) {
    throw new Error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_STOREFRONT_ACCESS_TOKEN");
  }

  const response = await fetch(`https://${domain}/api/2025-07/graphql.json`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Storefront-Access-Token": token
    },
    body: JSON.stringify({ query, variables }),
    next: { revalidate: 60 }
  });

  const json = await response.json();

  if (!response.ok || json.errors) {
    throw new Error(JSON.stringify(json.errors || json));
  }

  return json.data as T;
}

export type Product = {
  id: string;
  handle: string;
  title: string;
  description: string;
  featuredImage?: { url: string; altText?: string | null };
  variants: {
    edges: Array<{
      node: {
        id: string;
        title: string;
        availableForSale: boolean;
        price: { amount: string; currencyCode: string };
      };
    }>;
  };
};

export async function getProducts(first = 12) {
  const data = await shopifyFetch<{ products: { edges: Array<{ node: Product }> } }>(
    `query Products($first: Int!) {
      products(first: $first, sortKey: BEST_SELLING) {
        edges {
          node {
            id handle title description
            featuredImage { url altText }
            variants(first: 10) {
              edges {
                node {
                  id title availableForSale
                  price { amount currencyCode }
                }
              }
            }
          }
        }
      }
    }`,
    { first }
  );
  return data.products.edges.map(({ node }) => node);
}

export async function getProduct(handle: string) {
  const data = await shopifyFetch<{ product: Product | null }>(
    `query Product($handle: String!) {
      product(handle: $handle) {
        id handle title description
        featuredImage { url altText }
        variants(first: 25) {
          edges {
            node {
              id title availableForSale
              price { amount currencyCode }
            }
          }
        }
      }
    }`,
    { handle }
  );
  return data.product;
}
