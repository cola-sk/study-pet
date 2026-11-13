// Browser preview only: network results are simulated; no Wi-Fi credentials are saved.
const settingsPreview = document.createElement('section');
settingsPreview.id = 'settings';
settingsPreview.hidden = true;
settingsPreview.className = 'settings-preview';
document.querySelector('.device').append(settingsPreview);
let previewNetwork = 'S26', previewJoinTimer;
function previewPage(title, back) {
  clearTimeout(previewJoinTimer);
  settingsPreview.replaceChildren();
  const header = document.createElement('header');
  const button = document.createElement('button');
  button.textContent = '‹'; button.onclick = back;
  const text = document.createElement('span'); text.textContent = title;
  header.append(button, text); settingsPreview.append(header);
}
function previewButton(parent, name, callback) {
  const button = document.createElement('button'); button.textContent = name; button.onclick = callback; parent.append(button); return button;
}
function previewCard(name, line, detail, top, height, callback) {
  const card = document.createElement('div'); card.className = 'settings-card'; card.style.top = top + 'px'; card.style.height = height + 'px';
  const heading = document.createElement('div'); heading.textContent = name;
  const value = document.createElement('div'); value.className = 'settings-value'; value.textContent = line;
  const hint = document.createElement('small'); hint.textContent = detail;
  card.append(heading, value, hint); if (callback) {card.onclick = callback; card.style.cursor = 'pointer';}
  settingsPreview.append(card); return card;
}
function showPreviewSettings() {
  setMenu(false); settingsPreview.hidden = false;
  previewPage('Settings', () => { settingsPreview.hidden = true; });
  const wallet = previewCard('Credits', coins + ' credits', 'Updated just now', 52, 100);
  previewButton(wallet, 'Sync now', () => { wallet.querySelector('small').textContent = 'Synced (preview)'; }).className = 'preview-sync';
  previewCard('Wi-Fi', previewNetwork, 'Connected  ›', 160, 76, showPreviewWifi);
  previewCard('Device', 'Family paired  ›', '', 244, 60, () => {
    previewPage('Device', showPreviewSettings);
    const details = document.createElement('p'); details.className = 'settings-details'; details.textContent = 'PET-PREVIEW\n\nFirmware: browser preview\n\nFamily paired\n\nManage child assignment\nin the parent app.'; settingsPreview.append(details);
  });
}
function showPreviewWifi() {
  previewPage('Wi-Fi / 2.4 GHz', showPreviewSettings);
  const current = document.createElement('p'); current.className = 'preview-current'; current.textContent = previewNetwork + '\nConnected'; settingsPreview.append(current);
  const controls = document.createElement('div'); controls.className = 'preview-wifi-controls';
  previewButton(controls, 'Scan', () => { list.textContent = 'Scanning...'; previewJoinTimer = setTimeout(fill, 600); });
  previewButton(controls, 'Manual', () => showPreviewJoin('')); settingsPreview.append(controls);
  const list = document.createElement('div'); list.className = 'preview-networks'; settingsPreview.append(list);
  function fill() { list.replaceChildren(); ['S26', 'Guest'].forEach(name => previewButton(list, name + (name === 'Guest' ? ' · Open' : ' · Password'), () => showPreviewJoin(name))); }
  fill();
}
function showPreviewJoin(name) {
  previewPage('Join network', showPreviewWifi);
  const form = document.createElement('form'); form.className = 'preview-join'; form.onsubmit = event => {event.preventDefault(); connect();};
  const ssidLabel = document.createElement('label'); ssidLabel.textContent = 'Network name';
  const ssid = document.createElement('input'); ssid.value = name; ssid.maxLength = 32; ssid.autocomplete = 'off';
  const passwordLabel = document.createElement('label'); passwordLabel.textContent = 'Password';
  const passwordRow = document.createElement('div'); passwordRow.className = 'preview-password';
  const password = document.createElement('input'); password.type = 'password'; password.maxLength = 64; password.autocomplete = 'off';
  const toggle = previewButton(passwordRow, 'Show', () => {password.type = password.type === 'password' ? 'text' : 'password'; toggle.textContent = password.type === 'password' ? 'Show' : 'Hide';}); toggle.type = 'button'; passwordRow.prepend(password);
  form.append(ssidLabel, ssid, passwordLabel, passwordRow);
  const submit = previewButton(form, 'Connect', () => {}); submit.type = 'submit';
  const note = document.createElement('small'); note.textContent = 'Preview only. Type with your computer keyboard; no network changes are made.'; form.append(note);
  settingsPreview.append(form);
  function connect() {
    if (!ssid.value || new TextEncoder().encode(ssid.value).length > 32) {note.textContent = 'SSID must be 1–32 bytes.'; return;}
    const pass = password.value;
    if (pass && !((pass.length >= 8 && pass.length <= 63) || /^[0-9a-f]{64}$/i.test(pass))) {note.textContent = 'Password must be 8–63 characters or a 64-digit hex key.'; return;}
    const target = ssid.value;
    previewPage('Wi-Fi connection', showPreviewWifi);
    const message = document.createElement('p'); message.className = 'settings-details'; message.textContent = target + '\n\nConnecting...'; settingsPreview.append(message);
    const cancel = previewButton(settingsPreview, 'Cancel', showPreviewWifi); cancel.className = 'preview-progress';
    previewJoinTimer = setTimeout(() => {previewNetwork = target; message.textContent = target + '\n\nConnected (simulated).'; cancel.textContent = 'Back to Settings'; cancel.onclick = showPreviewSettings;}, 1200);
  }
}
document.querySelector('#balance').onclick = showPreviewSettings;
document.querySelector('#sync').textContent = 'Settings ⚙';
document.querySelector('.controls').prepend('Settings 中的 Wi-Fi 也是模拟数据。');
