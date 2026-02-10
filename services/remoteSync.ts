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
  localId: string;
  email?: string;
  displayName?: string;
};

type FirebaseEntriesMap = Record<string, RemoteEntry>;

type SupabaseAuthResponse = {
  access_token: string;
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
  signInWithApple: (identityToken: string) => Promise<AuthSession>;
  signInWithGoogle: (identityToken: string) => Promise<AuthSession>;
  pull: (session: AuthSession, since: number) => Promise<SyncPullResponse>;
  push: (session: AuthSession, entries: Entry[]) => Promise<void>;
};

const provider = (process.env.EXPO_PUBLIC_SYNC_PROVIDER as SyncProvider | undefined) ?? "custom";
const apiBaseUrl = process.env.EXPO_PUBLIC_SYNC_API_BASE_URL ?? "";
const firebaseApiKey = process.env.EXPO_PUBLIC_FIREBASE_API_KEY ?? "";
const firebaseDatabaseUrl = process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL ?? "";
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
};

const firebaseAuth = async (path: string, payload: Record<string, unknown>) => {
  ensureFirebaseConfig();
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/${path}?key=${firebaseApiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error("Firebase authentication failed.");
  }

  return (await response.json()) as FirebaseAuthResponse;
};

const toFirebaseSession = (data: FirebaseAuthResponse): AuthSession => ({
  provider: "firebase",
  accessToken: data.idToken,
  user: {
    id: data.localId,
    email: data.email ?? "unknown@firebase.local",
    displayName: data.displayName,
  },
});

const firebaseClient: RemoteClient = {
  async signInWithEmail(email, password) {
    const auth = await firebaseAuth("accounts:signInWithPassword", {
      email,
      password,
      returnSecureToken: true,
    });

    return toFirebaseSession(auth);
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
  async signInWithGoogle(identityToken) {
    const auth = await firebaseAuth("accounts:signInWithIdp", {
      postBody: `id_token=${encodeURIComponent(identityToken)}&providerId=google.com`,
      requestUri: "https://localhost",
      returnSecureToken: true,
      returnIdpCredential: true,
    });

    return toFirebaseSession(auth);
  },
  async pull(session, since) {
    ensureFirebaseConfig();
    const response = await fetch(`${firebaseDatabaseUrl}/entries/${session.user.id}.json?auth=${session.accessToken}`);
    if (!response.ok) {
      throw new Error("Firebase pull sync failed.");
    }

    const payload = (await response.json()) as FirebaseEntriesMap | null;
    const entries = payload
      ? Object.values(payload).filter((entry) => Number(entry.updatedAt) >= since)
      : [];

    return {
      entries,
      serverTime: Date.now(),
    };
  },
  async push(session, entries) {
    ensureFirebaseConfig();
    const body = entries.reduce<Record<string, RemoteEntry>>((acc, entry) => {
      acc[entry.id] = toRemoteEntry(entry);
      return acc;
    }, {});

    const response = await fetch(`${firebaseDatabaseUrl}/entries/${session.user.id}.json?auth=${session.accessToken}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error("Firebase push sync failed.");
    }
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
  async signInWithGoogle(identityToken) {
    const auth = await supabaseAuth("token?grant_type=id_token", {
      provider: "google",
      id_token: identityToken,
    });
    return toSupabaseSession(auth);
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
};

const clients: Record<SyncProvider, RemoteClient> = {
  custom: customClient,
  supabase: supabaseClient,
  firebase: firebaseClient,
};

export const remoteClient = clients[provider];
export const mapRemoteEntriesToLocal = (entries: RemoteEntry[]): Entry[] => entries.map(toLocalEntry);
