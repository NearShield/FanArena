import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  addGameMessage,
  creatorMessage,
  isCeoAddress,
  removeGameMessage,
} from "@/lib/ceo";
import { getSql } from "@/lib/db";

const httpsUrl = z
  .string()
  .trim()
  .regex(/^https:\/\/\S+$/)
  .max(300);

const issuedAt = z.number().int();
const signature = z.string().regex(/^0x[a-fA-F0-9]{130}$/);

export type PlatformCreator = {
  name: string;
  bio: string;
  remixUrl: string;
};

export type PlatformGame = {
  id: number;
  title: string;
  url: string;
  description: string;
};

function fresh(stamp: number) {
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - stamp) > 10 * 60) {
    throw new Error("That signature expired. Try again.");
  }
}

async function assertCeo(message: string, signed: string) {
  const { recoverMessageAddress } = await import("viem");
  const recovered = await recoverMessageAddress({
    message,
    signature: signed as `0x${string}`,
  });
  if (!isCeoAddress(recovered)) {
    throw new Error("This wallet is not a CEO wallet.");
  }
}

export const getPlatform = createServerFn({ method: "GET" }).handler(async () => {
  const sql = await getSql();
  const creators = await sql<{ name: string; bio: string; remix_url: string }>`
    select name, bio, remix_url from platform_creator where id = 1
  `;
  const games = await sql<{ id: number; title: string; url: string; description: string }>`
    select id, title, url, description from platform_games order by id asc
  `;
  const row = creators[0];
  return {
    creator: row
      ? { name: row.name, bio: row.bio, remixUrl: row.remix_url }
      : null,
    games,
  };
});

const creatorInput = z.object({
  name: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(400),
  remixUrl: httpsUrl,
  issuedAt,
  signature,
});

export const setPinnedCreator = createServerFn({ method: "POST" })
  .validator((input: unknown) => creatorInput.parse(input))
  .handler(async ({ data }) => {
    fresh(data.issuedAt);
    const message = creatorMessage(data);
    await assertCeo(message, data.signature);
    const sql = await getSql();
    await sql`
      insert into platform_creator (id, name, bio, remix_url)
      values (1, ${data.name.trim()}, ${data.bio.trim()}, ${data.remixUrl.trim()})
      on conflict (id) do update
      set name = excluded.name, bio = excluded.bio, remix_url = excluded.remix_url
    `;
    return { ok: true as const };
  });

const gameInput = z.object({
  title: z.string().trim().min(1).max(80),
  url: httpsUrl,
  description: z.string().trim().max(400),
  issuedAt,
  signature,
});

export const addPlatformGame = createServerFn({ method: "POST" })
  .validator((input: unknown) => gameInput.parse(input))
  .handler(async ({ data }) => {
    fresh(data.issuedAt);
    await assertCeo(addGameMessage(data), data.signature);
    const sql = await getSql();
    const rows = await sql<{ id: number }>`
      insert into platform_games (title, url, description)
      values (${data.title.trim()}, ${data.url.trim()}, ${data.description.trim()})
      returning id
    `;
    return { ok: true as const, id: rows[0]?.id ?? 0 };
  });

const removeInput = z.object({
  id: z.number().int().positive(),
  issuedAt,
  signature,
});

export const removePlatformGame = createServerFn({ method: "POST" })
  .validator((input: unknown) => removeInput.parse(input))
  .handler(async ({ data }) => {
    fresh(data.issuedAt);
    await assertCeo(removeGameMessage(data.id, data.issuedAt), data.signature);
    const sql = await getSql();
    await sql`delete from platform_games where id = ${data.id}`;
    return { ok: true as const };
  });
