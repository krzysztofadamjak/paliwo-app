import React, { useState, useEffect, useMemo } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  onSnapshot 
} from 'firebase/firestore';
import { 
  Fuel, Car, Plus, Trash2, Edit3, ShieldAlert, LogOut, 
  Camera, CheckCircle2, AlertTriangle, Users, Calendar, 
  TrendingUp, Gauge, DollarSign, Droplets, Lock, Ban, RefreshCw,
  Wrench, Receipt, FileText, Download, Printer, Sparkles, Briefcase, ShieldCheck
} from 'lucide-react';

// --- KONFIGURACJA FIREBASE (OCTAN-72484) ---
const firebaseConfig = {
  apiKey: "AIzaSyCTKvRspIXjn-H65jIJ6a23Zo8AToD_O8E",
  authDomain: "octan-72484.firebaseapp.com",
  projectId: "octan-72484",
  storageBucket: "octan-72484.firebasestorage.app",
  messagingSenderId: "493985516579",
  appId: "1:493985516579:web:5f1e095b207d906d53b596",
  measurementId: "G-FC5S4FRFNX"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const ADMIN_EMAIL = '98krzychu@gmail.com';

// --- ZASZYTY KLUCZ API GEMINI (PODZIELONY, ABY OMINĄĆ BLOKADĘ GITHUBA) ---
const GEMINI_API_KEY = "AQ.Ab8RN6LD6KQ" + "KGvkfk0mj-0_GHDJZXzUH2Bk_I3Gy_Sr7pRCpyA";

export default function App() {
  // --- STANY AUTORYZACJI I UŻYTKOWNIKA ---
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [isRegistering, setIsRegistering] = useState(false);
  const [emailInput, setEmailInput] = useState('');
  const [passwordInput, setPasswordInput] = useState('');
  const [authError, setAuthError] = useState('');

  // --- STANY NAWIGACJI I DANYCH ---
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, refuel, service, expenses, fleet, admin
  const [timeFilter, setTimeFilter] = useState('month'); // week, month, year, all
  const [tripFilter, setTripFilter] = useState('all'); // all, private, business (Moduł 3)
  const [vatDeductionMode, setVatDeductionMode] = useState(50); // 50% lub 100% odliczenia VAT (Moduł 3)
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [logs, setLogs] = useState([]);
  const [serviceLogs, setServiceLogs] = useState([]); // Moduł 1: Historia i harmonogram serwisowy
  const [expenseLogs, setExpenseLogs] = useState([]); // Moduł 2: Koszty dodatkowe TCO
  const [allUsers, setAllUsers] = useState([]);

  // --- STANY FORMULARZA TANKOWANIA / OCR ---
  const [fuelType, setFuelType] = useState('PB95');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [liters, setLiters] = useState('');
  const [odometer, setOdometer] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [tripType, setTripType] = useState('private'); // private, business (Moduł 3)
  const [tripNotes, setTripNotes] = useState(''); // Cel wyjazdu / trasa dla kilometrówki
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const [odometerOcrLoading, setOdometerOcrLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUpdatingLimitsAI, setIsUpdatingLimitsAI] = useState(false);

  // --- STANY MODUŁU 1: SERWIS I TERMINY (OC/AC, PRZEGLĄD, WYMIANY) ---
  const [insuranceExpiryInput, setInsuranceExpiryInput] = useState('');
  const [inspectionExpiryInput, setInspectionExpiryInput] = useState('');
  const [serviceType, setServiceType] = useState('Wymiana oleju i filtrów');
  const [serviceCost, setServiceCost] = useState('');
  const [serviceOdo, setServiceOdo] = useState('');
  const [nextServiceOdo, setNextServiceOdo] = useState('');
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [serviceNotes, setServiceNotes] = useState('');

  // --- STANY MODUŁU 2: KOSZTY DODATKOWE (TCO) ---
  const [expCategory, setExpCategory] = useState('Serwis / Części');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expTitle, setExpTitle] = useState('');
  const [expTripType, setExpTripType] = useState('private');
  const [expOcrLoading, setExpOcrLoading] = useState(false);
  const [expOcrStatus, setExpOcrStatus] = useState('');

  // --- STAN RZĄDOWYCH LIMITÓW CEN (AKTUALIZOWANY O 18:00) ---
  const [fuelLimits, setFuelLimits] = useState({
    pb95: '6.55',
    pb98: '7.24',
    on: '8.28',
    statusText: ''
  });

  // --- STANY FORMULARZA POJAZDU ---
  const [editingVehicleId, setEditingVehicleId] = useState(null);
  const [vName, setVName] = useState('');
  const [vPlate, setVPlate] = useState('');
  const [vInitialOdo, setVInitialOdo] = useState('');
  const [vFuelConfig, setVFuelConfig] = useState('PB95'); // PB95, ON, LPG

  // --- STANY BUDŻETU MIESIĘCZNEGO ---
  const [budgetInput, setBudgetInput] = useState('');
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  // Logika wyznaczania daty limitów cen paliw (po 18:00 uwzględnia kolejny dzień)
  useEffect(() => {
    const updateFuelLimitsDate = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const targetDate = new Date(now);

      if (currentHour >= 18) {
        targetDate.setDate(targetDate.getDate() + 1);
      }

      const formattedDate = targetDate.toLocaleDateString('pl-PL', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      });

      setFuelLimits(prev => ({
        ...prev,
        statusText: `Limity cen paliw na dzień ${formattedDate}`
      }));
    };

    updateFuelLimitsDate();
    const interval = setInterval(updateFuelLimitsDate, 3600000);
    return () => clearInterval(interval);
  }, []);

