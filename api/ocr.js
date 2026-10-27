export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Brak klucza GROQ_API_KEY na serwerze' });
  }

  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'llama-3.2-11b-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Przeanalizuj ten paragon ze stacji paliw. Wyciągnij z niego dane i zwróć WYŁĄCZNIE czysty obiekt JSON (bez żadnego dodatkowego tekstu, bez znaczników markdown \`\`\`json):
{
  "pricePerLiter": 6.59,
  "totalCost": 200.00,
  "liters": 30.35,
  "date": "2026-10-27",
  "time": "14:20",
  "fuelType": "PB95"
}
Wszystkie pola liczbowe (pricePerLiter, totalCost, liters) muszą być typu number z kropką dziesiętną.`
              },
              {
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 300
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("Groq API Error:", data.error);
      return res.status(500).json({ error: data.error.message || 'Błąd Groq AI' });
    }

    const rawContent = data.choices?.[0]?.message?.content || '{}';
    console.log("Odpowiedź z Llama Vision:", rawContent);

    // Czyszczenie ewentualnych znaczników markdown i sparsowanie JSON
    const cleanedText = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanedText);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('Groq OCR Server Error:', error);
    return res.status(500).json({ error: 'Błąd przetwarzania OCR przez Llama Vision' });
  }
}