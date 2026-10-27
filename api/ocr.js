export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Brak klucza API na serwerze' });
  }

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: 'Przeanalizuj ten paragon ze stacji paliw. Zwróć TYLKO czysty obiekt JSON bez znaczników markdown: {"pricePerLiter": liczba, "totalCost": liczba, "liters": liczba, "date": "RRRR-MM-DD", "time": "GG:MM", "fuelType": "LPG" lub "PB95" lub "ON"}' },
              { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    const cleanJson = JSON.parse(text.replace(/```json|```/g, '').trim());

    return res.status(200).json(cleanJson);
  } catch (error) {
    return res.status(500).json({ error: 'Błąd przetwarzania obrazu OCR' });
  }
}