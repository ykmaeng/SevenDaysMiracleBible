import Database from "@tauri-apps/plugin-sql";
import { exists, BaseDirectory } from "@tauri-apps/plugin-fs";

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
const translationDbLoading = new Map<string, Promise<Database>>();

export async function getTranslationDb(translationId: string): Promise<Database> {
  const cached = translationDbs.get(translationId);
  if (cached) return cached;

  const pending = translationDbLoading.get(translationId);
  if (pending) return pending;

  const promise = (async () => {
    const fileExists = await exists(`${translationId}.db`, { baseDir: BaseDirectory.AppData });
    if (!fileExists) {
      throw new Error(`Translation DB not found: ${translationId}.db`);
    }
    const tdb = await Database.load(`sqlite:${translationId}.db`);
    translationDbs.set(translationId, tdb);
    return tdb;
  })();

  translationDbLoading.set(translationId, promise);
  try {
    return await promise;
  } finally {
    translationDbLoading.delete(translationId);
  }
}

export function clearTranslationDbCache(translationId: string): void {
  translationDbs.delete(translationId);
}

export async function queryTranslation<T>(translationId: string, sql: string, bindValues?: unknown[]): Promise<T[]> {
  try {
    const tdb = await getTranslationDb(translationId);
    return await tdb.select<T[]>(sql, bindValues);
  } catch {
    return [];
  }
}

// Commentary DB connections (separate .db files per language)
const commentaryDbs = new Map<string, Database>();
const commentaryDbLoading = new Map<string, Promise<Database>>();

export async function getCommentaryDb(language: string): Promise<Database> {
  const cached = commentaryDbs.get(language);
  if (cached) return cached;

  // Prevent concurrent Database.load() for the same language
  const pending = commentaryDbLoading.get(language);
  if (pending) return pending;

  const promise = (async () => {
    const fileExists = await exists(`commentary-${language}.db`, { baseDir: BaseDirectory.AppData });
    if (!fileExists) {
      throw new Error(`Commentary DB not found: commentary-${language}.db`);
    }
    const cdb = await Database.load(`sqlite:commentary-${language}.db`);
    commentaryDbs.set(language, cdb);
    return cdb;
  })();

  commentaryDbLoading.set(language, promise);
  try {
    return await promise;
  } finally {
    commentaryDbLoading.delete(language);
  }
}

export function clearCommentaryDbCache(language: string): void {
  commentaryDbs.delete(language);
}

export async function queryCommentary<T>(language: string, sql: string, bindValues?: unknown[]): Promise<T[]> {
  try {
    const cdb = await getCommentaryDb(language);
    return await cdb.select<T[]>(sql, bindValues);
  } catch {
    return [];
  }
}

// Interlinear DB connection (single separate .db file)
let interlinearDb: Database | null = null;

export async function getInterlinearDb(): Promise<Database> {
  if (!interlinearDb) {
    const fileExists = await exists("interlinear.db", { baseDir: BaseDirectory.AppData });
    if (!fileExists) {
      throw new Error("Interlinear DB not found: interlinear.db");
    }
    interlinearDb = await Database.load("sqlite:interlinear.db");
  }
  return interlinearDb;
}

export function clearInterlinearDbCache(): void {
  interlinearDb = null;
}

export async function queryInterlinear<T>(sql: string, bindValues?: unknown[]): Promise<T[]> {
  try {
    const idb = await getInterlinearDb();
    return await idb.select<T[]>(sql, bindValues);
  } catch {
    return [];
  }
}
