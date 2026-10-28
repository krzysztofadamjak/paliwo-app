export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType = 'image/jpeg', type = 'receipt' } = req.body;
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'Brak klucza GROQ_API_KEY na serwerze' });
  }

  const prompt = type === 'odometer'
    ? 'Odczytaj całkowity przebieg samochodu (km) z licznika na zdjęciu. Zwróć WYŁĄCZNIE czysty obiekt JSON w formacie: {"mileage": 123456}'
    : 'Przeanalizuj paragon paliwowy. Zwróć WYŁĄCZNIE czysty obiekt JSON w formacie: {"pricePerLiter": 6.55, "totalCost": 200.00, "liters": 30.53, "date": "YYYY-MM-DD", "time": "HH:MM", "fuelType": "PB95"}';

  // Aktualne modele wizyjne Groq (bez wycofanych modeli llama-3.2)
  const groqVisionModels = [
    'meta-llama/llama-4-scout-17b-16e-instruct',
    'meta-llama/llama-4-maverick-17b-128e-instruct',
    'qwen/qwen3.8-27b'
  ];

  let lastError = null;

  for (const model of groqVisionModels) {
    try {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: { url: `data:${mimeType};base64,${imageBase64}` }
                }
              ]
            }
          ],
          temperature: 0.1,
          max_tokens: 300,
          response_format: { type: 'json_object' }
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data?.error?.message || `Błąd HTTP ${response.status} dla modelu ${model}`);
      }

      const content = data.choices?.[0]?.message?.content || '{}';
      const cleaned = content.replace(/```json|```/g, '').trim();
      const parsed = JSON.parse(cleaned);

      return res.status(200).json({ ...parsed, _modelUsed: model });
    } catch (err) {
      console.warn(`[Groq Fallback] Model ${model} niedostępny:`, err.message);
      lastError = err;
    }
  }

  return res.status(500).json({ error: lastError?.message || 'Wszystkie modele Groq niedostępne' });
}