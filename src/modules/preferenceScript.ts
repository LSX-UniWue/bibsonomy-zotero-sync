/**
 * Module to handle everything in the preferences UI
 */

import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref, getAuth } from "../utils/prefs";
import { UIFactory } from "./connector"
import { HelperFactory } from "./connector";
import { DialogHelper } from "zotero-plugin-toolkit/dist/helpers/dialog";

export async function registerPrefsScripts(_window: Window) {
  // Initialize or update preferences UI
  ztoolkit.log("Registering preference scripts");
  if (!addon.data.prefs) {
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }

  await updatePrefsUI();
  bindPrefEvents();
}

/**
 * Update the preferences UI by dynamically populating the "default group" dropdown based on the user's groups
 */
async function updatePrefsUI() {
  // Check authentication status first
  await checkUserAuth();

  const authenticated = getPref("authenticated") || false;
  const warningElement = getElementBySelector(`#zotero-prefpane-${config.addonRef}-container #zotero-prefpane-${config.addonRef}-pref-auth-warning`);
  warningElement?.setAttribute("hidden", authenticated.toString());

  ztoolkit.log("Updating preferences UI");

  // Update sync preference radio buttons
  const syncPreference = getPref("syncPreference");
  const syncPreferenceRadiogroup = getElementBySelector(`#zotero-prefpane-${config.addonRef}-container #zotero-prefpane-${config.addonRef}-sync-preference`) as XULElementRadioGroup;
  if (syncPreferenceRadiogroup) {
    syncPreferenceRadiogroup.value = syncPreference;
  }

  const groups = await getUserGroups();
  const menupop = getElementBySelector(`#zotero-prefpane-${config.addonRef}-container #zotero-prefpane-${config.addonRef}-default-group-popup`);

  // Update selector for waiting item
  const waitingItem = getElementBySelector(`#zotero-prefpane-${config.addonRef}-container #zotero-prefpane-${config.addonRef}-default-group-waiting`);
  if (waitingItem && menupop) {
    menupop.removeChild(waitingItem);
  }

  // Dynamically add new menu items
  groups.forEach((group: string) => {
    const menuitem = addon.data.prefs!.window.document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
    menuitem.setAttribute("label", group);
    menuitem.setAttribute("value", group);
    menupop?.appendChild(menuitem);
  });
}

/**
 * Get the user's groups from the BibSonomy API
 * @returns The user's groups
 */
async function getUserGroups(): Promise<string[]> {
  if (!getPref("username") || !getPref("apiToken") || !getPref("authenticated")) {
    return [];
  }

  const { user, apiToken } = getAuth();
  const url = `${Zotero[config.addonInstance].data.baseURL}/api/users/${user}`;

  try {
    const data = await makeAPICall(url, createAPIHeaders(user, apiToken));
    return data.user?.groups?.group.map((group: { name: string }) => group.name) || [];
  } catch (error) {
    ztoolkit.log(`Error fetching user groups: ${error}`);
    return [];
  }
}

/**
 * Check if the users credentials are valid
 * @returns true if the user is authenticated, false otherwise
 */
async function checkUserAuth(): Promise<boolean> {
  ztoolkit.log("Checking user authentication");
  const { user, apiToken } = getAuth();

  if (!user || !apiToken) {
    ztoolkit.log("No username or API token found");
    setPref("authenticated", false);
    return false;
  }

  const url = `${Zotero[config.addonInstance].data.baseURL}/api/users/${user}`;

  try {
    await makeAPICall(url, createAPIHeaders(user, apiToken));
    setPref("authenticated", true);
    return true;
  } catch (error) {
    ztoolkit.log(`Error checking user authentication: ${error}`);
    setPref("authenticated", false);
    return false;
  }
}

/**
 * Update the authentication UI based on the user's authentication status
 */
