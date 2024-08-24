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

import { UnauthorizedError, DuplicateItemError, PostNotFoundError, InvalidFormatError } from '../types/errors';
import { config } from "../../package.json";
import { createBibsonomyPostFromItem } from './dataTransformers';
import { getString } from '../utils/locale';
import { addAttachmentsSyncdateToItem } from './synchronizationLogic';


export { postEntry, updateBibsonomyPost, getEntry, deleteEntry, uploadAllFilesToEntry, uploadFileToEntry, deleteAllFilesFromEntry, deleteFileFromEntry, handleHttpResponseError };

// Necessary due to the way Zotero handles imports
Components.utils.importGlobalProperties(['FormData']);


/**
 * Makes a request to the BibSonomy API.
 * @param method - The HTTP method to use for the request ('POST' or 'PUT').
 * @param url - The URL to send the request to.
 * @param data - The data to send in the request body.
 * @param username - The username for authentication.
 * @param apikey - The API key for authentication.
 * @returns A promise that resolves to the response from the Bibsonomy API.
 */
async function makeBibsonomyRequest(method: 'POST' | 'PUT', url: string, data: any, username: string, apikey: string): Promise<BibSonomyPostResponse> {
    const response = await fetch(url, {
        method: method,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(username + ':' + apikey)
        },
        body: JSON.stringify(data)
    });
    if (!response.ok) {
        await handleHttpResponseError(response, method, url);
    }
    try {
        const data = await response.json();
        if (!data || typeof data !== 'object' || !('resourcehash' in data)) {
            throw new InvalidFormatError('Unexpected response format from Bibsonomy API');
        }
        return data as unknown as BibSonomyPostResponse;
    } catch (error) {
        if (error instanceof SyntaxError) {
            throw new InvalidFormatError('Failed to parse Bibsonomy API response: ' + JSON.stringify(data));
        }
        throw error;
    }
}

/**
 * Posts an entry to Bibsonomy.
 * 
 * @param item - The Zotero item to be posted.
 * @param username - The Bibsonomy username.
 * @param apikey - The Bibsonomy API key.
 * @param group - The Bibsonomy group.
 * @returns A promise that resolves to the posted Bibsonomy entry.
 */
async function postEntry(item: Zotero.Item, username: string, apikey: string, group: string): Promise<BibsonomyPost> {
    const post = createBibsonomyPostFromItem(item, username, group);
    ztoolkit.log(`Posting entry: ${JSON.stringify(post)}`);
    const responseText = await makeBibsonomyRequest('POST', `${Zotero[config.addonInstance].data.baseURL}/api/users/${username}/posts`, { "post": post }, username, apikey);
    // We don't wait for the function to finish, as this can take quite some time and doesn't need to be synchronous
    uploadAllFilesToEntry(username, apikey, responseText.resourcehash!, item);
    return getEntry(username, apikey, responseText.resourcehash) as Promise<BibsonomyPost>;
}


/**
 * Fetches a BibSonomy entry with the specified resourcehash.
 * @param username - The username for authentication.
 * @param apikey - The API key for authentication.
 * @param resourcehash - The resourcehash of the entry to fetch.
 * @returns A Promise that resolves to the fetched BibSonomy post.
 */
async function getEntry(username: string, apikey: string, resourcehash: string): Promise<BibsonomyPost> {
    ztoolkit.log(`Fetching BibSonomy entry with resourcehash: ${resourcehash}`);

    const url = `${Zotero[config.addonInstance].data.baseURL}/api/users/${username}/posts/${resourcehash}?format=json`;
    const response = await fetch(url, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(username + ':' + apikey)
        }
    });

    if (!response.ok) {
        await handleHttpResponseError(response, 'GET', url);
    }

    const data = await response.json();
    if (!data || typeof data !== 'object' || !('post' in data)) {
        throw new InvalidFormatError('Unexpected response format from Bibsonomy API: ' + JSON.stringify(data));
    }
    return data.post as BibsonomyPost;
}

/**
 * Deletes an entry from BibSonomy.
 * 
 * @param username - The BibSonomy username.
 * @param apikey - The BibSonomy API key.
 * @param intrahash - The intrahash of the entry to delete.
 * @throws {Error} If the deletion fails.
 */
async function deleteEntry(username: string, apikey: string, intrahash: string): Promise<void> {
    const url = `${Zotero[config.addonInstance].data.baseURL}/api/users/${username}/posts/${intrahash}`;

    const response = await fetch(url, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(username + ':' + apikey)
        },
    });

    if (!response.ok) {
        await handleHttpResponseError(response, 'DELETE', url);
    }

    ztoolkit.log(`Successfully deleted entry with intrahash: ${intrahash}`);
}

