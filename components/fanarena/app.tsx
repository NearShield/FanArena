import { useEffect, useRef, useState, type RefObject } from "react";
import { Briefcase, Coins, Gift, LayoutGrid, Medal, Shield, Store, Trophy, Users } from "lucide-react";
import { addGameMessage, creatorMessage, isCeoAddress, removeGameMessage } from "@/lib/ceo";
import {
  addPlatformGame,
  getPlatform,
  removePlatformGame,
  setPinnedCreator,
  type PlatformCreator,
  type PlatformGame,
} from "@/lib/platform.functions";
import {
  getStrikeBoard,
  requestStrikeSignature,
  verifyStrikeSignature,
  type StrikeBoard,
} from "@/lib/strike.functions";
import { POINT_FEES, creatorSignupMessage, fanTokenMessage } from "@/lib/fees";
import {
  createFanCreator,
  createFanToken,
  getFanAccount,
  listFanCreators,
  type FanAccount,
  type ListedCreator,
} from "@/lib/points.functions";
import { getRemixPlayer, getRemixProfile, type RemixProfileGame } from "@/lib/remix.functions";
import { shortAddress, useWallet } from "./use-wallet";

const STRIKE_APP = "https://app.strikefinance.org";
const FALLBACK_CREATOR: PlatformCreator = {
  name: "Andrei RPK",
  bio: "Building games on Remix.",
  remixUrl: "https://remix.gg/@andrei_rpk",
};

const FALLBACK_GAMES: PlatformGame[] = [
  {
    id: 0,
    title: "Endgame Legends",
    url: "https://remix.gg/g/endgame-legends",
    description:
      "Choose your legendary hero and defend a ruined compound from an invading alien army. Co-op mode available.",
  },
];

type Tab =
  | "dashboard"
  | "creators"
  | "tournaments"
  | "tokens"
  | "marketplace"
  | "portfolio"
  | "rewards"
  | "leaderboard"
  | "admin";

type StrikeLink = {
  accountId: string;
  builderCode: string;
  feeShareBps: number;
};

type RemixStage = {
  id: string;
  title: string;
  pageUrl: string;
  playerUrl: string;
};

const TABS: { id: Tab; label: string; icon: typeof LayoutGrid }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutGrid },
  { id: "creators", label: "Creators", icon: Users },
  { id: "tournaments", label: "Tournaments", icon: Trophy },
  { id: "tokens", label: "Fan Tokens", icon: Coins },
  { id: "marketplace", label: "Marketplace", icon: Store },
  { id: "portfolio", label: "Portfolio", icon: Briefcase },
  { id: "rewards", label: "Rewards", icon: Gift },
  { id: "leaderboard", label: "Leaderboard", icon: Medal },
  { id: "admin", label: "Admin", icon: Shield },
];

function money(value: string, digits = 0) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
    minimumFractionDigits: digits,
  });
}

function price(value: string) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "—";
  const digits = amount >= 1000 ? 2 : amount >= 1 ? 4 : 6;
  return amount.toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: digits,
  });
}

function funding(value: string) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return "—";
  return `${(rate * 100).toFixed(4)}%`;
}

function percent(value: string) {
  const rate = Number(value);
  if (!Number.isFinite(rate)) return "—";
  const shown = Math.abs(rate) <= 2 ? rate * 100 : rate;
  const sign = shown > 0 ? "+" : "";
  return `${sign}${shown.toFixed(1)}%`;
}

function linkKey(address: string) {
  return `fanarena.strike.${address.toLowerCase()}`;
}

