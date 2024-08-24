/**
 * connector.ts (based on zotero-plugin-template by @windingwind)
 * 
 * This module provides the core functionality for connecting and synchronizing
 * Zotero items with BibSonomy. It includes classes for base functionality,
 * UI interactions, and helper methods for synchronization.
 * 
 * Key components:
 * - BaseFactory: Handles core functionality like registering notifiers and preferences.
 * - UIFactory: Manages UI-related operations like registering right-click menu items.
 * - HelperFactory: Provides methods for syncing entries, getting share URLs, and deleting entries.
 * 
 * This is the entry point to retrace the flow of the plugin and implement new features.
 */

import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { syncItem, deleteItemOnline, syncAllItems } from "../modules/synchronizationLogic";
import { getPref, setPref, getAuthWithDefaultGroup } from "../utils/prefs";
import { UnauthorizedError, DuplicateItemError } from '../types/errors';
import { itemAddedListener, itemModifiedListener, itemDeletedListener } from "../modules/listeners"

/**
 * Decorator to log method calls and errors in the BibSonomy Connector.
 * @param target - The target object.
 * @param propertyKey - The property key.
 * @param descriptor - The property descriptor.
 * @returns The property descriptor.
 */
function logger(
    target: any,
    propertyKey: string | symbol,
    descriptor: PropertyDescriptor,
) {
    const original = descriptor.value;
    descriptor.value = function (...args: any) {
        try {
            ztoolkit.log(`Calling in BibSonomy Connector ${target.name}.${String(propertyKey)}`);
            return original.apply(this, args);
        } catch (e) {
            ztoolkit.log(`Error in in BibSonomy Connector ${target.name}.${String(propertyKey)}`, e);
            throw e;
        }
    };
    return descriptor;
}

/**
 * BaseFactory
 * 
 * Handles core functionality like registering notifiers and preferences.
 */
export class BaseFactory {
    @logger
    static registerNotifier() {
        const callback = {
            notify: async (
                event: string,
                type: string,
                ids: number[] | string[],
                extraData: { [key: string]: any },
            ) => {
                if (!addon?.data.alive) {
                    this.unregisterNotifier(notifierID);
                    return;
                }

                // Dispatch all events related to syncing items
                // The handling of the syncmode is done within the methods
                if (type === "item") {
                    switch (event) {
                        case "add":
                            ztoolkit.log(`Item added: ${ids}`);
                            await itemAddedListener(ids);
                            break;
                        case "modify":
                            ztoolkit.log(`Item modified: ${ids}`);
                            await itemModifiedListener(ids);
                            break;
                        case "trash":
                            ztoolkit.log(`Item trashed: ${ids}`);
                            await itemDeletedListener(ids);
                            break;
                        case "delete":
                            ztoolkit.log(`Item deleted: ${ids}`);
                            await itemDeletedListener(ids);
                            break;
                        default:
                            ztoolkit.log(`Unknown event ${event} for item ${ids}`);
                            break;
                    }
                }

                //Print all arguments (very verbose but helpful for debugging)
                ztoolkit.log("Notifier called with event: " + event + " type: " + type + " ids: " + ids + " extraData: " + JSON.stringify(extraData));
            },
        };

        // Register the callback in Zotero as an item observer
        const notifierID = Zotero.Notifier.registerObserver(callback, [
            "tab",
            "item",
            "file",
        ]);

        // Unregister callback when the window closes (important to avoid a memory leak)
        window.addEventListener(
            "unload",
            (e: Event) => {
                this.unregisterNotifier(notifierID);
            },
            false,
        );
    }

    @logger
    private static unregisterNotifier(notifierID: string) {
        Zotero.Notifier.unregisterObserver(notifierID);
    }

    @logger
    static registerPrefs() {
        const prefOptions = {
            pluginID: config.addonID,
            src: rootURI + "chrome/content/preferences.xhtml",
            label: getString("prefs-title"),
            image: `chrome://${config.addonRef}/content/icons/icon.png`,
            defaultXUL: true,
        };
        ztoolkit.PreferencePane.register(prefOptions);
    }

}

/**
 * UIFactory
 * 
 * Manages UI-related operations like registering right-click menu items.
 */
