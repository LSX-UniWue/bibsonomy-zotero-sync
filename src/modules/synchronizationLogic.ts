/*
 * This file contains the logic for synchronizing Zotero items with BibSonomy.
 * 
 * 
 */

import { getEntry, postEntry, updateBibsonomyPost, deleteEntry } from './bibsonomyAPI';
import { getPref, getAuth, getAuthWithDefaultGroup, setPref } from '../utils/prefs';
import { config } from "../../package.json";
import { getString } from '../utils/locale';

export { syncItem, deleteItemOnline, checkIfItemIsOnline, getBibsonomyMetadataFromItem, syncAllItems, addAttachmentsSyncdateToItem, performInitialSync, performSyncWithErrors }

/**
 * Synchronizes all items in the user's library with BibSonomy, that are already online.
 * TODO: Whilst working, this needs optimization and more advanced error handling!
 * 
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
        const { user, apiToken, defaultGroup } = getAuthWithDefaultGroup();
        await syncItem(item, user, apiToken, defaultGroup);
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
        if (await checkIfItemIsOnline(item, user, apiToken)) {
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
async function syncItem(item: Zotero.Item, username: string, apikey: string, group: string, force_update: boolean = false): Promise<BibsonomyPost> {
    const isOnline = checkIfItemIsOnline(item, username, apikey);
    let post = null;
    if (!isOnline) {
        ztoolkit.log(`Item ${item.getField('title')} is not online, posting.`);
        post = await postEntry(item, username, apikey, group);
    } else {
        ztoolkit.log(`Item ${item.getField('title')} is already online, checking updates.`);
        const hashes = getBibsonomyMetadataFromItem(item);
        post = await getEntry(username, apikey, hashes.intrahash);
        const updatedOnline = await wasUpdatedOnline(item, username, apikey);
        const updatedOffline = await wasUpdatedOffline(item);

        if (updatedOnline && updatedOffline) {
            // TODO: Handle conflict resolution (this requires implementation)
            ztoolkit.log(`Conflict detected for ${item.getField('title')}. Merging changes.`);
            await handleConflictResolution(item, username, apikey, group);
        } else if (updatedOnline) {
            // TODO: Update item offline (requires implementation)
            ztoolkit.log(`Updating ${item.getField('title')} offline.`);
        } else if (updatedOffline || force_update) {
            // Update item online
            ztoolkit.log(`Updating ${item.getField('title')} online.`);
            const updatedAttachments = await getChangedAttachments(item);
            post = await updateBibsonomyPost(item, updatedAttachments, hashes.intrahash, username, apikey, group);
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
 * @param group The group within which the item is managed.
 */
async function handleConflictResolution(item: Zotero.Item, username: string, apikey: string, group: string): Promise<void> {
    // Implement conflict resolution logic here.
    // This could involve user interaction to choose which version to keep,
    // automatic merging of changes, or favoring one source over the other.
    throw new Error(`${item.getField('title')} has conflicting updates. Conflict resolution is not implemented yet.`);
}

/**
 * Checks if the given item was updated online on BibSonomy.
 * @param item - The Zotero item to check.
 * @param username - The BibSonomy username.
 * @param apikey - The BibSonomy API key.
 * @returns A Promise that resolves to a boolean indicating whether the item was updated online.
 * @throws An error if the item does not have a syncdate.
 */
async function wasUpdatedOnline(item: Zotero.Item, username: string, apikey: string): Promise<boolean> {
    //Check if the items syncdate is older than the last update on BibSonomy
    const hashes = getBibsonomyMetadataFromItem(item);
    if (hashes.syncdate === "") {
        throw new Error("Item does not have a syncdate");
    }
    const entry = await getEntry(username, apikey, hashes.intrahash);
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
 * @param username - The BibSonomy username.
 * @param apikey - The BibSonomy API key.
 * @returns Returns `true` if the item is available online, `false` otherwise.
 */
function checkIfItemIsOnline(item: Zotero.Item, username: string, apikey: string): boolean {
    //Check if the item has a Hash in the notes
    const hashes = getBibsonomyMetadataFromItem(item);
    ztoolkit.log(`Checking if item ${item.getField('title')} is online with hashes: ${JSON.stringify(hashes)}`);
    if (hashes.interhash === "" || hashes.intrahash === "") {
        ztoolkit.log(`Item ${item.getField('title')} does not have a hash, assuming it is not online`);
        return false;
    }

    //Check if the item can be found in BibSonomy
    try {
        ztoolkit.log(`Checking if item ${item.getField('title')} is online with hashes: ${JSON.stringify(hashes)}`);
        const entry = getEntry(username, apikey, hashes.intrahash);
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

async function performSyncWithErrors(
    progressCallback: (progress: number, message: string) => void,
    errorCallback: (error: { item: any; error: Error }) => void
): Promise<Array<{ item: any; error: Error }>> {
    const totalItems = 100; // Simulate 100 items to sync
    const errors: Array<{ item: any; error: Error }> = [];

    ztoolkit.log("Starting sync process");
    for (let i = 0; i < totalItems; i++) {
        try {
            // Simulate syncing process
            await new Promise(resolve => setTimeout(resolve, 100));

            // Simulate errors (10% chance)
            if (Math.random() < 0.2) {
                throw new Error(`Failed to sync: ${['Network error', 'API timeout', 'Invalid data', 'A super long error message that should be truncated'][Math.floor(Math.random() * 4)]}`);
            }

            const progress = (i + 1) / totalItems;
            progressCallback(progress, getString("initial-sync-progress", { args: { synced: i + 1, total: totalItems } }));
        } catch (error) {
            const errorInfo = { item: { id: i, title: `Test Item ${i}` }, error: error as Error };
            errors.push(errorInfo);
            errorCallback(errorInfo);
        }
    }

    ztoolkit.log("Sync process completed");
    return errors;
}

async function performInitialSync(
    progressCallback: (progress: number, message: string) => void,
    errorCallback: (error: { item: Zotero.Item; error: Error }) => void
): Promise<Array<{ item: Zotero.Item; error: Error }>> {
    const libraryID = Zotero.Libraries.userLibraryID;
    const items = await Zotero.Items.getAll(libraryID, true, false);
    const regularItems = items.filter(item => item.isRegularItem());

    let syncedCount = 0;
    const totalCount = regularItems.length;
    const errors: Array<{ item: Zotero.Item; error: Error }> = [];

    // progressCallback(0, getString("initial-sync-progress", { args: { synced: syncedCount, total: totalCount } }));

    for (const item of regularItems) {
        try {
            const { user, apiToken, defaultGroup } = getAuthWithDefaultGroup();
            // await syncItem(item, user, apiToken, defaultGroup, true);
            // For debugging: Wait 1 second
            await new Promise(resolve => setTimeout(resolve, 1000));
            ztoolkit.log(`Syncing item ${item.getField('title')}`);
            syncedCount++;
            progressCallback(syncedCount / totalCount, getString("initial-sync-progress", { args: { synced: syncedCount, total: totalCount } }));
        } catch (error) {
            const errorInfo = { item, error: error as Error };
            errors.push(errorInfo);
            errorCallback(errorInfo);
        }
    }

    setPref("initialSyncDone", true);
    return errors;
}