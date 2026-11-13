// Browser simulator. Species data is generated from the same pets/*.json as firmware.
(() => {
  const profile = window.petProfiles.husky;
  const minute = value => Number(value.slice(0, 2)) * 60 + Number(value.slice(3));
  const maxAge = 7 * 86400;
  let offset = 0, last = Date.now(), ages = {eat: 0, drink: 0, pet: 0}, nap = 0, wake = 0;
  const now = () => Date.now() + offset;
  const advance = seconds => {
    for (const key of Object.keys(ages)) ages[key] = Math.min(maxAge, ages[key] + seconds);
    nap = Math.max(0, nap - seconds); wake = Math.max(0, wake - seconds);
  };
  window.previewPet = {
    tick() { const time = now(); advance(Math.max(0, (time - last) / 1000)); last = time; },
    mood() {
      const second = Math.floor(now() / 1000 + profile.timezone_offset_minutes * 60) % 86400;
      const currentMinute = Math.floor(second / 60);
      const asleep = profile.sleep_windows.some(([a, b]) => {
        a = minute(a); b = minute(b);
        return a < b ? currentMinute >= a && currentMinute < b : currentMinute >= a || currentMinute < b;
      });
      if (nap || (!wake && asleep)) return 'sleep';
      if (ages.drink >= profile.water_interval_minutes * 60) return 'thirsty';
      const sinceMeal = Math.min(...profile.meals.map(m => (second + 86400 - minute(m) * 60) % 86400));
      if (ages.eat >= profile.minimum_meal_gap_minutes * 60 && ages.eat > sinceMeal) return 'hungry';
      if (!wake && profile.sleep_windows.some(([start]) => {
        const until = (minute(start) * 60 + 86400 - second) % 86400;
        return until > 0 && until <= profile.sleepy_lead_minutes * 60;
      })) return 'sleepy';
      if (ages.pet >= profile.companionship_interval_minutes * 60) return 'lonely';
      return 'idle';
    },
    care(action) { this.tick(); ages[action] = 0; nap = 0; wake = profile.wake_grace_minutes * 60; },
    toggleSleep() {
      this.tick(); const sleeping = this.mood() === 'sleep';
      nap = sleeping ? 0 : profile.manual_nap_minutes * 60;
      wake = sleeping ? profile.wake_grace_minutes * 60 : 0;
    },
    advance(seconds) { offset += seconds * 1000; this.tick(); },
    setTime(hour, minuteValue) {
      const date = new Date(now() + profile.timezone_offset_minutes * 60000);
      date.setUTCHours(hour, minuteValue, 0, 0);
      offset = date.getTime() - profile.timezone_offset_minutes * 60000 - Date.now();
      last = now();
    },
    reset() { ages = {eat: 0, drink: 0, pet: 0}; nap = wake = 0; last = now(); },
    timeText() { return new Date(now() + profile.timezone_offset_minutes * 60000).toISOString().slice(11, 16); },
  };
  document.addEventListener('DOMContentLoaded', () => {
    const controls = document.querySelector('.controls');
    const panel = document.createElement('div'); panel.style.marginTop = '12px';
    const status = document.createElement('div');
    const refresh = () => { status.textContent = `模拟时间 ${previewPet.timeText()} · ${previewPet.mood()}（不会修改电脑时间）`; };
    panel.append(status);
    for (const [text, run] of [
      ['过 30 分钟', () => previewPet.advance(1800)],
      ['过 2 小时', () => previewPet.advance(7200)],
      ['查看夜间 22:00', () => previewPet.setTime(22, 0)],
      ['查看白天 09:00', () => previewPet.setTime(9, 0)],
      ['重置照顾状态', () => previewPet.reset()],
    ]) {
      const button = document.createElement('button'); button.textContent = text;
      button.onclick = () => { run(); setMenu(false); setAction(previewPet.mood()); refresh(); };
      panel.append(button);
    }
    controls.append(panel); refresh(); setInterval(refresh, 1000);
  });
})();
