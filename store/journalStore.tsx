import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import React from "react";
import {
    activeSyncProvider,
    entryNeedsRemoteImageMigration,
    mapRemoteEntriesToLocal,
    remoteClient,
} from "../services/remoteSync";
import { AuthSession, BackupPayload, Entry } from "../types/journal";
import { toDateKey } from "../utils/date";
import { t } from "../utils/i18n";

type SyncStatus = "idle" | "syncing" | "error";

type JournalContextValue = {
  entries: Entry[];
  isReady: boolean;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: number | null;
  pendingSyncCount: number;
  session: AuthSession | null;
  isPremium: boolean;
  setPremium: (value: boolean) => void;
  isGuest: boolean;
  upsertTodayEntry: (lines: [string, string, string], imageUri?: string | null, imageUris?: string[]) => Promise<void>;
  upsertEntry: (date: string, lines: [string, string, string], imageUri?: string | null, imageUris?: string[]) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  searchEntries: (keyword: string) => Entry[];
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  requestPasswordReset: (email: string) => Promise<void>;
  signInWithApple: (identityToken: string) => Promise<void>;
  signInWithGoogle: (identityToken: string) => Promise<void>;
  signInAsGuest: () => Promise<void>;
  signOut: () => Promise<void>;
  updatePassword: (nextPassword: string) => Promise<void>;
  deleteAccount: () => Promise<void>;
  syncNow: () => Promise<void>;
  exportBackup: () => Promise<string>;
  importBackup: (rawBackup: string) => Promise<void>;
};

type EntryRow = {
  id: string;
  date: string;
  line1: string;
  line2: string;
  line3: string;
  imageUri: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
};

type SyncQueueRow = {
  entryId: string;
  updatedAt: number;
  retryCount: number;
  lastError: string | null;
};

const DB_NAME = "eerme.db";
const TABLE_ENTRIES = "journal_entries";
const TABLE_SYNC_META = "sync_meta";
const TABLE_AUTH_SESSION = "auth_session";
const TABLE_SYNC_QUEUE = "sync_queue";
const SYNC_META_KEY = "lastSyncedAt";
const AUTH_MODE_KEY = "authMode";
const PREMIUM_ENABLED_KEY = "premiumEnabled";
const LAST_AUTH_USER_ID_KEY = "lastAuthUserId";
const LEGACY_IMAGE_MIGRATION_KEY_PREFIX = "legacyImageMigrationDone";
const AUTH_MODE_GUEST = "guest";
const AUTH_MODE_NONE = "none";
const AUTO_BACKUP_STORAGE_KEY = "@eerme/auto-backup:v1";
const AUTO_BACKUP_DEBOUNCE_MS = 1200;

const resolveSyncErrorMessage = (error: unknown) => {
  if (!(error instanceof Error)) return t("syncFailed");

  const message = error.message;
  const normalized = message.toLowerCase();

  if (normalized.includes("api key not valid")) return t("syncFirebaseApiKeyInvalid");
  if (normalized.includes("invalid-api-key")) return t("syncFirebaseApiKeyInvalid");
  if (normalized.includes("auth/invalid-api-key")) return t("syncFirebaseApiKeyInvalid");
  if (normalized.includes("project not found")) return t("syncFirebaseProjectNotFound");
  if (normalized.includes("database_url")) return t("syncFirebaseProjectNotFound");
  if (normalized.includes("user_disabled")) return t("syncAuthFailed");
  if (normalized.includes("auth/user-disabled")) return t("syncAuthFailed");
  if (normalized.includes("permission denied")) return t("syncAuthFailed");
  if (normalized.includes("permission_denied")) return t("syncAuthFailed");
  if (normalized.includes("database request failed (401)")) return "Firebase 데이터베이스 권한 오류 (401). Firebase 콘솔에서 Realtime Database 규칙을 확인하세요. 규칙이 'auth.uid'를 올바르게 확인하는지 점검하세요.";
  if (normalized.includes("(401)")) return "인증 오류 (401). 토큰이 만료되었거나 Firebase 규칙 설정이 잘못되었습니다. 다시 로그인하거나 Firebase 콘솔에서 Database 규칙을 확인하세요.";
  if (normalized.includes("invalid_login_credentials")) return t("syncAuthInvalidCredentials");
  if (normalized.includes("auth/invalid-credential")) return t("syncAuthInvalidCredentials");
  if (normalized.includes("auth/invalid-email")) return t("syncAuthInvalidCredentials");
  if (normalized.includes("auth/wrong-password")) return t("syncAuthInvalidCredentials");
  if (normalized.includes("auth/user-not-found")) return t("syncAuthInvalidCredentials");
  if (normalized.includes("auth/too-many-requests")) return t("syncAuthFailed");
  if (normalized.includes("auth/network-request-failed")) return t("syncFailed");
  if (normalized.includes("email_exists")) return t("syncAuthEmailExists");
  if (normalized.includes("auth/email-already-in-use")) return t("syncAuthEmailExists");
  if (normalized.includes("authentication failed")) return t("syncAuthFailed");
  if (normalized.includes("push sync failed")) return t("syncPushFailed");
  if (normalized.includes("pull sync failed")) return t("syncPullFailed");

  return message || t("syncFailed");
};

