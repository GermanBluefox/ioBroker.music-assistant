/**
 * A player of Music Assistant as a web component: `<iob-ma-player>`.
 *
 * One module for every host - vis-2, devices, Aura, admin (`@iobroker/web-components`). Its manifest is a file of
 * its own (`ma-player.json`, written by the build from `manifest.ts`), so a host loads this module only when it
 * shows the element. The host sets `socket` and `settings`, and if it has them `theme` and `editMode`.
 *
 * The element reads and writes the states of the player channel `music-assistant.<n>.players.<id>` only - the
 * instance comes from the ID of the setting. Buttons are written with `true`, levels with their value; the adapter
 * sends the command to Music Assistant and acknowledges the state.
 *
 * React is not in the module: it comes from `lib/esm/react-19.js` beside `adapter/`, see `vite.config.ts`.
 */
import { createRoot, type Root } from 'react-dom/client';

import { defineWebComponent, IobWebComponent } from '@iobroker/web-components/element';

import { getPlayerChannel, PLAYER_STATES, TAG, type PlayerCommand, type PlayerSettings } from './constants';
import { getWord, type WordKey } from './i18n';
import { Hint, PlayerView, type PlayerValues } from './PlayerView';
import { STYLES } from './styles';

class MusicAssistantPlayer extends IobWebComponent<PlayerSettings> {
    readonly #root: Root;

    constructor() {
        super();
        const shadow = this.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = STYLES;
        const mount = document.createElement('div');
        mount.className = 'mount';
        shadow.append(style, mount);
        this.#root = createRoot(mount);
    }

    protected override getStateIds(settings: PlayerSettings): string[] {
        const channel = getPlayerChannel(settings.player);
        return channel ? PLAYER_STATES.map(name => `${channel}.${name}`) : [];
    }

    protected override render(): void {
        const settings = this.settings;
        const lang = this.systemLang;
        const word = (key: WordKey): string => getWord(lang, key);
        const channel = getPlayerChannel(settings.player);

        if (!channel) {
            this.#root.render(
                <Hint
                    text={word(settings.player ? 'notPlayer' : 'choosePlayer')}
                    editMode={this.editMode}
                />,
            );
            return;
        }

        const state = (name: (typeof PLAYER_STATES)[number]): ioBroker.State | null =>
            this.states[`${channel}.${name}`] || null;
        const text = (name: (typeof PLAYER_STATES)[number]): string => {
            const val = state(name)?.val;
            return val === null || val === undefined ? '' : String(val);
        };
        const num = (name: (typeof PLAYER_STATES)[number]): number => Number(state(name)?.val) || 0;
        const elapsed = state('elapsedTime');

        const values: PlayerValues = {
            name: settings.title || text('name') || channel.split('.').pop() || '',
            // a player whose states have not arrived yet is not shown as unavailable
            available: state('available') ? !!state('available')?.val : true,
            powered: state('powered') ? !!state('powered')?.val : true,
            // media.state: 0 = pause, 1 = play, 2 = stop
            playing: num('state') === 1,
            volume: num('volume'),
            muted: !!state('muted')?.val,
            shuffle: !!state('shuffle')?.val,
            repeat: num('repeat'),
            elapsed: Number(elapsed?.val) || 0,
            elapsedTs: elapsed?.ts || 0,
            duration: num('duration'),
            title: text('mediaTitle'),
            artist: text('mediaArtist'),
            album: text('mediaAlbum'),
            image: text('mediaImage'),
        };

        this.#root.render(
            <PlayerView
                values={values}
                showCover={settings.showCover !== false}
                showVolume={settings.showVolume !== false}
                showModes={settings.showModes !== false}
                accent={settings.accent}
                editMode={this.editMode}
                word={word}
                onCommand={(command: PlayerCommand, value: ioBroker.StateValue) =>
                    void this.setState(`${channel}.${command}`, value)
                }
            />,
        );
    }
}

defineWebComponent(TAG, MusicAssistantPlayer);
