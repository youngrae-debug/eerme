import React from "react";
import * as SQLite from "expo-sqlite";
import { mapRemoteEntriesToLocal, remoteClient } from "../services/remoteSync";
import { AuthSession, BackupPayload, Entry } from "../types/journal";
import { toDateKey } from "../utils/date";

type SyncStatus = "idle" | "syncing" | "error";

type JournalContextValue = {
  entries: Entry[];
  isReady: boolean;
  syncStatus: SyncStatus;
  syncError: string | null;
  lastSyncedAt: number | null;
  pendingSyncCount: number;
  session: AuthSession | null;
  upsertTodayEntry: (lines: [string, string, string]) => Promise<void>;
  removeEntry: (id: string) => Promise<void>;
  searchEntries: (keyword: string) => Entry[];
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInWithApple: (identityToken: string) => Promise<void>;
  signInWithGoogle: (identityToken: string) => Promise<void>;
  signOut: () => Promise<void>;
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

const JournalContext = React.createContext<JournalContextValue | null>(null);
let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

const toEntry = (row: EntryRow): Entry => ({
  id: row.id,
  date: row.date,
  lines: [row.line1 ?? "", row.line2 ?? "", row.line3 ?? ""],
  createdAt: Number(row.createdAt),
  updatedAt: Number(row.updatedAt),
  deletedAt: row.deletedAt,
});

async function getDatabase() {
  if (!dbPromise) {
    dbPromise = SQLite.openDatabaseAsync(DB_NAME);
  }

  const db = await dbPromise;
  await db.execAsync(
    `CREATE TABLE IF NOT EXISTS ${TABLE_ENTRIES} (
      id TEXT PRIMARY KEY NOT NULL,
      date TEXT NOT NULL,
      line1 TEXT NOT NULL,
      line2 TEXT NOT NULL,
      line3 TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      deletedAt INTEGER
    );`,
  );
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

  return db;
}

async function loadEntriesFromDb() {
  const db = await getDatabase();
  const rows = await db.getAllAsync<EntryRow>(
    `SELECT id, date, line1, line2, line3, createdAt, updatedAt, deletedAt
     FROM ${TABLE_ENTRIES}
     ORDER BY date DESC, updatedAt DESC`,
  );
  return rows.map(toEntry);
}

async function upsertEntriesToDb(entries: Entry[]) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const entry of entries) {
      await db.runAsync(
        `INSERT INTO ${TABLE_ENTRIES} (id, date, line1, line2, line3, createdAt, updatedAt, deletedAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
            date = excluded.date,
            line1 = excluded.line1,
            line2 = excluded.line2,
            line3 = excluded.line3,
            createdAt = excluded.createdAt,
            updatedAt = excluded.updatedAt,
            deletedAt = excluded.deletedAt`,
        [
          entry.id,
          entry.date,
          entry.lines[0],
          entry.lines[1],
          entry.lines[2],
          entry.createdAt,
          entry.updatedAt,
          entry.deletedAt ?? null,
        ],
      );
    }
  });
}

async function replaceEntriesToDb(entries: Entry[]) {
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    await db.runAsync(`DELETE FROM ${TABLE_ENTRIES}`);
  });
  await upsertEntriesToDb(entries);
}

async function loadSessionFromDb(): Promise<AuthSession | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{
    provider: AuthSession["provider"];
    accessToken: string;
    userId: string;
    email: string;
    displayName: string | null;
  }>(`SELECT provider, accessToken, userId, email, displayName FROM ${TABLE_AUTH_SESSION} WHERE id = 1`);

  if (!row) return null;
  return {
    provider: row.provider,
    accessToken: row.accessToken,
    user: {
      id: row.userId,
      email: row.email,
      displayName: row.displayName ?? undefined,
    },
  };
}

async function saveSessionToDb(session: AuthSession | null) {
  const db = await getDatabase();
  if (!session) {
    await db.runAsync(`DELETE FROM ${TABLE_AUTH_SESSION} WHERE id = 1`);
    return;
  }

  await db.runAsync(
    `INSERT INTO ${TABLE_AUTH_SESSION} (id, provider, accessToken, userId, email, displayName)
     VALUES (1, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
      provider = excluded.provider,
      accessToken = excluded.accessToken,
      userId = excluded.userId,
      email = excluded.email,
      displayName = excluded.displayName`,
    [session.provider, session.accessToken, session.user.id, session.user.email, session.user.displayName ?? null],
  );
}

async function loadLastSyncedAt() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ value: string }>(`SELECT value FROM ${TABLE_SYNC_META} WHERE key = ?`, [SYNC_META_KEY]);
  return row ? Number(row.value) : 0;
}

