import "@/lib/polyfills";
import { Buffer } from "buffer";
import {
  Connection,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  Keypair,
  sendAndConfirmRawTransaction,
} from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  MINT_SIZE,
  createInitializeMint2Instruction,
  getMinimumBalanceForRentExemptMint,
  getAssociatedTokenAddressSync,
  createAssociatedTokenAccountInstruction,
  createMintToInstruction,
  createSetAuthorityInstruction,
  AuthorityType,
} from "@solana/spl-token";
import type { SolanaProvider } from "@/components/wallet/WalletContext";
import { rpcForCluster, isMainnetRpcAccessError, type Cluster } from "./cluster";
import { assertSolanaAddress } from "./address";

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
        "Mainnet RPC is unavailable from the browser (403 from public endpoint). " +
          "Set VITE_SOLANA_MAINNET_RPC_URL to a browser-accessible RPC (Helius, QuickNode, Triton, Alchemy) and reload.",
      );
    }
    throw new Error(
      `Failed to reach Solana ${cluster} RPC: ${err instanceof Error ? err.message : String(err)}`,
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
  if (provider.signAndSendTransaction) {
    const res = await provider.signAndSendTransaction(tx);
    signature = res.signature;
  } else {
    const signed = await provider.signTransaction(tx);
    signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
    });
  }

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );
  return signature;
}

export type MintTokenArgs = {
  provider: SolanaProvider;
  payerAddress: string;
  cluster: Cluster;
  decimals: number;
  initialSupply: string; // base-unit-aware string of whole tokens
  revokeFreeze: boolean;
  revokeMint: boolean;
};

export type MintTokenResult = {
  mintAddress: string;
  ataAddress: string;
  signature: string;
};

/**
 * Creates an SPL mint, the payer's ATA, mints initial supply,
 * and optionally revokes mint/freeze authorities — all in one transaction.
 *
 * Note: This omits Metaplex metadata to keep the bundle lean for this phase.
 * Metadata, custom-suffix vanity addresses, and creator-info edits can be
 * layered on later without changing the payment-before-mint contract.
 */
export async function mintToken({
  provider,
  payerAddress,
  cluster,
  decimals,
  initialSupply,
  revokeFreeze,
  revokeMint,
}: MintTokenArgs): Promise<MintTokenResult> {
  const connection = new Connection(rpcForCluster(cluster), "confirmed");
  const payer = new PublicKey(assertSolanaAddress(payerAddress, "Payer wallet address"));

  const mintKeypair = Keypair.generate();
  const mintPk = mintKeypair.publicKey;
  const ata = getAssociatedTokenAddressSync(mintPk, payer);
  const lamportsForMint = await getMinimumBalanceForRentExemptMint(connection);

  // Compute base units = supply * 10^decimals using BigInt
  const supplyBI = BigInt(initialSupply);
  const factor = BigInt(10) ** BigInt(decimals);
  const baseUnits = supplyBI * factor;

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash("confirmed");

  const tx = new Transaction({
    feePayer: payer,
    blockhash,
    lastValidBlockHeight,
  });

  tx.add(
    SystemProgram.createAccount({
      fromPubkey: payer,
      newAccountPubkey: mintPk,
      lamports: lamportsForMint,
      space: MINT_SIZE,
      programId: TOKEN_PROGRAM_ID,
    }),
    createInitializeMint2Instruction(
      mintPk,
      decimals,
      payer, // mint authority (may be revoked below)
      payer, // freeze authority (may be revoked below)
      TOKEN_PROGRAM_ID,
    ),
    createAssociatedTokenAccountInstruction(payer, ata, payer, mintPk),
    createMintToInstruction(mintPk, ata, payer, baseUnits, [], TOKEN_PROGRAM_ID),
  );

  if (revokeFreeze) {
    tx.add(
      createSetAuthorityInstruction(
        mintPk,
        payer,
        AuthorityType.FreezeAccount,
        null,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }
  if (revokeMint) {
    tx.add(
      createSetAuthorityInstruction(
        mintPk,
        payer,
        AuthorityType.MintTokens,
        null,
        [],
        TOKEN_PROGRAM_ID,
      ),
    );
  }

  // Mint keypair must sign the createAccount; wallet signs as fee payer.
  tx.partialSign(mintKeypair);

  let signature: string;
  if (provider.signAndSendTransaction) {
    // Provider may strip our partialSign in some implementations — fall back to manual path.
    try {
      const res = await provider.signAndSendTransaction(tx);
      signature = res.signature;
    } catch {
      const signed = await provider.signTransaction(tx);
      signature = await sendAndConfirmRawTransaction(
        connection,
        Buffer.from(signed.serialize()),
        { commitment: "confirmed" },
      );
    }
  } else {
    const signed = await provider.signTransaction(tx);
    signature = await connection.sendRawTransaction(signed.serialize(), {
      skipPreflight: false,
    });
  }

  await connection.confirmTransaction(
    { signature, blockhash, lastValidBlockHeight },
    "confirmed",
  );

  return {
    mintAddress: mintPk.toBase58(),
    ataAddress: ata.toBase58(),
    signature,
  };
}
