import { getEntry, postEntry, updateBibsonomyPost } from './bibsonomyAPI';
import { getPref } from '../utils/prefs';
import { config } from '../../package.json';
import { handleHttpResponseError } from './bibsonomyAPI';
import { getString } from '../utils/locale';

export { syncItemDefault, deleteItemOnline, checkIfItemIsOnline, getBibsonomyMetadataFromItem, syncAllItems }

/**
 * Synchronizes all items in the user's library with BibSonomy, that are already online.
 * 
 * @returns {Promise<void>} A promise that resolves when the synchronization is complete.
 */
async function syncAllItems() {
    const libraryID = Zotero.Libraries.userLibraryID;
    const items = await Zotero.Items.getAll(libraryID, true, false);

    const regularItems = items.filter(item => item.isRegularItem());

    ztoolkit.log(`Synchronizing ${regularItems.length} items with BibSonomy`);

    for (const item of regularItems) {
        // Skip non-regular items
        if (!item.isRegularItem()) {
            continue;
        }

        // Skip items that are not online (if not in auto mode)
        if (getPref("syncPreference") !== "auto") {
            const hashes = getBibsonomyMetadataFromItem(item);
            ztoolkit.log(`Checking if item ${item.getField('title')} is online with hashes: ${JSON.stringify(hashes)}`);
            if (hashes.interhash === "" || hashes.intrahash === "") {
                ztoolkit.log(`Item ${item.getField('title')} does not have a hash, assuming it is not online`);
                continue;
            }
        }
        await syncItemDefault(item);
    }
}


async function syncItemDefault(item: Zotero.Item, force_update: boolean = false): Promise<BibsonomyPost> {
    const user = getPref("username");
    const apiToken = getPref("apiToken");
    const defaultGroup = getPref("defaultGroup")

    if (!user || !apiToken || !defaultGroup || typeof user !== 'string' || typeof apiToken !== 'string' || typeof defaultGroup !== 'string') {
        ztoolkit.getGlobal("alert")(getString("alert-credentials-not-set"));
        throw new Error("BibSonomy credentials not set");
    }
    return await syncItem(item, user, apiToken, defaultGroup, force_update);
}

async function deleteItemOnline(item: Zotero.Item): Promise<void> {
    const user = getPref("username");
    const apiToken = getPref("apiToken");

    if (!user || !apiToken || typeof user !== 'string' || typeof apiToken !== 'string') {
        ztoolkit.getGlobal("alert")(getString("alert-credentials-not-set"));
        throw new Error("BibSonomy credentials not set");
    }

    if (!checkIfItemIsOnline(item, user, apiToken)) {
        ztoolkit.log(`Item ${item.getField('title')} is not online, skipping deletion.`);
        return;
    }

    const hashes = getBibsonomyMetadataFromItem(item);

    const url = `${Zotero[config.addonInstance].data.baseURL}/api/users/${user}/posts/${hashes.intrahash}`;
    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(user + ':' + apiToken)
        },
    });

    if (!response.ok) {
        ztoolkit.log(`Failed to delete item ${item.getField('title')} from BibSonomy`);
        await handleHttpResponseError(response);
    }

    ztoolkit.log(`Deleted item ${item.getField('title')} from BibSonomy`);
}

/**
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
        // Item is not online, post it
        ztoolkit.log(`Item ${item.getField('title')} is not online, posting.`);
        post = await postEntry(item, username, apikey, group);
    } else {
        ztoolkit.log(`Item ${item.getField('title')} is already online, checking updates.`);
        const hashes = getBibsonomyMetadataFromItem(item);
        post = await getEntry(username, apikey, hashes.intrahash);
        const updatedOnline = await wasUpdatedOnline(item, username, apikey);
        const updatedOffline = await wasUpdatedOffline(item);

        if (updatedOnline && updatedOffline) {
            // Handle conflict resolution (this requires implementation)
            ztoolkit.log(`Conflict detected for ${item.getField('title')}. Merging changes.`);
            await handleConflictResolution(item, username, apikey, group);
        } else if (updatedOnline) {
            // Update item offline (requires implementation)
            ztoolkit.log(`Updating ${item.getField('title')} offline.`);
            //TODO: Implement this function
        } else if (updatedOffline || force_update) {
            // Update item online
            ztoolkit.log(`Updating ${item.getField('title')} online.`);
            post = await updateBibsonomyPost(item, hashes.intrahash, username, apikey, group);
        } else {
            // No updates needed
            ztoolkit.log(`No updates for ${item.getField('title')}, skipping.`);
        }
    }

    await addBibsonomyMetadataToItem(item, "synced", post.bibtex.interhash!, post.bibtex.intrahash!);
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
    const noteContent = `<div data-schema-version="9">
    <h2>BibSonomy Metadata</h2>
    <p><strong>Warning:</strong> Do not change or delete this note!</p>
    <hr>
    <p><strong>interhash:</strong> ${interhash}</p>
    <p><strong>intrahash:</strong> ${intrahash}</p>
    <p><strong>syncdate:</strong> ${new Date().toISOString()}</p>
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
    }

    noteItem.setNote(noteContent);
    noteItem.parentID = item.id;
    await noteItem.saveTx();
    ztoolkit.log(`Updated BibSonomy metadata note for item: ${item.getField('title')}`);
}

/**
 * Retrieves Bibsonomy metadata from a Zotero item.
 * @param item - The Zotero item from which to retrieve the metadata.
 * @returns An object containing the Bibsonomy metadata, including interhash, intrahash, and syncdate.
 */
function getBibsonomyMetadataFromItem(item: Zotero.Item): { interhash: string, intrahash: string, syncdate: string } {
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

            return { interhash, intrahash, syncdate };
        }
    }
    return { interhash: "", intrahash: "", syncdate: "" };
}