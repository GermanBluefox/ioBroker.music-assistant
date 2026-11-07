/**
 * The library of Music Assistant in a dialog: favorites, artists, albums, tracks, playlists, radio stations, podcasts
 * and audiobooks, with a search. The adapter lists them (message `getMedia`); a click hands the URI of the entry
 * back, the player writes it into `playMedia`.
 *
 * The view is rendered into an element of its own, which the host frames as a dialog (`openDialog`). It brings its
 * own styles in a shadow root and inherits only the font and the color of the dialog.
 *
 * It remembers where the user was (list, search, loaded entries, scroll position) in the local storage of the browser
 * and opens there again the next time.
 */
import { useEffect, useRef, useState, type JSX } from 'react';

import type { WordKey } from './i18n';
import { Icon, type IconName } from './icons';

/** The lists of the message `getMedia` */
export type LibraryList =
    'favorites' | 'artists' | 'albums' | 'tracks' | 'playlists' | 'radios' | 'podcasts' | 'audiobooks';

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

/** Entries asked for at once; a full page offers to load more */
export const LIBRARY_PAGE = 100;

/** Entries the adapter lists at most at once: the most that are loaded again when the dialog opens */
const LIBRARY_MAX = 500;

export interface LibraryViewProps {
    /** Asks the adapter for `limit` entries of a list from `offset` on */
    load: (list: LibraryList, search: string, offset: number, limit: number) => Promise<LibraryAnswer>;
    word: (key: WordKey) => string;
    /** Called with the URI of the entry the user clicked */
    onPick: (uri: string) => void;
    /** Key in the local storage to remember where the user was, e.g. `music-assistant.0.library` */
    storageKey?: string;
}

const TABS: { list: LibraryList; word: WordKey }[] = [
    { list: 'favorites', word: 'favorites' },
    { list: 'artists', word: 'artists' },
    { list: 'albums', word: 'albums' },
    { list: 'tracks', word: 'tracks' },
    { list: 'playlists', word: 'playlists' },
    { list: 'radios', word: 'radio' },
    { list: 'podcasts', word: 'podcasts' },
    { list: 'audiobooks', word: 'audiobooks' },
];

/** The icon of an entry without a picture, by its media type */
const PLACEHOLDERS: Record<string, IconName> = {
    artist: 'artist',
    album: 'album',
    playlist: 'playlist',
    radio: 'radio',
    podcast: 'podcast',
    audiobook: 'audiobook',
};

/** The picture of an entry, or its icon if there is none or it cannot be loaded; an artist is round */
function Thumb({ entry }: { entry: LibraryEntry }): JSX.Element {
    const [failed, setFailed] = useState(false);
    return (
        <span className={entry.type === 'artist' ? 'thumb round' : 'thumb'}>
            {entry.image && !failed ? (
                <img
                    src={entry.image}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setFailed(true)}
                />
            ) : (
                <Icon name={PLACEHOLDERS[entry.type] || 'music'} />
            )}
        </span>
    );
}

/** Where the user was in the library, to open there again */
interface LibraryPlace {
    list: LibraryList;
    search: string;
    /** Entries that were loaded */
    count: number;
    /** How far the list was scrolled, in pixels */
    scrollTop: number;
}

/** The place remembered under the key, or null */
function recallPlace(storageKey: string | undefined): LibraryPlace | null {
    if (!storageKey) {
        return null;
    }
    try {
        const place = JSON.parse(window.localStorage.getItem(storageKey) || 'null') as Partial<LibraryPlace> | null;
        const tab = TABS.find(tab => tab.list === place?.list);
        if (!place || !tab) {
            return null;
        }
        return {
            list: tab.list,
            search: typeof place.search === 'string' ? place.search : '',
            count: Math.max(0, Number(place.count) || 0),
            scrollTop: Math.max(0, Number(place.scrollTop) || 0),
        };
    } catch {
        return null;
    }
}

