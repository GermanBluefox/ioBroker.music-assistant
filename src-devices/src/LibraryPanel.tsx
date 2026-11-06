// The library of Music Assistant inside the player dialog: favorites, playlists and radio stations with a search,
// listed by the adapter (message `getMedia`). A click hands the URI back; the widget writes it into `playMedia`.

import { React, MuiMaterial } from '@iobroker/dm-widgets';
import type {
    AvatarProps,
    BoxProps,
    LinearProgressProps,
    ListItemAvatarProps,
    ListItemButtonProps,
    ListItemTextProps,
    ListProps,
    TabProps,
    TabsProps,
    TextFieldProps,
    TypographyProps,
} from '@mui/material';
import type { DependencyList, Dispatch, EffectCallback, SetStateAction } from 'react';

import { MusicIcon, PlaylistIcon, RadioIcon } from './icons';

// The host's React and MUI, see MaPlayerComponent.tsx
const useState = React.useState as <S>(initial: S) => [S, Dispatch<SetStateAction<S>>];
const useEffect = React.useEffect as (effect: EffectCallback, deps?: DependencyList) => void;
const Box: React.ComponentType<BoxProps> = MuiMaterial?.Box;
const Avatar: React.ComponentType<AvatarProps> = MuiMaterial?.Avatar;
const LinearProgress: React.ComponentType<LinearProgressProps> = MuiMaterial?.LinearProgress;
const List: React.ComponentType<ListProps> = MuiMaterial?.List;
const ListItemAvatar: React.ComponentType<ListItemAvatarProps> = MuiMaterial?.ListItemAvatar;
const ListItemButton: React.ComponentType<ListItemButtonProps> = MuiMaterial?.ListItemButton;
const ListItemText: React.ComponentType<ListItemTextProps> = MuiMaterial?.ListItemText;
const Tab: React.ComponentType<TabProps> = MuiMaterial?.Tab;
const Tabs: React.ComponentType<TabsProps> = MuiMaterial?.Tabs;
const TextField: React.ComponentType<TextFieldProps> = MuiMaterial?.TextField;
const Typography: React.ComponentType<TypographyProps> = MuiMaterial?.Typography;

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

export interface LibraryPanelProps {
    /** Asks the adapter for a list */
    load: (list: LibraryList, search: string) => Promise<LibraryAnswer>;
    /** Translates a key of the widget */
    t: (key: string) => string;
    /** Color of the active tab */
    accent: string;
    /** Called with the URI of the entry the user clicked */
    onPick: (uri: string) => void;
}

const TABS: { list: LibraryList; label: string }[] = [
    { list: 'favorites', label: 'madm_favorites' },
    { list: 'playlists', label: 'madm_playlists' },
    { list: 'radios', label: 'madm_radio' },
];

interface Loaded {
    /** Which request this is the answer to */
    key: string;
    items: LibraryEntry[];
    error: string;
}

function placeholder(type: string): React.JSX.Element {
    const Icon = type === 'radio' ? RadioIcon : type === 'playlist' ? PlaylistIcon : MusicIcon;
    return <Icon sx={{ fontSize: '1.3rem' }} />;
}

export function LibraryPanel({ load, t, accent, onPick }: LibraryPanelProps): React.JSX.Element {
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
                        error: answer?.items ? '' : answer?.error || t('madm_library_error'),
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
        // `load` and `t` stay the same while the panel is open
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key]);

    const ready = loaded?.key === key ? loaded : null;
    let content: React.JSX.Element;
    if (!ready) {
        content = <LinearProgress sx={{ mt: 2, '& .MuiLinearProgress-bar': { backgroundColor: accent } }} />;
    } else if (ready.error || !ready.items.length) {
        content = (
            <Typography
                variant="body2"
                sx={{ py: 3, textAlign: 'center', color: ready.error ? 'error.main' : 'text.secondary' }}
            >
                {ready.error || t('madm_nothing_found')}
            </Typography>
        );
    } else {
        content = (
            <List
                dense
                disablePadding
            >
                {ready.items.map(entry => (
                    <ListItemButton
                        key={entry.uri}
                        onClick={() => onPick(entry.uri)}
                        sx={{ borderRadius: '8px' }}
                    >
                        <ListItemAvatar>
                            <Avatar
                                variant="rounded"
                                src={entry.image || undefined}
                                slotProps={{ img: { loading: 'lazy', referrerPolicy: 'no-referrer' } }}
                            >
                                {placeholder(entry.type)}
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
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5, height: 'min(60vh, 520px)', minHeight: 0 }}>
            <Tabs
                value={list}
                variant="fullWidth"
                onChange={(_e: React.SyntheticEvent, value: LibraryList) => setList(value)}
                sx={{
                    minHeight: 36,
                    '& .MuiTab-root': { minHeight: 36, textTransform: 'none' },
                    '& .MuiTab-root.Mui-selected': { color: accent },
                    '& .MuiTabs-indicator': { backgroundColor: accent },
                }}
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
                placeholder={t('madm_search')}
                value={text}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setText(e.target.value)}
                slotProps={{ htmlInput: { 'aria-label': t('madm_search') } }}
            />
            <Box sx={{ flex: 1, minHeight: 0, overflowY: 'auto' }}>{content}</Box>
        </Box>
    );
}
