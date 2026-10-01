import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import BuyButton from "@/components/BuyButton";
import { getProduct } from "@/lib/shopify";

export default async function ProductPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  const product = await getProduct(handle);
  if (!product) notFound();

  const variant = product.variants.edges[0]?.node;

  return (
    <main className="productPage shell">
      <Link href="/" className="backLink">← Back to shop</Link>
      <div className="productDetail">
        <div className="detailImage">
          {product.featuredImage && (
            <Image
              src={product.featuredImage.url}
              alt={product.featuredImage.altText || product.title}
              fill
              priority
              sizes="(max-width: 850px) 100vw, 55vw"
            />
          )}
        </div>
        <div className="detailCopy">
          <span className="eyebrow">CURATED PRODUCT</span>
          <h1>{product.title}</h1>
          {variant && (
            <div className="price">
              {new Intl.NumberFormat("en-GB", { style: "currency", currency: variant.price.currencyCode }).format(Number(variant.price.amount))}
            </div>
          )}
          <p>{product.description || "Thoughtfully selected for quality, usefulness and everyday appeal."}</p>
          {variant && <BuyButton merchandiseId={variant.id} disabled={!variant.availableForSale} />}
          <div className="finePrint">Secure checkout · Shopify-powered payments · Tracked fulfilment</div>
        </div>
      </div>
    </main>
  );
}
