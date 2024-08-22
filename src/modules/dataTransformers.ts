
import { config } from "../../package.json";
const emoji = require("emoji-dictionary");

export {
    createBibsonomyPostFromItem,
    parseBibsonomyToZotero,
    generateBibtexKey,
    mapZoteroToBibtexType as mapZoteroItemType,
    mapBibtexToZoteroType as mapBibsonomyTypeToZotero
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
    const normalizedTags = item.getTags().map(tag => ({
        "name": convertEmojiToString(tag.tag.replace(/\s/g, "_"))
    }));
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
 * Replaces all emojis in a string with their text representations.
 * 
 * @param {string} inputString - The input string containing emojis.
 * @returns {string} The string with emojis replaced by their text representations.
 */
function convertEmojiToString(inputString: string): string {
    // Regular expression to match emoji characters
    const emojiRegex = /(\p{Emoji_Presentation}|\p{Emoji}\uFE0F)/gu;

    // Replace each emoji with its text representation
    return inputString.replace(emojiRegex, (match) => {
        const emojiName = emoji.getName(match);
        return emojiName ? `:${emojiName}:` : match;
    });
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
        bibtexKey: sanitizeBibtex(generateBibtexKey(item)),
        title: sanitizeBibtex(item.getField('title')),
        author: item.getCreators().map((creator) =>
            sanitizeBibtex(creator.lastName) + ', ' + sanitizeBibtex(creator.firstName)
        ).join(" and "),
        entrytype: sanitizeBibtex(mapZoteroToBibtexType(item.itemType)),
        misc: item.getField('DOI') ? ' doi = {' + sanitizeBibtex(item.getField('DOI')) + '}' : '',
        bibtexAbstract: sanitizeBibtex(item.getField('abstractNote')),
        address: sanitizeBibtex(item.getField('place')),
        booktitle: sanitizeBibtex(item.getField('publicationTitle')),
        chapter: sanitizeBibtex(item.getField('section')),
        edition: sanitizeBibtex(item.getField('edition')),
        howpublished: sanitizeBibtex(item.getField('manuscriptType')),
        institution: sanitizeBibtex(item.getField('institution')),
        journal: sanitizeBibtex(item.getField('journalAbbreviation')),
        note: sanitizeBibtex(item.getField('extra')),
        number: sanitizeBibtex(item.getField('issue')),
        pages: sanitizeBibtex(item.getField('pages')),
        publisher: sanitizeBibtex(item.getField('publisher')),
        school: sanitizeBibtex(item.getField('university')),
        series: sanitizeBibtex(item.getField('series')),
        volume: sanitizeBibtex(item.getField('volume')),
        year: parsedDate.year !== undefined ? sanitizeBibtex(parsedDate.year.toString()) : "n/a",
        month: parsedDate.month !== undefined ? sanitizeBibtex((parsedDate.month + 1).toString()) : undefined,
        day: parsedDate.day !== undefined ? sanitizeBibtex(parsedDate.day.toString()) : undefined,
        type: sanitizeBibtex(item.getField('type')),
        url: sanitizeBibtex(item.getField('url')),
        privnote: sanitizeBibtex(zoteroMetadata)
    } as BibsonomyBibtex;

    if (bibtex.author === "" && (!bibtex.editor || bibtex.editor === "")) {
        bibtex.author = "Unknown Author";
    }

    ztoolkit.log(`Parsed Zotero item to Bibsonomy Bibtex: ${JSON.stringify(bibtex)}`);
    return bibtex;
}


/**
 * Sanitizes a string for use in BibTeX and converts emojis to string format.
 * @param text The input string to sanitize.
 * @returns The sanitized string with emojis converted to string format.
 */
function sanitizeBibtex(text: string): string {
    if (!text) return '';

    // First, replace emojis with their text representations
    let sanitized = convertEmojiToString(text);

    // Then, apply the other sanitization steps
    return sanitized
        .replace(/[&%$#_{}~^\\]/g, '\\$&')  // Escape special LaTeX characters
        .replace(/[^\x20-\x7E]/g, char => {  // Replace remaining non-ASCII characters with LaTeX commands
            const code = char.charCodeAt(0);
            return code > 127 ? `\\char${code}` : char;
        });
}

/**
 * Parses a BibsonomyBibtex object into a Zotero item.
 * @param bibtex The BibsonomyBibtex object to parse.
 * @returns The parsed Zotero item.
 */
function parseBibsonomyToZotero(bibtex: BibsonomyBibtex): Zotero.Item {
    const itemType = mapBibtexToZoteroType(bibtex.entrytype);
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
 * Maps a Zotero item type to one of the 14 BibTeX entry types
 * 
 * @param zoteroType - The Zotero item type to be mapped.
 * @returns The corresponding BibTeX entry type.
 */
function mapZoteroToBibtexType(zoteroType: Zotero.Item.ItemType): string {
    switch (zoteroType) {
        case "journalArticle":
        case "magazineArticle":
        case "newspaperArticle":
            return "article";
        case "book":
            return "book";
        case "bookSection":
            return "inbook";
        case "conferencePaper":
            return "inproceedings";
        case "report":
        case "preprint":
            return "techreport";
        case "thesis":
            return "phdthesis";
        case "manuscript":
            return "unpublished";
        case "computerProgram":
            return "manual";
        case "presentation":
            return "conference";
        case "document":
        case "encyclopediaArticle":
        case "dictionaryEntry":
            return "incollection";
        default:
            return "misc"; // Default to misc for any types not specifically mapped
    }
}


/**
 * Maps a BibTeX entry type to a Zotero item type.
 * Since this is a lossy mapping it should only be used if absolutely necessary
 * 
 * @param entryType - The BibTeX entry type to be mapped.
 * @returns The corresponding Zotero item type as a key of Zotero.Item.ItemTypeMapping.
 */
function mapBibtexToZoteroType(entryType: string): keyof Zotero.Item.ItemTypeMapping {
    switch (entryType.toLowerCase()) {
        case "article":
            return 21; // journalArticle
        case "book":
            return 7; // book
        case "booklet":
            return 24; // manuscript
        case "conference":
        case "inproceedings":
            return 11; // conferencePaper
        case "inbook":
        case "incollection":
            return 8; // bookSection
        case "manual":
            return 10; // computerProgram
        case "mastersthesis":
        case "phdthesis":
            return 35; // thesis
        case "proceedings":
            return 13; // document
        case "techreport":
            return 33; // report
        case "unpublished":
            return 30; // preprint
        default:
            return 13; // document as the most generic default
    }
}
