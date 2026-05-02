import "@/lib/polyfills";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  Keypair,
} from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  ExtensionType,
  getMintLen,
  createInitializeMintInstruction,
  createInitializeMetadataPointerInstruction,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
  getTokenMetadata,
  getMint,
} from "@solana/spl-token";
import {
  createInitializeInstruction as createInitializeTokenMetadataInstruction,
  createUpdateAuthorityInstruction as createUpdateMetadataAuthorityInstruction,
  pack as packTokenMetadata,
  type TokenMetadata,
} from "@solana/spl-token-metadata";
import type { SolanaProvider } from "@/components/wallet/WalletContext";
import { rpcForCluster, isMainnetRpcAccessError, type Cluster } from "./cluster";
import { assertSolanaAddress } from "./address";

export async function getWalletBalanceSol(
  address: string,
  cluster: Cluster,
): Promise<number> {
  const rpcUrl = rpcForCluster(cluster);
  const connection = new Connection(rpcUrl, "confirmed");
  const pk = new PublicKey(assertSolanaAddress(address, "Wallet address"));
  const lamports = await connection.getBalance(pk, "confirmed");
  return lamports / LAMPORTS_PER_SOL;
}

export type SendPaymentArgs = {
  provider: SolanaProvider;
  fromAddress: string;
  toAddress: string;
  amountSol: number;
  cluster: Cluster;
};

export async function sendPayment({
  provider,
  fromAddress,
  toAddress,
  amountSol,
  cluster,
}: SendPaymentArgs): Promise<string> {
  const rpcUrl = rpcForCluster(cluster);
  console.info("[mint] sendPayment cluster=", cluster, "rpc=", rpcUrl);
  const connection = new Connection(rpcUrl, "confirmed");
  const fromPk = new PublicKey(assertSolanaAddress(fromAddress, "Sender wallet address"));
  const toPk = new PublicKey(assertSolanaAddress(toAddress, "Recipient wallet address"));
  const lamports = Math.round(amountSol * LAMPORTS_PER_SOL);

  let blockhash: string;
  let lastValidBlockHeight: number;
  try {
    const bh = await connection.getLatestBlockhash("confirmed");
    blockhash = bh.blockhash;
    lastValidBlockHeight = bh.lastValidBlockHeight;
  } catch (err) {
    console.error("[mint] getLatestBlockhash failed", { cluster, rpcUrl, err });
    if (cluster === "mainnet" && isMainnetRpcAccessError(err)) {
      throw new Error(
        "Solana mainnet RPC is unreachable from your browser (the public endpoint blocked the request). " +
          "No payment was attempted. Please reload and try again, or contact support if this keeps happening.",
      );
    }
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(
      cluster === "mainnet"
        ? `Could not reach Solana mainnet to start the payment. No SOL was charged. Please check your connection and try again. (${reason})`
        : `Failed to reach Solana devnet RPC: ${reason}`,
    );
  }

  const tx = new Transaction({
    feePayer: fromPk,
    blockhash,
    lastValidBlockHeight,
  }).add(
    SystemProgram.transfer({
      fromPubkey: fromPk,
      toPubkey: toPk,
      lamports,
    }),
  );

  let signature: string;
  try {
    // One-and-only-one wallet popup per call. The `payment:wallet-popup`
    // counter (window-scoped) makes a duplicate Phantom approval immediately
    // visible in the live console as `[mint] PAYMENT_WALLET_POPUP n=2`.
    const popupN =
      typeof window !== "undefined"
        ? ((window as unknown as { __payment_popup_n?: number }).__payment_popup_n =
            ((window as unknown as { __payment_popup_n?: number }).__payment_popup_n ?? 0) + 1)
        : 1;
    console.info("[mint] PAYMENT_WALLET_POPUP", { n: popupN, lamports, cluster });
    if (provider.signAndSendTransaction) {
      const res = await provider.signAndSendTransaction(tx);
      signature = res.signature;
    } else {
      const signed = await provider.signTransaction(tx);
      signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
      });
    }
    console.info("[mint] PAYMENT_WALLET_RETURNED", { n: popupN, signature });

    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );
    return signature;
  } catch (err) {
    console.error("[mint] PAYMENT_FAILED", { cluster, rpcUrl, err });
    const msg = err instanceof Error ? err.message : String(err);
    if (/User rejected|user denied|reject|declined|cancell?ed/i.test(msg)) {
      throw err; // preserve original — outer handler maps to friendly text
    }
    if (/block height exceeded|blockhash not found|TransactionExpired|expired/i.test(msg)) {
      throw new Error(
        cluster === "mainnet"
          ? "Your payment expired before Solana mainnet could confirm it (the network was slow, or signing took too long). No SOL was charged. Click Try Again to send a fresh payment."
          : "Your payment transaction expired before the network could confirm it. No SOL was charged. Please click Try Again to send a fresh payment.",
      );
    }
    if (/insufficient|0x1$|debit an account|InsufficientFundsForRent/i.test(msg)) {
      throw new Error(
        cluster === "mainnet"
          ? "Insufficient SOL in your wallet to cover the platform fee plus Solana network fees. No charge was made. Please add more SOL to this wallet and click Try Again."
          : "Insufficient devnet SOL to cover network costs. Please fund this wallet from a devnet faucet and try again.",
      );
    }
    if (cluster === "mainnet" && isMainnetRpcAccessError(err)) {
      throw new Error(
        "Solana mainnet is temporarily unreachable from your browser (the public RPC blocked the request). No payment was confirmed and no SOL was charged. Please wait a moment and click Try Again.",
      );
    }
    throw new Error(
      cluster === "mainnet"
        ? `Payment failed on Solana mainnet. No SOL was charged unless your wallet shows a confirmed transfer. Details: ${msg}`
        : `Payment failed on Solana devnet: ${msg}`,
    );
  }
}

