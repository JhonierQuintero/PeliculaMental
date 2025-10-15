export default async function handler(req, res) {
  // Solo acepta POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Método no permitido' });
  }

  try {
    // En Vercel con Next.js usa req.body directamente
    const { prompt } = req.body;
    
    if (!prompt) {
      return res.status(400).json({ error: 'Falta el prompt' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    
    if (!apiKey) {
      console.error('❌ GEMINI_API_KEY no está configurada');
      return res.status(500).json({ error: 'API Key no configurada' });
    }

    console.log('📤 Enviando prompt a Gemini...');

    // Llamada a la API de Gemini
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: prompt
                }
              ]
            }
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 2048,
          }
        }),
      }
    );

    if (!response.ok) {
      const errorData = await response.text();
      console.error('❌ Error de Gemini API:', errorData);
      return res.status(response.status).json({ 
        error: `Error de Gemini API: ${response.status}`,
        details: errorData 
      });
    }

    const data = await response.json();
    console.log("✅ Respuesta de Gemini recibida");

    // Extraer el texto de la respuesta de Gemini
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    if (!text) {
      console.error('❌ No se recibió texto de Gemini:', data);
      return res.status(500).json({ 
        error: 'Gemini no devolvió texto',
        data: data 
      });
    }

    console.log("📝 Texto recibido:", text.substring(0, 200) + "...");

    // Intentar extraer JSON del texto
    let jsonResponse;
    try {
      // Primero intentar parsear directamente
      jsonResponse = JSON.parse(text);
    } catch {
      // Si falla, buscar el JSON dentro del texto
      const match = text.match(/\{[\s\S]*\}/);
      if (match) {
        try {
          jsonResponse = JSON.parse(match[0]);
        } catch (e) {
          console.error('❌ Error al parsear JSON extraído:', e);
          return res.status(500).json({ 
            error: 'No se pudo parsear el JSON',
            rawText: text 
          });
        }
      } else {
        console.error('❌ No se encontró JSON en la respuesta');
        return res.status(500).json({ 
          error: 'No se encontró JSON válido en la respuesta',
          rawText: text 
        });
      }
    }

    // Devolver el texto tal cual para que el frontend lo procese
    // (tu frontend ya tiene la lógica de parsing)
    return res.status(200).json(text);

  } catch (error) {
    console.error("💥 Error en /api/generate:", error);
    return res.status(500).json({ 
      error: "Error interno del servidor",
      message: error.message 
    });
  }
}