# FanArena

The floor for Remix creators. Fans open a profile, play the games, and trade Strike perps from the same wallet. Points only arrive after a confirmed Strike fill. Clicking a link does not mint them.

## Point fees

| Action | Fee |
| --- | --- |
| Game jam call | 1 point |
| Tournament entry | 2 points |
| Creator profile | 5 points |
| Fan token | 5 points |

A game jam call and a tournament entry are not charged while no jam or tournament is open. Creator signup and fan-token creation ask the wallet to sign, then spend the fee. The balance starts at 0.

## CEO wallets

These two addresses see the Admin tab and can change the pinned creator and the game list:

- `0x76197edba4f22d96103b84743ed4e7309d432cec`
- `0x1f8c218d09b37e15aa429f37ad934947b96bde2f`

## Run it locally

```bash
npm install
npm run dev
```

Open http://127.0.0.1:8080. With no `DATABASE_URL`, the app uses a local Postgres (PGLite) and applies `migrations/`.

## Deploy on Vercel

1. Push this folder to GitHub.
2. Import the repo in Vercel. Framework preset can stay Vite. Build command: `npm run build`.
3. Add a Postgres database and set `DATABASE_URL` to its connection string. Neon works. Vercel cannot keep the local PGLite database, so production needs this.
4. Redeploy.

Do not set a password for admin. Control is the two CEO wallets above.