/**
 * Generate a Token-2022 mint keypair upfront (callers need the mint address
 * before signing so they can pre-upload off-chain JSON metadata pointing at it).
 */
export function generateMintKeypair(): Keypair {
  return Keypair.generate();
}

export type MintTokenArgs = {
  provider: SolanaProvider;
  payerAddress: string;
  cluster: Cluster;
  decimals: number;
  initialSupply: string;
  revokeFreeze: boolean;
  revokeMint: boolean;
  /** When true, metadata update authority is permanently revoked after init. */
  revokeUpdate: boolean;
  /** Mint keypair generated by the caller (so the metadata URI can reference it). */
  mintKeypair: Keypair;
  /** On-chain metadata fields (Token-2022 Token Metadata extension). */
  metadata: {
    name: string;
    symbol: string;
    /** HTTPS URI to the off-chain JSON manifest (image, description, socials). */
    uri: string;
  };
};

export type MintTokenResult = {
  mintAddress: string;
  ataAddress: string;
  signature: string;
  /**
   * Resolved on-chain authorities AFTER the mint tx is confirmed. These are
   * read directly from chain state via `getMint` and `getTokenMetadata`, NOT
   * inferred from the user's selections — so they reflect actual reality.
   *   - `null`  → authority was permanently revoked
   *   - string  → base58 address that still controls this authority
   */
  mintAuthority: string | null;
  freezeAuthority: string | null;
  metadataUpdateAuthority: string | null;
};

/**
 * Creates a Token-2022 mint with on-chain metadata via the
 * MetadataPointer + TokenMetadata extensions, mints initial supply, and
 * optionally revokes mint/freeze/update authorities — all in one transaction.
 *
 * The metadata Update Authority is REAL: it lives in the on-chain
 * TokenMetadata extension. Setting `revokeUpdate` permanently nulls it via
 * `createUpdateAuthorityInstruction`, mirroring how mint/freeze authorities
 * are revoked. There is no fake "update" toggle anywhere.
 *
 * Off-chain JSON (image, description, socials, external_url) is hosted by the
 * server (see `src/server/metadata.functions.ts`) and referenced through the
 * `uri` field stored on-chain — the standard Solana / Metaplex pattern.
 */
