/*!
 * Build of the JsonConfig custom component of ioBroker.music-assistant
 *
 *   src-admin/  -> admin/custom/   the "Players" tab of the instance settings (Module Federation)
 *
 * `npm run build:admin` builds it. Module federation pre-builds the whole shared GUI stack and takes
 * a while, so the result is committed instead of being rebuilt on install or in CI: rebuild and
 * commit admin/custom/ whenever something under src-admin/ changed.
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
    if (!existsSync(`${SRC_ADMIN}/node_modules`)) {
        await npmInstall(SRC_ADMIN);
    }
    await buildReact(SRC_ADMIN, { rootDir: SRC_ADMIN, vite: true });
    copyAdmin();
}

buildAdmin().catch((e: unknown) => {
    console.error(`Cannot build: ${e as string}`);
    process.exit(2);
});