export function FanArena() {
  const wallet = useWallet();
  const [tab, setTab] = useState<Tab>("dashboard");
  const [board, setBoard] = useState<StrikeBoard | null>(null);
  const [loading, setLoading] = useState(true);
  const [stage, setStage] = useState<RemixStage | null>(null);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [stageError, setStageError] = useState<string | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileGames, setProfileGames] = useState<RemixProfileGame[]>([]);
  const [profileError, setProfileError] = useState<string | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [account, setAccount] = useState<FanAccount>({ balance: 0, creator: null, token: null });
  const [fanCreators, setFanCreators] = useState<ListedCreator[]>([]);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [feeBusy, setFeeBusy] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);
  const [builderCode, setBuilderCode] = useState("");
  const [link, setLink] = useState<StrikeLink | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [linking, setLinking] = useState(false);
  const [creator, setCreator] = useState<PlatformCreator>(FALLBACK_CREATOR);
  const [games, setGames] = useState<PlatformGame[]>(FALLBACK_GAMES);
  const ceo = isCeoAddress(wallet.address);

  useEffect(() => {
    let alive = true;
    getPlatform()
      .then((platform) => {
        if (!alive) return;
        if (platform.creator) setCreator(platform.creator);
        if (platform.games.length) setGames(platform.games);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    const saved = localStorage.getItem("fanarena.builder");
    if (saved) setBuilderCode(saved);
  }, []);

  useEffect(() => {
    if (!wallet.address) {
      setLink(null);
      return;
    }
    const raw = localStorage.getItem(linkKey(wallet.address));
    if (!raw) {
      setLink(null);
      return;
    }
    try {
      setLink(JSON.parse(raw) as StrikeLink);
    } catch {
      setLink(null);
    }
  }, [wallet.address]);

  useEffect(() => {
    let alive = true;
    getStrikeBoard()
      .then((next) => {
        if (alive) setBoard(next);
      })
      .catch(() => {
        if (alive) {
          setBoard({ markets: [], traders: [], vaults: [], error: "Strike is unreachable right now." });
        }
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    const load = wallet.address
      ? getFanAccount({ data: { address: wallet.address } })
      : Promise.resolve({ balance: 0, creator: null, token: null } satisfies FanAccount);
    load
      .then((next) => {
        if (alive) setAccount(next);
      })
      .catch(() => {
        if (alive) setAccount({ balance: 0, creator: null, token: null });
      });
    return () => {
      alive = false;
    };
  }, [wallet.address]);

  useEffect(() => {
    let alive = true;
    listFanCreators()
      .then((rows) => {
        if (alive) setFanCreators(rows);
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [account.creator]);

  useEffect(() => {
    if (!ceo && tab === "admin") setTab("dashboard");
  }, [ceo, tab]);

  useEffect(() => {
    setFeeError(null);
  }, [tab]);

  useEffect(() => {
    if (stage) stageRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [stage]);

  async function playRemix(pageUrl: string) {
    const key = pageUrl.split("/").filter(Boolean).pop() ?? pageUrl;
    if (stage && (stage.pageUrl === pageUrl || stage.id === key)) {
      setStage(null);
      return;
    }
    setOpeningId(key);
    setStageError(null);
    try {
      const result = await getRemixPlayer({ data: { pageUrl } });
      if (!result.ok) {
        setStageError(result.error);
        return;
      }
      setStage({ id: result.id, title: result.title, pageUrl, playerUrl: result.playerUrl });
    } catch {
      setStageError("Could not open this Remix game.");
    } finally {
      setOpeningId(null);
    }
  }

  async function toggleProfile() {
    if (profileOpen) {
      setProfileOpen(false);
      return;
    }
    setProfileOpen(true);
    setProfileError(null);
    setProfileLoading(true);
    try {
      const result = await getRemixProfile({ data: { profileUrl: creator.remixUrl } });
      if (!result.ok) {
        setProfileGames([]);
        setProfileError(result.error);
        return;
      }
      setProfileGames(result.games);
    } catch {
      setProfileGames([]);
      setProfileError("Could not load this Remix profile.");
    } finally {
      setProfileLoading(false);
    }
  }

  async function signUpCreator(input: { name: string; bio: string; remixUrl: string }) {
    if (!wallet.address) {
      setFeeError("Connect a wallet first.");
      return;
    }
    setFeeBusy(true);
    setFeeError(null);
    try {
      const issuedAt = Math.floor(Date.now() / 1000);
      const message = creatorSignupMessage({ address: wallet.address, issuedAt, ...input });
      const signature = await wallet.signMessage(message, wallet.address);
      const result = await createFanCreator({
        data: { address: wallet.address, issuedAt, signature, ...input },
      });
      setAccount(await getFanAccount({ data: { address: wallet.address } }));
      setFeeError(null);
      return result.balance;
    } catch (err) {
      setFeeError(err instanceof Error ? err.message : "Could not create the profile.");
    } finally {
      setFeeBusy(false);
    }
  }

  async function signUpToken(input: { name: string; symbol: string }) {
    if (!wallet.address) {
      setFeeError("Connect a wallet first.");
      return;
    }
    setFeeBusy(true);
    setFeeError(null);
    try {
      const issuedAt = Math.floor(Date.now() / 1000);
      const message = fanTokenMessage({ address: wallet.address, issuedAt, ...input });
      const signature = await wallet.signMessage(message, wallet.address);
      await createFanToken({
        data: { address: wallet.address, issuedAt, signature, ...input },
      });
      setAccount(await getFanAccount({ data: { address: wallet.address } }));
    } catch (err) {
      setFeeError(err instanceof Error ? err.message : "Could not create the fan token.");
    } finally {
      setFeeBusy(false);
    }
  }

  async function linkStrike() {
    setLinkError(null);
    if (!wallet.address) {
      setLinkError("Connect a wallet first.");
      return;
    }
    const code = builderCode.trim();
    if (code.length < 2) {
      setLinkError("Paste the builder code from your Strike dashboard.");
      return;
    }
    setLinking(true);
    try {
      const ed = await import("@noble/ed25519");
      const keys = await ed.keygenAsync();
      const publicKey = Array.from(keys.publicKey)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
      const requested = await requestStrikeSignature({
        data: { address: wallet.address, code, publicKey },
      });
      if (!requested.ok) throw new Error(requested.error);
      const signature = await wallet.signMessage(requested.messageToSign, wallet.address);
      const verified = await verifyStrikeSignature({
        data: { nonce: requested.nonce, walletSignature: signature },
      });
      if (!verified.ok) throw new Error(verified.error);
      const next = {
        accountId: verified.accountId,
        builderCode: verified.builderCode || code,
        feeShareBps: verified.feeShareBps,
      };
      localStorage.setItem("fanarena.builder", code);
      localStorage.setItem(linkKey(wallet.address), JSON.stringify(next));
      setLink(next);
    } catch (err) {
      setLinkError(err instanceof Error ? err.message : "Could not link Strike.");
    } finally {
      setLinking(false);
    }
  }

  return (
    <div className="min-h-screen bg-bg text-fg">
      <header className="sticky top-0 z-20 border-b border-line bg-bg/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div>
            <p className="font-display text-lg leading-none font-extrabold tracking-tight">
              Fan<span className="text-primary">Arena</span>
            </p>
            <p className="mt-1 text-xs text-muted">Live on Strike</p>
          </div>
          <ConnectButton
            address={wallet.address}
            busy={wallet.busy}
            ceo={ceo}
            onConnect={wallet.connect}
            onDisconnect={wallet.disconnect}
          />
        </div>
        <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-3 pb-2">
          {TABS.filter((item) => item.id !== "admin" || ceo).map((item) => {
            const active = tab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setTab(item.id)}
                className={`h-11 shrink-0 rounded-full px-3 text-sm font-medium ${
                  active ? "bg-primary text-primary-fg" : "text-muted"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-5 pb-10">
        {wallet.error ? (
          <p className="mb-4 rounded-card border border-line bg-surface px-4 py-3 text-sm text-pink">
            {wallet.error}
          </p>
        ) : null}

        {tab === "dashboard" ? (
          <Arena
            creator={creator}
            games={games}
            onTournaments={() => setTab("tournaments")}
            profileOpen={profileOpen}
            profileGames={profileGames}
            profileLoading={profileLoading}
            profileError={profileError}
            onToggleProfile={toggleProfile}
            onPlay={playRemix}
            openingId={openingId}
            stage={stage}
            stageError={stageError}
            stageRef={stageRef}
          />
        ) : null}
        {tab === "creators" ? (
          <Creators
            creator={creator}
            profileOpen={profileOpen}
            profileGames={profileGames}
            profileLoading={profileLoading}
            profileError={profileError}
            onToggleProfile={toggleProfile}
            onPlay={playRemix}
            openingId={openingId}
            stage={stage}
            stageError={stageError}
            stageRef={stageRef}
            account={account}
            fanCreators={fanCreators}
            feeError={feeError}
            feeBusy={feeBusy}
            onSignUp={signUpCreator}
          />
        ) : null}
        {tab === "tournaments" ? <Tournaments balance={account.balance} /> : null}
        {tab === "tokens" ? (
          <FanTokens
            address={wallet.address}
            account={account}
            feeError={feeError}
            feeBusy={feeBusy}
            onCreate={signUpToken}
          />
        ) : null}
        {tab === "marketplace" ? <Marketplace /> : null}
        {tab === "portfolio" ? (
          <Portfolio
            address={wallet.address}
            link={link}
            balance={account.balance}
            onConnect={wallet.connect}
            busy={wallet.busy}
          />
        ) : null}
        {tab === "rewards" ? (
          <Rewards
            address={wallet.address}
            balance={account.balance}
            link={link}
            board={board}
            loading={loading}
            builderCode={builderCode}
            setBuilderCode={setBuilderCode}
            linking={linking}
            linkError={linkError}
            onLink={linkStrike}
          />
        ) : null}
        {tab === "leaderboard" ? <Traders board={board} loading={loading} /> : null}
        {tab === "admin" && ceo ? (
          <AdminPanel
            creator={creator}
            games={games}
            signMessage={wallet.signMessage}
            address={wallet.address}
            onSaved={(nextCreator, nextGames) => {
              setCreator(nextCreator);
              setGames(nextGames);
            }}
          />
        ) : null}
      </main>
    </div>
  );
}

function ConnectButton({
  address,
  busy,
  ceo,
  onConnect,
  onDisconnect,
}: {
  address: string | null;
  busy: boolean;
  ceo: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  if (!address) {
    return (
      <button
        type="button"
        onClick={onConnect}
        disabled={busy}
        className="h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-60"
      >
        {busy ? "Waiting…" : "Connect wallet"}
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onDisconnect}
      className="h-11 rounded-full border border-line bg-surface px-4 text-sm font-medium text-fg"
    >
      {ceo ? "CEO " : ""}
      {shortAddress(address)}
    </button>
  );
}

function Arena({
  creator,
  games,
  onTournaments,
  profileOpen,
  profileGames,
  profileLoading,
  profileError,
  onToggleProfile,
  onPlay,
  openingId,
  stage,
  stageError,
  stageRef,
}: {
  creator: PlatformCreator;
  games: PlatformGame[];
  onTournaments: () => void;
  profileOpen: boolean;
  profileGames: RemixProfileGame[];
  profileLoading: boolean;
  profileError: string | null;
  onToggleProfile: () => void;
  onPlay: (pageUrl: string) => void;
  openingId: string | null;
  stage: RemixStage | null;
  stageError: string | null;
  stageRef: RefObject<HTMLDivElement | null>;
}) {
  const featured = games[0];
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-teal uppercase">Remix creators</p>
        <h1 className="mt-2 font-display text-4xl leading-none font-extrabold">Call the board.</h1>
        <p className="mt-3 max-w-xl text-sm text-muted">
          FanArena is the creator floor. Profiles and games stay on Remix. Perps run on Strike.
          Points do not move because someone opened a link.
        </p>
      </div>

      <article className="rounded-card border border-line bg-surface p-4">
        <p className="text-xs font-semibold tracking-widest text-pink uppercase">Pinned creator</p>
        <h2 className="mt-2 font-display text-2xl font-bold">{creator.name}</h2>
        <p className="text-sm text-muted">{creator.bio}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggleProfile}
            className="h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg"
          >
            {profileOpen ? "Close profile" : "Open profile"}
          </button>
          <a
            href={creator.remixUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center rounded-full border border-line px-4 text-sm"
          >
            remix.gg
          </a>
        </div>
        {profileOpen ? (
          <ProfileGames
            games={profileGames}
            loading={profileLoading}
            error={profileError}
            onPlay={onPlay}
            openingId={openingId}
            stage={stage}
          />
        ) : null}
      </article>

      {featured ? (
        <article className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest text-teal uppercase">Top game</p>
          <h2 className="mt-2 font-display text-2xl font-bold">{featured.title}</h2>
          <p className="text-sm text-muted">{featured.description || "Playable on Remix."}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onPlay(featured.url)}
              disabled={openingId !== null}
              className="h-11 rounded-full bg-surface-2 px-4 text-sm font-semibold text-fg disabled:opacity-60"
            >
              {openingId && featured.url.includes(openingId) ? "Opening…" : stage?.pageUrl === featured.url ? "Close game" : "Open game"}
            </button>
            <a
              href={featured.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-11 items-center rounded-full border border-line px-4 text-sm"
            >
              Play on Remix
            </a>
          </div>
        </article>
      ) : null}

      {games.length > 1 ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {games.slice(1).map((game) => (
            <article key={game.id} className="rounded-card border border-line bg-surface p-4">
              <h3 className="font-display text-lg font-bold">{game.title}</h3>
              <p className="mt-1 text-sm text-muted">{game.description}</p>
              <button
                type="button"
                onClick={() => onPlay(game.url)}
                className="mt-3 h-11 text-sm text-teal"
              >
                {stage?.pageUrl === game.url ? "Close game" : "Open game"}
              </button>
            </article>
          ))}
        </div>
      ) : null}

      <PlayerStage stage={stage} error={stageError} stageRef={stageRef} onClose={() => onPlay(stage?.pageUrl ?? "")} />

      <article className="rounded-card border border-dashed border-line bg-surface p-4">
        <p className="text-xs font-semibold tracking-widest text-muted uppercase">Tournaments</p>
        <h2 className="mt-2 font-display text-xl font-bold">No live boards</h2>
        <p className="mt-2 text-sm text-muted">
          Entry will cost 2 points from confirmed Strike fills. Nothing is posted yet, and opening
          Strike does not mint those points.
        </p>
        <button
          type="button"
          onClick={onTournaments}
          className="mt-4 h-11 rounded-full border border-line px-4 text-sm"
        >
          Open tournaments
        </button>
      </article>
    </section>
  );
}

function Trade({
  board,
  loading,
  link,
  builderCode,
  setBuilderCode,
  linking,
  linkError,
  onLink,
  connected,
}: {
  board: StrikeBoard | null;
  loading: boolean;
  link: StrikeLink | null;
  builderCode: string;
  setBuilderCode: (value: string) => void;
  linking: boolean;
  linkError: string | null;
  onLink: () => void;
  connected: boolean;
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-teal uppercase">Strike perps</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">Markets</h1>
        <p className="mt-2 text-sm text-muted">
          Prices are live from Strike. Trading happens in their app until your builder code is
          linked. Fan tokens are not listed here.
        </p>
      </div>

      {board?.error ? <p className="text-sm text-pink">{board.error}</p> : null}

      <div className="grid grid-cols-2 gap-3">
        {loading
          ? Array.from({ length: 6 }).map((_, index) => (
              <div key={index} className="h-24 rounded-card bg-surface" />
            ))
          : board?.markets.map((market) => (
              <article key={market.symbol} className="rounded-card border border-line bg-surface p-3">
                <p className="text-xs text-muted">{market.symbol.replace("-USD", "")}</p>
                <p className="mt-1 font-display text-xl font-bold">{price(market.markPrice)}</p>
                <p className="mt-1 text-xs text-muted">Funding {funding(market.fundingRate)}</p>
              </article>
            ))}
      </div>

      <a
        href={STRIKE_APP}
        target="_blank"
        rel="noreferrer"
        className="inline-flex h-11 items-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg"
      >
        Trade on Strike
      </a>

      <article className="rounded-card border border-line bg-surface p-4">
        <h2 className="font-display text-xl font-bold">Link your builder code</h2>
        <p className="mt-2 text-sm text-muted">
          This signs Strike’s message with your wallet. Fee cap is 0.50%. FanArena cannot withdraw.
          Points still wait for a confirmed fill.
        </p>
        {link ? (
          <p className="mt-3 text-sm text-teal">
            Linked · {link.builderCode || "builder"} · {shortAddress(link.accountId)}
          </p>
        ) : null}
        <label className="mt-4 block text-xs text-muted" htmlFor="builder-code">
          Builder code
        </label>
        <input
          id="builder-code"
          value={builderCode}
          onChange={(event) => setBuilderCode(event.target.value)}
          placeholder="From the Strike dashboard"
          className="mt-2 h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm text-fg"
          autoCapitalize="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={onLink}
          disabled={linking || !connected}
          className="mt-3 h-11 rounded-full bg-surface-2 px-4 text-sm font-semibold text-fg disabled:opacity-50"
        >
          {linking ? "Waiting for signature…" : connected ? "Sign and link Strike" : "Connect wallet to link"}
        </button>
        {linkError ? <p className="mt-3 text-sm text-pink">{linkError}</p> : null}
      </article>

      {board && board.vaults.length > 0 ? (
        <div className="space-y-2">
          <h2 className="font-display text-xl font-bold">Vaults</h2>
          {board.vaults.map((vault) => (
            <article
              key={vault.name}
              className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold">{vault.name}</p>
                <p className="text-xs text-muted">
                  {money(vault.equity)} · {vault.depositors} depositors
                </p>
              </div>
              <p className={Number(vault.apr) >= 0 ? "text-sm text-teal" : "text-sm text-pink"}>
                {percent(vault.apr)}
              </p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}

function ProfileGames({
  games,
  loading,
  error,
  onPlay,
  openingId,
  stage,
}: {
  games: RemixProfileGame[];
  loading: boolean;
  error: string | null;
  onPlay: (pageUrl: string) => void;
  openingId: string | null;
  stage: RemixStage | null;
}) {
  if (loading) return <p className="mt-4 text-sm text-muted">Loading games from Remix…</p>;
  if (error) return <p className="mt-4 text-sm text-pink">{error}</p>;
  return (
    <div className="mt-4 space-y-2">
      {games.map((game) => {
        const pageUrl = `https://remix.gg/g/${game.id}`;
        const open = stage?.id === game.id;
        return (
          <button
            key={game.id}
            type="button"
            onClick={() => onPlay(pageUrl)}
            className="flex h-11 w-full items-center justify-between rounded-full border border-line px-4 text-left text-sm"
          >
            <span className="truncate">{game.title}</span>
            <span className="shrink-0 text-teal">{openingId === game.id ? "Opening…" : open ? "Close" : "Play"}</span>
          </button>
        );
      })}
    </div>
  );
}

function PlayerStage({
  stage,
  error,
  stageRef,
  onClose,
}: {
  stage: RemixStage | null;
  error: string | null;
  stageRef: RefObject<HTMLDivElement | null>;
  onClose: () => void;
}) {
  if (!stage && !error) return null;
  return (
    <div ref={stageRef} className="overflow-hidden rounded-card border border-line bg-black">
      {error ? <p className="px-4 py-3 text-sm text-pink">{error}</p> : null}
      {stage ? (
        <>
          <div className="flex items-center justify-between gap-3 bg-surface px-4 py-2">
            <p className="truncate text-sm font-semibold">{stage.title}</p>
            <button type="button" onClick={onClose} className="h-11 shrink-0 text-sm text-muted">
              Close
            </button>
          </div>
          <iframe
            title={stage.title}
            src={stage.playerUrl}
            className="h-[70vh] w-full"
            allow="fullscreen; autoplay; gamepad; pointer-lock"
          />
        </>
      ) : null}
    </div>
  );
}

function Creators({
  creator,
  profileOpen,
  profileGames,
  profileLoading,
  profileError,
  onToggleProfile,
  onPlay,
  openingId,
  stage,
  stageError,
  stageRef,
  account,
  fanCreators,
  feeError,
  feeBusy,
  onSignUp,
}: {
  creator: PlatformCreator;
  profileOpen: boolean;
  profileGames: RemixProfileGame[];
  profileLoading: boolean;
  profileError: string | null;
  onToggleProfile: () => void;
  onPlay: (pageUrl: string) => void;
  openingId: string | null;
  stage: RemixStage | null;
  stageError: string | null;
  stageRef: RefObject<HTMLDivElement | null>;
  account: FanAccount;
  fanCreators: ListedCreator[];
  feeError: string | null;
  feeBusy: boolean;
  onSignUp: (input: { name: string; bio: string; remixUrl: string }) => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-teal uppercase">Explore</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">Creators</h1>
        <p className="mt-2 text-sm text-muted">Pinned from the admin panel. A wallet can sign up as its own creator for {POINT_FEES.creator} points.</p>
      </div>
      <article className="rounded-card border border-line bg-surface p-4">
        <h2 className="font-display text-2xl font-bold">{creator.name}</h2>
        <p className="mt-1 text-sm text-muted">{creator.bio}</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={onToggleProfile}
            className="h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg"
          >
            {profileOpen ? "Close profile" : "View profile"}
          </button>
          <a
            href={creator.remixUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-11 items-center rounded-full border border-line px-4 text-sm"
          >
            remix.gg
          </a>
        </div>
        {profileOpen ? (
          <ProfileGames
            games={profileGames}
            loading={profileLoading}
            error={profileError}
            onPlay={onPlay}
            openingId={openingId}
            stage={stage}
          />
        ) : null}
      </article>
      {account.creator ? (
        <article className="rounded-card border border-line bg-surface p-4">
          <p className="text-xs font-semibold tracking-widest text-teal uppercase">Your profile</p>
          <h2 className="mt-2 font-display text-2xl font-bold">{account.creator.name}</h2>
          <p className="mt-1 text-sm text-muted">{account.creator.bio}</p>
        </article>
      ) : (
        <CreatorSignup balance={account.balance} busy={feeBusy} error={feeError} onSignUp={onSignUp} />
      )}
      {fanCreators.length ? (
        <div className="space-y-2">
          {fanCreators.map((row) => (
            <article key={row.address} className="rounded-card border border-line bg-surface p-4">
              <h2 className="font-display text-xl font-bold">{row.name}</h2>
              <p className="mt-1 text-sm text-muted">{row.bio}</p>
              <a href={row.remixUrl} target="_blank" rel="noreferrer" className="mt-2 inline-flex h-11 items-center text-sm text-teal">
                remix.gg
              </a>
            </article>
          ))}
        </div>
      ) : null}
      <PlayerStage stage={stage} error={stageError} stageRef={stageRef} onClose={() => stage && onPlay(stage.pageUrl)} />
    </section>
  );
}

function CreatorSignup({
  balance,
  busy,
  error,
  onSignUp,
}: {
  balance: number;
  busy: boolean;
  error: string | null;
  onSignUp: (input: { name: string; bio: string; remixUrl: string }) => void;
}) {
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [remixUrl, setRemixUrl] = useState("https://remix.gg/@");
  const short = balance < POINT_FEES.creator;
  return (
    <article className="rounded-card border border-line bg-surface p-4">
      <p className="text-xs font-semibold tracking-widest text-pink uppercase">Sign up</p>
      <h2 className="mt-2 font-display text-2xl font-bold">Become a creator</h2>
      <p className="mt-2 text-sm text-muted">
        A creator profile costs {POINT_FEES.creator} points. You have {balance}. Points come from confirmed Strike fills only.
      </p>
      <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Creator name" className="mt-4 h-11 w-full rounded-full border border-line bg-bg px-4 text-sm" />
      <textarea value={bio} onChange={(event) => setBio(event.target.value)} placeholder="Short bio" className="mt-2 w-full rounded-card border border-line bg-bg px-4 py-3 text-sm" />
      <input value={remixUrl} onChange={(event) => setRemixUrl(event.target.value)} placeholder="https://remix.gg/@name" className="mt-2 h-11 w-full rounded-full border border-line bg-bg px-4 text-sm" />
      <button
        type="button"
        disabled={busy || short || name.trim().length < 1}
        onClick={() => onSignUp({ name: name.trim(), bio: bio.trim(), remixUrl: remixUrl.trim() })}
        className="mt-4 h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-60"
      >
        {busy ? "Waiting for signature…" : `Create profile · ${POINT_FEES.creator} points`}
      </button>
      {short ? <p className="mt-3 text-sm text-muted">Not enough points yet.</p> : null}
      {error ? <p className="mt-3 text-sm text-pink">{error}</p> : null}
    </article>
  );
}

function Tournaments({ balance }: { balance: number }) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-teal uppercase">Boards</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">Tournaments</h1>
        <p className="mt-2 text-sm text-muted">You have {balance} points.</p>
      </div>
      <article className="rounded-card border border-line bg-surface p-4">
        <h2 className="font-display text-xl font-bold">Game jam call · {POINT_FEES.prediction} point</h2>
        <p className="mt-2 text-sm text-muted">No jam is open, so a call cannot be placed and no point is taken.</p>
      </article>
      <article className="rounded-card border border-line bg-surface p-4 text-center">
        <h2 className="font-display text-xl font-bold">Entry fee · {POINT_FEES.tournament} points</h2>
        <p className="mt-2 text-sm text-muted">No tournament is open. The fee is charged only when one is.</p>
        {balance < POINT_FEES.tournament ? (
          <p className="mt-3 text-sm font-semibold text-primary">You need {POINT_FEES.tournament - balance} more points.</p>
        ) : (
          <p className="mt-3 text-sm text-teal">You can cover the entry fee.</p>
        )}
      </article>
    </section>
  );
}

function FanTokens({
  address,
  account,
  feeError,
  feeBusy,
  onCreate,
}: {
  address: string | null;
  account: FanAccount;
  feeError: string | null;
  feeBusy: boolean;
  onCreate: (input: { name: string; symbol: string }) => void;
}) {
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const short = account.balance < POINT_FEES.fanToken;
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-teal uppercase">Holdings</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">Fan Tokens</h1>
        <p className="mt-2 text-sm text-muted">
          Creating one costs {POINT_FEES.fanToken} points. Strike markets on Rewards are perps, not these tokens.
        </p>
      </div>
      {account.token ? (
        <article className="rounded-card border border-line bg-surface p-4">
          <h2 className="font-display text-2xl font-bold">{account.token.symbol}</h2>
          <p className="mt-1 text-sm text-muted">{account.token.name}</p>
        </article>
      ) : (
        <article className="rounded-card border border-line bg-surface p-4">
          <p className="text-sm text-muted">You have {account.balance} points. {address ? "" : "Connect a wallet to create one."}</p>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Token name" className="mt-4 h-11 w-full rounded-full border border-line bg-bg px-4 text-sm" />
          <input value={symbol} onChange={(event) => setSymbol(event.target.value.toUpperCase())} placeholder="SYMBOL" className="mt-2 h-11 w-full rounded-full border border-line bg-bg px-4 text-sm" />
          <button
            type="button"
            disabled={feeBusy || short || !address || !/^[A-Za-z]{2,8}$/.test(symbol) || name.trim().length < 1}
            onClick={() => onCreate({ name: name.trim(), symbol })}
            className="mt-4 h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-60"
          >
            {feeBusy ? "Waiting for signature…" : `Create token · ${POINT_FEES.fanToken} points`}
          </button>
          {short && address ? <p className="mt-3 text-sm text-muted">Not enough points yet.</p> : null}
          {feeError ? <p className="mt-3 text-sm text-pink">{feeError}</p> : null}
        </article>
      )}
    </section>
  );
}

function Marketplace() {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-teal uppercase">Exchange</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">Marketplace</h1>
        <p className="mt-2 text-sm text-muted">No listings yet. Nothing here is for sale.</p>
      </div>
    </section>
  );
}

function Portfolio({
  address,
  link,
  balance,
  onConnect,
  busy,
}: {
  address: string | null;
  link: StrikeLink | null;
  balance: number;
  onConnect: () => void;
  busy: boolean;
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-teal uppercase">Wallet</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">Portfolio</h1>
      </div>
      {address ? (
        <article className="rounded-card border border-line bg-surface p-4 text-sm">
          <p className="font-semibold">{shortAddress(address)}</p>
          <p className="mt-2 text-muted">Points: {balance}</p>
          <p className="mt-1 text-muted">Fan tokens: none listed</p>
          <p className="mt-1 text-muted">
            {link ? `Strike builder linked · ${link.builderCode || "code"}` : "Strike builder not linked"}
          </p>
        </article>
      ) : (
        <article className="rounded-card border border-line bg-surface p-4">
          <p className="text-sm text-muted">Connect a wallet to attach this portfolio to an address.</p>
          <button
            type="button"
            onClick={onConnect}
            disabled={busy}
            className="mt-4 h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-60"
          >
            {busy ? "Waiting…" : "Connect wallet"}
          </button>
        </article>
      )}
    </section>
  );
}

function Traders({ board, loading }: { board: StrikeBoard | null; loading: boolean }) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-teal uppercase">Public board</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">Leaderboard</h1>
        <p className="mt-2 text-sm text-muted">30-day PnL from Strike’s public copy list. Not a fan-points ranking.</p>
      </div>
      {board?.error ? <p className="text-sm text-pink">{board.error}</p> : null}
      <div className="space-y-2">
        {loading
          ? Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-16 rounded-card bg-surface" />
            ))
          : null}
        {board?.traders.map((trader, index) => {
          const pnl = Number(trader.pnl30d);
          return (
            <article
              key={trader.address}
              className="flex items-center justify-between gap-3 rounded-card border border-line bg-surface px-4 py-3"
            >
              <div>
                <p className="text-sm font-semibold">
                  {index + 1}. {shortAddress(trader.address)}
                </p>
                <p className="text-xs text-muted">Equity {money(trader.equity)}</p>
              </div>
              <div className="text-right">
                <p className={pnl >= 0 ? "text-sm font-semibold text-teal" : "text-sm font-semibold text-pink"}>
                  {pnl >= 0 ? "+" : ""}
                  {money(trader.pnl30d)}
                </p>
                <p className="text-xs text-muted">{percent(trader.roi30d)} ROI</p>
              </div>
            </article>
          );
        })}
        {!loading && board && board.traders.length === 0 ? (
          <p className="text-sm text-muted">No public Strike traders came back.</p>
        ) : null}
      </div>
    </section>
  );
}

