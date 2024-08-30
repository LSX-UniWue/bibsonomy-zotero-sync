/*
 * This file contains the logic for synchronizing Zotero items with BibSonomy.
 * 
 * 
 */

import { getEntry, postEntry, updateBibsonomyPost, deleteEntry } from './bibsonomyAPI';
import { getPref, getAuth, getAuthWithDefaultGroup, setPref } from '../utils/prefs';
import { config } from "../../package.json";
import { getString } from '../utils/locale';
import { ConflictResolutionError } from '../types/errors';
import { acquireLock, releaseLock } from '../utils/locks';

export { syncItem, deleteItemOnline, checkIfItemIsOnline, getBibsonomyMetadataFromItem, syncAllItems, addAttachmentsSyncdateToItem, performInitialSync, performFullLibrarySync as performSyncWithErrors, cleanLibraryMetadata }

/**
 * Synchronizes all items in the user's library with BibSonomy, that are already online.
 * TODO: Whilst working, this needs optimization and more advanced error handling!
 * @deprecated
 * @returns {Promise<void>} A promise that resolves when the synchronization is complete.
 */
async function syncAllItems() {
    const libraryID = Zotero.Libraries.userLibraryID;
    const items = await Zotero.Items.getAll(libraryID, true, false);
    const regularItems = items.filter(item => item.isRegularItem());

    ztoolkit.log(`Synchronizing ${regularItems.length} items with BibSonomy`);

    for (const item of regularItems) {
        if (getPref("syncPreference") !== "auto") {
            const hashes = getBibsonomyMetadataFromItem(item);
            ztoolkit.log(`Checking if item ${item.getField('title')} is online with hashes: ${JSON.stringify(hashes)}`);
            if (hashes.interhash === "" || hashes.intrahash === "") {
                ztoolkit.log(`Item ${item.getField('title')} does not have a hash, assuming it is not online`);
                continue;
            }
        }
        await syncItem(item);
    }
}

/**
 * Deletes an item from BibSonomy if it is online.
 * 
 * @param item - The Zotero item to delete.
 * @returns A promise that resolves when the deletion is complete.
 */
async function deleteItemOnline(item: Zotero.Item): Promise<void> {
    const { user, apiToken } = getAuth();
    const hashes = getBibsonomyMetadataFromItem(item);

    if (!hashes.intrahash) {
        ztoolkit.log(`Item ${item.getField('title')} has no intrahash, skipping deletion.`);
        return;
    }

    try {
        if (await checkIfItemIsOnline(item)) {
            await deleteEntry(user, apiToken, hashes.intrahash);
            ztoolkit.log(`Deleted item ${item.getField('title')} from BibSonomy`);
        } else {
            ztoolkit.log(`Item ${item.getField('title')} is not online, skipping deletion.`);
        }
    } catch (error: any) {
        ztoolkit.log(`Failed to delete item ${item.getField('title')} from BibSonomy: ${error.message}`);
        throw error;
    }
}

/**
 * TODO: Add more advanced error handling!
 * Synchronizes a Zotero item with its BibSonomy Post, posting it if it's not already online,
 * or updating it based on where the most recent changes occurred (online or offline).
 * @param item The Zotero item to be synchronized.
 * @param username The username for authentication.
 * @param apikey The API key for authentication.
 * @param group The group within which the item should be posted or updated.
 * @returns A promise that resolves to the BibsonomyPost object representing the synchronized item.
 */
