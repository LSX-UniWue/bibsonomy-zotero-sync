# Zotero Plugin Template

[![zotero target version](https://img.shields.io/badge/Zotero-7-green?style=flat-square&logo=zotero&logoColor=CC2936)](https://www.zotero.org)

[![bibsonomy target version](https://img.shields.io/badge/Bibsonomy-4-blue?style=flat-square&logoColor=CC2936&logo=data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiPz48c3ZnIGlkPSJhIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA3MDIuMzYgODYzLjUxIj48ZGVmcz48c3R5bGU+LmIsLmN7c3Ryb2tlLXdpZHRoOjBweDt9LmN7ZmlsbDojYTQwMDNkO308L3N0eWxlPjwvZGVmcz48cGF0aCBjbGFzcz0iYiIgZD0iTTExOC43LDEwNi45NWMyNi4wMSwwLDQ3LjA5LDIxLjA4LDQ3LjA5LDQ3LjA5cy0yMS4wOCw0Ny4wOS00Ny4wOSw0Ny4wOS00Ny4wOS0yMS4wOC00Ny4wOS00Ny4wOSwyMS4wOC00Ny4wOSw0Ny4wOS00Ny4wOU0xMTguNyw4OC45NWMtMzUuODksMC02NS4wOSwyOS4yLTY1LjA5LDY1LjA5czI5LjIsNjUuMDksNjUuMDksNjUuMDksNjUuMDktMjkuMiw2NS4wOS02NS4wOS0yOS4yLTY1LjA5LTY1LjA5LTY1LjA5aDBaIi8+PHBhdGggY2xhc3M9ImIiIGQ9Ik0zOTUuNTcsMTQ2LjljMjYuMDEsMCw0Ny4wOSwyMS4wOCw0Ny4wOSw0Ny4wOXMtMjEuMDgsNDcuMDktNDcuMDksNDcuMDktNDcuMDktMjEuMDgtNDcuMDktNDcuMDksMjEuMDgtNDcuMDksNDcuMDktNDcuMDlNMzk1LjU3LDEyOC45Yy0zNS44OSwwLTY1LjA5LDI5LjItNjUuMDksNjUuMDlzMjkuMiw2NS4wOSw2NS4wOSw2NS4wOSw2NS4wOS0yOS4yLDY1LjA5LTY1LjA5LTI5LjItNjUuMDktNjUuMDktNjUuMDloMFoiLz48cGF0aCBjbGFzcz0iYiIgZD0iTTYxNC45MywxOGMyNi4wMSwwLDQ3LjA5LDIxLjA4LDQ3LjA5LDQ3LjA5cy0yMS4wOCw0Ny4wOS00Ny4wOSw0Ny4wOS00Ny4wOS0yMS4wOC00Ny4wOS00Ny4wOSwyMS4wOC00Ny4wOSw0Ny4wOS00Ny4wOU02MTQuOTMsMGMtMzUuODksMC02NS4wOSwyOS4yLTY1LjA5LDY1LjA5czI5LjIsNjUuMDksNjUuMDksNjUuMDksNjUuMDktMjkuMiw2NS4wOS02NS4wOVM2NTAuODIsMCw2MTQuOTMsMGgwWiIvPjxwYXRoIGNsYXNzPSJiIiBkPSJNNjE0LjkzLDI3NC42NGMyNi4wMSwwLDQ3LjA5LDIxLjA4LDQ3LjA5LDQ3LjA5cy0yMS4wOCw0Ny4wOS00Ny4wOSw0Ny4wOS00Ny4wOS0yMS4wOC00Ny4wOS00Ny4wOSwyMS4wOC00Ny4wOSw0Ny4wOS00Ny4wOU02MTQuOTMsMjU2LjY0Yy0zNS44OSwwLTY1LjA5LDI5LjItNjUuMDksNjUuMDlzMjkuMiw2NS4wOSw2NS4wOSw2NS4wOSw2NS4wOS0yOS4yLDY1LjA5LTY1LjA5LTI5LjItNjUuMDktNjUuMDktNjUuMDloMFoiLz48cGF0aCBjbGFzcz0iYyIgZD0iTTM5NS41Nyw1MTAuNDljLTMwLjkzLDAtNTYuMDktMjUuMTYtNTYuMDktNTYuMDlzMjUuMTYtNTYuMDksNTYuMDktNTYuMDksNTYuMDksMjUuMTYsNTYuMDksNTYuMDktMjUuMTYsNTYuMDktNTYuMDksNTYuMDlaIi8+PHBhdGggY2xhc3M9ImIiIGQ9Ik0zOTUuNTcsNDA3LjNjMjYuMDEsMCw0Ny4wOSwyMS4wOCw0Ny4wOSw0Ny4wOXMtMjEuMDgsNDcuMDktNDcuMDksNDcuMDktNDcuMDktMjEuMDgtNDcuMDktNDcuMDksMjEuMDgtNDcuMDksNDcuMDktNDcuMDlNMzk1LjU3LDM4OS4zYy0zNS44OSwwLTY1LjA5LDI5LjItNjUuMDksNjUuMDlzMjkuMiw2NS4wOSw2NS4wOSw2NS4wOSw2NS4wOS0yOS4yLDY1LjA5LTY1LjA5LTI5LjItNjUuMDktNjUuMDktNjUuMDloMFoiLz48cGF0aCBjbGFzcz0iYiIgZD0iTTY1LjA5LDYzMS4wNWMyNi4wMSwwLDQ3LjA5LDIxLjA4LDQ3LjA5LDQ3LjA5cy0yMS4wOCw0Ny4wOS00Ny4wOSw0Ny4wOS00Ny4wOS0yMS4wOC00Ny4wOS00Ny4wOSwyMS4wOC00Ny4wOSw0Ny4wOS00Ny4wOU02NS4wOSw2MTMuMDVjLTM1Ljg5LDAtNjUuMDksMjkuMi02NS4wOSw2NS4wOXMyOS4yLDY1LjA5LDY1LjA5LDY1LjA5LDY1LjA5LTI5LjIsNjUuMDktNjUuMDktMjkuMi02NS4wOS02NS4wOS02NS4wOWgwWiIvPjxwYXRoIGNsYXNzPSJiIiBkPSJNMjg4Ljg1LDYyMi4yMmMyNi4wMSwwLDQ3LjA5LDIxLjA4LDQ3LjA5LDQ3LjA5cy0yMS4wOCw0Ny4wOS00Ny4wOSw0Ny4wOS00Ny4wOS0yMS4wOC00Ny4wOS00Ny4wOSwyMS4wOC00Ny4wOSw0Ny4wOS00Ny4wOU0yODguODUsNjA0LjIyYy0zNS44OSwwLTY1LjA5LDI5LjItNjUuMDksNjUuMDlzMjkuMiw2NS4wOSw2NS4wOSw2NS4wOSw2NS4wOS0yOS4yLDY1LjA5LTY1LjA5LTI5LjItNjUuMDktNjUuMDktNjUuMDloMFoiLz48cGF0aCBjbGFzcz0iYiIgZD0iTTYzNy4yNiw3NTEuMzJjMjYuMDEsMCw0Ny4wOSwyMS4wOCw0Ny4wOSw0Ny4wOXMtMjEuMDgsNDcuMDktNDcuMDksNDcuMDktNDcuMDktMjEuMDgtNDcuMDktNDcuMDksMjEuMDgtNDcuMDksNDcuMDktNDcuMDlNNjM3LjI2LDczMy4zMmMtMzUuODksMC02NS4wOSwyOS4yLTY1LjA5LDY1LjA5czI5LjIsNjUuMDksNjUuMDksNjUuMDksNjUuMDktMjkuMiw2NS4wOS02NS4wOS0yOS4yLTY1LjA5LTY1LjA5LTY1LjA5aDBaIi8+PHJlY3QgY2xhc3M9ImIiIHg9IjQ5Ni4zOCIgeT0iNjguMDMiIHdpZHRoPSIxOS4zNiIgaGVpZ2h0PSIxMjcuNDIiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDM1Ni4zMiAtMzY5LjI5KSByb3RhdGUoNTguNzcpIi8+PHJlY3QgY2xhc3M9ImIiIHg9IjQ5NS41NyIgeT0iMzI0LjQ2IiB3aWR0aD0iMTkuMzYiIGhlaWdodD0iMTI3LjQyIiB0cmFuc2Zvcm09InRyYW5zbGF0ZSg1NzUuMiAtMjQ1LjEyKSByb3RhdGUoNTguNzcpIi8+PHJlY3QgY2xhc3M9ImIiIHg9IjI0Ni41OSIgeT0iMTYyLjE3IiB3aWR0aD0iMTkuMzYiIGhlaWdodD0iMjg2LjA2IiB0cmFuc2Zvcm09InRyYW5zbGF0ZSg2NTEuODUgMzUzLjYpIHJvdGF0ZSgxMzcpIi8+PHJlY3QgY2xhc3M9ImIiIHg9IjM4NS44OSIgeT0iMjU4LjAyIiB3aWR0aD0iMTkuMzYiIGhlaWdodD0iMTM1LjAxIi8+PHJlY3QgY2xhc3M9ImIiIHg9IjYwNS4yNSIgeT0iMTI2LjQ5IiB3aWR0aD0iMTkuMzYiIGhlaWdodD0iMTM1LjAxIi8+PHJlY3QgY2xhc3M9ImIiIHg9IjMzMi41OCIgeT0iNDkzLjQiIHdpZHRoPSIxOS4zNiIgaGVpZ2h0PSIxMzUuMDEiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDI4OS41NyAtOTQuMDYpIHJvdGF0ZSgyNi43OSkiLz48cmVjdCBjbGFzcz0iYiIgeD0iMjIzLjQ0IiB5PSI0MjIuNjEiIHdpZHRoPSIxOS4zNiIgaGVpZ2h0PSIyODUuMDMiIHRyYW5zZm9ybT0idHJhbnNsYXRlKDU3MC4wNCA1NS4wMykgcm90YXRlKDU1Ljg2KSIvPjxyZWN0IGNsYXNzPSJiIiB4PSI1MDguMDgiIHk9IjQ3Ny43NyIgd2lkdGg9IjE5LjM2IiBoZWlnaHQ9IjMwMS41MyIgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTMwMy40MiA4NDIuNzIpIHJvdGF0ZSgxNDQuNzMpIi8+PC9zdmc+)](https://www.bibsonomy.org)


[![Using Zotero Plugin Template](https://img.shields.io/badge/Using-Zotero%20Plugin%20Template-blue?style=flat-square&logo=github)](https://github.com/windingwind/zotero-plugin-template)

This is a plugin for [Zotero](https://www.zotero.org/), connecting Zotero seemlessly with [BibSonomy](https://www.bibsonomy.org/).

## Features


## Developement Quick Start Guide

### 0 Requirement

1. Install a beta version of Zotero: <https://www.zotero.org/support/beta_builds>
2. Install [Node.js](https://nodejs.org/en/) and [Git](https://git-scm.com/)
3. Clone this repo

   ```sh
   git clone TODO
   cd zotero-plugin-template
   ```

### 1 Setup Zotero Dev Enviroment

1. Copy zotero command line config file. Modify the commands that starts your installation of the beta Zotero.

   > (Optional) Do this only once: Start the beta Zotero with `/path/to/zotero -p`. Create a new profile and use it as your development profile.
   > Put the path of the profile into the `profilePath` in `zotero-cmd.json` to specify which profile to use.

   ```sh
   cp ./scripts/zotero-cmd-template.json ./scripts/zotero-cmd.json
   vim ./scripts/zotero-cmd.json
   ```

2. Install dependencies with `npm install`

### 2 Coding

Start development server with `npm start`, it will:

- Prebuild the plugin in development mode
- Start Zotero with plugin loaded from `build/`
- Open devtool
- Watch `src/**` and `addon/**`.
  - If `src/**` changed, run esbuild and reload
  - If `addon/**` has changed, rebuild the plugin (in development mode) and reload

### 4 Build

Run `npm run build` to build the plugin in production mode, and the xpi for installation and the built code is under `build` folder.

Steps in `scripts/build.mjs`:

- Create/empty `build/`.
- Copy `addon/**` to `build/addon/**`
- Replace placeholders: use `replace-in-file` to replace keywords and configurations defined in `package.json` in non-build files (`xhtml`, `json`, et al.).
- Prepare locale files to [avoid conflict](https://www.zotero.org/support/dev/zotero_7_for_developers#avoiding_localization_conflicts)
  - Rename `**/*.flt` to `**/${addonRef}-*.flt`
  - Prefix each fluent message with `addonRef-`
- Use Esbuild to build `.ts` source code to `.js`, build `src/index.ts` to `./build/addon/chrome/content/scripts`.
- (Production mode only) Zip the `./build/addon` to `./build/*.xpi`
- (Production mode only) Prepare `update.json` or `update-beta.json`

> [!note]
>
> **What's the difference between dev & prod?**
>
> - This environment variable is stored in `Zotero.${addonInstance}.data.env`. The outputs to console is disabled in prod mode.
> - You can decide what users cannot see/use based on this variable.
> - In production mode, the build script will pack the plugin and update the `update.json`.

### 5 Release

To build and release, use

```shell
# A release-it command: version increase, npm run build, git push, and GitHub release
# release-it: https://github.com/release-it/release-it
npm run release
```

> [!note]
> In this template, release-it is configured to locally bump the version, build, and push commits and git.tags, subsequently GitHub Action will rebuild the plugin and publish the XPI to GitHub Release.
>
> If you need to release a locally built XPI, set `release-it.github.release` to `true` in `package.json` and remove `.github/workflows/release.yml`. Besides that, you need to set the environment variable `GITHUB_TOKEN`, get it in <https://github.com/settings/tokens>.

#### About Prerelease

The template defines `prerelease` as the beta version of the plugin, when you select a `prerelease` version in release-it (with `-` in the version number), the build script will create a new `update-beta.json` for prerelease use, which ensures that users of the regular version won't be able to update to the beta, only users who have manually downloaded and installed the beta will be able to update to the next beta automatically. When the next regular release is updated, both `update.json` and `update-beta.json` will be updated so that both regular and beta users can update to the new regular release.

> [!warning]
> Strictly, distinguishing between Zotero 6 and Zotero 7 compatible plugin versions should be done by configuring `applications.zotero.strict_min_version` in `addons.__addonID__.updates[]` of `update.json` respectively, so that Zotero recognizes it properly, see <https://www.zotero.org/support/dev/zotero_7_for_developers#updaterdf_updatesjson>.


### Directory Structure

This section shows the directory structure of a template.

- All `.js/.ts` code files are in `./src`;
- Addon config files: `./addon/manifest.json`;
- UI files: `./addon/chrome/content/*.xhtml`.
- Locale files: `./addon/locale/**/*.flt`;
- Preferences file: `./addon/prefs.js`;
  > Don't break the lines in the `prefs.js`

```shell
.
|-- .eslintrc.json            # eslint conf
|-- .gitattributes            # git conf
|-- .github/                  # github conf
|-- .gitignore                # git conf
|-- .prettierrc               # prettier conf
|-- .release-it.json          # release-it conf
|-- .vscode                   # vs code conf
|   |-- extensions.json
|   |-- launch.json
|   |-- setting.json
|   `-- toolkit.code-snippets
|-- package-lock.json         # npm conf
|-- package.json              # npm conf
|-- LICENSE
|-- README.md
|-- addon
|   |-- bootstrap.js               # addon load/unload script, like a main.c
|   |-- chrome
|   |   `-- content
|   |       |-- icons/
|   |       `-- preferences.xhtml  # preference panel
|   |-- locale                     # locale
|   |   `-- en-US
|   |       |-- addon.ftl
|   |       `-- preferences.ftl
|   |-- manifest.json              # addon config
|   `-- prefs.js
|-- build/                         # build dir
|-- scripts                        # scripts for dev
|   |-- build.mjs                      # script to build plugin
|   |-- scripts.mjs                    # scripts send to Zotero, such as reload, openDevTool, etc
|   |-- server.mjs                     # script to start a development server
|   |-- start.mjs                      # script to start Zotero process
|   |-- stop.mjs                       # script to kill Zotero process
|   |-- utils.mjs                      # utils functions for dev scripts
|   |-- update-template.json      # template of `update.json`
|   `-- zotero-cmd-template.json  # template of local env
|-- src                           # source code
|   |-- addon.ts                  # base class
|   |-- hooks.ts                  # lifecycle hooks
|   |-- index.ts                  # main entry
|   |-- modules                   # sub modules
|   |   |-- bibsonomy_calls.ts
|   |   |-- connector.ts
|   |   `-- preferenceScript.ts
|   |-- types                    # types TODO: move to typings
|   |   |-- bibsonomy.ts
|   |   `-- errors.ts
|   `-- utils                     # utilities
|       |-- locale.ts
|       |-- prefs.ts
|       |-- wait.ts
|       `-- window.ts
|-- tsconfig.json                 # https://code.visualstudio.com/docs/languages/jsconfig
|-- typings                       # ts typings
|   `-- global.d.ts
`-- update.json
```

## Disclaimer
This plugin is not affiliated with or endorsed by Zotero and developed by the BibSonomy team. It is provided as is, without any guarantee or warranty. Use at your own risk.

## BibSonomy

[BibSonomy](https://www.bibsonomy.org/) is a social bookmark and publication sharing system. 

It is developed and operated by 
the [Data Science Chair](https://www.informatik.uni-wuerzburg.de/datascience/home/) at the University of WÃ¼rzburg, Germany,
the [Information Processing and Analytics Group](https://www.ibi.hu-berlin.de/en/research/Information-processing/) at the Humboldt-UniversitÃ¤t zu Berlin, Germany,
the [Knowledge & Data Engineering Group](https://www.kde.cs.uni-kassel.de/) at the University of Kassel, Germany, and
the [L3S Research Center](https://www.l3s.de/) at Leibniz University Hannover, Germany.