function Rewards({
  address,
  balance,
  link,
  board,
  loading,
  builderCode,
  setBuilderCode,
  linking,
  linkError,
  onLink,
}: {
  address: string | null;
  balance: number;
  link: StrikeLink | null;
  board: StrikeBoard | null;
  loading: boolean;
  builderCode: string;
  setBuilderCode: (value: string) => void;
  linking: boolean;
  linkError: string | null;
  onLink: () => void;
}) {
  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-teal uppercase">Points</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">{balance}</h1>
        <p className="mt-2 text-sm text-muted">
          {address
            ? balance > 0
              ? `${shortAddress(address)} can spend these on a profile, a token, a call, or a tournament.`
              : `${shortAddress(address)} has no confirmed Strike fills through FanArena.`
            : "Connect a wallet to attach points to a real address."}
        </p>
      </div>
      <article className="rounded-card border border-line bg-surface p-4 text-sm">
        <p className="font-semibold">What a point pays for</p>
        <ul className="mt-2 space-y-1 text-muted">
          <li>Game jam call · {POINT_FEES.prediction} point</li>
          <li>Tournament entry · {POINT_FEES.tournament} points</li>
          <li>Creator profile · {POINT_FEES.creator} points</li>
          <li>Fan token · {POINT_FEES.fanToken} points</li>
        </ul>
      </article>
      <article className="rounded-card border border-line bg-surface p-4 text-sm text-muted">
        <p className="font-semibold text-fg">How a point is earned</p>
        <ol className="mt-2 list-decimal space-y-1 pl-4">
          <li>Connect the same Ethereum wallet you trade with.</li>
          <li>Link a Strike builder code and sign their message.</li>
          <li>A fill has to come back from Strike. Opening the app does not count.</li>
        </ol>
        <p className="mt-3">
          {link
            ? `Builder ${link.builderCode || "code"} is linked. Fills are not credited yet because FanArena does not invent them.`
            : "No builder is linked for this wallet."}
        </p>
      </article>
      <Trade
        board={board}
        loading={loading}
        link={link}
        builderCode={builderCode}
        setBuilderCode={setBuilderCode}
        linking={linking}
        linkError={linkError}
        onLink={onLink}
        connected={!!address}
      />
    </section>
  );
}

