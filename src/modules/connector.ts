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
import { syncItem, deleteItemOnline, syncAllItems, performInitialSync, performSyncWithErrors } from "../modules/synchronizationLogic";
import { getPref, setPref, getAuthWithDefaultGroup } from "../utils/prefs";
import { UnauthorizedError, DuplicateItemError, PostNotFoundError, InvalidFormatError } from '../types/errors';
import { itemAddedListener, itemModifiedListener, itemDeletedListener } from "../modules/listeners"
import { DialogHelper } from "zotero-plugin-toolkit/dist/helpers/dialog";

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

    static async syncEntry(item: Zotero.Item | null = null, force_update: boolean = false, notifyDuplicate: boolean = true, isUpdate: boolean = false) {
        item = item || await this.getSelectedItem();

        const progressWindow = new ztoolkit.ProgressWindow(config.addonName);
        if (isUpdate) {
            progressWindow.createLine({
                text: getString("progress-update-entry-text", { args: { title: item.getField("title") } }),
                type: "success",
            });
        } else {
            progressWindow.createLine({
                text: getString("progress-sync-entry-text", { args: { title: item.getField("title") } }),
                type: "success",
            });
        }
        progressWindow.show(1000);

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

    //TODO: Add more advanced error handling!
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

    static async performInitialSync() {
        // eslint-disable-next-line prefer-const
        let dialog: any;
        let cancelSync = false;
        const startTime = Date.now();
        const dialogData: { [key: string | number]: any } = {
            errors: [] as Array<{ item: Zotero.Item; error: Error }>,
            syncedCount: 0,
            totalCount: 1, //To not start with 100% progress
            progress: 0,
            message: "",
            errorLog: "",
            timeRemaining: "",
            loadCallback: async () => {
                ztoolkit.log("Load callback started");
                try {
                    const errors = await performSyncWithErrors(
                        (totalItems) => {
                            dialogData.totalCount = totalItems;
                        },
                        (progress, message) => {
                            if (cancelSync) return;
                            dialogData.progress = progress;
                            dialogData.message = message;
                            dialogData.syncedCount = Math.floor(progress * dialogData.totalCount);
                            updateProgress();
                        },
                        (error) => {
                            if (cancelSync) return;
                            dialogData.errors.push(error);
                            updateErrorLog(error);
                        }
                    );
                    if (!cancelSync) {
                        const successfulSyncs = dialogData.totalCount - errors.length;
                        updateCompletionMessage(successfulSyncs, errors.length);
                    }
                } catch (error: any) {
                    if (!cancelSync) {
                        ztoolkit.getGlobal("alert")(`Initial sync failed: ${error.message}`);
                    }
                } finally {
                    const closeButton = dialog.window.document.getElementById("close-button");
                    const cancelButton = dialog.window.document.getElementById("cancel-button");
                    if (closeButton && cancelButton) {
                        (closeButton as any).disabled = false;
                        (cancelButton as any).disabled = true;
                    }
                }
                ztoolkit.log("Load callback finished");
            },
        };

        ztoolkit.log("Creating dialog");
        dialog = new ztoolkit.Dialog(8, 1)
            .addCell(0, 0, {
                tag: "description",
                properties: {
                    style: "width: 100%; margin-bottom: 15px; font-size: 14px; white-space: normal; word-wrap: break-word;"
                },
                children: [{
                    tag: "description",
                    properties: {
                        value: getString("initial-sync-description"),
                        style: "white-space: normal; word-wrap: break-word;"
                    }
                }]
            })
            .addCell(1, 0, {
                tag: "hbox",
                properties: {
                    id: "progress-bar-container",
                    style: "width: 100%; height: 20px; border: 1px solid #ccc; background-color: #f0f0f0; margin-bottom: 10px; border-radius: 10px; overflow: hidden;"
                },
                children: [{
                    tag: "hbox",
                    properties: {
                        id: "progress-bar",
                        style: "width: 0%; height: 100%; background-color: #4CAF50; transition: width 0.3s ease-in-out;"
                    }
                }]
            })
            .addCell(2, 0, {
                tag: "description",
                attributes: { "data-bind": "message" },
                properties: { id: "progress-description", style: "margin-bottom: 5px; font-size: 13px;" }
            })
            .addCell(3, 0, {
                tag: "description",
                properties: { id: "time-remaining", style: "margin-bottom: 15px; font-size: 12px; color: #666;" }
            })
            .addCell(4, 0, {
                tag: "description",
                properties: { value: getString("initial-sync-error-log"), style: "font-weight: bold; margin-bottom: 5px; font-size: 13px;" }
            })
            .addCell(5, 0, {
                tag: "vbox",
                properties: {
                    id: "error-log-container",
                    style: "width: 100%; height: 150px; overflow-y: auto; border: 1px solid #ccc; padding: 5px; margin-bottom: 15px; font-family: monospace; font-size: 12px; background-color: #fff;"
                }
            })
            .addCell(6, 0, {
                tag: "description",
                properties: { id: "completion-message", style: "font-weight: bold; margin-top: 10px; font-size: 14px; text-align: center;" }
            })
            .addButton(getString("initial-sync-cancel"), "cancel-button", {
                noClose: true,
                callback: () => {
                    cancelSync = true;
                    updateCompletionMessage(dialogData.syncedCount, dialogData.errors.length, true);
                    (dialog.window.document.getElementById("cancel-button") as any).disabled = true;
                    (dialog.window.document.getElementById("close-button") as any).disabled = false;
                }
            })
            .addButton(getString("initial-sync-close"), "close-button", {
                disabled: true
            })
            .setDialogData(dialogData);

        ztoolkit.log("Opening dialog");
        dialog.open(getString("initial-sync-title"), {
            width: 550,
            height: 450,
            centerscreen: true,
            resizable: false, //TODO: Would be nice to have a resizable dialog, but need to bind this to the height of the error log
        });

        function updateProgress() {
            const progressBar = dialog.window.document.getElementById("progress-bar");
            const progressDescription = dialog.window.document.getElementById("progress-description");
            const timeRemaining = dialog.window.document.getElementById("time-remaining");
            if (progressBar && progressDescription && timeRemaining) {
                progressBar.style.width = `${dialogData.progress * 100}%`;
                progressDescription.textContent = getString("initial-sync-progress", {
                    args: { synced: dialogData.syncedCount, total: dialogData.totalCount }
                });

                const elapsedTime = (Date.now() - startTime) / 1000;
                const estimatedTotalTime = elapsedTime / dialogData.progress;
                const remainingTime = Math.max(0, estimatedTotalTime - elapsedTime);
                timeRemaining.textContent = getString("initial-sync-time-remaining", {
                    args: { time: Math.round(remainingTime) }
                });
            }
        }

        function updateErrorLog(error: { item: Zotero.Item; error: Error }) {
            const errorLogContainer = dialog.window.document.getElementById("error-log-container");
            if (errorLogContainer) {
                const errorElement = dialog.window.document.createElement("div");

                const itemName = dialog.window.document.createElement("span");
                itemName.textContent = `Item "${error.item.getField("title")}": `;
                itemName.style.fontWeight = "bold";
                itemName.style.color = "#333";

                const errorMessage = dialog.window.document.createElement("span");
                errorMessage.textContent = error.error.message;
                errorMessage.style.color = "#d32f2f";

                const helpLink = dialog.window.document.createElement("a");
                helpLink.textContent = getString("progress-error-help-link");
                helpLink.href = "#";
                helpLink.style.color = "#1565c0";
                helpLink.onclick = (e: any) => {
                    e.preventDefault();
                    showErrorHelp(error.error);
                };

                const contentWrapper = dialog.window.document.createElement("div");
                contentWrapper.style.display = "flex";
                contentWrapper.style.justifyContent = "space-between";
                contentWrapper.style.alignItems = "flex-start";

                const textContent = dialog.window.document.createElement("div");
                textContent.style.flex = "1";
                textContent.appendChild(itemName);
                textContent.appendChild(errorMessage);

                contentWrapper.appendChild(textContent);
                contentWrapper.appendChild(helpLink);

                errorElement.appendChild(contentWrapper);

                errorElement.style.opacity = "0";
                errorElement.style.transition = "opacity 0.3s ease-in-out";
                errorElement.style.marginBottom = "5px";
                errorElement.style.padding = "5px";
                errorElement.style.backgroundColor = "#ffebee";
                errorElement.style.borderRadius = "3px";

                errorLogContainer.appendChild(errorElement);
                errorLogContainer.scrollTop = errorLogContainer.scrollHeight;

                setTimeout(() => {
                    errorElement.style.opacity = "1";
                }, 10);
            }
        }

        function showErrorHelp(error: Error) {
            const helpMessage = getErrorHelpMessage(error);
            ztoolkit.getGlobal("alert")(helpMessage);
        }

        function getErrorHelpMessage(error: Error): string {
            // Add more specific error types and messages as needed
            if (error instanceof UnauthorizedError) {
                return getString("progress-error-help-message-unauthorized");
            } else if (error instanceof PostNotFoundError) {
                return getString("progress-error-help-message-post-not-found");
            } else if (error instanceof InvalidFormatError) {
                return getString("progress-error-help-message-invalid-format");
            } else {
                return getString("progress-error-help-message-unexpected");
            }
        }

        function updateCompletionMessage(successfulSyncs: number, errorCount: number, cancelled: boolean = false) {
            const completionMessage = dialog.window.document.getElementById("completion-message");
            if (completionMessage) {
                if (cancelled) {
                    completionMessage.textContent = getString("initial-sync-cancelled", {
                        args: { synced: successfulSyncs, failed: errorCount, total: dialogData.totalCount }
                    });
                } else {
                    completionMessage.textContent = getString("initial-sync-complete", {
                        args: { successful: successfulSyncs, failed: errorCount, total: dialogData.totalCount }
                    });
                }
            }

            // Ensure error log remains visible
            const errorLogContainer = dialog.window.document.getElementById("error-log-container");
            if (errorLogContainer) {
                errorLogContainer.style.display = 'block';
            }
        }

        ztoolkit.log("Waiting for dialog to close");
        await dialogData.unloadLock.promise;
        ztoolkit.log("Dialog closed");
    }
}