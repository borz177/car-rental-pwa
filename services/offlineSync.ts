import BackendAPI from './api';
import * as db from './offlineDb';

function isOfflineError(e: any): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  return e instanceof TypeError;
}

// Replays queued offline mutations against the real backend, in the order they were made.
export async function flushQueue(): Promise<void> {
  const queue = await db.getQueue();

  for (const mutation of queue) {
    try {
      const result = await (BackendAPI as any)[mutation.methodName](...mutation.args);
      const isVoidMethod = mutation.methodName.startsWith('delete') || mutation.methodName === 'payFine';
      if (!isVoidMethod && result) {
        if (mutation.tempId) await db.remove(mutation.resource, mutation.tempId);
        await db.put(mutation.resource, result);
      }
      await db.dequeueMutation(mutation.id!);
    } catch (e) {
      if (isOfflineError(e)) {
        // Still offline (or the connection dropped mid-sync) — stop here, retry everything on the next reconnect.
        return;
      }
      // The server rejected the mutation (validation, 404, etc.) — drop it rather than retrying forever.
      console.warn(`[offlineSync] dropping mutation ${mutation.methodName}`, e);
      if (mutation.tempId) await db.remove(mutation.resource, mutation.tempId);
      await db.dequeueMutation(mutation.id!);
    }
  }
}
