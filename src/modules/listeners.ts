import { getPref, setPref } from "../utils/prefs";
import { config } from "../../package.json";
import { syncItemDefault, deleteItemOnline } from "../modules/synchronizationLogic";
import { HelperFactory } from "./connector";

export { itemAddedListener, itemModifiedListener, itemDeletedListener };

async function itemAddedListener(ids: number[] | string[]) {
    if (getPref("syncPreference") !== "auto") {
        ztoolkit.log("Automatic sync is not enabled, skipping sync");
        return;
    }

    if (getPref("authenticated") !== true) {
        ztoolkit.log("User is not authenticated, skipping sync");
        new ztoolkit.ProgressWindow(config.addonName).createLine({
            text: "User is not authenticated, skipping sync",
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
                    ztoolkit.log("ParentID is undefined");
                    break;
                }
                await itemModifiedListener([parentID]);
            } else {
                ztoolkit.log("Modified Item is not an attachment, skipping sync");
                break;
            }
        } else {
            ztoolkit.log("Syncing item");
            await HelperFactory.syncEntry(addedItem);
        }
    }
}

async function itemModifiedListener(ids: number[] | string[]) {
    //Check if the user is authenticated and has enabled the automatic or semi-automatic sync
    if (getPref("authenticated") !== true) {
        ztoolkit.log("User is not authenticated, skipping sync");
        new ztoolkit.ProgressWindow(config.addonName).createLine({
            text: "User is not authenticated, skipping sync",
            type: "error",
        });
        return;
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
                    break;
                }
                await itemModifiedListener([parentID]);
            } else {
                ztoolkit.log("Modified Item is not an attachment, skipping sync");
                break;
            }
        } else {
            ztoolkit.log("Syncing item");
            try {
                await HelperFactory.syncEntry(modifiedItem, true, false);
            } catch (error) {
                ztoolkit.log("Error while syncing item: " + error);
                if (error === "Item is already synced") {
                    ztoolkit.log("Item is already synced, skipping sync");

                }
            }
        }
    }
}

async function itemDeletedListener(ids: number[] | string[]) {
    //Check if the user is authenticated and has enabled the automatic sync
    if (getPref("authenticated") !== true) {
        ztoolkit.log("User is not authenticated, skipping sync");
        new ztoolkit.ProgressWindow(config.addonName).createLine({
            text: "User is not authenticated, skipping sync",
            type: "error",
        });
        return;
    }

    if (getPref("syncPreference") !== "auto") {
        ztoolkit.log("Automatic sync is not enabled, not automatically deleting the item online");
        //TODO: Ask the user if he wants to delete the item online
        return;
    }

    for (const id of ids) {
        ztoolkit.log("ID of the deleted item: " + id);
        const deletedItem = await Zotero.Items.getAsync(id);

        //Check if the item is a publication
        //If its not a publication, get the parent publication and update it
        if (!deletedItem.isRegularItem()) {
            //We only want to sync attachments, everything else is ignored for now
            if (deletedItem.isAttachment()) {
                ztoolkit.log("Item is an attachment, syncing");
                const parentID = deletedItem.parentID;
                if (parentID === undefined || parentID === false) {
                    ztoolkit.log("ParentID is undefined");
                    break;
                }
                await itemModifiedListener([parentID]);
            } else {
                ztoolkit.log("Deleted Item is not an attachment, skipping sync");
                break;
            }
        }
        ztoolkit.log("Deleting item online");
        await HelperFactory.deleteEntry(deletedItem);
    }

}

