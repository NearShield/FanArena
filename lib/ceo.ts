/** The only wallets that can run the admin panel. Both have the same control. */
export const CEO_WALLETS: string[] = [
  "0x76197edba4f22d96103b84743ed4e7309d432cec",
  "0x1f8c218d09b37e15aa429f37ad934947b96bde2f",
];

export function isCeoAddress(address: string | null | undefined) {
  if (!address) return false;
  const lower = address.toLowerCase();
  return CEO_WALLETS.some((wallet) => wallet.toLowerCase() === lower);
}

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function creatorMessage(input: {
  name: string;
  bio: string;
  remixUrl: string;
  issuedAt: number;
}) {
  return [
    "FanArena CEO",
    "action:set-creator",
    `issued:${input.issuedAt}`,
    `name:${clean(input.name)}`,
    `bio:${clean(input.bio)}`,
    `url:${clean(input.remixUrl)}`,
  ].join("\n");
}

export function addGameMessage(input: {
  title: string;
  url: string;
  description: string;
  issuedAt: number;
}) {
  return [
    "FanArena CEO",
    "action:add-game",
    `issued:${input.issuedAt}`,
    `title:${clean(input.title)}`,
    `url:${clean(input.url)}`,
    `desc:${clean(input.description)}`,
  ].join("\n");
}

export function removeGameMessage(id: number, issuedAt: number) {
  return ["FanArena CEO", "action:remove-game", `issued:${issuedAt}`, `id:${id}`].join("\n");
}
