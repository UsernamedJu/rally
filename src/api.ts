import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Linking from 'expo-linking';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { localDate } from '../shared/catalog';
import { deleteSecret, getSecret, setSecret } from './secure';

const TOKEN_KEY = 'session-token';
const isWeb = Platform.OS === 'web' && typeof window !== 'undefined';

// In development the API runs next to the Expo dev server, on port 8787 of the same machine.
export function apiBase(): string {
  const configured = process.env.EXPO_PUBLIC_API_URL;
  if (configured) return configured.replace(/\/$/, '');
  if (isWeb) return `${window.location.protocol}//${window.location.hostname}:8787`;
  const host = Constants.expoConfig?.hostUri?.split(':')[0] ?? 'localhost';
  return `http://${host}:8787`;
}

export function inviteLink(token: string): string {
  const configured = process.env.EXPO_PUBLIC_INVITE_URL;
  if (configured) return `${configured.replace(/\/$/, '')}/invite/${token}`;
  if (isWeb) return `${window.location.origin}/invite/${token}`;
  return Linking.createURL(`/invite/${token}`);
}

// ---------- session ----------

type SessionState = { ready: boolean; token: string | null };
let session: SessionState = { ready: false, token: null };
const listeners = new Set<() => void>();

function emit(next: SessionState) {
  session = next;
  listeners.forEach((l) => l());
}

export async function restoreSession() {
  const token = await getSecret(TOKEN_KEY).catch(() => null);
  emit({ ready: true, token });
}

export async function setSession(token: string | null) {
  // Cached screens belong to whoever was signed in; never let them show up for someone else.
  if (token !== session.token) await clearCache();
  if (token) await setSecret(TOKEN_KEY, token);
  else await deleteSecret(TOKEN_KEY);
  emit({ ready: true, token });
}

export function useSession(): SessionState {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => session,
  );
}

// ---------- the account this device remembers ----------
// Separate from the active session token: logging out clears `session-token` (so the API stops
// sending it) but keeps this, so the Welcome screen can still say "Welcome back, Dana" and offer
// Face ID instead of making a returning user re-enter their phone and PIN every time.

const LOCKED_KEY = 'locked-account';
export type LockedAccount = { token: string; name: string; avatar: number };

export async function rememberAccount(a: LockedAccount) {
  await setSecret(LOCKED_KEY, JSON.stringify(a)).catch(() => {});
}

export async function getRememberedAccount(): Promise<LockedAccount | null> {
  const raw = await getSecret(LOCKED_KEY).catch(() => null);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as LockedAccount;
  } catch {
    return null;
  }
}

/** "Not you?" — forgets this device ever had an account, back to the new-or-returning choice. */
export async function forgetAccount() {
  await deleteSecret(LOCKED_KEY);
}

// ---------- data freshness ----------

// Every write bumps this so mounted screens refetch. Focus alone is not enough: Home sits
// under the create modal and never loses focus, so it would keep showing stale challenges.
let version = 0;
const dataListeners = new Set<() => void>();

function dataChanged() {
  version++;
  dataListeners.forEach((l) => l());
}

function useDataVersion(): number {
  return useSyncExternalStore(
    (cb) => {
      dataListeners.add(cb);
      return () => dataListeners.delete(cb);
    },
    () => version,
  );
}

// ---------- requests ----------

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function api<T>(path: string, opts: { method?: string; body?: unknown } = {}): Promise<T> {
  const method = opts.method ?? (opts.body !== undefined ? 'POST' : 'GET');
  const res = await fetch(`${apiBase()}/api${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Today': localDate(),
      ...(session.token ? { Authorization: `Bearer ${session.token}` } : {}),
    },
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  }).catch(() => {
    throw new ApiError(0, "Can't reach the server. Check your connection and try again.");
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 401 && session.token) await setSession(null);
  if (!res.ok) throw new ApiError(res.status, data.error ?? 'Something went wrong. Try again.');
  if (method !== 'GET') dataChanged();
  return data as T;
}

// ---------- last-known data, on disk ----------
// Each screen's last response is kept so a cold launch shows real content immediately and the app
// stays usable when the connection drops, then quietly refreshes. It is only trusted for the same
// calendar day it was saved: streaks, "logged today" and per-period progress all turn over at
// midnight, and a stale "You're in for today" flashing up would be worse than a blank moment.
// Check-in is never cached, because that screen is precisely a statement about today.

const CACHE_PREFIX = 'cache:';
const cacheable = (path: string) => !path.startsWith('/checkin');

async function readCache<T>(path: string): Promise<T | null> {
  if (!cacheable(path)) return null;
  try {
    const raw = await AsyncStorage.getItem(CACHE_PREFIX + path);
    if (!raw) return null;
    const hit = JSON.parse(raw) as { date: string; data: T };
    return hit.date === localDate() ? hit.data : null;
  } catch {
    return null;
  }
}

function writeCache(path: string, data: unknown) {
  if (!cacheable(path)) return;
  AsyncStorage.setItem(CACHE_PREFIX + path, JSON.stringify({ date: localDate(), data })).catch(() => {});
}

export async function clearCache() {
  try {
    const keys = await AsyncStorage.getAllKeys();
    await AsyncStorage.multiRemove(keys.filter((k) => k.startsWith(CACHE_PREFIX)));
  } catch {
    // Nothing useful to do; a stale entry is bounded by the same-day rule anyway.
  }
}

/** Loads a view every time its screen comes into focus, keeping the last copy on screen meanwhile. */
export function useLoad<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const reload = useCallback(async () => {
    if (!path) return;
    try {
      const fresh = await api<T>(path);
      setData(fresh);
      setError(null);
      writeCache(path, fresh);
    } catch (e) {
      setError((e as Error).message);
    }
  }, [path]);
  // Show what we had last time straight away, unless the network has already beaten it here.
  useEffect(() => {
    if (!path) return;
    let alive = true;
    readCache<T>(path).then((hit) => {
      if (alive && hit) setData((current) => current ?? hit);
    });
    return () => {
      alive = false;
    };
  }, [path]);
  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );
  const version = useDataVersion();
  const seen = useRef(version);
  useEffect(() => {
    if (seen.current === version) return;
    seen.current = version;
    reload();
  }, [version, reload]);
  return { data, setData, error, reload };
}
