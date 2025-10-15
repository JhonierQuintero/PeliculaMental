// --- Referencias a elementos del DOM ---
const ui = {
  startBtn: document.getElementById('start-btn'),
  setupScreen: document.getElementById('setup-screen'),
  goalForm: document.getElementById('goal-form'),
  loadingScreen: document.getElementById('loading-screen'),
  resultScreen: document.getElementById('result-screen'),
  planContainer: document.getElementById('plan-container'),
  chatContainer: document.getElementById('chat-container'),
  sendBtn: document.getElementById('send-btn'),
  userInput: document.getElementById('user-input'),
};

// --- Pantallas ---
function showScreen(screenId) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(screenId).classList.add('active');
}

// --- Iniciar flujo ---
ui.startBtn.addEventListener('click', () => showScreen('setup-screen'));

// --- Envío del formulario ---
ui.goalForm.addEventListener('submit', async (e) => {
  e.preventDefault();

  const goal = document.getElementById('goal').value.trim();
  const time = document.getElementById('time').value;
  const level = document.getElementById('level').value;

  if (!goal) {
    alert("Por favor, escribe tu meta antes de continuar.");
    return;
  }

  showScreen('loading-screen');

  const prompt = `
  Eres un planificador de productividad. 
  Crea una lista de tareas organizada por pasos para cumplir la meta "${goal}" en un plazo de ${time}.
  Nivel de dificultad: ${level}.
  Devuelve el resultado en formato JSON así:
  {
    "tasks": [
      {"title": "Paso 1", "description": "Descripción breve"},
      {"title": "Paso 2", "description": "Descripción breve"}
    ]
  }`;

  try {
    const tasks = await callAIToGenerateTasks(prompt);
    renderPlan(tasks);
    showScreen('result-screen');
  } catch (err) {
    console.error("Error al generar el plan:", err);
    alert("Ocurrió un error generando el plan. Intenta nuevamente.");
    showScreen('setup-screen');
  }
});

// --- Función principal: Llamar a la IA ---
async function callAIToGenerateTasks(prompt) {
  const raw = await callSecureAPI(prompt);
  let json;

  try {
    // Intentar directamente
    json = JSON.parse(raw);
  } catch {
    // Intentar rescatar bloque JSON si viene mezclado con texto
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try {
        json = JSON.parse(match[0]);
      } catch {
        console.warn("No se pudo parsear el bloque JSON. Texto devuelto:", raw);
        throw new Error("La IA devolvió un formato no compatible.");
      }
    } else {
      console.warn("Texto sin JSON:", raw);
      throw new Error("La IA no devolvió una lista de tareas válida.");
    }
  }

  // Intentar detectar lista aunque no esté dentro de "tasks"
  let tasks = Array.isArray(json.tasks) ? json.tasks : null;

  // Si no hay "tasks", buscar posibles tareas en texto plano
  if (!tasks) {
    const possibleTasks = raw.match(/(?:Paso|Tarea|Objetivo)\s*\d*[:\-]\s*[^\n]+/gi);
    if (possibleTasks) {
      tasks = possibleTasks.map((t, i) => ({
        title: `Paso ${i + 1}`,
        description: t.replace(/^(Paso|Tarea|Objetivo)\s*\d*[:\-]?\s*/i, "").trim(),
      }));
    }
  }

  if (!tasks) throw new Error("La IA no devolvió una lista de tareas válida.");
  console.log("✅ Respuesta limpia de la IA:", tasks);
  return tasks;
}

// --- Llamada segura a la API ---
async function callSecureAPI(prompt) {
  const API_KEY = "TU_API_KEY_AQUI"; // ⚠ reemplázala por tu clave de Google AI
  const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" + API_KEY;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    throw new Error("Error de conexión con la API: " + response.status);
  }

  const data = await response.json();
  return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
}

// --- Mostrar plan generado ---
function renderPlan(tasks) {
  ui.planContainer.innerHTML = tasks.map(t => `
    <div class="task">
      <h3>${t.title}</h3>
      <p>${t.description}</p>
    </div>
  `).join("");
}

// --- Chat interactivo con la IA ---
ui.sendBtn.addEventListener('click', async () => {
  const message = ui.userInput.value.trim();
  if (!message) return;

  appendMessage("Tú", message);
  ui.userInput.value = "";

  try {
    const reply = await callSecureAPI(`Responde brevemente sobre: ${message}`);
    appendMessage("IA", reply);
  } catch {
    appendMessage("IA", "Ocurrió un error. Intenta nuevamente.");
  }
});

function appendMessage(sender, text) {
  const msg = document.createElement('div');
  msg.className = sender === "Tú" ? "user-msg" : "ai-msg";
  msg.textContent = `${sender}: ${text}`;
  ui.chatContainer.appendChild(msg);
  ui.chatContainer.scrollTop = ui.chatContainer.scrollHeight;
}