![Logo](admin/music-assistant.png)
# ioBroker.music-assistant

[![NPM version](https://img.shields.io/npm/v/iobroker.music-assistant.svg)](https://www.npmjs.com/package/iobroker.music-assistant)
[![Downloads](https://img.shields.io/npm/dm/iobroker.music-assistant.svg)](https://www.npmjs.com/package/iobroker.music-assistant)
![Number of Installations](https://iobroker.live/badges/music-assistant-installed.svg)
![Current version in stable repository](https://iobroker.live/badges/music-assistant-stable.svg)

[![NPM](https://nodei.co/npm/iobroker.music-assistant.png?downloads=true)](https://nodei.co/npm/iobroker.music-assistant/)

**Tests:** ![Test and Release](https://github.com/NurPech/ioBroker.music-assistant/workflows/Test%20and%20Release/badge.svg)

## music-assistant adapter for ioBroker

Control Music Assistant players and queues from ioBroker

> **Disclaimer:** This is an unofficial, community-made adapter. It is not affiliated with,
> endorsed by, or supported by the Music Assistant project or the Open Home Foundation.
> "Music Assistant" and its logo are property of their respective owners.

## Prerequisites

- A running [Music Assistant](https://music-assistant.io) server, reachable from your ioBroker host -
  or Docker on the ioBroker host, then the adapter can run the server itself (see [Music Assistant in Docker](#music-assistant-in-docker)).
- An API token (on the Music Assistant server, go to **Settings → Profile** and create a long-lived
  token) or the username and password of a Music Assistant user.

## Configuration

In the adapter instance settings, enter:

| Field               | Description                                                  |
|---------------------|--------------------------------------------------------------|
| Host                | Hostname or IP of the Music Assistant server                 |
| Port                | WebSocket API port (default `8095`)                          |
| Token               | The long-lived API token created above                       |
| Username / Password | Alternative to the token: credentials of a Music Assistant user |

Long-lived tokens expire after one year in Music Assistant. With username and password the adapter
signs in on every start and never runs into this. If both are set, the token is tried first and the
credentials are used once it is refused.

## Music Assistant in Docker

Instead of connecting to an existing server, the adapter can run Music Assistant itself in a Docker
container on the ioBroker host. Docker must be installed and running there, and the `iobroker` user
must have access to the docker CLI (to fix the rights, run `iob fix`).

1. Enable **Run Music Assistant in Docker** in the instance settings, enter a **Username** (default
   `admin`) and a **Password** (at least 8 characters) and save. Host, port and token are hidden then:
   the adapter connects to `127.0.0.1:8095` on its own. The container `iob_music_assistant_<instance>`
   with the image `ghcr.io/music-assistant/server` is created and started.
2. As soon as the server answers, the adapter creates this user as administrator in Music Assistant
   (the same first-time setup the web interface offers) and signs in with it. No token is needed.
3. Open `http://<ioBroker-host>:8095` in the browser - or click the _Music Assistant_ tile on the intro
   page of admin (also shown as link in the instance list; the adapter adds this link and restarts its
   instance once for it) - log in with the same username and password and finish the setup there
   (music sources, player providers).

The user is only created on the very first start, while Music Assistant has no user yet. Changing
username or password in the adapter settings later does not change it in Music Assistant: change the
password in Music Assistant first (**Settings → Profile**), then enter the new one in the adapter
settings. If the credentials are refused, the adapter logs an error and stops retrying until it is restarted.

Notes:

- The container runs with `network_mode: host`, because Music Assistant finds the players (Sonos,
  Chromecast, AirPlay, DLNA, ...) via mDNS/SSDP and the players fetch the audio stream from it. The
  web interface/API (port `8095`) and the stream server (port `8097`) are therefore opened directly on
  the host, and these ports must be free. With js-controller 8 the adapter reports both ports as
  used by its instance and warns if another instance already holds one of them. Host networking works on Linux; on Docker Desktop
  (Windows/macOS) it has to be enabled in the Docker settings and discovery may still be limited.
- All settings and the library live in the docker volume `ma_data` (`iob_music_assistant_<instance>_ma_data`),
  so they survive an update or a re-creation of the container. The volume is included in ioBroker backups.
- **Auto-update Docker image** pulls the latest image on every adapter start.
- **Stop container when instance stops** stops Music Assistant together with the instance. Disable it
  if Music Assistant should keep playing while the adapter is stopped.
- Network shares (SMB/NFS) that Music Assistant mounts itself need extra container privileges
  (`SYS_ADMIN`, `DAC_READ_SEARCH`), which are not granted. Mount the share on the host instead or run
  Music Assistant yourself if you need this.

## States

For every Music Assistant player, the adapter creates the channel `music-assistant.0.players.<player_id>`
(role `media.music`) with:

| State                                                                         | Description                                                        |
|-------------------------------------------------------------------------------|--------------------------------------------------------------------|
| `state`                                                                       | `0` = pause, `1` = play, `2` = stop (role `media.state`)           |
| `playbackState`                                                               | Raw state of Music Assistant: `idle`, `paused`, `playing`          |
| `available`, `powered`, `name`, `activeSource`, `queueId`                     | Player status (`powered` is writable)                              |
| `volume` (0-100 %), `muted`                                                   | Writable volume control                                            |
| `shuffle`, `repeat` (`0` = off, `1` = all, `2` = one)                         | Writable, the settings of the player's queue                       |
| `mediaTitle`, `mediaArtist`, `mediaAlbum`, `mediaImage`                       | Now-playing metadata                                               |
| `elapsedTime`, `duration`, `seek`                                             | Position and length in seconds; write `seek` to jump to a position |
| `play`, `pause`, `playPause`, `stop`, `next`, `previous`                      | Writable buttons (`button.play`, `button.pause`, ...)              |
| `playMedia`                                                                   | Write a URI or a search text to play it, see below                 |

The player channel is laid out the way `@iobroker/type-detector` expects a media player, so
ioBroker.assistant, ioBroker.devices, the material UI and other adapters recognize it as a media
player. Assign the channel to a room (`enum.rooms`) for that: devices without a room or function are
not offered by these adapters.

Writable states are acknowledged with the value Music Assistant reports after the command, not with
the requested one - a volume the player cannot take shows its real value.

### Play something: `playMedia`

- A **URI** as Music Assistant uses it, e.g. `library://playlist/3`, `spotify://track/4uLU6hMCjMI75M1A2tKUQC`
  or the URL of a stream, is played directly.
- Any other text is **searched** in all music sources. An item whose name is exactly the text wins
  (an artist before a playlist, album or track of the same name), otherwise the best matching track.
- A prefix narrows the search: `artist:Queen`, `album:A Night at the Opera`, `track:Bohemian Rhapsody`,
  `playlist:Party`, `radio:SWR3` (also `podcast:`, `audiobook:`, `genre:`).

It replaces what the player's queue is playing now.

A player that is deleted in Music Assistant is removed in ioBroker as well (also when it was deleted
while the adapter was not running), together with its queue.

For every player queue, `music-assistant.0.queues.<queue_id>` gets:

| State                                                                 | Description              |
|-----------------------------------------------------------------------|--------------------------|
| `state`, `displayName`, `available`, `currentItemName`, `elapsedTime` | Queue status             |
| `shuffleEnabled`, `repeatMode`                                        | Writable queue settings  |
| `control.play` / `pause` / `playPause` / `stop` / `next` / `previous` | Writable control buttons |

## For developers

```bash
npm install
npm run build   # compile TypeScript
npm run test    # type-check + package tests
npm run lint    # ESLint
dev-server run  # run against a local test ioBroker instance (see README note below)
```

Note: `dev-server watch` relies on Windows' `wmic.exe` to manage child processes, which newer
Windows 11 builds no longer ship by default. On such machines use `dev-server run` and
start/stop the instance manually from the Admin UI instead.

## Changelog
<!--
    Placeholder for the next version (at the beginning of the line):
    ### **WORK IN PROGRESS**
-->
### **WORK IN PROGRESS**
* (@GermanBluefox) Breaking change: the buttons of a player moved from `players.<id>.control.*` directly into `players.<id>` and got the roles `button.play`, `button.pause`, ... The old `control` channel is deleted on the first start
* (@GermanBluefox) Players are now recognized as media players by the type-detector (ioBroker.assistant, devices, ...): new numeric state `state` (`media.state`), `playbackState` keeps the raw text with the role `text`; `shuffle`, `repeat`, `duration` and `seek` were added to the player
* (@GermanBluefox) Added `playMedia` to play a URI or the best hit of a search text
* (@GermanBluefox) Players and queues deleted in Music Assistant are removed from ioBroker
* (@GermanBluefox) Written values are acknowledged with what Music Assistant reports after the command
* (@GermanBluefox) States are only written when their value changes
* (@GermanBluefox) Added the option to run Music Assistant in Docker on the ioBroker host
* (@GermanBluefox) In Docker mode the adapter creates the admin user of Music Assistant itself and signs in with username/password - no token needed
* (@GermanBluefox) Username/password can be used instead of a token for an existing server as well
* (@GermanBluefox) In Docker mode the host ports of the container (`8095`, `8097`) are reported to js-controller 8 (`registerUsedResource`)

### 0.0.2 (2026-10-18)
* (M1kad0) republish to fix the npm release

### 0.0.1 (2026-10-18)
* (M1kad0) initial release

[Older changelogs can be found there](CHANGELOG_OLD.md)

## License
MIT License

Copyright (c) 2026 M1kad0 <leonie+iobroker@sgessinger.de>

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.