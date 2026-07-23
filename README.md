# SCMix Pro

Browser extension concept for SoundCloud-style AutoDJ mixing.

## Mixing engine

The starter now includes a Web Audio powered mixing engine in `app/mixing-engine.js`:

- Two-deck playback with independent load, play, pause, stop, and position tracking.
- Equal-power crossfading for smoother transitions between decks.
- Per-deck three-band EQ using low-shelf, peaking mid, and high-shelf filters.
- Master gain control and AutoMix scheduling near the end of the active track.

`app/automix.js` exposes a small AutoMix facade that loads the first two playlist entries, starts deck A, and schedules a transition to deck B when a second track is available.

This is still a browser-extension prototype; a SoundCloud page integration must provide playable audio URLs or decoded `AudioBuffer` objects before AutoMix can start real playback.
