/**
 * api/generate.js
 * Función serverless (Vercel) que actúa como intermediario seguro con Google Generative API (Gemini).
 * Usa la variable de entorno GEMINI_API_KEY (o GENERATIVE_API_KEY).
 *
 * Ajusta apiUrl si cambias de endpoint o versión.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ message: 'Método no permitido. Use POST.' });
  }

  try {
    const { prompt } = req.body || {};

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({ message: 'Prompt inválido o vacío.' });
    }

    const MAX_PROMPT_CHARS = 8000;
    if (prompt.length > MAX_PROMPT_CHARS) {
      return res.status(413).json({ message: `Prompt demasiado largo. Máximo ${MAX_PROMPT_CHARS} caracteres.` });
    }

    const apiKey = process.env.GEMINI_API_KEY || process.env.GENERATIVE_API_KEY;
    if (!apiKey) {
      console.error('API key no configurada en variables de entorno.');
      return res.status(500).json({ message: 'Configuración del servidor incompleta.' });
    }

    // Endpoint para Gemini (ajusta si usas otro modelo/versión)
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`;

    // Construir cuerpo compatible (basado en la doc pública; adáptalo si cambias de versión)
    const body = {
  contents: [
    {
      parts: [{ text: prompt }]
    }
  ]
};

    const controller = new AbortController();
    const timeoutMs = 22000;
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    const resp = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      console.error('Error desde la API externa:', resp.status, text);
      return res.status(resp.status).json({ message: 'Error en la API externa.' });
    }

    const data = await resp.json().catch(() => null);
    if (!data) {
      return res.status(502).json({ message: 'Respuesta inválida de la API externa.' });
    }

    return res.status(200).json(data);

  } catch (err) {
    if (err.name === 'AbortError') {
      console.error('Request timeout to generative API.');
      return res.status(504).json({ message: 'Tiempo de espera agotado en la API generativa.' });
    }
    console.error('Error inesperado en api/generate:', err);
    return res.status(500).json({ message: 'Error inesperado en el servidor.' });
  }
}