function updateAuthUi() {
  const authenticated = getPref("authenticated");
  const messageString = getString(`pref-auth-check-info-${authenticated ? "success" : "failure"}`);
  const infoElement = getElementBySelector(`#zotero-prefpane-${config.addonRef}-container #zotero-prefpane-${config.addonRef}-auth-check-info`);

  if (infoElement) {
    infoElement.textContent = messageString;
    infoElement.classList.remove("success", "failure");
    infoElement.classList.add(authenticated ? "success" : "failure");
  }

  const warningElement = getElementBySelector(`#zotero-prefpane-${config.addonRef}-container #zotero-prefpane-${config.addonRef}-pref-auth-warning`);
  warningElement?.setAttribute("hidden", authenticated!.toString());
}


function bindPrefEvents() {
  addon.data.prefs!.window.document.querySelector(`#zotero-prefpane-${config.addonRef}-container #zotero-prefpane-${config.addonRef}-username`)
    ?.addEventListener("focusout", async (e) => {
      ztoolkit.log(e);
      await checkUserAuth();
      updateAuthUi();
    });

  addon.data.prefs!.window.document.querySelector(`#zotero-prefpane-${config.addonRef}-container #zotero-prefpane-${config.addonRef}-apikey`)
    ?.addEventListener("focusout", async (e) => {
      ztoolkit.log(e);
      await checkUserAuth();
      updateAuthUi();
    });

  addon.data.prefs!.window.document.querySelector(`#zotero-prefpane-${config.addonRef}-container #zotero-prefpane-${config.addonRef}-auth-check`)
    ?.addEventListener("click", async (e) => {
      ztoolkit.log(e);
      await checkUserAuth();
      updateAuthUi();
    });

  const syncPreferenceRadiogroup = addon.data.prefs!.window.document.querySelector(`#zotero-prefpane-${config.addonRef}-container #zotero-prefpane-${config.addonRef}-sync-preference`) as XULElementRadioGroup;

  // Set initial value
  const currentPreference = getPref("syncPreference");
  syncPreferenceRadiogroup.value = currentPreference;

  syncPreferenceRadiogroup.addEventListener("command", async (e) => {
    e.preventDefault(); // Prevent default behavior
    const newValue = syncPreferenceRadiogroup.value;

    ztoolkit.log(`Sync preference changed to ${newValue}`);

    if (newValue === "auto" && !getPref("initialSyncDone")) {
      const confirmed = await showConfirmDialog();
      if (confirmed) {
        await HelperFactory.performInitialSync();
        setPref("syncPreference", newValue);
      } else {
        // Reset to previous value if user cancels
        syncPreferenceRadiogroup.value = currentPreference;
      }
    } else {
      setPref("syncPreference", newValue);
    }

    UIFactory.registerRightClickMenuItems();
  });
}

async function showConfirmDialog(): Promise<boolean> {
  return new Promise((resolve) => {
    const dialogHelper = new DialogHelper(1, 1);

    dialogHelper.addCell(0, 0, {
      tag: "description",
      properties: { innerHTML: getString("pref-sync-auto-confirm") }
    });

    dialogHelper.addButton(getString("general-no"), "no", {
      noClose: false,
      callback: () => resolve(false)
    });

    dialogHelper.addButton(getString("general-yes"), "yes", {
      noClose: false,
      callback: () => resolve(true)
    });

    dialogHelper.setDialogData({
      unloadCallback: () => resolve(false) // Resolve false if dialog is closed without clicking a button
    });

    dialogHelper.open(getString("pref-sync-auto-confirm-title"), {
      width: 400,
      height: 110,
      centerscreen: true,
      resizable: false
    });
  });
}


// Some helper functions to handle the preferences
const getElementBySelector = (selector: string): HTMLElement | null =>
  addon.data.prefs?.window.document.querySelector(selector) ?? null;

const createAPIHeaders = (username: string, apiToken: string): Headers => {
  const headers = new Headers();
  headers.append('Authorization', `Basic ${btoa(`${username}:${apiToken}`)}`);
  headers.append('Content-Type', 'application/json');
  return headers;
};

const makeAPICall = async (url: string, headers: Headers): Promise<any> => {
  const response = await fetch(url, { method: 'GET', headers });
  if (!response.ok) {
    throw new Error(`API call failed: ${response.statusText}`);
  }
  return response.json();
};