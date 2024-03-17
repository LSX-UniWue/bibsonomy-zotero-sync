import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { syncItem } from "../modules/synchronizationLogic";
import { getPref, setPref } from "../utils/prefs";
import { UnauthorizedError, DuplicateItemError } from '../types/errors';
import { get } from "http";

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
        if (getPref("syncPreference") === "manual") {
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

    static async syncEntry() {
        // Get the post the user is currently viewing
        const item = ZoteroPane.getSelectedItems()[0];

        const text = "Adding publication " + item.getField("title") + " to BibSonomy...";
        new ztoolkit.ProgressWindow(config.addonName)
            .createLine({
                text: text,
                type: "success",
            })
            .show();


        const user = getPref("username");
        const apiToken = getPref("apiToken");
        const defaultGroup = getPref("defaultGroup")

        if (!user || !apiToken || !defaultGroup || typeof user !== 'string' || typeof apiToken !== 'string' || typeof defaultGroup !== 'string') {
            ztoolkit.getGlobal("alert")("Error: Please fill in your BibSonomy credentials in the preferences.");
            return;
        }

        try {
            const post = await syncItem(item, user, apiToken, defaultGroup);
            ztoolkit.log(post)
            return `${config.bibsonomyBaseURL}/bibtex/${post.bibtex.interhash}/${user}`;
        } catch (error: any) {
            if (error instanceof UnauthorizedError) {
                ztoolkit.getGlobal("alert")("Error: Unauthorized access. Please check your credentials.");
                setPref("authenticated", false);
            } else if (error instanceof DuplicateItemError) {
                ztoolkit.getGlobal("alert")("Error: Duplicate item detected, a publication with the same BibTeX key already exists in your BibSonomy account.");
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
}
