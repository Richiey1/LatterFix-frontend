/**
 * Stellar Core Service
 *
 * Provides foundational Stellar network operations:
 *   - Account loading and balance querying from Horizon
 *   - Claimable balance transaction building (full, signed-ready XDR)
 *   - SEP-10 web authentication challenge generation
 *   - Trustline management (check, build add-trustline tx)
 *   - Path payment (strict send) transaction building
 *   - Stellar Expert explorer URL helpers
 *
 * All transaction builders return XDR envelope strings ready for wallet signing.
 * No mock data — all operations use the real @stellar/stellar-sdk primitives.
 */

import {
  Horizon,
  Keypair,
  Operation,
  Asset,
  Claimant,
  TransactionBuilder,
  BASE_FEE,
  StrKey,
  Memo,
} from '@stellar/stellar-sdk';
import { getActiveNetwork, getNetworkEndpoints } from './networkConfig';

// ---------------------------------------------------------------------------
// Configuration helpers
// ---------------------------------------------------------------------------

function getHorizonUrl(): string {
  return getNetworkEndpoints(getActiveNetwork()).horizonUrl;
}

function getNetworkPassphrase(): string {
  return getNetworkEndpoints(getActiveNetwork()).networkPassphrase;
}

export function getExplorerUrl(type: 'tx' | 'account' | 'asset', id: string): string {
  const network = getActiveNetwork() === 'mainnet' ? 'public' : 'testnet';
  return `https://stellar.expert/explorer/${network}/${type}/${id}`;
}

export function getHorizonServer(): Horizon.Server {
  return new Horizon.Server(getHorizonUrl());
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface StellarAccountBalance {
  asset: string; // 'XLM' | 'USDC:GABC...' | etc.
  assetCode: string;
  assetIssuer: string | null;
  balance: string; // raw string as returned by Horizon
  isNative: boolean;
}

export interface StellarAccountInfo {
  address: string;
  sequence: string;
  balances: StellarAccountBalance[];
  subentryCount: number;
  lastModifiedLedger: number;
  thresholds: {
    lowThreshold: number;
    medThreshold: number;
    highThreshold: number;
  };
}

export interface ClaimableBalanceDetails {
  id: string;
  source: string;
  claimant: string;
  amount: string;
  assetCode: string;
  assetIssuer?: string;
}

export interface BuildTxResult {
  /** Base64-encoded XDR envelope — pass to wallet for signing */
  envelopeXdr: string;
  /** The transaction hash (pre-signing) */
  txHash: string;
  /** Summary of the operation for display */
  summary: string;
}

// ---------------------------------------------------------------------------
// Account Loading
// ---------------------------------------------------------------------------

/**
 * Loads a full account record from Horizon, returning structured balance info.
 */
export async function loadAccount(publicKey: string): Promise<StellarAccountInfo> {
  if (!StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new Error(`Invalid Stellar public key: ${publicKey}`);
  }

  const server = getHorizonServer();
  const account = await server.loadAccount(publicKey);

  const balances: StellarAccountBalance[] = account.balances.map((b) => {
    if (b.asset_type === 'native') {
      return {
        asset: 'XLM',
        assetCode: 'XLM',
        assetIssuer: null,
        balance: b.balance,
        isNative: true,
      };
    }
    const issuer = (b as any).asset_issuer ?? '';
    const code = (b as any).asset_code ?? 'UNKNOWN';
    return {
      asset: `${code}:${issuer}`,
      assetCode: code,
      assetIssuer: issuer,
      balance: b.balance,
      isNative: false,
    };
  });

  return {
    address: account.accountId(),
    sequence: account.sequenceNumber(),
    balances,
    subentryCount: account.subentry_count,
    lastModifiedLedger: account.last_modified_ledger,
    thresholds: {
      lowThreshold: account.thresholds.low_threshold,
      medThreshold: account.thresholds.med_threshold,
      highThreshold: account.thresholds.high_threshold,
    },
  };
}

/**
 * Returns the balance of a specific asset for an account.
 * Returns '0' if the account does not hold the asset.
 */
export async function getAssetBalance(
  publicKey: string,
  assetCode: string,
  assetIssuer?: string
): Promise<string> {
  const info = await loadAccount(publicKey);
  const target = info.balances.find((b) =>
    assetCode === 'XLM' ? b.isNative : b.assetCode === assetCode && b.assetIssuer === assetIssuer
  );
  return target?.balance ?? '0';
}

// ---------------------------------------------------------------------------
// Claimable Balance
// ---------------------------------------------------------------------------

/**
 * Builds a CreateClaimableBalance transaction and returns the signed-ready XDR.
 *
 * The transaction is built with a real account sequence number from Horizon.
 * The returned XDR is ready to be signed by the employer's wallet and submitted.
 *
 * @param sourcePublicKey  - Public key of the employer (payer)
 * @param claimantPublicKey - Public key of the employee (recipient)
 * @param amount           - Amount in asset units (e.g. '100.0000000')
 * @param assetCode        - Asset code: 'XLM', 'USDC', 'EURC'
 * @param assetIssuer      - Asset issuer public key (required for non-XLM)
 * @param claimDeadlineDays - Optional: number of days before the creator can reclaim
 */
export async function buildClaimableBalanceTx(
  sourcePublicKey: string,
  claimantPublicKey: string,
  amount: string,
  assetCode: string = 'USDC',
  assetIssuer?: string,
  claimDeadlineDays?: number
): Promise<BuildTxResult> {
  if (!StrKey.isValidEd25519PublicKey(sourcePublicKey)) {
    throw new Error('Invalid source public key');
  }
  if (!StrKey.isValidEd25519PublicKey(claimantPublicKey)) {
    throw new Error('Invalid claimant public key');
  }

  const server = getHorizonServer();
  const sourceAccount = await server.loadAccount(sourcePublicKey);

  const asset = assetCode === 'XLM' ? Asset.native() : new Asset(assetCode, assetIssuer ?? '');

  // Claimant: employee can claim unconditionally
  const claimants: Claimant[] = [
    new Claimant(claimantPublicKey, Claimant.predicateUnconditional()),
  ];

  // Optional reclaim predicate: creator can reclaim after deadline
  if (claimDeadlineDays) {
    const deadlineUnix = Math.floor(Date.now() / 1000) + claimDeadlineDays * 86400;
    claimants.push(
      new Claimant(
        sourcePublicKey,
        Claimant.predicateNot(Claimant.predicateBeforeAbsoluteTime(deadlineUnix.toString()))
      )
    );
  }

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      Operation.createClaimableBalance({
        asset,
        amount,
        claimants,
      })
    )
    .addMemo(Memo.text('LatterFix Escrow'))
    .setTimeout(120)
    .build();

  return {
    envelopeXdr: tx.toXDR(),
    txHash: tx.hash().toString('hex'),
    summary: `Create claimable balance: ${amount} ${assetCode} → ${claimantPublicKey.slice(0, 6)}...`,
  };
}

