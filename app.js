(() => {
  'use strict';

  const STORAGE_KEY = 'codex-todo-list-v1';
  const PRIORITIES = ['high', 'medium', 'low'];
  const PRIORITY_LABELS = { high: '高', medium: '中', low: '低' };
  const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

  const elements = {
    addForm: document.querySelector('#addForm'),
    taskTitle: document.querySelector('#taskTitle'),
    taskDue: document.querySelector('#taskDue'),
    priorityPicker: document.querySelector('#priorityPicker'),
    composerPriorityDot: document.querySelector('#composerPriorityDot'),
    progressText: document.querySelector('#progressText'),
    progressPercent: document.querySelector('#progressPercent'),
    progressTrack: document.querySelector('#progressTrack'),
    progressBar: document.querySelector('#progressBar'),
    clearCompleted: document.querySelector('#clearCompleted'),
    todayLabel: document.querySelector('#todayLabel'),
    listTitle: document.querySelector('#listTitle'),
    listCount: document.querySelector('#listCount'),
    taskList: document.querySelector('#taskList'),
    emptyState: document.querySelector('#emptyState'),
    emptyText: document.querySelector('#emptyText'),
    searchInput: document.querySelector('#searchInput'),
    sortOrder: document.querySelector('#sortOrder')
  };

  let tasks = loadTasks();
  let activeFilter = 'all';
  let sortMode = 'created';
  let searchQuery = '';
  let editingId = null;
  let selectedPriority = 'medium';

  const svg = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"></path></svg>',
    calendar: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4" width="18" height="18" rx="2"></rect><path d="M16 2v4"></path><path d="M8 2v4"></path><path d="M3 10h18"></path></svg>',
    edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"></path><path d="m15 5 4 4"></path></svg>',
    trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"></path><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" x2="10" y1="11" y2="17"></line><line x1="14" x2="14" y1="11" y2="17"></line></svg>',
    close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"></path><path d="m6 6 12 12"></path></svg>',
    flag: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"></path><line x1="4" x2="4" y1="22" y2="15"></line></svg>'
  };

  function loadTasks() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return [];
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((task) => task && typeof task.id === 'string' && typeof task.title === 'string')
        .map((task) => ({
          id: task.id,
          title: task.title,
          done: Boolean(task.done),
          due: typeof task.due === 'string' ? task.due : '',
          priority: PRIORITIES.includes(task.priority) ? task.priority : 'medium',
          createdAt: Number(task.createdAt) || Date.now(),
          completedAt: typeof task.completedAt === 'number' ? task.completedAt : null
        }));
    } catch (error) {
      return [];
    }
  }

  function saveTasks() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    } catch (error) {
      // Storage may be unavailable; the app still works for the current session.
    }
  }

  function getVisibleTasks() {
    const query = searchQuery.trim().toLowerCase();
    return tasks
      .filter((task) => {
        if (activeFilter === 'active' && task.done) return false;
        if (activeFilter === 'done' && !task.done) return false;
        if (query && !task.title.toLowerCase().includes(query)) return false;
        return true;
      })
      .sort(compareTasks);
  }

  function compareTasks(a, b) {
    if (a.done !== b.done) return a.done ? 1 : -1;

    const dueValue = (task) => {
      if (!task.due) return Infinity;
      return new Date(`${task.due}T00:00:00`).getTime();
    };

    if (sortMode === 'due') {
      return dueValue(a) - dueValue(b) || b.createdAt - a.createdAt;
    }

    if (sortMode === 'priority') {
      return (
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        dueValue(a) - dueValue(b) ||
        b.createdAt - a.createdAt
      );
    }

    return b.createdAt - a.createdAt;
  }

  function render() {
    const visibleTasks = getVisibleTasks();
    const completedCount = tasks.filter((task) => task.done).length;
    const totalCount = tasks.length;
    const percent = totalCount ? Math.round((completedCount / totalCount) * 100) : 0;

    elements.progressText.textContent = totalCount ? `${completedCount} / ${totalCount} 已完成` : '暂无任务';
    elements.progressPercent.textContent = `${percent}%`;
    elements.progressBar.style.width = `${percent}%`;
    elements.progressTrack.setAttribute('aria-valuenow', String(percent));
    elements.clearCompleted.disabled = completedCount === 0;

    const filterTitles = { all: '全部任务', active: '未完成任务', done: '已完成任务' };
    elements.listTitle.textContent = filterTitles[activeFilter];
    elements.listCount.textContent = `${visibleTasks.length} 项`;

    document.querySelectorAll('.segment').forEach((button) => {
      const isActive = button.dataset.filter === activeFilter;
      button.classList.toggle('is-active', isActive);
      button.setAttribute('aria-selected', String(isActive));
    });

    renderTasks(visibleTasks);
  }

  function renderTasks(items) {
    elements.taskList.replaceChildren();

    if (items.length === 0) {
      elements.taskList.hidden = true;
      elements.emptyState.hidden = false;
      elements.emptyText.textContent = searchQuery.trim() ? '没有匹配的任务' : '暂无任务';
      return;
    }

    elements.taskList.hidden = false;
    elements.emptyState.hidden = true;
    items.forEach((task) => {
      elements.taskList.appendChild(createTaskElement(task));
    });
  }

  function createTaskElement(task) {
    if (task.id === editingId) return createEditElement(task);

    const item = document.createElement('li');
    item.className = `task-item${task.done ? ' is-done' : ''}`;
    item.dataset.id = task.id;

    item.innerHTML = `
      <button type="button" class="check-button" title="${task.done ? '标记为未完成' : '标记为已完成'}" aria-label="${task.done ? '标记为未完成' : '标记为已完成'}">
        ${svg.check}
      </button>
      <div class="task-body">
        <div class="task-title-row">
          <span class="task-title"></span>
          <span class="priority-badge priority-${task.priority}">${svg.flag}<span>${PRIORITY_LABELS[task.priority]}</span></span>
        </div>
        ${task.due ? `<div class="task-meta"><span class="task-due${!task.done && isOverdue(task.due) ? ' is-overdue' : ''}">${svg.calendar}<span class="task-due-text"></span></span></div>` : '<div class="task-meta"></div>'}
      </div>
      <div class="task-actions">
        <button type="button" class="icon-button edit-button" title="编辑任务" aria-label="编辑任务">${svg.edit}</button>
        <button type="button" class="icon-button delete-button" title="删除任务" aria-label="删除任务">${svg.trash}</button>
      </div>
    `;

    item.querySelector('.task-title').textContent = task.title;
    const dueText = item.querySelector('.task-due-text');
    if (dueText) dueText.textContent = formatDueDate(task.due);
    return item;
  }

  function createEditElement(task) {
    const item = document.createElement('li');
    item.className = 'task-item editing';
    item.dataset.id = task.id;
    item.innerHTML = `
      <form class="edit-form" data-edit-form>
        <input type="text" class="edit-title" maxlength="200" aria-label="编辑任务内容">
        <input type="date" class="edit-due" aria-label="编辑截止日期">
        <select class="edit-priority" aria-label="编辑优先级">
          <option value="high">高优先级</option>
          <option value="medium">中优先级</option>
          <option value="low">低优先级</option>
        </select>
        <div class="edit-actions">
          <button type="submit" class="icon-button primary-icon" title="保存" aria-label="保存">${svg.check}</button>
          <button type="button" class="icon-button cancel-edit" title="取消" aria-label="取消">${svg.close}</button>
        </div>
      </form>
    `;

    const titleInput = item.querySelector('.edit-title');
    titleInput.value = task.title;
    item.querySelector('.edit-due').value = task.due;
    item.querySelector('.edit-priority').value = task.priority;

    requestAnimationFrame(() => {
      titleInput.focus();
      titleInput.setSelectionRange(titleInput.value.length, titleInput.value.length);
    });
    return item;
  }

  function createTask(event) {
    event.preventDefault();
    const title = elements.taskTitle.value.trim();
    if (!title) {
      elements.taskTitle.focus();
      return;
    }

    tasks.push({
      id: makeId(),
      title,
      done: false,
      due: elements.taskDue.value,
      priority: selectedPriority,
      createdAt: Date.now(),
      completedAt: null
    });

    elements.taskTitle.value = '';
    saveTasks();
    render();
    elements.taskTitle.focus();
  }

  function toggleTask(id) {
    const task = tasks.find((item) => item.id === id);
    if (!task) return;
    task.done = !task.done;
    task.completedAt = task.done ? Date.now() : null;
    saveTasks();
    render();
  }

  function startEdit(id) {
    editingId = id;
    render();
  }

  function deleteTask(id) {
    tasks = tasks.filter((task) => task.id !== id);
    if (editingId === id) editingId = null;
    saveTasks();
    render();
  }

  function saveEdit(event) {
    const form = event.target.closest('[data-edit-form]');
    if (!form) return;
    event.preventDefault();

    const id = form.closest('.task-item').dataset.id;
    const task = tasks.find((item) => item.id === id);
    const title = form.querySelector('.edit-title').value.trim();
    if (!task) return;

    if (title) {
      task.title = title;
      task.due = form.querySelector('.edit-due').value;
      task.priority = form.querySelector('.edit-priority').value;
      saveTasks();
    }
    editingId = null;
    render();
  }

  function clearCompleted() {
    const completedCount = tasks.filter((task) => task.done).length;
    if (completedCount === 0) return;
    if (!window.confirm('确定要清空所有已完成任务吗？')) return;

    tasks = tasks.filter((task) => !task.done);
    if (!tasks.some((task) => task.id === editingId)) editingId = null;
    saveTasks();
    render();
  }

  function formatDueDate(dateString) {
    if (!dateString) return '';
    const dueDate = parseDate(dateString);
    const diff = diffDays(dueDate, new Date());
    if (diff < 0) return `已逾期 ${Math.abs(diff)} 天`;
    if (diff === 0) return '今天';
    if (diff === 1) return '明天';
    if (diff === 2) return '后天';
    return `${dueDate.getMonth() + 1}月${dueDate.getDate()}日`;
  }

  function isOverdue(dateString) {
    return diffDays(parseDate(dateString), new Date()) < 0;
  }

  function parseDate(dateString) {
    return new Date(`${dateString}T00:00:00`);
  }

  function diffDays(laterDate, earlierDate) {
    const day = 24 * 60 * 60 * 1000;
    return Math.round((startOfDay(laterDate) - startOfDay(earlierDate)) / day);
  }

  function startOfDay(date) {
    return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  }

  function makeId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }

  function selectPriority(priority) {
    selectedPriority = priority;
    elements.composerPriorityDot.className = `priority-dot priority-${priority}`;
    elements.priorityPicker.querySelectorAll('.priority-option').forEach((button) => {
      const isSelected = button.dataset.priority === priority;
      button.classList.toggle('is-selected', isSelected);
      button.setAttribute('aria-checked', String(isSelected));
    });
  }

  function setFilter(filter) {
    activeFilter = filter;
    render();
  }

  function setTodayLabel() {
    const today = new Date();
    const weekdays = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
    elements.todayLabel.textContent = `${today.getFullYear()}年${today.getMonth() + 1}月${today.getDate()}日 · ${weekdays[today.getDay()]}`;
  }

  function bindEvents() {
    elements.addForm.addEventListener('submit', createTask);
    elements.priorityPicker.addEventListener('click', (event) => {
      const option = event.target.closest('.priority-option');
      if (option) selectPriority(option.dataset.priority);
    });
    elements.clearCompleted.addEventListener('click', clearCompleted);
    elements.searchInput.addEventListener('input', (event) => {
      searchQuery = event.target.value;
      render();
    });
    elements.sortOrder.addEventListener('change', (event) => {
      sortMode = event.target.value;
      render();
    });

    document.querySelectorAll('.segment').forEach((button) => {
      button.addEventListener('click', () => setFilter(button.dataset.filter));
    });

    elements.taskList.addEventListener('click', (event) => {
      const item = event.target.closest('.task-item');
      if (!item) return;
      const id = item.dataset.id;

      if (event.target.closest('.check-button')) toggleTask(id);
      if (event.target.closest('.edit-button')) startEdit(id);
      if (event.target.closest('.delete-button')) deleteTask(id);
      if (event.target.closest('.cancel-edit')) {
        editingId = null;
        render();
      }
    });

    elements.taskList.addEventListener('submit', saveEdit);
  }

  bindEvents();
  selectPriority('medium');
  setTodayLabel();
  render();
})();
