## Developement Quick Start Guide

_(Adapted from the Zotero Plugin Templates [README.md](https://github.com/windingwind/zotero-plugin-template?tab=readme-ov-file#quick-start-guide))_

### 0 Requirement

1. Install a beta version of Zotero: <https://www.zotero.org/support/beta_builds>
2. Install [Node.js](https://nodejs.org/en/) and [Git](https://git-scm.com/)
3. Clone this repo

   ```sh
   git clone https://github.com/LSX-UniWue/bibsonomy-zotero-sync.git
   cd bibsonomy-zotero-sync
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

>[!NOTE]
> In the `dev` environment [biblicious.org](https://biblicious.org) is used as the development server so make sure you have access to it! 

>[!NOTE]
> As any `log` statements are automatically removed in production mode, you can feel free to be rather verbose with `ztoolkit.log` statements during development.

>[!WARNING]
>If the plugin crashes during development, you need to fully close Zotero before running `npm start` again! Otherwise hot reloading will not work!

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