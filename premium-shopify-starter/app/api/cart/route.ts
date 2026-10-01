import { NextRequest, NextResponse } from "next/server";
import { shopifyFetch } from "@/lib/shopify";

export async function POST(request: NextRequest) {
  try {
    const { merchandiseId, quantity = 1 } = await request.json();

    const data = await shopifyFetch<{
      cartCreate: {
        cart: { checkoutUrl: string } | null;
        userErrors: Array<{ field?: string[]; message: string }>;
      };
    }>(
      `mutation CartCreate($lines: [CartLineInput!]) {
        cartCreate(input: { lines: $lines }) {
          cart { checkoutUrl }
          userErrors { field message }
        }
      }`,
      { lines: [{ merchandiseId, quantity }] }
    );

    if (data.cartCreate.userErrors.length) {
      return NextResponse.json({ error: data.cartCreate.userErrors[0].message }, { status: 400 });
    }

    return NextResponse.json({ checkoutUrl: data.cartCreate.cart?.checkoutUrl });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to create cart" },
      { status: 500 }
    );
  }
}
