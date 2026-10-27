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
    // Instrukcja dostosowana w zależności od tego, co skanujemy
    const promptText = type === 'odometer'
      ? `Przeanalizuj to zdjęcie zegarów lub licznika samochodu. Odczytaj całkowity przebieg (liczba kilometrów). Zwróć WYŁĄCZNIE czysty obiekt JSON w formacie:
{
  "mileage": 221512
}
Żadnego dodatkowego tekstu ani znaczników markdown.`
      : `Przeanalizuj ten paragon ze stacji paliw. Zwróć WYŁĄCZNIE czysty obiekt JSON (bez znaczników markdown):
{
  "pricePerLiter": 4.29,
  "totalCost": 204.68,
  "liters": 47.00,
  "date": "2017-07-08",
  "time": "18:39",
  "fuelType": "PB95"
}
Wskazówki: 
- Cena za litr to zazwyczaj wartość z gwiazdką (np. *4.29).
- Ilość litrów to liczba obok nazwy paliwa.
- Suma to kwota przy napisie "Suma" lub "PLN".
Wszystkie pola liczbowe muszą być typu number z kropką dziesiętną.`;

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
        max_tokens: 200
      })
    });

    const data = await response.json();

    if (data.error) {
      console.error("Groq API Error:", data.error);
      return res.status(500).json({ error: data.error.message || 'Błąd Groq AI' });
    }

    const rawContent = data.choices?.[0]?.message?.content || '{}';
    console.log("Odpowiedź z OCR AI:", rawContent);

    const cleanedText = rawContent.replace(/```json/g, '').replace(/```/g, '').trim();
    const parsedData = JSON.parse(cleanedText);

    return res.status(200).json(parsedData);
  } catch (error) {
    console.error('OCR Server Error:', error);
    return res.status(500).json({ error: 'Błąd przetwarzania OCR' });
  }
}