import {
  createUserWithEmailAndPassword,
  deleteUser,
  signInAnonymously as firebaseSignInAnonymously,
  signInWithEmailAndPassword,
  updatePassword as firebaseUpdatePassword,
} from "firebase/auth";
import { get, ref, remove, update } from "firebase/database";
import { getFirebaseAuthClient, getFirebaseDatabaseClient } from "./firebaseSdk";
import { AuthSession, AuthUser, Entry, SyncProvider } from "../types/journal";

type RemoteEntry = {
  id: string;
  date: string;
  line1: string;
  line2: string;
  line3: string;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
};

type SupabaseEntry = {
  id: string;
  user_id: string;
  date: string;
  line1: string;
  line2: string;
  line3: string;
  created_at: number;
  updated_at: number;
  deleted_at: number | null;
};

export type SyncPullResponse = {
  entries: RemoteEntry[];
  serverTime: number;
};

type EmailAuthResponse = {
  accessToken: string;
  user: AuthUser;
};

type FirebaseAuthResponse = {
  idToken: string;
  refreshToken?: string;
  localId: string;
  email?: string;
  displayName?: string;
};

type FirebaseRefreshResponse = {
  id_token: string;
  refresh_token: string;
  user_id: string;
};

type FirebaseEntriesMap = Record<string, RemoteEntry>;

type FirebaseErrorResponse = {
  error?: {
    message?: string;
  } | string;
};

const extractFirebaseErrorCode = (data: FirebaseErrorResponse | null | undefined) => {
  if (!data?.error) return null;
  if (typeof data.error === "string") return data.error.trim();
  return data.error.message?.trim() ?? null;
};

type SupabaseAuthResponse = {
  access_token: string;
  refresh_token?: string;
  user: {
    id: string;
    email?: string;
    user_metadata?: {
      full_name?: string;
      name?: string;
    };
  };
};

type RemoteClient = {
  signInWithEmail: (email: string, password: string) => Promise<AuthSession>;
  signUpWithEmail?: (email: string, password: string) => Promise<AuthSession>;
  signInWithApple: (identityToken: string) => Promise<AuthSession>;
  signInWithGoogle: (identityToken: string) => Promise<AuthSession>;
  signInAnonymously?: () => Promise<AuthSession>;
  pull: (session: AuthSession, since: number) => Promise<SyncPullResponse>;
  push: (session: AuthSession, entries: Entry[]) => Promise<void>;
  deleteAccount?: (session: AuthSession) => Promise<void>;
  restoreSession?: (session: AuthSession) => Promise<AuthSession | null>;
  updatePassword?: (session: AuthSession, nextPassword: string) => Promise<AuthSession>;
};

const provider = (process.env.EXPO_PUBLIC_SYNC_PROVIDER as SyncProvider | undefined) ?? "firebase";
const apiBaseUrl = process.env.EXPO_PUBLIC_SYNC_API_BASE_URL ?? "https://eerme-e8335-default-rtdb.firebaseio.com/";
const firebaseApiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "AIzaSyCTe1oUQnVcwTeUzy7oQVoM0O1ZnNMoR1A";
const firebaseDatabaseUrl =
  process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? "https://eerme-e8335-default-rtdb.firebaseio.com/";
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

const ensureApiBaseUrl = () => {
  if (!apiBaseUrl) {
    throw new Error("EXPO_PUBLIC_SYNC_API_BASE_URL is not set.");
  }
};

const ensureFirebaseConfig = () => {
  if (!firebaseApiKey) {
    throw new Error("EXPO_PUBLIC_FIREBASE_API_KEY is not set.");
  }
  if (!firebaseDatabaseUrl) {
    throw new Error("EXPO_PUBLIC_FIREBASE_DATABASE_URL is not set.");
  }
};


const ensureSupabaseConfig = () => {
  if (!supabaseUrl) {
    throw new Error("EXPO_PUBLIC_SUPABASE_URL is not set.");
  }
  if (!supabaseAnonKey) {
    throw new Error("EXPO_PUBLIC_SUPABASE_ANON_KEY is not set.");
  }
};

const toRemoteEntry = (entry: Entry): RemoteEntry => ({
  id: entry.id,
  date: entry.date,
  line1: entry.lines[0],
  line2: entry.lines[1],
  line3: entry.lines[2],
  createdAt: entry.createdAt,
  updatedAt: entry.updatedAt,
  deletedAt: entry.deletedAt ?? null,
});

