document.addEventListener('DOMContentLoaded', () => {
  let state = {
    userInput: null,
    tasks: [],
    chatHistory: [],
    theme: 'theme-sunrise'
  };

  const dom = {
    body: document.body,
    container: document.querySelector('.container'),
    screens: {
      welcome: document.getElementById('welcome-screen'),
      setup: document.getElementById('setup-screen'),
      loading: document.getElementById('loading-screen'),
      planner: document.getElementById('planner-screen')
    },
    startBtn: document.getElementById('start-btn'),
    howBtn: document.getElementById('how-btn'),
    plannerForm: document.getElementById('planner-form'),
    errorContainer: document.getElementById('error-container'),
    themeButtons: document.querySelectorAll('.theme-btn'),
    musicInput: document.getElementById('music'),
    musicFileName: document.getElementById('music-file-name'),
    bgMusic: document.getElementById('background-music'),
    floatingControls: document.getElementById('floating-controls'),
    taskList: document.getElementById('task-list'),
    progressBar: document.getElementById('progress-bar'),
    progressText: document.getElementById('progress-text'),
    exportPdfBtn: document.getElementById('export-pdf-btn'),
    resetBtn: document.getElementById('reset-btn'),
    chatbot: {
      container: document.getElementById('chatbot-container'),
      toggleBtn: document.getElementById('toggle-chat-btn'),
      messages: document.getElementById('chat-messages'),
      form: document.getElementById('chat-form'),
      input: document.getElementById('chat-input')
    }
  };

  const safe = {
    el: (x) => (x instanceof HTMLElement ? x : null),
    els: (nodelist) => (nodelist && nodelist.length ? Array.from(nodelist) : []),
    exists: (v) => v !== null && v !== undefined
  };

  const showScreen = (screenName) => {
    Object.values(dom.screens).forEach(s => { if (safe.el(s)) s.classList.remove('active'); });
    const s = dom.screens[screenName];
    if (safe.el(s)) s.classList.add('active');
  };

  const showError = (message) => {
    if (safe.el(dom.errorContainer)) {
      dom.errorContainer.textContent = message;
      dom.errorContainer.classList.remove('hidden');
    } else {
      console.error('Error container no encontrado:', message);
    }
  };

  const hideError = () => {
    if (safe.el(dom.errorContainer)) dom.errorContainer.classList.add('hidden');
  };

  const initializeEventListeners = () => {
    if (safe.el(dom.startBtn)) dom.startBtn.addEventListener('click', () => showScreen('setup'));
    if (safe.el(dom.plannerForm)) dom.plannerForm.addEventListener('submit', handleFormSubmit);
    safe.els(dom.themeButtons).forEach(button => {
      if (button.dataset && button.dataset.theme) {
        button.addEventListener('click', () => setTheme(button.dataset.theme));
      }
    });
    if (safe.el(dom.musicInput)) {
      dom.musicInput.addEventListener('change', () => {
        if (!safe.el(dom.musicFileName)) return;
        dom.musicFileName.textContent = (dom.musicInput.files && dom.musicInput.files.length) ? dom.musicInput.files[0].name : 'Seleccionar banda sonora...';
      });
    }
    if (safe.el(dom.chatbot.toggleBtn) && safe.el(dom.chatbot.container) && safe.el(dom.container)) {
      dom.chatbot.toggleBtn.addEventListener('click', () => {
        dom.chatbot.container.classList.toggle('open');
        dom.container.classList.toggle('chat-open');
      });
    }
    if (safe.el(dom.chatbot.form)) dom.chatbot.form.addEventListener('submit', handleChatSubmit);
    if (safe.el(dom.exportPdfBtn)) dom.exportPdfBtn.addEventListener('click', handlePdfExport);
    if (safe.el(dom.resetBtn)) dom.resetBtn.addEventListener('click', () => {
      if (confirm('¿Estás seguro? Perderás todo tu plan y empezarás de nuevo.')) {
        try { localStorage.removeItem('mentalMovieState'); } catch (e) { console.error(e); }
        window.location.reload();
      }
    });

    // mobile cancel reset button
    const resetMobile = document.getElementById('reset-btn-mobile');
    if (resetMobile) resetMobile.addEventListener('click', () => {
      if (confirm('¿Cancelar y volver al inicio?')) {
        showScreen('welcome');
      }
    });
  };

  async function handleFormSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    hideError();
    if (!safe.el(dom.plannerForm)) return showError('Formulario no encontrado.');

    const formData = new FormData(dom.plannerForm);

    state.userInput = {
      title: (formData.get('movie-title') || 'Sin Título').toString().trim(),
      genre: (formData.get('movie-genre') || 'Sin Género').toString().trim(),
      protagonist: (formData.get('movie-protagonist') || 'Anónimo').toString().trim(),
      goal2y: (formData.get('goal-2y') || 'Sin meta').toString().trim(),
      goal5y: (formData.get('goal-5y') || 'Sin meta').toString().trim(),
      goal10y: (formData.get('goal-10y') || 'Sin meta').toString().trim()
    };

    if (safe.el(dom.musicInput) && dom.musicInput.files && dom.musicInput.files.length > 0 && safe.el(dom.bgMusic)) {
      try {
        dom.bgMusic.src = URL.createObjectURL(dom.musicInput.files[0]);
        dom.bgMusic.play().catch(() => {});
      } catch (err) {
        console.warn('No se pudo reproducir audio:', err);
      }
    }

    showScreen('loading');

    async function callAIToGenerateTasks(prompt) {
  const raw = await callSecureAPI(prompt);
  let json;

  // Intentar parsear JSON directamente
  try {
    json = JSON.parse(raw);
  } catch {
    // Si hay texto extra, buscar solo el bloque JSON
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('La IA no devolvió una lista de tareas válida.');
    json = JSON.parse(match[0]);
  }

  if (!Array.isArray(json.tasks)) {
    throw new Error('La IA no devolvió una lista de tareas válida.');
  }

  return json.tasks;
}
  }

  async function handleChatSubmit(e) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (!safe.el(dom.chatbot.input)) return;
    const userMessage = dom.chatbot.input.value.trim();
    if (!userMessage) return;
    addMessageToChat('user', userMessage);
    dom.chatbot.input.value = '';

    try {
      const aiResponse = await callChatbotAI(state.chatHistory);
      addMessageToChat('ai', aiResponse || 'Lo siento, no recibí respuesta válida.');
      saveState();
    } catch (error) {
      console.error('Error en el chatbot:', error);
      addMessageToChat('ai', `Lo siento, estoy teniendo problemas para conectar. Error: ${error.message || error}`);
    }
  }

  async function callSecureAPI(prompt) {
    if (!prompt || typeof prompt !== 'string') throw new Error('Prompt inválido.');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch('/api/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt }),
        signal: controller.signal
      });
      clearTimeout(timeout);
      if (!res.ok) {
        let errText = `Error del servidor: ${res.status}`;
        try { const j = await res.json(); if (j && j.message) errText = j.message; } catch (_) { /* ignore */ }
        throw new Error(errText);
      }
      const data = await res.json();
      if (typeof data === 'string') return data;
      if (data.candidates && data.candidates[0]?.content?.parts?.[0]?.text) return data.candidates[0].content.parts[0].text;
      if (data.choices && data.choices[0]?.message?.content) return data.choices[0].message.content;
      if (data.outputText) return data.outputText;
      if (data.text) return data.text;
      return JSON.stringify(data);
    } catch (err) {
      if (err.name === 'AbortError') throw new Error('Tiempo de espera agotado en la petición a la IA.');
      throw err;
    }
  }

  function extractJsonFromString(mixed) {
    if (!mixed || typeof mixed !== 'string') return null;
    const first = mixed.indexOf('{');
    const last = mixed.lastIndexOf('}');
    if (first === -1 || last === -1 || last <= first) return null;
    const candidate = mixed.slice(first, last + 1);
    try { return JSON.parse(candidate); } catch (e) { return null; }
  }

  async function callAIToGenerateTasks(input) {
    const prompt = `Eres un coach de vida experto llamado "Guionista del Destino". Un usuario te ha proporcionado su "Película Mental". Analiza su visión y metas para generar una lista de tareas accionables y específicas.
Información: Título: "${input.title}", Género: "${input.genre}", Protagonista: "${input.protagonist}", Meta a 2 años: "${input.goal2y}", Meta a 5 años: "${input.goal5y}", Visión a 10 años: "${input.goal10y}".
Instrucciones: Devuelve SOLO un objeto JSON válido con la estructura: {"tasks":[{"category":"Acto I","task":"..."}, ...]}.
Genera entre 12 y 18 tareas agrupadas en Acto I, Acto II y Acto III.`;

    const raw = await callSecureAPI(prompt);
    try {
      return JSON.parse(raw).tasks;
    } catch (_) {
      const j = extractJsonFromString(raw);
      if (j && Array.isArray(j.tasks)) return j.tasks;
      const fallbackTasks = raw
        .split(/\r?\n/)
        .map(l => l.trim())
        .filter(l => l.length > 5)
        .slice(0, 18)
        .map((t, i) => ({ category: i < 6 ? 'Acto I' : i < 12 ? 'Acto II' : 'Acto III', task: t }));
      if (fallbackTasks.length === 0) throw new Error('Respuesta de la IA no entendible.');
      return fallbackTasks;
    }
  }

  async function callChatbotAI(fullHistory) {
    const lastLines = fullHistory.map(msg => `${msg.role === 'user' ? 'Usuario' : 'Tu'}: ${msg.text}`).join('\n');
    const prompt = `Eres "Guionista del Destino", un coach de IA motivacional. Ayuda al usuario a alcanzar las metas de su "Película Mental".
CONTEXTO: Película: "${state.userInput?.title || ''}" (${state.userInput?.genre || ''}). Visión: ${state.userInput?.goal10y || ''}. Tareas pendientes: ${JSON.stringify(state.tasks.filter(t => !t.completed).map(t => t.task))}.
CONVERSACIÓN:
${lastLines}
Tu Tarea: Responde al último mensaje del usuario de forma concisa, útil y motivadora. Devuelve solo la respuesta en texto.`;
    const raw = await callSecureAPI(prompt);
    if (typeof raw === 'string') {
      const j = extractJsonFromString(raw);
      if (j && (j.answer || j.response || j.text)) return j.answer || j.response || j.text;
      return raw;
    }
    return String(raw);
  }

  function renderPlanner() {
    const titleEl = document.getElementById('planner-title');
    const subtitleEl = document.getElementById('planner-subtitle');
    if (safe.el(titleEl)) titleEl.textContent = state.userInput?.title || 'Sin título';
    if (safe.el(subtitleEl)) subtitleEl.textContent = `Un guion para ${state.userInput?.protagonist || 'Anónimo'}`;
    renderTasks();
    showScreen('planner');
    if (safe.el(dom.floatingControls)) dom.floatingControls.classList.remove('hidden');
  }

  function renderTasks() {
    if (!safe.el(dom.taskList)) return;
    dom.taskList.innerHTML = '';
    let currentCategory = null;
    (state.tasks || []).forEach((task, index) => {
      if (task.category !== currentCategory) {
        currentCategory = task.category;
        const categoryTitle = document.createElement('h3');
        categoryTitle.className = 'task-category';
        categoryTitle.textContent = currentCategory || '';
        dom.taskList.appendChild(categoryTitle);
      }
      const taskItem = document.createElement('div');
      taskItem.className = `task-item ${task.completed ? 'completed' : ''}`;
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `task-${index}`;
      checkbox.checked = !!task.completed;
      checkbox.addEventListener('change', () => {
        state.tasks[index].completed = !!checkbox.checked;
        updateProgress();
        saveState();
        renderTasks();
      });
      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.textContent = task.task || '';
      taskItem.appendChild(checkbox);
      taskItem.appendChild(label);
      dom.taskList.appendChild(taskItem);
    });
    updateProgress();
  }

  function updateProgress() {
    if (!state.tasks || state.tasks.length === 0) {
      if (safe.el(dom.progressBar)) dom.progressBar.style.width = '0%';
      if (safe.el(dom.progressText)) dom.progressText.textContent = '0% Completado';
      return;
    }
    const completedTasks = state.tasks.filter(t => t.completed).length;
    const percentage = Math.round((completedTasks / state.tasks.length) * 100);
    if (safe.el(dom.progressBar)) dom.progressBar.style.width = `${percentage}%`;
    if (safe.el(dom.progressText)) dom.progressText.textContent = `${percentage}% Completado`;
  }

  function addMessageToChat(role, text) {
    state.chatHistory.push({ role, text });
    renderChatHistory();
  }

  function renderChatHistory() {
    if (!safe.el(dom.chatbot.messages)) return;
    dom.chatbot.messages.innerHTML = '';
    (state.chatHistory || []).forEach(msg => {
      const messageEl = document.createElement('div');
      messageEl.className = `chat-message ${msg.role}-message`;
      messageEl.textContent = msg.text;
      dom.chatbot.messages.appendChild(messageEl);
    });
    dom.chatbot.messages.scrollTop = dom.chatbot.messages.scrollHeight;
  }

  function setTheme(theme) {
    if (!safe.el(dom.body)) return;
    const classList = Array.from(dom.body.classList);
    classList.forEach(c => { if (c.startsWith('theme-')) dom.body.classList.remove(c); });
    dom.body.classList.add(theme);
    state.theme = theme;
    saveState();
  }

  async function handlePdfExport() {
    const content = document.getElementById('pdf-content');
    if (!content) return showError('Elemento para exportar a PDF no encontrado.');
    if (!window.html2canvas || !window.jspdf) {
      return showError('html2canvas o jsPDF no están cargados en la página.');
    }
    try {
      const canvas = await html2canvas(content, { scale: 2, backgroundColor: getComputedStyle(dom.body).backgroundColor });
      const { jsPDF } = window.jspdf;
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, pdfWidth, pdfHeight);
      const title = (state.userInput?.title || 'Mi-Pelicula-Mental').replace(/\s+/g, '_');
      pdf.save(`${title}.pdf`);
    } catch (err) {
      console.error('Error al exportar PDF:', err);
      showError('No se pudo generar el PDF. Revisa la consola para más información.');
    }
  }

  function saveState() {
    try {
      const s = JSON.stringify(state);
      localStorage.setItem('mentalMovieState', s);
    } catch (err) {
      console.warn('No se pudo guardar el estado en localStorage:', err);
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem('mentalMovieState');
      if (!raw) return showScreen('welcome');
      const parsed = JSON.parse(raw);
      state = Object.assign(state, parsed || {});
      setTheme(state.theme || 'theme-sunrise');
      if (state.userInput && state.tasks && state.tasks.length > 0) {
        renderPlanner();
        renderChatHistory();
      } else {
        showScreen('welcome');
      }
    } catch (err) {
      console.warn('No se pudo cargar estado guardado:', err);
      showScreen('welcome');
    }
  }

  initializeEventListeners();
  loadState();
});