async function syncItem(item: Zotero.Item, force_update: boolean = false): Promise<BibsonomyPost> {
    const { user, apiToken, defaultGroup } = getAuthWithDefaultGroup();
    const isOnline = await checkIfItemIsOnline(item);
    let post = null;
    if (!isOnline) {
        ztoolkit.log(`Item ${item.getField('title')} is not online, posting.`);
        post = await postEntry(item);
    } else {
        ztoolkit.log(`Item ${item.getField('title')} is already online, checking updates.`);
        const hashes = getBibsonomyMetadataFromItem(item);
        post = await getEntry(hashes.intrahash);
        const updatedOnline = await wasUpdatedOnline(item);
        const updatedOffline = await wasUpdatedOffline(item);

        if (updatedOnline && updatedOffline) {
            // TODO: Handle conflict resolution (this requires implementation)
            ztoolkit.log(`Conflict detected for ${item.getField('title')}. Merging changes.`);
            await handleConflictResolution(item, user, apiToken, defaultGroup);
        } else if (updatedOnline) {
            // TODO: Update item offline (requires implementation)
            ztoolkit.log(`Updating ${item.getField('title')} offline.`);
        } else if (updatedOffline || force_update) {
            // Update item online
            ztoolkit.log(`Updating ${item.getField('title')} online.`);
            const updatedAttachments = await getChangedAttachments(item);
            post = await updateBibsonomyPost(item, updatedAttachments, hashes.intrahash);
        } else {
            // No updates needed
            ztoolkit.log(`No updates for ${item.getField('title')}, skipping.`);
        }
    }

    await addBibsonomyMetadataToItem(item, config.itemTag, post.bibtex.interhash!, post.bibtex.intrahash!);
    ztoolkit.log(`Added metadata to item: ${item.getField('title')}.`);
    return post;
}

/**
 * Handles conflict resolution when an item has been updated both online and offline.
 * This is a placeholder and requires implementation based on specific requirements.
 * @param item The item with conflicting updates.
 * @param username The username for authentication.
 * @param apikey The API key for authentication.
 * @param defaultGroup The group within which the item is managed.
 */
async function handleConflictResolution(item: Zotero.Item, user: string, apiToken: string, defaultGroup: string): Promise<void> {
    // Implement conflict resolution logic here.
    // This could involve user interaction to choose which version to keep,
    // automatic merging of changes, or favoring one source over the other.
    throw new ConflictResolutionError(`${item.getField('title')} has conflicting updates. Conflict resolution is not implemented yet.`);
}

/**
 * Checks if the given item was updated online on BibSonomy.
 * @param item - The Zotero item to check.
 * @param user - The BibSonomy username.
 * @param apiToken - The BibSonomy API key.
 * @returns A Promise that resolves to a boolean indicating whether the item was updated online.
 * @throws An error if the item does not have a syncdate.
 */
async function wasUpdatedOnline(item: Zotero.Item): Promise<boolean> {
    const { user, apiToken } = getAuth();
    //Check if the items syncdate is older than the last update on BibSonomy
    const hashes = getBibsonomyMetadataFromItem(item);
    if (hashes.syncdate === "") {
        throw new Error("Item does not have a syncdate");
    }
    const entry = await getEntry(hashes.intrahash);
    const lastSyncDate = new Date(hashes.syncdate);
    const lastUpdate = new Date(entry.changedate!);
    const buffer = 10 * 1000; // 10 seconds buffer
    return lastUpdate.getTime() > lastSyncDate.getTime() + buffer;
}

/**
 * Checks if the given item was updated offline.
 * @param item - The Zotero item to check.
 * @returns A promise that resolves to a boolean indicating whether the item was updated offline.
 */
async function wasUpdatedOffline(item: Zotero.Item): Promise<boolean> {
    //Check if the items syncdate is older than the last update in Zotero
    const lastSyncDate = new Date(getBibsonomyMetadataFromItem(item).syncdate);
    const lastUpdate = new Date(item.dateModified + "Z");
    const buffer = 10 * 1000; // 10 seconds buffer
    return lastUpdate.getTime() + buffer > lastSyncDate.getTime();
}

/**
 * If an item has been updated offline, this function returns the attachments that have been changed.
 * IMPORTANT: This function can not check for annotations, only the attachments themselves!
 * 
 * @param item - The Zotero item to check.
 * @returns An array of Zotero items that have been changed, empty if no changes have been made.
 */
