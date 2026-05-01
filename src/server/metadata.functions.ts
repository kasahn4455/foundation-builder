import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

/**
 * Off-chain metadata uploader for Solana SPL tokens.
 *
 * This implements the standard Metaplex/Token-2022 off-chain JSON manifest
 * pattern: an HTTPS URI is stored on-chain, and that URI returns a JSON
 * document describing name, symbol, description, image, and external links.
 *
 * We host the image and the JSON in a public Supabase Storage bucket so any
 * wallet or explorer (Phantom, Solscan, etc.) can fetch them. The on-chain
 * record itself stores only `name`, `symbol`, and `uri` — exactly as the
 * Token-2022 Token Metadata extension expects.
 */

const UploadInput = z.object({
  // Mint address is generated client-side (we only have the keypair on the
  // client because the user signs the create-mint tx). We use it as the
  // storage key so each token's assets live under a deterministic prefix.
  mint_address: z.string().min(32).max(44),
  name: z.string().min(1).max(64),
  symbol: z.string().min(1).max(16),
  description: z.string().max(2000).optional().default(""),
  // Base64-encoded image bytes (no data: prefix). Optional — wallets render
  // a placeholder if absent.
  image_base64: z.string().max(8_000_000).optional(),
  image_mime: z
    .string()
    .regex(/^image\/(png|jpeg|jpg|gif|webp|svg\+xml)$/i)
    .optional(),
  external_url: z.string().url().max(500).optional().or(z.literal("")),
  socials: z
    .object({
      website: z.string().url().max(500).optional().or(z.literal("")),
      twitter: z.string().url().max(500).optional().or(z.literal("")),
      telegram: z.string().url().max(500).optional().or(z.literal("")),
      discord: z.string().url().max(500).optional().or(z.literal("")),
    })
    .optional(),
  /**
   * Creator information embedded in the off-chain manifest.
   *
   * The Token-2022 TokenMetadata extension does NOT carry a Metaplex-style
   * `creators[]` array on-chain (that field only exists in the legacy
   * Metaplex Token Metadata program). The closest standards-compliant way
   * to expose creator info for a Token-2022 mint is via the off-chain JSON
   * manifest pointed to by the on-chain `uri`. Wallets and explorers
   * (Phantom, Solscan, Solflare) read these fields from the manifest.
   *
   * - `name`    : human-readable creator label (e.g. "MemeMinting" or a custom name)
   * - `site`    : creator website (optional)
   * - `address` : on-chain wallet address representing the creator (optional)
   */
  creator: z
    .object({
      name: z.string().min(1).max(64),
      site: z.string().url().max(500).optional().or(z.literal("")),
      address: z.string().min(32).max(44).optional().or(z.literal("")),
    })
    .optional(),
});

const BUCKET = "token-metadata";

function extFromMime(mime: string): string {
  const m = mime.toLowerCase();
  if (m.includes("png")) return "png";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  if (m.includes("gif")) return "gif";
  if (m.includes("webp")) return "webp";
  if (m.includes("svg")) return "svg";
  return "bin";
}

function publicUrlFor(path: string): string {
  const { data } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export const uploadTokenMetadata = createServerFn({ method: "POST" })
  .inputValidator((input) => UploadInput.parse(input))
  .handler(async ({ data }) => {
    const prefix = data.mint_address;

    // 1. Upload image (if provided)
    let imageUrl: string | undefined;
    if (data.image_base64 && data.image_mime) {
      const bytes = Buffer.from(data.image_base64, "base64");
      const ext = extFromMime(data.image_mime);
      const imagePath = `${prefix}/logo.${ext}`;
      const { error: imgErr } = await supabaseAdmin.storage
        .from(BUCKET)
        .upload(imagePath, bytes, {
          contentType: data.image_mime,
          upsert: true,
        });
      if (imgErr) {
        console.error("[metadata] image upload failed", imgErr);
        throw new Error("Failed to upload token logo");
      }
      imageUrl = publicUrlFor(imagePath);
    }

    // 2. Build the off-chain JSON manifest in the standard Metaplex shape.
    //    Wallets like Phantom read `name`, `symbol`, `description`, `image`,
    //    and `extensions` (for socials/website).
    const socials = data.socials ?? {};
    const extensions: Record<string, string> = {};
    if (socials.website) extensions.website = socials.website;
    if (socials.twitter) extensions.twitter = socials.twitter;
    if (socials.telegram) extensions.telegram = socials.telegram;
    if (socials.discord) extensions.discord = socials.discord;

    const manifest: Record<string, unknown> = {
      name: data.name,
      symbol: data.symbol,
      description: data.description ?? "",
    };
    if (imageUrl) {
      manifest.image = imageUrl;
      manifest.properties = {
        files: [{ uri: imageUrl, type: data.image_mime }],
        category: "image",
      };
    }
    const externalUrl = data.external_url || socials.website;
    if (externalUrl) manifest.external_url = externalUrl;
    if (Object.keys(extensions).length > 0) manifest.extensions = extensions;

    const manifestPath = `${prefix}/metadata.json`;
    const manifestBytes = Buffer.from(JSON.stringify(manifest, null, 2), "utf8");
    const { error: jsonErr } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(manifestPath, manifestBytes, {
        contentType: "application/json",
        upsert: true,
      });
    if (jsonErr) {
      console.error("[metadata] manifest upload failed", jsonErr);
      throw new Error("Failed to upload token metadata manifest");
    }

    return {
      uri: publicUrlFor(manifestPath),
      image_url: imageUrl,
    };
  });
