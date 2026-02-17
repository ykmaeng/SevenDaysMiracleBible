import { createClient } from "@supabase/supabase-js";
import { execute, query } from "./db";
import type { FeedbackItem } from "../types/bible";

// Supabase client - configure these values when setting up the backend
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

const supabase =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
    : null;

export async function submitVote(
  bookId: number,
  chapter: number,
  verse: number,
  translationId: string,
  vote: 1 | -1
) {
  // Store locally first
  await execute(
    "INSERT INTO feedback_queue (book_id, chapter, verse, translation_id, vote) VALUES ($1, $2, $3, $4, $5)",
    [bookId, chapter, verse, translationId, vote]
  );

  // Try to sync immediately
  await syncFeedback();
}

export async function syncFeedback() {
  if (!supabase) return;

  const unsynced = await query<FeedbackItem>(
    "SELECT * FROM feedback_queue WHERE synced = 0 ORDER BY created_at LIMIT 50"
  );

  for (const item of unsynced) {
    try {
      const { error } = await supabase.from("translation_feedback").insert({
        book_id: item.book_id,
        chapter: item.chapter,
        verse: item.verse,
        translation_id: item.translation_id,
        vote: item.vote,
      });

      if (!error) {
        await execute("UPDATE feedback_queue SET synced = 1 WHERE id = $1", [item.id]);
      }
    } catch {
      // Will retry on next sync
      break;
    }
  }
}

export async function getVoteSummary(
  bookId: number,
  chapter: number,
  verse: number,
  translationId: string
): Promise<{ upvotes: number; downvotes: number }> {
  const result = await query<{ up: number; down: number }>(
    `SELECT
       COUNT(CASE WHEN vote = 1 THEN 1 END) as up,
       COUNT(CASE WHEN vote = -1 THEN 1 END) as down
     FROM feedback_queue
     WHERE book_id = $1 AND chapter = $2 AND verse = $3 AND translation_id = $4`,
    [bookId, chapter, verse, translationId]
  );
  return { upvotes: result[0]?.up ?? 0, downvotes: result[0]?.down ?? 0 };
}
