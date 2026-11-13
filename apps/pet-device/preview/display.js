// Screen-only idle simulation. Background task/network simulation continues.
(() => {
  const device = document.querySelector('.device');
  const cover = document.createElement('div');
  cover.style.cssText = 'position:absolute;inset:0;background:black;z-index:100;display:none;cursor:pointer';
  cover.setAttribute('aria-label', 'Screen off. Touch to wake'); device.append(cover);
  let timeout = 120;
  try { const saved = Number(localStorage.getItem('study_pet_preview_screen') ?? 120); if ([0, 60, 120, 300].includes(saved)) timeout = saved; } catch {}
  let lastTouch = performance.now(), pressed = false, swallow = false, suppressClick = false;
  window.displayPreview = {
    asleep: false,
    get timeout() { return timeout; },
    setTimeout(seconds) {
      if (![0, 60, 120, 300].includes(seconds)) return false;
      try { localStorage.setItem('study_pet_preview_screen', String(seconds)); } catch { return false; }
      timeout = seconds; lastTouch = performance.now(); return true;
    },
    sleep() { this.asleep = true; cover.style.display = 'block'; },
  };
  device.addEventListener('pointerdown', event => {
    lastTouch = performance.now(); pressed = true; suppressClick = false;
    if (displayPreview.asleep) {
      displayPreview.asleep = false; cover.style.display = 'none'; swallow = suppressClick = true;
      event.preventDefault(); event.stopImmediatePropagation();
    }
  }, true);
  for (const eventName of ['pointerup', 'pointercancel']) device.addEventListener(eventName, event => {
    lastTouch = performance.now(); pressed = false;
    if (swallow) {
      event.preventDefault(); event.stopImmediatePropagation(); swallow = false;
      setTimeout(() => { suppressClick = false; }, 0);
    }
  }, true);
  device.addEventListener('click', event => {
    if (suppressClick) { event.preventDefault(); event.stopImmediatePropagation(); suppressClick = false; }
  }, true);
  setInterval(() => {
    if (timeout && !pressed && performance.now() - lastTouch >= timeout * 1000) displayPreview.sleep();
  }, 250);
  const button = document.createElement('button'); button.textContent = '模拟熄屏';
  button.onclick = () => displayPreview.sleep(); document.querySelector('.controls').append(button);
})();
