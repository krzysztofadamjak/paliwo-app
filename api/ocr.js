export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { imageBase64, mimeType } = req.body;
  const apiKey = process.env.OCR_SPACE_API_KEY || 'helloworld'; // 'helloworld' to publiczny darmowy klucz testowy

  try {
    // Przygotowanie danych do wysłania do OCR.space (wymaga formatu data:image/...)
    const base64Image = `data:${mimeType || 'image/jpeg'};base64,${imageBase64}`;

    const formData = new URLSearchParams();
    formData.append('base64Image', base64Image);
    formData.append('language', 'pol'); // język polski dla lepszego rozpoznawania
    formData.append('isOverlayRequired', 'false');
    formData.append('scale', 'true');
    formData.append('OCREngine', '2'); // Silnik 2 radzi sobie świetnie z paragonami

    const response = await fetch('https://api.ocr.space/parse/image', {
      method: 'POST',
      headers: {
        'apikey': apiKey,
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: formData
    });

    const data = await response.json();
    
    if (data.IsErroredOnProcessing) {
      return res.status(500).json({ error: data.ErrorMessage?.[0] || 'Błąd OCR.space' });
    }

    // Wyciągnięty tekst z paragonu
    const parsedText = data.ParsedResults?.[0]?.ParsedText || '';
    console.log("Tekst odczytany z OCR.space:", parsedText);

    // Inteligentne wyciąganie liczb z tekstu za pomocą wyrażeń regularnych (Regex)
    // Szukamy cen, kwot i litrów (np. 6.45, 200.00, 35.50)
    const numbers = parsedText
      .replace(/,/g, '.')
      .match(/\d+\.\d{2}/g)
      ?.map(Number) || [];

    // Szukamy daty w formacie RRRR-MM-DD lub DD.MM.RRRR
    const dateMatch = parsedText.match(/(\d{4}[-/.]\d{2}[-/.]\d{2})|(\d{2}[-/.]\d{2}[-/.]\d{4})/);
    let formattedDate = new Date().toISOString().split('T')[0];
    
    if (dateMatch) {
      const cleanDate = dateMatch[0].replace(/\./g, '-').replace(/\//g, '-');
      if (cleanDate.length === 10) formattedDate = cleanDate;
    }

    // Sortujemy liczby rosnąco: najmniejsza to zazwyczaj cena za litr, średnia to litry, największa to kwota całkowita
    let pricePerLiter = 0;
    let totalCost = 0;
    let liters = 0;

    if (numbers.length >= 3) {
      numbers.sort((a, b) => a - b);
      pricePerLiter = numbers.find(n => n < 15) || numbers[0];
      liters = numbers.find(n => n > 5 && n < 100) || numbers[1];
      totalCost = numbers[numbers.length - 1];
    } else if (numbers.length === 2) {
      liters = numbers[0];
      totalCost = numbers[1];
      pricePerLiter = Number((totalCost / liters).toFixed(2));
    }

    const result = {
      pricePerLiter: Number(pricePerLiter || 0),
      totalCost: Number(totalCost || 0),
      liters: Number(liters || 0),
      date: formattedDate,
      time: new Date().toTimeString().slice(0, 5),
      fuelType: parsedText.toLowerCase().includes('lpg') ? 'LPG' : 'PB95'
    };

    return res.status(200).json(result);
  } catch (error) {
    console.error('OCR.space Error:', error);
    return res.status(500).json({ error: 'Błąd przetwarzania OCR.space' });
  }
}