export class UIFactory {
    @logger
    static registerRightClickMenuItems() {
        ztoolkit.Menu.unregisterAll();
        const menuIcon = `chrome://${config.addonRef}/content/icons/icon.png`;

        if (!getPref("authenticated")) {
            this.registerAuthenticationMenuItem(menuIcon);
            return;
        }

        this.registerBibSonomyURLMenuItem(menuIcon);
        this.registerSyncEntryMenuItem(menuIcon);
    }

    private static registerAuthenticationMenuItem(menuIcon: string) {
        ztoolkit.Menu.register("item", {
            tag: "menuitem",
            id: "zotero-itemmenu-authenticate",
            label: getString("menuitem-authenticate-label"),
            commandListener: () => ztoolkit.getGlobal("alert")(getString("alert-unauthorized")),
            icon: menuIcon,
        });
    }

    private static registerBibSonomyURLMenuItem(menuIcon: string) {
        ztoolkit.Menu.register("item", {
            tag: "menuitem",
            id: "zotero-itemmenu-getBibSonomyURL",
            label: getString("menuitem-getBibSonomyURL-label"),
            commandListener: () => addon.hooks.onDialogEvents("getShareURL"),
            icon: menuIcon,
        });
    }

    private static registerSyncEntryMenuItem(menuIcon: string) {
        const syncPreference = getPref("syncPreference");
        if (syncPreference === "manual" || syncPreference === "semi-auto") {
            ztoolkit.Menu.register("item", {
                tag: "menuitem",
                id: "zotero-itemmenu-syncEntry",
                label: getString("menuitem-syncEntry-label"),
                commandListener: () => addon.hooks.onDialogEvents("syncEntry"),
                icon: menuIcon,
            });
        }
    }
}

/**
 * HelperFactory
 * 
 * Provides methods for syncing entries, getting share URLs, and deleting entries.
 */
export class HelperFactory {

    static async syncAllEntries() {
        await syncAllItems();
    }

    private static async getSelectedItem(): Promise<Zotero.Item> {
        const selectedItems = ZoteroPane.getSelectedItems();
        if (selectedItems.length === 0) {
            throw new Error(getString("alert-no-item-selected"));
        }
        return selectedItems[0];
    }

    static async syncEntry(item: Zotero.Item | null = null, force_update: boolean = false, notifyDuplicate: boolean = true) {
        item = item || await this.getSelectedItem();

        new ztoolkit.ProgressWindow(config.addonName)
            .createLine({
                text: getString("progress-sync-entry-text", { args: { title: item.getField("title") } }),
                type: "success",
            }).show();

        try {
            const { user, apiToken, defaultGroup } = getAuthWithDefaultGroup();
            const post = await syncItem(item, user, apiToken, defaultGroup, force_update);
            return `${Zotero[config.addonInstance].data.baseURL}/bibtex/${post.bibtex.interhash}/${user}`;
        } catch (error: any) {
            this.handleError(error, "sync");
            return "";
        }
    }

    static async getShareURL() {
        const link = await this.syncEntry();
        if (!link || link === "") return;
        new ztoolkit.Clipboard()
            .addText(link)
            .copy();
        new ztoolkit.ProgressWindow(config.addonName)
            .createLine({
                text: getString("progress-sync-entry-success"),
                type: "success",
            })
            .show();
    }

    static async deleteEntry(item: Zotero.Item | null = null) {
        item = item || await this.getSelectedItem();

        new ztoolkit.ProgressWindow(config.addonName)
            .createLine({
                text: getString("progress-delete-entry-text", { args: { title: item.getField("title") } }),
                type: "success",
            }).show();

        try {
            await deleteItemOnline(item);
            return;
        } catch (error: any) {
            this.handleError(error, "delete");
            return "";
        }
    }

    private static handleError(error: unknown, operation: "sync" | "delete") {
        ztoolkit.log(`Error ${operation}ing entry: ${error}`);
        if (error instanceof UnauthorizedError) {
            ztoolkit.getGlobal("alert")(getString("alert-unauthorized"));
            setPref("authenticated", false);
        } else if (error instanceof DuplicateItemError && operation === "sync") {
            ztoolkit.getGlobal("alert")(getString("alert-duplicate-item"));
        } else if (error instanceof Error) {
            ztoolkit.getGlobal("alert")(getString("alert-unexpected-error", { args: { message: error.message } }));
        } else {
            ztoolkit.getGlobal("alert")(getString("alert-unexpected-error", { args: { message: "Unknown error" } }));
        }
    }
}