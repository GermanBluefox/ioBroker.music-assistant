/*!
 * Build of the browser parts of ioBroker.music-assistant
 *
 *   src-admin/          -> admin/custom/            the "Players" tab of the instance settings (Module Federation)
 *   src-webcomponents/  -> admin/webcomponents/     the web component <iob-ma-player> for vis-2, devices, Aura, admin
 *   src-widgets/        -> widgets/music-assistant/ the native vis-2 widget set (Module Federation)
 *   src-devices/        -> admin/dm-widgets/        the native ioBroker.devices widgets (Module Federation)
 *
 * `npm run build:admin`, `build:wc`, `build:widgets` and `build:devices` build one each, `build:gui` all of them.
 * The results are committed instead of being rebuilt on install or in CI: rebuild and commit the destination
 * whenever something in its source folder changed.
 *
 * The native widgets carry the same name as the web component. vis-2 and ioBroker.devices then show only the
 * native one in their palette, so the web component is left for hosts without a native widget (Aura, admin).
 *
 * Run straight from source (`node tasks.mts`) by the type stripping of node, so it must stay free of
 * syntax a compiler would have to rewrite (`enum`, `namespace`, parameter properties).
 */
import { existsSync } from 'node:fs';
import { buildReact, copyFiles, deleteFoldersRecursive, npmInstall } from '@iobroker/build-tools';

/** Directory of this file, and with it the root of the adapter */
const ROOT: string = import.meta.dirname;
/** Directory of the JsonConfig custom component */
const SRC_ADMIN = `${ROOT}/src-admin`;
/** Directory of the web components */
const SRC_WC = `${ROOT}/src-webcomponents`;
/** Served as `/adapter/music-assistant/webcomponents/`; must match `common.webComponents` */
const WC_DEST = 'admin/webcomponents/';
/** Directory of the vis-2 widgets */
const SRC_WIDGETS = `${ROOT}/src-widgets`;
/** Directory of the ioBroker.devices widgets */
const SRC_DEVICES = `${ROOT}/src-devices`;

async function installIfNeeded(dir: string): Promise<void> {
    if (!existsSync(`${dir}/node_modules`)) {
        await npmInstall(dir);
    }
}

/**
 * Copies the built component into `admin/custom/`.
 *
 * `mf-manifest.json` is copied on purpose: admin reads it next to the remote entry to decide from the
 * shared modules which GUI API generation the component was built against.
 */
function copyAdmin(): void {
    copyFiles(['src-admin/build/**/*', '!src-admin/build/index.html'], 'admin/custom/');
    copyFiles(['src-admin/src/i18n/*.json'], 'admin/custom/i18n');
}

async function buildAdmin(): Promise<void> {
    deleteFoldersRecursive(`${ROOT}/admin/custom`);
    deleteFoldersRecursive(`${SRC_ADMIN}/build`);
    await installIfNeeded(SRC_ADMIN);
    await buildReact(SRC_ADMIN, { rootDir: SRC_ADMIN, vite: true });
    copyAdmin();
}

/**
 * Builds the web components: one ES module and its manifest each (`ma-player.js`, `ma-player.json`).
 * The destination is emptied first, so no module of an earlier build is published with the next release.
 */
async function buildWebComponents(): Promise<void> {
    deleteFoldersRecursive(`${ROOT}/${WC_DEST}`);
    deleteFoldersRecursive(`${SRC_WC}/build`);
    await installIfNeeded(SRC_WC);
    await buildReact(SRC_WC, { rootDir: SRC_WC, vite: true });
    copyFiles(['src-webcomponents/build/*.js', 'src-webcomponents/build/*.json'], WC_DEST);
}

/**
 * Builds the vis-2 widget set into `widgets/music-assistant/`, which is uploaded into the file storage of
 * vis-2 - see `common.visWidgets` in io-package.json.
 *
 * `mf-manifest.json` is kept: vis-2 reads it to decide whether the set was built against a compatible React.
 */
async function buildWidgets(): Promise<void> {
    deleteFoldersRecursive(`${ROOT}/widgets`);
    deleteFoldersRecursive(`${SRC_WIDGETS}/build`);
    await installIfNeeded(SRC_WIDGETS);
    // `rootDir` is the adapter: its version is copied into src-widgets/package.json
    await buildReact(SRC_WIDGETS, { rootDir: ROOT, vite: true });
    copyFiles(['src-widgets/build/**/*', '!src-widgets/build/index.html'], 'widgets/music-assistant/');
}

/**
 * Builds the ioBroker.devices widgets into `admin/dm-widgets/`, from where the devices adapter loads them -
 * see `common.deviceWidgets` in io-package.json. The palette icons and the translations go next to them.
 */
async function buildDevices(): Promise<void> {
    deleteFoldersRecursive(`${ROOT}/admin/dm-widgets`);
    deleteFoldersRecursive(`${SRC_DEVICES}/build`);
    await installIfNeeded(SRC_DEVICES);
    await buildReact(SRC_DEVICES, { rootDir: SRC_DEVICES, vite: true });
    copyFiles(['src-devices/build/**/*', '!src-devices/build/index.html'], 'admin/dm-widgets/');
    copyFiles(['src-devices/img/**/*'], 'admin/dm-widgets');
    copyFiles(['src-devices/src/i18n/*.json'], 'admin/dm-widgets/i18n');
}

async function buildAll(): Promise<void> {
    await buildAdmin();
    await buildWebComponents();
    await buildWidgets();
    await buildDevices();
}

function selectBuild(): () => Promise<void> {
    if (process.argv.includes('--all')) {
        return buildAll;
    }
    if (process.argv.includes('--wc')) {
        return buildWebComponents;
    }
    if (process.argv.includes('--widgets')) {
        return buildWidgets;
    }
    if (process.argv.includes('--devices')) {
        return buildDevices;
    }
    return buildAdmin;
}

selectBuild()().catch((e: unknown) => {
    console.error(`Cannot build: ${e as string}`);
    process.exit(2);
});
