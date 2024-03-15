import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { postEntry } from "../modules/bibsonomy_calls";
import { getPref, setPref } from "../utils/prefs";
import { UnauthorizedError, DuplicateItemError } from '../types/errors';


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
        const menuIcon = `chrome://${config.addonRef}/content/icons/icon.png`;
        ztoolkit.Menu.register("item", {
            tag: "menuitem",
            id: "zotero-itemmenu-postEntry",
            label: getString("menuitem-postEntry-label"),
            commandListener: (ev) => addon.hooks.onDialogEvents("postEntry"),
            icon: menuIcon,
        });
    }

    @logger
    //TODO: Check why the hell this is needed for registering the custom item properties
    static async registerExtraColumnWithCustomCell() {
        await ztoolkit.ItemTree.register(
            "test2",
            "custom column",
            (
                field: string,
                unformatted: boolean,
                includeBaseMapped: boolean,
                item: Zotero.Item,
            ) => {
                return String(item.id);
            },
            {
                renderCell(index, data, column) {
                    ztoolkit.log("Custom column cell is rendered!");
                    const span = document.createElementNS(
                        "http://www.w3.org/1999/xhtml",
                        "span",
                    );
                    span.className = `cell ${column.className}`;
                    span.style.background = "#0dd068";
                    span.innerText = "⭐" + data;
                    return span;
                },
            },
        );
    }

    @logger
    static async registerCustomItemProperties() {
        await ztoolkit.ItemBox.register(
            "itemBoxFieldNonEditable",
            "BibSonomy Metadata",
            (field, unformatted, includeBaseMapped, item, original) => {
                return (
                    ""
                );
            },
            {
                editable: false,
                index: 2,
                collapsible: true,
            },
        );
    }
}

export class HelperFactory {

    static async postEntry() {
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
            const post = await postEntry(item, user, apiToken, defaultGroup);
            ztoolkit.log(post)

            const link = `https://www.bibsonomy.org/bibtex/${post.bibtex.interhash}/${user}`;

            // Give a success message via a progress window
            new ztoolkit.ProgressWindow(config.addonName)
                .createLine({
                    text: "Publication added successfully! (Link copied to clipboard)",
                    type: "success",
                })
                .show();

            // Copy the link to the clipboard
            new ztoolkit.Clipboard()
                .addText(link)
                .copy();
        } catch (error: any) {
            if (error instanceof UnauthorizedError) {
                ztoolkit.getGlobal("alert")("Error: Unauthorized access. Please check your credentials.");
                setPref("authenticated", false);
            } else if (error instanceof DuplicateItemError) {
                ztoolkit.getGlobal("alert")("Error: Duplicate item detected, a publication with the same BibTeX key already exists in your BibSonomy account.");
            } else {
                ztoolkit.getGlobal("alert")(`Error: ${error.message}`);
            }
        }
    }
}
