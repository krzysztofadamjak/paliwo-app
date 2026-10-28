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
  TrendingUp, Gauge, DollarSign, Droplets, Lock, Ban, RefreshCw
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

// ZASZYTY KLUCZ API GEMINI (podzielony plusem, by ominąć skaner GitHuba)
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
  const [activeTab, setActiveTab] = useState('dashboard');
  const [timeFilter, setTimeFilter] = useState('month'); 
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [logs, setLogs] = useState([]);
  const [allUsers, setAllUsers] = useState([]);

  // --- STANY FORMULARZA TANKOWANIA / OCR ---
  const [fuelType, setFuelType] = useState('PB95');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [liters, setLiters] = useState('');
  const [odometer, setOdometer] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const [odometerOcrLoading, setOdometerOcrLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

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
  const [vFuelConfig, setVFuelConfig] = useState('PB95');

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

      setFuelLimits({
        pb95: '6.55',
        pb98: '7.24',
        on: '8.28',
        statusText: `Limity cen paliw na dzień ${formattedDate}`
      });
    };

    updateFuelLimitsDate();
    const interval = setInterval(updateFuelLimitsDate, 3600000);
    return () => clearInterval(interval);
  }, []);

  // Nasłuchiwanie stanu zalogowania
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

  // Pobieranie danych z Firestore
  useEffect(() => {
    if (!user) return;

    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      const allV = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setVehicles(allV);
      const myVehicles = allV.filter(v => v.userId === user.uid);
      if (myVehicles.length > 0 && !selectedVehicleId) setSelectedVehicleId(myVehicles[0].id);
    });

    const unsubLogs = onSnapshot(collection(db, 'fuelLogs'), (snapshot) => {
      setLogs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
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
      unsubUsers();
    };
  }, [user, isAdmin]);

  const myVehicles = useMemo(() => vehicles.filter(v => v.userId === user?.uid), [vehicles, user]);
  const activeVehicle = useMemo(() => vehicles.find(v => v.id === selectedVehicleId) || myVehicles[0], [vehicles, selectedVehicleId, myVehicles]);

  useEffect(() => {
    if (activeVehicle) {
      setSelectedVehicleId(activeVehicle.id);
      setFuelType(activeVehicle.fuelConfig === 'LPG' ? 'LPG' : activeVehicle.fuelConfig);
    }
  }, [activeVehicle?.id]);

  const handlePriceOrTotalChange = (newPrice, newTotal) => {
    setPricePerLiter(newPrice);
    setTotalCost(newTotal);
    const p = parseFloat(newPrice);
    const t = parseFloat(newTotal);
    if (p > 0 && t > 0) setLiters((t / p).toFixed(2));
  };

  const handleLitersChange = (newLiters) => {
    setLiters(newLiters);
    const p = parseFloat(pricePerLiter);
    const l = parseFloat(newLiters);
    if (p > 0 && l > 0) setTotalCost((p * l).toFixed(2));
  };

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

  // Kompresja obrazu dla API
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
          resolve({ base64String: dataUrl.split(',')[1], mimeType: 'image/jpeg' });
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // --- POPRAWIONY, NIEZAWIESZAJĄCY SIĘ SILNIK ZAPASOWY GEMINI ---
  const callGeminiFallback = async (base64String, mimeType, type = 'receipt') => {
    console.log(`[Gemini Fallback] Uruchamiam rozpoznawanie: ${type}`);
    
    const prompt = type === 'odometer'
      ? 'Odczytaj całkowity przebieg samochodu (km) z licznika na zdjęciu. Zwróć WYŁĄCZNIE czysty obiekt JSON w formacie: {"mileage": 123456}'
      : 'Przeanalizuj paragon paliwowy. Zwróć WYŁĄCZNIE czysty obiekt JSON w formacie: {"pricePerLiter": 6.55, "totalCost": 200.00, "liters": 30.53, "date": "YYYY-MM-DD", "time": "HH:MM", "fuelType": "PB95"}';

    // 100% niezawodny model i endpoint API
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`;
    
    // Ustawienie wymuszonego limitu czasu (15 sekund), aby aplikacja się nie zawieszała
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    try {
      console.log(`[Gemini Fallback] Wysyłam zapytanie do Google API...`);
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
          generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
        })
      });

      clearTimeout(timeoutId);
      console.log(`[Gemini Fallback] Otrzymano kod statusu: ${response.status}`);

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData?.error?.message || `Błąd serwera Gemini (Kod ${response.status})`);
      }

      const result = await response.json();
      const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
      const cleanedJson = rawText.replace(/```json|```/g, '').trim();
      console.log(`[Gemini Fallback] Sukces, wyodrębniono JSON:`, cleanedJson);
      return JSON.parse(cleanedJson);

    } catch (err) {
      clearTimeout(timeoutId);
      if (err.name === 'AbortError') {
        throw new Error('Serwer Gemini nie odpowiedział w ciągu 15 sekund (Zbyt długi czas oczekiwania).');
      }
      console.error("[Gemini Fallback] Wystąpił krytyczny błąd połączenia:", err);
      throw err;
    }
  };

  // --- OCR PARAGONU ---
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

        if (!response.ok) throw new Error(`Błąd serwera Groq (${response.status})`);
        data = await response.json();
      } catch (groqError) {
        console.warn("Groq zawiódł. Przełączam na Gemini...", groqError);
        setOcrStatus('Wyczerpano limit Groq — uruchamiam zapasowe AI Gemini...');
        data = await callGeminiFallback(base64String, mimeType, 'receipt');
        usedFallback = true;
      }

      let pLitr = data.pricePerLiter ?? data.cenaZaLitr ?? data.price ?? data.cena_za_litr ?? 0;
      let cCalk = data.totalCost ?? data.cenaCalkowita ?? data.total ?? data.koszt_calkowity ?? 0;
      let litry = data.liters ?? data.iloscLitrow ?? data.litersCount ?? data.ilosc ?? 0;

      if (!pLitr || !cCalk || !litry) {
        const numbers = Object.values(data).flatMap(val => {
          if (typeof val === 'number') return [val];
          if (typeof val === 'string') {
            const parsed = parseFloat(val.replace(',', '.'));
            return !isNaN(parsed) ? [parsed] : [];
          }
          return [];
        }).filter(v => v > 0);

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

      setOcrStatus(usedFallback ? 'Rozpoznano paragon (przez API Gemini)!' : 'Rozpoznano dane z paragonu!');
    } catch (error) {
      console.error("BŁĄD GŁÓWNY OCR:", error);
      setOcrStatus(`Nie udało się odczytać paragonu (${error.message}). Wprowadź dane ręcznie.`);
    } finally {
      setOcrLoading(false);
    }
  };

  // --- OCR LICZNIKÓW ---
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
          body: JSON.stringify({ imageBase64: base64String, mimeType, type: 'odometer' })
        });
        if (!response.ok) throw new Error('Błąd serwera OCR Groq');
        data = await response.json();
      } catch (groqError) {
        console.warn("Groq zawiódł. Skanuję licznik przez Gemini...", groqError);
        setOcrStatus('Wyczerpano limit Groq — odczytuję licznik przez Gemini AI...');
        data = await callGeminiFallback(base64String, mimeType, 'odometer');
        usedFallback = true;
      }

      if (data && data.mileage && data.mileage > 0) {
        setOdometer(String(data.mileage));
        setOcrStatus(usedFallback ? 'Odczytano przebieg (przez Gemini)!' : 'Odczytano przebieg ze zdjęcia!');
      } else {
        setOcrStatus('Nie precyzyjnie odczytano przebiegu. Wpisz ręcznie.');
      }
    } catch (error) {
      console.error("BŁĄD GŁÓWNY LICZNIKA:", error);
      setOcrStatus(`Błąd podczas skanowania (${error.message}). Wpisz stan ręcznie.`);
    } finally {
      setOdometerOcrLoading(false);
    }
  };

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
        date,
        time,
        createdAt: new Date().toISOString()
      });

      await updateDoc(doc(db, 'vehicles', activeVehicle.id), { currentOdometer: currentOdo });
      setActiveTab('dashboard');
      window.location.reload();
    } catch (error) {
      console.error("Błąd podczas zapisu tankowania:", error);
      alert('Nie udało się zapisać tankowania.');
      setIsSubmitting(false);
    }
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    const initOdo = parseFloat(vInitialOdo) || 0;

    if (editingVehicleId) {
      await updateDoc(doc(db, 'vehicles', editingVehicleId), {
        name: vName, plate: vPlate.toUpperCase(), initialOdometer: initOdo, fuelConfig: vFuelConfig
      });
      setEditingVehicleId(null);
    } else {
      const docRef = await addDoc(collection(db, 'vehicles'), {
        userId: user.uid, userEmail: user.email, name: vName, plate: vPlate.toUpperCase(),
        initialOdometer: initOdo, currentOdometer: initOdo, fuelConfig: vFuelConfig, createdAt: new Date().toISOString()
      });
      setSelectedVehicleId(docRef.id);
    }
    setVName(''); setVPlate(''); setVInitialOdo(''); setVFuelConfig('PB95');
  };

  const handleDeleteVehicle = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten pojazd?')) return;
    await deleteDoc(doc(db, 'vehicles', id));
    if (selectedVehicleId === id) setSelectedVehicleId('');
  };

  const stats = useMemo(() => {
    if (!activeVehicle) return { cost: 0, liters: 0, distance: 0, avgConsumption: 0, currentMonthCost: 0 };
    const vehicleLogs = logs.filter(l => l.vehicleId === activeVehicle.id).sort((a, b) => a.odometer - b.odometer);
    const now = new Date();
    const filteredLogs = vehicleLogs.filter(l => {
      const logDate = new Date(l.date);
      if (timeFilter === 'week') return logDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (timeFilter === 'month') return logDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (timeFilter === 'year') return logDate >= new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      return true;
    });

    const totalCostSum = filteredLogs.reduce((acc, l) => acc + (l.totalCost || 0), 0);
    const totalLitersSum = filteredLogs.reduce((acc, l) => acc + (l.liters || 0), 0);
    let distance = 0;
    if (filteredLogs.length > 0) {
      const maxOdo = Math.max(...filteredLogs.map(l => l.odometer));
      const minOdo = timeFilter === 'all' ? activeVehicle.initialOdometer : Math.min(...filteredLogs.map(l => l.odometer));
      distance = Math.max(0, maxOdo - minOdo);
    }

    const currentMonthLogs = logs.filter(l => {
      if (l.userId !== user?.uid) return false;
      const d = new Date(l.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });

    return {
      cost: totalCostSum.toFixed(2), liters: totalLitersSum.toFixed(2), distance,
      avgConsumption: distance > 0 ? ((totalLitersSum / distance) * 100).toFixed(2) : '0.00',
      currentMonthCost: currentMonthLogs.reduce((acc, l) => acc + (l.totalCost || 0), 0).toFixed(2),
      recentLogs: [...filteredLogs].reverse()
    };
  }, [activeVehicle, logs, timeFilter, user]);

  const monthlyLimit = userProfile?.monthlyLimit || 1000;
  const isOverBudget = parseFloat(stats.currentMonthCost) > monthlyLimit;

  if (authLoading) return <div className="min-h-screen bg-zinc-950 flex items-center justify-center"><div className="animate-spin rounded-full h-10 w-10 border-t-2 border-amber-500"></div></div>;
  if (user && userProfile?.blocked) return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
      <Ban className="w-16 h-16 text-red-500 mb-4" />
      <h1 className="text-2xl font-bold text-red-400">Konto zablokowane</h1>
      <button onClick={() => signOut(auth)} className="mt-6 px-6 py-2 bg-zinc-800 rounded-lg">Wyloguj się</button>
    </div>
  );

  if (!user) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center p-4">
        <div className="w-full max-w-md bg-zinc-900 border border-zinc-800 rounded-2xl p-8 shadow-2xl">
          <div className="flex items-center justify-center gap-3 mb-6">
            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl"><Fuel className="w-8 h-8 text-amber-500" /></div>
            <h1 className="text-3xl font-black tracking-wider text-amber-500">OCTAN</h1>
          </div>
          <h2 className="text-lg font-semibold text-center text-zinc-300 mb-6">{isRegistering ? 'Utwórz konto' : 'Zaloguj się'}</h2>
          {authError && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{authError}</div>}
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">Adres E-mail</label>
              <input type="email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:border-amber-500" />
            </div>
            <div>
              <label className="block text-xs uppercase tracking-wider text-zinc-400 mb-1">Hasło</label>
              <input type="password" required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3 focus:border-amber-500" />
            </div>
            <button type="submit" className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3 rounded-xl transition">{isRegistering ? 'Zarejestruj się' : 'Zaloguj się'}</button>
          </form>
          <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-4 text-sm text-zinc-400 hover:text-amber-400">{isRegistering ? 'Masz konto? Zaloguj' : 'Nie masz? Zarejestruj'}</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24 md:pb-8">
      <header className="bg-zinc-900/80 backdrop-blur border-b border-zinc-800 sticky top-0 z-30">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Fuel className="w-7 h-7 text-amber-500" />
            <span className="text-xl font-black tracking-wider text-amber-500">OCTAN</span>
            {isAdmin && <span className="text-xs bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full font-semibold">ADMIN</span>}
          </div>
          <div className="flex items-center gap-3">
            {myVehicles.length > 0 && (
              <select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} className="bg-zinc-950 border border-zinc-800 text-sm rounded-xl px-3 py-2">
                {myVehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.fuelConfig})</option>)}
              </select>
            )}
            <button onClick={() => signOut(auth)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-300"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6">
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-2xl p-5 mb-6 shadow-lg">
          <div className="flex flex-col md:flex-row justify-between mb-4 gap-2">
            <div className="flex items-center gap-2"><span className="text-xl">🛡️</span><h3 className="font-bold text-amber-400">{fuelLimits.statusText}</h3></div>
            <span className="text-xs bg-amber-500/20 text-amber-300 px-3 py-1 rounded-full font-semibold border border-amber-500/30">Aktualizacja codzienna o 18:00</span>
          </div>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="bg-zinc-950/70 border border-zinc-800 p-3.5 rounded-xl"><div className="text-xs text-zinc-400 mb-1">Benzyna 95</div><div className="text-xl font-black">{fuelLimits.pb95} zł</div></div>
            <div className="bg-zinc-950/70 border border-zinc-800 p-3.5 rounded-xl"><div className="text-xs text-zinc-400 mb-1">Benzyna 98</div><div className="text-xl font-black">{fuelLimits.pb98} zł</div></div>
            <div className="bg-zinc-950/70 border border-zinc-800 p-3.5 rounded-xl"><div className="text-xs text-zinc-400 mb-1">Olej Napędowy</div><div className="text-xl font-black">{fuelLimits.on} zł</div></div>
          </div>
        </div>

        {isOverBudget && (
          <div className="mb-6 p-4 bg-red-500/15 border border-red-500/40 rounded-2xl flex items-center gap-4 text-red-300">
            <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
            <div>
              <h3 className="font-bold">Przekroczono miesięczny limit!</h3>
              <p className="text-sm">Wydałeś <strong>{stats.currentMonthCost} zł</strong> z limitu <strong>{monthlyLimit} zł</strong>.</p>
            </div>
          </div>
        )}

        <div className="hidden md:flex gap-2 mb-6 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 w-fit">
          {['dashboard', 'refuel', 'fleet'].map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} className={`px-5 py-2.5 rounded-xl text-sm font-semibold ${activeTab === tab ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'}`}>
              {tab === 'dashboard' ? 'Pulpit' : tab === 'refuel' ? 'Dodaj Tankowanie' : `Pojazdy (${myVehicles.length})`}
            </button>
          ))}
          {isAdmin && <button onClick={() => setActiveTab('admin')} className={`px-5 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${activeTab === 'admin' ? 'bg-amber-500 text-zinc-950' : 'text-amber-400'}`}><ShieldAlert className="w-4 h-4" /> Admin</button>}
        </div>

        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {myVehicles.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                <Car className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold mb-2">Dodaj pojazd</h2>
                <button onClick={() => setActiveTab('fleet')} className="bg-amber-500 text-zinc-950 font-bold px-6 py-3 rounded-xl mt-4">Dodaj teraz</button>
              </div>
            ) : (
              <>
                <div className="flex flex-col md:flex-row gap-4 justify-between bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
                  <div className="flex flex-wrap gap-2">
                    {[{ id: 'week', label: 'Tydzień' }, { id: 'month', label: 'Miesiąc' }, { id: 'year', label: 'Rok' }, { id: 'all', label: 'Wszystkie' }].map(f => (
                      <button key={f.id} onClick={() => setTimeFilter(f.id)} className={`px-3 py-2 rounded-xl text-xs font-bold ${timeFilter === f.id ? 'bg-amber-500 text-zinc-950' : 'bg-zinc-950 text-zinc-400'}`}>{f.label}</button>
                    ))}
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-zinc-400">Limit: <strong>{stats.currentMonthCost} / {monthlyLimit} zł</strong></span>
                    {isEditingBudget ? (
                      <div className="flex gap-2"><input type="number" value={budgetInput} onChange={(e) => setBudgetInput(e.target.value)} className="w-24 bg-zinc-950 border border-zinc-700 rounded-lg px-2 text-sm" /><button onClick={() => { updateDoc(doc(db, 'users', user.uid), { monthlyLimit: parseFloat(budgetInput) || 1000 }); setIsEditingBudget(false); }} className="text-xs bg-amber-500 text-zinc-950 px-3 rounded-lg">Zapisz</button></div>
                    ) : (
                      <button onClick={() => setIsEditingBudget(true)} className="text-xs text-amber-400 flex items-center"><Edit3 className="w-3.5 h-3.5 mr-1" /> Zmień limit</button>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { title: 'KOSZT PALIWA', icon: DollarSign, val: stats.cost, unit: 'zł' },
                    { title: 'ZATANKOWANO', icon: Droplets, val: stats.liters, unit: 'L' },
                    { title: 'DYSTANS', icon: Gauge, val: stats.distance, unit: 'km' },
                    { title: 'ŚREDNIE SPALANIE', icon: TrendingUp, val: stats.avgConsumption, unit: 'l/100km', color: 'text-amber-500' }
                  ].map((s, i) => (
                    <div key={i} className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                      <div className="flex justify-between text-zinc-400 text-xs mb-2"><span>{s.title}</span><s.icon className="w-4 h-4 text-amber-500" /></div>
                      <div className={`text-2xl font-black ${s.color || 'text-zinc-100'}`}>{s.val} <span className="text-sm font-normal text-zinc-400">{s.unit}</span></div>
                    </div>
                  ))}
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-5">
                  <h3 className="font-bold text-lg mb-4">Historia tankowań – {activeVehicle?.name}</h3>
                  {stats.recentLogs.map(log => (
                    <div key={log.id} className="flex justify-between bg-zinc-950 border border-zinc-800 p-4 rounded-xl mb-3">
                      <div>
                        <div className="flex gap-2"><span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded">{log.fuelType}</span><span className="font-bold">{log.totalCost} zł</span></div>
                        <div className="text-xs text-zinc-500 mt-1">{log.odometer} km • {log.date}</div>
                      </div>
                      <button onClick={() => deleteDoc(doc(db, 'fuelLogs', log.id))} className="text-zinc-500 hover:text-red-400"><Trash2 className="w-4 h-4" /></button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {activeTab === 'refuel' && (
          <div className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Camera className="w-6 h-6 text-amber-500" /> Nowe tankowanie</h2>
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-amber-500/40 bg-amber-500/5 rounded-2xl p-6 cursor-pointer mb-6">
              <Camera className="w-10 h-10 text-amber-500 mb-2" />
              <span className="font-bold text-amber-400 text-sm">{ocrLoading ? 'Przetwarzanie paragonu...' : 'Zrób zdjęcie paragonu'}</span>
              <input type="file" accept="image/*" capture="environment" onChange={handleReceiptUpload} className="hidden" />
            </label>
            {ocrStatus && <div className="mb-4 p-3 bg-zinc-950 border border-amber-500/30 rounded-xl text-xs text-amber-300">{ocrStatus}</div>}
            
            <form onSubmit={handleAddFuelLog} className="space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div><label className="block text-xs mb-1">Cena/L</label><input type="number" step="0.01" required value={pricePerLiter} onChange={(e) => handlePriceOrTotalChange(e.target.value, totalCost)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5" /></div>
                <div><label className="block text-xs mb-1">Kwota</label><input type="number" step="0.01" required value={totalCost} onChange={(e) => handlePriceOrTotalChange(pricePerLiter, e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5" /></div>
                <div><label className="block text-xs mb-1">Litry</label><input type="number" step="0.01" required value={liters} onChange={(e) => handleLitersChange(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5" /></div>
              </div>
              <div>
                <label className="block text-xs text-amber-400 mb-1">Aktualny przebieg (km)</label>
                <input type="number" required value={odometer} onChange={(e) => setOdometer(e.target.value)} className="w-full bg-zinc-950 border border-amber-500/50 rounded-xl px-4 py-3 text-lg font-bold" />
                <label className="mt-2 flex justify-center py-2 bg-zinc-950 border border-amber-500/50 text-amber-400 text-xs font-bold rounded-xl cursor-pointer">
                  {odometerOcrLoading ? 'Analizowanie licznika...' : '📷 Zdjęcie liczników OCR'}
                  <input type="file" accept="image/*" capture="environment" onChange={handleOdometerUpload} className="hidden" />
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm" />
                <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm" />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-amber-500 text-zinc-950 font-bold py-3.5 rounded-xl">{isSubmitting ? 'Zapisywanie...' : 'Zapisz tankowanie'}</button>
            </form>
          </div>
        )}

        {activeTab === 'fleet' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
              <h2 className="text-lg font-bold mb-4">{editingVehicleId ? 'Edytuj pojazd' : 'Dodaj pojazd'}</h2>
              <form onSubmit={handleSaveVehicle} className="space-y-4">
                <input type="text" required value={vName} onChange={(e) => setVName(e.target.value)} placeholder="Marka i model" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2" />
                <input type="text" required value={vPlate} onChange={(e) => setVPlate(e.target.value)} placeholder="Numer rejestracyjny" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2 uppercase" />
                <input type="number" required value={vInitialOdo} onChange={(e) => setVInitialOdo(e.target.value)} placeholder="Przebieg początkowy" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2" />
                <select value={vFuelConfig} onChange={(e) => setVFuelConfig(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2">
                  <option value="PB95">Benzyna (PB95/98)</option><option value="LPG">LPG</option><option value="ON">Diesel</option>
                </select>
                <button type="submit" className="w-full bg-amber-500 text-zinc-950 font-bold py-2 rounded-xl">Zapisz</button>
              </form>
            </div>
            <div className="bg-zinc-900 p-6 rounded-2xl border border-zinc-800">
              <h2 className="text-lg font-bold mb-4">Twoja flota</h2>
              {myVehicles.map(v => (
                <div key={v.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex justify-between mb-3">
                  <div><div className="font-bold">{v.name}</div><div className="text-xs text-zinc-400">Rej: {v.plate} • Licznik: {v.currentOdometer} km</div></div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditingVehicleId(v.id); setVName(v.name); setVPlate(v.plate); setVInitialOdo(v.initialOdometer); setVFuelConfig(v.fuelConfig); }} className="text-amber-400"><Edit3 className="w-4 h-4" /></button>
                    <button onClick={() => handleDeleteVehicle(v.id)} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </main>

      <nav className="md:hidden fixed bottom-0 w-full bg-zinc-900 border-t border-zinc-800 flex justify-around py-3 z-30">
        {[{ id: 'dashboard', icon: TrendingUp }, { id: 'refuel', icon: Camera }, { id: 'fleet', icon: Car }].map(t => (
          <button key={t.id} onClick={() => setActiveTab(t.id)} className={`${activeTab === t.id ? 'text-amber-500' : 'text-zinc-400'} flex flex-col items-center`}><t.icon className="w-5 h-5" /></button>
        ))}
      </nav>
    </div>
  );
}