const JournalContext = React.createContext<JournalContextValue | null>(null);
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;
let dbInitPromise: Promise<void> | null = null;
let dbWriteQueue: Promise<void> = Promise.resolve();


const parseImageUris = (raw: string | null): string[] => {
  if (!raw) return [];

  const trimmed = raw.trim();
  if (!trimmed) return [];

  if (trimmed.startsWith("[")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) {
        return parsed.filter((item): item is string => typeof item === "string" && item.length > 0);
      }
    } catch {
      return [];
    }
  }

  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as Record<string, unknown>;
      return Object.keys(parsed)
        .sort((a, b) => Number(a) - Number(b))
        .map((key) => parsed[key])
        .filter((item): item is string => typeof item === "string" && item.length > 0)
        .slice(0, 10);
    } catch {
      return [];
    }
  }

  return [trimmed];
};

const normalizeImageUris = (imageUri?: string | null, imageUris?: string[]): string[] => {
  if (Array.isArray(imageUris)) {
    return imageUris.filter((item): item is string => typeof item === "string" && item.length > 0).slice(0, 10);
  }

  return imageUri ? [imageUri] : [];
};

const serializeImageUris = (imageUris: string[]): string | null => {
  if (imageUris.length === 0) return null;
  if (imageUris.length === 1) return imageUris[0];
  return JSON.stringify(imageUris);
};

const toEntry = (row: EntryRow): Entry => {
  const imageUris = parseImageUris(row.imageUri);

  return {
    id: row.id,
    date: row.date,
    lines: [row.line1 ?? "", row.line2 ?? "", row.line3 ?? ""],
    imageUri: imageUris[0] ?? null,
    imageUris,
    createdAt: Number(row.createdAt),
    updatedAt: Number(row.updatedAt),
    deletedAt: row.deletedAt,
  };
};

async function getDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }

  const db = await dbPromise;
  if (!dbInitPromise) {
    dbInitPromise = (async () => {
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS ${TABLE_ENTRIES} (
          id TEXT PRIMARY KEY NOT NULL,
          date TEXT NOT NULL,
          line1 TEXT NOT NULL,
          line2 TEXT NOT NULL,
          line3 TEXT NOT NULL,
          imageUri TEXT,
          createdAt INTEGER NOT NULL,
          updatedAt INTEGER NOT NULL,
          deletedAt INTEGER
        );`,
      );
      // Migration: add imageUri column if not exists
      try {
        await db.execAsync(`ALTER TABLE ${TABLE_ENTRIES} ADD COLUMN imageUri TEXT;`);
      } catch {
        // Column already exists, ignore
      }
      await db.execAsync(`CREATE INDEX IF NOT EXISTS idx_journal_date ON ${TABLE_ENTRIES}(date);`);
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS ${TABLE_SYNC_META} (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL
        );`,
      );
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS ${TABLE_AUTH_SESSION} (
          id INTEGER PRIMARY KEY NOT NULL,
          provider TEXT NOT NULL,
          accessToken TEXT NOT NULL,
          refreshToken TEXT,
          userId TEXT NOT NULL,
          email TEXT NOT NULL,
          displayName TEXT
        );`,
      );
      await db.execAsync(
        `CREATE TABLE IF NOT EXISTS ${TABLE_SYNC_QUEUE} (
          entryId TEXT PRIMARY KEY NOT NULL,
          updatedAt INTEGER NOT NULL,
          retryCount INTEGER NOT NULL DEFAULT 0,
          lastError TEXT
        );`,
      );
      try {
        await db.execAsync(`ALTER TABLE ${TABLE_AUTH_SESSION} ADD COLUMN refreshToken TEXT;`);
      } catch {
        // Column already exists, ignore
      }
    })();
  }

  await dbInitPromise;

  return db;
}

async function withSafeWriteTransaction(db: SQLite.SQLiteDatabase, task: () => Promise<void>) {
  if (typeof db.withExclusiveTransactionAsync === "function") {
    await db.withExclusiveTransactionAsync(task);
    return;
  }

  await db.withTransactionAsync(task);
}

async function enqueueDbWrite<T>(task: (db: SQLite.SQLiteDatabase) => Promise<T>) {
  const run = async () => {
    const db = await getDatabase();
    return task(db);
  };

  const result = dbWriteQueue.then(run, run);
  dbWriteQueue = result.then(() => undefined, () => undefined);
  return result;
}

async function loadEntriesFromDb() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT id, date, line1, line2, line3, imageUri, createdAt, updatedAt, deletedAt
     FROM ${TABLE_ENTRIES}
     ORDER BY date DESC, updatedAt DESC`,
  );
  return rows.map(toEntry);
}