function AdminPanel({
  creator,
  games,
  address,
  signMessage,
  onSaved,
}: {
  creator: PlatformCreator;
  games: PlatformGame[];
  address: string | null;
  signMessage: (message: string, account: string) => Promise<string>;
  onSaved: (creator: PlatformCreator, games: PlatformGame[]) => void;
}) {
  const [name, setName] = useState(creator.name);
  const [bio, setBio] = useState(creator.bio);
  const [remixUrl, setRemixUrl] = useState(creator.remixUrl);
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setName(creator.name);
    setBio(creator.bio);
    setRemixUrl(creator.remixUrl);
  }, [creator]);

  async function saveCreator() {
    if (!address) return;
    setBusy(true);
    setStatus(null);
    try {
      const issuedAt = Math.floor(Date.now() / 1000);
      const payload = { name, bio, remixUrl, issuedAt };
      const signature = await signMessage(creatorMessage(payload), address);
      await setPinnedCreator({ data: { ...payload, signature } });
      onSaved({ name: name.trim(), bio: bio.trim(), remixUrl: remixUrl.trim() }, games);
      setStatus("Pinned creator updated for everyone.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not save the creator.");
    } finally {
      setBusy(false);
    }
  }

  async function saveGame() {
    if (!address) return;
    setBusy(true);
    setStatus(null);
    try {
      const issuedAt = Math.floor(Date.now() / 1000);
      const payload = { title, url, description, issuedAt };
      const signature = await signMessage(addGameMessage(payload), address);
      const result = await addPlatformGame({ data: { ...payload, signature } });
      const next = [
        ...games,
        {
          id: result.id,
          title: title.trim(),
          url: url.trim(),
          description: description.trim(),
        },
      ];
      onSaved(creator, next);
      setTitle("");
      setUrl("");
      setDescription("");
      setStatus("Game added.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not add the game.");
    } finally {
      setBusy(false);
    }
  }

  async function removeGame(id: number) {
    if (!address) return;
    setBusy(true);
    setStatus(null);
    try {
      const issuedAt = Math.floor(Date.now() / 1000);
      const signature = await signMessage(removeGameMessage(id, issuedAt), address);
      await removePlatformGame({ data: { id, issuedAt, signature } });
      onSaved(
        creator,
        games.filter((game) => game.id !== id),
      );
      setStatus("Game removed.");
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Could not remove the game.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="space-y-4">
      <div>
        <p className="text-xs font-semibold tracking-widest text-teal uppercase">CEO</p>
        <h1 className="mt-2 font-display text-3xl font-extrabold">Admin</h1>
        <p className="mt-2 text-sm text-muted">
          Both CEO wallets have the same control. Each save asks your wallet to sign. There is no
          password. Other wallets never see this panel.
        </p>
      </div>

      <article className="space-y-2 rounded-card border border-line bg-surface p-4">
        <h2 className="font-display text-xl font-bold">Pinned creator</h2>
        <input
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Creator name"
          className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm"
        />
        <textarea
          value={bio}
          onChange={(event) => setBio(event.target.value)}
          placeholder="Short bio"
          rows={3}
          className="w-full rounded-xl border border-line bg-bg px-3 py-2 text-sm"
        />
        <input
          value={remixUrl}
          onChange={(event) => setRemixUrl(event.target.value)}
          placeholder="https://remix.gg/@name"
          className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm"
        />
        <button
          type="button"
          onClick={saveCreator}
          disabled={busy}
          className="h-11 rounded-full bg-primary px-4 text-sm font-semibold text-primary-fg disabled:opacity-60"
        >
          Sign and save creator
        </button>
      </article>

      <article className="space-y-2 rounded-card border border-line bg-surface p-4">
        <h2 className="font-display text-xl font-bold">Top games</h2>
        {games.map((game) => (
          <div key={game.id} className="flex items-center justify-between gap-3 text-sm">
            <span>{game.title}</span>
            <button
              type="button"
              onClick={() => removeGame(game.id)}
              disabled={busy || game.id === 0}
              className="h-11 rounded-full border border-line px-3 text-pink disabled:opacity-40"
            >
              Remove
            </button>
          </div>
        ))}
        <input
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="Game title"
          className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm"
        />
        <input
          value={url}
          onChange={(event) => setUrl(event.target.value)}
          placeholder="https://remix.gg/g/…"
          className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm"
        />
        <input
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="Description"
          className="h-11 w-full rounded-xl border border-line bg-bg px-3 text-sm"
        />
        <button
          type="button"
          onClick={saveGame}
          disabled={busy}
          className="h-11 rounded-full bg-surface-2 px-4 text-sm font-semibold disabled:opacity-60"
        >
          Sign and add game
        </button>
      </article>

      {status ? <p className="text-sm text-muted">{status}</p> : null}
    </section>
  );
}
