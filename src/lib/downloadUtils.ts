import { fetch } from "@tauri-apps/plugin-http";
import { writeFile, BaseDirectory } from "@tauri-apps/plugin-fs";

/**
 * Stream-download a file to AppData without blocking the main thread.
 * Reads the response body in chunks so the UI stays responsive throughout.
 * Returns the final bytes for optional validation before writing.
 */
export async function streamDownloadToFile(
  url: string,
  fileName: string,
  onProgress?: (percent: number) => void,
): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (contentLength > 0 && onProgress) {
        onProgress(Math.round((received / contentLength) * 100));
      }
    }
  }

  // Merge chunks
  const bytes = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }

  // Write to disk
  await writeFile(fileName, bytes, { baseDir: BaseDirectory.AppData });

  return bytes;
}

/**
 * Stream-download and parse JSON without blocking the main thread.
 * For smaller JSON files (like dictionary data).
 */
export async function streamDownloadJson<T>(
  url: string,
  onProgress?: (percent: number) => void,
): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Download failed: ${response.status} ${response.statusText}`);
  }

  const contentLength = Number(response.headers.get("content-length") || 0);
  const reader = response.body?.getReader();
  if (!reader) {
    throw new Error("Response body is not readable");
  }

  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (value) {
      chunks.push(value);
      received += value.length;
      if (contentLength > 0 && onProgress) {
        onProgress(Math.round((received / contentLength) * 100));
      }
    }
  }

  const text = new TextDecoder().decode(
    chunks.length === 1
      ? chunks[0]
      : chunks.reduce((acc, chunk) => {
          const merged = new Uint8Array(acc.length + chunk.length);
          merged.set(acc, 0);
          merged.set(chunk, acc.length);
          return merged;
        }, new Uint8Array(0))
  );

  return JSON.parse(text) as T;
}
