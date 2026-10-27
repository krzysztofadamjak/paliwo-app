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
  const [activeTab, setActiveTab] = useState('dashboard'); // dashboard, refuel, fleet, admin
  const [timeFilter, setTimeFilter] = useState('month'); // week, month, year, all
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

  // 2. Pobieranie pojazdów, tankowań i użytkowników z Firestore
  useEffect(() => {
    if (!user) return;

    const unsubVehicles = onSnapshot(collection(db, 'vehicles'), (snapshot) => {
      const allV = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      const userV = allV.filter(v => v.userId === user.uid || isAdmin);
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

  // Wybrany pojazd użytkownika
  const myVehicles = useMemo(() => vehicles.filter(v => v.userId === user?.uid), [vehicles, user]);
  const activeVehicle = useMemo(() => myVehicles.find(v => v.id === selectedVehicleId) || myVehicles[0], [myVehicles, selectedVehicleId]);

  useEffect(() => {
    if (activeVehicle) {
      setSelectedVehicleId(activeVehicle.id);
      setFuelType(activeVehicle.fuelConfig === 'LPG' ? 'LPG' : activeVehicle.fuelConfig);
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

  // --- OBSŁUGA SKANERA PARAGONÓW OCR (Wersja hybrydowa: Vercel + Localhost) ---
  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrStatus('Analizowanie paragonu przez AI...');

    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64String = reader.result.split(',')[1];
        let data = null;

        // 1. Próba wywołania bezpiecznego backendu (/api/ocr na Vercel)
        const response = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64String, mimeType: file.type })
        });

        if (response.ok) {
          data = await response.json();
        } else {
          // 2. Fallback dla localhost:5173 (używa pliku .env.local na Twoim komputerze)
          const localApiKey = import.meta.env.VITE_GEMINI_API_KEY;
          if (!localApiKey) {
            throw new Error('Brak klucza VITE_GEMINI_API_KEY w pliku .env.local');
          }

          const geminiRes = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${localApiKey}`,
            {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{
                  parts: [
                    { text: 'Przeanalizuj ten paragon ze stacji paliw. Zwróć TYLKO czysty obiekt JSON bez znaczników markdown: {"pricePerLiter": liczba, "totalCost": liczba, "liters": liczba, "date": "RRRR-MM-DD", "time": "GG:MM", "fuelType": "LPG" lub "PB95" lub "ON"}' },
                    { inline_data: { mime_type: file.type || 'image/jpeg', data: base64String } }
                  ]
                }]
              })
            }
          );

          const geminiData = await geminiRes.json();
          const text = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
          data = JSON.parse(text.replace(/```json|```/g, '').trim());
        }

        if (data) {
          if (data.pricePerLiter) setPricePerLiter(String(data.pricePerLiter));
          if (data.totalCost) setTotalCost(String(data.totalCost));
          if (data.liters) setLiters(String(data.liters));
          if (data.date) setDate(data.date);
          if (data.time) setTime(data.time);
          if (data.fuelType) {
            if (activeVehicle?.fuelConfig === 'LPG' && (data.fuelType === 'LPG' || data.fuelType === 'PB95')) {
              setFuelType(data.fuelType);
            } else if (activeVehicle) {
              setFuelType(activeVehicle.fuelConfig);
            }
          }
          setOcrStatus('Rozpoznano dane z paragonu! Wprowadź aktualny przebieg pojazdu.');
        }
      } catch (error) {
        console.error(error);
        setOcrStatus('Nie udało się odczytać paragonu. Sprawdź klucz API lub wprowadź dane ręcznie.');
      } finally {
        setOcrLoading(false);
      }
    };
    reader.readAsDataURL(file);
  };

  // --- ZAPIS TANKOWANIA ---
  const handleAddFuelLog = async (e) => {
    e.preventDefault();
    if (!activeVehicle) return;

    const currentOdo = parseFloat(odometer);
    const minOdo = activeVehicle.currentOdometer || activeVehicle.initialOdometer || 0;

    if (currentOdo <= 0) {
      alert('Wprowadź prawidłowy przebieg pojazdu!');
      return;
    }

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

    if (currentOdo > minOdo) {
      await updateDoc(doc(db, 'vehicles', activeVehicle.id), {
        currentOdometer: currentOdo
      });
    }

    setPricePerLiter('');
    setTotalCost('');
    setLiters('');
    setOdometer('');
    setOcrStatus('');
    setActiveTab('dashboard');
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

  // --- STATYSTYKI I ANALIZA KOSZTÓW ---
  const stats = useMemo(() => {
    if (!activeVehicle) return { cost: 0, liters: 0, distance: 0, avgConsumption: 0, currentMonthCost: 0 };

    const vehicleLogs = logs
      .filter(l => l.vehicleId === activeVehicle.id)
      .sort((a, b) => a.odometer - b.odometer);

    const now = new Date();
    const filteredLogs = vehicleLogs.filter(l => {
      const logDate = new Date(l.date);
      if (timeFilter === 'week') {
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        return logDate >= weekAgo;
      }
      if (timeFilter === 'month') {
        const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        return logDate >= monthAgo;
      }
      if (timeFilter === 'year') {
        const yearAgo = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
        return logDate >= yearAgo;
      }
      return true; // 'all' (od rejestracji)
    });

    const totalCostSum = filteredLogs.reduce((acc, l) => acc + (l.totalCost || 0), 0);
    const totalLitersSum = filteredLogs.reduce((acc, l) => acc + (l.liters || 0), 0);

    let distance = 0;
    if (filteredLogs.length > 0) {
      const maxOdo = Math.max(...filteredLogs.map(l => l.odometer));
      const minOdo = timeFilter === 'all' 
        ? activeVehicle.initialOdometer 
        : Math.min(...filteredLogs.map(l => l.odometer));
      distance = Math.max(0, maxOdo - minOdo);
    }

    const avgConsumption = distance > 0 ? ((totalLitersSum / distance) * 100).toFixed(2) : '0.00';

    // Koszt w bieżącym miesiącu kalendarzowym (do limitu)
    const currentMonthLogs = logs.filter(l => {
      if (l.userId !== user?.uid) return false;
      const d = new Date(l.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const currentMonthCost = currentMonthLogs.reduce((acc, l) => acc + (l.totalCost || 0), 0);

    return {
      cost: totalCostSum.toFixed(2),
      liters: totalLitersSum.toFixed(2),
      distance,
      avgConsumption,
      currentMonthCost: currentMonthCost.toFixed(2),
      recentLogs: [...filteredLogs].reverse()
    };
  }, [activeVehicle, logs, timeFilter, user]);

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
                placeholder="np. 98krzychu@gmail.com"
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
      <header className="bg-zinc-900/80 backdrop-blur border-b border-zinc-800 sticky top-0 z-30">
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
        {/* Alert przekroczenia budżetu miesięcznego */}
        {isOverBudget && (
          <div className="mb-6 p-4 bg-red-500/15 border border-red-500/40 rounded-2xl flex items-center gap-4 text-red-300">
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
        <div className="hidden md:flex gap-2 mb-6 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 w-fit">
          <button
            onClick={() => setActiveTab('dashboard')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${activeTab === 'dashboard' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Pulpit i Analiza
          </button>
          <button
            onClick={() => setActiveTab('refuel')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${activeTab === 'refuel' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Dodaj Tankowanie / OCR
          </button>
          <button
            onClick={() => setActiveTab('fleet')}
            className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition ${activeTab === 'fleet' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400 hover:text-zinc-200'}`}
          >
            Moje Pojazdy ({myVehicles.length})
          </button>
          {isAdmin && (
            <button
              onClick={() => setActiveTab('admin')}
              className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition flex items-center gap-2 ${activeTab === 'admin' ? 'bg-amber-500 text-zinc-950' : 'text-amber-400 hover:text-amber-300'}`}
            >
              <ShieldAlert className="w-4 h-4" /> Panel Admina
            </button>
          )}
        </div>

        {/* ZAKŁADKA 1: PULPIT I ANALIZA */}
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
                {/* Filtry czasu i Limit miesięczny */}
                <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center bg-zinc-900 border border-zinc-800 p-4 rounded-2xl">
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

                  <div className="flex items-center gap-3 w-full md:w-auto justify-between md:justify-end border-t md:border-t-0 pt-3 md:pt-0 border-zinc-800">
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

                {/* Karty statystyk */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                    <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                      <span>KOSZT PALIWA</span>
                      <DollarSign className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-zinc-100">{stats.cost} zł</div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                    <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                      <span>ZATANKOWANO</span>
                      <Droplets className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-zinc-100">{stats.liters} L</div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                    <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                      <span>DYSTANS</span>
                      <Gauge className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-zinc-100">{stats.distance} km</div>
                  </div>

                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                    <div className="flex items-center justify-between text-zinc-400 text-xs mb-2">
                      <span>ŚREDNIE SPALANIE</span>
                      <TrendingUp className="w-4 h-4 text-amber-500" />
                    </div>
                    <div className="text-2xl font-black text-amber-500">{stats.avgConsumption} <span className="text-sm font-normal text-zinc-400">l/100km</span></div>
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
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 text-xs font-bold rounded bg-amber-500/20 text-amber-400">
                                {log.fuelType}
                              </span>
                              <span className="font-bold text-zinc-200">{log.totalCost} zł</span>
                              <span className="text-xs text-zinc-400">({log.liters} L × {log.pricePerLiter} zł)</span>
                            </div>
                            <div className="text-xs text-zinc-500 mt-1">
                              Przebieg: {log.odometer} km • {log.date} {log.time} • {log.isFullTank ? 'Do pełna' : 'Częściowe'}
                            </div>
                          </div>
                          <button
                            onClick={() => deleteDoc(doc(db, 'fuelLogs', log.id))}
                            className="p-2 text-zinc-500 hover:text-red-400"
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
          <div className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <Camera className="w-6 h-6 text-amber-500" /> Nowe tankowanie (AI OCR)
            </h2>

            {/* Przycisk Skanowania Paragonu */}
            <label className="flex flex-col items-center justify-center border-2 border-dashed border-amber-500/40 hover:border-amber-500 bg-amber-500/5 rounded-2xl p-6 cursor-pointer transition mb-6">
              <Camera className="w-10 h-10 text-amber-500 mb-2" />
              <span className="font-bold text-amber-400 text-sm">
                {ocrLoading ? 'Przetwarzanie paragonu...' : 'Zrób zdjęcie paragonu lub wybierz z galerii'}
              </span>
              <span className="text-xs text-zinc-400 mt-1">Automatycznie rozpozna kwotę, litry, datę oraz rodzaj paliwa</span>
              <input type="file" accept="image/*" capture="environment" onChange={handleReceiptUpload} className="hidden" />
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
                className="w-full bg-amber-500 hover:bg-amber-400 text-zinc-950 font-bold py-3.5 rounded-xl transition"
              >
                Zapisz tankowanie
              </button>
            </form>
          </div>
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

        {/* ZAKŁADKA 4: PANEL ADMINISTRATORA (Tylko dla 98krzychu@gmail.com) */}
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
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around py-3 z-30">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center text-xs ${activeTab === 'dashboard' ? 'text-amber-500' : 'text-zinc-400'}`}>
          <TrendingUp className="w-5 h-5 mb-1" /> Pulpit
        </button>
        <button onClick={() => setActiveTab('refuel')} className={`flex flex-col items-center text-xs ${activeTab === 'refuel' ? 'text-amber-500' : 'text-zinc-400'}`}>
          <Camera className="w-5 h-5 mb-1" /> Tankuj / OCR
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