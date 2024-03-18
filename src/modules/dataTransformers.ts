
import { config } from "../../package.json";

export {
    createBibsonomyPostFromItem,
    parseBibsonomyToZotero,
    generateBibtexKey,
    mapZoteroItemType,
    mapBibsonomyTypeToZotero
}
/**
 * Parses a Zotero item to a Bibsonomy post structure, including normalized tags.
 * @param item The Zotero item to parse.
 * @param username The username for the Bibsonomy account.
 * @param group The group to which the post belongs.
 * @returns A BibsonomyPost object ready for posting or updating.
 */
function createBibsonomyPostFromItem(item: Zotero.Item, username: string, group: string): BibsonomyPost {
    const bibtex = parseZoteroToBibsonomy(item);
    const normalizedTags = item.getTags().map(tag => ({ "name": tag.tag.replace(/\s/g, "_") }));
    if (normalizedTags.filter(tag => tag.name === config.postTag).length === 0) {
        normalizedTags.push({ "name": config.postTag });
    }

    return {
        user: { name: username },
        group: [{ name: group }],
        tag: normalizedTags,
        bibtex: bibtex
    };
}

/**
 * Parses a Zotero item into a BibsonomyBibtex object.
 * @param item The Zotero item to parse.
 * @returns The parsed BibsonomyBibtex object.
 */
function parseZoteroToBibsonomy(item: Zotero.Item): BibsonomyBibtex {
    const zoteroMetadata = `
    ---------------------------
    -Zotero Sync Item Metadata-
    ------Do not modify!-------
    ItemID: ${item.getField('id')}
    ---------------------------
    `;

    const parsedDate = Zotero.Date.strToDate(item.getField('date')) as { year?: number, month?: number, day?: number };
    const bibtex = {
        bibtexKey: generateBibtexKey(item),
        title: item.getField('title'),
        author: item.getCreators().map((creator) => creator.lastName + ', ' + creator.firstName).join(" and "),
        entrytype: mapZoteroItemType(item.itemType),
        misc: (item.getField('DOI') ? ' doi = {' + item.getField('DOI') + '}' : ''),
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
        note: item.getField('extra'),
        number: item.getField('issue'),
        pages: item.getField('pages'),
        publisher: item.getField('publisher'),
        school: item.getField('university'),
        series: item.getField('series'),
        volume: item.getField('volume'),
        year: parsedDate.year !== undefined ? parsedDate.year.toString() : undefined,
        month: parsedDate.month !== undefined ? (parsedDate.month + 1).toString() : undefined, //FIXME: Check why month is 0-indexed
        day: parsedDate.day !== undefined ? parsedDate.day.toString() : undefined,
        type: item.getField('type'),
        url: item.getField('url'),
        // Use the privnote field to store the Zotero item key //TODO: Should any other metadata be stored here?
        privnote: zoteroMetadata
    } as BibsonomyBibtex;
    ztoolkit.log(`Parsed Zotero item to Bibsonomy Bibtex: ${JSON.stringify(bibtex)}`);
    return bibtex;
}


