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

window.overlayApi.onMemeData((payload) => {
  const mediaContainer = document.getElementById('media-container');
  const caption = document.getElementById('caption');
  const authorAvatar = document.getElementById('author-avatar');
  const authorName = document.getElementById('author-name');
  const root = document.getElementById('root');

  root.classList.add(payload.x >= 50 ? 'align-right' : 'align-left');
  // uiScale = actual window width / the 480px the CSS was designed for
  // (computed in the main process, after clamping to the screen).
  root.style.setProperty('--scale', typeof payload.uiScale === 'number' ? payload.uiScale : 1);

  authorAvatar.src = payload.author.avatarUrl;
  authorName.textContent = payload.author.name;

  if (payload.text) {
    caption.textContent = payload.text;
    caption.hidden = false;
  } else {
    caption.hidden = true;
  }

  if (payload.mediaUrl) {
    if (payload.mediaType === 'video') {
      const video = document.createElement('video');
      video.src = payload.mediaUrl;
      video.autoplay = true;
      video.loop = true;
      video.playsInline = true;
      video.volume = typeof payload.volume === 'number' ? Math.min(Math.max(payload.volume, 0), 1) : 0.5;
      video.muted = video.volume === 0;
      video.addEventListener('loadedmetadata', () => fitMedia(video, video.videoWidth, video.videoHeight));
      mediaContainer.appendChild(video);
    } else {
      const img = document.createElement('img');
      img.addEventListener('load', () => fitMedia(img, img.naturalWidth, img.naturalHeight));
      img.src = payload.mediaUrl;
      mediaContainer.appendChild(img);
    }
    mediaContainer.hidden = false;
  } else {
    mediaContainer.hidden = true;
  }

  const fadeOutBefore = 300;
  const totalMs = payload.duration * 1000;

  setTimeout(() => {
    root.classList.remove('fade-in');
    root.classList.add('fade-out');
  }, Math.max(totalMs - fadeOutBefore, 0));
});
