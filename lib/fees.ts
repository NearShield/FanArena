export const POINT_FEES = {
  prediction: 1,
  tournament: 2,
  creator: 5,
  fanToken: 5,
} as const;

function clean(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

export function creatorSignupMessage(input: {
  address: string;
  name: string;
  bio: string;
  remixUrl: string;
  issuedAt: number;
}) {
  return [
    "FanArena",
    "action:create-creator",
    `issued:${input.issuedAt}`,
    `wallet:${input.address.toLowerCase()}`,
    `fee:${POINT_FEES.creator}`,
    `name:${clean(input.name)}`,
    `bio:${clean(input.bio)}`,
    `url:${clean(input.remixUrl)}`,
  ].join("\n");
}

export function fanTokenMessage(input: {
  address: string;
  name: string;
  symbol: string;
  issuedAt: number;
}) {
  return [
    "FanArena",
    "action:create-token",
    `issued:${input.issuedAt}`,
    `wallet:${input.address.toLowerCase()}`,
    `fee:${POINT_FEES.fanToken}`,
    `name:${clean(input.name)}`,
    `symbol:${clean(input.symbol).toUpperCase()}`,
  ].join("\n");
}
