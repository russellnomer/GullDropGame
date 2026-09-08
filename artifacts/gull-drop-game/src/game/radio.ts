import { useGame } from "./store";
import { fault } from "./log";

export type Track = {
  id: string;
  title: string;
  artist: string;
  url: string;
};

export const TRACKS: Track[] = [
  {
    id: "NGgNoByc1Qg",
    title: "Boardwalk Shakedown (Shady Squirrel Edition)",
    artist: "Russell Nomer",
    url: "https://www.youtube.com/watch?v=NGgNoByc1Qg",
  },
  {
    id: "fu4e3_QGjpM",
    title: "Boardwalk Shakedown (Squirrel Style)",
    artist: "Russell Nomer",
    url: "https://www.youtube.com/watch?v=fu4e3_QGjpM",
  },
  {
    id: "Rq3E0cjo10Y",
    title: "Judge Nutcracker",
    artist: "Russell Nomer",
    url: "https://www.youtube.com/watch?v=Rq3E0cjo10Y",
  },
  {
    id: "aaTQgo7n608",
    title: "Sigmund Fraud: Hypnotic Tailed Head Shrinker",
    artist: "Russell Nomer",
    url: "https://www.youtube.com/watch?v=aaTQgo7n608",
  },
];

export const TRACK = TRACKS[0];
export const RELEASES_URL = "https://www.youtube.com/@russellnomermusic/releases";
const FEATURED = TRACKS.map((t) => t.id).join(",");

type YtPlayer = {
  playVideo: () => void;
  pauseVideo: () => void;
  mute: () => void;
  unMute: () => void;
  setVolume: (n: number) => void;
  nextVideo: () => void;
  previousVideo: () => void;
  setLoop?: (on: boolean) => void;
  setShuffle?: (on: boolean) => void;
  cuePlaylist?: (opts: { listType?: string; list?: string; playlist?: string; index?: number }) => void;
  loadPlaylist?: (opts: { listType?: string; list?: string; playlist?: string; index?: number }) => void;
  getVideoData?: () => { video_id?: string; title?: string };
};

type YtNS = {
  Player: new (
    el: string | HTMLElement,
    opts: {
      videoId?: string;
      width?: number | string;
      height?: number | string;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (e: { target: YtPlayer }) => void;
        onStateChange?: (e: { data: number; target: YtPlayer }) => void;
        onError?: () => void;
      };
    },
  ) => YtPlayer;
  PlayerState?: { ENDED: number; PLAYING: number };
};

declare global {
  interface Window {
    YT?: YtNS;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let player: YtPlayer | null = null;
let ready = false;
let wantPlay = false;
let hooked = false;
const waiters: Array<() => void> = [];
const nowListeners = new Set<(t: Track) => void>();
let now: Track = TRACKS[0];

export function nowPlaying(): Track {
  return now;
}

export function onNowPlaying(fn: (t: Track) => void) {
  nowListeners.add(fn);
  fn(now);
  return () => {
    nowListeners.delete(fn);
  };
}

function setNowFromPlayer() {
  const data = player?.getVideoData?.();
  if (!data) return;
  const hit = TRACKS.find((t) => t.id === data.video_id);
  const next: Track = hit ?? {
    id: data.video_id ?? "",
    title: data.title?.replace(/\s+/g, " ").trim() || "Russell Nomer",
    artist: "Russell Nomer",
    url: data.video_id ? `https://www.youtube.com/watch?v=${data.video_id}` : RELEASES_URL,
  };
  if (next.id === now.id && next.title === now.title) return;
  now = next;
  for (const fn of nowListeners) fn(now);
}

function api(): Promise<YtNS> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  return new Promise((resolve) => {
    waiters.push(() => resolve(window.YT as YtNS));
    if (document.getElementById("yt-iframe-api")) return;
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prev?.();
      for (const w of waiters) w();
      waiters.length = 0;
    };
    const s = document.createElement("script");
    s.id = "yt-iframe-api";
    s.src = "https://www.youtube.com/iframe_api";
    document.head.appendChild(s);
  });
}

function radioSilent(): boolean {
  const s = useGame.getState();
  return s.muted || s.radioOff;
}

function applyMute() {
  if (!player || !ready) return;
  if (radioSilent()) {
    player.mute();
    player.pauseVideo();
    return;
  }
  player.unMute();
  player.setVolume(14);
  if (wantPlay) player.playVideo();
}

function hookStore() {
  if (hooked) return;
  hooked = true;
  useGame.subscribe((s, p) => {
    if (s.muted !== p.muted || s.radioOff !== p.radioOff) applyMute();
  });
}

let skipGuard = 0;
let skipAt = 0;

export function mountRadio(el: HTMLElement) {
  if (player) return;
  hookStore();
  void api()
    .then((YT) => {
      if (player) return;
      player = new YT.Player(el, {
        videoId: TRACKS[0].id,
        width: "100%",
        height: "100%",
        playerVars: {
          autoplay: 0,
          loop: 1,
          playlist: FEATURED,
          controls: 1,
          modestbranding: 1,
          rel: 0,
          playsinline: 1,
          origin: window.location.origin,
          fs: 0,
        },
        events: {
          onReady: (e) => {
            ready = true;
            e.target.setVolume(14);
            e.target.setLoop?.(true);
            applyMute();
            if (wantPlay && !radioSilent()) e.target.playVideo();
          },
          onStateChange: (e) => {
            try {
              setNowFromPlayer();
            } catch (err) {
              fault("warn", "radio title", err);
            }
          },
          onError: () => {
            const now = Date.now();
            if (now - skipAt < 1200) return;
            skipAt = now;
            skipGuard += 1;
            if (skipGuard > 6) {
              fault("warn", "radio skipped too many tracks");
              return;
            }
            try {
              player?.nextVideo();
            } catch (err) {
              fault("warn", "radio skip", err);
            }
          },
        },
      });
    })
    .catch((err) => fault("error", "YouTube radio failed", err));
}

export function startRadio() {
  wantPlay = true;
  hookStore();
  applyMute();
  if (player && ready && !radioSilent()) player.playVideo();
}

export function skipRadio() {
  if (!player || !ready) return;
  player.nextVideo();
}

export function prevRadio() {
  if (!player || !ready) return;
  player.previousVideo();
}
