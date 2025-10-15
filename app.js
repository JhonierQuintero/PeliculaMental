const { GoogleGenerativeAI } = require("@google/generative-ai");

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

    console.log('📤 Generando contenido con Gemini...');

    // Inicializar cliente con SDK oficial
    const genAI = new GoogleGenerativeAI(apiKey);
    
    // Usar gemini-pro que es el más compatible
    const model = genAI.getGenerativeModel({ model: "gemini-pro" });

    // Generar contenido
    const result = await model.generateContent(prompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      console.error('❌ Sin texto en respuesta');
      return res.status(500).json({ error: 'Gemini no devolvió texto' });
    }

    console.log('✅ Texto recibido:', text.substring(0, 150) + '...');
    
    // Devolver el texto directamente (tu frontend lo parseará)
    return res.status(200).json(text);

  } catch (error) {
    console.error("💥 Error completo:", error);
    return res.status(500).json({ 
      error: "Error al generar contenido",
      message: error.message,
      details: error.toString()
    });
  }
};