module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Falta el prompt' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ GOOGLE_API_KEY no configurada');
      return res.status(500).json({ error: 'API Key no configurada' });
    }

    console.log('📤 Llamando a Gemini...');

    // CAMBIADO: v1 en lugar de v1beta y sin -latest
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            role: "user",
            parts: [{ text: prompt }]
          }],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Error Gemini:', errorData);
      return res.status(500).json({ error: 'Error de Gemini API', details: errorData });
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    if (!text) {
      return res.status(500).json({ error: 'Sin respuesta de Gemini' });
    }

    console.log('✅ Respuesta recibida');
    return res.status(200).json(text);

  } catch (error) {
    console.error("💥 Error:", error);
    return res.status(500).json({ 
      error: "Error del servidor",
      message: error.message 
    });
  }
};