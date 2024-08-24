import { config } from "../../package.json";
import { getString } from "./locale";

/**
 * Get preference value.
 * Wrapper of `Zotero.Prefs.get`.
 * @param key
 */
export function getPref(key: string) {
  return Zotero.Prefs.get(`${config.prefsPrefix}.${key}`, true);
}

/**
 * Set preference value.
 * Wrapper of `Zotero.Prefs.set`.
 * @param key
 * @param value
 */
export function setPref(key: string, value: string | number | boolean) {
  return Zotero.Prefs.set(`${config.prefsPrefix}.${key}`, value, true);
}

/**
 * Clear preference value.
 * Wrapper of `Zotero.Prefs.clear`.
 * @param key
 */
export function clearPref(key: string) {
  return Zotero.Prefs.clear(`${config.prefsPrefix}.${key}`, true);
}

/**
 * Helper function to get the user and api token from the preferences
 * @returns The user and api token
 */
export function getAuth(): { user: string, apiToken: string } {
  const user = getPref("username");
  const apiToken = getPref("apiToken");

  if (!user || !apiToken || typeof user !== 'string' || typeof apiToken !== 'string') {
    ztoolkit.getGlobal("alert")(getString("alert-credentials-not-set"));
    throw new Error("BibSonomy credentials not set");
  }
  return { user, apiToken };
}

export function getAuthWithDefaultGroup(): { user: string, apiToken: string, defaultGroup: string } {
  const { user, apiToken } = getAuth();
  const defaultGroup = getPref("defaultGroup");
  if (!defaultGroup || typeof defaultGroup !== 'string') {
    ztoolkit.getGlobal("alert")(getString("alert-default-group-not-set"));
    throw new Error("Default group not set");
  }
  return { user, apiToken, defaultGroup };
}
