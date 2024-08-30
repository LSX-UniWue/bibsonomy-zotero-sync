/**
 * This file contains functions to acquire and release locks for items in the Zotero library.
 * Locks are used to prevent multiple instances of the addon from processing the same item simultaneously.
 */

const locks = new Set<string>();

export function acquireLock(itemId: string): boolean {
    if (locks.has(itemId)) {
        return false;
    }
    locks.add(itemId);
    return true;
}

export function releaseLock(itemId: string): void {
    locks.delete(itemId);
}