function storePlace(storageKey: string | undefined, place: LibraryPlace): void {
    if (storageKey) {
        try {
            window.localStorage.setItem(storageKey, JSON.stringify(place));
        } catch {
            // no storage (private mode, blocked): the dialog opens on the favorites again
        }
    }
}

/** How many entries to load first: whole pages, as many as were loaded the last time */
function firstLimit(place: LibraryPlace | null): number {
    const pages = Math.ceil((place?.count || 0) / LIBRARY_PAGE) || 1;
    return Math.min(pages * LIBRARY_PAGE, LIBRARY_MAX);
}

interface Loaded {
    /** Which request this is the answer to */
    key: string;
    items: LibraryEntry[];
    error: string;
    /** The last page was full: there may be more */
    more: boolean;
}

/** An answer as the entries of a page, or why there are none */
function toPage(answer: LibraryAnswer, word: (key: WordKey) => string): { items: LibraryEntry[]; error: string } {
    return answer?.items
        ? { items: answer.items, error: '' }
        : { items: [], error: answer?.error || word('libraryError') };
}

function errorText(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

export function LibraryView({ load, word, onPick, storageKey }: LibraryViewProps): JSX.Element {
    // where the user was the last time
    const [start] = useState(() => recallPlace(storageKey));
    const [list, setList] = useState<LibraryList>(start?.list || 'favorites');
    const [text, setText] = useState(start?.search || '');
    const [search, setSearch] = useState(start?.search || '');
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
    const tabsRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLDivElement>(null);
    /** The place to go back to, until its list has arrived */
    const restoreRef = useRef(start);
    /** Where the user is now; a scroll is written a moment later, or when the dialog closes */
    const placeRef = useRef<LibraryPlace | null>(null);
    const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    const keep = (next: LibraryPlace, later = false): void => {
        placeRef.current = next;
        clearTimeout(scrollTimerRef.current);
        scrollTimerRef.current = later ? setTimeout(() => storePlace(storageKey, next), 250) : undefined;
        if (!later) {
            storePlace(storageKey, next);
        }
    };

    useEffect(
        () => () => {
            if (scrollTimerRef.current !== undefined && placeRef.current) {
                clearTimeout(scrollTimerRef.current);
                storePlace(storageKey, placeRef.current);
            }
        },
        // `storageKey` stays the same while the dialog is open
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    // search only once the user stops typing
    useEffect(() => {
        const timer = setTimeout(() => setSearch(text.trim()), 350);
        return () => clearTimeout(timer);
    }, [text]);

    const key = `${list}\n${search}`;
    useEffect(() => {
        let current = true;
        const back =
            restoreRef.current?.list === list && restoreRef.current.search === search ? restoreRef.current : null;
        if (!back) {
            // another list starts at its top
            restoreRef.current = null;
            if (listRef.current) {
                listRef.current.scrollTop = 0;
            }
            keep({ list, search, count: 0, scrollTop: 0 });
        }
        const limit = firstLimit(back);
        load(list, search, 0, limit)
            .then(answer => {
                if (current) {
                    const page = toPage(answer, word);
                    setLoaded({ key, ...page, more: page.items.length >= limit });
                }
            })
            .catch((e: unknown) => {
                if (current) {
                    setLoaded({ key, items: [], error: errorText(e), more: false });
                }
            });
        return () => {
            current = false;
        };
        // `word` and `load` stay the same while the dialog is open
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const ready = loaded?.key === key ? loaded : null;

    // the entries have arrived: back to where the user was, and remember how many there are
    useEffect(() => {
        if (!ready) {
            return;
        }
        const element = listRef.current;
        const back = restoreRef.current;
        restoreRef.current = null;
        if (back && element) {
            element.scrollTop = back.scrollTop;
            const tabs = tabsRef.current;
            const tab = tabs?.querySelector<HTMLElement>('.tab.active');
            if (tabs && tab) {
                tabs.scrollLeft = tab.offsetLeft - (tabs.clientWidth - tab.offsetWidth) / 2;
            }
        }
        // not laid out yet: keep the remembered position
        const scrollTop = element?.clientHeight ? element.scrollTop : back?.scrollTop || 0;
        keep({ list, search, count: ready.items.length, scrollTop });
        // only when other entries arrive
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    const loadMore = (): void => {
        if (!ready || loadingMore) {
            return;
        }
        setLoadingMore(true);
        load(list, search, ready.items.length, LIBRARY_PAGE)
            .then(answer => {
                const page = toPage(answer, word);
                setLoaded(prev =>
                    prev?.key === key
                        ? {
                              key,
                              items: [...prev.items, ...page.items],
                              error: page.error,
                              more: !page.error && page.items.length >= LIBRARY_PAGE,
                          }
                        : prev,
                );
            })
            .catch((e: unknown) =>
                setLoaded(prev => (prev?.key === key ? { ...prev, error: errorText(e), more: false } : prev)),
            )
            .finally(() => setLoadingMore(false));
    };

    /** Plays an entry; the exact place is written at once, the library closes */
    const pick = (uri: string): void => {
        if (ready && listRef.current) {
            keep({ list, search, count: ready.items.length, scrollTop: listRef.current.scrollTop });
        }
        onPick(uri);
    };

    let content: JSX.Element;
    if (!ready) {
        content = <div className="note">{word('loading')}</div>;
    } else if (ready.error && !ready.items.length) {
        content = <div className="note error">{ready.error}</div>;
    } else if (!ready.items.length) {
        content = <div className="note">{word('nothingFound')}</div>;
    } else {
        content = (
            <>
                <ul className="items">
                    {ready.items.map(entry => (
                        <li key={entry.uri}>
                            <button
                                className="item"
                                title={entry.subtitle ? `${entry.name} · ${entry.subtitle}` : entry.name}
                                onClick={() => pick(entry.uri)}
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
                {ready.error ? <div className="note error">{ready.error}</div> : null}
                {ready.more ? (
                    <button
                        className="more"
                        disabled={loadingMore}
                        onClick={loadMore}
                    >
                        {word(loadingMore ? 'loading' : 'loadMore')}
                    </button>
                ) : null}
            </>
        );
    }

    return (
        <div className="library">
            <div
                ref={tabsRef}
                className="tabs"
                role="tablist"
            >
                {TABS.map(tab => (
                    <button
                        key={tab.list}
                        role="tab"
                        aria-selected={tab.list === list}
                        className={tab.list === list ? 'tab active' : 'tab'}
                        onClick={e => {
                            setList(tab.list);
                            e.currentTarget.scrollIntoView({ block: 'nearest', inline: 'nearest' });
                        }}
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
            <div
                ref={listRef}
                className="list"
                onScroll={e => {
                    if (ready && !restoreRef.current) {
                        keep({ list, search, count: ready.items.length, scrollTop: e.currentTarget.scrollTop }, true);
                    }
                }}
            >
                {content}
            </div>
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
/* eight tabs do not fit a narrow dialog: they scroll */
.tabs {
    position: relative;
    flex: none;
    display: flex;
    gap: 2px;
    border-bottom: 1px solid var(--line);
    overflow-x: auto;
    scrollbar-width: thin;
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
    flex: 1 0 auto;
    padding: 8px 10px;
    border-bottom: 2px solid transparent;
    opacity: 0.7;
    white-space: nowrap;
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
.thumb.round {
    border-radius: 50%;
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
.more {
    display: block;
    width: 100%;
    margin: 4px 0;
    padding: 8px;
    border: 1px solid var(--line);
    border-radius: 6px;
}
.more:hover:not(:disabled) {
    background: var(--hover);
}
.more:disabled {
    cursor: default;
    opacity: 0.6;
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
