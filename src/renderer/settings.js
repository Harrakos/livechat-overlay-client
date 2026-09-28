const slider = document.getElementById('volume');
const valueLabel = document.getElementById('volume-value');

function render(volume) {
  const percent = Math.round(volume * 100);
  slider.value = percent;
  valueLabel.textContent = `${percent}%`;
}

window.settingsApi.get().then((settings) => render(settings.volume));

slider.addEventListener('input', () => {
  const volume = Number(slider.value) / 100;
  valueLabel.textContent = `${slider.value}%`;
  window.settingsApi.set({ volume });
});
