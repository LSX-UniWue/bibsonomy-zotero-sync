# Bibsonomy Zotero Sync Plugin

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)
[![bibsonomy target version](https://custom-icon-badges.demolab.com/badge/Bibsonomy-4-blue?style=flat-square&logo=bibsonomy)](https://www.bibsonomy.org)
[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

This is a plugin for [Zotero](https://www.zotero.org/), connecting Zotero seemlessly with [BibSonomy](https://www.bibsonomy.org/).

## Features

## Working: 
- [x] Sync item from Zotero to BibSonomy, including PDF attachments
- [x] Update item in BibSonomy if it is updated in Zotero, including PDF attachments 
- [x] Automatically sync items when they are added or updated
- [x] Delete item in BibSonomy if it is deleted in Zotero

## TODOs

MVP: 
- [x] Implement get Share URL for a publication
- [x] Use privNote to link to the item in BibSonomy
- [x] Only show sync button if manual sync is enabled
- [x] Move server URL to config
- [x] Add listeners for item updates and deletions
- [x] Add listeners to pdf attachment updates
- [ ] Add sync on startup and shutdown
- [ ] Add a feature list

Next:
- [ ] Find way to export the PDFs with Annotations
- [ ] Add mechanism to update local items from server
- [ ] Add mechanism to merge local and server items
- [ ] Add folder support
- [ ] Delete local items if they are deleted on the server (or ask the user)
    - [ ] Add no sync option (via tag or collection)

## About BibSonomy

[BibSonomy](https://www.bibsonomy.org/) is a social bookmark and publication sharing system. 

It is developed and operated by 
the [Data Science Chair](https://www.informatik.uni-wuerzburg.de/datascience/home/) at the University of Würzburg, Germany,
the [Information Processing and Analytics Group](https://www.ibi.hu-berlin.de/en/research/Information-processing/) at the Humboldt-Universität zu Berlin, Germany,
the [Knowledge & Data Engineering Group](https://www.kde.cs.uni-kassel.de/) at the University of Kassel, Germany, and
the [L3S Research Center](https://www.l3s.de/) at Leibniz University Hannover, Germany.

## Disclaimer
This plugin is not affiliated with or endorsed by Zotero and developed by the BibSonomy team. It is provided as is, without any guarantee or warranty. Use at your own risk.