async function getChangedAttachments(item: Zotero.Item): Promise<Zotero.Item[]> {
    if (!wasUpdatedOffline(item)) return [];

    const lastAttachmentsSyncDate = new Date(getBibsonomyMetadataFromItem(item).attachmentsSyncdate);
    const changedAttachments: Zotero.Item[] = [];
    const attachments = item.getAttachments();
    for (const attachment of attachments) {
        const attachmentItem = Zotero.Items.get(attachment);
        if (!attachmentItem.isAttachment() || typeof attachmentItem.getFilePath() !== 'string' || (attachmentItem.getFilePath() as string).split('.').pop() !== 'pdf') continue;
        const attachmentModified = new Date(attachmentItem.dateModified + "Z");
        const buffer = 10 * 1000; // 10 seconds buffer
        if (attachmentModified.getTime() + buffer > lastAttachmentsSyncDate.getTime()) {
            changedAttachments.push(attachmentItem);
        }
    }
    return changedAttachments;
}

/**
 * Checks if the given item is available online in BibSonomy.
 * @param item - The Zotero item to check.
 * @returns Returns `true` if the item is available online, `false` otherwise.
 */
async function checkIfItemIsOnline(item: Zotero.Item): Promise<boolean> {
    //Check if the item has a Hash in the notes
    const hashes = getBibsonomyMetadataFromItem(item);
    ztoolkit.log(`Checking if item ${item.getField('title')} is online with hashes: ${JSON.stringify(hashes)}`);
    if (hashes.interhash === "" || hashes.intrahash === "") {
        ztoolkit.log(`Item ${item.getField('title')} does not have a hash, assuming it is not online`);
        return false;
    }

    //Check if the item can be found in BibSonomy
    const { user, apiToken } = getAuth();
    try {
        ztoolkit.log(`Checking if item ${item.getField('title')} is online with hashes: ${JSON.stringify(hashes)}`);
        const entry = await getEntry(hashes.intrahash);
        return entry !== null;
    } catch (error) {
        return false;
    }
}

/**
 * Adds a specific tag to a Zotero item and updates or creates a metadata note for BibSonomy.
 * @param item The Zotero item to update.
 * @param postingTag The tag to add to the item if it's not already present.
 * @param interhash The interhash metadata from BibSonomy.
 * @param intrahash The intrahash metadata from BibSonomy.
 */
async function addBibsonomyMetadataToItem(item: Zotero.Item, postingTag: string, interhash: string, intrahash: string) {
    // Add the posting tag to the item if it doesn't already have it.
    if (!item.hasTag(postingTag)) {
        ztoolkit.log(`Adding tag ${postingTag} to item: ${item.getField('title')}`);
        item.addTag(postingTag);
        await item.saveTx();
    }

    // Construct the metadata note content.
    // ATT: Modifying this string will break the sync functionality! 
    // IF a change is made, also update the regex in the getBibsonomyMetadataFromItem function below
    let noteContent = `<div data-schema-version="9">
    <h2>BibSonomy Metadata</h2>
    <p><strong>Warning:</strong> Do not change or delete this note!</p>
    <hr>
    <p><strong>interhash:</strong> ${interhash}</p>
    <p><strong>intrahash:</strong> ${intrahash}</p>
    <p><strong>syncdate:</strong> ${new Date().toISOString()}</p>
    <p><strong>attachments-syncdate:</strong> na</p>
    <hr>
    <p><em>This note is automatically generated and managed by the BibSonomy plugin.</em></p>
    </div>`;

    // Check for an existing BibSonomy metadata note.
    const noteID = item.getNotes().find(noteID => {
        const note = Zotero.Items.get(noteID);
        return note.getNote().includes('BibSonomy Metadata');
    });

    // Use an existing note if found, or create a new one.
    const noteItem = noteID ? Zotero.Items.get(noteID) : new Zotero.Item('note');
    if (!noteID) {
        ztoolkit.log('No existing BibSonomy note found, creating a new one');
    } else {
        ztoolkit.log('Found existing BibSonomy note, updating it');
        // We need to keep the attachments-syncdate, so we need to find it first
        const attachmentsSyncdateMatch = noteItem.getNote().match(/<p><strong>attachments-syncdate:<\/strong>\s*([^<]+)<\/p>/);
        if (attachmentsSyncdateMatch) {
            const attachmentsSyncdate = attachmentsSyncdateMatch[1].trim();
            ztoolkit.log(`Found attachments-syncdate: ${attachmentsSyncdate}`);
            noteContent = noteContent.replace(
                /<p><strong>attachments-syncdate:<\/strong>\s*na<\/p>/,
                `<p><strong>attachments-syncdate:</strong> ${attachmentsSyncdate}</p>`
            );
        } else {
            ztoolkit.log('No attachments-syncdate found, keeping as "na"');
        }
    }

    noteItem.setNote(noteContent);
    noteItem.parentID = item.id;
    await noteItem.saveTx();
    ztoolkit.log(`Updated BibSonomy metadata note for item: ${item.getField('title')}`);
}

