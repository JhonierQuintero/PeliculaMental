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

    const apiKey = process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      console.error('❌ GOOGLE_API_KEY no configurada');
      return res.status(500).json({ error: 'API Key no configurada' });
    }

    console.log('📤 Llamando a Gemini 2.5 Flash...');

    // Probar primero con v1
    let url = https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=${apiKey};
    let response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      }),
    });

    let data = await response.json();

    // Si v1 falla con 404, intentar con v1beta
    if (!response.ok && data.error?.code === 404) {
      console.log('⚠ v1 no funciona, probando v1beta...');
      url = https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey};
      
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        }),
      });

      data = await response.json();
    }

    console.log('📥 Status:', response.status);

    if (!response.ok) {
      console.error('❌ Error Gemini:', JSON.stringify(data));
      return res.status(500).json({ 
        error: 'Error de Gemini API', 
        details: data,
        urlUsada: url
      });
    }

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    if (!text) {
      console.error('❌ Sin texto:', JSON.stringify(data));
      return res.status(500).json({ 
        error: 'Sin respuesta de Gemini',
        data: data 
      });
    }

    console.log('✅ Respuesta recibida correctamente');
    return res.status(200).json(text);

  } catch (error) {
    console.error("💥 Error:", error.message);
    return res.status(500).json({ 
      error: "Error del servidor",
      message: error.message
    });
  }
};