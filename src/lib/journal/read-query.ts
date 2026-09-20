import "server-only";

type ReadQuery<T> = (signal: AbortSignal) => PromiseLike<T>;

/** Bound the complete read, including SDK retries, and never expose database details. */
export async function readQuery<T extends { error: unknown }>(
  query: ReadQuery<T>, message: string, timeoutMs = 15000,
): Promise<T> {
  const controller = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const deadline = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        reject(new Error(message));
        controller.abort();
      }, timeoutMs);
    });
    const response = Promise.resolve(query(controller.signal)).then(result => {
      // Supabase normally resolves with an error object instead of rejecting.
      // Reject here so one failed query does not wait for pending sibling reads.
      if (result.error) throw new Error(message);
      return result;
    });
    return await Promise.race([response, deadline]);
  } catch {
    throw new Error(message);
  } finally {
    clearTimeout(timer);
  }
}
