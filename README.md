# SCMix Pro

Browser extension concept for SoundCloud-style AutoDJ mixing.


## Project manifest

The repository includes a root `package.json` so JavaScript tooling can detect the SCMix Pro package metadata and run the included manifest validation script:

```sh
npm test
```

## Mixing engine

The starter now includes a Web Audio powered mixing engine in `app/mixing-engine.js`:

- Two-deck playback with independent load, play, pause, stop, and position tracking.
- Equal-power crossfading for smoother transitions between decks.
- Per-deck three-band EQ using low-shelf, peaking mid, and high-shelf filters.
- Master gain control and AutoMix scheduling near the end of the active track.
- A stereo `MediaStreamDestination` output so the mixed signal can be selected by meeting tools or a virtual audio device.
- External browser-audio inputs that can be routed into the master mix without adding screen video.

`app/automix.js` exposes a small AutoMix facade that loads the first two playlist entries, starts deck A, and schedules a transition to deck B when a second track is available.

## Zoom musician audio bridge

`app/zoom-audio-bridge.js` adds a Zoom-focused audio profile and browser-audio capture helper:

- Presents a setup checklist for Zoom's **Original Sound for Musicians** workflow.
- Calls out **High fidelity music mode**, **Stereo audio**, and **Echo cancellation** so performers can confirm those Zoom settings before joining or streaming.
- Uses the browser extension `tabCapture` permission to capture the current tab with `{ audio: true, video: false }`, allowing browser audio to be added to the SCMix Pro stream without sharing the screen.

Zoom desktop clients do not allow a browser extension to toggle Original Sound, High fidelity music mode, Stereo audio, or Echo cancellation directly. Enable those settings in Zoom, then choose the SCMix Pro stream through a supported virtual audio device or use Zoom Web's tab-audio sharing path.

This is still a browser-extension prototype; a SoundCloud page integration must provide playable audio URLs or decoded `AudioBuffer` objects before AutoMix can start real playback.
