# Bibsonomy Zotero Sync Plugin

<p align="center">
  <a href="https://www.zotero.org"><img src="https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936" alt="zotero target version"></a>
  <a href="https://www.bibsonomy.org"><img src="https://custom-icon-badges.demolab.com/badge/Bibsonomy-4-blue?style=flat-square&logo=bibsonomy" alt="bibsonomy target version"></a>
  <a href="https://github.com/windingwind/zotero-plugin-template"><img src="https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github" alt="Using Zotero Plugin Template"></a>
</p>

This is a plugin for [Zotero](https://www.zotero.org/), connecting Zotero seamlessly with [BibSonomy](https://www.bibsonomy.org/).

## Features

- Sync items from Zotero to BibSonomy ✅
- Update items in BibSonomy if they are updated in Zotero ✅
- Automatically sync items when they are added or updated ✅
- Delete items in BibSonomy if they are deleted in Zotero ✅
- Get Share URL for a publication ✅


## Working: 
- [x] Sync item from Zotero to BibSonomy, including PDF attachments
- [x] Update item in BibSonomy if it is updated in Zotero, including PDF attachments 
- [x] Automatically sync items when they are added or updated
- [x] Delete item in BibSonomy if it is deleted in Zotero

## TODOs

Minimal Viable Product: 
- [ ] Change URL to biblicious when in Dev Mode 
- [ ] Fix URL clipboard copying 
- [ ] Clean up notification messages to a useful amount
- [x] Implement get Share URL for a publication
- [x] Use privNote to link to the item in BibSonomy
- [x] Only show sync button if manual sync is enabled
- [x] Move server URL to config
- [x] Add listeners for item updates and deletions
- [x] Add listeners to pdf attachment updates
- [x] Add sync on startup and shutdown
- [ ] Write Zotero/Bibsonomy Type mapping
- [ ] Handle Emojis in tags and other fields -> Use :emoji: encoding
- [ ] Reorganize methods to minimize cross-file dependencies
- [ ] Standardize error handling
- [ ] Standardize logging
- [ ] Localize all strings
- [x] Move repo to DMIR Account
- [ ] Add a feature list

## Development
If you want to contribute to this plugin, please have a look at the [Development Guide](./DEVELOPMENT.md).

## About BibSonomy

[BibSonomy](https://www.bibsonomy.org/) is a social bookmark and publication sharing system. 

It is developed and operated by 
the [Data Science Chair](https://www.informatik.uni-wuerzburg.de/datascience/home/) at the University of Würzburg, Germany,
the [Information Processing and Analytics Group](https://www.ibi.hu-berlin.de/en/research/Information-processing/) at the Humboldt-Universität zu Berlin, Germany,
the [Knowledge & Data Engineering Group](https://www.kde.cs.uni-kassel.de/) at the University of Kassel, Germany, and
the [L3S Research Center](https://www.l3s.de/) at Leibniz University Hannover, Germany.

## Disclaimer
This plugin is not affiliated with or endorsed by Zotero and developed by the BibSonomy team. It is provided as is, without any guarantee or warranty. Use at your own risk.