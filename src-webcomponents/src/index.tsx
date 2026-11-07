/**
 * A player of Music Assistant as a web component: `<iob-ma-player>`.
 *
 * One module for every host - vis-2, devices, Aura, admin (`@iobroker/web-components`). Its manifest is a file of
 * its own (`ma-player.json`, written by the build from `manifest.ts`), so a host loads this module only when it
 * shows the element. The host sets `socket` and `settings`, and if it has them `theme` and `editMode`.
 *
 * The element reads and writes the states of the player channel `music-assistant.<n>.players.<id>` only - the
 * instance comes from the ID of the setting. Buttons are written with `true`, levels with their value; the adapter
 * sends the command to Music Assistant and acknowledges the state. The library (favorites, albums, radio, ...) comes
 * from the message `getMedia` of the instance; a picked entry is written into `playMedia`.
 *
 * React is not in the module: it comes from `lib/esm/react-19.js` beside `adapter/`, see `vite.config.ts`.
 */
import { createRoot, type Root } from 'react-dom/client';

import { defineWebComponent, getThemeCssVariables, IobWebComponent } from '@iobroker/web-components/element';

import { getPlayerChannel, PLAYER_STATES, TAG, type PlayerCommand, type PlayerSettings } from './constants';
import { getWord, type WordKey } from './i18n';
import { LIBRARY_STYLES, LibraryView, type LibraryAnswer, type LibraryList } from './LibraryView';
import { Hint, PlayerView, type PlayerSource, type PlayerValues } from './PlayerView';
import { STYLES } from './styles';

/** How long the instance may take for the list of the library */
const LIBRARY_TIMEOUT = 15000;

/**
 * The sources of a player from `common.states` of its `source` state, in the order the adapter wrote them
 *
 * @param states `{ id: name }`; a string `id:name;...` or an array as `common.states` may be too
 */
function getSources(states: ioBroker.StateCommon['states']): PlayerSource[] {
    if (!states) {
        return [];
    }
    if (typeof states === 'string') {
        return states
            .split(';')
            .map(part => part.split(':'))
            .filter(([id]) => id)
            .map(([id, ...name]) => ({ id, name: name.join(':') || id }));
    }
    if (Array.isArray(states)) {
        return states.map(name => ({ id: String(name), name: String(name) }));
    }
    return Object.entries(states).map(([id, name]) => ({ id, name: String(name ?? id) }));
}

class MusicAssistantPlayer extends IobWebComponent<PlayerSettings> {
    readonly #root: Root;

    /** While the dialog of the library is open */
    #libraryOpen = false;

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

    /** The object of `source`: the adapter writes the sources of the player into its `common.states` */
    protected override getObjectIds(settings: PlayerSettings): string[] {
        const channel = getPlayerChannel(settings.player);
        return channel && settings.showSource !== false ? [`${channel}.source`] : [];
    }

    /**
     * Shows the library of Music Assistant as a dialog of the host and plays what the user picks on the player
     *
     * @param channel the player channel, `music-assistant.<n>.players.<id>`
     */
    async #openLibrary(channel: string): Promise<void> {
        const socket = this.socket;
        if (!socket || this.#libraryOpen) {
            return;
        }
        this.#libraryOpen = true;
        const instance = channel.split('.').slice(0, 2).join('.');
        const lang = this.systemLang;
        const word = (key: WordKey): string => getWord(lang, key);

        // the host moves this element into its dialog: it brings its own styles, and the theme of the host as the
        // same CSS variables (`--iob-primary`, ...) the base class sets on this element
        const element = document.createElement('div');
        element.style.width = '100%';
        element.style.height = '100%';
        for (const [name, value] of Object.entries(getThemeCssVariables(this.theme))) {
            element.style.setProperty(name, value);
        }
        const shadow = element.attachShadow({ mode: 'open' });
        const style = document.createElement('style');
        style.textContent = LIBRARY_STYLES;
        const mount = document.createElement('div');
        mount.className = 'mount';
        if (this.settings.accent) {
            mount.style.setProperty('--accent', this.settings.accent);
        }
        shadow.append(style, mount);
        const root = createRoot(mount);

        const load = (list: LibraryList, search: string, offset: number, limit: number): Promise<LibraryAnswer> => {
            let timer: ReturnType<typeof setTimeout> | undefined;
            const timeout = new Promise<LibraryAnswer>((_resolve, reject) => {
                timer = setTimeout(() => reject(new Error(word('libraryError'))), LIBRARY_TIMEOUT);
            });
            return Promise.race([
                socket.sendTo<LibraryAnswer>(instance, 'getMedia', { list, search, offset, limit }),
                timeout,
            ]).finally(() => clearTimeout(timer));
        };
        root.render(
            <LibraryView
                load={load}
                word={word}
                storageKey={`${instance}.library`}
                onPick={uri =>
                    element.dispatchEvent(
                        new CustomEvent('iob-dialog-close', { bubbles: true, composed: true, detail: uri }),
                    )
                }
            />,
        );

        try {
            const uri = await this.openDialog({ element, title: word('library'), width: 440, height: 560 });
            if (typeof uri === 'string' && uri) {
                await this.setState(`${channel}.playMedia`, uri);
            }
        } finally {
            this.#libraryOpen = false;
            root.unmount();
        }
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
        const sourceObject = this.objects[`${channel}.source`];
        const sourceStates = sourceObject?.type === 'state' ? sourceObject.common.states : undefined;

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
            source: text('source'),
            sources: getSources(sourceStates),
        };

        this.#root.render(
            <PlayerView
                values={values}
                showCover={settings.showCover !== false}
                showVolume={settings.showVolume !== false}
                showModes={settings.showModes !== false}
                showSource={settings.showSource !== false}
                onLibrary={settings.showLibrary !== false ? () => void this.#openLibrary(channel) : undefined}
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
