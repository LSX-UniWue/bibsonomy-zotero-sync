import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { syncItemDefault, deleteItemOnline, syncAllItems } from "../modules/synchronizationLogic";
import { getPref, setPref } from "../utils/prefs";
import { UnauthorizedError, DuplicateItemError } from '../types/errors';
import { get } from "http";
import { itemAddedListener, itemModifiedListener, itemDeletedListener } from "../modules/listeners"

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
                            ztoolkit.log("Item added");
                            await itemAddedListener(ids);
                            break;
                        case "modify":
                            ztoolkit.log("Item modified");
                            await itemModifiedListener(ids);
                            break;
                        case "trash":
                            ztoolkit.log("Item trashed");
                            await itemDeletedListener(ids);
                            break;
                        case "delete":
                            ztoolkit.log("Item deleted");
                            await itemDeletedListener(ids);
                            break;
                        default:
                            break;
                    }
                }


                //Print all arguments
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

export class UIFactory {
    @logger
    static registerRightClickMenuItems() {
        ztoolkit.Menu.unregisterAll();
        const menuIcon = `chrome://${config.addonRef}/content/icons/icon.png`;
        if (getPref("authenticated") === false) {
            ztoolkit.Menu.register("item", {
                tag: "menuitem",
                id: "zotero-itemmenu-authenticate",
                label: getString("menuitem-authenticate-label"),
                commandListener: (ev) => {
                    ztoolkit.getGlobal("alert")("Please authenticate with BibSonomy to use this feature. Go to the preferences to fill in your BibSonomy credentials.");
                },
                icon: menuIcon,
            });
            return; // Do not register other menu items if the user is not authenticated
        }

        // Get BibSonomy share URL
        ztoolkit.Menu.register("item", {
            tag: "menuitem",
            id: "zotero-itemmenu-getBibSonomyURL",
            label: getString("menuitem-getBibSonomyURL-label"),
            commandListener: (ev) => addon.hooks.onDialogEvents("getShareURL"),
            icon: menuIcon,
        });

        // Sync entry with BibSonomy
        ztoolkit.log("Sync preference: " + getPref("syncPreference"));
        if (getPref("syncPreference") === "manual" || getPref("syncPreference") === "semi-auto") {
            ztoolkit.Menu.register("item", {
                tag: "menuitem",
                id: "zotero-itemmenu-syncEntry",
                label: getString("menuitem-syncEntry-label"),
                commandListener: (ev) => addon.hooks.onDialogEvents("syncEntry"),
                icon: menuIcon,
            });
        }
    }
}

export class HelperFactory {

    static async syncAllEntries() {
        await syncAllItems();
    }

    static async syncEntry(item: Zotero.Item | null = null, force_update: boolean = false, notifyDuplicate: boolean = true) {
        // Get the post the user is currently viewing
        if (!item) {
            if (ZoteroPane.getSelectedItems().length === 0) {
                ztoolkit.getGlobal("alert")("Error: No item selected.");
                return;
            }
            item = ZoteroPane.getSelectedItems()[0];
        }

        const text = "Adding publication " + item.getField("title") + " to BibSonomy...";
        new ztoolkit.ProgressWindow(config.addonName)
            .createLine({
                text: text,
                type: "success",
            })
            .show();

        try {
            const post = await syncItemDefault(item, force_update);
            ztoolkit.log(post)
            const user = getPref("username");
            return `${Zotero[config.addonInstance].data.baseURL}/bibtex/${post.bibtex.interhash}/${user}`;
        } catch (error: any) {
            ztoolkit.log(error);
            ztoolkit.log(error.message);
            ztoolkit.log(error.stack);
            if (error instanceof UnauthorizedError) {
                ztoolkit.getGlobal("alert")("Error: Unauthorized access. Please check your credentials.");
                setPref("authenticated", false);
            } else if (error instanceof DuplicateItemError) {
                if (notifyDuplicate) {
                    ztoolkit.getGlobal("alert")("Error: Duplicate item detected, a publication with the same BibTeX key already exists in your BibSonomy account.");
                }
            } else {
                ztoolkit.getGlobal("alert")(`Error: ${error.message}`);
            }
            return "";
        }
    }

    static async getShareURL() {
        const link = await HelperFactory.syncEntry();
        if (!link || link === "") {
            new ztoolkit.ProgressWindow(config.addonName)
                .createLine({
                    text: "Error: Publication could not be synced.",
                    type: "error",
                })
            return;
        }
        new ztoolkit.Clipboard()
            .addText(link)
            .copy();

        // Give a success message via a progress window
        new ztoolkit.ProgressWindow(config.addonName)
            .createLine({
                text: "Publication synced successfully! (Link copied to clipboard)",
                type: "success",
            })
            .show();
    }

    static async deleteEntry(item: Zotero.Item | null = null) {
        // Get the post the user is currently viewing
        if (!item) {
            if (ZoteroPane.getSelectedItems().length === 0) {
                ztoolkit.getGlobal("alert")("Error: No item selected.");
                return;
            }
            item = ZoteroPane.getSelectedItems()[0];
        }

        const text = "Deleting publication " + item.getField("title") + " from BibSonomy...";
        new ztoolkit.ProgressWindow(config.addonName)
            .createLine({
                text: text,
                type: "success",
            })
            .show();

        try {
            await deleteItemOnline(item);
            return;
        } catch (error: any) {
            ztoolkit.log(error);
            ztoolkit.log(error.message);
            ztoolkit.log(error.stack);
            if (error instanceof UnauthorizedError) {
                ztoolkit.getGlobal("alert")("Error: Unauthorized access. Please check your credentials.");
                setPref("authenticated", false);
            } else {
                ztoolkit.getGlobal("alert")(`Error: ${error.message}`);
            }
            return "";
        }
    }
}
