import { config } from "../../package.json";
import { BibSonomyPost, BibsonomyBibtex, BibSonomyPostResponse } from '../types/bibsonomy'; //TODO Check this
import { UnauthorizedError, DuplicateItemError } from '../types/errors';

export { postEntry, getEntry, addMetadataToEntry };

Components.utils.importGlobalProperties(['FormData']);

async function postEntry(item: Zotero.Item, username: string, apikey: string, group: string): BibSonomyPost {
    const bibtex = parseZoteroToBibsonomy(item);
    ztoolkit.log(`Parsed Bibtex entry: ${JSON.stringify(bibtex)}`)

    const normalizedTags = item.getTags().map((tag) => { return { "name": tag.tag.replace(/\s/g, "_") } });

    const post = {
        user: { name: username },
        group: [{ name: group }],
        tag: normalizedTags,
        bibtex: bibtex
    } as BibSonomyPost;

    const data = {
        "post": post
    }


    ztoolkit.log(`Posting data: ${JSON.stringify(data)}`);

    const response = await fetch(`https://www.bibsonomy.org/api/users/${username}/posts`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(username + ':' + apikey)
        },
        body: JSON.stringify(data)
    });

    ztoolkit.log(`Made POST request to URL response: ${response.url} with status: ${response.status}`);

    if (!response.ok) { // Check for HTTP errors first
        // Parsing the response body to get the error message
        const errorResponse = await response.json();
        const errorMessage = errorResponse.error || "Unknown error";
        if (response.status === 401) {
            throw new UnauthorizedError();
        } else if (response.status === 400 && errorMessage.startsWith("Could not create new BibTex: This BibTex already exists in your collection")) {
            throw new DuplicateItemError();
        } else {
            throw new Error(`Unexpected API error: ${response.status} ${response.statusText}`);
        }
    }

    const responseText = await response.json() as BibSonomyPostResponse;
    ztoolkit.log(`Response text: ${JSON.stringify(responseText)}`);

    const generatedPost = await getEntry(username, apikey, responseText.resourcehash) as BibSonomyPost;

    ztoolkit.log(`Generated post: ${JSON.stringify(generatedPost)}`);

    //Get all attached files and upload them to the entry
    const attachments = item.getAttachments();
    const popup = new ztoolkit.ProgressWindow(config.addonName).createLine({
        text: `Uploading attachments for ${item.getField('title')}`,
        progress: 0
    }).show(-1);
    let count = 0;
    for (const attachmentID of attachments) {
        const attachment = Zotero.Items.get(attachmentID);
        if (!attachment.isAttachment()) {
            ztoolkit.log(`Skipping non-attachment item: ${attachment.getField('title')}`);
            continue;
        }
        const filePath = attachment.getFilePath();
        if (!filePath) {
            ztoolkit.log(`Skipping attachment without file path: ${attachment.getField('title')}`);
            continue;
        }
        ztoolkit.log(`Uploading attachment: ${filePath}`);
        await uploadFileToEntry(username, apikey, "generatedPost.bibtex.intrahash", attachmentID);
        count++;
        popup.changeLine({
            text: `Uploaded attachment: ${attachment.getField('title')}`,
            progress: count / attachments.length
        });
    }

    await addMetadataToEntry(item, "synced", generatedPost.bibtex.interhash, generatedPost.bibtex.intrahash); //TODO Change synced to a config variable
    ztoolkit.log(`Added metadata to item: ${item.getField('title')}`);

    return generatedPost;
}


async function uploadFileToEntry(username: string, apikey: string, resourcehash: string, attachmentID: number) {
    try {
        const attachment = Zotero.Items.get(attachmentID);

        if (!attachment.isAttachment() || attachment.getFilePath() === false) {
            ztoolkit.log(`Skipping non-attachment item: ${attachment.getField('title')}`);
            return;
        }

        const path = (await attachment.getFilePathAsync()) as string
        const file = Zotero.File.pathToFile(path);

        const data = await Zotero.File.getBinaryContentsAsync(path);

        const blob = new Blob([data], { type: 'application/octet-stream' });

        const multipart = new FormData();
        multipart.append('file', blob, file.leafName);

        const attachFileUrl = `https://www.bibsonomy.org/api/users/${username}/posts/${resourcehash}/documents?format=json`;
        // const attachFileUrl = `http://127.0.0.1:5000/upload`;
        const headers = {
            'Authorization': 'Basic ' + btoa(username + ':' + apikey),
        };

        const response = await fetch(attachFileUrl, {
            method: 'POST',
            headers: headers,
            body: multipart
        });

        if (response.ok) {
            ztoolkit.log('File uploaded successfully', await response.text());
        } else {
            ztoolkit.log('Upload failed', await response.text());
        }
    } catch (error) {
        ztoolkit.log(`Error uploading file: ${error}`);
        ztoolkit.log(error.stack);
        throw new Error(`Error uploading file: ${error}`);
    }
}