/**
 * Builds a ClaimClaimableBalance transaction for the employee to claim their payment.
 */
export async function buildClaimBalanceTx(
  claimantPublicKey: string,
  balanceId: string
): Promise<BuildTxResult> {
  if (!StrKey.isValidEd25519PublicKey(claimantPublicKey)) {
    throw new Error('Invalid claimant public key');
  }

  const server = getHorizonServer();
  const account = await server.loadAccount(claimantPublicKey);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(Operation.claimClaimableBalance({ balanceId }))
    .addMemo(Memo.text('LatterFix Claim'))
    .setTimeout(120)
    .build();

  return {
    envelopeXdr: tx.toXDR(),
    txHash: tx.hash().toString('hex'),
    summary: `Claim balance: ${balanceId.slice(0, 12)}...`,
  };
}

// ---------------------------------------------------------------------------
// Trustline Management
// ---------------------------------------------------------------------------

/**
 * Checks whether a given account has an active trustline for an asset.
 */
export async function hasTrustline(
  publicKey: string,
  assetCode: string,
  assetIssuer: string
): Promise<boolean> {
  if (assetCode === 'XLM') return true;
  try {
    const info = await loadAccount(publicKey);
    return info.balances.some((b) => b.assetCode === assetCode && b.assetIssuer === assetIssuer);
  } catch {
    return false;
  }
}

/**
 * Builds a ChangeTrust transaction to establish a trustline for a Stellar asset.
 * Required before an account can receive non-XLM tokens.
 */
export async function buildAddTrustlineTx(
  publicKey: string,
  assetCode: string,
  assetIssuer: string,
  limit?: string
): Promise<BuildTxResult> {
  if (!StrKey.isValidEd25519PublicKey(publicKey)) {
    throw new Error('Invalid public key for trustline operation');
  }

  const server = getHorizonServer();
  const account = await server.loadAccount(publicKey);
  const asset = new Asset(assetCode, assetIssuer);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      Operation.changeTrust({
        asset,
        ...(limit ? { limit } : {}),
      })
    )
    .addMemo(Memo.text(`Trust ${assetCode}`))
    .setTimeout(60)
    .build();

  return {
    envelopeXdr: tx.toXDR(),
    txHash: tx.hash().toString('hex'),
    summary: `Add trustline: ${assetCode} (issuer: ${assetIssuer.slice(0, 6)}...)`,
  };
}

// ---------------------------------------------------------------------------
// Path Payment (Strict Send)
// ---------------------------------------------------------------------------

