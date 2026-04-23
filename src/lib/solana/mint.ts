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
  initialSupply: string;
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
  const rpcUrl = rpcForCluster(cluster);
  console.info("[mint] mintToken cluster=", cluster, "rpc=", rpcUrl);
  const connection = new Connection(rpcUrl, "confirmed");
  const payer = new PublicKey(assertSolanaAddress(payerAddress, "Payer wallet address"));

  // Every mint attempt gets a brand-new keypair and addresses.
  const mintKeypair = Keypair.generate();
  const mintPk = mintKeypair.publicKey;
  const ata = getAssociatedTokenAddressSync(mintPk, payer);

  // Do slower preparation work first. The transaction itself is built only after
  // fetching the fresh blockhash right before signing.
  const lamportsForMint = await getMinimumBalanceForRentExemptMint(connection);
  const supplyBI = BigInt(initialSupply);
  const factor = BigInt(10) ** BigInt(decimals);
  const baseUnits = supplyBI * factor;

  let failurePoint = "prepare";

  async function getFreshBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    failurePoint = "getLatestBlockhash";
    console.info("[mint] mintToken blockhash fetch start", { cluster });
    try {
      const bh = await connection.getLatestBlockhash("confirmed");
      console.info("[mint] mintToken blockhash fetched", {
        cluster,
        blockhash: bh.blockhash,
        lastValidBlockHeight: bh.lastValidBlockHeight,
      });
      return bh;
    } catch (err) {
      console.error("[mint] getLatestBlockhash failed", { cluster, rpcUrl, err });
      if (cluster === "mainnet" && isMainnetRpcAccessError(err)) {
        throw new Error(
          "Mainnet RPC is unavailable from the browser (403 from public endpoint). " +
            "Set VITE_SOLANA_MAINNET_RPC_URL to a browser-accessible RPC and reload.",
        );
      }
      throw new Error(
        `Failed to reach Solana ${cluster} RPC: ${err instanceof Error ? err.message : String(err)}`,
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
        payer,
        payer,
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

    tx.partialSign(mintKeypair);

    let signature: string;
    if (provider.signTransaction) {
      failurePoint = "signTransaction";
      console.info("[mint] mintToken signing start", { cluster, blockhash });
      const signed = await provider.signTransaction(tx);

      failurePoint = "sendRawTransaction";
      console.info("[mint] mintToken send start", { cluster, blockhash });
      signature = await connection.sendRawTransaction(signed.serialize(), {
        skipPreflight: false,
        maxRetries: 5,
      });
    } else if (provider.signAndSendTransaction) {
      failurePoint = "signAndSendTransaction";
      console.info("[mint] mintToken signAndSend start", { cluster, blockhash });
      const res = await provider.signAndSendTransaction(tx);
      signature = res.signature;
    } else {
      throw new Error("Connected wallet does not support Solana transaction signing.");
    }

    failurePoint = "confirmTransaction";
    console.info("[mint] mintToken confirm start", {
      cluster,
      signature,
      blockhash,
      lastValidBlockHeight,
    });
    await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed",
    );

    return {
      mintAddress: mintPk.toBase58(),
      ataAddress: ata.toBase58(),
      signature,
    };
  } catch (err) {
    console.error("[mint] mintToken failed", {
      cluster,
      failurePoint,
      err,
    });
    const msg = err instanceof Error ? err.message : String(err);
    if (/block height exceeded|blockhash not found|TransactionExpired|expired/i.test(msg)) {
      throw new Error(
        "Mint transaction expired before it was confirmed. Please click Try Again to build a fresh mint transaction.",
      );
    }
    throw err;
  }
}