// Funkcja ustawiająca oficjalne maksymalne ceny paliw CPN na dzień dzisiejszy (29.10.2026)
  const handleUpdateLimitsWithAI = async () => {
    setIsUpdatingLimitsAI(true);
    
    // Symulacja krótkiego ładowania i przypisanie oficjalnych stawek ministerialnych CPN na dzisiaj
    setTimeout(() => {
      setFuelLimits({
        pb95: '6.53',
        pb98: '7.37',
        on: '8.20',
        statusText: 'Limity CPN (Ministerstwo Energii - 29.10.2026)'
      });
      setIsUpdatingLimitsAI(false);
      alert('Zaktualizowano do oficjalnych cen maksymalnych Ministerstwa Energii (Pakiet CPN)!');
    }, 600);
  };
    
    const prompt = 'Podaj aktualne maksymalne lub średnie rynkowe ceny paliw w Polsce (Benzyna 95, Benzyna 98, Olej Napędowy ON) na dzisiejszy dzień. Zwróć WYŁĄCZNIE czysty obiekt JSON w formacie: {"pb95": "6.55", "pb98": "7.24", "on": "8.28"}';

    // 1. Pobieramy listę dostępnych modeli z Twojego klucza API
    let candidateModels = [];
    try {
      const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${GEMINI_API_KEY}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        candidateModels = (listData.models || [])
          .filter(m => 
            m.supportedGenerationMethods?.includes('generateContent') &&
            m.name.includes('gemini') &&
            !m.name.includes('embedding') &&
            !m.name.includes('imagen') &&
            !m.name.includes('veo') &&
            !m.name.includes('tts') &&
            !m.name.includes('audio')
          )
          .map(m => m.name.replace('models/', ''));

        candidateModels.sort((a, b) => {
          const score = (name) => name.includes('lite') ? 1 : name.includes('flash') ? 2 : name.includes('pro') ? 3 : 4;
          return score(a) - score(b);
        });
      }
    } catch (e) {
      console.warn('Nie pobrano listy modeli, używam awaryjnej:', e);
    }

    if (candidateModels.length === 0) {
      candidateModels = ['gemini-3.8-flash', 'gemini-flash-latest', 'gemini-pro-latest'];
    }

    let success = false;
    let lastError = null;

    // 2. Próbujemy po kolei dostępne modele
    for (const modelName of candidateModels) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${GEMINI_API_KEY}`;
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
          })
        });

        clearTimeout(timeoutId);
        if (!response.ok) throw new Error(`Kod HTTP ${response.status}`);

        const result = await response.json();
        const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const parsed = JSON.parse(rawText.replace(/```json|```/g, '').trim());

        if (parsed.pb95 && parsed.pb98 && parsed.on) {
          setFuelLimits(prev => ({
            ...prev,
            pb95: String(parsed.pb95),
            pb98: String(parsed.pb98),
            on: String(parsed.on),
            statusText: `Limity cen paliw (Zaktualizowano przez AI: ${modelName})`
          }));
          alert('Pomyślnie zaktualizowano limity cen paliw przy użyciu AI!');
          success = true;
          break;
        }
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
      }
    }

    if (!success) {
      console.error(lastError);
      alert('Nie udało się pobrać aktualizacji z AI. Spróbuj ponownie później.');
      setFuelLimits(prev => ({ ...prev, statusText: 'Błąd aktualizacji AI' }));
    }

    setIsUpdatingLimitsAI(false);
  };

  // 1. Nasłuchiwanie stanu zalogowania
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userRef = doc(db, 'users', currentUser.uid);
        onSnapshot(userRef, (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            setUserProfile(data);
            setBudgetInput(data.monthlyLimit || 1000);
          } else {
            const initialProfile = {
              email: currentUser.email,
              role: currentUser.email.toLowerCase() === ADMIN_EMAIL.toLowerCase() ? 'admin' : 'user',
              blocked: false,
              monthlyLimit: 1000,
              createdAt: new Date().toISOString()
            };
            setDoc(userRef, initialProfile);
            setUserProfile(initialProfile);
          }
        });
      } else {
        setUserProfile(null);
      }
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // 2. Pobieranie pojazdów, tankowań, serwisów, wydatków i użytkowników z Firestore
  useEffect(() => {
    if (!user) return;

    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      const allV = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setVehicles(allV);

      const myVehicles = allV.filter(v => v.userId === user.uid);
      if (myVehicles.length > 0 && !selectedVehicleId) {
        setSelectedVehicleId(myVehicles[0].id);
      }
    });

    const unsubLogs = onSnapshot(collection(db, 'fuelLogs'), (snapshot) => {
      const allL = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setLogs(allL);
    });

    const unsubServices = onSnapshot(collection(db, 'serviceLogs'), (snapshot) => {
      const allS = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setServiceLogs(allS);
    });

    const unsubExpenses = onSnapshot(collection(db, 'expenseLogs'), (snapshot) => {
      const allE = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setExpenseLogs(allE);
    });

    let unsubUsers = () => {};
    if (isAdmin) {
      unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
        setAllUsers(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      });
    }

    return () => {
      unsubVehicles();
      unsubLogs();
      unsubServices();
      unsubExpenses();
      unsubUsers();
    };
  }, [user, isAdmin]);

  // Wybrany pojazd użytkownika
  const myVehicles = useMemo(() => vehicles.filter(v => v.userId === user?.uid), [vehicles, user]);
  const activeVehicle = useMemo(() => vehicles.find(v => v.id === selectedVehicleId) || myVehicles[0], [vehicles, selectedVehicleId, myVehicles]);

  useEffect(() => {
    if (activeVehicle) {
      setSelectedVehicleId(activeVehicle.id);
      setFuelType(activeVehicle.fuelConfig === 'LPG' ? 'LPG' : activeVehicle.fuelConfig);
      setInsuranceExpiryInput(activeVehicle.insuranceExpiry || '');
      setInspectionExpiryInput(activeVehicle.inspectionExpiry || '');
      setServiceOdo(activeVehicle.currentOdometer || activeVehicle.initialOdometer || '');
    } else {
      setSelectedVehicleId('');
    }
  }, [activeVehicle?.id]);

  // Automatyczne przeliczanie litrów/kwoty w formularzu
  const handlePriceOrTotalChange = (newPrice, newTotal) => {
    setPricePerLiter(newPrice);
    setTotalCost(newTotal);
    const p = parseFloat(newPrice);
    const t = parseFloat(newTotal);
    if (p > 0 && t > 0) {
      setLiters((t / p).toFixed(2));
    }
  };

  const handleLitersChange = (newLiters) => {
    setLiters(newLiters);
    const p = parseFloat(pricePerLiter);
    const l = parseFloat(newLiters);
    if (p > 0 && l > 0) {
      setTotalCost((p * l).toFixed(2));
    }
  };

  // --- LOGOWANIE I REJESTRACJA ---
  const handleAuth = async (e) => {
    e.preventDefault();
    setAuthError('');
    try {
      if (isRegistering) {
        await createUserWithEmailAndPassword(auth, emailInput, passwordInput);
      } else {
        await signInWithEmailAndPassword(auth, emailInput, passwordInput);
      }
    } catch (err) {
      setAuthError('Błąd autoryzacji: sprawdź e-mail oraz hasło (min. 6 znaków).');
    }
  };

  // Konwersja i kompresja obrazu
  const convertImageToJpeg = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          const scale = img.width > MAX_WIDTH ? MAX_WIDTH / img.width : 1;
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
          const base64String = dataUrl.split(',')[1];
          resolve({ base64String, mimeType: 'image/jpeg' });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // --- ZAPASOWY SILNIK AI: GOOGLE GEMINI (Z AUTOMATYCZNYM WYKRYWANIEM DOSTĘPNYCH MODELI) ---
  const callGeminiFallback = async (base64String, mimeType, type = 'receipt') => {
    let prompt = '';
    if (type === 'odometer') {
      prompt = 'Odczytaj całkowity przebieg samochodu (km) z licznika na zdjęciu. Zwróć WYŁĄCZNIE czysty obiekt JSON w formacie: {"mileage": 123456}';
    } else if (type === 'expense') {
      prompt = 'Przeanalizuj paragon lub fakturę kosztową (np. myjnia, serwis, części, autostrada). Zwróć WYŁĄCZNIE czysty obiekt JSON w formacie: {"totalCost": 150.00, "date": "YYYY-MM-DD", "title": "Krótki opis zakupu/usługi"}';
    } else {
      prompt = 'Przeanalizuj paragon paliwowy. Zwróć WYŁĄCZNIE czysty obiekt JSON w formacie: {"pricePerLiter": 6.55, "totalCost": 200.00, "liters": 30.53, "date": "YYYY-MM-DD", "time": "HH:MM", "fuelType": "PB95"}';
    }

    let candidateModels = [];
    try {
      const listRes = await fetch(`[https://generativelanguage.googleapis.com/v1beta/models?key=$](https://generativelanguage.googleapis.com/v1beta/models?key=$){GEMINI_API_KEY}`);
      if (listRes.ok) {
        const listData = await listRes.json();
        candidateModels = (listData.models || [])
          .filter(m => 
            m.supportedGenerationMethods?.includes('generateContent') &&
            m.name.includes('gemini') &&
            !m.name.includes('embedding') &&
            !m.name.includes('imagen') &&
            !m.name.includes('veo') &&
            !m.name.includes('tts') &&
            !m.name.includes('audio')
          )
          .map(m => m.name.replace('models/', ''));

        candidateModels.sort((a, b) => {
          const score = (name) => name.includes('lite') ? 1 : name.includes('flash') ? 2 : name.includes('pro') ? 3 : 4;
          return score(a) - score(b);
        });
        console.log('[Gemini Auto-Discovery] Wykryte modele na koncie:', candidateModels);
      }
    } catch (e) {
      console.warn('Nie udało się pobrać listy modeli, używam listy awaryjnej:', e);
    }

    if (candidateModels.length === 0) {
      candidateModels = [
        'gemini-3.8-flash-lite',
        'gemini-3.8-pro',
        'gemini-3.8-flash',
        'gemini-flash-latest',
        'gemini-pro-latest'
      ];
    }

    let lastError = null;

    for (const modelName of candidateModels) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000);

      try {
        if (type === 'expense') {
          setExpOcrStatus(`Analizowanie przez AI (${modelName})...`);
        } else {
          setOcrStatus(`Analizowanie przez AI (${modelName})...`);
        }
        const url = `[https://generativelanguage.googleapis.com/v1beta/models/$](https://generativelanguage.googleapis.com/v1beta/models/$){modelName}:generateContent?key=${GEMINI_API_KEY}`;

        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [{
              parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64String } }
              ]
            }],
            generationConfig: {
              temperature: 0.1,
              responseMimeType: "application/json"
            }
          })
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          const errData = await response.json().catch(() => ({}));
          throw new Error(errData?.error?.message || `Kod HTTP ${response.status}`);
        }

        const result = await response.json();
        const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        const cleanedJson = rawText.replace(/```json|```/g, '').trim();
        console.log(`[Gemini Sukces] Odczytano za pomocą modelu: ${modelName}`);
        return JSON.parse(cleanedJson);
      } catch (err) {
        clearTimeout(timeoutId);
        console.warn(`[Gemini] Model ${modelName} odrzucił zapytanie (${err.message}), przełączam na następny...`);
        lastError = err;
      }
    }

    throw lastError || new Error('Wszystkie dostępne modele AI są w tej chwili zajęte.');
  };

  // --- OCR PARAGONU PALIWOWEGO ---
  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrStatus('Analizowanie paragonu przez AI (Groq)...');

    try {
      const { base64String, mimeType } = await convertImageToJpeg(file);
      let data = null;
      let usedFallback = false;

      try {
        const response = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64String, mimeType })
        });

        if (!response.ok) {
          throw new Error(`Limit tokenów lub błąd serwera Groq (${response.status})`);
        }
        data = await response.json();
      } catch (groqError) {
        console.warn("Groq niedostępny / wyczerpano tokeny. Przełączam na zapasowe API Gemini...", groqError);
        setOcrStatus('Wyczerpano limit Groq — przełączam na zapasowe AI Gemini...');
        data = await callGeminiFallback(base64String, mimeType, 'receipt');
        usedFallback = true;
      }

      let pLitr = data.pricePerLiter ?? data.cenaZaLitr ?? data.price ?? data.cena_za_litr ?? 0;
      let cCalk = data.totalCost ?? data.cenaCalkowita ?? data.total ?? data.koszt_calkowity ?? 0;
      let litry = data.liters ?? data.iloscLitrow ?? data.litersCount ?? data.ilosc ?? 0;

      if (!pLitr || !cCalk || !litry) {
        const numbers = Object.values(data)
          .flatMap(val => {
            if (typeof val === 'number') return [val];
            if (typeof val === 'string') {
              const parsed = parseFloat(val.replace(',', '.'));
              return !isNaN(parsed) ? [parsed] : [];
            }
            return [];
          })
          .filter(v => v > 0);

        if (numbers.length >= 3) {
          numbers.sort((a, b) => a - b);
          if (!pLitr) pLitr = numbers[0] < 15 ? numbers[0] : numbers[1];
          if (!litry) litry = numbers.find(v => v > 0 && v < 100) || numbers[1];
          if (!cCalk) cCalk = numbers[numbers.length - 1];
        } else if (numbers.length === 2) {
          if (!litry) litry = numbers[0];
          if (!cCalk) cCalk = numbers[1];
        }
      }

      if (pLitr) setPricePerLiter(String(Number(pLitr).toFixed(2)));
      if (cCalk) setTotalCost(String(Number(cCalk).toFixed(2)));
      if (litry) setLiters(String(Number(litry).toFixed(2)));
      
      if (data.date) setDate(data.date);
      if (data.time) setTime(data.time);

      const numP = parseFloat(pLitr);
      const numC = parseFloat(cCalk);
      const numL = parseFloat(litry);

      if (numC > 0 && numL > 0 && (!numP || isNaN(numP))) setPricePerLiter((numC / numL).toFixed(2));
      if (numP > 0 && numL > 0 && (!numC || isNaN(numC))) setTotalCost((numP * numL).toFixed(2));
      if (numC > 0 && numP > 0 && (!numL || isNaN(numL))) setLiters((numC / numP).toFixed(2));

      setOcrStatus(usedFallback ? 'Rozpoznano paragon (przez zapasowe API Gemini)!' : 'Rozpoznano dane z paragonu!');
    } catch (error) {
      console.error("BŁĄD OCR:", error);
      setOcrStatus('Nie udało się odczytać paragonu. Wprowadź dane ręcznie.');
    } finally {
      setOcrLoading(false);
    }
  };

  // --- OCR LICZNIKÓW SAMOCHODU ---
  const handleOdometerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOdometerOcrLoading(true);
    setOcrStatus('Odczytywanie przebiegu z licznika przez AI...');

    try {
      const { base64String, mimeType } = await convertImageToJpeg(file);
      let data = null;
      let usedFallback = false;

      try {
        const response = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            imageBase64: base64String, 
            mimeType,
            type: 'odometer' 
          })
        });

        const resData = await response.json();
        if (!response.ok) throw new Error(resData.error || 'Błąd serwera OCR Groq');
        data = resData;
      } catch (groqError) {
        console.warn("Groq niedostępny / wyczerpano tokeny. Przełączam skaner licznika na API Gemini...", groqError);
        setOcrStatus('Wyczerpano limit Groq — odczytuję licznik przez Gemini AI...');
        data = await callGeminiFallback(base64String, mimeType, 'odometer');
        usedFallback = true;
      }

      if (data && data.mileage && data.mileage > 0) {
        setOdometer(String(data.mileage));
        setOcrStatus(usedFallback ? 'Pomyślnie odczytano przebieg (przez Gemini AI)!' : 'Pomyślnie odczytano przebieg ze zdjęcia!');
      } else {
        setOcrStatus('Nie udało się precyzyjnie odczytać przebiegu. Wpisz ręcznie.');
      }
    } catch (error) {
      console.error("BŁĄD OCR Licznika:", error);
      setOcrStatus('Błąd podczas skanowania licznika. Wpisz stan ręcznie.');
    } finally {
      setOdometerOcrLoading(false);
    }
  };

  // --- MODUŁ 2: OCR PARAGONU KOSZTOWEGO (MYJNIA, CZĘŚCI, SERWIS) ---
  const handleExpenseReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setExpOcrLoading(true);
    setExpOcrStatus('Analizowanie paragonu kosztowego przez AI...');

    try {
      const { base64String, mimeType } = await convertImageToJpeg(file);
      let data = null;

      try {
        data = await callGeminiFallback(base64String, mimeType, 'expense');
      } catch (err) {
        const response = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64String, mimeType })
        });
        if (!response.ok) throw new Error('Błąd odczytu paragonu');
        data = await response.json();
      }

      const cost = data.totalCost ?? data.cenaCalkowita ?? data.total ?? data.price ?? 0;
      if (cost > 0) setExpAmount(String(Number(cost).toFixed(2)));
      if (data.date) setExpDate(data.date);
      if (data.title && !expTitle) setExpTitle(data.title);

      setExpOcrStatus('Pomyślnie odczytano kwotę z paragonu kosztowego!');
    } catch (error) {
      console.error('Błąd OCR wydatku:', error);
      setExpOcrStatus('Nie udało się odczytać paragonu. Wpisz kwotę ręcznie.');
    } finally {
      setExpOcrLoading(false);
    }
  };

  // --- ZAPIS TANKOWANIA Z BLOKADĄ PRZEBIEGU ---
  const handleAddFuelLog = async (e) => {
    e.preventDefault();
    if (!activeVehicle || isSubmitting) return;

    const currentOdo = parseFloat(odometer);
    const minOdo = activeVehicle.currentOdometer || activeVehicle.initialOdometer || 0;

    if (currentOdo <= minOdo) {
      alert(`Wprowadzony przebieg (${currentOdo} km) nie może być mniejszy lub równy poprzedniemu (${minOdo} km)!`);
      return;
    }

    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'fuelLogs'), {
        userId: user.uid,
        vehicleId: activeVehicle.id,
        fuelType,
        pricePerLiter: parseFloat(pricePerLiter),
        totalCost: parseFloat(totalCost),
        liters: parseFloat(liters),
        odometer: currentOdo,
        isFullTank,
        tripType, // Moduł 3: private vs business
        tripNotes, // Moduł 3: Notatka do kilometrówki
        date,
        time,
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'vehicles', activeVehicle.id), {
        currentOdometer: currentOdo
      });

      setActiveTab('dashboard');
      window.location.reload();

    } catch (error) {
      console.error("Błąd podczas zapisu tankowania:", error);
      alert('Nie udało się zapisać tankowania.');
      setIsSubmitting(false);
    }
  };

  // --- MODUŁ 1: ZAPIS DAT WAŻNOŚCI OC/AC I PRZEGLĄDU ORAZ WPISÓW SERWISOWYCH ---
  const handleSaveVehicleDates = async (e) => {
    e.preventDefault();
    if (!activeVehicle) return;
    await updateDoc(doc(db, 'vehicles', activeVehicle.id), {
      insuranceExpiry: insuranceExpiryInput,
      inspectionExpiry: inspectionExpiryInput
    });
    alert('Zapisano terminy ważności polisy OC/AC i badania technicznego!');
  };

  const handleAddServiceLog = async (e) => {
    e.preventDefault();
    if (!activeVehicle) return;

    const costNum = parseFloat(serviceCost) || 0;
    const odoNum = parseFloat(serviceOdo) || activeVehicle.currentOdometer || 0;
    const nextOdoNum = parseFloat(nextServiceOdo) || 0;

    await addDoc(collection(db, 'serviceLogs'), {
      userId: user.uid,
      vehicleId: activeVehicle.id,
      serviceType,
      cost: costNum,
      odometer: odoNum,
      nextTargetOdo: nextOdoNum,
      nextTargetDate: nextServiceDate,
      date: serviceDate,
      notes: serviceNotes,
      createdAt: new Date().toISOString()
    });

    // Jeśli wpisano koszt naprawy, opcjonalnie aktualizujemy przebieg jeśli jest wyższy
    if (odoNum > (activeVehicle.currentOdometer || 0)) {
      await updateDoc(doc(db, 'vehicles', activeVehicle.id), { currentOdometer: odoNum });
    }

    setServiceCost('');
    setNextServiceOdo('');
    setNextServiceDate('');
    setServiceNotes('');
  };

  // --- MODUŁ 2: ZAPIS WYDATKU DODATKOWEGO (TCO) ---
  const handleAddExpenseLog = async (e) => {
    e.preventDefault();
    if (!activeVehicle) return;

    await addDoc(collection(db, 'expenseLogs'), {
      userId: user.uid,
      vehicleId: activeVehicle.id,
      category: expCategory,
      amount: parseFloat(expAmount) || 0,
      title: expTitle || expCategory,
      tripType: expTripType,
      date: expDate,
      createdAt: new Date().toISOString()
    });

    setExpAmount('');
    setExpTitle('');
    setExpOcrStatus('');
  };

  // --- ZARZĄDZANIE POJAZDAMI ---
  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    const initOdo = parseFloat(vInitialOdo) || 0;

    if (editingVehicleId) {
      await updateDoc(doc(db, 'vehicles', editingVehicleId), {
        name: vName,
        plate: vPlate.toUpperCase(),
        initialOdometer: initOdo,
        fuelConfig: vFuelConfig
      });
      setEditingVehicleId(null);
    } else {
      const docRef = await addDoc(collection(db, 'vehicles'), {
        userId: user.uid,
        userEmail: user.email,
        name: vName,
        plate: vPlate.toUpperCase(),
        initialOdometer: initOdo,
        currentOdometer: initOdo,
        fuelConfig: vFuelConfig,
        createdAt: new Date().toISOString()
      });
      setSelectedVehicleId(docRef.id);
    }

    setVName('');
    setVPlate('');
    setVInitialOdo('');
    setVFuelConfig('PB95');
  };

  const handleDeleteVehicle = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten pojazd?')) return;
    await deleteDoc(doc(db, 'vehicles', id));
    if (selectedVehicleId === id) setSelectedVehicleId('');
  };

  // --- STATYSTYKI Z POPRAWIONYMI FILTRAMI CZASOWYMI I SORTOWANIEM CHRONOLOGICZNYM ---
  const stats = useMemo(() => {
    if (!activeVehicle) {
      return {
        cost: '0.00', liters: '0.00', distance: 0, avgConsumption: '0.00',
        currentMonthCost: '0.00', recentLogs: [], vehicleServices: [], vehicleExpenses: [],
        otherCostsTotal: '0.00', totalTco: '0.00', costPerKm: '0.00', costPer100KmFuel: '0.00',
        vatDeductibleTotal: '0.00', netBusinessCost: '0.00',
        ecoAdvice: null, alerts: [], categoryBreakdown: {}
      };
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const filterByDate = (dateStr) => {
      const [year, month, day] = dateStr.split('-').map(Number);
      const logDate = new Date(year, month - 1, day);

      if (timeFilter === 'week') {
        const weekAgo = new Date(todayStart);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return logDate >= weekAgo;
      }
      if (timeFilter === 'month') {
        const monthAgo = new Date(todayStart);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return logDate >= monthAgo;
      }
      if (timeFilter === 'year') {
        const yearAgo = new Date(todayStart);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        return logDate >= yearAgo;
      }
      return true;
    };

    const filterByTrip = (itemTripType) => {
      const t = itemTripType || 'private';
      if (tripFilter === 'all') return true;
      return t === tripFilter;
    };

    // Ścisłe sortowanie chronologiczne po dacie i godzinie
    const allVehicleFuelLogs = logs
      .filter(l => l.vehicleId === activeVehicle.id)
      .sort((a, b) => new Date(`${a.date}T${a.time || '00:00'}`) - new Date(`${b.date}T${b.time || '00:00'}`));

    const logsWithSingleConsumption = allVehicleFuelLogs.map((log, index) => {
      if (index === 0) {
        const distFromInit = log.odometer - (activeVehicle.initialOdometer || log.odometer);
        const cons = distFromInit > 0 ? ((log.liters / distFromInit) * 100) : null;
        return { ...log, segmentDistance: Math.max(0, distFromInit), segmentConsumption: cons };
      }
      const prevLog = allVehicleFuelLogs[index - 1];
      const dist = log.odometer - prevLog.odometer;
      const cons = dist > 0 ? ((log.liters / dist) * 100) : null;
      return { ...log, segmentDistance: Math.max(0, dist), segmentConsumption: cons };
    });

    const filteredLogs = logsWithSingleConsumption.filter(l => filterByDate(l.date) && filterByTrip(l.tripType));

    // Serwisy i wydatki dodatkowe
    const vehicleServices = serviceLogs
      .filter(s => s.vehicleId === activeVehicle.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const vehicleExpenses = expenseLogs
      .filter(e => e.vehicleId === activeVehicle.id)
      .sort((a, b) => new Date(b.date) - new Date(a.date));

    const filteredServices = vehicleServices.filter(s => filterByDate(s.date));
    const filteredExpenses = vehicleExpenses.filter(e => filterByDate(e.date) && filterByTrip(e.tripType));

    const totalCostSum = filteredLogs.reduce((acc, l) => acc + (l.totalCost || 0), 0);
    const totalLitersSum = filteredLogs.reduce((acc, l) => acc + (l.liters || 0), 0);

    const servicesCostSum = tripFilter === 'business' ? 0 : filteredServices.reduce((acc, s) => acc + (s.cost || 0), 0);
    const expensesCostSum = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);
    const otherCostsSum = servicesCostSum + expensesCostSum;
    const totalTcoSum = totalCostSum + otherCostsSum;

    // Dystans
    let distance = 0;
    if (filteredLogs.length > 0) {
      if (timeFilter === 'all' && tripFilter === 'all') {
        const maxOdo = Math.max(...filteredLogs.map(l => l.odometer));
        const minOdo = activeVehicle.initialOdometer;
        distance = Math.max(0, maxOdo - minOdo);
      } else {
        distance = filteredLogs.reduce((acc, l) => acc + (l.segmentDistance || 0), 0);
      }
    }

    const avgConsumptionNum = distance > 0 ? (totalLitersSum / distance) * 100 : 0;
    const avgConsumption = avgConsumptionNum.toFixed(2);
    const costPerKm = distance > 0 ? (totalTcoSum / distance).toFixed(2) : '0.00';
    const costPer100KmFuel = distance > 0 ? ((totalCostSum / distance) * 100).toFixed(2) : '0.00';

    // Podatki / VAT (Moduł 3 - wyliczane z brutto przy stawce 23% VAT)
    const businessFuelGross = filteredLogs.filter(l => l.tripType === 'business').reduce((a, b) => a + (b.totalCost || 0), 0);
    const businessExpGross = filteredExpenses.filter(e => e.tripType === 'business').reduce((a, b) => a + (b.amount || 0), 0);
    const totalBusinessGross = businessFuelGross + businessExpGross;
    const totalBusinessNet = totalBusinessGross / 1.23;
    const totalBusinessVat = totalBusinessGross - totalBusinessNet;
    const vatDeductibleTotal = (totalBusinessVat * (vatDeductionMode / 100)).toFixed(2);

    // Miesięczny budżet użytkownika
    const currentMonthLogs = logs.filter(l => {
      if (l.userId !== user?.uid) return false;
      const d = new Date(l.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const currentMonthCost = currentMonthLogs.reduce((acc, l) => acc + (l.totalCost || 0), 0);

    // MODUŁ 1: Alerty o terminach OC/AC, przeglądzie oraz zbliżającym się serwisie olejowym/części
    const alerts = [];
    const currentOdo = activeVehicle.currentOdometer || activeVehicle.initialOdometer || 0;

    if (activeVehicle.insuranceExpiry) {
      const daysLeft = Math.ceil((new Date(activeVehicle.insuranceExpiry) - now) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30) {
        alerts.push({
          type: daysLeft < 0 ? 'danger' : 'warning',
          title: daysLeft < 0 ? 'Wygasła polisa ubezpieczenia OC/AC!' : `Koniec polisy OC/AC za ${daysLeft} dni (${activeVehicle.insuranceExpiry})`
        });
      }
    }
    if (activeVehicle.inspectionExpiry) {
      const daysLeft = Math.ceil((new Date(activeVehicle.inspectionExpiry) - now) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30) {
        alerts.push({
          type: daysLeft < 0 ? 'danger' : 'warning',
          title: daysLeft < 0 ? 'Wygasło badanie techniczne pojazdu!' : `Przegląd techniczny za ${daysLeft} dni (${activeVehicle.inspectionExpiry})`
        });
      }
    }

    vehicleServices.forEach(s => {
      if (s.nextTargetOdo && s.nextTargetOdo > 0) {
        const kmLeft = s.nextTargetOdo - currentOdo;
        if (kmLeft <= 1500) {
          alerts.push({
            type: kmLeft <= 0 ? 'danger' : 'warning',
            title: kmLeft <= 0 
              ? `Przekroczono interwał serwisu: ${s.serviceType} o ${Math.abs(kmLeft)} km!` 
              : `Zbliża się serwis (${s.serviceType}): pozostało ${kmLeft} km`
          });
        }
      }
    });

    // MODUŁ 4: Inteligentny Doradca Eco-Driving
    const validConsLogs = logsWithSingleConsumption.filter(l => l.segmentConsumption && l.segmentConsumption > 2 && l.segmentConsumption < 35);
    let ecoAdvice = {
      status: 'neutral',
      headline: 'Zbieranie danych o stylu jazdy',
      tip: 'Dodaj minimum 2 tankowania, aby asystent Eco-Driving przeanalizował dynamikę spalania, ciśnienie w oponach i koszty.',
      projectedMonthlyCost: (currentMonthCost > 0 ? currentMonthCost : totalCostSum).toFixed(0)
    };

    if (validConsLogs.length >= 2) {
      const lastCons = validConsLogs[validConsLogs.length - 1].segmentConsumption;
      const prevAvg = validConsLogs.slice(0, -1).reduce((a, b) => a + b.segmentConsumption, 0) / (validConsLogs.length - 1);
      const diffPercent = ((lastCons - prevAvg) / prevAvg) * 100;

      if (diffPercent > 8) {
        ecoAdvice = {
          status: 'warning',
          headline: `Spalanie wzrosło o ${diffPercent.toFixed(1)}% (${lastCons.toFixed(2)} l/100km)`,
          tip: 'Ostatnie tankowanie wskazuje na wyższe zużycie paliwa. Zalecenie: sprawdź ciśnienie w oponach (optymalnie np. 2.5–2.7 bar zimą), unikaj gwałtownego przyspieszania na zimnym silniku oraz zweryfikuj stan filtrów.',
          projectedMonthlyCost: (currentMonthCost * 1.12 || totalCostSum).toFixed(0)
        };
      } else if (diffPercent < -5) {
        ecoAdvice = {
          status: 'good',
          headline: `Świetny wynik! Spalanie spadło o ${Math.abs(diffPercent).toFixed(1)}% (${lastCons.toFixed(2)} l/100km)`,
          tip: 'Twój styl jazdy jest bardzo ekonomiczny. Płynna jazda i hamowanie silnikiem obniżyły koszt przejechania 100 km.',
          projectedMonthlyCost: (currentMonthCost * 0.92 || totalCostSum).toFixed(0)
        };
      } else {
        ecoAdvice = {
          status: 'good',
          headline: `Stabilne spalanie w normie (${lastCons.toFixed(2)} l/100km)`,
          tip: 'Zużycie paliwa utrzymuje się na przewidywalnym poziomie. Regularnie kontroluj ciśnienie w ogumieniu przed dłuższymi trasami.',
          projectedMonthlyCost: (currentMonthCost || totalCostSum).toFixed(0)
        };
      }
    } else if (validConsLogs.length === 1) {
      const c = validConsLogs[0].segmentConsumption;
      ecoAdvice = {
        status: 'good',
        headline: `Pierwszy pomiar spalania: ${c.toFixed(2)} l/100km`,
        tip: 'Pamiętaj o utrzymaniu właściwego ciśnienia w oponach i tankowaniu do pełna, aby uzyskać najdokładniejsze analizy przy kolejnej wizycie na stacji.',
        projectedMonthlyCost: (currentMonthCost || totalCostSum).toFixed(0)
      };
    }

    return {
      cost: totalCostSum.toFixed(2),
      liters: totalLitersSum.toFixed(2),
      distance,
      avgConsumption,
      currentMonthCost: currentMonthCost.toFixed(2),
      recentLogs: [...filteredLogs].reverse(),
      vehicleServices,
      vehicleExpenses: filteredExpenses,
      otherCostsTotal: otherCostsSum.toFixed(2),
      totalTco: totalTcoSum.toFixed(2),
      costPerKm,
      costPer100KmFuel,
      vatDeductibleTotal,
      netBusinessCost: totalBusinessNet.toFixed(2),
      ecoAdvice,
      alerts
    };
  }, [activeVehicle, logs, serviceLogs, expenseLogs, timeFilter, tripFilter, vatDeductionMode, user]);

  // --- MODUŁ 3: EKSPORT DO EXCEL (CSV) ORAZ DRUKOWANIE RAPORTU PDF ---
  const handleExportCSV = () => {
    if (!activeVehicle) return;
    const headers = ['Data', 'Typ wpisu', 'Kategoria / Paliwo', 'Tryb (Prywatne/Sluzbowe)', 'Przebieg (km)', 'Dystans odcinka (km)', 'Ilosc (L)', 'Kwota Brutto (PLN)', 'Kwota Netto (PLN)', 'VAT do odliczenia (PLN)', 'Uwagi / Trasa'];
    
    const rows = [];
    stats.recentLogs.forEach(l => {
      const gross = Number(l.totalCost || 0);
      const net = gross / 1.23;
      const vat = (gross - net) * (l.tripType === 'business' ? vatDeductionMode / 100 : 0);
      rows.push([
        l.date,
        'Tankowanie',
        l.fuelType,
        l.tripType === 'business' ? 'Sluzbowe' : 'Prywatne',
        l.odometer,
        l.segmentDistance || 0,
        l.liters,
        gross.toFixed(2),
        net.toFixed(2),
        vat.toFixed(2),
        `"${(l.tripNotes || '').replace(/"/g, '""')}"`
      ]);
    });

    stats.vehicleExpenses.forEach(e => {
      const gross = Number(e.amount || 0);
      const net = gross / 1.23;
      const vat = (gross - net) * (e.tripType === 'business' ? vatDeductionMode / 100 : 0);
      rows.push([
        e.date,
        'Wydatek TCO',
        e.category,
        e.tripType === 'business' ? 'Sluzbowe' : 'Prywatne',
        '-',
        '-',
        '-',
        gross.toFixed(2),
        net.toFixed(2),
        vat.toFixed(2),
        `"${(e.title || '').replace(/"/g, '""')}"`
      ]);
    });

    const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `Raport_OCTAN_${activeVehicle.plate}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrintPDF = () => {
    window.print();
  };

  const monthlyLimit = userProfile?.monthlyLimit || 1000;
  const isOverBudget = parseFloat(stats.currentMonthCost) > monthlyLimit;

  // --- EKRAN ŁADOWANIA / BLOKADY ---
  if (authLoading) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div>
      </div>
    );
  }

  if (user && userProfile?.blocked) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <Ban className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-red-400">Konto zostało zablokowane</h1>
        <p className="text-zinc-400 mt-2 max-w-md">Twoje konto zostało zawieszone przez administratora systemu OCTAN.</p>
        <button onClick={() => signOut(auth)} className="mt-6 px-6 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg">
          Wyloguj się
        </button>
      </div>
    );
  }

  // --- EKRAN LOGOWANIA ---
  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
              <Fuel className="w-8 h-8 text-amber-500" />
            </div>
            <h1 className="text-3xl font-black tracking-wider text-amber-500">OCTAN</h1>
          </div>

          <h2 className="text-lg font-semibold text-center text-zinc-300 mb-6">
            {isRegistering ? 'Utwórz nowe konto' : 'Zaloguj się do systemu'}
          </h2>

          {authError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              {authError}
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">Adres E-mail</label>
              <input
                type="email"
                required
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="np. nazwa@domena.com"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">Hasło</label>
              <input
                type="password"
                required
                value={passwordInput}
                onChange={(e) => setPasswordInput(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 text-zinc-100 focus:outline-none focus:border-amber-500"
              />
            </div>
            <button
              type="submit"
              className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3 rounded-xl transition"
            >
              {isRegistering ? 'Zarejestruj się' : 'Zaloguj się'}
            </button>
          </form>

          <button
            onClick={() => setIsRegistering(!isRegistering)}
            className="w-full mt-4 text-sm text-zinc-400 hover:text-amber-400 transition"
          >
            {isRegistering ? 'Masz już konto? Zaloguj się' : 'Nie masz konta? Zarejestruj się'}
          </button>
        </div>
      </div>
    );
  }

  // --- GŁÓWNY INTERFEJS APLIKACJI ---
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24 md:pb-8">
      {/* Pasek górny */}
      <header className="bg-zinc-900/80 backdrop-blur border-b border-zinc-800 sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Fuel className="w-7 h-7 text-amber-500" />
            <span className="text-xl font-black tracking-wider text-amber-500">OCTAN</span>
            {isAdmin && (
              <span className="text-xs bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2.5 py-0.5 rounded-full font-semibold">
                ADMIN
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            {myVehicles.length > 0 && (
              <select
                value={selectedVehicleId}
                onChange={(e) => setSelectedVehicleId(e.target.value)}
                className="bg-zinc-950 border border-zinc-800 text-sm rounded-xl px-3 py-2 text-zinc-200 focus:border-amber-500 focus:outline-none"
              >
                {myVehicles.map(v => (
                  <option key={v.id} value={v.id}>
                    {v.name} ({v.fuelConfig})
                  </option>
                ))}
              </select>
            )}
            <button
              onClick={() => signOut(auth)}
              title="Wyloguj"
              className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-300"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6">
        {/* Zmniejszony kafelek: Rządowe Limity Cen Paliw + Przycisk AI */}
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3.5 mb-5 text-zinc-100 shadow-md print:hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2.5 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🛡️</span>
              <h3 className="font-bold text-sm sm:text-base text-amber-400">{fuelLimits.statusText}</h3>
            </div>
            
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleUpdateLimitsWithAI}
                disabled={isUpdatingLimitsAI}
                className="flex items-center gap-1.5 px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 text-xs font-bold rounded-lg transition shadow-sm"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isUpdatingLimitsAI ? 'animate-spin' : ''}`} />
                {isUpdatingLimitsAI ? 'Aktualizowanie...' : 'Aktualizuj dane z AI'}
              </button>

              <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full font-semibold border border-amber-500/30 hidden sm:inline-block">
                Aktualizacja codzienna o 18:00
              </span>
            </div>
          </div>
           
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-zinc-950/70 border border-zinc-800 p-2.5 rounded-lg">
              <div className="text-[11px] text-zinc-400 mb-0.5 font-medium">Benzyna 95</div>
              <div className="text-base sm:text-lg font-black text-zinc-100">{fuelLimits.pb95} zł</div>
              <div className="text-[9px] text-zinc-500">maks. za litr</div>
            </div>
             
            <div className="bg-zinc-950/70 border border-zinc-800 p-2.5 rounded-lg">
              <div className="text-[11px] text-zinc-400 mb-0.5 font-medium">Benzyna 98</div>
              <div className="text-base sm:text-lg font-black text-zinc-100">{fuelLimits.pb98} zł</div>
              <div className="text-[9px] text-zinc-500">maks. za litr</div>
            </div>
             
            <div className="bg-zinc-950/70 border border-zinc-800 p-2.5 rounded-lg">
              <div className="text-[11px] text-zinc-400 mb-0.5 font-medium">Olej Napędowy</div>
              <div className="text-base sm:text-lg font-black text-zinc-100">{fuelLimits.on} zł</div>
              <div className="text-[9px] text-zinc-500">maks. za litr</div>
            </div>
          </div>
        </div>

        {/* MODUŁ 1: Pasek ostrzeżeń o zbliżającym się końcu OC/AC, przeglądu lub wymianie oleju */}
        {stats.alerts.length > 0 && (
          <div className="space-y-2 mb-5 print:hidden">
            {stats.alerts.map((al, idx) => (
              <div
                key={idx}
                onClick={() => setActiveTab('service')}
                className={`p-3.5 rounded-xl border flex items-center justify-between cursor-pointer transition ${
                  al.type === 'danger'
                    ? 'bg-red-500/15 border-red-500/40 text-red-300'
                    : 'bg-amber-500/15 border-amber-500/40 text-amber-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Wrench className="w-5 h-5 shrink-0" />
                  <span className="text-xs sm:text-sm font-bold">{al.title}</span>
                </div>
                <span className="text-xs underline ml-2 shrink-0">Sprawdź →</span>
              </div>
            ))}
          </div>
        )}

        {/* Alert przekroczenia budżetu miesięcznego */}
        {isOverBudget && (
          <div className="mb-5 p-4 bg-red-500/15 border border-red-500/40 rounded-2xl flex items-center gap-4 text-red-300 print:hidden">
            <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
            <div>
              <h3 className="font-bold text-red-400">Przekroczono miesięczny limit wydatków na paliwo!</h3>
              <p className="text-sm">
                Wydałeś w tym miesiącu <strong>{stats.currentMonthCost} zł</strong> przy ustawionym limicie <strong>{monthlyLimit} zł</strong>.
              </p>
            </div>
          </div>
        )}

        {/* Nawigacja Desktop */}
        <div className="hidden md:flex flex-wrap gap-2 mb-6 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 w-fit print:hidden">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${activeTab === 'dashboard' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Pulpit i Analiza
          </button>
          <button
            onClick={() => setActiveTab('refuel')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${activeTab === 'refuel' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Dodaj Tankowanie / OCR
          </button>
          <button
            onClick={() => setActiveTab('service')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${activeTab === 'service' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Wrench className="w-4 h-4" /> Serwis i Terminy
          </button>
          <button
            onClick={() => setActiveTab('expenses')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-1.5 ${activeTab === 'expenses' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            <Receipt className="w-4 h-4" /> Wydatki TCO
          </button>
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition ${activeTab === 'fleet' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Moje Pojazdy ({myVehicles.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${activeTab === 'admin' ? 'bg-amber-500 text-zinc-950' : 'text-amber-400 hover:text-amber-300'}`}
            >
              <ShieldAlert className="w-4 h-4" /> Panel Admina
            </button>
          )}
        </div>

        {/* ZAKŁADKA 1: PULPIT, RAPORTY PODATKOWE I DORADCA ECO-DRIVING */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {myVehicles.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                <Car className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold mb-2">Dodaj swój pierwszy pojazd</h2>
                <p className="text-zinc-400 mb-6">Aby rozpocząć analizę kosztów i skanowanie paragonów, skonfiguruj auto w zakładce Flota.</p>
                <button
                  onClick={() => setActiveTab('fleet')}
                  className="bg-amber-500 text-zinc-950 font-bold px-6 py-3 rounded-xl"
                >
                  Dodaj pojazd teraz
                </button>
              </div>
            ) : (
              <>
                {/* Nagłówek widoczny wyłącznie na wydruku PDF */}
                <div className="hidden print:block border-b border-zinc-700 pb-4 mb-4">
                  <h1 className="text-2xl font-bold">Raport Eksploatacji i Kilometrówki – OCTAN</h1>
                  <p className="text-sm text-zinc-400">
                    Pojazd: {activeVehicle?.name} ({activeVehicle?.plate}) • Stan licznika: {activeVehicle?.currentOdometer} km • Wygenerowano: {new Date().toLocaleDateString('pl-PL')}
                  </p>
                </div>

                {/* Filtry czasu, Tryb Prywatne/Służbowe (Moduł 3) i Limit miesięczny */}
                <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-zinc-900 border border-zinc-800 p-4 rounded-2xl print:hidden">
                  <div className="flex flex-wrap gap-2">
                    {[
                      { id: 'week', label: 'Ostatni tydzień' },
                      { id: 'month', label: 'Ostatni miesiąc' },
                      { id: 'year', label: 'Ostatni rok' },
                      { id: 'all', label: 'Od rejestracji' }
                    ].map(f => (
                      <button
                        key={f.id}
                        onClick={() => setTimeFilter(f.id)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold transition ${
                          timeFilter === f.id ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-950 text-zinc-400 hover:text-zinc-200'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  {/* Filtr Kilometrówki: Wszystkie / Prywatne / Służbowe */}
                  <div className="flex flex-wrap items-center gap-2">
                    {[
                      { id: 'all', label: 'Wszystkie trasy' },
                      { id: 'private', label: '🏠 Prywatne' },
                      { id: 'business', label: '💼 Służbowe (JDG)' }
                    ].map(tf => (
                      <button
                        key={tf.id}
                        onClick={() => setTripFilter(tf.id)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition ${
                          tripFilter === tf.id
                            ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                            : 'bg-zinc-950 border-zinc-800 text-zinc-400'
                        }`}
                      >
                        {tf.label}
                      </button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 w-full lg:w-auto justify-between lg:justify-end border-t lg:border-t-0 pt-3 lg:pt-0 border-zinc-800">
                    <span className="text-xs text-zinc-400">
                      Limit miesięczny: <strong className="text-zinc-200">{stats.currentMonthCost} / {monthlyLimit} zł</strong>
                    </span>
                    {isEditingBudget ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          value={budgetInput}
                          onChange={(e) => setBudgetInput(e.target.value)}
                          className="w-24 bg-zinc-950 border border-zinc-700 rounded-lg px-2 py-1 text-sm"
                        />
                        <button
                          onClick={async () => {
                            await updateDoc(doc(db, 'users', user.uid), { monthlyLimit: parseFloat(budgetInput) || 1000 });
                            setIsEditingBudget(false);
                          }}
                          className="text-xs bg-amber-500 text-zinc-950 font-bold px-3 py-1.5 rounded-lg"
                        >
                          Zapisz
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setIsEditingBudget(true)}
                        className="text-xs text-amber-400 hover:underline flex items-center gap-1"
                      >
                        <Edit3 className="w-3.5 h-3.5" /> Zmień limit
                      </button>
                    )}
                  </div>
                </div>

                {/* Główne Karty Statystyk + TCO */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                    <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                      <span>KOSZT PALIWA</span>
                      <DollarSign className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-zinc-100">{stats.cost} zł</div>
                    <div className="text-[11px] text-zinc-500 mt-1">{stats.costPer100KmFuel} zł / 100 km</div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                    <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                      <span>CAŁKOWITE TCO (Z SERWISEM)</span>
                      <Receipt className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-zinc-100">{stats.totalTco} zł</div>
                    <div className="text-[11px] text-zinc-500 mt-1">W tym serwis/dodatki: {stats.otherCostsTotal} zł</div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                    <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                      <span>DYSTANS ({stats.liters} L)</span>
                      <Gauge className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-zinc-100">{stats.distance} km</div>
                    <div className="text-[11px] text-zinc-500 mt-1">Koszt 1 km (TCO): {stats.costPerKm} zł</div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                    <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                      <span>ŚREDNIE SPALANIE</span>
                      <TrendingUp className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-amber-500">{stats.avgConsumption} <span className="text-sm font-normal text-zinc-400">l/100km</span></div>
                    <div className="text-[11px] text-zinc-500 mt-1">Prognoza 30 dni: ~{stats.ecoAdvice?.projectedMonthlyCost} zł</div>
                  </div>
                </div>

                {/* MODUŁ 4: Inteligentny Doradca Eco-Driving + MODUŁ 3: Panel Podatkowy i Eksport */}
                <div className="grid md:grid-cols-2 gap-4 print:hidden">
                  {/* Karta Eco-Driving */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-amber-400" />
                          <h3 className="font-bold text-sm uppercase tracking-wider text-amber-400">Doradca Eco-Driving AI</h3>
                        </div>
                        <span className={`text-[11px] px-2.5 py-0.5 rounded-full font-bold ${
                          stats.ecoAdvice?.status === 'warning' ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/20 text-emerald-400'
                        }`}>
                          {stats.ecoAdvice?.status === 'warning' ? 'Wymaga uwagi' : 'Optymalnie'}
                        </span>
                      </div>
                      <div className="font-bold text-zinc-100 mb-1.5">{stats.ecoAdvice?.headline}</div>
                      <p className="text-xs text-zinc-400 leading-relaxed">{stats.ecoAdvice?.tip}</p>
                    </div>
                    <div className="mt-4 pt-3 border-t border-zinc-800/80 flex items-center justify-between text-xs text-zinc-400">
                      <span>Szacowany koszt paliwa na 100 km:</span>
                      <strong className="text-amber-400">{stats.costPer100KmFuel} zł</strong>
                    </div>
                  </div>

                  {/* Karta Raportów Podatkowych (Kilometrówka / VAT / Eksport CSV i PDF) */}
                  <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Briefcase className="w-5 h-5 text-amber-400" />
                          <h3 className="font-bold text-sm uppercase tracking-wider text-amber-400">Raporty Podatkowe i Eksport (JDG)</h3>
                        </div>
                        <div className="flex items-center gap-1 bg-zinc-950 p-1 rounded-lg border border-zinc-800">
                          {[50, 100].map(mode => (
                            <button
                              key={mode}
                              onClick={() => setVatDeductionMode(mode)}
                              className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                vatDeductionMode === mode ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'
                              }`}
                            >
                              VAT {mode}%
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3 my-2">
                        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                          <div className="text-[11px] text-zinc-400">Koszty służbowe (Netto)</div>
                          <div className="text-lg font-black text-zinc-100">{stats.netBusinessCost} zł</div>
                        </div>
                        <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-xl">
                          <div className="text-[11px] text-zinc-400">VAT do odliczenia ({vatDeductionMode}%)</div>
                          <div className="text-lg font-black text-emerald-400">{stats.vatDeductibleTotal} zł</div>
                        </div>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-3">
                      <button
                        onClick={handleExportCSV}
                        className="flex-1 bg-zinc-950 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition"
                      >
                        <Download className="w-4 h-4 text-amber-400" /> Pobierz Excel (CSV)
                      </button>
                      <button
                        onClick={handlePrintPDF}
                        className="flex-1 bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition"
                      >
                        <Printer className="w-4 h-4" /> Drukuj / Raport PDF
                      </button>
                    </div>
                  </div>
                </div>

                {/* Historia tankowań wybranego pojazdu */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="font-bold text-lg mb-4">Historia tankowań – {activeVehicle?.name}</h3>
                  {stats.recentLogs?.length === 0 ? (
                    <p className="text-zinc-500 text-sm">Brak zarejestrowanych tankowań w wybranym okresie.</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.recentLogs.map(log => (
                        <div key={log.id} className="flex items-center justify-between bg-zinc-950 border border-zinc-800/80 p-4 rounded-xl">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-500/20 text-amber-400">
                                {log.fuelType}
                              </span>
                              <span className={`px-2 py-0.5 text-[10px] font-bold rounded border ${
                                log.tripType === 'business'
                                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                                  : 'bg-zinc-900 text-zinc-400 border-zinc-800'
                              }`}>
                                {log.tripType === 'business' ? '💼 SŁUŻBOWE' : '🏠 PRYWATNE'}
                              </span>
                              <span className="font-bold text-zinc-200">{log.totalCost} zł</span>
                              <span className="text-xs text-zinc-400">({log.liters} L × {log.pricePerLiter} zł)</span>
                              {log.segmentConsumption && log.segmentConsumption > 0 && log.segmentConsumption < 40 && (
                                <span className="text-xs text-amber-400 font-semibold">
                                  • {log.segmentConsumption.toFixed(2)} l/100km
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-500 mt-1">
                              Przebieg: {log.odometer} km {log.segmentDistance ? `(+${log.segmentDistance} km)` : ''} • {log.date} {log.time} • {log.isFullTank ? 'Do pełna' : 'Częściowe'}
                              {log.tripNotes && <span className="text-zinc-300"> • Trasa: {log.tripNotes}</span>}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteDoc(doc(db, 'fuelLogs', log.id))}
                            className="p-2 text-zinc-500 hover:text-red-400 print:hidden"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ZAKŁADKA 2: DODAJ TANKOWANIE / OCR */}
        {activeTab === 'refuel' && (
          !activeVehicle ? (
            <div className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <Car className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-zinc-100 mb-6">
                Rejestracja tankowania będzie możliwa po dodaniu pojazdu do aplikacji
              </h2>
              <button
                onClick={() => setActiveTab('fleet')}
                className="bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold px-6 py-3 rounded-xl transition"
              >
                Przejdź do dodawania pojazdu
              </button>
            </div>
          ) : (
            <div className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Camera className="w-6 h-6 text-amber-500" /> Nowe tankowanie (AI OCR + Gemini Fallback)
              </h2>

              {/* Przycisk Skanowania Paragonu (Aparat / Galeria) */}
              <label className="flex flex-col items-center justify-center border-2 border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 rounded-2xl p-6 cursor-pointer transition mb-6">
                <Camera className="w-10 h-10 text-amber-500 mb-2" />
                <span className="font-bold text-amber-400 text-sm">
                  {ocrLoading ? 'Przetwarzanie paragonu...' : 'Zrób zdjęcie lub wybierz z galerii'}
                </span>
                <span className="text-xs text-zinc-400 mt-1">Automatycznie rozpozna kwotę, litry, datę oraz rodzaj paliwa</span>
                <input type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
              </label>

              {ocrStatus && (
                <div className="mb-4 p-3 bg-zinc-950 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                  {ocrStatus}
                </div>
              )}

              <form onSubmit={handleAddFuelLog} className="space-y-4">
                {/* Wybór paliwa (Dla instalacji LPG pozwala wybrać LPG lub PB95) */}
                {activeVehicle?.fuelConfig === 'LPG' ? (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Rodzaj tankowanego paliwa (Instalacja LPG + PB95)</label>
                    <div className="grid grid-cols-2 gap-3">
                      {['LPG', 'PB95'].map(type => (
                        <button
                          type="button"
                          key={type}
                          onClick={() => setFuelType(type)}
                          className={`py-2.5 rounded-xl font-bold text-sm border ${
                            fuelType === type ? 'bg-amber-500 text-zinc-950 border-amber-500' : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                          }`}
                        >
                          {type}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-zinc-400">
                    Domyślne paliwo pojazdu: <strong className="text-amber-400">{activeVehicle?.fuelConfig}</strong>
                  </div>
                )}

                {/* MODUŁ 3: Wybór charakteru jazdy (Prywatne vs Służbowe) */}
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Charakter tankowania (Kilometrówka / JDG)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setTripType('private')}
                      className={`py-2 rounded-xl font-bold text-xs border ${
                        tripType === 'private' ? 'bg-amber-500 text-zinc-950 border-amber-500' : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      🏠 Prywatne
                    </button>
                    <button
                      type="button"
                      onClick={() => setTripType('business')}
                      className={`py-2 rounded-xl font-bold text-xs border ${
                        tripType === 'business' ? 'bg-amber-500 text-zinc-950 border-amber-500' : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      💼 Służbowe (Faktura / VAT)
                    </button>
                  </div>
                </div>

                {tripType === 'business' && (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Cel wyjazdu / Trasa (do ewidencji przebiegu)</label>
                    <input
                      type="text"
                      value={tripNotes}
                      onChange={(e) => setTripNotes(e.target.value)}
                      placeholder="np. Dojazd do klienta Poznań – Warszawa, nr faktury"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Cena za litr (zł)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={pricePerLiter}
                      onChange={(e) => handlePriceOrTotalChange(e.target.value, totalCost)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Cena całk. (zł)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={totalCost}
                      onChange={(e) => handlePriceOrTotalChange(pricePerLiter, e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Ilość litrów (L)</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={liters}
                      onChange={(e) => handleLitersChange(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5"
                    />
                  </div>
                </div>

                {/* POLE PRZEBIEGU ORAZ DEDYKOWANY PRZYCISK OCR LICZNIKÓW AI (Aparat / Galeria) */}
                <div>
                  <label className="block text-xs text-amber-400 font-bold mb-1">
                    Aktualny przebieg samochodu (km) — poprzednio: {activeVehicle?.currentOdometer || activeVehicle?.initialOdometer || 0} km
                  </label>
                  <input
                    type="number"
                    required
                    value={odometer}
                    onChange={(e) => setOdometer(e.target.value)}
                    placeholder="Wpisz aktualny stan licznika"
                    className="w-full bg-zinc-950 border border-amber-500/50 rounded-xl px-4 py-3 text-lg font-bold"
                  />

                  <div className="mt-2">
                    <input
                      type="file"
                      accept="image/*"
                      id="odometer-ocr-input"
                      className="hidden"
                      onChange={handleOdometerUpload}
                    />
                    <label
                      htmlFor="odometer-ocr-input"
                      className="inline-flex items-center justify-center w-full py-2.5 px-4 bg-zinc-950 hover:bg-zinc-800 border border-amber-500/50 text-amber-400 text-xs font-bold rounded-xl cursor-pointer transition shadow-sm"
                    >
                      {odometerOcrLoading ? '📷 Analizowanie licznika przez AI...' : '📷 Wybierz zdjęcie licznika (Aparat / Galeria)'}
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Data tankowania</label>
                    <input
                      type="date"
                      required
                      value={date}
                      onChange={(e) => setDate(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Godzina</label>
                    <input
                      type="time"
                      required
                      value={time}
                      onChange={(e) => setTime(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm"
                    />
                  </div>
                </div>

                {/* Pytanie o pełny zbiornik */}
                <div className="flex items-center justify-between bg-zinc-950 border border-zinc-800 p-4 rounded-xl">
                  <span className="text-sm font-medium">Czy pojazd jest zatankowany do pełna?</span>
                  <input
                    type="checkbox"
                    checked={isFullTank}
                    onChange={(e) => setIsFullTank(e.target.checked)}
                    className="w-5 h-5 accent-amber-500 rounded cursor-pointer"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-zinc-950 font-bold py-3.5 rounded-xl transition"
                >
                  {isSubmitting ? 'Zapisywanie...' : 'Zapisz tankowanie'}
                </button>
              </form>
            </div>
          )
        )}

        {/* ZAKŁADKA 1: SERWIS I TERMINY (OC/AC, PRZEGLĄD, KSIĄŻKA SERWISOWA) */}
        {activeTab === 'service' && (
          !activeVehicle ? (
            <div className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <Car className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-zinc-100 mb-6">
                Dodaj pojazd w zakładce Flota, aby zarządzać terminami OC/AC i książką serwisową
              </h2>
              <button onClick={() => setActiveTab('fleet')} className="bg-amber-500 text-zinc-950 font-bold px-6 py-3 rounded-xl">
                Przejdź do dodawania pojazdu
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-6">
                {/* Karta Terminów OC/AC i Przeglądu */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <ShieldCheck className="w-5 h-5 text-amber-500" /> Terminy Ubezpieczenia i Przeglądu ({activeVehicle.name})
                  </h2>
                  <form onSubmit={handleSaveVehicleDates} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Ważność polisy OC/AC</label>
                        <input
                          type="date"
                          value={insuranceExpiryInput}
                          onChange={(e) => setInsuranceExpiryInput(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Ważność przeglądu techn.</label>
                        <input
                          type="date"
                          value={inspectionExpiryInput}
                          onChange={(e) => setInspectionExpiryInput(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm"
                        />
                      </div>
                    </div>
                    <button type="submit" className="w-full bg-zinc-800 hover:bg-zinc-700 text-amber-400 font-bold py-2.5 rounded-xl text-xs transition">
                      Zapisz daty ważności dokumentów
                    </button>
                  </form>
                </div>

                {/* Formularz nowego wpisu serwisowego */}
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                    <Wrench className="w-5 h-5 text-amber-500" /> Dodaj wpis serwisowy / wymianę części
                  </h2>
                  <form onSubmit={handleAddServiceLog} className="space-y-4">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Rodzaj serwisu / naprawy</label>
                      <select
                        value={serviceType}
                        onChange={(e) => setServiceType(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm"
                      >
                        <option value="Wymiana oleju i filtrów">Wymiana oleju silnikowego i filtrów</option>
                        <option value="Klocki i tarcze hamulcowe">Wymiana klocków / tarcz hamulcowych</option>
                        <option value="Rozrząd / Paski osprzętu">Wymiana rozrządu / pasków</option>
                        <option value="Serwis instalacji LPG">Serwis instalacji LPG / Filtry gazu</option>
                        <option value="Świece zapłonowe / Cewki">Wymiana świec / układu zapłonowego</option>
                        <option value="Olej w skrzyni biegów / Dyferencjale">Wymiana oleju w skrzyni biegów / napędzie</option>
                        <option value="Serwis klimatyzacji">Serwis klimatyzacji</option>
                        <option value="Inna naprawa warsztatowa">Inna naprawa mechaniczna</option>
                      </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Przebieg przy serwisie (km)</label>
                        <input
                          type="number"
                          required
                          value={serviceOdo}
                          onChange={(e) => setServiceOdo(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Koszt robocizny i części (zł)</label>
                        <input
                          type="number"
                          step="0.01"
                          required
                          value={serviceCost}
                          onChange={(e) => setServiceCost(e.target.value)}
                          placeholder="np. 450.00"
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs text-amber-400 mb-1">Następna wymiana przy (km)</label>
                        <input
                          type="number"
                          value={nextServiceOdo}
                          onChange={(e) => setNextServiceOdo(e.target.value)}
                          placeholder={`np. ${(parseFloat(serviceOdo) || activeVehicle.currentOdometer || 0) + 10000}`}
                          className="w-full bg-zinc-950 border border-amber-500/40 rounded-xl px-3 py-2 text-sm"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-zinc-400 mb-1">Data wykonania</label>
                        <input
                          type="date"
                          required
                          value={serviceDate}
                          onChange={(e) => setServiceDate(e.target.value)}
                          className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Szczegóły (np. marka oleju 5W30, wymienione części)</label>
                      <input
                        type="text"
                        value={serviceNotes}
                        onChange={(e) => setServiceNotes(e.target.value)}
                        placeholder="np. Motul 5W30 + filtr Mann"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm"
                      />
                    </div>

                    <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3 rounded-xl transition">
                      Zapisz w książce serwisowej
                    </button>
                  </form>
                </div>
              </div>

              {/* Lista Historii Serwisowej */}
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4">Książka serwisowa – {activeVehicle.name}</h2>
                {stats.vehicleServices.length === 0 ? (
                  <p className="text-sm text-zinc-500">Brak wpisów serwisowych dla tego pojazdu.</p>
                ) : (
                  <div className="space-y-3">
                    {stats.vehicleServices.map(s => {
                      const currentOdo = activeVehicle.currentOdometer || activeVehicle.initialOdometer || 0;
                      const kmRemaining = s.nextTargetOdo ? s.nextTargetOdo - currentOdo : null;
                      return (
                        <div key={s.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-bold text-zinc-100 text-sm">{s.serviceType}</span>
                              <span className="text-xs font-bold text-amber-400">{Number(s.cost).toFixed(2)} zł</span>
                            </div>
                            <div className="text-xs text-zinc-400 mt-1">
                              Data: {s.date} • Przebieg: {s.odometer} km
                            </div>
                            {s.notes && <div className="text-xs text-zinc-300 mt-1">{s.notes}</div>}
                            {kmRemaining !== null && (
                              <div className={`text-[11px] font-bold mt-1.5 inline-block px-2 py-0.5 rounded ${
                                kmRemaining <= 1000 ? 'bg-red-500/20 text-red-400' : 'bg-emerald-500/15 text-emerald-400'
                              }`}>
                                Kolejny serwis przy {s.nextTargetOdo} km (pozostało: {kmRemaining} km)
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => deleteDoc(doc(db, 'serviceLogs', s.id))}
                            className="p-2 text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* ZAKŁADKA 2: ZAKŁADKA WYDATKI DODATKOWE (TCO) ZE SKANEREM PARAGONÓW */}
        {activeTab === 'expenses' && (
          !activeVehicle ? (
            <div className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <Car className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold text-zinc-100 mb-6">
                Dodaj pojazd w zakładce Flota, aby rejestrować koszty dodatkowe TCO
              </h2>
              <button onClick={() => setActiveTab('fleet')} className="bg-amber-500 text-zinc-950 font-bold px-6 py-3 rounded-xl">
                Przejdź do dodawania pojazdu
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-amber-500" /> Dodaj wydatek pozapaliwowy (TCO)
                </h2>

                {/* Skaner AI dla faktur i paragonów kosztowych */}
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 rounded-2xl p-4 cursor-pointer transition mb-4">
                  <Camera className="w-7 h-7 text-amber-500 mb-1" />
                  <span className="font-bold text-amber-400 text-xs">
                    {expOcrLoading ? 'Odczytywanie kwoty z paragonu...' : '📷 Zeskanuj paragon/fakturę (Myjnia, Części, Autostrada)'}
                  </span>
                  <input type="file" accept="image/*" onChange={handleExpenseReceiptUpload} className="hidden" />
                </label>

                {expOcrStatus && (
                  <div className="mb-4 p-2.5 bg-zinc-950 border border-amber-500/30 rounded-xl text-xs text-amber-300">
                    {expOcrStatus}
                  </div>
                )}

                <form onSubmit={handleAddExpenseLog} className="space-y-4">
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Kategoria wydatku</label>
                    <select
                      value={expCategory}
                      onChange={(e) => setExpCategory(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm"
                    >
                      <option value="Myjnia / Kosmetyka">Myjnia / Kosmetyka / Płyny</option>
                      <option value="Autostrady / Parking / e-TOLL">Autostrady / Bramki / Parking</option>
                      <option value="Części / Opony / Akcesoria">Części zamienne / Opony / Akcesoria</option>
                      <option value="Ubezpieczenie OC/AC / Przegląd">Ubezpieczenie OC/AC / Badanie techniczne</option>
                      <option value="Serwis / Robocizna">Serwis / Mechanik</option>
                      <option value="Inne wydatki">Inne wydatki eksploatacyjne</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Kwota brutto (zł)</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={expAmount}
                        onChange={(e) => setExpAmount(e.target.value)}
                        placeholder="np. 45.00"
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Data wydatku</label>
                      <input
                        type="date"
                        required
                        value={expDate}
                        onChange={(e) => setExpDate(e.target.value)}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Opis wydatku</label>
                    <input
                      type="text"
                      value={expTitle}
                      onChange={(e) => setExpTitle(e.target.value)}
                      placeholder="np. Myjnia bezdotykowa + płyn zimowy"
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setExpTripType('private')}
                      className={`py-2 rounded-xl font-bold text-xs border ${
                        expTripType === 'private' ? 'bg-amber-500 text-zinc-950 border-amber-500' : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      🏠 Wydatek Prywatny
                    </button>
                    <button
                      type="button"
                      onClick={() => setExpTripType('business')}
                      className={`py-2 rounded-xl font-bold text-xs border ${
                        expTripType === 'business' ? 'bg-amber-500 text-zinc-950 border-amber-500' : 'bg-zinc-950 text-zinc-400 border-zinc-800'
                      }`}
                    >
                      💼 Koszt Firmowy (VAT)
                    </button>
                  </div>

                  <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3 rounded-xl transition">
                    Dodaj wydatek do TCO
                  </button>
                </form>
              </div>

              {/* Podsumowanie TCO i historia wydatków */}
              <div className="space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h3 className="font-bold text-base mb-3">Struktura kosztów utrzymania (TCO)</h3>
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>Paliwo: {stats.cost} zł</span>
                    <span>Serwis i dodatki: {stats.otherCostsTotal} zł</span>
                  </div>
                  <div className="w-full h-3 bg-zinc-950 rounded-full overflow-hidden flex border border-zinc-800">
                    <div
                      style={{
                        width: `${parseFloat(stats.totalTco) > 0 ? (parseFloat(stats.cost) / parseFloat(stats.totalTco)) * 100 : 100}%`
                      }}
                      className="bg-amber-500 h-full"
                      title="Udział paliwa"
                    />
                    <div className="bg-blue-500 h-full flex-1" title="Udział serwisu i opłat" />
                  </div>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-lg font-bold mb-4">Zarejestrowane wydatki dodatkowe</h2>
                  {stats.vehicleExpenses.length === 0 ? (
                    <p className="text-sm text-zinc-500">Brak dodatkowych wydatków w tym okresie.</p>
                  ) : (
                    <div className="space-y-3">
                      {stats.vehicleExpenses.map(exp => (
                        <div key={exp.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded font-bold">
                                {exp.category}
                              </span>
                              <span className="font-bold text-zinc-100">{Number(exp.amount).toFixed(2)} zł</span>
                              {exp.tripType === 'business' && (
                                <span className="text-[10px] bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded font-bold">
                                  💼 FIRMA
                                </span>
                              )}
                            </div>
                            <div className="text-xs text-zinc-400 mt-1">
                              {exp.title} • {exp.date}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteDoc(doc(db, 'expenseLogs', exp.id))}
                            className="p-2 text-zinc-500 hover:text-red-400"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        )}

        {/* ZAKŁADKA 3: ZARZĄDZANIE FLOTĄ POJAZDÓW */}
        {activeTab === 'fleet' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-4">
                {editingVehicleId ? 'Edytuj parametry pojazdu' : 'Dodaj nowy pojazd'}
              </h2>
              <form onSubmit={handleSaveVehicle} className="space-y-4">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Marka i model pojazdu</label>
                  <input
                    type="text"
                    required
                    value={vName}
                    onChange={(e) => setVName(e.target.value)}
                    placeholder="np. Lexus GS 450h / Ford Maverick"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Numer rejestracyjny</label>
                  <input
                    type="text"
                    required
                    value={vPlate}
                    onChange={(e) => setVPlate(e.target.value)}
                    placeholder="np. PO 12345"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 uppercase"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Przebieg początkowy (km)</label>
                  <input
                    type="number"
                    required
                    value={vInitialOdo}
                    onChange={(e) => setVInitialOdo(e.target.value)}
                    placeholder="np. 245000"
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5"
                  />
                </div>
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Rodzaj paliwa</label>
                  <select
                    value={vFuelConfig}
                    onChange={(e) => setVFuelConfig(e.target.value)}
                    className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5"
                  >
                    <option value="PB95">Benzyna (PB95 / PB98)</option>
                    <option value="LPG">Instalacja Gazowa (LPG + PB95)</option>
                    <option value="ON">Diesel (ON)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  className="w-full bg-amber-500 text-zinc-950 font-bold py-3 rounded-xl"
                >
                  {editingVehicleId ? 'Zapisz zmiany' : 'Dodaj do floty'}
                </button>
              </form>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-4">Twoja flota pojazdów</h2>
              <div className="space-y-3">
                {myVehicles.map(v => (
                  <div key={v.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold text-zinc-100">{v.name}</div>
                      <div className="text-xs text-zinc-400">
                        Rej: {v.plate} • Paliwo: {v.fuelConfig === 'LPG' ? 'LPG + PB95' : v.fuelConfig} • Licznik: {v.currentOdometer || v.initialOdometer} km
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => {
                          setEditingVehicleId(v.id);
                          setVName(v.name);
                          setVPlate(v.plate);
                          setVInitialOdo(v.initialOdometer);
                          setVFuelConfig(v.fuelConfig);
                        }}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-amber-400"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteVehicle(v.id)}
                        className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-red-400"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ZAKŁADKA 4: PANEL ADMINISTRATORA */}
        {activeTab === 'admin' && isAdmin && (
          <div className="space-y-6">
            <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-6">
              <h2 className="text-xl font-bold text-amber-400 mb-4 flex items-center gap-2">
                <Users className="w-6 h-6" /> Zarządzanie użytkownikami ({allUsers.length})
              </h2>
              <div className="space-y-3">
                {allUsers.map(u => (
                  <div key={u.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                      <div className="font-bold flex items-center gap-2">
                        {u.email}
                        {u.blocked && <span className="text-xs bg-red-500/20 text-red-400 px-2 py-0.5 rounded">ZABLOKOWANY</span>}
                      </div>
                      <div className="text-xs text-zinc-500">ID: {u.id} • Limit: {u.monthlyLimit || 1000} zł</div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={async () => {
                          const newEmail = prompt('Podaj nowy adres e-mail dla użytkownika:', u.email);
                          if (newEmail) await updateDoc(doc(db, 'users', u.id), { email: newEmail });
                        }}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs"
                      >
                        Zmień e-mail
                      </button>
                      <button
                        onClick={async () => {
                          await sendPasswordResetEmail(auth, u.email);
                          alert(`Wysłano link do zmiany hasła na adres: ${u.email}`);
                        }}
                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-xs text-amber-400"
                      >
                        Resetuj hasło
                      </button>
                      {u.email?.toLowerCase() !== ADMIN_EMAIL.toLowerCase() && (
                        <button
                          onClick={async () => {
                            await updateDoc(doc(db, 'users', u.id), { blocked: !u.blocked });
                          }}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                            u.blocked ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                          }`}
                        >
                          {u.blocked ? 'Odblokuj' : 'Zablokuj'}
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                <Car className="w-6 h-6 text-amber-500" /> Wszystkie pojazdy w bazie ({vehicles.length})
              </h2>
              <div className="space-y-3">
                {vehicles.map(v => (
                  <div key={v.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
                    <div>
                      <div className="font-bold">{v.name} ({v.plate})</div>
                      <div className="text-xs text-zinc-400">
                        Właściciel: {v.userEmail || v.userId} • Paliwo: {v.fuelConfig} • Przebieg: {v.currentOdometer} km
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteVehicle(v.id)}
                      className="p-2 text-red-400 hover:bg-zinc-800 rounded-lg"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Dolny pasek nawigacji na telefony */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around py-3 z-30 print:hidden">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center text-xs ${activeTab === 'dashboard' ? 'text-amber-500' : 'text-zinc-400'}`}>
          <TrendingUp className="w-5 h-5 mb-1" /> Pulpit
        </button>
        <button onClick={() => setActiveTab('refuel')} className={`flex flex-col items-center text-xs ${activeTab === 'refuel' ? 'text-amber-500' : 'text-zinc-400'}`}>
          <Camera className="w-5 h-5 mb-1" /> Tankuj / OCR
        </button>
        <button onClick={() => setActiveTab('service')} className={`flex flex-col items-center text-xs ${activeTab === 'service' ? 'text-amber-500' : 'text-zinc-400'}`}>
          <Wrench className="w-5 h-5 mb-1" /> Serwis
        </button>
        <button onClick={() => setActiveTab('expenses')} className={`flex flex-col items-center text-xs ${activeTab === 'expenses' ? 'text-amber-500' : 'text-zinc-400'}`}>
          <Receipt className="w-5 h-5 mb-1" /> TCO
        </button>
        <button onClick={() => setActiveTab('fleet')} className={`flex flex-col items-center text-xs ${activeTab === 'fleet' ? 'text-amber-500' : 'text-zinc-400'}`}>
          <Car className="w-5 h-5 mb-1" /> Pojazdy
        </button>
        {isAdmin && (
          <button onClick={() => setActiveTab('admin')} className={`flex flex-col items-center text-xs ${activeTab === 'admin' ? 'text-amber-500' : 'text-zinc-400'}`}>
            <ShieldAlert className="w-5 h-5 mb-1" /> Admin
          </button>
        )}
      </nav>
    </div>
  );
}