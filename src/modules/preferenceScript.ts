import { get } from "http";
import { config } from "../../package.json";
import { getString } from "../utils/locale";
import { getPref, setPref } from "../utils/prefs";
import { BaseFactory, HelperFactory, UIFactory } from "./connector"


export async function registerPrefsScripts(_window: Window) {
  // Initialize or update preferences UI
  ztoolkit.log("Registering preference scripts");
  if (!addon.data.prefs) {
    //Throw error if addon.data.prefs is not defined
    addon.data.prefs = {
      window: _window,
    };
  } else {
    addon.data.prefs.window = _window;
  }

  updatePrefsUI();
  bindPrefEvents();
}

async function updatePrefsUI() {
  // Dynamically populate the "default group" dropdown based on BibSonomy API
  // Placeholder for API call to fetch groups
  let authenticated = getPref("authenticated");
  if (!authenticated) {
    authenticated = false;
  }
  addon.data.prefs!.window.document.querySelector(`#zotero-prefpane-${config.addonRef}-pref-auth-warning`)?.setAttribute("hidden", authenticated!.toString());

  ztoolkit.log("Updating preferences UI");
  const groups = await getUserGroups(); // Assuming this function fetches the groups
  const menupop = addon.data.prefs!.window.document.querySelector<HTMLElement>(
    `#zotero-prefpane-${config.addonRef}-default-group-popup`
  );

  // Remove the waiting item 
  menupop?.removeChild(addon.data.prefs!.window.document.querySelector<HTMLElement>(
    `#zotero-prefpane-${config.addonRef}-default-group-waiting`
  )!);
  // Dynamically add new menu items
  groups.forEach((group: string) => {
    const menuitem = addon.data.prefs!.window.document.createElementNS("http://www.mozilla.org/keymaster/gatekeeper/there.is.only.xul", "menuitem");
    menuitem.setAttribute("label", group);
    menuitem.setAttribute("value", group);
    menupop?.appendChild(menuitem);
  });
}


async function getUserGroups() {
  if (!(await isUserLoggedIn())) {
    return [];
  }

  const username = getPref("username");
  const apiToken = getPref("apiToken");

  ztoolkit.log(`Fetching groups for user ${username}`);

  // Define the URL and the credentials for the API call
  const url = `${Zotero[config.addonInstance].data.baseURL}/api/users/${username}`;
  const headers = new Headers();


  const base64Credentials = btoa(username + ':' + apiToken);

  headers.append('Authorization', `Basic ${base64Credentials}`); // Replace `yourUsername` and `yourApiToken` accordingly
  headers.append('Content-Type', 'application/json');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });

    if (!response.ok) {
      throw new Error(`Error fetching user groups: ${response.statusText}`);
    }

    const data = await response.json();

    // Assuming the response has a structure where groups are an array of objects with a "name" property
    if (!data.user.groups) {
      ztoolkit.log(`No groups found for user ${username}`);
      return [];
    }

    const groups = data.user.groups.group.map((group: { name: string; }) => group.name);

    ztoolkit.log(`Fetched groups: ${groups}`);

    return groups;
  } catch (error) {
    ztoolkit.log(`Error fetching user groups: ${error}`);
    return []; // Return an empty array or handle the error appropriately
  }
}


async function isUserLoggedIn() {
  if (!getPref("username") || !getPref("apiToken")) {
    return false;
  }
  return getPref("authenticated");
}

async function checkUserAuth() {
  ztoolkit.log("Checking user authentication");
  if (!getPref("username") || !getPref("apiToken")) {
    ztoolkit.log("No username or API token found");
    setPref("authenticated", false);
    return false;
  }

  const username = getPref("username");
  const apiToken = getPref("apiToken");

  ztoolkit.log(`Checking user authentication for ${username} with token ${apiToken}`);

  const url = `${Zotero[config.addonInstance].data.baseURL}/api/users/${username}`;
  const headers = new Headers();


  const base64Credentials = btoa(username + ':' + apiToken);

  headers.append('Authorization', `Basic ${base64Credentials}`); // Replace `yourUsername` and `yourApiToken` accordingly
  headers.append('Content-Type', 'application/json');

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: headers
    });

    if (response.status === 401) {
      setPref("authenticated", false);
      return false;
    } else if (response.ok) {
      setPref("authenticated", true);
      return true;
    }

    throw new Error(`Error checking user authentication: ${response.statusText}`);
  } catch (error) {
    ztoolkit.log(`Error checking user authentication: ${error}`);
    return false;
  }

}

function updateAuthUi() {
  const authenticated = getPref("authenticated");
  const messageString = getString(`pref-auth-check-info-${authenticated ? "success" : "failure"}`);
  addon.data.prefs!.window.document.querySelector(`#zotero-prefpane-${config.addonRef}-auth-check-info`)?.setAttribute("value", messageString);
  addon.data.prefs!.window.document.querySelector(`#zotero-prefpane-${config.addonRef}-pref-auth-warning`)?.setAttribute("hidden", authenticated!.toString());
}

function bindPrefEvents() {
  addon.data.prefs!.window.document.querySelector(`#zotero-prefpane-${config.addonRef}-username`)
    ?.addEventListener("focusout", async (e) => {
      ztoolkit.log(e);
      await checkUserAuth();
      updateAuthUi();
    });

  addon.data.prefs!.window.document.querySelector(`#zotero-prefpane-${config.addonRef}-apikey`)
    ?.addEventListener("focusout", async (e) => {
      ztoolkit.log(e);
      await checkUserAuth();
      updateAuthUi();
    });

  addon.data.prefs!.window.document.querySelector(`#zotero-prefpane-${config.addonRef}-auth-check`)
    ?.addEventListener("click", async (e) => {
      ztoolkit.log(e);
      await checkUserAuth();
      updateAuthUi();
    });

  ztoolkit.log("Registering sync preference change event")
  addon.data.prefs!.window.document.querySelectorAll(`#zotero-prefpane-${config.addonRef}-sync-preference radio`).forEach((radioButton) => {
    radioButton.addEventListener("click", (e) => {
      ztoolkit.log(e);
      setPref("syncPreference", radioButton.getAttribute("value")!);
      UIFactory.registerRightClickMenuItems();
    });
  });

}