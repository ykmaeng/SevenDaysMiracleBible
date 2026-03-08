import Database from "@tauri-apps/plugin-sql";
import { appDataDir } from "@tauri-apps/api/path";

// Main DB (core translations, bookmarks, commentary, etc.)
let db: Database | null = null;

export async function getDb(): Promise<Database> {
  if (!db) {
    db = await Database.load("sqlite:bible.db");
  }
  return db;
}

export async function query<T>(sql: string, bindValues?: unknown[]): Promise<T[]> {
  const database = await getDb();
  return database.select<T[]>(sql, bindValues);
}

export async function execute(sql: string, bindValues?: unknown[]) {
  const database = await getDb();
  return database.execute(sql, bindValues);
}

// Translation DB connections (separate .db files per translation)
const translationDbs = new Map<string, Database>();
let dataDirCache: string | null = null;

async function getDataDir(): Promise<string> {
  if (!dataDirCache) {
    dataDirCache = await appDataDir();
    if (!dataDirCache.endsWith("/")) dataDirCache += "/";
  }
  return dataDirCache;
}

export async function getTranslationDb(translationId: string): Promise<Database> {
  let tdb = translationDbs.get(translationId);
  if (!tdb) {
    const dataDir = await getDataDir();
    tdb = await Database.load(`sqlite:${dataDir}${translationId}.db`);
    translationDbs.set(translationId, tdb);
  }
  return tdb;
}

export async function closeTranslationDb(translationId: string): Promise<void> {
  const tdb = translationDbs.get(translationId);
  if (tdb) {
    await tdb.close();
    translationDbs.delete(translationId);
  }
}

export async function queryTranslation<T>(translationId: string, sql: string, bindValues?: unknown[]): Promise<T[]> {
  const tdb = await getTranslationDb(translationId);
  return tdb.select<T[]>(sql, bindValues);
}
