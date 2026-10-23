import { useCallback, useEffect, useState } from "react";

type EthereumProvider = {
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on?: (event: string, cb: (accounts: string[]) => void) => void;
  removeListener?: (event: string, cb: (accounts: string[]) => void) => void;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

export function shortAddress(address: string) {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function useWallet() {
  const [address, setAddress] = useState<string | null>(null);
  const [hasProvider, setHasProvider] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const eth = window.ethereum;
    setHasProvider(!!eth);
    if (!eth) return;
    let alive = true;
    eth
      .request({ method: "eth_accounts" })
      .then((accounts) => {
        if (!alive) return;
        const list = Array.isArray(accounts) ? (accounts as string[]) : [];
        setAddress(list[0] ?? null);
      })
      .catch(() => {});
    const onAccounts = (accounts: string[]) => setAddress(accounts[0] ?? null);
    eth.on?.("accountsChanged", onAccounts);
    return () => {
      alive = false;
      eth.removeListener?.("accountsChanged", onAccounts);
    };
  }, []);

  const connect = useCallback(async () => {
    setError(null);
    const eth = window.ethereum;
    if (!eth) {
      setError("No wallet in this browser. Open FanArena in Rabby or MetaMask.");
      return;
    }
    setBusy(true);
    try {
      const accounts = (await eth.request({ method: "eth_requestAccounts" })) as string[];
      setAddress(accounts[0] ?? null);
    } catch (err) {
      const code = (err as { code?: number }).code;
      setError(code === 4001 ? "Connection rejected." : "Could not connect the wallet.");
    } finally {
      setBusy(false);
    }
  }, []);

  const disconnect = useCallback(async () => {
    const eth = window.ethereum;
    try {
      await eth?.request({
        method: "wallet_revokePermissions",
        params: [{ eth_accounts: {} }],
      });
    } catch {
      // Some wallets cannot revoke. Clearing the session is still correct.
    }
    setAddress(null);
    setError(null);
  }, []);

  const signMessage = useCallback(async (message: string, account: string) => {
    const eth = window.ethereum;
    if (!eth) throw new Error("No wallet in this browser.");
    const hex =
      "0x" +
      Array.from(new TextEncoder().encode(message))
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("");
    try {
      return (await eth.request({ method: "personal_sign", params: [hex, account] })) as string;
    } catch (err) {
      const code = (err as { code?: number }).code;
      if (code === 4001) throw new Error("Signature rejected.");
      return (await eth.request({
        method: "personal_sign",
        params: [message, account],
      })) as string;
    }
  }, []);

  return { address, hasProvider, busy, error, connect, disconnect, signMessage };
}
