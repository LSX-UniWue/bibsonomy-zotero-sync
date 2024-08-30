/**
 * This file contains the methods called when the Zotero library is modified
 * It is the bridge between the Zotero library and the BibSonomy account
 */

import { getPref, getAuth } from "../utils/prefs";
import { config } from "../../package.json";
import { checkIfItemIsOnline } from "../modules/synchronizationLogic";
import { HelperFactory } from "./connector";
import { getString } from "../utils/locale";
import { acquireLock, releaseLock } from '../utils/locks';

export { itemAddedListener, itemModifiedListener, itemDeletedListener };

/**
 * Called when a (sub)-item is added to the Zotero library
 * Syncs the item to the BibSonomy account
 * This is only relevant for attachments, the "main" item is synced with ???
 * @param ids - The IDs of the items to sync
 */
async function itemAddedListener(ids: number[] | string[]) {
    if (!checkAuthAndPrefs("auto")) return;

    for (const id of ids) {
        ztoolkit.log(`ID of the added item: ${id}`)
        const addedItem = await Zotero.Items.getAsync(id);

        if (!addedItem.isRegularItem()) {
            await handleAttachment(addedItem, itemModifiedListener);
        } else {
            ztoolkit.log("Syncing item");
            await HelperFactory.syncEntry(addedItem);
        }
    }
}

/**
 * Called when an item is modified in the Zotero library
 * Updates the corresponding post(s) on the BibSonomy account
 * @param ids - The IDs of the items to update
 */
async function itemModifiedListener(ids: number[] | string[]) {
    if (!checkAuthAndPrefs("semi-auto")) return;

    const { user, apiToken } = getAuth();
    for (const id of ids) {
        const itemId = id.toString();
        if (!acquireLock(itemId)) {
            ztoolkit.log(`Item ${itemId} is already being processed, skipping`);
            continue;
        }

        try {
            ztoolkit.log(`ID of the modified item: ${itemId}`);
            const modifiedItem = await Zotero.Items.getAsync(id);

            if (!modifiedItem.isRegularItem()) {
                await handleAttachment(modifiedItem, itemModifiedListener);
            } else if (await checkIfItemIsOnline(modifiedItem)) {
                ztoolkit.log("Item is online, syncing");
                try {
                    await HelperFactory.syncEntry(modifiedItem, true, false, true);
                } catch (error) {
                    ztoolkit.log("Error while syncing item: " + error);
                }
            } else {
                ztoolkit.log("Item is not online, skipping sync");
            }
        } finally {
            releaseLock(itemId);
        }
    }
}

/**
 * Called when an item is deleted from the Zotero library
 * Deletes the corresponding post(s) from the BibSonomy account
 * @param ids - The IDs of the items to delete
 */
async function itemDeletedListener(ids: number[] | string[]) {
    if (!checkAuthAndPrefs("manual")) return;
    const { user, apiToken } = getAuth();

    for (const id of ids) {
        ztoolkit.log(`ID of the deleted item: ${id}`);
        const deletedItem = await Zotero.Items.getAsync(id);


        if (!deletedItem.isRegularItem()) {
            if (getPref("syncPreference") !== "manual" && deletedItem.isAttachment()) {
                await handleAttachment(deletedItem, itemModifiedListener);
            }
            continue;
        }

        if (!await shouldDeleteOnline(deletedItem, user, apiToken)) {
            continue;
        }

        ztoolkit.log("Deleting item online");
        await HelperFactory.deleteEntry(deletedItem);
    }
}

/**
 * Helper function to check if the item should be deleted online
 * @param item - The item to check
 * @param user - The user to check
 * @param apiToken - The api token to check
 * @returns true if the item should be deleted online, false otherwise
 */
async function shouldDeleteOnline(item: any, user: string, apiToken: string): Promise<boolean> {
    // If the item is not online, we don't need to bother anyways
    if (!checkIfItemIsOnline(item)) return false;
    // If the sync preference is automatic, we can delete the item online
    if (getPref("syncPreference") === "auto") return true;
    // If the sync preference is manual or semi-automatic, we need to ask the user if they want to delete the item online
    return await showDeleteConfirmDialog(item);
}

/**
 * Helper function to show the delete confirmation dialog used in non automatic sync
 * @param item - The item to show
 * @returns true if the user confirmed the deletion, false otherwise
 */
async function showDeleteConfirmDialog(item: any): Promise<boolean> {
    const dialogData: { [key: string | number]: any } = {
        confirmedDeletion: false,
        loadCallback: () => ztoolkit.log(dialogData, "Dialog Opened!"),
        unloadCallback: () => ztoolkit.log(dialogData, "Dialog closed!"),
    };

    new ztoolkit.Dialog(10, 2)
        .addCell(0, 0, {
            tag: "p",
            properties: { innerHTML: getString("dialog-delete-confirm-message", { args: { title: item.getField("title") } }) },
        })
        .addButton(getString("dialog-delete-confirm-yes"), "yes", { callback: () => { dialogData.confirmedDeletion = true; } })
        .addButton(getString("dialog-delete-confirm-no"), "no", { callback: () => { dialogData.confirmedDeletion = false; } })
        .setDialogData(dialogData)
        .open(getString("dialog-delete-confirm-title"));

    await dialogData.unloadLock.promise;
    return dialogData.confirmedDeletion;
}

/**
 * Helper function to handle attachments
 * @param item - The item to handle
 * @param parentAction - The action to perform on the parent item
 */
async function handleAttachment(item: any, parentAction: (ids: number[] | string[]) => Promise<void>) {
    if (!item.isAttachment()) return;

    ztoolkit.log("Item is an attachment, syncing");
    const parentID = item.parentID;
    if (parentID === undefined || parentID === false) {
        ztoolkit.log("ParentID is undefined, skipping sync");
        return;
    }
    await parentAction([parentID]);
}


/**
 * Helper function to check if the user is authenticated and if the sync preference is enabled
 * @param requiredPref - The sync preference that is required
 * @returns true if the user is authenticated and the sync preference is enabled, false otherwise
 */
function checkAuthAndPrefs(requiredPref: "manual" | "semi-auto" | "auto"): boolean {
    if (getPref("authenticated") !== true) {
        ztoolkit.log("User is not authenticated, skipping sync");
        new ztoolkit.ProgressWindow(config.addonName).createLine({
            text: getString("progress-unauthorized-error"),
            type: "error",
        });
        return false;
    }

    const syncPreference = getPref("syncPreference") as string;
    if (
        (requiredPref === "manual" && ["manual", "semi-auto", "auto"].includes(syncPreference)) ||
        (requiredPref === "semi-auto" && ["semi-auto", "auto"].includes(syncPreference)) ||
        (requiredPref === "auto" && syncPreference === "auto")
    ) {
        return true;
    } else {
        ztoolkit.log(`${requiredPref} sync or higher is not enabled, skipping sync`);
        return false;
    }

}