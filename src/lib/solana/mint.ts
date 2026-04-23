import "@/lib/polyfills";
import { Buffer } from "buffer";
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
  const rpcUrl = rpcForCluster(cluster);
  console.info("[mint] mintToken cluster=", cluster, "rpc=", rpcUrl);
  const connection = new Connection(rpcUrl, "confirmed");
  const payer = new PublicKey(assertSolanaAddress(payerAddress, "Payer wallet address"));

  // Always rebuild a fresh mint keypair + transaction. No state is reused across retries.
  const mintKeypair = Keypair.generate();
  const mintPk = mintKeypair.publicKey;
  const ata = getAssociatedTokenAddressSync(mintPk, payer);

  // Do all slow network calls (rent lookup) BEFORE fetching blockhash, so the
  // blockhash is as fresh as possible when the wallet prompt appears.
  const lamportsForMint = await getMinimumBalanceForRentExemptMint(connection);

  // Compute base units = supply * 10^decimals using BigInt
  const supplyBI = BigInt(initialSupply);
  const factor = BigInt(10) ** BigInt(decimals);
  const baseUnits = supplyBI * factor;

  async function freshBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
    try {
      // "finalized" gives a blockhash all validators agree on — maximizes the
      // window before "block height exceeded" while the user signs in the wallet.
      return await connection.getLatestBlockhash("finalized");
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

  function buildTx(blockhash: string, lastValidBlockHeight: number): Transaction {
    const tx = new Transaction({ feePayer: payer, blockhash, lastValidBlockHeight });
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
          mintPk, payer, AuthorityType.FreezeAccount, null, [], TOKEN_PROGRAM_ID,
        ),
      );
    }
    if (revokeMint) {
      tx.add(
        createSetAuthorityInstruction(
          mintPk, payer, AuthorityType.MintTokens, null, [], TOKEN_PROGRAM_ID,
        ),
      );
    }
    // Mint keypair must sign the createAccount; wallet signs as fee payer.
    tx.partialSign(mintKeypair);
    return tx;
  }

  // Fetch blockhash as late as possible — immediately before building & signing.
  let { blockhash, lastValidBlockHeight } = await freshBlockhash();
  let tx = buildTx(blockhash, lastValidBlockHeight);

  // Strategy: ALWAYS sign locally and broadcast via our (Helius) RPC. Wallet-managed
  // signAndSendTransaction often routes through a slow public RPC, causing the tx to
  // land after the blockhash window closes. Local sign + our RPC + active rebroadcast
  // is the most reliable path on mainnet.
  let signature: string;
  try {
    let signed;
    try {
      signed = await provider.signTransaction(tx);
    } catch (signErr) {
      // Some wallets only expose signAndSendTransaction. Fall back to that path.
      if (provider.signAndSendTransaction) {
        const res = await provider.signAndSendTransaction(tx);
        signature = res.signature;
        await confirmWithRebroadcast(connection, signature, blockhash, lastValidBlockHeight, null);
        return { mintAddress: mintPk.toBase58(), ataAddress: ata.toBase58(), signature };
      }
      throw signErr;
    }

    const rawTx = signed.serialize();
    // Send via our RPC. skipPreflight=true avoids a wasted simulate roundtrip and
    // gets the tx into the leader's mempool faster.
    signature = await connection.sendRawTransaction(rawTx, {
      skipPreflight: true,
      maxRetries: 5,
    });

    await confirmWithRebroadcast(connection, signature, blockhash, lastValidBlockHeight, rawTx);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (/block height exceeded|blockhash not found|TransactionExpired|expired/i.test(msg)) {
      throw new Error(
        "Mint transaction expired before it landed on-chain. The network was congested or signing took too long. Please click Retry to build a fresh transaction.",
      );
    }
    throw err;
  }

  return {
    mintAddress: mintPk.toBase58(),
    ataAddress: ata.toBase58(),
    signature,
  };
}
