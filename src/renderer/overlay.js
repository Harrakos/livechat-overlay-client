const DEFAULT_DURATION_S = 10;
// A video with no explicit duree plays to its end, capped so one very long
// video cannot block the queue. Keep in sync with MAX_SHOW_MS in
// overlayWindow.js.
const MAX_VIDEO_S = 120;
// Longest we wait for the avatar / media before showing the meme anyway.
const LOAD_TIMEOUT_MS = 10_000;

// Resolves true when `okEvent` fires (or `alreadyDone`), false on error or
// timeout. Never rejects, so a broken avatar or media cannot hang the meme.
function waitFor(el, okEvent, alreadyDone) {
  return new Promise((resolve) => {
    if (alreadyDone) {
      resolve(true);
      return;
    }
    const timer = setTimeout(() => resolve(false), LOAD_TIMEOUT_MS);
    const finish = (ok) => {
      clearTimeout(timer);
      resolve(ok);
    };
    el.addEventListener(okEvent, () => finish(true), { once: true });
    el.addEventListener('error', () => finish(false), { once: true });
  });
}

// Sizes the media to fill whatever room is left in the window once the badge
// and caption have taken theirs, keeping its aspect ratio. Unlike a CSS
// max-height (a cap that never enlarges), this also scales small images up,
// and it never lets the media overflow and get cropped.
function fitMedia(el, naturalW, naturalH) {
  const root = document.getElementById('root');
  if (!naturalW || !naturalH) {
    el.style.width = 'auto';
    el.style.height = 'auto';
    el.style.visibility = 'visible';
    return;
  }

  const rootStyle = getComputedStyle(root);
  const padX = parseFloat(rootStyle.paddingLeft) + parseFloat(rootStyle.paddingRight);
  const padY = parseFloat(rootStyle.paddingTop) + parseFloat(rootStyle.paddingBottom);

  let usedHeight = 0;
  for (const id of ['author-badge', 'caption']) {
    const node = document.getElementById(id);
    if (node.hidden) continue;
    const style = getComputedStyle(node);
    usedHeight += node.offsetHeight + parseFloat(style.marginTop) + parseFloat(style.marginBottom);
  }

  const availW = window.innerWidth - padX;
  const availH = window.innerHeight - padY - usedHeight;
  const ratio = Math.max(Math.min(availW / naturalW, availH / naturalH), 0.05);

  el.style.width = `${Math.floor(naturalW * ratio)}px`;
  el.style.height = `${Math.floor(naturalH * ratio)}px`;
  el.style.visibility = 'visible';
}

function createMedia(payload) {
  if (payload.mediaType === 'video') {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.playsInline = true;
    // Without an explicit duree the video plays once, to its end. With one,
    // it loops until that time is up.
    video.loop = payload.duration != null;
    video.volume = typeof payload.volume === 'number' ? Math.min(Math.max(payload.volume, 0), 1) : 0.5;
    video.muted = video.volume === 0;
    // Deliberately no autoplay: playback starts only once the window is
    // visible, so the first seconds (and their sound) are not played unseen.
    video.src = payload.mediaUrl;
    return { el: video, loaded: waitFor(video, 'loadeddata', video.readyState >= 2) };
  }

  const img = document.createElement('img');
  img.src = payload.mediaUrl;
  return { el: img, loaded: waitFor(img, 'load', img.complete && img.naturalWidth > 0) };
}

function displayDurationMs(payload, video) {
  if (payload.duration != null) return payload.duration * 1000;
  if (video && Number.isFinite(video.duration) && video.duration > 0) {
    return Math.min(video.duration, MAX_VIDEO_S) * 1000;
  }
  return DEFAULT_DURATION_S * 1000;
}

window.overlayApi.onMemeData(async (payload) => {
  const mediaContainer = document.getElementById('media-container');
  const caption = document.getElementById('caption');
  const authorAvatar = document.getElementById('author-avatar');
  const authorName = document.getElementById('author-name');
  const root = document.getElementById('root');

  root.classList.add(payload.x >= 50 ? 'align-right' : 'align-left');

  authorName.textContent = payload.author.name;
  authorAvatar.src = payload.author.avatarUrl;
  const avatarLoaded = waitFor(authorAvatar, 'load', authorAvatar.complete && authorAvatar.naturalWidth > 0);

  if (payload.text) {
    caption.textContent = payload.text;
    caption.hidden = false;
  } else {
    caption.hidden = true;
  }

  const media = payload.mediaUrl ? createMedia(payload) : null;
  if (media) mediaContainer.appendChild(media.el);

  // Everything is prepared while the window is still hidden, and shown in
  // one go: avatar, font, text and media all appear together instead of
  // popping in one after the other as they finish loading.
  const [, mediaOk] = await Promise.all([avatarLoaded, media ? media.loaded : true, document.fonts.ready]);

  let video = null;
  if (media && mediaOk) {
    const el = media.el;
    if (payload.mediaType === 'video') {
      video = el;
      fitMedia(el, el.videoWidth, el.videoHeight);
    } else {
      fitMedia(el, el.naturalWidth, el.naturalHeight);
    }
    mediaContainer.hidden = false;
  } else {
    // No media, or it failed to load: show the rest rather than nothing.
    if (media) media.el.remove();
    mediaContainer.hidden = true;
  }

  await window.overlayApi.ready();
  if (video) video.play().catch((error) => console.error('Video playback failed:', error));

  const totalMs = displayDurationMs(payload, video);
  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    window.overlayApi.done();
  };

  if (video && payload.duration == null) {
    // Play to the very end: wait for the video itself rather than a timer,
    // so the last frames are never cut short by startup latency.
    video.addEventListener('ended', finish, { once: true });
    video.addEventListener('error', finish, { once: true });
    setTimeout(finish, totalMs + 3000); // fallback if 'ended' never fires
  } else {
    setTimeout(finish, totalMs);
  }
});
