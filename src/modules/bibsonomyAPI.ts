import { UnauthorizedError, DuplicateItemError, PostNotFoundError } from '../types/errors';
import { config } from "../../package.json";
import { logError, logProgress } from '../utils/logging';
import { createBibsonomyPostFromItem } from './dataTransformers';

export { postEntry, updateBibsonomyPost, getEntry, uploadAllFilesToEntry, uploadFileToEntry, deleteAllFilesFromEntry, deleteFileFromEntry };

Components.utils.importGlobalProperties(['FormData']);


/**
 * Makes a request to the BibSonomy API.
 * @param method - The HTTP method to use for the request ('POST' or 'PUT').
 * @param url - The URL to send the request to.
 * @param data - The data to send in the request body.
 * @param username - The username for authentication.
 * @param apikey - The API key for authentication.
 * @returns A promise that resolves to the response from the BibSonomy API.
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

    ztoolkit.log(`Made ${method} request to URL response: ${response.url} with status: ${response.status}`);

    if (!response.ok) {
        // Extracted error handling
        ztoolkit.log(`Error in ${method} request to URL response: ${response.url} with status: ${response.status}`);
        await handleHttpResponseError(response);
    }
    ztoolkit.log(`Request successful: ${response.url} Status: ${response.status}`);
    return await response.json() as BibSonomyPostResponse;
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
    const data = { "post": post };
    const responseText = await makeBibsonomyRequest('POST', `${config.bibsonomyBaseURL}/api/users/${username}/posts`, data, username, apikey);

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
    const logContext = `Fetching BibSonomy entry with resourcehash: ${resourcehash}`;
    ztoolkit.log(logContext);

    const headers = {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(username + ':' + apikey)
    }

    const response = await fetch(`${config.bibsonomyBaseURL}/api/users/${username}/posts/${resourcehash}?format=json`, {
        headers: headers
    });

    if (!response.ok) {
        await handleHttpResponseError(response);
    }

    const data = await response.json();
    ztoolkit.log(`GET request successful: ${response.url} Status: ${response.status}`);

    return data.post as BibsonomyPost;
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
async function updateBibsonomyPost(item: Zotero.Item, intrahash: string, username: string, apikey: string, group: string): Promise<BibsonomyPost> {
    const post = createBibsonomyPostFromItem(item, username, group);
    const data = { "post": post };
    const responseText = await makeBibsonomyRequest('PUT', `${config.bibsonomyBaseURL}/api/users/${username}/posts/${intrahash}`, data, username, apikey);

    deleteAllFilesFromEntry(username, apikey, responseText.resourcehash);
    uploadAllFilesToEntry(username, apikey, responseText.resourcehash, item);
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
    const title = item.getField('title');
    const popup = new ztoolkit.ProgressWindow(config.addonName).createLine({
        text: `Uploading attachments for ${title}`,
        progress: 0
    }).show(-1);

    let count = 0;
    for (const attachmentID of attachments) {
        try {
            const attachment = Zotero.Items.get(attachmentID);
            if (!attachment.isAttachment() || typeof attachment.getFilePath() !== 'string' || (attachment.getFilePath() as string).split('.').pop() !== 'pdf') continue;

            await uploadFileToEntry(username, apikey, resourcehash, attachmentID);
            count++;
            popup.changeLine({
                text: `Uploaded: ${attachment.getField('title')}`,
                progress: count / attachments.length
            });
        } catch (error: any) {
            logError(error, `uploading file ${attachmentID}`);
        }
    }
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

        const response = await fetch(`${config.bibsonomyBaseURL}/api/users/${username}/posts/${resourcehash}/documents?format=json`, {
            method: 'POST',
            headers: { 'Authorization': 'Basic ' + btoa(username + ':' + apikey) },
            body: multipart
        });

        if (!response.ok) throw new Error(await response.text());
        logProgress('File uploaded successfully', file.leafName);
    } catch (error: any) {
        logError(error, `uploading file ${attachmentID}`);
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
        logProgress(`Deleting files from entry: ${resourcehash}`, `Attachments: ${JSON.stringify(attachments)}`);

        for (const attachment of attachments) {
            await deleteFileFromEntry(username, apikey, attachment.href);
        }
    } catch (error: any) {
        logError(error, 'clearing files from entry');
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

        if (!response.ok) throw new Error(`Deletion failed: ${response.status} ${response.statusText}`);
        logProgress('File deleted successfully', documentURL);
    } catch (error: any) {
        logError(error, 'deleting file');
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
async function handleHttpResponseError(response: Response): Promise<void> {
    const errorResponse = await response.json();
    const errorMessage = errorResponse.error || "Unknown error";
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
