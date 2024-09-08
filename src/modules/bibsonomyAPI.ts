/**
 * bibsonomyAPI.ts
 * 
 * Provides functions for interacting with the BibSonomy API:
 * - Authenticated requests
 * - CRUD operations for entries and attachments
 * - Error handling
 * 
 * Enables synchronization between Zotero and BibSonomy.
 * All API interactions should happen through these functions.
 */

import * as errors from '../types/errors';
import { config } from "../../package.json";
import { createBibsonomyPostFromItem } from './dataTransformers';
import { getString } from '../utils/locale';
import { addAttachmentsSyncdateToItem } from './synchronizationLogic';
import { getAuth, getAuthWithDefaultGroup, getPref } from '../utils/prefs';


export { postEntry, updateBibsonomyPost, getEntry, deleteEntry, uploadFileToEntry, deleteAllFilesFromEntry, handleHttpResponseError };

// Necessary due to the way Zotero handles imports
Components.utils.importGlobalProperties(['FormData']);


/**
 * Wrapper function to make a request to the BibSonomy API. 
 * Uses the auth credentials from the preferences.
 * Parses any response errors and throws them as custom errors.
 * @param method - The HTTP method to use for the request ('POST', 'PUT', or 'GET').
 * @param url - The URL to send the request to.
 * @param data - (optional) The data to send in the request body.
 * @returns A promise that resolves to the response from the Bibsonomy API.
 */
async function makeBibsonomyRequest(method: 'POST' | 'PUT' | 'GET' | 'DELETE', url: string, data?: any): Promise<Response> {
    if (!url.startsWith(Zotero[config.addonInstance].data.baseURL)) {
        throw new Error(`Invalid URL: ${url}`);
    }
    if (method === 'GET' && data) {
        throw new Error(`GET request with data is not allowed`);
    }

    const { user, apiToken } = getAuth();
    const response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(user + ':' + apiToken)
        },
        body: JSON.stringify(data) || undefined
    });
    if (!response.ok) {
        await handleHttpResponseError(response, method, url);
    }
    return response;
}

/**
 * Handles the error response from a BibSonomy HTTP request.
 * @param response - The response object from the HTTP request.
 * @param method - The HTTP method used for the request (optional).
 * @param url - The URL of the request (optional).
 * @throws Various error types based on the response status and error message.
 */
async function handleHttpResponseError(response: Response, method?: string, url?: string): Promise<void> {
    if (method && url) {
        ztoolkit.log(`Error in ${method} request to URL: ${url} with status: ${response.status}`);
    } else {
        ztoolkit.log(`Error in request to URL: ${response.url} with status: ${response.status}`);
    }

    let errorMessage = "Unknown error";
    try {
        const errorResponse = await response.json() as { error?: string };
        errorMessage = errorResponse.error || errorMessage;
    } catch (e) {
        errorMessage = await response.text() || errorMessage;
    }

    const lowerCaseErrorMessage = errorMessage.toLowerCase();

    switch (response.status) {
        case 400:
            if (lowerCaseErrorMessage.includes("error decoding authorization header")) {
                throw new errors.UnauthorizedError(errorMessage);
            }
            if (lowerCaseErrorMessage.includes("duplicate post detected") ||
                lowerCaseErrorMessage.startsWith("could not create new bibtex: this bibtex already exists in your collection")) {
                throw new errors.DuplicateItemError(errorMessage);
            }
            if (lowerCaseErrorMessage.includes("identical hash")) {
                throw new errors.DuplicateItemError(errorMessage);
            }
            if (lowerCaseErrorMessage.includes("missing field")) {
                throw new errors.InvalidBibTexError(errorMessage);
            }
            if (lowerCaseErrorMessage.includes("invalid model")) {
                throw new errors.InvalidModelError(errorMessage);
            }
            if (lowerCaseErrorMessage.startsWith("invalid bibtex")) {
                throw new errors.InvalidBibTexError(errorMessage);
            }
            if (lowerCaseErrorMessage.includes("start must be less than or equal end")) {
                throw new errors.InvalidRangeError(errorMessage);
            }
            if (lowerCaseErrorMessage.includes("only chuck norris can send content of another media type than he accepts")) {
                throw new errors.UnsupportedMediaTypeError(errorMessage);
            }
            throw new errors.BadRequestError(errorMessage);
        case 401:
            throw new errors.UnauthorizedError("Authentication failure");
        case 403:
            throw new errors.ForbiddenError(errorMessage);
        case 404:
            throw new errors.ResourceNotFoundError(errorMessage);
        case 415:
            throw new errors.UnsupportedMediaTypeError(errorMessage);
        case 500:
            throw new errors.InternalServerError(errorMessage);
        case 503:
            throw new errors.ServiceUnavailableError(errorMessage);
        default:
            throw new errors.UnexpectedAPIError(`Unexpected API error: ${response.status} ${response.statusText} - ${errorMessage}`);
    }
}

