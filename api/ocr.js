export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Brak zmiennej środowiskowej GEMINI_API_KEY na Vercelu!' });
  }

  try {
    // Używamy stabilnego i powszechnie dostępnego modelu gemini-1.5-flash
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { 
                text: `Przeanalizuj ten paragon ze stacji paliw. Zwróć DOKŁADNE dane w czystym formacie JSON bez żadnych znaczników markdown (bez \`\`\`json):
{
  "pricePerLiter": 6.59,
  "totalCost": 200.00,
  "liters": 30.35,
  "date": "2026-10-27",
  "time": "14:00",
  "fuelType": "PB95"
}
Wszystkie pola liczbowe (pricePerLiter, totalCost, liters) muszą być typu number z kropką dziesiętną. Nie pomijaj ich.` 
              },
              { inline_data: { mime_type: mimeType || 'image/jpeg', data: imageBase64 } }
            ]
          }]
        })
      }
    );

    const data = await response.json();
    
    if (data.error) {
      console.error("Google API Error:", data.error);
      return res.status(500).json({ error: data.error.message || 'Błąd Google AI' });
    }

    const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    console.log("Surowy tekst od AI:", rawText);

    // Czyszczenie ze znaczników i parsowanie JSON
    const cleanedText = rawText.replace(/```json|```/g, '').trim();
    const parsedData = JSON.parse(cleanedText);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('OCR Server Error:', error);
    return res.status(500).json({ error: 'Błąd przetwarzania obrazu OCR na serwerze' });
  }
}