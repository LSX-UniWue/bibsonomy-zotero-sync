import { BaseFactory, HelperFactory, UIFactory } from "./modules/connector"
import { getPref } from "./utils/prefs";
import { config } from "../package.json";
import { getString, initLocale } from "./utils/locale";
import { registerPrefsScripts } from "./modules/preferenceScript";
import { createZToolkit } from "./utils/ztoolkit";

async function onStartup() {
  await Promise.all([
    Zotero.initializationPromise,
    Zotero.unlockPromise,
    Zotero.uiReadyPromise,
  ]);

  // TODO: Remove this after zotero#3387 is merged
  if (__env__ === "development") {
    // Keep in sync with the scripts/startup.mjs
    const loadDevToolWhen = `Plugin ${config.addonID} startup`;
    ztoolkit.log(loadDevToolWhen);
  }

  initLocale();

  BaseFactory.registerNotifier();
  BaseFactory.registerPrefs();

  // Check if initial sync is needed
  const syncPreference = getPref("syncPreference");
  const initialSyncDone = getPref("initialSyncDone");
  if (syncPreference === "auto" && !initialSyncDone) {
    await HelperFactory.performInitialSync();
  } else if (syncPreference === "auto") {
    HelperFactory.syncAllEntries();
  }

  await onMainWindowLoad(window);
}

async function onMainWindowLoad(win: Window): Promise<void> {
  // Create ztoolkit for every window
  addon.data.ztoolkit = createZToolkit();
  UIFactory.registerRightClickMenuItems();
  HelperFactory.syncAllEntries();
  await Zotero.Promise.delay(1000);

}

async function onMainWindowUnload(win: Window): Promise<void> {
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
}

function onShutdown(): void {
  HelperFactory.syncAllEntries();
  ztoolkit.unregisterAll();
  addon.data.dialog?.window?.close();
  // Remove addon object
  addon.data.alive = false;
  delete Zotero[config.addonInstance];
}

/**
 * Prefs event handler
 * @param type event type
 * @param data event data
 */
async function onPrefsEvent(type: string, data: { [key: string]: any }) {
  switch (type) {
    case "load":
      registerPrefsScripts(data.window);
      break;
    default:
      return;
  }
}

function onDialogEvents(type: string) {
  switch (type) {
    case "syncEntry":
      HelperFactory.syncEntry();
      break;
    case "getShareURL":
      HelperFactory.getShareURL();
      break;
    default:
      break;
  }
}

// Add your hooks here. For element click, etc.
export default {
  onStartup,
  onShutdown,
  onMainWindowLoad,
  onMainWindowUnload,
  onPrefsEvent,
  onDialogEvents,
};