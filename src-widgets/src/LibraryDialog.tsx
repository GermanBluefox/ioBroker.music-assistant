import React, { useEffect, useRef, useState } from 'react';

import {
    Avatar,
    Button,
    Dialog,
    DialogContent,
    DialogTitle,
    IconButton,
    LinearProgress,
    List,
    ListItemAvatar,
    ListItemButton,
    ListItemText,
    Tab,
    Tabs,
    TextField,
    Typography,
} from '@mui/material';
import { Album, Close, MenuBook, MusicNote, Person, Podcasts, QueueMusic, Radio } from '@mui/icons-material';

/** The lists of the message `getMedia` of the adapter */
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

/** Entries the adapter lists at most at once: the most that are loaded again when the library opens */
const LIBRARY_MAX = 500;

interface LibraryDialogProps {
    /** Asks the adapter for `limit` entries of a list from `offset` on */
    load: (list: LibraryList, search: string, offset: number, limit: number) => Promise<LibraryAnswer>;
    /** Translates a key of the widget set */
    t: (key: string) => string;
    /** Called with the URI of the entry the user clicked */
    onPick: (uri: string) => void;
    /** Key in the local storage to remember where the user was, e.g. `music-assistant.0.library` */
    storageKey?: string;
    onClose: () => void;
}

const TABS: { list: LibraryList; label: string }[] = [
    { list: 'favorites', label: 'favorites' },
    { list: 'artists', label: 'artists' },
    { list: 'albums', label: 'albums' },
    { list: 'tracks', label: 'tracks' },
    { list: 'playlists', label: 'playlists' },
    { list: 'radios', label: 'radio' },
    { list: 'podcasts', label: 'podcasts' },
    { list: 'audiobooks', label: 'audiobooks' },
];

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
            // no storage (private mode, blocked): the library opens on the favorites again
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

/** The icon of an entry without a picture, by its media type */
function Placeholder({ type }: { type: string }): React.JSX.Element {
    switch (type) {
        case 'artist':
            return <Person />;
        case 'album':
            return <Album />;
        case 'playlist':
            return <QueueMusic />;
        case 'radio':
            return <Radio />;
        case 'podcast':
            return <Podcasts />;
        case 'audiobook':
            return <MenuBook />;
        default:
            return <MusicNote />;
    }
}

function toPage(answer: LibraryAnswer, t: (key: string) => string): { items: LibraryEntry[]; error: string } {
    return answer?.items
        ? { items: answer.items, error: '' }
        : { items: [], error: answer?.error || t('library_error') };
}

function errorText(e: unknown): string {
    return e instanceof Error ? e.message : String(e);
}

/**
 * The library of Music Assistant: favorites, artists, albums, tracks, playlists, radio stations, podcasts and
 * audiobooks with a search, listed by the adapter (message `getMedia`). A click hands the URI back; the widget
 * writes it into `playMedia` of the player. It opens where the user was the last time (list, search, loaded entries,
 * scroll position), remembered in the local storage of the browser.
 */
export default function LibraryDialog({ load, t, onPick, onClose, storageKey }: LibraryDialogProps): React.JSX.Element {
    // where the user was the last time
    const [start] = useState(() => recallPlace(storageKey));
    const [list, setList] = useState<LibraryList>(start?.list || 'favorites');
    const [text, setText] = useState(start?.search || '');
    const [search, setSearch] = useState(start?.search || '');
    const [loaded, setLoaded] = useState<Loaded | null>(null);
    const [loadingMore, setLoadingMore] = useState(false);
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
                    const page = toPage(answer, t);
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
        // `load` and `t` stay the same while the dialog is open
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
                const page = toPage(answer, t);
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

    let content: React.JSX.Element;
    if (!ready) {
        content = <LinearProgress sx={{ mt: 2 }} />;
    } else if (!ready.items.length) {
        content = (
            <Typography
                variant="body2"
                color={ready.error ? 'error' : 'text.secondary'}
                sx={{ py: 3, textAlign: 'center' }}
            >
                {ready.error || t('nothing_found')}
            </Typography>
        );
    } else {
        content = (
            <>
                <List dense>
                    {ready.items.map(entry => (
                        <ListItemButton
                            key={entry.uri}
                            onClick={() => pick(entry.uri)}
                        >
                            <ListItemAvatar>
                                <Avatar
                                    variant={entry.type === 'artist' ? 'circular' : 'rounded'}
                                    src={entry.image || undefined}
                                    slotProps={{ img: { loading: 'lazy', referrerPolicy: 'no-referrer' } }}
                                >
                                    <Placeholder type={entry.type} />
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={entry.name}
                                secondary={entry.subtitle || undefined}
                                slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }}
                            />
                        </ListItemButton>
                    ))}
                </List>
                {ready.error ? (
                    <Typography
                        variant="body2"
                        color="error"
                        sx={{ py: 1, textAlign: 'center' }}
                    >
                        {ready.error}
                    </Typography>
                ) : null}
                {ready.more ? (
                    <Button
                        fullWidth
                        variant="outlined"
                        disabled={loadingMore}
                        onClick={loadMore}
                        sx={{ mb: 1 }}
                    >
                        {t('load_more')}
                    </Button>
                ) : null}
            </>
        );
    }

    return (
        <Dialog
            open
            onClose={onClose}
            fullWidth
            maxWidth="xs"
            slotProps={{ paper: { sx: { height: 'min(640px, 90vh)' } } }}
        >
            <DialogTitle sx={{ display: 'flex', alignItems: 'center', pr: 1 }}>
                <span style={{ flex: 1 }}>{t('library')}</span>
                <IconButton
                    aria-label={t('close')}
                    onClick={onClose}
                >
                    <Close />
                </IconButton>
            </DialogTitle>
            <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 1, pb: 1 }}>
                <Tabs
                    value={list}
                    variant="scrollable"
                    scrollButtons="auto"
                    allowScrollButtonsMobile
                    onChange={(_e, value: LibraryList) => setList(value)}
                    sx={{ flex: 'none' }}
                >
                    {TABS.map(tab => (
                        <Tab
                            key={tab.list}
                            value={tab.list}
                            label={t(tab.label)}
                            sx={{ minWidth: 0, px: 1.5 }}
                        />
                    ))}
                </Tabs>
                <TextField
                    size="small"
                    type="search"
                    placeholder={t('search')}
                    value={text}
                    onChange={e => setText(e.target.value)}
                    slotProps={{ htmlInput: { 'aria-label': t('search') } }}
                    sx={{ flex: 'none' }}
                />
                <div
                    ref={listRef}
                    style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}
                    onScroll={(e: React.UIEvent<HTMLDivElement>) => {
                        if (ready && !restoreRef.current) {
                            keep(
                                { list, search, count: ready.items.length, scrollTop: e.currentTarget.scrollTop },
                                true,
                            );
                        }
                    }}
                >
                    {content}
                </div>
            </DialogContent>
        </Dialog>
    );
}
