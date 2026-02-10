declare module "expo-sqlite" {
  export type SQLiteBindValue = string | number | null;

  export type SQLiteDatabase = {
    execAsync: (source: string) => Promise<void>;
    runAsync: (source: string, params?: SQLiteBindValue[]) => Promise<void>;
    getAllAsync: <T>(source: string, params?: SQLiteBindValue[]) => Promise<T[]>;
    getFirstAsync: <T>(source: string, params?: SQLiteBindValue[]) => Promise<T | null>;
    withTransactionAsync: (task: () => Promise<void>) => Promise<void>;
  };

  export function openDatabaseAsync(name: string): Promise<SQLiteDatabase>;
}
