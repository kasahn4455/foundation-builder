import Image from "next/image";
import Link from "next/link";
import { ArrowRight, ShieldCheck, Sparkles, Truck } from "lucide-react";
import { getProducts } from "@/lib/shopify";

const storeName = process.env.NEXT_PUBLIC_STORE_NAME || "Maison";
const tagline = process.env.NEXT_PUBLIC_STORE_TAGLINE || "Elevated everyday essentials.";

export default async function Home() {
  let products = [];
  let setupError = false;

  try {
    products = await getProducts(12);
  } catch {
    setupError = true;
  }

  return (
    <main>
      <div className="announcement">Complimentary UK delivery on qualifying orders</div>

      <header className="nav shell">
        <Link href="/" className="brand">{storeName}</Link>
        <nav className="navLinks">
          <a href="#shop">Shop</a>
          <a href="#story">Our story</a>
          <a href="#service">Service</a>
        </nav>
        <a className="navCta" href="#shop">Explore</a>
      </header>

      <section className="hero shell">
        <div className="heroCopy">
          <span className="eyebrow">CURATED · DISTINCTIVE · USEFUL</span>
          <h1>Objects worth <em>keeping.</em></h1>
          <p>{tagline} A premium storefront built for clarity, trust and conversion.</p>
          <a href="#shop" className="primaryButton">
            Shop the collection <ArrowRight size={18} />
          </a>
        </div>
        <div className="heroVisual">
          <div className="orb orbA" />
          <div className="orb orbB" />
          <div className="heroCard">
            <span>NEW EDIT</span>
            <strong>Modern essentials.<br/>Quietly premium.</strong>
          </div>
        </div>
      </section>

      <section className="trust shell" id="service">
        <div><Truck size={20}/><span><strong>Fast delivery</strong><small>Tracked fulfilment</small></span></div>
        <div><ShieldCheck size={20}/><span><strong>Secure checkout</strong><small>Powered by Shopify</small></span></div>
        <div><Sparkles size={20}/><span><strong>Curated selection</strong><small>Quality over clutter</small></span></div>
      </section>

      <section className="shop shell" id="shop">
        <div className="sectionHead">
          <div><span className="eyebrow">THE COLLECTION</span><h2>Featured products</h2></div>
          <span className="muted">Selected for everyday usefulness and design.</span>
        </div>

        {setupError ? (
          <div className="setupCard">
            <strong>Connect Shopify to load live products.</strong>
            <p>Add <code>SHOPIFY_STORE_DOMAIN</code> and <code>SHOPIFY_STOREFRONT_ACCESS_TOKEN</code> in Vercel environment variables.</p>
          </div>
        ) : (
          <div className="productGrid">
            {products.map((product: any) => {
              const variant = product.variants.edges[0]?.node;
              return (
                <Link className="productCard" href={`/products/${product.handle}`} key={product.id}>
                  <div className="productImage">
                    {product.featuredImage && (
                      <Image
                        src={product.featuredImage.url}
                        alt={product.featuredImage.altText || product.title}
                        fill
                        sizes="(max-width: 700px) 50vw, 25vw"
                      />
                    )}
                  </div>
                  <div className="productMeta">
                    <div>
                      <h3>{product.title}</h3>
                      <span>View details</span>
                    </div>
                    {variant && <strong>{new Intl.NumberFormat("en-GB", { style: "currency", currency: variant.price.currencyCode }).format(Number(variant.price.amount))}</strong>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>

      <section className="story shell" id="story">
        <span className="eyebrow">WHY THIS STORE</span>
        <h2>Less marketplace noise.<br/>More confidence to buy.</h2>
        <p>A restrained layout, strong typography, generous spacing and clear product hierarchy keep the attention on what matters: the product and the decision.</p>
      </section>

      <footer className="footer shell">
        <strong>{storeName}</strong>
        <span>© {new Date().getFullYear()} · Built on Shopify + Vercel</span>
      </footer>
    </main>
  );
}