async function upsertEntriesToDb(entries: Entry[]) {
  if (entries.length === 0) return;

  await enqueueDbWrite(async (db) => {
    await withSafeWriteTransaction(db, async () => {
      for (const entry of entries) {
        await db.runAsync(
          `INSERT INTO ${TABLE_ENTRIES} (id, date, line1, line2, line3, imageUri, createdAt, updatedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
              date = excluded.date,
              line1 = excluded.line1,
              line2 = excluded.line2,
              line3 = excluded.line3,
              imageUri = excluded.imageUri,
              createdAt = excluded.createdAt,
              updatedAt = excluded.updatedAt,
              deletedAt = excluded.deletedAt`,
          [
            entry.id,
            entry.date,
            entry.lines[0],
            entry.lines[1],
            entry.lines[2],
            serializeImageUris(normalizeImageUris(entry.imageUri, entry.imageUris)),
            entry.createdAt,
            entry.updatedAt,
            entry.deletedAt ?? null,
          ],
        );
      }
    });
  });
}

async function replaceEntriesToDb(entries: Entry[]) {
  await enqueueDbWrite(async (db) => {
    await withSafeWriteTransaction(db, async () => {
      await db.runAsync(`DELETE FROM ${TABLE_ENTRIES}`);

      for (const entry of entries) {
        await db.runAsync(
          `INSERT INTO ${TABLE_ENTRIES} (id, date, line1, line2, line3, imageUri, createdAt, updatedAt, deletedAt)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(id) DO UPDATE SET
              date = excluded.date,
              line1 = excluded.line1,
              line2 = excluded.line2,
              line3 = excluded.line3,
              imageUri = excluded.imageUri,
              createdAt = excluded.createdAt,
              updatedAt = excluded.updatedAt,
              deletedAt = excluded.deletedAt`,
          [
            entry.id,
            entry.date,
            entry.lines[0],
            entry.lines[1],
            entry.lines[2],
            serializeImageUris(normalizeImageUris(entry.imageUri, entry.imageUris)),
            entry.createdAt,
            entry.updatedAt,
            entry.deletedAt ?? null,
          ],
        );
      }
    });
  });
}

async function loadSessionFromDb(): Promise<AuthSession | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    provider: AuthSession["provider"];
    accessToken: string;
    refreshToken: string | null;
    userId: string;
    email: string;
    displayName: string | null;
  }>(`SELECT provider, accessToken, refreshToken, userId, email, displayName FROM ${TABLE_AUTH_SESSION} WHERE id = 1`);

  if (!row) return null;
  return {
    provider: row.provider,
    accessToken: row.accessToken,
    refreshToken: row.refreshToken ?? undefined,
    user: {
      id: row.userId,
      email: row.email,
      displayName: row.displayName ?? undefined,
    },
  };
}

async function saveSessionToDb(session: AuthSession | null) {
  await enqueueDbWrite(async (db) => {
    if (!session) {
      await db.runAsync(`DELETE FROM ${TABLE_AUTH_SESSION} WHERE id = 1`);
      return;
    }

    await db.runAsync(
      `INSERT INTO ${TABLE_AUTH_SESSION} (id, provider, accessToken, refreshToken, userId, email, displayName)
       VALUES (1, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
        provider = excluded.provider,
        accessToken = excluded.accessToken,
        refreshToken = excluded.refreshToken,
        userId = excluded.userId,
        email = excluded.email,
        displayName = excluded.displayName`,
      [
        session.provider,
        session.accessToken,
        session.refreshToken ?? null,
        session.user.id,
        session.user.email,
        session.user.displayName ?? null,
      ],
    );
  });
}

async function loadLastSyncedAt() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM ${TABLE_SYNC_META} WHERE key = ?`, [SYNC_META_KEY]);
  return row ? Number(row.value) : 0;
}

async function saveLastSyncedAt(value: number) {
  await enqueueDbWrite(async (db) => {
    await db.runAsync(
      `INSERT INTO ${TABLE_SYNC_META} (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [SYNC_META_KEY, String(value)],
    );
  });
}

const getLegacyImageMigrationKey = (userId: string) => `${LEGACY_IMAGE_MIGRATION_KEY_PREFIX}:${userId}`;

async function loadLegacyImageMigrationDone(userId: string) {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM ${TABLE_SYNC_META} WHERE key = ?`, [
    getLegacyImageMigrationKey(userId),
  ]);
  return row?.value === "true";
}

async function saveLegacyImageMigrationDone(userId: string, value: boolean) {
  const key = getLegacyImageMigrationKey(userId);

  await enqueueDbWrite(async (db) => {
    if (!value) {
      await db.runAsync(`DELETE FROM ${TABLE_SYNC_META} WHERE key = ?`, [key]);
      return;
    }

    await db.runAsync(
      `INSERT INTO ${TABLE_SYNC_META} (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [key, "true"],
    );
  });
}