export async function mintToken({
  provider,
  payerAddress,
  cluster,
  decimals,
  initialSupply,
  revokeFreeze,
  revokeMint,
  revokeUpdate,
  mintKeypair,
  metadata,
}: MintTokenArgs): Promise<MintTokenResult> {
  const rpcUrl = rpcForCluster(cluster);
  // Single attempt id so every log line for this mint can be correlated
  // when multiple users (or retries) run concurrently in production.
  const attemptId = Math.random().toString(36).slice(2, 10);
  console.info("[mint] mintToken cluster=", cluster, "rpc=", rpcUrl);
  console.info("[mint] MINT_ATTEMPT_START", {
    attemptId,
    cluster,
    mint: mintKeypair.publicKey.toBase58(),
    payerAddress,
    decimals,
    initialSupply,
    revokeFreeze,
    revokeMint,
    revokeUpdate,
    metadataUri: metadata.uri,
  });
  const connection = new Connection(rpcUrl, "confirmed");
  const payer = new PublicKey(assertSolanaAddress(payerAddress, "Payer wallet address"));

  const mintPk = mintKeypair.publicKey;
  // ATA must be derived against the Token-2022 program.
  const ata = getAssociatedTokenAddressSync(
    mintPk,
    payer,
    false,
    TOKEN_2022_PROGRAM_ID,
  );
  console.info("[mint] MINT_KEYPAIR_AND_ATA_DERIVED", {
    attemptId,
    mint: mintPk.toBase58(),
    ata: ata.toBase58(),
  });

  // ---------------------------------------------------------------------------
  // Authority decisions (single source of truth for ALL three authorities).
  //
  // Each authority is initialized to the connected wallet, then optionally
  // revoked (set to null) in the SAME atomic transaction. Either both
  // assignment and revocation succeed, or the whole mint fails — there is
  // no window where the on-chain state diverges from the user's selection.
  //
  //   revokeMint   = true  → MintTokens authority   → null  after init
  //                  false → MintTokens authority   → wallet (user can mint more)
  //   revokeFreeze = true  → FreezeAccount authority → null
  //                  false → FreezeAccount authority → wallet (user can freeze)
  //   revokeUpdate = true  → Metadata updateAuthority → null
  //                  false → Metadata updateAuthority → wallet (user can edit)
  //
  // The revoke instructions are appended below in this exact order:
  //   freeze → update → mint
  // (Mint last because we need MintTokens authority to mint the initial supply.)
  // ---------------------------------------------------------------------------
  const initialMintAuthority: PublicKey = payer;
  const initialFreezeAuthority: PublicKey = payer;
  const initialUpdateAuthority: PublicKey = payer;

  const finalMintAuthority: PublicKey | null = revokeMint ? null : payer;
  const finalFreezeAuthority: PublicKey | null = revokeFreeze ? null : payer;
  const finalUpdateAuthority: PublicKey | null = revokeUpdate ? null : payer;

  console.info("[mint] authority plan", {
    mint: mintPk.toBase58(),
    mintAuthority: {
      initial: initialMintAuthority.toBase58(),
      final: finalMintAuthority ? finalMintAuthority.toBase58() : null,
      revoke: revokeMint,
    },
    freezeAuthority: {
      initial: initialFreezeAuthority.toBase58(),
      final: finalFreezeAuthority ? finalFreezeAuthority.toBase58() : null,
      revoke: revokeFreeze,
    },
    updateAuthority: {
      initial: initialUpdateAuthority.toBase58(),
      final: finalUpdateAuthority ? finalUpdateAuthority.toBase58() : null,
      revoke: revokeUpdate,
    },
  });

  // Build the on-chain TokenMetadata struct so we can size the mint account
  // correctly. additionalMetadata is intentionally empty — socials live in
  // the off-chain JSON to keep the on-chain footprint (and tx size) small.
  // NOTE: size is computed from the INITIAL authority. Revocation later in
  // the same tx swaps the authority pubkey for the all-zero pubkey, which
  // is the same on-disk size, so this stays accurate.
  const tokenMetadata: TokenMetadata = {
    mint: mintPk,
    name: metadata.name,
    symbol: metadata.symbol,
    uri: metadata.uri,
    additionalMetadata: [],
    updateAuthority: initialUpdateAuthority,
  };

  // Mint account size = base mint (with extensions) + tokenMetadata extension
  // bytes (which lives at the end of the account, not in getMintLen).
  const baseMintLen = getMintLen([ExtensionType.MetadataPointer]);
  // Token Metadata extension prefix: 4-byte type + length headers (TYPE_SIZE + LENGTH_SIZE).
  const METADATA_EXTENSION_PREFIX = 4;
  const metadataLen = METADATA_EXTENSION_PREFIX + packTokenMetadata(tokenMetadata).length;
  const accountSize = baseMintLen + metadataLen;
  const lamportsForMint = await connection.getMinimumBalanceForRentExemption(accountSize);

  const supplyBI = BigInt(initialSupply);
  const factor = BigInt(10) ** BigInt(decimals);
  const baseUnits = supplyBI * factor;

  let failurePoint = "prepare";

  async function getFreshBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    failurePoint = "getLatestBlockhash";
    try {
      return await connection.getLatestBlockhash("confirmed");
    } catch (err) {
      console.error("[mint] getLatestBlockhash failed", { cluster, rpcUrl, err });
      if (cluster === "mainnet" && isMainnetRpcAccessError(err)) {
        throw new Error(
          "Solana mainnet RPC is unreachable from your browser. The mint transaction was not built. " +
            "If you already paid, click Try Again — your payment is preserved and will not be re-charged.",
        );
      }
      const reason = err instanceof Error ? err.message : String(err);
      throw new Error(
        cluster === "mainnet"
          ? `Could not reach Solana mainnet to build the mint transaction. (${reason}) Please click Try Again.`
          : `Failed to reach Solana devnet RPC: ${reason}`,
      );
    }
  }

  try {
    const { blockhash, lastValidBlockHeight } = await getFreshBlockhash();

    failurePoint = "buildTransaction";
    const tx = new Transaction({
      feePayer: payer,
      blockhash,
      lastValidBlockHeight,
    });

    tx.add(
      // 1. Allocate the mint account sized for MetadataPointer + TokenMetadata.
      SystemProgram.createAccount({
        fromPubkey: payer,
        newAccountPubkey: mintPk,
        lamports: lamportsForMint,
        space: baseMintLen, // metadata extension is appended after init
        programId: TOKEN_2022_PROGRAM_ID,
      }),
      // 2. Set the metadata pointer to point at the mint itself (self-hosted metadata).
      createInitializeMetadataPointerInstruction(
        mintPk,
        payer,
        mintPk,
        TOKEN_2022_PROGRAM_ID,
      ),
      // 3. Initialize the mint (must come AFTER all extension initializers).
      //    The mint authority and freeze authority assigned here are the REAL
      //    on-chain authorities. They may be revoked later in this same tx.
      createInitializeMintInstruction(
        mintPk,
        decimals,
        initialMintAuthority, // mint authority (handles MINT REVOKE below)
        initialFreezeAuthority, // freeze authority (handles FREEZE REVOKE below)
        TOKEN_2022_PROGRAM_ID,
      ),
      // 4. Initialize the on-chain Token Metadata (name/symbol/uri + update authority).
      //    The update authority assigned here IS the real on-chain authority.
      //    Wallets and explorers will treat `initialUpdateAuthority` as the
      //    sole signer that can update name/symbol/uri/additionalMetadata.
      createInitializeTokenMetadataInstruction({
        programId: TOKEN_2022_PROGRAM_ID,
        metadata: mintPk,
        updateAuthority: initialUpdateAuthority,
        mint: mintPk,
        mintAuthority: payer,
        name: metadata.name,
        symbol: metadata.symbol,
        uri: metadata.uri,
      }),
      // 5. Pay rent for the metadata extension bytes that were just appended.
      //    SystemProgram.transfer "tops up" the mint account so it stays rent-exempt
      //    after the metadata extension grew the account.
    );

    // The metadata account grew the on-chain account; ensure it stays rent-exempt.
    const totalLamportsRequired = await connection.getMinimumBalanceForRentExemption(
      accountSize,
    );
    if (totalLamportsRequired > lamportsForMint) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: payer,
          toPubkey: mintPk,
          lamports: totalLamportsRequired - lamportsForMint,
        }),
      );
    }

    // 6. Create the ATA and mint the initial supply to it.
    tx.add(
      createAssociatedTokenAccountInstruction(
        payer,
        ata,
        payer,
        mintPk,
        TOKEN_2022_PROGRAM_ID,
      ),
      createMintToInstruction(
        mintPk,
        ata,
        payer,
        baseUnits,
        [],
        TOKEN_2022_PROGRAM_ID,
      ),
    );

    // -------------------------------------------------------------------------
    // 7. Authority finalization. Order matters:
    //    a) FREEZE — safe to revoke any time after init.
    //    b) UPDATE — safe to revoke any time after metadata init.
    //    c) MINT   — MUST come last because we needed it above to mint the
    //                initial supply. Revoking earlier would break createMintTo.
    // -------------------------------------------------------------------------

    // (a) FREEZE AUTHORITY
    if (revokeFreeze) {
      console.info("[mint] appending freeze-authority revoke instruction", {
        mint: mintPk.toBase58(),
        oldAuthority: initialFreezeAuthority.toBase58(),
        newAuthority: null,
      });
      tx.add(
        createSetAuthorityInstruction(
          mintPk,
          initialFreezeAuthority,
          AuthorityType.FreezeAccount,
          null,
          [],
          TOKEN_2022_PROGRAM_ID,
        ),
      );
    } else {
      console.info("[mint] keeping freeze authority on connected wallet", {
        mint: mintPk.toBase58(),
        freezeAuthority: initialFreezeAuthority.toBase58(),
      });
    }

    // (b) METADATA UPDATE AUTHORITY
    if (revokeUpdate) {
      console.info("[mint] appending update-authority revoke instruction", {
        mint: mintPk.toBase58(),
        oldAuthority: initialUpdateAuthority.toBase58(),
        newAuthority: null,
      });
      tx.add(
        createUpdateMetadataAuthorityInstruction({
          programId: TOKEN_2022_PROGRAM_ID,
          metadata: mintPk,
          oldAuthority: initialUpdateAuthority,
          newAuthority: null,
        }),
      );
    } else {
      console.info("[mint] keeping update authority on connected wallet", {
        mint: mintPk.toBase58(),
        updateAuthority: initialUpdateAuthority.toBase58(),
      });
    }

    // (c) MINT AUTHORITY — must be LAST so the initial supply mint above succeeds.
    if (revokeMint) {
      console.info("[mint] appending mint-authority revoke instruction", {
        mint: mintPk.toBase58(),
        oldAuthority: initialMintAuthority.toBase58(),
        newAuthority: null,
      });
      tx.add(
        createSetAuthorityInstruction(
          mintPk,
          initialMintAuthority,
          AuthorityType.MintTokens,
          null,
          [],
          TOKEN_2022_PROGRAM_ID,
        ),
      );
    } else {
      console.info("[mint] keeping mint authority on connected wallet", {
        mint: mintPk.toBase58(),
        mintAuthority: initialMintAuthority.toBase58(),
      });
    }

    tx.partialSign(mintKeypair);

    let signature: string;
    // Same single-popup counter pattern as the payment step. A duplicate
    // mint approval would surface in the live console as
    // `[mint] MINT_WALLET_POPUP n=2`.
    const mintPopupN =
      typeof window !== "undefined"
        ? ((window as unknown as { __mint_popup_n?: number }).__mint_popup_n =
            ((window as unknown as { __mint_popup_n?: number }).__mint_popup_n ?? 0) + 1)
        : 1;
    console.info("[mint] MINT_WALLET_POPUP", { n: mintPopupN, mint: mintPk.toBase58(), cluster });
    if (provider.signTransaction) {
      failurePoint = "signTransaction";
      const signed = await provider.signTransaction(tx);

      failurePoint = "sendRawTransaction";
      signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 5,
      });
    } else if (provider.signAndSendTransaction) {
      failurePoint = "signAndSendTransaction";
      const res = await provider.signAndSendTransaction(tx);
      signature = res.signature;
    } else {
      throw new Error("Connected wallet does not support Solana transaction signing.");
    }
    console.info("[mint] MINT_WALLET_RETURNED", { n: mintPopupN, signature });

    failurePoint = "confirmTransaction";
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    // -------------------------------------------------------------------------
    // Post-confirmation verification (REAL check, not optimistic).
    //
    // Read all three authorities back from chain state and assert each one
    // matches what we intended. If any of them doesn't, we throw — the
    // caller treats this as a failed mint even though the tx confirmed,
    // because the user's selection wasn't honored.
    //   - mint   + freeze authorities  → from `getMint` (base mint state)
    //   - update authority             → from `getTokenMetadata` (extension)
    // -------------------------------------------------------------------------
    failurePoint = "verifyAuthorities";
    let onChainMintAuthority: string | null = null;
    let onChainFreezeAuthority: string | null = null;
    let onChainUpdateAuthority: string | null = null;
    try {
      const [mintInfo, metadataInfo] = await Promise.all([
        getMint(connection, mintPk, "confirmed", TOKEN_2022_PROGRAM_ID),
        getTokenMetadata(connection, mintPk, "confirmed", TOKEN_2022_PROGRAM_ID),
      ]);
      if (!metadataInfo) {
        throw new Error("TokenMetadata extension missing from mint after confirmation");
      }

      onChainMintAuthority = mintInfo.mintAuthority ? mintInfo.mintAuthority.toBase58() : null;
      onChainFreezeAuthority = mintInfo.freezeAuthority ? mintInfo.freezeAuthority.toBase58() : null;
      onChainUpdateAuthority = metadataInfo.updateAuthority
        ? metadataInfo.updateAuthority.toBase58()
        : null;

      const expectedMint = finalMintAuthority ? finalMintAuthority.toBase58() : null;
      const expectedFreeze = finalFreezeAuthority ? finalFreezeAuthority.toBase58() : null;
      const expectedUpdate = finalUpdateAuthority ? finalUpdateAuthority.toBase58() : null;

      console.info("[mint] authorities verified", {
        mint: mintPk.toBase58(),
        mintAuthority: { expected: expectedMint, onChain: onChainMintAuthority, revoke: revokeMint },
        freezeAuthority: { expected: expectedFreeze, onChain: onChainFreezeAuthority, revoke: revokeFreeze },
        updateAuthority: { expected: expectedUpdate, onChain: onChainUpdateAuthority, revoke: revokeUpdate },
      });

      if (onChainMintAuthority !== expectedMint) {
        throw new Error(
          `Mint authority mismatch. Expected ${expectedMint ?? "null (revoked)"}, on-chain ${onChainMintAuthority ?? "null"}.`,
        );
      }
      if (onChainFreezeAuthority !== expectedFreeze) {
        throw new Error(
          `Freeze authority mismatch. Expected ${expectedFreeze ?? "null (revoked)"}, on-chain ${onChainFreezeAuthority ?? "null"}.`,
        );
      }
      if (onChainUpdateAuthority !== expectedUpdate) {
        throw new Error(
          `Metadata update authority mismatch. Expected ${expectedUpdate ?? "null (revoked)"}, on-chain ${onChainUpdateAuthority ?? "null"}.`,
        );
      }
    } catch (verifyErr) {
      console.error("[mint] authority verification failed", {
        mint: mintPk.toBase58(),
        revokeMint,
        revokeFreeze,
        revokeUpdate,
        err: verifyErr,
      });
      throw verifyErr;
    }

    return {
      mintAddress: mintPk.toBase58(),
      ataAddress: ata.toBase58(),
      signature,
      mintAuthority: onChainMintAuthority,
      freezeAuthority: onChainFreezeAuthority,
      metadataUpdateAuthority: onChainUpdateAuthority,
    };
  } catch (err) {
    console.error("[mint] MINT_FAILED", { cluster, failurePoint, err });
    const msg = err instanceof Error ? err.message : String(err);
    if (/block height exceeded|blockhash not found|TransactionExpired|expired/i.test(msg)) {
      throw new Error(
        cluster === "mainnet"
          ? "Your mint transaction expired before Solana mainnet could confirm it (network was slow or signing took too long). Your payment is preserved — click Try Again to rebuild and resend the mint without paying again."
          : "Mint transaction expired before it was confirmed. Please click Try Again to build a fresh mint transaction.",
      );
    }
    if (/insufficient|0x1$|debit an account|InsufficientFundsForRent/i.test(msg)) {
      throw new Error(
        cluster === "mainnet"
          ? "Insufficient SOL in your wallet to cover Solana network fees for the mint transaction (rent + signature fee). Add a small amount of SOL and click Try Again — your payment is preserved and you will not be charged again."
          : "Insufficient devnet SOL to cover the mint transaction. Fund this wallet from a devnet faucet and try again.",
      );
    }
    if (cluster === "mainnet" && isMainnetRpcAccessError(err)) {
      throw new Error(
        "Solana mainnet is temporarily unreachable from your browser. Your payment is preserved — please wait a moment and click Try Again. You will not be charged again.",
      );
    }
    throw err;
  }
}
