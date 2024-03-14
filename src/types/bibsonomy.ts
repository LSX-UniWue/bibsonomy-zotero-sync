// This file is used to declare the types of the Bibsonomy API response.
interface BibsonomyPost {
    user: string;
    group: { name: string }[];
    tag: { name: string }[];
    bibtex: BibsonomyBibtex;
    description?: string;
    // Generated fields
    readonly postingdate?: string; // TODO: Consider using a custom Date type or library
    readonly changedate?: string;  // TODO: Consider using a custom Date type or library
}

interface BibsonomyBibtex {
    bibtexKey: string;
    title: string;
    author: string; // Needs formatting of multiple authors
    entrytype: string; // Map from Zotero's itemType
    bKey?: string;
    misc?: string;
    bibtexAbstract?: string;
    address?: string;
    annote?: string;
    booktitle?: string;
    chapter?: string;
    crossref?: string;
    edition?: string;
    editor?: string;
    howpublished?: string;
    institution?: string;
    organization?: string;
    journal?: string;
    note?: string;
    number?: string;
    pages?: string;
    publisher?: string;
    school?: string;
    series?: string;
    volume?: string;
    day?: string;
    month?: string;
    year?: string;
    type?: string;
    url?: string;
    privnote?: string;
    // Generated fields
    readonly intrahash?: string; //Equals the "resourcehash"
    readonly interhash?: string;
    readonly href?: string;
}

interface BibSonomyPostResponse {
    readonly resourcehash: string;
    readonly stat: string;
}
