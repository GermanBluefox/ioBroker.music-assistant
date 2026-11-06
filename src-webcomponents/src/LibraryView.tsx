/**
 * The library of Music Assistant in a dialog: favorites, playlists and radio stations, with a search. The adapter
 * lists them (message `getMedia`); a click hands the URI of the entry back, the player writes it into `playMedia`.
 *
 * The view is rendered into an element of its own, which the host frames as a dialog (`openDialog`). It brings its
 * own styles in a shadow root and inherits only the font and the color of the dialog.
 */
import { useEffect, useState, type JSX } from 'react';

import type { WordKey } from './i18n';
import { Icon, type IconName } from './icons';

/** The lists of the message `getMedia` */
export type LibraryList = 'favorites' | 'playlists' | 'radios';

/** One entry of the answer of `getMedia` */
export interface LibraryEntry {
    uri: string;
    name: string;
    subtitle: string;
    image: string;
    type: string;
}

/** What `getMedia` answers */
export type LibraryAnswer = { items?: LibraryEntry[]; error?: string } | null | undefined;

export interface LibraryViewProps {
    /** Asks the adapter for a list */
    load: (list: LibraryList, search: string) => Promise<LibraryAnswer>;
    word: (key: WordKey) => string;
    /** Called with the URI of the entry the user clicked */
    onPick: (uri: string) => void;
}

const TABS: { list: LibraryList; word: WordKey }[] = [
    { list: 'favorites', word: 'favorites' },
    { list: 'playlists', word: 'playlists' },
    { list: 'radios', word: 'radio' },
];

/** The icon of an entry without a picture */
function placeholder(type: string): IconName {
    return type === 'radio' ? 'radio' : type === 'playlist' ? 'playlist' : 'music';
}

/** The picture of an entry, or its icon if there is none or it cannot be loaded */
function Thumb({ entry }: { entry: LibraryEntry }): JSX.Element {
    const [failed, setFailed] = useState(false);
    return (
        <span className="thumb">
            {entry.image && !failed ? (
                <img
                    src={entry.image}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setFailed(true)}
                />
            ) : (
                <Icon name={placeholder(entry.type)} />
            )}
        </span>
    );
}

interface Loaded {
    /** Which request this is the answer to */
    key: string;
    items: LibraryEntry[];
    error: string;
}

export function LibraryView({ load, word, onPick }: LibraryViewProps): JSX.Element {
    const [list, setList] = useState<LibraryList>('favorites');
    const [text, setText] = useState('');
    const [search, setSearch] = useState('');
    const [loaded, setLoaded] = useState<Loaded | null>(null);

    // search only once the user stops typing
    useEffect(() => {
        const timer = setTimeout(() => setSearch(text.trim()), 350);
        return () => clearTimeout(timer);
    }, [text]);

    const key = `${list}\n${search}`;
    useEffect(() => {
        let current = true;
        load(list, search)
            .then(answer => {
                if (current) {
                    setLoaded({
                        key,
                        items: answer?.items || [],
                        error: answer?.items ? '' : answer?.error || word('libraryError'),
                    });
                }
            })
            .catch((e: unknown) => {
                if (current) {
                    setLoaded({ key, items: [], error: e instanceof Error ? e.message : String(e) });
                }
            });
        return () => {
            current = false;
        };
        // `word` and `load` stay the same while the dialog is open
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const ready = loaded?.key === key ? loaded : null;
    let content: JSX.Element;
    if (!ready) {
        content = <div className="note">{word('loading')}</div>;
    } else if (ready.error) {
        content = <div className="note error">{ready.error}</div>;
    } else if (!ready.items.length) {
        content = <div className="note">{word('nothingFound')}</div>;
    } else {
        content = (
            <ul className="items">
                {ready.items.map(entry => (
                    <li key={entry.uri}>
                        <button
                            className="item"
                            title={entry.subtitle ? `${entry.name} · ${entry.subtitle}` : entry.name}
                            onClick={() => onPick(entry.uri)}
                        >
                            <Thumb entry={entry} />
                            <span className="texts">
                                <span className="entry-name">{entry.name}</span>
                                {entry.subtitle ? <span className="entry-sub">{entry.subtitle}</span> : null}
                            </span>
                            <Icon name="play" />
                        </button>
                    </li>
                ))}
            </ul>
        );
    }

    return (
        <div className="library">
            <div
                className="tabs"
                role="tablist"
            >
                {TABS.map(tab => (
                    <button
                        key={tab.list}
                        role="tab"
                        aria-selected={tab.list === list}
                        className={tab.list === list ? 'tab active' : 'tab'}
                        onClick={() => setList(tab.list)}
                    >
                        {word(tab.word)}
                    </button>
                ))}
            </div>
            <input
                className="search"
                type="search"
                placeholder={word('search')}
                aria-label={word('search')}
                value={text}
                onChange={e => setText(e.currentTarget.value)}
            />
            <div className="list">{content}</div>
        </div>
    );
}

/** The styles of the shadow root of the dialog element */
export const LIBRARY_STYLES = `
:host {
    display: block;
    width: 100%;
    height: 100%;
}
.mount {
    width: 100%;
    height: 100%;
}
.mount.dark {
    color-scheme: dark;
}
.library {
    --hover: color-mix(in srgb, currentColor 10%, transparent);
    --line: color-mix(in srgb, currentColor 20%, transparent);
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    min-height: 240px;
    display: flex;
    flex-direction: column;
    gap: 8px;
}
.tabs {
    display: flex;
    gap: 4px;
    border-bottom: 1px solid var(--line);
}
button {
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    margin: 0;
    cursor: pointer;
}
button:focus-visible,
.search:focus-visible {
    outline: 2px solid var(--accent, currentColor);
    outline-offset: 1px;
}
.tab {
    flex: 1;
    padding: 8px 4px;
    border-bottom: 2px solid transparent;
    opacity: 0.7;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.tab:hover {
    background: var(--hover);
}
.tab.active {
    opacity: 1;
    font-weight: 600;
    border-bottom-color: var(--accent, currentColor);
}
.search {
    font: inherit;
    color: inherit;
    background: transparent;
    border: 1px solid var(--line);
    border-radius: 6px;
    padding: 6px 10px;
}
.list {
    flex: 1;
    min-height: 0;
    overflow-y: auto;
}
.items {
    list-style: none;
    margin: 0;
    padding: 0;
}
.item {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 6px;
    border-radius: 6px;
    text-align: left;
}
.item:hover {
    background: var(--hover);
}
.item > svg {
    flex: none;
    width: 20px;
    height: 20px;
    fill: currentColor;
    opacity: 0;
}
.item:hover > svg,
.item:focus-visible > svg {
    opacity: 0.7;
}
.thumb {
    flex: none;
    width: 44px;
    height: 44px;
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--hover);
}
.thumb img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.thumb svg {
    width: 55%;
    height: 55%;
    fill: currentColor;
    opacity: 0.4;
}
.texts {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
}
.entry-name,
.entry-sub {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.entry-sub {
    font-size: 0.85em;
    opacity: 0.7;
}
.note {
    padding: 24px 8px;
    text-align: center;
    opacity: 0.7;
}
.note.error {
    opacity: 1;
}
`;