/**
 * Parses a post response from the BibSonomy API.
 * Post-Responses do NOT return a publication, but only a resourcehash and status!
 * @param response - The response object from the HTTP request.
 * @returns A promise that resolves to the parsed response data.
 */
async function parsePostResponseData(response: Response): Promise<BibSonomyPostResponse> {
    try {
        const data = await response.json();
        if (!data || typeof data !== 'object' || !('resourcehash' in data)) {
            throw new errors.InvalidFormatError('Unexpected response format from Bibsonomy API');
        }
        return data as unknown as BibSonomyPostResponse;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new errors.InvalidFormatError('Failed to parse Bibsonomy API response: ' + JSON.stringify(response));
        }
        throw error;
    }
}

/**
 * Fetches a BibSonomy entry with the specified resourcehash, parsing the response and throwing errors for invalid responses.
 * @param resourcehash - The resourcehash of the entry to fetch.
 * @returns A Promise that resolves to the fetched BibSonomy post.
 */
async function getEntry(resourcehash: string): Promise<BibsonomyPost> {
    ztoolkit.log(`Fetching BibSonomy entry with resourcehash: ${resourcehash}`);

    const user = getPref("username");
    const url = `${Zotero[config.addonInstance].data.baseURL}/api/users/${user}/posts/${resourcehash}?format=json`;
    const response = await makeBibsonomyRequest('GET', url);
    if (!response || typeof response !== 'object' || !('post' in response)) {
        throw new errors.InvalidFormatError('Unexpected response format from Bibsonomy API: ' + JSON.stringify(response));
    }
    return response.post as BibsonomyPost;
}

/**
 * Posts an entry to Bibsonomy.
 * 
 * @param item - The Zotero item to be posted.
 * @param await_upload - Whether to wait for the upload to finish.
 * @param progressCallback - A callback function to track upload progress.
 * @returns A promise that resolves to the posted Bibsonomy entry.
 */
async function postEntry(item: Zotero.Item, await_upload: boolean = false, progressCallback?: (message: string, progress: number) => void): Promise<BibsonomyPost> {
    const { user, apiToken, defaultGroup } = getAuthWithDefaultGroup();
    const post = createBibsonomyPostFromItem(item, user, defaultGroup);
    ztoolkit.log(`Posting entry: ${JSON.stringify(post)}`);
    const response = await makeBibsonomyRequest('POST', `${Zotero[config.addonInstance].data.baseURL}/api/users/${user}/posts`, { "post": post });
    const responseText = await parsePostResponseData(response);
    // We usually don't wait for the function to finish, as this can take quite some time and doesn't need to be synchronous
    // However, in some cases (e.g. the initial sync) we want to wait for the upload to finish
    if (!await_upload) {
        uploadAllFilesToEntry(user, responseText.resourcehash!, item, progressCallback);
    } else {
        ztoolkit.log(`Waiting for upload of entry: ${responseText.resourcehash}`);
        await uploadAllFilesToEntry(user, responseText.resourcehash!, item, progressCallback);
    }
    return getEntry(responseText.resourcehash) as Promise<BibsonomyPost>;
}


