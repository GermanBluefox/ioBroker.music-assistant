import React, { useEffect, useState } from 'react';

import {
    Avatar,
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
import { Close, MusicNote, QueueMusic, Radio } from '@mui/icons-material';

/** The lists of the message `getMedia` of the adapter */
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

interface LibraryDialogProps {
    /** Asks the adapter for a list */
    load: (list: LibraryList, search: string) => Promise<LibraryAnswer>;
    /** Translates a key of the widget set */
    t: (key: string) => string;
    /** Called with the URI of the entry the user clicked */
    onPick: (uri: string) => void;
    onClose: () => void;
}

const TABS: { list: LibraryList; label: string }[] = [
    { list: 'favorites', label: 'favorites' },
    { list: 'playlists', label: 'playlists' },
    { list: 'radios', label: 'radio' },
];

interface Loaded {
    /** Which request this is the answer to */
    key: string;
    items: LibraryEntry[];
    error: string;
}

function Placeholder({ type }: { type: string }): React.JSX.Element {
    return type === 'radio' ? <Radio /> : type === 'playlist' ? <QueueMusic /> : <MusicNote />;
}

/**
 * The library of Music Assistant: favorites, playlists and radio stations with a search, listed by the adapter
 * (message `getMedia`). A click hands the URI back; the widget writes it into `playMedia` of the player.
 */
export default function LibraryDialog({ load, t, onPick, onClose }: LibraryDialogProps): React.JSX.Element {
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
                        error: answer?.items ? '' : answer?.error || t('library_error'),
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
        // `load` and `t` stay the same while the dialog is open
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const ready = loaded?.key === key ? loaded : null;
    let content: React.JSX.Element;
    if (!ready) {
        content = <LinearProgress sx={{ mt: 2 }} />;
    } else if (ready.error || !ready.items.length) {
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
            <List dense>
                {ready.items.map(entry => (
                    <ListItemButton
                        key={entry.uri}
                        onClick={() => onPick(entry.uri)}
                    >
                        <ListItemAvatar>
                            <Avatar
                                variant="rounded"
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
                    variant="fullWidth"
                    onChange={(_e, value: LibraryList) => setList(value)}
                >
                    {TABS.map(tab => (
                        <Tab
                            key={tab.list}
                            value={tab.list}
                            label={t(tab.label)}
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
                />
                <div style={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{content}</div>
            </DialogContent>
        </Dialog>
    );
}