function parseBibsonomyToZotero(bibtex: BibsonomyBibtex): Zotero.Item {
    const itemType = mapBibsonomyTypeToZotero(bibtex.entrytype);
    const item = new Zotero.Item(itemType);

    const zoteroMetadata = bibtex.privnote || '';
    const zoteroID = zoteroMetadata.match(/ItemID: (.*)/)?.[1] || '';

    // Set the basic fields
    item.setField('id', zoteroID || '')
    item.setField('title', bibtex.title);
    item.setField('abstractNote', bibtex.bibtexAbstract || '');
    item.setField('place', bibtex.address || '');
    item.setField('publicationTitle', bibtex.booktitle || '');
    item.setField('section', bibtex.chapter || '');
    item.setField('edition', bibtex.edition || '');
    item.setField('manuscriptType', bibtex.howpublished || '');
    item.setField('institution', bibtex.institution || '');
    item.setField('journalAbbreviation', bibtex.journal || '');
    item.setField('issue', bibtex.number || '');
    item.setField('pages', bibtex.pages || '');
    item.setField('publisher', bibtex.publisher || '');
    item.setField('university', bibtex.school || '');
    item.setField('series', bibtex.series || '');
    item.setField('volume', bibtex.volume || '');
    item.setField('type', bibtex.type || '');
    item.setField('url', bibtex.url || '');

    // Date handling
    if (bibtex.year || bibtex.month || bibtex.day) {
        let dateStr = bibtex.year;
        if (bibtex.month) {
            dateStr += '-' + bibtex.month.padStart(2, '0'); // Ensuring two digits
        }
        if (bibtex.day) {
            dateStr += '-' + bibtex.day.padStart(2, '0'); // Ensuring two digits
        }
        item.setField('date', dateStr || '');
    }

    // Authors and creators
    if (bibtex.author) {
        const authors = bibtex.author.split(' and ').map((name) => {
            const [lastName, firstName] = name.split(', ').map(part => part.trim());
            return { firstName, lastName, creatorTypeID: 8 };
        }) as Zotero.Item.Creator[];
        item.setCreators(authors);
    }

    // Extra and misc fields
    const extra = bibtex.misc ? bibtex.misc : '';
    const doi = bibtex.misc?.match(/doi = {(.*)}/)?.[1] || '';
    const cleanedExtra = extra.replace(/\n doi = {.*}/, ''); // Remove DOI from extra

    item.setField('extra', cleanedExtra);
    item.setField('DOI', doi);

    // TODO: Handle any fields that are not directly mapped or need special handling
    // For example, 'crossref', 'editor', and 'note' might require custom logic or API usage.


    //TODO: Get all attached files and upload them to the entry

    return item;
}

/**
 * Generates a normalized BibTeX key for a Zotero item.
 * The key format is AuthorYear-FirstWordOfTitle. If the citationKey field is populated,
 * that value is used instead. Handles items with missing authors, dates, or titles gracefully.
 * 
 * @param item The Zotero item from which to generate a BibTeX key.
 * @returns A string representing the BibTeX key.
 */
function generateBibtexKey(item: Zotero.Item): string {
    // Use existing citationKey if available
    const existingKey = item.getField('citationKey');
    if (existingKey) return existingKey;

    // Extract the first author's last name
    let authorLastName = item.getCreators().map(creator => creator.lastName)[0] || 'UnknownAuthor';
    //Make non ASCII characters ASCII
    authorLastName = authorLastName.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
    // Extract the publication year
    const publicationYear = (Zotero.Date.strToDate(item.getField('date')) as { year?: number, month?: number, day?: number }).year || 'NoYear';
    // Extract the first word of the title
    const firstWordOfTitle = item.getField('title').split(" ")[0] || 'Untitled';

    return `${authorLastName}${publicationYear}${firstWordOfTitle}`;
}

/**
 * Maps a Zotero item type to a BibTeX entry type.
 * 
 * @param zoteroType - The Zotero item type to be mapped.
 * @returns The corresponding BibTeX entry type.
 */
function mapZoteroItemType(zoteroType: Zotero.Item.ItemType): string {
    //TODO: Implement mapping from Zotero item types to BibTeX entry types
    return zoteroType; // Placeholder for now
}


function mapBibsonomyTypeToZotero(entryType: string): keyof Zotero.Item.ItemTypeMapping {
    //TODO: Implement mapping from BibTeX entry types to Zotero item types
    // Simple logic for now: Check if the entry type is a valid Zotero item type, otherwise use 'journalArticle'    
    const parsedType = Zotero.ItemTypes.getAll().find((type) => {
        if (Zotero.ItemTypes.getLocalizedString(type.name) === entryType) {
            return true;
        }
    });

    if (parsedType) {
        ztoolkit.log(`Mapped BibSonomy entry type ${entryType} to Zotero item type ${JSON.stringify(parsedType)}`);
        const itemType = parsedType.id as keyof Zotero.Item.ItemTypeMapping;
        return itemType;
    } else {
        return 21; //TODO: Change to a more generic type
    }
}
