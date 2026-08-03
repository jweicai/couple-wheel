(function () {
  "use strict";

  const tasks = Array.isArray(window.COUPLE_TASKS) ? window.COUPLE_TASKS : [];
  const storageKey = "couple-wheel-state-v1";
  const colors = ["#b52f2f", "#f2b84b", "#277c72", "#315d87", "#e77c61"];
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  const elements = {
    wheel: document.getElementById("wheel"),
    wheelRim: document.querySelector(".wheel-rim"),
    centerSpin: document.getElementById("centerSpin"),
    centerSpinHint: document.getElementById("centerSpinHint"),
    wheelCaption: document.getElementById("wheelCaption"),
    spinButton: document.getElementById("spinButton"),
    spinButtonText: document.getElementById("spinButtonText"),
    skipCompleted: document.getElementById("skipCompleted"),
    completedCount: document.getElementById("completedCount"),
    progressBar: document.getElementById("progressBar"),
    progressNote: document.getElementById("progressNote"),
    resultSheet: document.getElementById("resultSheet"),
    listSheet: document.getElementById("listSheet"),
    backdrop: document.getElementById("backdrop"),
    resultNumber: document.getElementById("resultNumber"),
    resultCategory: document.getElementById("resultCategory"),
    resultTitle: document.getElementById("resultTitle"),
    resultDescription: document.getElementById("resultDescription"),
    completeTask: document.getElementById("completeTask"),
    spinAgain: document.getElementById("spinAgain"),
    openTasks: document.getElementById("openTasks"),
    shareApp: document.getElementById("shareApp"),
    taskList: document.getElementById("taskList"),
    resetProgress: document.getElementById("resetProgress"),
    toast: document.getElementById("toast")
  };

  let state = loadState();
  let currentRotation = 0;
  let selectedTask = null;
  let isSpinning = false;
  let activeFilter = "all";
  let activeSheet = null;
  let returnFocusTo = null;
  let lastSpinTrigger = null;
  let toastTimer = null;

  function loadState() {
    const fallback = { completed: [], history: [] };
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (!saved || !Array.isArray(saved.completed)) return fallback;
      return {
        completed: saved.completed.filter((id) => Number.isInteger(id) && id >= 1 && id <= 50),
        history: Array.isArray(saved.history) ? saved.history.slice(-30) : []
      };
    } catch (_error) {
      return fallback;
    }
  }

  function saveState() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
    } catch (_error) {
      showToast("当前浏览器无法保存进度，但本次仍可继续玩");
    }
  }

  function drawWheel() {
    const canvas = elements.wheel;
    const rect = canvas.getBoundingClientRect();
    if (!rect.width) return;

    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const size = Math.round(rect.width * ratio);
    if (canvas.width !== size || canvas.height !== size) {
      canvas.width = size;
      canvas.height = size;
    }

    const context = canvas.getContext("2d");
    const center = size / 2;
    const radius = center;
    const slice = (Math.PI * 2) / tasks.length;
    context.clearRect(0, 0, size, size);

    tasks.forEach((task, index) => {
      const start = -Math.PI / 2 - slice / 2 + index * slice;
      const end = start + slice;
      context.beginPath();
      context.moveTo(center, center);
      context.arc(center, center, radius, start, end);
      context.closePath();
      context.fillStyle = colors[index % colors.length];
      context.fill();

      context.save();
      context.translate(center, center);
      context.rotate(-Math.PI / 2 + index * slice);
      context.textAlign = "center";
      context.textBaseline = "middle";
      context.fillStyle = index % colors.length === 1 ? "#2b201d" : "#fffaf2";
      context.font = `700 ${Math.max(7, Math.round(size * 0.022))}px Georgia, serif`;
      context.fillText(String(task.id).padStart(2, "0"), 0, -radius * 0.79);
      context.restore();
    });

    context.beginPath();
    context.arc(center, center, radius * 0.67, 0, Math.PI * 2);
    context.strokeStyle = "rgba(43, 32, 29, 0.32)";
    context.lineWidth = Math.max(1, ratio);
    context.stroke();
  }

  function randomItem(items) {
    if (window.crypto && window.crypto.getRandomValues) {
      const values = new Uint32Array(1);
      window.crypto.getRandomValues(values);
      return items[values[0] % items.length];
    }
    return items[Math.floor(Math.random() * items.length)];
  }

  function getCandidates() {
    if (!elements.skipCompleted.checked) return tasks;
    return tasks.filter((task) => !state.completed.includes(task.id));
  }

  function spin(trigger = elements.spinButton) {
    if (isSpinning) return;
    closeSheet(false);
    lastSpinTrigger = trigger;

    const candidates = getCandidates();
    if (!candidates.length) {
      showToast("50 件小事都完成啦，可以关闭“跳过已完成”再重温一次");
      openList();
      return;
    }

    selectedTask = randomItem(candidates);
    const sectorDegrees = 360 / tasks.length;
    const normalizedCurrent = ((currentRotation % 360) + 360) % 360;
    const targetNormalized = (360 - (selectedTask.id - 1) * sectorDegrees) % 360;
    const delta = (targetNormalized - normalizedCurrent + 360) % 360;
    const turns = prefersReducedMotion.matches ? 0 : 6;
    currentRotation += turns * 360 + delta;

    isSpinning = true;
    elements.spinButton.disabled = true;
    elements.centerSpin.disabled = true;
    elements.spinButton.setAttribute("aria-busy", "true");
    elements.centerSpin.setAttribute("aria-busy", "true");
    elements.spinButtonText.textContent = "正在挑选…";
    elements.centerSpinHint.textContent = "转动中";
    elements.wheelCaption.textContent = "今天会转到哪一件？";
    elements.wheelRim.classList.add("is-spinning");
    elements.wheel.style.transform = `rotate(${currentRotation}deg)`;

    if (navigator.vibrate) navigator.vibrate(18);

    window.setTimeout(finishSpin, prefersReducedMotion.matches ? 80 : 3700);
  }

  function finishSpin() {
    if (!isSpinning || !selectedTask) return;
    isSpinning = false;
    elements.spinButton.disabled = false;
    elements.centerSpin.disabled = false;
    elements.spinButton.removeAttribute("aria-busy");
    elements.centerSpin.removeAttribute("aria-busy");
    elements.spinButtonText.textContent = "再转一件小事";
    elements.centerSpinHint.textContent = "再转一次";
    elements.wheelRim.classList.remove("is-spinning");
    elements.wheelCaption.textContent = `今天：${selectedTask.title}`;
    elements.wheel.setAttribute("aria-label", `转盘结果：第 ${selectedTask.id} 件，${selectedTask.title}`);

    state.history.push({ id: selectedTask.id, selectedAt: Date.now() });
    state.history = state.history.slice(-30);
    saveState();
    populateResult(selectedTask);
    openSheet(elements.resultSheet, lastSpinTrigger || elements.spinButton);
  }

  function populateResult(task) {
    const done = state.completed.includes(task.id);
    elements.resultNumber.textContent = `#${String(task.id).padStart(2, "0")}`;
    elements.resultCategory.textContent = `认真相爱 · ${task.category}`;
    elements.resultTitle.textContent = task.title;
    elements.resultDescription.textContent = task.description;
    elements.completeTask.classList.toggle("is-done", done);
    elements.completeTask.querySelector("span").textContent = done ? "这件已经完成" : "我们完成啦";
    elements.completeTask.setAttribute("aria-pressed", String(done));
  }

  function toggleSelectedTask() {
    if (!selectedTask) return;
    const done = state.completed.includes(selectedTask.id);
    if (done) {
      state.completed = state.completed.filter((id) => id !== selectedTask.id);
      showToast("已改回待完成");
    } else {
      state.completed.push(selectedTask.id);
      state.completed.sort((a, b) => a - b);
      showToast("盖章成功，又完成一件小事");
      if (navigator.vibrate) navigator.vibrate([22, 30, 22]);
    }
    saveState();
    populateResult(selectedTask);
    updateProgress();
  }

  function updateProgress() {
    const count = state.completed.length;
    elements.completedCount.textContent = String(count);
    elements.progressBar.style.width = `${(count / tasks.length) * 100}%`;

    if (count === 0) {
      elements.progressNote.textContent = "第一件小事，就从今天开始";
    } else if (count < 10) {
      elements.progressNote.textContent = "喜欢正在一点一点变成共同回忆";
    } else if (count < 30) {
      elements.progressNote.textContent = "普通的日子，也被你们过得很认真";
    } else if (count < 50) {
      elements.progressNote.textContent = "离集齐 50 枚小日子印章越来越近了";
    } else {
      elements.progressNote.textContent = "50 件全部完成，你们真的很会相爱";
    }
  }

  function openSheet(sheet, trigger) {
    if (activeSheet && activeSheet !== sheet) closeSheet(false);
    activeSheet = sheet;
    returnFocusTo = trigger || document.activeElement;
    sheet.hidden = false;
    elements.backdrop.hidden = false;
    document.body.classList.add("sheet-open");
    requestAnimationFrame(() => {
      sheet.classList.add("is-visible");
      elements.backdrop.classList.add("is-visible");
      const closeButton = sheet.querySelector("[data-close-sheet]");
      if (closeButton) closeButton.focus({ preventScroll: true });
    });
  }

  function closeSheet(restoreFocus = true) {
    if (!activeSheet) return;
    const closingSheet = activeSheet;
    closingSheet.classList.remove("is-visible");
    elements.backdrop.classList.remove("is-visible");
    activeSheet = null;
    document.body.classList.remove("sheet-open");

    window.setTimeout(() => {
      closingSheet.hidden = true;
      if (!activeSheet) elements.backdrop.hidden = true;
      if (restoreFocus && returnFocusTo && document.contains(returnFocusTo)) returnFocusTo.focus();
    }, prefersReducedMotion.matches ? 0 : 300);
  }

  function trapSheetFocus(event) {
    if (!activeSheet || event.key !== "Tab") return;
    const focusable = Array.from(
      activeSheet.querySelectorAll('button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])')
    ).filter((element) => !element.hidden && element.offsetParent !== null);
    if (!focusable.length) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function openList() {
    renderTaskList();
    openSheet(elements.listSheet, elements.openTasks);
  }

  function renderTaskList() {
    const visibleTasks = tasks.filter((task) => {
      const done = state.completed.includes(task.id);
      return activeFilter === "all" || (activeFilter === "done" ? done : !done);
    });

    elements.taskList.replaceChildren();
    if (!visibleTasks.length) {
      const empty = document.createElement("p");
      empty.className = "empty-list";
      empty.textContent = activeFilter === "done" ? "还没有完成记录，先去转一件吧。" : "这一栏已经清空，做得真好。";
      elements.taskList.appendChild(empty);
      return;
    }

    const fragment = document.createDocumentFragment();
    visibleTasks.forEach((task) => {
      const done = state.completed.includes(task.id);
      const row = document.createElement("article");
      row.className = `task-row${done ? " is-done" : ""}`;
      row.innerHTML = `
        <span class="task-row__number">${String(task.id).padStart(2, "0")}</span>
        <div>
          <span class="task-row__title"></span>
          <span class="task-row__category"></span>
        </div>
        <button class="task-check" type="button" aria-label="${done ? "取消完成" : "标记完成"}：${task.title}" aria-pressed="${done}">
          <svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6" /></svg>
        </button>`;
      row.querySelector(".task-row__title").textContent = task.title;
      row.querySelector(".task-row__category").textContent = task.category;
      row.querySelector(".task-check").addEventListener("click", () => toggleTaskFromList(task.id));
      fragment.appendChild(row);
    });
    elements.taskList.appendChild(fragment);
  }

  function toggleTaskFromList(taskId) {
    if (state.completed.includes(taskId)) {
      state.completed = state.completed.filter((id) => id !== taskId);
    } else {
      state.completed.push(taskId);
      state.completed.sort((a, b) => a - b);
    }
    saveState();
    updateProgress();
    renderTaskList();
  }

  function changeFilter(event) {
    const button = event.target.closest("[data-filter]");
    if (!button) return;
    activeFilter = button.dataset.filter;
    document.querySelectorAll(".filter-tab").forEach((tab) => {
      const active = tab === button;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
    });
    renderTaskList();
  }

  function resetProgress() {
    if (!state.completed.length) {
      showToast("清单还是全新的，不用重置");
      return;
    }
    if (!window.confirm("要清空全部完成记录，重新开始这 50 件小事吗？")) return;
    state = { completed: [], history: [] };
    saveState();
    updateProgress();
    renderTaskList();
    showToast("完成记录已清空，可以重新出发了");
  }

  async function shareApp() {
    const shareData = {
      title: "我们的小日子 · 情侣日常大转盘",
      text: "把今天过成约会：一起转一件情侣日常小事吧。",
      url: window.location.href.split("#")[0]
    };

    const isWeChat = /MicroMessenger/i.test(navigator.userAgent);
    if (isWeChat) {
      showToast("点微信右上角的 ···，选择“发送给朋友”就能分享");
      return;
    }

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        return;
      } catch (error) {
        if (error && error.name === "AbortError") return;
      }
    }

    try {
      await navigator.clipboard.writeText(shareData.url);
      showToast("链接已复制，发给对方一起玩吧");
    } catch (_error) {
      showToast("复制失败，请手动复制浏览器地址分享");
    }
  }

  function showToast(message) {
    window.clearTimeout(toastTimer);
    elements.toast.textContent = message;
    elements.toast.hidden = false;
    toastTimer = window.setTimeout(() => {
      elements.toast.hidden = true;
    }, 3200);
  }

  elements.spinButton.addEventListener("click", () => spin(elements.spinButton));
  elements.centerSpin.addEventListener("click", () => spin(elements.centerSpin));
  elements.completeTask.addEventListener("click", toggleSelectedTask);
  elements.spinAgain.addEventListener("click", () => {
    closeSheet(false);
    window.setTimeout(() => spin(elements.spinButton), prefersReducedMotion.matches ? 20 : 320);
  });
  elements.openTasks.addEventListener("click", openList);
  elements.shareApp.addEventListener("click", shareApp);
  elements.resetProgress.addEventListener("click", resetProgress);
  elements.backdrop.addEventListener("click", () => closeSheet());
  document.querySelectorAll("[data-close-sheet]").forEach((button) => button.addEventListener("click", () => closeSheet()));
  document.querySelector(".filter-tabs").addEventListener("click", changeFilter);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && activeSheet) closeSheet();
    trapSheetFocus(event);
  });

  const resizeObserver = new ResizeObserver(drawWheel);
  resizeObserver.observe(elements.wheel);
  updateProgress();
  drawWheel();
})();
