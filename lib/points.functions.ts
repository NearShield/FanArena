import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { POINT_FEES, creatorSignupMessage, fanTokenMessage } from "@/lib/fees";
import { getSql } from "@/lib/db";

const address = z
  .string()
  .trim()
  .regex(/^0x[a-fA-F0-9]{40}$/);
const issuedAt = z.number().int();
const signature = z.string().regex(/^0x[a-fA-F0-9]{130}$/);
const httpsUrl = z
  .string()
  .trim()
  .regex(/^https:\/\/\S+$/)
  .max(300);

export type FanAccount = {
  balance: number;
  creator: { name: string; bio: string; remixUrl: string } | null;
  token: { name: string; symbol: string } | null;
};

export type ListedCreator = {
  address: string;
  name: string;
  bio: string;
  remixUrl: string;
};

function fresh(stamp: number) {
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - stamp) > 10 * 60) {
    throw new Error("That signature expired. Try again.");
  }
}

async function signerOf(message: string, signed: string) {
  const { recoverMessageAddress } = await import("viem");
  return (await recoverMessageAddress({
    message,
    signature: signed as `0x${string}`,
  })).toLowerCase();
}

async function charge(wallet: string, fee: number, reason: string) {
  const sql = await getSql();
  await sql`insert into point_accounts (address, balance) values (${wallet}, 0) on conflict (address) do nothing`;
  const spent = await sql<{ balance: number }>`
    update point_accounts
    set balance = balance - ${fee}
    where address = ${wallet} and balance >= ${fee}
    returning balance
  `;
  if (!spent.length) {
    throw new Error(`You need ${fee} points. Trading on Strike is the only way to earn them.`);
  }
  await sql`
    insert into point_ledger (address, delta, reason)
    values (${wallet}, ${-fee}, ${reason})
  `;
  return spent[0].balance;
}

async function refund(wallet: string, fee: number, reason: string) {
  const sql = await getSql();
  await sql`update point_accounts set balance = balance + ${fee} where address = ${wallet}`;
  await sql`
    insert into point_ledger (address, delta, reason)
    values (${wallet}, ${fee}, ${reason})
  `;
}

export const getFanAccount = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ address }).parse(input))
  .handler(async ({ data }): Promise<FanAccount> => {
    const wallet = data.address.toLowerCase();
    const sql = await getSql();
    const balances = await sql<{ balance: number }>`
      select balance from point_accounts where address = ${wallet}
    `;
    const creators = await sql<{ name: string; bio: string; remix_url: string }>`
      select name, bio, remix_url from fan_creators where address = ${wallet}
    `;
    const tokens = await sql<{ name: string; symbol: string }>`
      select name, symbol from fan_tokens where address = ${wallet}
    `;
    const creator = creators[0];
    const token = tokens[0];
    return {
      balance: Number(balances[0]?.balance ?? 0),
      creator: creator ? { name: creator.name, bio: creator.bio, remixUrl: creator.remix_url } : null,
      token: token ? { name: token.name, symbol: token.symbol } : null,
    };
  });

export const listFanCreators = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const rows = await sql<{ address: string; name: string; bio: string; remix_url: string }>`
    select address, name, bio, remix_url from fan_creators order by created_at desc limit 20
  `;
  return rows.map((row) => ({
    address: row.address,
    name: row.name,
    bio: row.bio,
    remixUrl: row.remix_url,
  })) satisfies ListedCreator[];
});

const creatorInput = z.object({
  address,
  name: z.string().trim().min(1).max(40),
  bio: z.string().trim().max(160),
  remixUrl: httpsUrl,
  issuedAt,
  signature,
});

export const createFanCreator = createServerFn({ method: "POST" })
  .validator((input: unknown) => creatorInput.parse(input))
  .handler(async ({ data }) => {
    fresh(data.issuedAt);
    const wallet = data.address.toLowerCase();
    const message = creatorSignupMessage(data);
    if ((await signerOf(message, data.signature)) !== wallet) {
      throw new Error("The signature does not match this wallet.");
    }
    const sql = await getSql();
    const existing = await sql`select address from fan_creators where address = ${wallet}`;
    if (existing.length) throw new Error("This wallet already has a creator profile.");
    const balance = await charge(wallet, POINT_FEES.creator, "creator");
    try {
      await sql`
        insert into fan_creators (address, name, bio, remix_url)
        values (${wallet}, ${data.name.trim()}, ${data.bio.trim()}, ${data.remixUrl.trim()})
      `;
    } catch (err) {
      await refund(wallet, POINT_FEES.creator, "creator-refund");
      throw err;
    }
    return { ok: true as const, balance };
  });

const tokenInput = z.object({
  address,
  name: z.string().trim().min(1).max(32),
  symbol: z.string().trim().regex(/^[A-Za-z]{2,8}$/),
  issuedAt,
  signature,
});

export const createFanToken = createServerFn({ method: "POST" })
  .validator((input: unknown) => tokenInput.parse(input))
  .handler(async ({ data }) => {
    fresh(data.issuedAt);
    const wallet = data.address.toLowerCase();
    const symbol = data.symbol.trim().toUpperCase();
    const message = fanTokenMessage({ ...data, symbol });
    if ((await signerOf(message, data.signature)) !== wallet) {
      throw new Error("The signature does not match this wallet.");
    }
    const sql = await getSql();
    const existing = await sql`select address from fan_tokens where address = ${wallet}`;
    if (existing.length) throw new Error("This wallet already has a fan token.");
    const balance = await charge(wallet, POINT_FEES.fanToken, "fan-token");
    try {
      await sql`
        insert into fan_tokens (address, name, symbol)
        values (${wallet}, ${data.name.trim()}, ${symbol})
      `;
    } catch (err) {
      await refund(wallet, POINT_FEES.fanToken, "fan-token-refund");
      throw err;
    }
    return { ok: true as const, balance };
  });
