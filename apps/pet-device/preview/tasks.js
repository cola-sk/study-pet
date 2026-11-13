// Standalone visual simulation: no network requests or real credits.
const tasksPreview = document.createElement('section');
tasksPreview.id = 'tasks-preview'; tasksPreview.className = 'tasks-preview'; tasksPreview.hidden = true;
document.querySelector('.device').append(tasksPreview);
const previewTasks = [
  { title: '自主阅读绘本十五分钟', description: '读完后和家长分享一个喜欢的故事。', reward: 3, parent: true, status: 'pending' },
  { title: '整理学习桌', description: '把书本和文具放回原位。', reward: 2, parent: false, status: 'pending' },
  { title: '喝一杯水', description: '记得慢慢喝水。', reward: 1, parent: false, status: 'pending' },
];
let previewTaskIndex = null, previewOffset = 0;
const previewStatus = { pending: 'To do', submitted: 'Waiting for parent', completed: 'Completed', rejected: 'Try again' };
function taskElement(tag, text, className) {
  const node = document.createElement(tag); node.textContent = text; if (className) node.className = className; return node;
}
function updateTaskHome() {
  document.querySelector('#tasks-home').textContent = `Today ${previewTasks.filter(t => t.status === 'completed').length}/${previewTasks.length}`;
}
function renderTaskPreview() {
  tasksPreview.replaceChildren();
  const task = previewTaskIndex === null ? null : previewTasks[previewTaskIndex];
  const header = taskElement('header', '', 'tasks-header');
  const back = taskElement('button', '‹'); back.onclick = () => { if (task) {previewTaskIndex = null; renderTaskPreview();} else tasksPreview.hidden = true; };
  const title = taskElement('span', task ? 'Task details' : 'Today tasks');
  const refresh = taskElement('button', '↻', 'refresh'); refresh.onclick = renderTaskPreview;
  header.append(back, title, refresh); tasksPreview.append(header);
  tasksPreview.append(taskElement('div', `${new Date().toLocaleDateString('en-CA')}    ${previewTasks.filter(t => t.status === 'completed').length}/${previewTasks.length} done`, 'tasks-summary'));
  const content = taskElement('div', '', 'tasks-content'); tasksPreview.append(content);
  if (task) {
    content.classList.add('tasks-detail');
    content.textContent = `${task.title}\n\n+${task.reward} credits / ${task.parent ? 'Parent confirms' : 'Instant reward'}\n\n${task.description}\n\n${previewStatus[task.status]}`;
    if (task.status === 'rejected') content.append(document.createTextNode('\n\n加油！再检查一次。'));
  } else {
    previewTasks.slice(previewOffset, previewOffset + 10).forEach((item, i) => {
      const row = taskElement('button', '', 'tasks-row');
      row.append(taskElement('span', item.title), taskElement('small', `+${item.reward} cr  ${previewStatus[item.status]}`));
      row.onclick = () => {previewTaskIndex = previewOffset + i; renderTaskPreview();}; content.append(row);
    });
  }
  const footer = taskElement('footer', '', 'tasks-footer'); tasksPreview.append(footer);
  if (task) {
    const submit = taskElement('button', task.status === 'completed' ? 'Completed' : task.status === 'submitted' ? 'Waiting for parent' : task.status === 'rejected' ? 'Try again / Complete' : 'Complete task', 'complete');
    submit.disabled = task.status === 'completed' || task.status === 'submitted';
    submit.onclick = () => {task.status = task.parent ? 'submitted' : 'completed'; if (!task.parent) {coins += task.reward; document.querySelector('#credits').textContent = coins + ' credits'; setAction('happy');} updateTaskHome(); renderTaskPreview();}; footer.append(submit);
  } else {
    const prev = taskElement('button', '‹'); prev.disabled = previewOffset === 0; prev.onclick = () => {previewOffset -= 10; renderTaskPreview();};
    const next = taskElement('button', '›'); next.disabled = previewOffset + 10 >= previewTasks.length; next.onclick = () => {previewOffset += 10; renderTaskPreview();};
    footer.append(prev, taskElement('span', `${Math.floor(previewOffset / 10) + 1} / ${Math.max(1, Math.ceil(previewTasks.length / 10))}`), next);
  }
}
document.querySelector('#tasks-home').onclick = () => {setMenu(false); previewTaskIndex = null; tasksPreview.hidden = false; renderTaskPreview();};
const approvePreview = document.createElement('button'); approvePreview.textContent = '模拟家长批准待确认任务';
approvePreview.onclick = () => {const t = previewTasks.find(item => item.status === 'submitted'); if (!t) return; t.status = 'completed'; coins += t.reward; document.querySelector('#credits').textContent = coins + ' credits'; setAction('happy'); updateTaskHome(); if (!tasksPreview.hidden) renderTaskPreview();};
document.querySelector('.controls').append(approvePreview);