/**
 * Updates a Bibsonomy post with the given item, intrahash, username, apikey, and group.
 * @param item - The Zotero item to update the Bibsonomy post with.
 * @param updatedAttachments - The attachments that have been updated.
 * @param intrahash - The intrahash of the Bibsonomy post.
 * @returns A promise that resolves to the updated Bibsonomy post.
 */
async function updateBibsonomyPost(item: Zotero.Item, updatedAttachments: Zotero.Item[], intrahash: string, progressCallback?: (message: string, progress: number) => void): Promise<BibsonomyPost> {
    const { user, apiToken, defaultGroup } = getAuthWithDefaultGroup();
    const post = createBibsonomyPostFromItem(item, user, defaultGroup);
    const url = `${Zotero[config.addonInstance].data.baseURL}/api/users/${user}/posts/${intrahash}?format=json`;
    const response = await makeBibsonomyRequest('PUT', url, { "post": post });
    const responseText = await parsePostResponseData(response);

    const currentEntry = await getEntry(responseText.resourcehash);
    const currentAttachments = currentEntry.documents?.document || [];

    // Get all current attachments, not just updated ones
    const allItemAttachments = item.getAttachments().map(id => Zotero.Items.get(id));
    const allItemFilenames = new Set(allItemAttachments.map(att => (att as any).getFilename()));
    const onlineFilenames = new Set(currentAttachments.map(att => att.filename));

    ztoolkit.log(`Current online attachments: ${JSON.stringify(currentAttachments)}`);
    ztoolkit.log(`All local attachments: ${JSON.stringify(allItemAttachments)}`);
    ztoolkit.log(`Updated attachments: ${JSON.stringify(updatedAttachments)}`);

    if (allItemFilenames.size === allItemAttachments.length &&
        [...allItemFilenames].every(filename => onlineFilenames.has(filename)) &&
        onlineFilenames.size === allItemFilenames.size) {
        // Case 1: Perfect matching possible
        ztoolkit.log(`Perfect matching possible`);
        for (const attachment of updatedAttachments) {
            const filename = (attachment as any).getFilename();
            const onlineAttachment = currentAttachments.find(att => att.filename === filename);
            if (onlineAttachment) {
                await makeBibsonomyRequest('DELETE', onlineAttachment.href);
                await uploadFileToEntry(user, responseText.resourcehash, attachment.id);
            }
        }
    } else if ([...allItemFilenames].every(filename => !onlineFilenames.has(filename)) &&
        [...onlineFilenames].every(filename => !allItemFilenames.has(filename))) {
        // Case 2: Attachments added/deleted offline, but filenames are unambiguous
        ztoolkit.log(`Attachments added/deleted offline, unambiguous filenames`);
        // Delete files that are no longer present locally
        for (const onlineAttachment of currentAttachments) {
            if (!allItemFilenames.has(onlineAttachment.filename)) {
                await makeBibsonomyRequest('DELETE', onlineAttachment.href);
            }
        }
        // Upload new files
        for (const attachment of allItemAttachments) {
            const filename = (attachment as any).getFilename();
            if (!onlineFilenames.has(filename)) {
                await uploadFileToEntry(user, responseText.resourcehash, attachment.id);
            }
        }
    } else {
        // Case 3: Ambiguous filenames, use (inefficient) fallback
        ztoolkit.log(`Ambiguous filenames, use (inefficient) fallback`);
        await deleteAllFilesFromEntry(responseText.resourcehash);
        await uploadAllFilesToEntry(user, responseText.resourcehash, item, progressCallback);
    }

    return getEntry(responseText.resourcehash) as Promise<BibsonomyPost>;
}

/**
 * Deletes an entry from BibSonomy.
 * 
 * @param username - The BibSonomy username.
 * @param intrahash - The intrahash of the entry to delete.
 * @throws {Error} If the deletion fails.
 */