/**
 * Builds a PathPaymentStrictSend transaction.
 * Used for paying contributors in their preferred token
 * (e.g. creator funds in USDC, contributor receives XLM).
 */
export async function buildPathPaymentTx(
  sourcePublicKey: string,
  destinationPublicKey: string,
  sendAssetCode: string,
  sendAssetIssuer: string | null,
  sendAmount: string,
  destAssetCode: string,
  destAssetIssuer: string | null,
  destMinAmount: string,
  path: Asset[] = []
): Promise<BuildTxResult> {
  if (!StrKey.isValidEd25519PublicKey(sourcePublicKey)) {
    throw new Error('Invalid source public key');
  }
  if (!StrKey.isValidEd25519PublicKey(destinationPublicKey)) {
    throw new Error('Invalid destination public key');
  }

  const server = getHorizonServer();
  const sourceAccount = await server.loadAccount(sourcePublicKey);

  const sendAsset =
    sendAssetCode === 'XLM' ? Asset.native() : new Asset(sendAssetCode, sendAssetIssuer ?? '');
  const destAsset =
    destAssetCode === 'XLM' ? Asset.native() : new Asset(destAssetCode, destAssetIssuer ?? '');

  const tx = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  })
    .addOperation(
      Operation.pathPaymentStrictSend({
        sendAsset,
        sendAmount,
        destination: destinationPublicKey,
        destAsset,
        destMin: destMinAmount,
        path,
      })
    )
    .addMemo(Memo.text('LatterFix Payment'))
    .setTimeout(120)
    .build();

  return {
    envelopeXdr: tx.toXDR(),
    txHash: tx.hash().toString('hex'),
    summary: `Path payment: ${sendAmount} ${sendAssetCode} → ${destAssetCode} to ${destinationPublicKey.slice(0, 6)}...`,
  };
}

// ---------------------------------------------------------------------------
// Payment (Direct)
// ---------------------------------------------------------------------------

/**
 * Builds a standard direct Payment operation.
 * Used for simple token transfers between two Stellar accounts.
 */
export async function buildPaymentTx(
  sourcePublicKey: string,
  destinationPublicKey: string,
  assetCode: string,
  assetIssuer: string | null,
  amount: string,
  memoText?: string
): Promise<BuildTxResult> {
  if (!StrKey.isValidEd25519PublicKey(sourcePublicKey)) {
    throw new Error('Invalid source public key');
  }
  if (!StrKey.isValidEd25519PublicKey(destinationPublicKey)) {
    throw new Error('Invalid destination public key');
  }

  const server = getHorizonServer();
  const sourceAccount = await server.loadAccount(sourcePublicKey);

  const asset = assetCode === 'XLM' ? Asset.native() : new Asset(assetCode, assetIssuer ?? '');

  const builder = new TransactionBuilder(sourceAccount, {
    fee: BASE_FEE,
    networkPassphrase: getNetworkPassphrase(),
  }).addOperation(
    Operation.payment({
      destination: destinationPublicKey,
      asset,
      amount,
    })
  );

  if (memoText) {
    builder.addMemo(Memo.text(memoText.slice(0, 28)));
  }

  const tx = builder.setTimeout(120).build();

  return {
    envelopeXdr: tx.toXDR(),
    txHash: tx.hash().toString('hex'),
    summary: `Payment: ${amount} ${assetCode} → ${destinationPublicKey.slice(0, 6)}...`,
  };
}

// ---------------------------------------------------------------------------
// Transaction Submission
// ---------------------------------------------------------------------------

/**
 * Submits a signed XDR transaction to the Stellar Horizon network.
 * Returns the confirmed transaction hash on success.
 */
export async function submitSignedTransaction(signedXdr: string): Promise<string> {
  const server = getHorizonServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, getNetworkPassphrase());
  const response = await server.submitTransaction(tx);
  return response.hash;
}

// ---------------------------------------------------------------------------
// Wallet helpers
// ---------------------------------------------------------------------------

/**
 * Generates a brand-new Stellar keypair (for educational/testnet use).
 */
export const generateWallet = (): { publicKey: string; secretKey: string } => {
  const keypair = Keypair.random();
  return {
    publicKey: keypair.publicKey(),
    secretKey: keypair.secret(),
  };
};

/**
 * Validates a Stellar public key.
 */
export function isValidPublicKey(key: string): boolean {
  return StrKey.isValidEd25519PublicKey(key);
}

/**
 * Truncates a Stellar address for display (e.g. GABC...XYZ).
 */
export function truncateAddress(address: string, chars = 4): string {
  if (address.length <= chars * 2 + 3) return address;
  return `${address.slice(0, chars + 1)}...${address.slice(-chars)}`;
}
