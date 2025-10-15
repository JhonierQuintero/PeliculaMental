export default async function handler(req, res) {
  try {
    const { goal } = await req.json(); // si usas Next 13 en Vercel Edge
    const apiKey = process.env.GOOGLE_API_KEY;

    // 🔹 Llamada directa a la API de Gemini o PaLM (Google)
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=" + apiKey,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [
                {
                  text: `Eres un asistente que crea listas de tareas. Genera un JSON válido con tareas para este objetivo: ${goal}. 
El formato debe ser:
{
  "tasks": [
    {"title": "nombre", "description": "detalles"},
    ...
  ]
}`
                }
              ]
            }
          ]
        }),
      }
    );

    const data = await response.json();
    console.log("Respuesta API:", data);

    // 🔹 Extraer texto de la IA
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // 🔹 Intentar parsear como JSON
    let json;
    try {
      json = JSON.parse(text);
    } catch {
      json = { tasks: [{ title: "Error", description: "No se pudo parsear JSON" }] };
    }

    return res.status(200).json(json);
  } catch (error) {
    console.error("Error en generate.js:", error);
    return res.status(500).json({ error: "Error interno del servidor" });
  }
}