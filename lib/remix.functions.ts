import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const pageUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "remix.gg" && url.pathname.startsWith("/g/");
  }, "Only a remix.gg game link can be opened here.");

const profileUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "remix.gg" && url.pathname.startsWith("/@");
  }, "Only a remix.gg profile link can be opened here.");

export type RemixProfileGame = {
  id: string;
  title: string;
};

type GameRecord = {
  id?: string;
  name?: string;
  liveVersionId?: string | null;
};

function playerUrl(id: string, versionId: string) {
  return `https://g-${id}.games.remix.gg/versions/${versionId}?v=0.2.3&isolation=origin-1`;
}

function gameKey(page: string) {
  const parts = new URL(page).pathname.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? "";
}

async function remixGame(key: string): Promise<GameRecord | null> {
  const input = encodeURIComponent(JSON.stringify({ 0: { json: { id: key } } }));
  const response = await fetch(`https://remix.gg/api/rs/trpc/game.public.byId?batch=1&input=${input}`, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as Array<{ result?: { data?: { json?: GameRecord } } }>;
  return payload[0]?.result?.data?.json ?? null;
}

export const getRemixPlayer = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ pageUrl }).parse(input))
  .handler(async ({ data }) => {
    const game = await remixGame(gameKey(data.pageUrl));
    if (!game?.id || !game.liveVersionId) {
      return { ok: false as const, error: "Remix did not return a playable version of this game." };
    }
    return {
      ok: true as const,
      id: game.id,
      title: game.name || "Game",
      playerUrl: playerUrl(game.id, game.liveVersionId),
    };
  });

export const getRemixProfile = createServerFn({ method: "GET" })
  .validator((input: unknown) => z.object({ profileUrl }).parse(input))
  .handler(async ({ data }) => {
    const response = await fetch(data.profileUrl, { headers: { accept: "text/html" } });
    if (!response.ok) {
      return { ok: false as const, error: "Remix did not return this profile." };
    }
    const html = await response.text();
    const games: RemixProfileGame[] = [];
    const seen = new Set<string>();
    const anchors = html.match(/<a\b[^>]*href="\/g\/[0-9a-f-]{36}"[^>]*>/g) ?? [];
    for (const anchor of anchors) {
      const id = anchor.match(/href="\/g\/([0-9a-f-]{36})"/)?.[1];
      const title = anchor.match(/aria-label="Play ([^"]+)"/)?.[1];
      if (!id || !title || seen.has(id)) continue;
      seen.add(id);
      games.push({
        id,
        title: title
          .replace(/&/g, "&")
          .replace(/"/g, '"')
          .replace(/&#39;/g, "'")
          .replace(/</g, "<")
          .replace(/>/g, ">"),
      });
      if (games.length >= 18) break;
    }
    if (!games.length) {
      return { ok: false as const, error: "No games were listed on this Remix profile." };
    }
    return { ok: true as const, games };
  });
