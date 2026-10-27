export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType, type } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Brak klucza GROQ_API_KEY na serwerze' });
  }

  try {
    const promptText = type === 'odometer'
      ? `Przeanalizuj to zdjęcie zegarów lub licznika samochodu. Odczytaj całkowity przebieg (liczba kilometrów). Zwróć WYŁĄCZNIE samą liczbę kilometrów lub obiekt JSON {"mileage": 221512}. Żadnych innych słów.`
      : `Przeanalizuj ten paragon ze stacji paliw. Zwróć WYŁĄCZNIE czysty obiekt JSON:
{
  "pricePerLiter": 4.29,
  "totalCost": 204.68,
  "liters": 47.00,
  "date": "2017-07-08",
  "time": "18:39",
  "fuelType": "PB95"
}`;

    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'qwen/qwen3.8-27b',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              {
                type: 'image_url',
                image_url: { url: `data:${mimeType || 'image/jpeg'};base64,${imageBase64}` }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 150
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("Groq API Error:", data.error);
      return res.status(500).json({ error: data.error.message || 'Błąd Groq AI' });
    }

    const rawContent = data.choices?.[0]?.message?.content || '{}';
    console.log("Surowa odpowiedź AI dla licznika:", rawContent);

    let parsedData = {};

    if (type === 'odometer') {
      // Bezpieczne wyciąganie cyfr ze stringa (np. jeśli model zwróci "221512 km")
      const cleanedString = rawContent.replace(/[^\d]/g, '');
      const mileageNum = parseInt(cleanedString, 10);
      
      parsedData = { mileage: !isNaN(mileageNum) ? mileageNum : 0 };
    } else {
      const cleanedText = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
      parsedData = JSON.parse(cleanedText);
    }

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('OCR Server Error:', error);
    return res.status(500).json({ error: 'Błąd przetwarzania OCR' });
  }
}