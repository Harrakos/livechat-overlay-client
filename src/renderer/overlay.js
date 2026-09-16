window.overlayApi.onMemeData((payload) => {
  const mediaContainer = document.getElementById('media-container');
  const caption = document.getElementById('caption');
  const authorAvatar = document.getElementById('author-avatar');
  const authorName = document.getElementById('author-name');
  const root = document.getElementById('root');

  root.classList.add(payload.x >= 50 ? 'align-right' : 'align-left');

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
      video.muted = true;
      video.playsInline = true;
      mediaContainer.appendChild(video);
    } else {
      const img = document.createElement('img');
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
