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
  try {
    const database = await getDb();
    return await database.select<T[]>(sql, bindValues);
  } catch (err) {
    if (err instanceof Error && err.message.includes("closed pool")) {
      db = null;
      const database = await getDb();
      return database.select<T[]>(sql, bindValues);
    }
    throw err;
  }
}

export async function execute(sql: string, bindValues?: unknown[]) {
  try {
    const database = await getDb();
    return await database.execute(sql, bindValues);
  } catch (err) {
    // Reconnect if pool was closed
    if (err instanceof Error && err.message.includes("closed pool")) {
      db = null;
      const database = await getDb();
      return database.execute(sql, bindValues);
    }
    throw err;
  }
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
    translationDbs.delete(translationId);
    try {
      await tdb.close();
    } catch {
      // Ignore close errors — file will be deleted anyway
    }
  }
}

export async function queryTranslation<T>(translationId: string, sql: string, bindValues?: unknown[]): Promise<T[]> {
  const tdb = await getTranslationDb(translationId);
  return tdb.select<T[]>(sql, bindValues);
}

// Commentary DB connections (separate .db files per language)
const commentaryDbs = new Map<string, Database>();

export async function getCommentaryDb(language: string): Promise<Database> {
  let cdb = commentaryDbs.get(language);
  if (!cdb) {
    const dataDir = await getDataDir();
    cdb = await Database.load(`sqlite:${dataDir}commentary-${language}.db`);
    commentaryDbs.set(language, cdb);
  }
  return cdb;
}

export async function closeCommentaryDb(language: string): Promise<void> {
  const cdb = commentaryDbs.get(language);
  if (cdb) {
    commentaryDbs.delete(language);
    try {
      await cdb.close();
    } catch {
      // Ignore close errors
    }
  }
}

export async function queryCommentary<T>(language: string, sql: string, bindValues?: unknown[]): Promise<T[]> {
  const cdb = await getCommentaryDb(language);
  return cdb.select<T[]>(sql, bindValues);
}