async function saveLastSyncedAt(value: number) {
  const db = await getDatabase();
  await db.runAsync(
    `INSERT INTO ${TABLE_SYNC_META} (key, value)
     VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [SYNC_META_KEY, String(value)],
  );
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
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
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
}

async function clearSyncQueueByIds(entryIds: string[]) {
  if (entryIds.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
    for (const entryId of entryIds) {
      await db.runAsync(`DELETE FROM ${TABLE_SYNC_QUEUE} WHERE entryId = ?`, [entryId]);
    }
  });
}

async function markSyncQueueFailed(entryIds: string[], errorMessage: string) {
  if (entryIds.length === 0) return;
  const db = await getDatabase();
  await db.withTransactionAsync(async () => {
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
}

function mergeEntries(local: Entry[], remote: Entry[]) {
  const byId = new Map(local.map((entry) => [entry.id, entry]));
  for (const remoteEntry of remote) {
    const current = byId.get(remoteEntry.id);
    if (!current || remoteEntry.updatedAt >= current.updatedAt) {
      byId.set(remoteEntry.id, remoteEntry);
    }
  }

  return [...byId.values()].sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt - a.updatedAt);
}

function normalizeBackupEntries(entries: Entry[]) {
  return entries
    .filter((entry) => entry && typeof entry.id === "string" && typeof entry.date === "string")
    .map((entry) => ({
      id: entry.id,
      date: entry.date,
      lines: [entry.lines?.[0] ?? "", entry.lines?.[1] ?? "", entry.lines?.[2] ?? ""] as [string, string, string],
      createdAt: Number(entry.createdAt) || Date.now(),
      updatedAt: Number(entry.updatedAt) || Date.now(),
      deletedAt: entry.deletedAt ?? null,
    }));
}

export function JournalProvider({ children }: React.PropsWithChildren) {
  const [entries, setEntries] = React.useState<Entry[]>([]);
  const [isReady, setIsReady] = React.useState(false);
  const [session, setSession] = React.useState<AuthSession | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<number | null>(null);
  const [syncStatus, setSyncStatus] = React.useState<SyncStatus>("idle");
  const [syncError, setSyncError] = React.useState<string | null>(null);
  const [pendingSyncCount, setPendingSyncCount] = React.useState(0);

  const visibleEntries = React.useMemo(() => entries.filter((entry) => !entry.deletedAt), [entries]);

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
      const queuedEntries = queuedIds.length
        ? sourceEntries.filter((entry) => queuedIds.includes(entry.id))
        : [];

      try {
        if (queuedEntries.length > 0) {
          await remoteClient.push(targetSession, queuedEntries);
          await clearSyncQueueByIds(queuedIds);
        }

        const pullResult = await remoteClient.pull(targetSession, since ?? 0);
        const remoteEntries = mapRemoteEntriesToLocal(pullResult.entries);
        const merged = mergeEntries(sourceEntries, remoteEntries);

        await upsertEntriesToDb(merged);
        await saveLastSyncedAt(pullResult.serverTime);

        setEntries(merged);
        setLastSyncedAt(pullResult.serverTime);
        setSyncStatus("idle");
      } catch (error) {
        const message = error instanceof Error ? error.message : "동기화에 실패했습니다.";
        await markSyncQueueFailed(queuedIds, message);
        setSyncStatus("error");
        setSyncError(message);
        throw error;
      } finally {
        await refreshPendingSyncCount();
      }
    },
    [refreshPendingSyncCount],
  );

  const syncNow = React.useCallback(async () => {
    if (!session) return;
    await performSync(session, entries, lastSyncedAt);
  }, [entries, lastSyncedAt, performSync, session]);

  React.useEffect(() => {
    let mounted = true;

    const bootstrap = async () => {
      try {
        const [loadedEntries, loadedSession, loadedLastSyncedAt] = await Promise.all([
          loadEntriesFromDb(),
          loadSessionFromDb(),
          loadLastSyncedAt(),
        ]);

        if (!mounted) return;

        setEntries(loadedEntries);
        setSession(loadedSession);
        setLastSyncedAt(loadedLastSyncedAt);
        await refreshPendingSyncCount();
        setIsReady(true);

        if (loadedSession) {
          try {
            await performSync(loadedSession, loadedEntries, loadedLastSyncedAt);
          } catch {
            // displayed via syncError state
          }
        }
      } catch (error) {
        console.error("Failed to bootstrap journal store", error);
        if (mounted) {
          setSyncStatus("error");
          setSyncError("로컬 데이터를 불러오지 못했습니다.");
          setIsReady(true);
        }
      }
    };

    bootstrap();

    return () => {
      mounted = false;
    };
  }, [performSync, refreshPendingSyncCount]);

  const upsertTodayEntry = React.useCallback(
    async (lines: [string, string, string]) => {
      const date = toDateKey();
      const now = Date.now();
      const existing = entries.find((entry) => entry.date === date && !entry.deletedAt);

      const nextEntry: Entry = existing
        ? { ...existing, lines, updatedAt: now, deletedAt: null }
        : {
            id: `${date}-${now}`,
            date,
            lines,
            createdAt: now,
            updatedAt: now,
            deletedAt: null,
          };

      const nextEntries = mergeEntries(entries.filter((entry) => entry.id !== nextEntry.id), [nextEntry]);
      setEntries(nextEntries);
      await upsertEntriesToDb([nextEntry]);
      await enqueueSyncFromEntries([nextEntry]);
      await refreshPendingSyncCount();

      if (session) {
        syncNow().catch((error) => {
          console.error("Background sync failed", error);
        });
      }
    },
    [entries, refreshPendingSyncCount, session, syncNow],
  );

  const removeEntry = React.useCallback(
    async (id: string) => {
      const now = Date.now();
      const target = entries.find((entry) => entry.id === id);
      if (!target) return;

      const deleted: Entry = { ...target, updatedAt: now, deletedAt: now };
      const nextEntries = mergeEntries(entries.filter((entry) => entry.id !== id), [deleted]);

      setEntries(nextEntries);
      await upsertEntriesToDb([deleted]);
      await enqueueSyncFromEntries([deleted]);
      await refreshPendingSyncCount();

      if (session) {
        syncNow().catch((error) => {
          console.error("Background sync failed", error);
        });
      }
    },
    [entries, refreshPendingSyncCount, session, syncNow],
  );

  const searchEntries = React.useCallback(
    (keyword: string) => {
      const token = keyword.trim().toLowerCase();
      if (!token) return visibleEntries;
      return visibleEntries.filter((entry) => entry.lines.some((line) => line.toLowerCase().includes(token)));
    },
    [visibleEntries],
  );

  const signInWithEmail = React.useCallback(
    async (email: string, password: string) => {
      const nextSession = await remoteClient.signInWithEmail(email, password);
      setSession(nextSession);
      await saveSessionToDb(nextSession);
      await performSync(nextSession, entries, lastSyncedAt);
    },
    [entries, lastSyncedAt, performSync],
  );

  const signInWithApple = React.useCallback(
    async (identityToken: string) => {
      const nextSession = await remoteClient.signInWithApple(identityToken);
      setSession(nextSession);
      await saveSessionToDb(nextSession);
      await performSync(nextSession, entries, lastSyncedAt);
    },
    [entries, lastSyncedAt, performSync],
  );

  const signInWithGoogle = React.useCallback(
    async (identityToken: string) => {
      const nextSession = await remoteClient.signInWithGoogle(identityToken);
      setSession(nextSession);
      await saveSessionToDb(nextSession);
      await performSync(nextSession, entries, lastSyncedAt);
    },
    [entries, lastSyncedAt, performSync],
  );

  const signOut = React.useCallback(async () => {
    setSession(null);
    await saveSessionToDb(null);
  }, []);

  const exportBackup = React.useCallback(async () => {
    const backup: BackupPayload = {
      version: 1,
      exportedAt: Date.now(),
      entries,
    };

    return JSON.stringify(backup, null, 2);
  }, [entries]);

  const importBackup = React.useCallback(
    async (rawBackup: string) => {
      let parsed: unknown;

      try {
        parsed = JSON.parse(rawBackup);
      } catch {
        throw new Error("백업 JSON 형식이 올바르지 않습니다.");
      }

      if (!parsed || typeof parsed !== "object") {
        throw new Error("백업 데이터가 비어 있습니다.");
      }

      const candidate = parsed as Partial<BackupPayload>;
      if (candidate.version !== 1 || !Array.isArray(candidate.entries)) {
        throw new Error("지원하지 않는 백업 버전입니다.");
      }

      const importedEntries = normalizeBackupEntries(candidate.entries as Entry[]);
      await replaceEntriesToDb(importedEntries);
      await enqueueSyncFromEntries(importedEntries);
      setEntries(importedEntries);
      await refreshPendingSyncCount();

      if (session) {
        syncNow().catch((error) => {
          console.error("Background sync failed after backup import", error);
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
      upsertTodayEntry,
      removeEntry,
      searchEntries,
      signInWithEmail,
      signInWithApple,
      signInWithGoogle,
      signOut,
      syncNow,
      exportBackup,
      importBackup,
    }),
    [
      exportBackup,
      importBackup,
      isReady,
      lastSyncedAt,
      pendingSyncCount,
      removeEntry,
      searchEntries,
      session,
      signInWithApple,
      signInWithEmail,
      signInWithGoogle,
      signOut,
      syncError,
      syncNow,
      syncStatus,
      upsertTodayEntry,
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
