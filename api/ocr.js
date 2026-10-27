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
      ? `Przeanalizuj to zdjęcie zegarów samochodu. Na wyświetlaczu są dwie liczby: główny przebieg (na górze, np. 270997) oraz przebieg dzienny/trip (na dole z kropką, np. 428.6). Odczytaj WYŁĄCZNIE GŁÓWNY przebieg (całkowitą liczbę kilometrów z górnego wiersza). Zwróć wynik jako czysty obiekt JSON w formacie:
{
  "mileage": 270997
}
Żadnego innego tekstu.`
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
    console.log("Odpowiedź AI dla licznika:", rawContent);

    let parsedData = {};

    if (type === 'odometer') {
      // Próbujemy sparsować JSON z odpowiedzi AI, a jeśli się nie uda, wyciągamy pierwszą dużą liczbę
      try {
        const cleanedText = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
        const jsonRes = JSON.parse(cleanedText);
        if (jsonRes.mileage) {
          parsedData = { mileage: Number(jsonRes.mileage) };
        } else {
          throw new Error('Brak pola mileage w JSON');
        }
      } catch (e) {
        // Awaryjne wyciąganie – szukamy liczby która ma co najmniej 5 cyfr (główny przebieg)
        const match = rawContent.match(/\d{5,}/);
        const mileageNum = match ? parseInt(match[0], 10) : 0;
        parsedData = { mileage: mileageNum };
      }
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