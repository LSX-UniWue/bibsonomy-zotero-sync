import { getPref, setPref } from "../utils/prefs";
import { config } from "../../package.json";
import { syncItemDefault, deleteItemOnline, checkIfItemIsOnline } from "../modules/synchronizationLogic";
import { HelperFactory } from "./connector";
import { getString } from "../utils/locale";

export { itemAddedListener, itemModifiedListener, itemDeletedListener };

/**
 * Called when a (sub)-item is added to the Zotero library
 * Syncs the item to the BibSonomy account
 * This is only relevant for attachments, the "main" item is synced with ???
 * @param ids - The IDs of the items to sync
 */
async function itemAddedListener(ids: number[] | string[]) {
    if (getPref("syncPreference") !== "auto") {
        ztoolkit.log("Automatic sync is not enabled, skipping sync");
        return;
    }

    if (getPref("authenticated") !== true) {
        ztoolkit.log("User is not authenticated, skipping sync");
        new ztoolkit.ProgressWindow(config.addonName).createLine({
            text: getString("progress-unauthorized-error"),
            type: "error",
        });
        return;
    }

    for (const id of ids) {
        ztoolkit.log("ID of the added item: " + id);
        const addedItem = await Zotero.Items.getAsync(id);

        //Check if the item is a publication
        if (!addedItem.isRegularItem()) {
            //We only want to sync attachments, everything else is ignored for now
            if (addedItem.isAttachment()) {
                ztoolkit.log("Item is an attachment, syncing");
                const parentID = addedItem.parentID;
                if (parentID === undefined || parentID === false) {
                    ztoolkit.log("ParentID is undefined, skipping sync");
                    continue;
                }
                // Using the itemModifiedListener to sync the parent item
                await itemModifiedListener([parentID]);
            } else {
                ztoolkit.log("Modified Item is not an attachment, skipping sync");
                continue;
            }
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
    //Check if the user is authenticated and has enabled the automatic or semi-automatic sync
    if (getPref("authenticated") !== true) {
        ztoolkit.log("User is not authenticated, skipping sync");
        new ztoolkit.ProgressWindow(config.addonName).createLine({
            text: getString("progress-unauthorized-error"),
            type: "error",
        });
        return;
    }

    const user = getPref("username");
    const apiToken = getPref("apiToken");

    if (!user || !apiToken || typeof user !== 'string' || typeof apiToken !== 'string') {
        ztoolkit.getGlobal("alert")(getString("alert-credentials-not-set"));
        throw new Error("BibSonomy credentials not set");
    }

    if (getPref("syncPreference") === "manual") {
        ztoolkit.log("Manual sync is enabled, skipping sync");
        return;
    }

    for (const id of ids) {
        ztoolkit.log("ID of the modified item: " + id);
        const modifiedItem = await Zotero.Items.getAsync(id);

        //Check if the item is a publication
        if (!modifiedItem.isRegularItem()) {
            //We only want to sync attachments, everything else is ignored for now
            if (modifiedItem.isAttachment()) {
                ztoolkit.log("Item is an attachment, syncing");
                const parentID = modifiedItem.parentID;
                if (parentID === undefined || parentID === false) {
                    ztoolkit.log("ParentID is undefined");
                    continue;
                }
                await itemModifiedListener([parentID]);
            } else {
                ztoolkit.log("Modified Item is not an attachment, skipping sync");
                continue;
            }
        } else if (checkIfItemIsOnline(modifiedItem, user, apiToken)) {
            ztoolkit.log("Syncing item");
            try {
                await HelperFactory.syncEntry(modifiedItem, true, false);
            } catch (error) {
                ztoolkit.log("Error while syncing item: " + error);
                if (error === "Item is already synced") {
                    ztoolkit.log("Item is already synced, skipping sync");

                }
            }
        } else {
            ztoolkit.log("Item is not online, skipping sync");
        }
    }
}

/**
 * Called when an item is deleted from the Zotero library
 * Deletes the corresponding post(s) from the BibSonomy account
 * @param ids - The IDs of the items to delete
 */
async function itemDeletedListener(ids: number[] | string[]) {
    //Check if the user is authenticated and has enabled the automatic sync    
    if (getPref("authenticated") !== true) {
        ztoolkit.log("User is not authenticated, skipping sync");
        new ztoolkit.ProgressWindow(config.addonName).createLine({
            text: getString("progress-unauthorized-error"),
            type: "error",
        });
        return;
    }

    const user = getPref("username");
    const apiToken = getPref("apiToken");

    if (!user || !apiToken || typeof user !== 'string' || typeof apiToken !== 'string') {
        ztoolkit.getGlobal("alert")(getString("alert-credentials-not-set"));
        throw new Error("BibSonomy credentials not set");
    }

    for (const id of ids) {
        ztoolkit.log("ID of the deleted item: " + id);
        const deletedItem = await Zotero.Items.getAsync(id);

        //Check if the item is a publication
        //If its not a publication, get the parent publication and update it
        if (!deletedItem.isRegularItem() && (getPref("syncPreference") !== "manual")) {
            //We only want to sync attachments, everything else is ignored for now
            if (deletedItem.isAttachment()) {
                ztoolkit.log("Item is an attachment, syncing");
                const parentID = deletedItem.parentID;
                if (parentID === undefined || parentID === false) {
                    ztoolkit.log("ParentID is undefined");
                    continue;
                }
                await itemModifiedListener([parentID]);
            } else {
                ztoolkit.log("Deleted Item is not an attachment, skipping sync");
                continue;
            }
        }

        if (getPref("syncPreference") !== "auto") {
            ztoolkit.log("Automatic sync is not enabled, not automatically deleting the item online");

            if (checkIfItemIsOnline(deletedItem, user, apiToken)) {
                ztoolkit.log("Item is online, asking the user if they want to delete it online");

                const dialogData: { [key: string | number]: any } = {
                    confirmedDeletion: false,
                    loadCallback: () => {
                        ztoolkit.log(dialogData, "Dialog Opened!");
                    },
                    unloadCallback: () => {
                        ztoolkit.log(dialogData, "Dialog closed!");
                    },
                };

                const dialog = new ztoolkit.Dialog(10, 2)
                    .addCell(0, 0, {
                        tag: "p",
                        properties: { innerHTML: `Do you also want to delete the Post ${deletedItem.getField("title")} from your BibSonomy Account?` },
                    })
                    .addButton("Yes", "yes", {
                        callback: () => {
                            dialogData.confirmedDeletion = true;
                        },
                    })
                    .addButton("No", "no", {
                        callback: () => {
                            dialogData.confirmedDeletion = false;
                        },
                    })
                    .setDialogData(dialogData)
                    .open("Confirm Online Deletion");

                await dialogData.unloadLock.promise;

                if (!dialogData.confirmedDeletion) {
                    ztoolkit.log("User chose not to delete the item online.");
                    continue; // Skip online deletion if user chooses 'No'
                }
            }
        }

        ztoolkit.log("Deleting item online");
        await HelperFactory.deleteEntry(deletedItem);
    }
}
