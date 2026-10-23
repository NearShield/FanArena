import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const STRIKE = "https://api.strikefinance.org";
const FEATURED = ["BTC-USD", "ETH-USD", "SOL-USD", "ADA-USD", "XRP-USD", "HYPE-USD"];

const FEE_SHARE_BPS = 50;

export type StrikeMarket = {
  symbol: string;
  markPrice: string;
  fundingRate: string;
};

export type StrikeTrader = {
  address: string;
  equity: string;
  pnl30d: string;
  roi30d: string;
};

export type StrikeVault = {
  name: string;
  equity: string;
  apr: string;
  depositors: number;
};

export type StrikeBoard = {
  markets: StrikeMarket[];
  traders: StrikeTrader[];
  vaults: StrikeVault[];
  error: string | null;
};

async function readJson(res: Response): Promise<unknown> {
  const text = await res.text();
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return { error: text.slice(0, 180) || res.statusText };
  }
}

function errorOf(body: unknown, fallback: string) {
  if (body && typeof body === "object" && "error" in body) {
    const value = (body as { error: unknown }).error;
    if (typeof value === "string" && value.trim()) return value;
  }
  return fallback;
}

export const getStrikeBoard = createServerFn({ method: "GET" }).handler(async (): Promise<StrikeBoard> => {
  const [pricesRes, tradersRes, vaultsRes] = await Promise.allSettled([
    fetch(`${STRIKE}/price/v2/premiumIndex`),
    fetch(`${STRIKE}/v2/copy/discover?platform=strike&limit=8&sort=pnl_30d&order=desc`),
    fetch(`${STRIKE}/v2/vaults?limit=4`),
  ]);

  const markets: StrikeMarket[] = [];
  const traders: StrikeTrader[] = [];
  const vaults: StrikeVault[] = [];
  const problems: string[] = [];

  if (pricesRes.status === "fulfilled" && pricesRes.value.ok) {
    const body = await readJson(pricesRes.value);
    if (Array.isArray(body)) {
      const bySymbol = new Map(
        body
          .filter((row): row is { symbol: string; markPrice: string; fundingRate?: string } => {
            return !!row && typeof row === "object" && "symbol" in row;
          })
          .map((row) => [row.symbol, row]),
      );
      for (const symbol of FEATURED) {
        const row = bySymbol.get(symbol);
        if (!row) continue;
        markets.push({
          symbol,
          markPrice: String(row.markPrice),
          fundingRate: String(row.fundingRate ?? "0"),
        });
      }
    }
  } else {
    problems.push("prices");
  }

  if (tradersRes.status === "fulfilled" && tradersRes.value.ok) {
    const body = (await readJson(tradersRes.value)) as { items?: unknown[] };
    for (const item of body.items ?? []) {
      if (!item || typeof item !== "object") continue;
      const row = item as {
        blockchain_address?: string;
        account_value?: string;
        pnl?: { "30d"?: string };
        roi?: { "30d"?: string };
      };
      if (!row.blockchain_address) continue;
      traders.push({
        address: row.blockchain_address,
        equity: String(row.account_value ?? "0"),
        pnl30d: String(row.pnl?.["30d"] ?? "0"),
        roi30d: String(row.roi?.["30d"] ?? "0"),
      });
    }
  } else {
    problems.push("traders");
  }

  if (vaultsRes.status === "fulfilled" && vaultsRes.value.ok) {
    const body = (await readJson(vaultsRes.value)) as { vaults?: unknown[] };
    for (const item of (body.vaults ?? []).slice(0, 4)) {
      if (!item || typeof item !== "object") continue;
      const row = item as {
        name?: string;
        equity?: string;
        apr?: number | string;
        depositors?: number;
        status?: string;
      };
      if (row.status && row.status !== "active") continue;
      vaults.push({
        name: row.name || "Vault",
        equity: String(row.equity ?? "0"),
        apr: String(row.apr ?? "0"),
        depositors: Number(row.depositors ?? 0),
      });
    }
  } else {
    problems.push("vaults");
  }

  return {
    markets,
    traders,
    vaults,
    error: problems.length === 3 ? "Strike is unreachable right now." : null,
  };
});

const signatureInput = z.object({
  address: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  code: z.string().trim().min(2).max(64),
  publicKey: z.string().regex(/^[a-fA-F0-9]{64}$/),
});

export const requestStrikeSignature = createServerFn({ method: "POST" })
  .validator((input: unknown) => signatureInput.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(`${STRIKE}/auth/builder/request-signature`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        address: data.address,
        chain: "ethereum",
        code: data.code,
        fee_share_bps: FEE_SHARE_BPS,
        public_key: data.publicKey,
      }),
    });
    const body = await readJson(res);
    if (!res.ok || !body || typeof body !== "object") {
      return { ok: false as const, error: errorOf(body, "Strike refused the builder link.") };
    }
    const row = body as { nonce?: string; message_to_sign?: string };
    if (!row.nonce || !row.message_to_sign) {
      return { ok: false as const, error: errorOf(body, "Strike did not return a message to sign.") };
    }
    return {
      ok: true as const,
      nonce: row.nonce,
      messageToSign: row.message_to_sign,
      feeShareBps: FEE_SHARE_BPS,
    };
  });

const verifyInput = z.object({
  nonce: z.string().min(8).max(80),
  walletSignature: z.string().min(10).max(400),
});

export const verifyStrikeSignature = createServerFn({ method: "POST" })
  .validator((input: unknown) => verifyInput.parse(input))
  .handler(async ({ data }) => {
    const res = await fetch(`${STRIKE}/auth/builder/verify-signature`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        nonce: data.nonce,
        wallet_signature: data.walletSignature,
      }),
    });
    const body = await readJson(res);
    if (!res.ok || !body || typeof body !== "object") {
      return { ok: false as const, error: errorOf(body, "Strike did not accept the signature.") };
    }
    const row = body as { account_id?: string; builder_code?: string; fee_share_bps?: number };
    if (!row.account_id) {
      return { ok: false as const, error: errorOf(body, "Strike did not return an account.") };
    }
    return {
      ok: true as const,
      accountId: row.account_id,
      builderCode: row.builder_code ?? "",
      feeShareBps: row.fee_share_bps ?? FEE_SHARE_BPS,
    };
  });