const toLocalEntry = (entry: RemoteEntry): Entry => ({
  id: entry.id,
  date: entry.date,
  lines: [entry.line1 ?? "", entry.line2 ?? "", entry.line3 ?? ""],
  createdAt: Number(entry.createdAt),
  updatedAt: Number(entry.updatedAt),
  deletedAt: entry.deletedAt ?? null,
});

const customClient: RemoteClient = {
  async signInWithEmail(email, password) {
    ensureApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/auth/email/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error("Email login failed.");
    }

    const data = (await response.json()) as EmailAuthResponse;
    return {
      provider: "custom",
      accessToken: data.accessToken,
      user: data.user,
    };
  },
  async signInWithApple(identityToken) {
    ensureApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/auth/apple/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identityToken }),
    });

    if (!response.ok) {
      throw new Error("Apple login failed.");
    }

    const data = (await response.json()) as EmailAuthResponse;
    return {
      provider: "custom",
      accessToken: data.accessToken,
      user: data.user,
    };
  },
  async signUpWithEmail() {
    throw new Error("Email sign-up is not supported by the custom provider.");
  },
  async signInWithGoogle(identityToken) {
    ensureApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/auth/google/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identityToken }),
    });

    if (!response.ok) {
      throw new Error("Google login failed.");
    }

    const data = (await response.json()) as EmailAuthResponse;
    return {
      provider: "custom",
      accessToken: data.accessToken,
      user: data.user,
    };
  },
  async signInAnonymously() {
    throw new Error("Anonymous sync is not supported by the custom provider.");
  },
  async pull(session, since) {
    ensureApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/entries/pull?since=${since}`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Pull sync failed.");
    }

    return (await response.json()) as SyncPullResponse;
  },
  async push(session, entries) {
    ensureApiBaseUrl();
    const response = await fetch(`${apiBaseUrl}/entries/push`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ entries: entries.map(toRemoteEntry) }),
    });

    if (!response.ok) {
      throw new Error("Push sync failed.");
    }
  },
  async deleteAccount() {
    throw new Error("Account deletion is not supported by the custom provider.");
  },
};

const firebaseAuth = async (path: string, payload: Record<string, unknown>) => {
  ensureFirebaseConfig();
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${firebaseApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    try {
      const data = (await response.json()) as FirebaseErrorResponse;
      const firebaseMessage = extractFirebaseErrorCode(data);

      if (firebaseMessage) {
        throw new Error(`Firebase authentication failed: ${firebaseMessage}.`);
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith("Firebase authentication failed:")) {
        throw error;
      }
    }

    throw new Error("Firebase authentication failed.");
  }

  return (await response.json()) as FirebaseAuthResponse;
};




const toFirebaseSessionFromSdkUser = async (user: {
  uid: string;
  email: string | null;
  displayName: string | null;
  refreshToken?: string;
  getIdToken: (forceRefresh?: boolean) => Promise<string>;
}): Promise<AuthSession> => {
  const idToken = await user.getIdToken();

  return {
    provider: "firebase",
    accessToken: idToken,
    refreshToken: user.refreshToken,
    user: {
      id: user.uid,
      email: user.email ?? "unknown@firebase.local",
      displayName: user.displayName ?? undefined,
    },
  };
};
const toFirebaseSession = (data: FirebaseAuthResponse): AuthSession => ({
  provider: "firebase",
  accessToken: data.idToken,
  refreshToken: data.refreshToken,
  user: {
    id: data.localId,
    email: data.email ?? "unknown@firebase.local",
    displayName: data.displayName,
  },
});

const firebaseClient: RemoteClient = {
  async signInWithEmail(email, password) {
    ensureFirebaseConfig();
    const authClient = getFirebaseAuthClient();
    const credential = await signInWithEmailAndPassword(authClient, email, password);
    return toFirebaseSessionFromSdkUser(credential.user);
  },
  async signInWithApple(identityToken) {
    const auth = await firebaseAuth("accounts:signInWithIdp", {
      postBody: `id_token=${encodeURIComponent(identityToken)}&providerId=apple.com`,
      requestUri: "https://localhost",
      returnSecureToken: true,
      returnIdpCredential: true,
    });

    return toFirebaseSession(auth);
  },
  async signUpWithEmail(email, password) {
    ensureFirebaseConfig();
    const authClient = getFirebaseAuthClient();
    const credential = await createUserWithEmailAndPassword(authClient, email, password);
    return toFirebaseSessionFromSdkUser(credential.user);
  },
  async signInWithGoogle(identityToken) {
    const auth = await firebaseAuth("accounts:signInWithIdp", {
      postBody: `id_token=${encodeURIComponent(identityToken)}&providerId=google.com`,
      requestUri: "https://localhost",
      returnSecureToken: true,
      returnIdpCredential: true,
    });

    return toFirebaseSession(auth);
  },
  async signInAnonymously() {
    ensureFirebaseConfig();
    const authClient = getFirebaseAuthClient();
    const credential = await firebaseSignInAnonymously(authClient);
    const session = await toFirebaseSessionFromSdkUser(credential.user);

    return {
      ...session,
      user: {
        ...session.user,
        email: session.user.email || `${session.user.id}@anonymous.firebase.local`,
      },
    };
  },
  async pull(session, since) {
    ensureFirebaseConfig();
    const db = getFirebaseDatabaseClient();
    const snapshot = await get(ref(db, `entries/${session.user.id}`));
    const payload = (snapshot.val() as FirebaseEntriesMap | null) ?? null;
    const entries = payload ? Object.values(payload).filter((entry) => Number(entry.updatedAt) >= since) : [];

    return {
      entries,
      serverTime: Date.now(),
    };
  },
  async push(session, entries) {
    ensureFirebaseConfig();
    const db = getFirebaseDatabaseClient();
    const body = entries.reduce<Record<string, RemoteEntry>>((acc, entry) => {
      acc[entry.id] = toRemoteEntry(entry);
      return acc;
    }, {});

    await update(ref(db, `entries/${session.user.id}`), body);
  },
  async deleteAccount(session) {
    ensureFirebaseConfig();
    const db = getFirebaseDatabaseClient();
    const authClient = getFirebaseAuthClient();

    await remove(ref(db, `entries/${session.user.id}`));

    const currentUser = authClient.currentUser;
    if (currentUser && currentUser.uid === session.user.id) {
      await deleteUser(currentUser);
      return;
    }

    const deleteAccountResponse = await fetch(
      `https://identitytoolkit.googleapis.com/v1/accounts:delete?key=${firebaseApiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ idToken: session.accessToken }),
      },
    );

    if (!deleteAccountResponse.ok) {
      throw new Error("Failed to delete Firebase account.");
    }
  },
  async restoreSession(session) {
    if (!session.refreshToken) {
      return session;
    }

    ensureFirebaseConfig();
    const response = await fetch(`https://securetoken.googleapis.com/v1/token?key=${firebaseApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(session.refreshToken)}`,
    });

    if (!response.ok) {
      return null;
    }

    const refreshed = (await response.json()) as FirebaseRefreshResponse;
    return {
      ...session,
      accessToken: refreshed.id_token,
      refreshToken: refreshed.refresh_token,
      user: {
        ...session.user,
        id: refreshed.user_id || session.user.id,
      },
    };
  },
  async updatePassword(session, nextPassword) {
    ensureFirebaseConfig();
    const authClient = getFirebaseAuthClient();
    const currentUser = authClient.currentUser;

    if (currentUser && currentUser.uid === session.user.id) {
      await firebaseUpdatePassword(currentUser, nextPassword);
      return toFirebaseSessionFromSdkUser(currentUser);
    }

    const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:update?key=${firebaseApiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        idToken: session.accessToken,
        password: nextPassword,
        returnSecureToken: true,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to change Firebase password.");
    }

    const updated = (await response.json()) as FirebaseAuthResponse;
    return {
      ...session,
      accessToken: updated.idToken,
      refreshToken: updated.refreshToken ?? session.refreshToken,
      user: {
        ...session.user,
        id: updated.localId || session.user.id,
        email: updated.email ?? session.user.email,
        displayName: updated.displayName ?? session.user.displayName,
      },
    };
  },
};