async function addAttachmentsSyncdateToItem(item: Zotero.Item, attachmentsSyncdate: string) {
    const noteID = item.getNotes().find(noteID => {
        const note = Zotero.Items.get(noteID);
        return note.getNote().includes('BibSonomy Metadata');
    });

    if (!noteID) {
        ztoolkit.log('No existing BibSonomy note found to add attachments-syncdate, this should not happen!');
        return;
    }

    const noteItem = Zotero.Items.get(noteID);
    const noteContent = noteItem.getNote();
    const newNoteContent = noteContent.replace(/<p><strong>attachments-syncdate:<\/strong>\s*na<\/p>/, `<p><strong>attachments-syncdate:</strong> ${attachmentsSyncdate}</p>`);
    noteItem.setNote(newNoteContent);
    await noteItem.saveTx();
}

/**
 * Retrieves Bibsonomy metadata from a Zotero item.
 * @param item - The Zotero item from which to retrieve the metadata.
 * @returns An object containing the Bibsonomy metadata, including interhash, intrahash, syncdate, and attachmentsSyncdate.
 */
function getBibsonomyMetadataFromItem(item: Zotero.Item): { interhash: string, intrahash: string, syncdate: string, attachmentsSyncdate: string } {
    const notes = item.getNotes();
    for (const noteID of notes) {
        const note = Zotero.Items.get(noteID);
        const noteContent = note.getNote();

        // Check if the note contains BibSonomy Metadata
        if (noteContent.includes('BibSonomy Metadata')) {
            // Extract interhash
            const interhashMatch = noteContent.match(/<strong>interhash:<\/strong>\s*([^<]+)/);
            const interhash = interhashMatch ? interhashMatch[1].trim() : "";

            // Extract intrahash
            const intrahashMatch = noteContent.match(/<strong>intrahash:<\/strong>\s*([^<]+)/);
            const intrahash = intrahashMatch ? intrahashMatch[1].trim() : "";

            // Extract syncdate
            const syncdateMatch = noteContent.match(/<strong>syncdate:<\/strong>\s*([^<]+)/);
            const syncdate = syncdateMatch ? syncdateMatch[1].trim() : "";

            // Extract attachments-syncdate
            const attachmentsSyncdateMatch = noteContent.match(/<strong>attachments-syncdate:<\/strong>\s*([^<]+)/);
            const attachmentsSyncdate = attachmentsSyncdateMatch ? attachmentsSyncdateMatch[1].trim() : "";

            return { interhash, intrahash, syncdate, attachmentsSyncdate };
        }
    }
    return { interhash: "", intrahash: "", syncdate: "", attachmentsSyncdate: "" };
}

/**
 * Retrieves all items in the user's library that are viable for syncing.
 * To be viable for syncing, the item needs to:
 * - be a regular item
 * - be wanted for syncing (based on syncPreference)
 * - have no explicit exclude tag (e.g. due to previous failed sync attempts or explicit user decision)
 * @returns A promise that resolves to an array of Zotero items.
 */
async function getItemsToSync(): Promise<Zotero.Item[]> {
    const libraryID = Zotero.Libraries.userLibraryID;
    const items = await Zotero.Items.getAll(libraryID, true, false);
    const regularItems = items.filter(item => item.isRegularItem());
    const syncableItems = regularItems.filter(item => !item.hasTag(config.noSyncTag));
    const wantedItems = syncableItems.filter(item => getPref("syncPreference") === "auto" || (getPref("syncPreference") === "semi-auto" && item.hasTag(config.itemTag))); //TODO: Needs more robust handling, currently assumes that synced_tag as the ground truth
    // return wantedItems.slice(0, 10);
    return wantedItems;
}