/**
 * Updates a Bibsonomy post with the given item, intrahash, username, apikey, and group.
 * @param item - The Zotero item to update the Bibsonomy post with.
 * @param intrahash - The intrahash of the Bibsonomy post.
 * @param username - The username of the Bibsonomy user.
 * @param apikey - The API key of the Bibsonomy user.
 * @param group - The group of the Bibsonomy post.
 * @returns A promise that resolves to the updated Bibsonomy post.
 */
async function updateBibsonomyPost(item: Zotero.Item, updatedAttachments: Zotero.Item[], intrahash: string, username: string, apikey: string, group: string): Promise<BibsonomyPost> {
    const post = createBibsonomyPostFromItem(item, username, group);
    const url = `${Zotero[config.addonInstance].data.baseURL}/api/users/${username}/posts/${intrahash}?format=json`;
    const responseText = await makeBibsonomyRequest('PUT', url, { "post": post }, username, apikey);

    const currentEntry = await getEntry(username, apikey, responseText.resourcehash);
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
                await deleteFileFromEntry(username, apikey, onlineAttachment.href);
                await uploadFileToEntry(username, apikey, responseText.resourcehash, attachment.id);
            }
        }
    } else if ([...allItemFilenames].every(filename => !onlineFilenames.has(filename)) &&
        [...onlineFilenames].every(filename => !allItemFilenames.has(filename))) {
        // Case 2: Attachments added/deleted offline, but filenames are unambiguous
        ztoolkit.log(`Attachments added/deleted offline, unambiguous filenames`);
        // Delete files that are no longer present locally
        for (const onlineAttachment of currentAttachments) {
            if (!allItemFilenames.has(onlineAttachment.filename)) {
                await deleteFileFromEntry(username, apikey, onlineAttachment.href);
            }
        }
        // Upload new files
        for (const attachment of allItemAttachments) {
            const filename = (attachment as any).getFilename();
            if (!onlineFilenames.has(filename)) {
                await uploadFileToEntry(username, apikey, responseText.resourcehash, attachment.id);
            }
        }
    } else {
        // Case 3: Ambiguous filenames, use (inefficient) fallback
        ztoolkit.log(`Ambiguous filenames, use (inefficient) fallback`);
        await deleteAllFilesFromEntry(username, apikey, responseText.resourcehash);
        await uploadAllFilesToEntry(username, apikey, responseText.resourcehash, item);
    }

    return getEntry(username, apikey, responseText.resourcehash) as Promise<BibsonomyPost>;
}


/**
 * Uploads all files attached to a Zotero item to a specific entry in BibSonomy.
 * 
 * @param username - The username for the BibSonomy API.
 * @param apikey - The API key for the BibSonomy API.
 * @param resourcehash - The resource hash of the BibSonomy entry.
 * @param item - The Zotero item containing the attachments to upload.
 */
async function uploadAllFilesToEntry(username: string, apikey: string, resourcehash: string, item: Zotero.Item) {
    const attachments = item.getAttachments();
    const popup = new ztoolkit.ProgressWindow(config.addonName).createLine({
        text: getString("progress-upload-files-text", { args: { title: item.getField('title') } }),
        progress: 0
    }).show(-1);

    let count = 0;
    for (const attachmentID of attachments) {
        try {
            const attachment = Zotero.Items.get(attachmentID);

            // Skip non-attachment items and non-PDF files
            if (!attachment.isAttachment() || typeof attachment.getFilePath() !== 'string' || (attachment.getFilePath() as string).split('.').pop() !== 'pdf') continue;

            await uploadFileToEntry(username, apikey, resourcehash, attachmentID);
            count++;
            popup.changeLine({
                text: `Uploaded: ${attachment.getField('title')}`,
                progress: count / attachments.length
            });
        } catch (error: any) {
            ztoolkit.log(`Error uploading file ${attachmentID}: ${error}`);
            throw error;
        }
    }
    addAttachmentsSyncdateToItem(item, new Date().toISOString());
    popup.close();
}


/**
 * Uploads a file attachment to a BibSonomy entry.
 * @param username - The username of the BibSonomy user.
 * @param apikey - The API key of the BibSonomy user.
 * @param resourcehash - The hash of the BibSonomy resource.
 * @param attachmentID - The ID of the attachment to upload.
 */