const supabaseAuth = async (
  endpoint: string,
  body: Record<string, string | boolean>,
): Promise<SupabaseAuthResponse> => {
  ensureSupabaseConfig();
  const response = await fetch(`${supabaseUrl}/auth/v1/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      apikey: supabaseAnonKey,
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error("Supabase authentication failed.");
  }

  return (await response.json()) as SupabaseAuthResponse;
};

const toSupabaseSession = (auth: SupabaseAuthResponse): AuthSession => ({
  provider: "supabase",
  accessToken: auth.access_token,
  refreshToken: auth.refresh_token,
  user: {
    id: auth.user.id,
    email: auth.user.email ?? "unknown@supabase.local",
    displayName: auth.user.user_metadata?.full_name ?? auth.user.user_metadata?.name,
  },
});

const toSupabaseEntry = (entry: Entry, userId: string): SupabaseEntry => ({
  id: entry.id,
  user_id: userId,
  date: entry.date,
  line1: entry.lines[0],
  line2: entry.lines[1],
  line3: entry.lines[2],
  created_at: entry.createdAt,
  updated_at: entry.updatedAt,
  deleted_at: entry.deletedAt ?? null,
});

const fromSupabaseEntry = (entry: SupabaseEntry): RemoteEntry => ({
  id: entry.id,
  date: entry.date,
  line1: entry.line1,
  line2: entry.line2,
  line3: entry.line3,
  createdAt: Number(entry.created_at),
  updatedAt: Number(entry.updated_at),
  deletedAt: entry.deleted_at ?? null,
});

const supabaseClient: RemoteClient = {
  async signInWithEmail(email, password) {
    const auth = await supabaseAuth("token?grant_type=password", {
      email,
      password,
    });
    return toSupabaseSession(auth);
  },
  async signInWithApple(identityToken) {
    const auth = await supabaseAuth("token?grant_type=id_token", {
      provider: "apple",
      id_token: identityToken,
    });
    return toSupabaseSession(auth);
  },
  async signUpWithEmail(email, password) {
    const auth = await supabaseAuth("signup", {
      email,
      password,
    });
    return toSupabaseSession(auth);
  },
  async signInWithGoogle(identityToken) {
    const auth = await supabaseAuth("token?grant_type=id_token", {
      provider: "google",
      id_token: identityToken,
    });
    return toSupabaseSession(auth);
  },
  async signInAnonymously() {
    throw new Error("Anonymous sync is not supported by Supabase provider.");
  },
  async pull(session, since) {
    ensureSupabaseConfig();
    const params = new URLSearchParams({
      select: "id,user_id,date,line1,line2,line3,created_at,updated_at,deleted_at",
      user_id: `eq.${session.user.id}`,
      updated_at: `gte.${since}`,
      order: "updated_at.desc",
    });

    const response = await fetch(`${supabaseUrl}/rest/v1/journal_entries?${params.toString()}`, {
      method: "GET",
      headers: {
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.accessToken}`,
      },
    });

    if (!response.ok) {
      throw new Error("Supabase pull sync failed.");
    }

    const rows = (await response.json()) as SupabaseEntry[];
    return {
      entries: rows.map(fromSupabaseEntry),
      serverTime: Date.now(),
    };
  },
  async push(session, entries) {
    ensureSupabaseConfig();
    const body = entries.map((entry) => toSupabaseEntry(entry, session.user.id));

    const response = await fetch(`${supabaseUrl}/rest/v1/journal_entries?on_conflict=id`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.accessToken}`,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error("Supabase push sync failed.");
    }
  },
  async deleteAccount() {
    throw new Error("Account deletion is not supported by Supabase provider.");
  },
  async restoreSession(session) {
    if (!session.refreshToken) {
      return session;
    }

    ensureSupabaseConfig();
    const response = await fetch(`${supabaseUrl}/auth/v1/token?grant_type=refresh_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
      },
      body: JSON.stringify({ refresh_token: session.refreshToken }),
    });

    if (!response.ok) {
      return null;
    }

    const refreshed = (await response.json()) as SupabaseAuthResponse;
    return toSupabaseSession(refreshed);
  },
  async updatePassword(session, nextPassword) {
    ensureSupabaseConfig();
    const response = await fetch(`${supabaseUrl}/auth/v1/user`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        apikey: supabaseAnonKey,
        Authorization: `Bearer ${session.accessToken}`,
      },
      body: JSON.stringify({ password: nextPassword }),
    });

    if (!response.ok) {
      throw new Error("Failed to change Supabase password.");
    }

    return session;
  },
};

const clients: Record<SyncProvider, RemoteClient> = {
  custom: customClient,
  supabase: supabaseClient,
  firebase: firebaseClient,
};

export const activeSyncProvider = provider;
export const remoteClient = clients[provider];
export const mapRemoteEntriesToLocal = (entries: RemoteEntry[]): Entry[] => entries.map(toLocalEntry);