/**
 * Syncs all items in the user's library with BibSonomy (that are wanted for syncing), whilst providing progress and error reporting via callbacks.
 * @param totalItemsCallback - A callback function that is called with the total number of items to sync.
 * @param progressCallback - A callback function that is called with the current progress of the sync.
 * @param errorCallback - A callback function that is called when an error occurs during the sync.
 * @returns A promise that resolves to an array of errors that occurred during the sync.
 */
async function performFullLibrarySync(
    totalItemsCallback: (totalItems: number) => void,
    progressCallback: (progress: number, message: string) => void,
    errorCallback: (error: { item: any; error: Error }) => void
): Promise<Array<{ item: any; error: Error }>> {
    const syncItems = await getItemsToSync();
    const totalItems = syncItems.length;
    ztoolkit.log(`Total items to sync: ${totalItems}`);
    const errors: Array<{ item: Zotero.Item; error: Error }> = [];
    const concurrentLimit = 5; // Number of items to process concurrently

    totalItemsCallback(totalItems);
    ztoolkit.log("Starting sync process");

    let syncedCount = 0;
    let activePromises: Promise<void>[] = [];

    for (let i = 0; i < totalItems; i++) {
        const item = syncItems[i];
        const promise = syncItem(item)
            .then(() => {
                syncedCount++;
                const progress = syncedCount / totalItems;
                progressCallback(progress, getString("initial-sync-progress", { args: { synced: syncedCount, total: totalItems } }));
            })
            .catch(error => {
                const errorInfo = { item, error: error as Error };
                errors.push(errorInfo);
                errorCallback(errorInfo);
            })
            .finally(() => {
                // Remove this promise from activePromises when it's done
                activePromises = activePromises.filter(p => p !== promise);
            });

        activePromises.push(promise);

        if (activePromises.length >= concurrentLimit) {
            // Wait for at least one promise to finish before continuing
            await Promise.race(activePromises);
        }
    }

    // Wait for any remaining promises to finish
    await Promise.all(activePromises);

    ztoolkit.log("Sync process completed");
    return errors;
}

/**
 * Cleans the library metadata from all items in the user's library.
 * Currently only used for testing purposes.
 */
async function cleanLibraryMetadata() {
    ztoolkit.log("Starting library metadata cleaning");
    const libraryID = Zotero.Libraries.userLibraryID;
    const items = await Zotero.Items.getAll(libraryID, true, false);
    const regularItems = items.filter(item => item.isRegularItem());

    for (const item of regularItems) {
        const itemId = item.id.toString();
        if (!acquireLock(itemId)) {
            ztoolkit.log(`Item ${itemId} is already being processed, skipping cleanup`);
            continue;
        }
        try {
            let changed = false;
            ztoolkit.log(`Cleaning library metadata for item: ${item.getField('title')}`);
            // Remove tags
            if (item.hasTag(config.postTag)) {
                ztoolkit.log(`Removing tag ${config.postTag} from item: ${item.getField('title')}`);
                item.removeTag(config.postTag);
                changed = true;
            }
            if (item.hasTag(config.itemTag)) {
                ztoolkit.log(`Removing tag ${config.itemTag} from item: ${item.getField('title')}`);
                item.removeTag(config.itemTag);
                changed = true;
            }

            if (changed) {
                await item.saveTx();
            }
            // Remove metadata note
            const noteID = item.getNotes().find(noteID => {
                const note = Zotero.Items.get(noteID);
                return note.getNote().includes('BibSonomy Metadata');
            });

            if (noteID) {
                ztoolkit.log(`Removing metadata note from item: ${item.getField('title')}`);
                await Zotero.Items.trashTx([noteID]);
                ztoolkit.log(`Removed metadata note from item: ${item.getField('title')}`);
            }

            // Save changes
            await item.saveTx();
        } finally {
            releaseLock(itemId);
        }
    }

    ztoolkit.log("Library metadata cleaning completed");
}