async function uploadFileToEntry(username: string, apikey: string, resourcehash: string, attachmentID: number) {
    try {
        const attachment = Zotero.Items.get(attachmentID);
        if (!attachment.isAttachment()) return;

        const path = await attachment.getFilePathAsync() as string;
        const file = Zotero.File.pathToFile(path);
        const data = await IOUtils.read(path);
        const blob = new Blob([data], { type: 'application/octet-stream' });

        const multipart = new FormData();
        multipart.append('file', blob, file.leafName);

        const url = `${Zotero[config.addonInstance].data.baseURL}/api/users/${username}/posts/${resourcehash}/documents?format=json`;
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + btoa(username + ':' + apikey) },
            body: multipart
        });

        if (!response.ok) handleHttpResponseError(response, 'POST', url);
        ztoolkit.log(`File uploaded successfully: ${file.leafName}`);
    } catch (error: any) {
        ztoolkit.log(`Error uploading file ${attachmentID}: ${error}`);
        throw error;
    }
}


/**
 * Deletes all files from an entry in BibSonomy.
 * 
 * @param username - The username of the BibSonomy user.
 * @param apikey - The API key of the BibSonomy user.
 * @param resourcehash - The resource hash of the entry.
 */
async function deleteAllFilesFromEntry(username: string, apikey: string, resourcehash: string) {
    try {
        const post = await getEntry(username, apikey, resourcehash);
        const attachments = post.documents?.document || [];
        ztoolkit.log(`Deleting files from entry: ${resourcehash}`, `Attachments: ${JSON.stringify(attachments)}`);

        for (const attachment of attachments) {
            await deleteFileFromEntry(username, apikey, attachment.href);
        }
    } catch (error: any) {
        ztoolkit.log(`Error deleting files from entry: ${resourcehash}`);
        throw error;
    }
}


/**
 * Deletes a file from an entry on BibSonomy.
 * 
 * @param username - The username for authentication.
 * @param apikey - The API key for authentication.
 * @param documentURL - The URL of the document to delete.
 */
async function deleteFileFromEntry(username: string, apikey: string, documentURL: string) {
    try {
        const response = await fetch(documentURL, {
            method: 'DELETE',
            headers: { Authorization: 'Basic ' + btoa(username + ':' + apikey) },
        });

        if (!response.ok) handleHttpResponseError(response, 'DELETE', documentURL);
        ztoolkit.log(`File deleted successfully: ${documentURL}`);
    } catch (error: any) {
        ztoolkit.log(`Error deleting file ${documentURL}: ${error}`);
        throw error;
    }
}

/**
 * Handles the error response from an BibSonomy HTTP request.
 * @param response - The response object from the HTTP request.
 * @throws {UnauthorizedError} If the response status is 401 (Unauthorized).
 * @throws {DuplicateItemError} If the response status is 400 (Bad Request) and the error message indicates a duplicate item.
 * @throws {PostNotFoundError} If the response status is 404 (Not Found).
 * @throws {Error} If the response status is not one of the above and an unexpected API error occurs.
 */
async function handleHttpResponseError(response: Response, method?: string, url?: string): Promise<void> {
    if (method && url) ztoolkit.log(`Error in ${method} request to URL response: ${url} with status: ${response.status}`);
    else ztoolkit.log(`Error in request to URL response: ${response.url} with status: ${response.status}`);
    let errorMessage = "Unknown error";
    try {
        const errorResponse = await response.json() as { error?: string };
        errorMessage = errorResponse.error || errorMessage;
    } catch (e) {
        // If parsing JSON fails, use the response text if available
        errorMessage = await response.text() || errorMessage;
    }
    switch (response.status) {
        case 401: throw new UnauthorizedError();
        case 400:
            if (errorMessage.startsWith("Could not create new BibTex: This BibTex already exists in your collection")) {
                ztoolkit.log(`Duplicate item detected: ${errorMessage}`);
                throw new DuplicateItemError();
            };
            ztoolkit.log(`Unexpected API error: ${response.status} ${response.statusText} - ${errorMessage}`);
            throw new Error(`Unexpected API error: ${response.status} ${response.statusText} - ${errorMessage}`);
        case 404:
            ztoolkit.log(`Post not found: ${errorMessage}`);
            throw new PostNotFoundError();
        default:
            ztoolkit.log(`Unexpected API error: ${response.status} ${response.statusText} - ${errorMessage}`);
            throw new Error(`Unexpected API error: ${response.status} ${response.statusText} - ${errorMessage}`);
    }
}
