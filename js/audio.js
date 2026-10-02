// Sound examples for project pages. Loaded only when a project lists audio.
// Rules: nothing autoplays, one example plays at a time, every row can stop,
// and one volume control applies to all of them.
let current = null;
let volume = 0.8;

document.addEventListener('soundfx:stop-audio', () => current?.stop());

export function renderSoundList(container, sounds) {
  container.innerHTML = `
    <h3>Listen</h3>
    <ul class="sound-list">
      ${sounds.map((s, i) => `
        <li class="sound-row">
          <button class="round-btn" type="button" data-sound="${i}" aria-label="Play ${s.title.replace(/"/g, '&quot;')}">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <span class="sound-row__title">${s.title.replace(/</g, '&lt;')}</span>
        </li>`).join('')}
    </ul>
    <label class="sound-volume">Volume <input type="range" min="0" max="1" step="0.05" value="${volume}" data-volume></label>`;

  const audios = sounds.map((s) => { const a = new Audio(); a.preload = 'none'; a.src = s.src; a.volume = volume; return a; });
  const buttons = [...container.querySelectorAll('[data-sound]')];
  const icon = (btn, playing) => {
    btn.querySelector('path').setAttribute('d', playing ? 'M7 5h4v14H7zM13 5h4v14h-4z' : 'M8 5v14l11-7z');
    btn.setAttribute('aria-label', `${playing ? 'Stop' : 'Play'} ${sounds[+btn.dataset.sound].title}`);
  };

  buttons.forEach((btn, i) => {
    const audio = audios[i];
    const entry = { stop() { audio.pause(); audio.currentTime = 0; icon(btn, false); if (current === entry) current = null; } };
    audio.addEventListener('ended', () => entry.stop());
    btn.addEventListener('click', () => {
      if (current === entry) { entry.stop(); return; }
      current?.stop();
      current = entry;
      audio.volume = volume;
      audio.play().then(() => icon(btn, true)).catch(() => entry.stop());
    });
  });

  container.querySelector('[data-volume]').addEventListener('input', (e) => {
    volume = +e.target.value;
    audios.forEach((a) => { a.volume = volume; });
  });
}