async function loadAuthMode() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM ${TABLE_SYNC_META} WHERE key = ?`, [AUTH_MODE_KEY]);
  return row?.value ?? AUTH_MODE_NONE;
}

async function loadPremiumEnabled() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM ${TABLE_SYNC_META} WHERE key = ?`, [PREMIUM_ENABLED_KEY]);
  return row?.value === "true";
}

async function savePremiumEnabled(value: boolean) {
  await enqueueDbWrite(async (db) => {
    await db.runAsync(
      `INSERT INTO ${TABLE_SYNC_META} (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [PREMIUM_ENABLED_KEY, value ? "true" : "false"],
    );
  });
}

async function loadLastAuthUserId() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM ${TABLE_SYNC_META} WHERE key = ?`, [LAST_AUTH_USER_ID_KEY]);
  return row?.value ?? null;
}

async function saveLastAuthUserId(userId: string | null) {
  await enqueueDbWrite(async (db) => {
    if (!userId) {
      await db.runAsync(`DELETE FROM ${TABLE_SYNC_META} WHERE key = ?`, [LAST_AUTH_USER_ID_KEY]);
      return;
    }

    await db.runAsync(
      `INSERT INTO ${TABLE_SYNC_META} (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [LAST_AUTH_USER_ID_KEY, userId],
    );
  });
}

async function saveAuthMode(value: string) {
  await enqueueDbWrite(async (db) => {
    await db.runAsync(
      `INSERT INTO ${TABLE_SYNC_META} (key, value)
       VALUES (?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
      [AUTH_MODE_KEY, value],
    );
  });
}

async function loadSyncQueueFromDb() {
  const db = await getDatabase();
  return db.getAllAsync<SyncQueueRow>(
    `SELECT entryId, updatedAt, retryCount, lastError
     FROM ${TABLE_SYNC_QUEUE}
     ORDER BY updatedAt DESC`,
  );
}

async function enqueueSyncFromEntries(entries: Entry[]) {
  if (entries.length === 0) return;
  await enqueueDbWrite(async (db) => {
    await withSafeWriteTransaction(db, async () => {
      for (const entry of entries) {
        await db.runAsync(
          `INSERT INTO ${TABLE_SYNC_QUEUE} (entryId, updatedAt, retryCount, lastError)
           VALUES (?, ?, 0, NULL)
           ON CONFLICT(entryId) DO UPDATE SET
              updatedAt = excluded.updatedAt,
              retryCount = 0,
              lastError = NULL`,
          [entry.id, entry.updatedAt],
        );
      }
    });
  });
}

async function clearSyncQueueByIds(entryIds: string[]) {
  if (entryIds.length === 0) return;
  await enqueueDbWrite(async (db) => {
    await withSafeWriteTransaction(db, async () => {
      for (const entryId of entryIds) {
        await db.runAsync(`DELETE FROM ${TABLE_SYNC_QUEUE} WHERE entryId = ?`, [entryId]);
      }
    });
  });
}

async function clearSyncQueueAll() {
  await enqueueDbWrite(async (db) => {
    await db.runAsync(`DELETE FROM ${TABLE_SYNC_QUEUE}`);
  });
}

async function markSyncQueueFailed(entryIds: string[], errorMessage: string) {
  if (entryIds.length === 0) return;
  await enqueueDbWrite(async (db) => {
    await withSafeWriteTransaction(db, async () => {
      for (const entryId of entryIds) {
        await db.runAsync(
          `UPDATE ${TABLE_SYNC_QUEUE}
           SET retryCount = retryCount + 1,
               lastError = ?
           WHERE entryId = ?`,
          [errorMessage, entryId],
        );
      }
    });
  });
}

function mergeEntries(local: Entry[], remote: Entry[]) {
  const byId = new Map(local.map((entry) => [entry.id, entry]));
  for (const remoteEntry of remote) {
    const current = byId.get(remoteEntry.id);
    if (!current || remoteEntry.updatedAt >= current.updatedAt) {
      const hasRemoteImages = Boolean(remoteEntry.imageUris?.length || remoteEntry.imageUri);
      const nextEntry = hasRemoteImages
        ? remoteEntry
        : {
            ...remoteEntry,
            imageUri: current?.imageUri ?? null,
            imageUris: current?.imageUris ?? (current?.imageUri ? [current.imageUri] : []),
          };

      byId.set(remoteEntry.id, nextEntry);
    }
  }

  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
}

function normalizeBackupEntries(entries: Entry[]) {
  return entries
    .filter((entry) => entry && typeof entry.id === "string" && typeof entry.date === "string")
    .map((entry) => {
      const imageUris = normalizeImageUris(entry.imageUri, entry.imageUris);
      const createdAt = Number(entry.createdAt);
      const updatedAt = Number(entry.updatedAt);
      const deletedAt = entry.deletedAt == null ? null : Number(entry.deletedAt);

      return {
        id: entry.id,
        date: entry.date,
        lines: [String(entry.lines?.[0] ?? ""), String(entry.lines?.[1] ?? ""), String(entry.lines?.[2] ?? "")] as [
          string,
          string,
          string,
        ],
        imageUris,
        imageUri: imageUris[0] ?? null,
        createdAt: Number.isFinite(createdAt) ? createdAt : Date.now(),
        updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
        deletedAt: Number.isFinite(deletedAt) ? deletedAt : null,
      };
    });
}

function buildBackupPayload(entries: Entry[]): BackupPayload {
  return {
    version: 1,
    exportedAt: Date.now(),
    entries,
  };
}

export function JournalProvider({ children }: React.PropsWithChildren) {
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const entriesRef = React.useRef<Entry[]>([]);
  const lastSyncedAtRef = React.useRef<number | null>(null);
  const [isReady, setIsReady] = React.useState(false);
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [isGuest, setIsGuest] = React.useState(false);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus>("idle");
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = React.useState(0);
  const [isPremium, setIsPremium] = React.useState(false);
  const [lastAuthUserId, setLastAuthUserId] = React.useState<string | null>(null);
  const autoBackupTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastAutoBackupHashRef = React.useRef<string>("");

  const setPremium = React.useCallback((value: boolean) => {
    setIsPremium(value);
    savePremiumEnabled(value).catch((error) => {
      console.error("Failed to persist premium status", error);
    });
  }, []);

  const visibleEntries = React.useMemo(() => entries.filter((entry) => !entry.deletedAt), [entries]);

  React.useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  React.useEffect(() => {
    lastSyncedAtRef.current = lastSyncedAt;
  }, [lastSyncedAt]);

  const refreshPendingSyncCount = React.useCallback(async () => {
    const queue = await loadSyncQueueFromDb();
    setPendingSyncCount(queue.length);
    return queue;
  }, []);

  const performSync = React.useCallback(
    async (targetSession: AuthSession, sourceEntries: Entry[], since: number | null) => {
      setSyncStatus("syncing");
      setSyncError(null);

      const queue = await loadSyncQueueFromDb();
      const queuedIds = queue.map((item) => item.entryId);
      const queuedIdSet = new Set(queuedIds);
      const queuedEntries = queuedIdSet.size > 0
        ? sourceEntries.filter((entry) => queuedIdSet.has(entry.id))
        : [];
      const hasLikelyLegacyImages = sourceEntries.some((entry) => !entry.deletedAt && entryNeedsRemoteImageMigration(entry));
      const legacyImageMigrationDone = await loadLegacyImageMigrationDone(targetSession.user.id);
      const shouldSweepLegacyImages = activeSyncProvider === "firebase"
        && (hasLikelyLegacyImages || !legacyImageMigrationDone);
      const legacyImageEntries = shouldSweepLegacyImages
        ? sourceEntries.filter((entry) => (
            !entry.deletedAt
            && !queuedIdSet.has(entry.id)
            && entryNeedsRemoteImageMigration(entry)
          ))
        : [];
      const pushEntries = queuedEntries.concat(legacyImageEntries);
      let didCompleteLegacyImageSweep = false;

      try {
        if (pushEntries.length > 0) {
          await remoteClient.push(targetSession, pushEntries);
          await clearSyncQueueByIds(queuedIds);
        }

        const pullResult = await remoteClient.pull(targetSession, since ?? 0);
        const remoteEntries = mapRemoteEntriesToLocal(pullResult.entries);
        const merged = mergeEntries(sourceEntries, remoteEntries);
        const hasRemainingLegacyImages = activeSyncProvider === "firebase"
          && merged.some((entry) => !entry.deletedAt && entryNeedsRemoteImageMigration(entry));
        didCompleteLegacyImageSweep = shouldSweepLegacyImages && !hasRemainingLegacyImages;

        await upsertEntriesToDb(merged);
        await saveLastSyncedAt(pullResult.serverTime);
        if (shouldSweepLegacyImages) {
          await saveLegacyImageMigrationDone(targetSession.user.id, didCompleteLegacyImageSweep);
        }

        setEntries(merged);
        entriesRef.current = merged;
        setLastSyncedAt(pullResult.serverTime);
        lastSyncedAtRef.current = pullResult.serverTime;
        setSyncStatus("idle");
      } catch (error) {
        const message = resolveSyncErrorMessage(error);
        await markSyncQueueFailed(queuedIds, message);
        setSyncStatus("error");
        setSyncError(message);
        throw new Error(message);
      } finally {
        await refreshPendingSyncCount();
      }
    },
    [refreshPendingSyncCount],
  );

  const syncNow = React.useCallback(async () => {
    if (!session) return;

    let activeSession = session;
    if (remoteClient.restoreSession) {
      const restoredSession = await remoteClient.restoreSession(session);

      if (!restoredSession) {
        setSession(null);
        setIsGuest(false);
        await saveSessionToDb(null);
        await saveAuthMode(AUTH_MODE_NONE);
        throw new Error(t("syncAuthFailed"));
      }

      if (
        restoredSession.accessToken !== session.accessToken
        || restoredSession.refreshToken !== session.refreshToken
      ) {
        setSession(restoredSession);
        await saveSessionToDb(restoredSession);
      }

      activeSession = restoredSession;
    }

    await performSync(activeSession, entriesRef.current, lastSyncedAtRef.current);
  }, [performSync, session]);

  React.useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const [loadedEntries, loadedSession, loadedLastSyncedAt, loadedAuthMode, loadedPremiumEnabled, loadedLastAuthUserId] = await Promise.all([
          loadEntriesFromDb(),
          loadSessionFromDb(),
          loadLastSyncedAt(),
          loadAuthMode(),
          loadPremiumEnabled(),
          loadLastAuthUserId(),
        ]);

        if (!mounted) return;

        setEntries(loadedEntries);
        entriesRef.current = loadedEntries;
        setLastSyncedAt(loadedLastSyncedAt);
        lastSyncedAtRef.current = loadedLastSyncedAt;
        setIsPremium(loadedPremiumEnabled);
        setLastAuthUserId(loadedLastAuthUserId);

        let nextSession = loadedSession;
        if (loadedSession && remoteClient.restoreSession) {
          try {
            nextSession = await remoteClient.restoreSession(loadedSession);
          } catch {
            nextSession = null;
          }
        }

        if (loadedSession && !nextSession) {
          await saveSessionToDb(null);
        } else if (
          loadedSession
          && nextSession
          && (nextSession.accessToken !== loadedSession.accessToken
            || nextSession.refreshToken !== loadedSession.refreshToken)
        ) {
          await saveSessionToDb(nextSession);
        }

        setSession(nextSession);
        setIsGuest(nextSession ? false : loadedAuthMode === AUTH_MODE_GUEST);
        await refreshPendingSyncCount();
        setIsReady(true);

        if (nextSession) {
          try {
            await performSync(nextSession, loadedEntries, loadedLastSyncedAt);
          } catch {
            // displayed via syncError state
          }
        }
      } catch (error) {
        console.error("Failed to bootstrap journal store", error);
        if (mounted) {
          setSyncStatus("error");
          setSyncError(t("loadLocalFailed"));
          setIsReady(true);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [performSync, refreshPendingSyncCount]);


  React.useEffect(() => {
    if (!session || !isReady) return;

    syncNow().catch((error) => {
      console.warn("Background sync failed after sign-in", error);
    });
  }, [isReady, session, syncNow]);

  React.useEffect(() => {
    if (!isReady) return;

    const payload = buildBackupPayload(entriesRef.current);
    const serialized = JSON.stringify(payload);

    if (serialized === lastAutoBackupHashRef.current) {
      return;
    }

    if (autoBackupTimeoutRef.current) {
      clearTimeout(autoBackupTimeoutRef.current);
    }

    autoBackupTimeoutRef.current = setTimeout(() => {
      AsyncStorage.setItem(AUTO_BACKUP_STORAGE_KEY, serialized)
        .then(() => {
          lastAutoBackupHashRef.current = serialized;
        })
        .catch((error) => {
          console.warn("Automatic backup failed", error);
        });
    }, AUTO_BACKUP_DEBOUNCE_MS);

    return () => {
      if (autoBackupTimeoutRef.current) {
        clearTimeout(autoBackupTimeoutRef.current);
        autoBackupTimeoutRef.current = null;
      }
    };
  }, [entries, isReady]);

  const upsertEntry = React.useCallback(
    async (date: string, lines: [string, string, string], imageUri?: string | null, imageUris?: string[]) => {
      const now = Date.now();
      const currentEntries = entriesRef.current;
      const existing = currentEntries.find((entry) => entry.date === date && !entry.deletedAt);

      const nextImageUris = imageUris !== undefined
        ? normalizeImageUris(undefined, imageUris)
        : imageUri !== undefined
          ? normalizeImageUris(imageUri, undefined)
          : normalizeImageUris(existing?.imageUri, existing?.imageUris);

      const nextEntry: Entry = existing
        ? { ...existing, lines, imageUri: nextImageUris[0] ?? null, imageUris: nextImageUris, updatedAt: now, deletedAt: null }
        : {
            id: `${date}-${now}`,
            date,
            lines,
            imageUri: nextImageUris[0] ?? null,
            imageUris: nextImageUris,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          };

      const nextEntries = mergeEntries(currentEntries.filter((entry) => entry.id !== nextEntry.id), [nextEntry]);
      setEntries(nextEntries);
      entriesRef.current = nextEntries;
      await upsertEntriesToDb([nextEntry]);
      await enqueueSyncFromEntries([nextEntry]);
      await refreshPendingSyncCount();

      if (session) {
        syncNow().catch((error) => {
          console.warn("Background sync failed", error);
        });
      }
    },
    [refreshPendingSyncCount, session, syncNow],
  );

  const upsertTodayEntry = React.useCallback(
    async (lines: [string, string, string], imageUri?: string | null, imageUris?: string[]) => {
      const date = toDateKey();
      await upsertEntry(date, lines, imageUri, imageUris);
    },
    [upsertEntry],
  );

  const removeEntry = React.useCallback(
    async (id: string) => {
      const now = Date.now();
      const currentEntries = entriesRef.current;
      const target = currentEntries.find((entry) => entry.id === id);
      if (!target) return;

      const deleted: Entry = { ...target, updatedAt: now, deletedAt: now };
      const nextEntries = mergeEntries(currentEntries.filter((entry) => entry.id !== id), [deleted]);

      setEntries(nextEntries);
      entriesRef.current = nextEntries;
      await upsertEntriesToDb([deleted]);
      await enqueueSyncFromEntries([deleted]);
      await refreshPendingSyncCount();

      if (session) {
        syncNow().catch((error) => {
          console.warn("Background sync failed", error);
        });
      }
    },
    [refreshPendingSyncCount, session, syncNow],
  );

  const searchEntries = React.useCallback(
    (keyword: string) => {
      const token = keyword.trim().toLowerCase();
      if (!token) return visibleEntries;
      return visibleEntries.filter((entry) => entry.lines.some((line) => line.toLowerCase().includes(token)));
    },
    [visibleEntries],
  );

  const resetLocalDataForAccountSwitch = React.useCallback(async () => {
    await replaceEntriesToDb([]);
    await clearSyncQueueAll();
    await saveLastSyncedAt(0);

    setEntries([]);
    entriesRef.current = [];
    setLastSyncedAt(0);
    lastSyncedAtRef.current = 0;
    await refreshPendingSyncCount();
  }, [refreshPendingSyncCount]);

  const applyAuthenticatedSession = React.useCallback(
    async (nextSession: AuthSession) => {
      const previousUserIds = [lastAuthUserId, session?.user.id].filter((value): value is string => Boolean(value));
      const isSwitchingAccount = previousUserIds.some((userId) => userId !== nextSession.user.id);

      if (isSwitchingAccount) {
        await resetLocalDataForAccountSwitch();
      }

      setSession(nextSession);
      setIsGuest(false);
      setLastAuthUserId(nextSession.user.id);
      await saveSessionToDb(nextSession);
      await saveAuthMode(AUTH_MODE_NONE);
      await saveLastAuthUserId(nextSession.user.id);

      const sourceEntries = isSwitchingAccount ? [] : entries;
      const sourceSince = isSwitchingAccount ? 0 : lastSyncedAt;
      await performSync(nextSession, sourceEntries, sourceSince);
    },
    [entries, lastAuthUserId, lastSyncedAt, performSync, resetLocalDataForAccountSwitch, session?.user.id],
  );

  const signInWithEmail = React.useCallback(
    async (email: string, password: string) => {
      const nextSession = await remoteClient.signInWithEmail(email, password);
      await applyAuthenticatedSession(nextSession);
    },
    [applyAuthenticatedSession],
  );

  const signUpWithEmail = React.useCallback(
    async (email: string, password: string) => {
      if (!remoteClient.signUpWithEmail) {
        throw new Error(t("emailSignupUnsupported"));
      }

      const nextSession = await remoteClient.signUpWithEmail(email, password);
      await applyAuthenticatedSession(nextSession);
    },
    [applyAuthenticatedSession],
  );

  const requestPasswordReset = React.useCallback(async (email: string) => {
    if (!remoteClient.requestPasswordReset) {
      throw new Error(t("authResetUnsupported"));
    }

    await remoteClient.requestPasswordReset(email);
  }, []);

  const signInWithApple = React.useCallback(
    async (identityToken: string) => {
      const nextSession = await remoteClient.signInWithApple(identityToken);
      await applyAuthenticatedSession(nextSession);
    },
    [applyAuthenticatedSession],
  );

  const signInWithGoogle = React.useCallback(
    async (identityToken: string) => {
      const nextSession = await remoteClient.signInWithGoogle(identityToken);
      await applyAuthenticatedSession(nextSession);
    },
    [applyAuthenticatedSession],
  );

  const signInAsGuest = React.useCallback(async () => {
    setSession(null);
    setIsGuest(true);
    await saveSessionToDb(null);
    await saveAuthMode(AUTH_MODE_GUEST);
  }, []);

  const signOut = React.useCallback(async () => {
    const previousUserId = session?.user.id ?? lastAuthUserId;

    await resetLocalDataForAccountSwitch();

    setSession(null);
    setIsGuest(false);
    await saveSessionToDb(null);
    await saveAuthMode(AUTH_MODE_NONE);

    if (previousUserId) {
      setLastAuthUserId(previousUserId);
      await saveLastAuthUserId(previousUserId);
      return;
    }

    setLastAuthUserId(null);
    await saveLastAuthUserId(null);
  }, [lastAuthUserId, resetLocalDataForAccountSwitch, session?.user.id]);

  const updatePassword = React.useCallback(async (nextPassword: string) => {
    if (!session) {
      throw new Error(t("authSessionMissing"));
    }

    if (!remoteClient.updatePassword) {
      throw new Error(t("authPasswordUpdateUnsupported"));
    }

    const updatedSession = await remoteClient.updatePassword(session, nextPassword);
    setSession(updatedSession);
    await saveSessionToDb(updatedSession);
  }, [session]);

  const deleteAccount = React.useCallback(async () => {
    if (!session) {
      throw new Error(t("authSessionMissing"));
    }

    if (!remoteClient.deleteAccount) {
      throw new Error(t("authDeleteUnsupported"));
    }

    await remoteClient.deleteAccount(session);
    await replaceEntriesToDb([]);
    await clearSyncQueueAll();
    await saveLastSyncedAt(0);
    await saveSessionToDb(null);
    await saveAuthMode(AUTH_MODE_NONE);
    await saveLastAuthUserId(null);

    setEntries([]);
    entriesRef.current = [];
    setLastSyncedAt(0);
    lastSyncedAtRef.current = 0;
    setSession(null);
    setIsGuest(false);
    setLastAuthUserId(null);
    await refreshPendingSyncCount();
  }, [refreshPendingSyncCount, session]);

  const exportBackup = React.useCallback(async () => {
    const backup = buildBackupPayload(entries);

    return JSON.stringify(backup, null, 2);
  }, [entries]);

  const importBackup = React.useCallback(
    async (rawBackup: string) => {
      let parsed: unknown;

      try {
        parsed = JSON.parse(rawBackup);
      } catch {
        throw new Error(t("backupJsonInvalid"));
      }

      if (!parsed || typeof parsed !== "object") {
        throw new Error(t("backupDataEmpty"));
      }

      const candidate = parsed as Partial<BackupPayload>;
      if (candidate.version !== 1 || !Array.isArray(candidate.entries)) {
        throw new Error(t("backupVersionUnsupported"));
      }

      const importedEntries = normalizeBackupEntries(candidate.entries as Entry[]);
      await replaceEntriesToDb(importedEntries);
      await enqueueSyncFromEntries(importedEntries);
      setEntries(importedEntries);
      entriesRef.current = importedEntries;
      await refreshPendingSyncCount();

      if (session) {
        syncNow().catch((error) => {
          console.warn("Background sync failed after backup import", error);
        });
      }
    },
    [refreshPendingSyncCount, session, syncNow],
  );

  const value = React.useMemo(
    () => ({
      entries: visibleEntries,
      isReady,
      syncStatus,
      syncError,
      lastSyncedAt,
      pendingSyncCount,
      session,
      isPremium,
      setPremium,
      isGuest,
      upsertTodayEntry,
      upsertEntry,
      removeEntry,
      searchEntries,
      signInWithEmail,
      signUpWithEmail,
      requestPasswordReset,
      signInWithApple,
      signInWithGoogle,
      signInAsGuest,
      signOut,
      updatePassword,
      deleteAccount,
      syncNow,
      exportBackup,
      importBackup,
    }),
    [
      exportBackup,
      importBackup,
      isPremium,
      isReady,
      lastSyncedAt,
      pendingSyncCount,
      removeEntry,
      searchEntries,
      session,
      setPremium,
      isGuest,
      signInWithApple,
      signInWithEmail,
      signUpWithEmail,
      requestPasswordReset,
      signInWithGoogle,
      signInAsGuest,
      signOut,
      updatePassword,
      deleteAccount,
      syncError,
      syncNow,
      syncStatus,
      upsertTodayEntry,
      upsertEntry,
      visibleEntries,
    ],
  );

  return <JournalContext.Provider value={value}>{children}</JournalContext.Provider>;
}

export function useJournalStore() {
  const context = React.useContext(JournalContext);
  if (!context) {
    throw new Error("useJournalStore must be used within JournalProvider");
  }

  return context;
}
