import { expect } from 'chai';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * vis-2 and ioBroker.devices hide a web component from their palette when a native widget of the same adapter
 * has the same name. The player exists three times - web component, vis-2 widget, devices widget - and the
 * hosts must show only the native one, so the names have to stay equal in every language.
 */
const ROOT = join(__dirname, '..', '..');

function readJson<T>(file: string): T {
    return JSON.parse(readFileSync(join(ROOT, file), 'utf8')) as T;
}

interface DeviceWidget {
    name: string;
    label: Record<string, string>;
}

const manifest = readJson<{ name: Record<string, string> }>('admin/webcomponents/ma-player.json');
const ioPackage = readJson<{
    common: {
        visWidgets: Record<string, { components: string[]; url: string }>;
        deviceWidgets: { components: DeviceWidget[] };
    };
}>('io-package.json');
const languages = Object.keys(manifest.name);

describe('widget names', () => {
    it('the web component is named in all languages', () => {
        expect(languages).to.have.length(11);
    });

    it('the vis-2 widget has the name of the web component', () => {
        // label of the widget: `mawidgets_` + `visWidgetLabel` (`player`), the prefix is added at runtime
        const source = readFileSync(join(ROOT, 'src-widgets/src/MaPlayer.tsx'), 'utf8');
        expect(source).to.include("visWidgetLabel: 'player'");
        // vis-2 compares within one set, and the set of a web component is the adapter
        expect(source).to.include("visSet: 'music-assistant'");
        for (const lang of languages) {
            const i18n = readJson<Record<string, string>>(`src-widgets/src/i18n/${lang}.json`);
            expect(i18n.player, lang).to.equal(manifest.name[lang]);
        }
    });

    it('the devices widget has the name of the web component', () => {
        const widget = ioPackage.common.deviceWidgets.components.find(c => c.name === 'MaPlayerComponent');
        expect(widget).to.exist;
        for (const lang of languages) {
            expect(widget!.label[lang], lang).to.equal(manifest.name[lang]);
            const i18n = readJson<Record<string, string>>(`src-devices/src/i18n/${lang}.json`);
            expect(i18n.madm_player, lang).to.equal(manifest.name[lang]);
        }
    });

    it('io-package points to the built widget sets', () => {
        const set = ioPackage.common.visWidgets.vis2MusicAssistantWidgets;
        expect(set.url).to.equal('music-assistant/customWidgets.js');
        expect(set.components).to.deep.equal(['MaPlayer']);
        expect(readFileSync(join(ROOT, 'src-devices/src/Components.tsx'), 'utf8')).to.include('MaPlayerComponent');
    });
});