async function getEntry(username: string, apikey: string, resourcehash: string): BibSonomyPost {
    // Attention: This method assumes that the resourcehash is valid, exists, is accessible and is a BibTeX entry
    ztoolkit.log(`Fetching BibSonomy entry with resourcehash: ${resourcehash}`);
    const response = await fetch(`https://www.bibsonomy.org/api/users/${username}/posts/${resourcehash}`, {
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Basic ' + btoa(username + ':' + apikey)
        }
    });

    if (!response.ok) {
        if (response.status === 401) {
            throw new UnauthorizedError();
        } else {
            throw new Error(`Unexpected API error: ${response.status} ${response.statusText}`);
        }
    }

    ztoolkit.log(`Response text: ${JSON.stringify(response)}`);
    const data = await response.json();
    return data.post as BibSonomyPost;
}

async function addMetadataToEntry(item: Zotero.Item, postingTag: string, interhash: string, intrahash: string) {
    //Add the posting tag to the item in Zotero
    if (!item.hasTag(postingTag)) {
        ztoolkit.log(`Adding tag ${postingTag} to item: ${item.getField('title')}`);
        item.addTag(postingTag);
        await item.saveTx();
    }

    let noteItem = new Zotero.Item('note');
    const noteContent = `
            ---------  BibSonomy Metadata  ---------\n
            ---Do not change or delete this note!---\n
            interhash: ${interhash}\n
            intrahash: ${intrahash}\n
            ----------------------------------------
        `;

    // Check if the item already has a BibSonomy note
    const noteID = item.getNotes().find((noteID) => {
        const note = Zotero.Items.get(noteID);
        const noteContent = note.getNote();
        ztoolkit.log(`Note content: ${noteContent}`);
        return noteContent.includes('BibSonomy Metadata');
    });
    if (noteID) {
        ztoolkit.log(`Found existing BibSonomy note with ID: ${noteID}`);
        noteItem = Zotero.Items.get(noteID)
    } else {
        ztoolkit.log('No existing BibSonomy note found, creating a new one');
    }

    noteItem.setNote(noteContent);
    noteItem.parentID = item.id;
    ztoolkit.log(`Note content: ${noteItem.getNote()}`);

    await noteItem.saveTx();
}


function parseZoteroToBibsonomy(item: Zotero.Item): BibsonomyBibtex {
    const parsedDate = Zotero.Date.strToDate(item.getField('date'));
    const post: BibsonomyBibtex = {
        bibtexKey: generateBibtexKey(item),
        title: item.getField('title'),
        author: item.getCreators().map((creator) => creator.lastName + ', ' + creator.firstName).join(" and "),
        entrytype: mapZoteroItemType(item.itemType),
        misc: item.getField('extra'),
        bibtexAbstract: item.getField('abstractNote'),
        address: item.getField('place'),
        booktitle: item.getField('publicationTitle'),
        chapter: item.getField('section'),
        // crossref: null, //TODO: Is this a field in Zotero?
        edition: item.getField('edition'),
        // editor: null, //TODO: Should be possible via roles
        howpublished: item.getField('manuscriptType'),
        institution: item.getField('institution'),
        // organization: item.getField(''),
        journal: item.getField('journalAbbreviation'),
        // note: null; //TODO: Is possible via getNotes etc., but not a direct field
        number: item.getField('issue'),
        pages: item.getField('pages'),
        publisher: item.getField('publisher'),
        school: item.getField('university'),
        series: item.getField('series'),
        volume: item.getField('volume'),
        year: parsedDate.year !== undefined ? parsedDate.year.toString() : null,
        month: parsedDate.month !== undefined ? parsedDate.month.toString() : null,
        day: parsedDate.day !== undefined ? parsedDate.day.toString() : null,
        type: item.getField('type'),
        url: item.getField('url'),
        //privnote: null //TODO: Does this exist in Zotero?
    };

    return post;
}

// Helper Functions
function mapZoteroItemType(zoteroType: Zotero.Item.ItemType): string {
    //TODO: Implement mapping from Zotero item types to BibTeX entry types
    return zoteroType; // Placeholder for now
}

function generateBibtexKey(item: Zotero.Item): string {
    //Generates a normalized BibTeX key in the AuthorYear-FirstWordOfTitle format
    if (item.getField('citationKey') && item.getField('citationKey') !== "") {
        return item.getField('citationKey');
    }

    const author = item.getCreators().map((creator) => creator.lastName)[0];
    const date = Zotero.Date.strToDate(item.getField('date'));
    const year = date.year !== undefined ? date.year.toString() : "";
    const title = item.getField('title').split(" ")[0];
    return `${author}${year}-${title}`;
}