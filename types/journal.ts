export type Entry = {
  id: string;
  date: string;
  lines: [string, string, string];
  imageUri?: string | null;
  createdAt: number;
  updatedAt: number;
  deletedAt?: number | null;
};

export type SyncProvider = "custom" | "supabase" | "firebase";

export type AuthUser = {
  id: string;
  email: string;
  displayName?: string;
};

export type AuthSession = {
  provider: SyncProvider;
  accessToken: string;
  user: AuthUser;
};

export type BackupPayload = {
  version: 1;
  exportedAt: number;
  entries: Entry[];
};