async function deleteEntry(username: string, intrahash: string): Promise<void> {
    const url = `${Zotero[config.addonInstance].data.baseURL}/api/users/${username}/posts/${intrahash}?format=json`;
    await makeBibsonomyRequest('DELETE', url);
    ztoolkit.log(`Successfully deleted entry with intrahash: ${intrahash}`);
}

/**
 * Uploads all files attached to a Zotero item to a specific entry in BibSonomy.
 * 
 * @param username - The username for the BibSonomy API.
 * @param resourcehash - The resource hash of the BibSonomy entry.
 * @param item - The Zotero item containing the attachments to upload.
 */
async function uploadAllFilesToEntry(username: string, resourcehash: string, item: Zotero.Item, progressCallback?: (message: string, progress: number) => void) {
    const attachments = item.getAttachments();
    //TODO: This should be replaced with a callback, as in the initial sync to keep frontend and backend decoupled
    // const popup = show_upload_progress ? new ztoolkit.ProgressWindow(config.addonName).createLine({
    //     text: getString("progress-upload-files-text", { args: { title: item.getField('title') } }),
    //     progress: 0
    // }).show(-1) : null;

    progressCallback?.(getString("progress-upload-files-text", { args: { title: item.getField('title') } }), 0);
    let count = 0;
    for (const attachmentID of attachments) {
        try {
            const attachment = Zotero.Items.get(attachmentID);

            // Skip non-attachment items and non-PDF files
            if (!attachment.isAttachment() || typeof attachment.getFilePath() !== 'string' || (attachment.getFilePath() as string).split('.').pop() !== 'pdf') continue;

            await uploadFileToEntry(username, resourcehash, attachmentID);
            count++;
            // popup?.changeLine({
            //     text: `Uploaded: ${attachment.getField('title')}`,
            //     progress: count / attachments.length
            // });
            progressCallback?.(getString("progress-upload-files-text", { args: { title: item.getField('title') } }), count / attachments.length);
        } catch (error: any) {
            ztoolkit.log(`Error uploading file ${attachmentID}: ${error}`);
            throw error;
        }
    }
    addAttachmentsSyncdateToItem(item, new Date().toISOString());
    // popup?.close();
}


/**
 * Uploads a file attachment to a BibSonomy entry.
 * @param username - The username of the BibSonomy user.
 * @param resourcehash - The hash of the BibSonomy resource.
 * @param attachmentID - The ID of the attachment to upload.
 */
async function uploadFileToEntry(username: string, resourcehash: string, attachmentID: number) {
    const attachment = Zotero.Items.get(attachmentID);
    if (!attachment.isAttachment()) return;

    const path = await attachment.getFilePathAsync() as string;
    const file = Zotero.File.pathToFile(path);
    const data = await IOUtils.read(path);
    const blob = new Blob([data], { type: 'application/octet-stream' });

    const multipart = new FormData();
    multipart.append('file', blob, file.leafName);

    const url = `${Zotero[config.addonInstance].data.baseURL}/api/users/${username}/posts/${resourcehash}/documents?format=json`;
    await makeBibsonomyRequest('POST', url, multipart);
    ztoolkit.log(`File uploaded successfully: ${file.leafName}`);
}


/**
 * Deletes all files from an entry in BibSonomy.
 * 
 * @param resourcehash - The resource hash of the entry.
 */
async function deleteAllFilesFromEntry(resourcehash: string) {
    try {
        const post = await getEntry(resourcehash);
        const attachments = post.documents?.document || [];
        ztoolkit.log(`Deleting files from entry: ${resourcehash}`, `Attachments: ${JSON.stringify(attachments)}`);

        for (const attachment of attachments) {
            await makeBibsonomyRequest('DELETE', attachment.href);
        }
    } catch (error: any) {
        ztoolkit.log(`Error deleting files from entry: ${resourcehash}`);
        throw error;
    }
}

