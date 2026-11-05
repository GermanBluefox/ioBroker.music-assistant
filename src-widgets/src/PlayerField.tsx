import React, { useEffect, useState } from 'react';

import { MenuItem, Select } from '@mui/material';

import type {
    RxWidgetInfoAttributesField,
    RxWidgetInfoCustomComponentProperties,
    WidgetData,
} from '@iobroker/types-vis-2';

import { getNamespace, loadPlayers, type MaPlayerInfo } from './Generic';

interface PlayerSelectProps {
    value: string;
    /** The `instance` attribute of the widget */
    instance: string;
    socket: RxWidgetInfoCustomComponentProperties['context']['socket'];
    /** Text of the empty entry: the first player */
    emptyLabel: string;
    onChange: (value: string) => void;
}

/** The players of the instance by name; the attribute stores the ID of the channel */
function PlayerSelect(props: PlayerSelectProps): React.JSX.Element {
    const { value, instance, socket, emptyLabel, onChange } = props;
    const [players, setPlayers] = useState<MaPlayerInfo[] | null>(null);
    const namespace = getNamespace(instance);

    useEffect(() => {
        let active = true;
        loadPlayers(socket, namespace, 'en').then(
            list => active && setPlayers(list),
            () => active && setPlayers([]),
        );
        return () => {
            active = false;
        };
    }, [socket, namespace]);

    // a player of another instance, or one deleted in Music Assistant, stays visible as its ID
    const unknown = !!value && !!players && !players.some(item => item.player === value);

    return (
        <Select
            variant="standard"
            fullWidth
            displayEmpty
            value={players ? value || '' : ''}
            onChange={e => onChange(String(e.target.value))}
        >
            <MenuItem value="">
                <em>{emptyLabel}</em>
            </MenuItem>
            {players?.map(item => (
                <MenuItem
                    key={item.player}
                    value={item.player}
                >
                    {item.name}
                </MenuItem>
            ))}
            {unknown ? <MenuItem value={value}>{value}</MenuItem> : null}
        </Select>
    );
}

/**
 * The attribute field "start player": a list of the players of the selected instance, instead of an ID
 * to be typed in
 *
 * @param emptyLabel text of the empty entry
 */
export function playerField(
    emptyLabel: () => string,
): (
    field: RxWidgetInfoAttributesField,
    data: WidgetData,
    onDataChange: (newData: WidgetData) => void,
    props: RxWidgetInfoCustomComponentProperties,
) => React.JSX.Element {
    return function PlayerField(field, data, onDataChange, props) {
        const name = field.name || 'defaultPlayer';
        return (
            <PlayerSelect
                value={String(data[name] || '')}
                instance={String(data.instance ?? '')}
                socket={props.context.socket}
                emptyLabel={emptyLabel()}
                onChange={value => onDataChange({ [name]: value })}
            />
        );
    };
}
