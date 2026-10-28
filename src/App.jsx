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
  Wrench, Receipt, FileText, Download, Printer, Sparkles, Briefcase, ShieldCheck,
  Mic, QrCode, TrendingDown, Wifi, WifiOff
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
  const [timeFilter, setTimeFilter] = useState('month'); 
  const [tripFilter, setTripFilter] = useState('all'); 
  const [vatDeductionMode, setVatDeductionMode] = useState(50); 
  const [vehicles, setVehicles] = useState([]);
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [logs, setLogs] = useState([]);
  const [serviceLogs, setServiceLogs] = useState([]); 
  const [expenseLogs, setExpenseLogs] = useState([]); 
  const [allUsers, setAllUsers] = useState([]);

  // --- STANY OFFLINE SYNC (Moduł 7) ---
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [offlineQueueCount, setOfflineQueueCount] = useState(0);

  // --- STANY FORMULARZA TANKOWANIA / OCR / GŁOS (Moduły 1-4) ---
  const [fuelType, setFuelType] = useState('PB95');
  const [pricePerLiter, setPricePerLiter] = useState('');
  const [totalCost, setTotalCost] = useState('');
  const [liters, setLiters] = useState('');
  const [odometer, setOdometer] = useState('');
  const [isFullTank, setIsFullTank] = useState(true);
  const [tripType, setTripType] = useState('private'); 
  const [tripNotes, setTripNotes] = useState(''); 
  const [date, setDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [time, setTime] = useState(() => new Date().toTimeString().slice(0, 5));
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrStatus, setOcrStatus] = useState('');
  const [odometerOcrLoading, setOdometerOcrLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isListeningVoice, setIsListeningVoice] = useState(false);

  // --- STANY MODUŁU 1: SERWIS, TERMINY ORAZ OBD-II ---
  const [insuranceExpiryInput, setInsuranceExpiryInput] = useState('');
  const [inspectionExpiryInput, setInspectionExpiryInput] = useState('');
  const [serviceType, setServiceType] = useState('Wymiana oleju i filtrów');
  const [serviceCost, setServiceCost] = useState('');
  const [serviceOdo, setServiceOdo] = useState('');
  const [nextServiceOdo, setNextServiceOdo] = useState('');
  const [nextServiceDate, setNextServiceDate] = useState('');
  const [serviceDate, setServiceDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [serviceNotes, setServiceNotes] = useState('');
  
  const [obdCodeInput, setObdCodeInput] = useState('');
  const [obdResult, setObdResult] = useState(null);
  const [symptomInput, setSymptomInput] = useState('');
  const [symptomsList, setSymptomsList] = useState([]);

  // --- STANY MODUŁU 2 i 3: KOSZTY TCO, PASZPORT I UTRATA WARTOŚCI ---
  const [expCategory, setExpCategory] = useState('Serwis / Części');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [expTitle, setExpTitle] = useState('');
  const [expTripType, setExpTripType] = useState('private');
  const [expOcrLoading, setExpOcrLoading] = useState(false);
  const [expOcrStatus, setExpOcrStatus] = useState('');
  const [showPassportModal, setShowPassportModal] = useState(false);

  // --- STAN RZĄDOWYCH LIMITÓW CEN ---
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
  const [vPurchasePrice, setVPurchasePrice] = useState('');
  const [vPurchaseDate, setVPurchaseDate] = useState(() => new Date().toISOString().split('T')[0]);

  // --- STANY BUDŻETU MIESIĘCZNEGO ---
  const [budgetInput, setBudgetInput] = useState('');
  const [isEditingBudget, setIsEditingBudget] = useState(false);

  const isAdmin = user?.email?.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      syncOfflineQueue();
    };
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const queue = JSON.parse(localStorage.getItem('octan_offline_queue') || '[]');
    setOfflineQueueCount(queue.length);
    if (navigator.onLine && queue.length > 0) {
      syncOfflineQueue();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const syncOfflineQueue = async () => {
    try {
      const queue = JSON.parse(localStorage.getItem('octan_offline_queue') || '[]');
      if (queue.length === 0) return;
      for (const item of queue) {
        if (item.type === 'fuelLog') {
          await addDoc(collection(db, 'fuelLogs'), item.data);
        } else if (item.type === 'expenseLog') {
          await addDoc(collection(db, 'expenseLogs'), item.data);
        }
      }
      localStorage.removeItem('octan_offline_queue');
      setOfflineQueueCount(0);
      alert('Zsynchronizowano zaległe wpisy offline z chmurą Firebase!');
    } catch (e) {
      console.error('Błąd synchronizacji offline:', e);
    }
  };

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

  const myVehicles = useMemo(() => vehicles.filter(v => v.userId === user?.uid), [vehicles, user]);
  const activeVehicle = useMemo(() => vehicles.find(v => v.id === selectedVehicleId) || myVehicles[0], [vehicles, selectedVehicleId, myVehicles]);

  useEffect(() => {
    if (activeVehicle) {
      setSelectedVehicleId(activeVehicle.id);
      setFuelType(activeVehicle.fuelConfig === 'LPG' ? 'LPG' : activeVehicle.fuelConfig);
      setInsuranceExpiryInput(activeVehicle.insuranceExpiry || '');
      setInspectionExpiryInput(activeVehicle.inspectionExpiry || '');
      setServiceOdo(activeVehicle.currentOdometer || activeVehicle.initialOdometer || '');
      setVPurchasePrice(activeVehicle.purchasePrice || '');
      setVPurchaseDate(activeVehicle.purchaseDate || new Date().toISOString().split('T')[0]);
    } else {
      setSelectedVehicleId('');
    }
  }, [activeVehicle?.id]);

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

  const callGeminiFallback = async (base64String, mimeType, type = 'receipt') => {
    let prompt = '';
    if (type === 'odometer') {
      prompt = 'Odczytaj całkowity przebieg samochodu (km) z licznika na zdjęciu. Zwróć WYŁĄCZNIE czysty obiekt JSON w formacie: {"mileage": 123456}';
    } else if (type === 'expense') {
      prompt = 'Przeanalizuj paragon lub fakturę kosztową. Zwróć WYŁĄCZNIE czysty obiekt JSON w formacie: {"totalCost": 150.00, "date": "YYYY-MM-DD", "title": "Opis zakupu"}';
    } else {
      prompt = 'Przeanalizuj paragon paliwowy. Zwróć WYŁĄCZNIE czysty obiekt JSON w formacie: {"pricePerLiter": 6.55, "totalCost": 200.00, "liters": 30.53, "date": "YYYY-MM-DD", "time": "HH:MM", "fuelType": "PB95"}';
    }

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
      console.warn('Nie pobrano modeli Gemini:', e);
    }

    if (candidateModels.length === 0) {
      candidateModels = ['gemini-3.8-flash', 'gemini-1.5-flash'];
    }

    let lastError = null;
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
        if (!response.ok) throw new Error(`Kod HTTP ${response.status}`);

        const result = await response.json();
        const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
        return JSON.parse(rawText.replace(/```json|```/g, '').trim());
      } catch (err) {
        clearTimeout(timeoutId);
        lastError = err;
      }
    }
    throw lastError || new Error('Wszystkie modele AI są zajęte.');
  };

  const handleReceiptUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOcrLoading(true);
    setOcrStatus('Analizowanie paragonu przez AI...');

    try {
      const { base64String, mimeType } = await convertImageToJpeg(file);
      let data = null;

      try {
        const response = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64String, mimeType })
        });
        if (!response.ok) throw new Error('Błąd Groq');
        data = await response.json();
      } catch (err) {
        data = await callGeminiFallback(base64String, mimeType, 'receipt');
      }

      let pLitr = data.pricePerLiter ?? data.cenaZaLitr ?? data.price ?? 0;
      let cCalk = data.totalCost ?? data.cenaCalkowita ?? data.total ?? 0;
      let litry = data.liters ?? data.iloscLitrow ?? 0;

      if (pLitr) setPricePerLiter(String(Number(pLitr).toFixed(2)));
      if (cCalk) setTotalCost(String(Number(cCalk).toFixed(2)));
      if (litry) setLiters(String(Number(litry).toFixed(2)));
      if (data.date) setDate(data.date);
      if (data.time) setTime(data.time);

      setOcrStatus('Rozpoznano dane z paragonu!');
    } catch (error) {
      setOcrStatus('Nie udało się odczytać paragonu. Wprowadź dane ręcznie.');
    } finally {
      setOcrLoading(false);
    }
  };

  const handleOdometerUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setOdometerOcrLoading(true);
    setOcrStatus('Odczytywanie przebiegu z licznika...');

    try {
      const { base64String, mimeType } = await convertImageToJpeg(file);
      let data = null;

      try {
        const response = await fetch('/api/ocr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ imageBase64: base64String, mimeType, type: 'odometer' })
        });
        const resData = await response.json();
        if (!response.ok) throw new Error();
        data = resData;
      } catch (err) {
        data = await callGeminiFallback(base64String, mimeType, 'odometer');
      }

      if (data && data.mileage && data.mileage > 0) {
        setOdometer(String(data.mileage));
        setOcrStatus('Odczytano przebieg ze zdjęcia!');
      } else {
        setOcrStatus('Wpisz przebieg ręcznie.');
      }
    } catch (error) {
      setOcrStatus('Błąd skanowania licznika.');
    } finally {
      setOdometerOcrLoading(false);
    }
  };

  const startVoiceInput = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Twoja przeglądarka nie wspiera rozpoznawania mowy.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'pl-PL';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    setIsListeningVoice(true);
    setOcrStatus('Słucham... Podaj kwotę, litry i przebieg');

    recognition.onresult = (event) => {
      const speechText = event.results[0][0].transcript.toLowerCase();
      parseVoiceCommand(speechText);
      setIsListeningVoice(false);
    };

    recognition.onerror = () => setIsListeningVoice(false);
    recognition.onend = () => setIsListeningVoice(false);
    recognition.start();
  };

  const parseVoiceCommand = (text) => {
    const numbers = text.match(/\d+([.,]\d+)?/g);
    if (numbers && numbers.length > 0) {
      if (numbers.length >= 1) setTotalCost(numbers[0].replace(',', '.'));
      if (numbers.length >= 2) setLiters(numbers[1].replace(',', '.'));
      if (numbers.length >= 3) {
        const odo = numbers.find(n => n.length > 4);
        if (odo) setOdometer(odo);
      }
      if (totalCost && liters) {
        setPricePerLiter((parseFloat(totalCost) / parseFloat(liters)).toFixed(2));
      }
      setOcrStatus(`Wprowadzono z głosu: "${text}"`);
    } else {
      setOcrStatus(`Nie wyłapano liczb z: "${text}"`);
    }
  };

  const handleSearchObd = (e) => {
    e.preventDefault();
    const code = obdCodeInput.toUpperCase().trim();
    const dbObd = {
      'P0171': { title: 'System zbyt ubogi (Bank 1)', cause: 'Nieszczelność dolotu, uszkodzona sonda lambda, zabrudzony przepływomierz (MAF).' },
      'P0420': { title: 'Sprawność katalizatora poniżej progu (Bank 1)', cause: 'Zużyty katalizator, nieszczelność wydechu.' },
      'P0300': { title: 'Wykryte losowe wypadanie zapłonów', cause: 'Zużyte świece, cewki zapłonowe, wtryskiwacze.' },
      'P0400': { title: 'Przepływ EGR', cause: 'Zablokowany zawór EGR.' },
      'P0130': { title: 'Obwód sondy lambda (Bank 1)', cause: 'Usterka grzałki sondy, przerwa w okablowaniu.' }
    };

    if (dbObd[code]) {
      setObdResult(dbObd[code]);
    } else {
      setObdResult({ title: `Kod ${code} (Ogólny)`, cause: 'Brak szczegółowego opisu w bazie.' });
    }
  };

  const handleAddSymptom = (e) => {
    e.preventDefault();
    if (!symptomInput.trim()) return;
    setSymptomsList([...symptomsList, { id: Date.now(), text: symptomInput, date: new Date().toLocaleDateString('pl-PL') }]);
    setSymptomInput('');
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
    const logData = {
      userId: user.uid,
      vehicleId: activeVehicle.id,
      fuelType,
      pricePerLiter: parseFloat(pricePerLiter),
      totalCost: parseFloat(totalCost),
      liters: parseFloat(liters),
      odometer: currentOdo,
      isFullTank,
      tripType,
      tripNotes,
      date,
      time,
      createdAt: new Date().toISOString()
    };

    try {
      if (isOnline) {
        await addDoc(collection(db, 'fuelLogs'), logData);
        await updateDoc(doc(db, 'vehicles', activeVehicle.id), { currentOdometer: currentOdo });
      } else {
        const queue = JSON.parse(localStorage.getItem('octan_offline_queue') || '[]');
        queue.push({ type: 'fuelLog', data: logData });
        localStorage.setItem('octan_offline_queue', JSON.stringify(queue));
        setOfflineQueueCount(queue.length);
        alert('Brak internetu! Zapisano wpis w pamięci offline.');
      }

      setActiveTab('dashboard');
      window.location.reload();
    } catch (error) {
      alert('Nie udało się zapisać tankowania.');
      setIsSubmitting(false);
    }
  };

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

    await addDoc(collection(db, 'serviceLogs'), {
      userId: user.uid,
      vehicleId: activeVehicle.id,
      serviceType,
      cost: parseFloat(serviceCost) || 0,
      odometer: parseFloat(serviceOdo) || activeVehicle.currentOdometer || 0,
      nextTargetOdo: parseFloat(nextServiceOdo) || 0,
      nextTargetDate: nextServiceDate,
      date: serviceDate,
      notes: serviceNotes,
      createdAt: new Date().toISOString()
    });

    setServiceCost('');
    setNextServiceOdo('');
    setNextServiceDate('');
    setServiceNotes('');
  };

  const handleAddExpenseLog = async (e) => {
    e.preventDefault();
    if (!activeVehicle) return;

    const expenseData = {
      userId: user.uid,
      vehicleId: activeVehicle.id,
      category: expCategory,
      amount: parseFloat(expAmount) || 0,
      title: expTitle || expCategory,
      tripType: expTripType,
      date: expDate,
      createdAt: new Date().toISOString()
    };

    if (isOnline) {
      await addDoc(collection(db, 'expenseLogs'), expenseData);
    } else {
      const queue = JSON.parse(localStorage.getItem('octan_offline_queue') || '[]');
      queue.push({ type: 'expenseLog', data: expenseData });
      localStorage.setItem('octan_offline_queue', JSON.stringify(queue));
      setOfflineQueueCount(queue.length);
      alert('Brak internetu! Wydatek zapisany w pamięci offline.');
    }

    setExpAmount('');
    setExpTitle('');
  };

  const handleSaveVehicle = async (e) => {
    e.preventDefault();
    const initOdo = parseFloat(vInitialOdo) || 0;
    const purchasePriceNum = parseFloat(vPurchasePrice) || 0;

    if (editingVehicleId) {
      await updateDoc(doc(db, 'vehicles', editingVehicleId), {
        name: vName,
        plate: vPlate.toUpperCase(),
        initialOdometer: initOdo,
        fuelConfig: vFuelConfig,
        purchasePrice: purchasePriceNum,
        purchaseDate: vPurchaseDate
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
        purchasePrice: purchasePriceNum,
        purchaseDate: vPurchaseDate,
        createdAt: new Date().toISOString()
      });
      setSelectedVehicleId(docRef.id);
    }

    setVName('');
    setVPlate('');
    setVInitialOdo('');
    setVPurchasePrice('');
    setVFuelConfig('PB95');
  };

  const handleDeleteVehicle = async (id) => {
    if (!window.confirm('Czy na pewno chcesz usunąć ten pojazd?')) return;
    await deleteDoc(doc(db, 'vehicles', id));
    if (selectedVehicleId === id) setSelectedVehicleId('');
  };

  const stats = useMemo(() => {
    if (!activeVehicle) {
      return {
        cost: '0.00', liters: '0.00', distance: 0, avgConsumption: '0.00',
        currentMonthCost: '0.00', recentLogs: [], vehicleServices: [], vehicleExpenses: [],
        otherCostsTotal: '0.00', totalTco: '0.00', costPerKm: '0.00', costPer100KmFuel: '0.00',
        vatDeductibleTotal: '0.00', netBusinessCost: '0.00', estimatedCarValue: '0.00',
        depreciationTotal: '0.00', ecoAdvice: null, alerts: []
      };
    }

    const now = new Date();
    const filterByDate = (dateStr) => {
      const logDate = new Date(dateStr);
      if (timeFilter === 'week') return logDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      if (timeFilter === 'month') return logDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      if (timeFilter === 'year') return logDate >= new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
      return true;
    };

    const filterByTrip = (itemTripType) => {
      const t = itemTripType || 'private';
      if (tripFilter === 'all') return true;
      return t === tripFilter;
    };

    const allVehicleFuelLogs = logs
      .filter(l => l.vehicleId === activeVehicle.id)
      .sort((a, b) => a.odometer - b.odometer);

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

    let distance = 0;
    if (filteredLogs.length > 0) {
      if (tripFilter === 'all') {
        const maxOdo = Math.max(...filteredLogs.map(l => l.odometer));
        const minOdo = timeFilter === 'all' 
          ? activeVehicle.initialOdometer 
          : Math.min(...filteredLogs.map(l => l.odometer));
        distance = Math.max(0, maxOdo - minOdo);
      } else {
        distance = filteredLogs.reduce((acc, l) => acc + (l.segmentDistance || 0), 0);
      }
    }

    const avgConsumptionNum = distance > 0 ? (totalLitersSum / distance) * 100 : 0;
    const avgConsumption = avgConsumptionNum.toFixed(2);
    const costPerKm = distance > 0 ? (totalTcoSum / distance).toFixed(2) : '0.00';
    const costPer100KmFuel = distance > 0 ? ((totalCostSum / distance) * 100).toFixed(2) : '0.00';

    const purchasePrice = activeVehicle.purchasePrice || 0;
    const purchaseDate = activeVehicle.purchaseDate ? new Date(activeVehicle.purchaseDate) : new Date();
    const yearsOwned = Math.max(0, (now - purchaseDate) / (1000 * 60 * 60 * 24 * 365.25));
    const estimatedCarValue = purchasePrice > 0 ? Math.max(purchasePrice * 0.2, purchasePrice * Math.pow(0.88, yearsOwned)).toFixed(2) : '0.00';
    const depreciationTotal = purchasePrice > 0 ? (purchasePrice - parseFloat(estimatedCarValue)).toFixed(2) : '0.00';

    const businessFuelGross = filteredLogs.filter(l => l.tripType === 'business').reduce((a, b) => a + (b.totalCost || 0), 0);
    const businessExpGross = filteredExpenses.filter(e => e.tripType === 'business').reduce((a, b) => a + (b.amount || 0), 0);
    const totalBusinessGross = businessFuelGross + businessExpGross;
    const totalBusinessNet = totalBusinessGross / 1.23;
    const totalBusinessVat = totalBusinessGross - totalBusinessNet;
    const vatDeductibleTotal = (totalBusinessVat * (vatDeductionMode / 100)).toFixed(2);

    const currentMonthLogs = logs.filter(l => {
      if (l.userId !== user?.uid) return false;
      const d = new Date(l.date);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const currentMonthCost = currentMonthLogs.reduce((acc, l) => acc + (l.totalCost || 0), 0);

    const alerts = [];
    const currentOdo = activeVehicle.currentOdometer || activeVehicle.initialOdometer || 0;

    if (activeVehicle.insuranceExpiry) {
      const daysLeft = Math.ceil((new Date(activeVehicle.insuranceExpiry) - now) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30) {
        alerts.push({
          type: daysLeft < 0 ? 'danger' : 'warning',
          title: daysLeft < 0 ? 'Wygasła polisa ubezpieczenia OC/AC!' : `Koniec polisy OC/AC za ${daysLeft} dni`
        });
      }
    }
    if (activeVehicle.inspectionExpiry) {
      const daysLeft = Math.ceil((new Date(activeVehicle.inspectionExpiry) - now) / (1000 * 60 * 60 * 24));
      if (daysLeft <= 30) {
        alerts.push({
          type: daysLeft < 0 ? 'danger' : 'warning',
          title: daysLeft < 0 ? 'Wygasło badanie techniczne!' : `Przegląd techniczny za ${daysLeft} dni`
        });
      }
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
      estimatedCarValue,
      depreciationTotal,
      alerts
    };
  }, [activeVehicle, logs, serviceLogs, expenseLogs, timeFilter, tripFilter, vatDeductionMode, user]);

  const monthlyLimit = userProfile?.monthlyLimit || 1000;
  const isOverBudget = parseFloat(stats.currentMonthCost) > monthlyLimit;

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
        <button onClick={() => signOut(auth)} className="mt-6 px-6 py-2 bg-zinc-800 rounded-lg">Wyloguj się</button>
      </div>
    );
  }

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
          <h2 className="text-lg font-semibold text-center text-zinc-300 mb-6">{isRegistering ? 'Utwórz konto' : 'Zaloguj się'}</h2>
          {authError && <div className="mb-4 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">{authError}</div>}
          <form onSubmit={handleAuth} className="space-y-4">
            <div>
              <label className="block text-xs uppercase text-zinc-400 mb-1">E-mail</label>
              <input type="email" required value={emailInput} onChange={(e) => setEmailInput(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3" />
            </div>
            <div>
              <label className="block text-xs uppercase text-zinc-400 mb-1">Hasło</label>
              <input type="password" required value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-3" />
            </div>
            <button type="submit" className="w-full bg-amber-500 text-zinc-950 font-bold py-3 rounded-xl">{isRegistering ? 'Zarejestruj' : 'Zaloguj'}</button>
          </form>
          <button onClick={() => setIsRegistering(!isRegistering)} className="w-full mt-4 text-sm text-zinc-400 hover:text-amber-400">
            {isRegistering ? 'Masz konto? Zaloguj' : 'Nie masz? Zarejestruj'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 pb-24 md:pb-8">
      {/* Pasek górny */}
      <header className="bg-zinc-900/80 backdrop-blur border-b border-zinc-800 sticky top-0 z-30 print:hidden">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Fuel className="w-7 h-7 text-amber-500" />
            <span className="text-xl font-black tracking-wider text-amber-500">OCTAN</span>
            {isAdmin && <span className="text-xs bg-amber-500/20 text-amber-400 px-2.5 py-0.5 rounded-full font-semibold">ADMIN</span>}
            <span className={`text-xs px-2.5 py-0.5 rounded-full font-bold flex items-center gap-1 ${isOnline ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'}`}>
              {isOnline ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
              {isOnline ? 'Online' : `Offline (${offlineQueueCount})`}
            </span>
          </div>

          <div className="flex items-center gap-3">
            {myVehicles.length > 0 && (
              <select value={selectedVehicleId} onChange={(e) => setSelectedVehicleId(e.target.value)} className="bg-zinc-950 border border-zinc-800 text-sm rounded-xl px-3 py-2 text-zinc-200">
                {myVehicles.map(v => <option key={v.id} value={v.id}>{v.name} ({v.fuelConfig})</option>)}
              </select>
            )}
            <button onClick={() => signOut(auth)} className="p-2 bg-zinc-800 hover:bg-zinc-700 rounded-xl text-zinc-300"><LogOut className="w-5 h-5" /></button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 pt-6">
        {/* Zmniejszony kafelek: Limity cen paliw */}
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-xl p-3.5 mb-5 text-zinc-100 shadow-md print:hidden">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-2.5 gap-2">
            <div className="flex items-center gap-2">
              <span className="text-base">🛡️</span>
              <h3 className="font-bold text-sm text-amber-400">{fuelLimits.statusText}</h3>
            </div>
            <span className="text-[11px] bg-amber-500/20 text-amber-300 px-2.5 py-0.5 rounded-full font-semibold">Aktualizacja o 18:00</span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="bg-zinc-950/70 border border-zinc-800 p-2.5 rounded-lg"><div className="text-[11px] text-zinc-400">Benzyna 95</div><div className="text-base sm:text-lg font-black">{fuelLimits.pb95} zł</div></div>
            <div className="bg-zinc-950/70 border border-zinc-800 p-2.5 rounded-lg"><div className="text-[11px] text-zinc-400">Benzyna 98</div><div className="text-base sm:text-lg font-black">{fuelLimits.pb98} zł</div></div>
            <div className="bg-zinc-950/70 border border-zinc-800 p-2.5 rounded-lg"><div className="text-[11px] text-zinc-400">Olej Napędowy</div><div className="text-base sm:text-lg font-black">{fuelLimits.on} zł</div></div>
          </div>
        </div>

        {/* Alerty serwisowe */}
        {stats.alerts.length > 0 && (
          <div className="space-y-2 mb-5 print:hidden">
            {stats.alerts.map((al, idx) => (
              <div key={idx} onClick={() => setActiveTab('service')} className="p-3.5 rounded-xl border bg-amber-500/15 border-amber-500/40 text-amber-300 flex items-center justify-between cursor-pointer">
                <div className="flex items-center gap-3"><Wrench className="w-5 h-5 shrink-0" /><span className="text-xs sm:text-sm font-bold">{al.title}</span></div>
                <span className="text-xs underline">Sprawdź →</span>
              </div>
            ))}
          </div>
        )}

        {/* Alert budżetowy */}
        {isOverBudget && (
          <div className="mb-5 p-4 bg-red-500/15 border border-red-500/40 rounded-2xl flex items-center gap-4 text-red-300 print:hidden">
            <AlertTriangle className="w-8 h-8 text-red-500 shrink-0" />
            <div>
              <h3 className="font-bold text-red-400">Przekroczono miesięczny limit wydatków!</h3>
              <p className="text-sm">Wydałeś <strong>{stats.currentMonthCost} zł</strong> z limitu <strong>{monthlyLimit} zł</strong>.</p>
            </div>
          </div>
        )}

        {/* Nawigacja Desktop */}
        <div className="hidden md:flex flex-wrap gap-2 mb-6 bg-zinc-900 p-1.5 rounded-2xl border border-zinc-800 w-fit print:hidden">
          <button onClick={() => setActiveTab('dashboard')} className={`px-4 py-2.5 rounded-xl text-sm font-semibold ${activeTab === 'dashboard' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'}`}>Pulpit</button>
          <button onClick={() => setActiveTab('refuel')} className={`px-4 py-2.5 rounded-xl text-sm font-semibold ${activeTab === 'refuel' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'}`}>Tankuj / OCR</button>
          <button onClick={() => setActiveTab('service')} className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 ${activeTab === 'service' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'}`}><Wrench className="w-4 h-4" /> Serwis i OBD</button>
          <button onClick={() => setActiveTab('expenses')} className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-1.5 ${activeTab === 'expenses' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'}`}><Receipt className="w-4 h-4" /> Wydatki TCO</button>
          <button onClick={() => setActiveTab('fleet')} className={`px-4 py-2.5 rounded-xl text-sm font-semibold ${activeTab === 'fleet' ? 'bg-amber-500 text-zinc-950' : 'text-zinc-400'}`}>Pojazdy ({myVehicles.length})</button>
          {isAdmin && <button onClick={() => setActiveTab('admin')} className={`px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 ${activeTab === 'admin' ? 'bg-amber-500 text-zinc-950' : 'text-amber-400'}`}><ShieldAlert className="w-4 h-4" /> Admin</button>}
        </div>

        {/* ZAKŁADKA 1: PULPIT */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {myVehicles.length === 0 ? (
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
                <Car className="w-12 h-12 text-amber-500 mx-auto mb-3" />
                <h2 className="text-xl font-bold mb-2">Dodaj swój pierwszy pojazd</h2>
                <button onClick={() => setActiveTab('fleet')} className="bg-amber-500 text-zinc-950 font-bold px-6 py-3 rounded-xl mt-4">Dodaj teraz</button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl"><div className="text-xs text-zinc-400 mb-2">KOSZT PALIWA</div><div className="text-2xl font-black">{stats.cost} zł</div></div>
                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl"><div className="text-xs text-zinc-400 mb-2">CAŁKOWITE TCO</div><div className="text-2xl font-black">{stats.totalTco} zł</div></div>
                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl">
                    <div className="text-xs text-zinc-400 mb-2 flex items-center justify-between">
                      <span>SZAC. WART. AUTA</span>
                      <button onClick={() => setShowPassportModal(true)} className="text-amber-400 underline text-[10px]">Paszport QR</button>
                    </div>
                    <div className="text-2xl font-black text-emerald-400">{stats.estimatedCarValue} zł</div>
                  </div>
                  <div className="bg-zinc-900 border border-zinc-800 p-5 rounded-2xl"><div className="text-xs text-zinc-400 mb-2">ŚREDNIE SPALANIE</div><div className="text-2xl font-black text-amber-500">{stats.avgConsumption} l/100</div></div>
                </div>

                {/* MODUŁ 1: OBD-II oraz Objawy */}
                <div className="grid md:grid-cols-2 gap-6 bg-zinc-900 border border-zinc-800 rounded-2xl p-6 print:hidden">
                  <div>
                    <h3 className="font-bold text-base text-amber-400 mb-3 flex items-center gap-2"><Wrench className="w-5 h-5" /> Tłumacz Klastra / Błędów OBD-II</h3>
                    <form onSubmit={handleSearchObd} className="flex gap-2 mb-3">
                      <input type="text" value={obdCodeInput} onChange={(e) => setObdCodeInput(e.target.value)} placeholder="Np. P0171" className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm uppercase flex-1" />
                      <button type="submit" className="bg-amber-500 text-zinc-950 font-bold px-4 rounded-xl text-sm">Szukaj</button>
                    </form>
                    {obdResult && (
                      <div className="bg-zinc-950 border border-amber-500/30 p-3.5 rounded-xl text-xs space-y-1">
                        <div className="font-bold text-amber-300">{obdResult.title}</div>
                        <div className="text-zinc-300"><strong>Przyczyna:</strong> {obdResult.cause}</div>
                      </div>
                    )}
                  </div>

                  <div>
                    <h3 className="font-bold text-base text-amber-400 mb-3 flex items-center gap-2"><Sparkles className="w-5 h-5" /> Dziennik Objawów i Dźwięków</h3>
                    <form onSubmit={handleAddSymptom} className="flex gap-2 mb-3">
                      <input type="text" value={symptomInput} onChange={(e) => setSymptomInput(e.target.value)} placeholder="Np. szum przy 2000 RPM" className="bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm flex-1" />
                      <button type="submit" className="bg-zinc-800 text-amber-400 font-bold px-4 rounded-xl text-sm">Zapisz</button>
                    </form>
                    <div className="space-y-1.5 max-h-32 overflow-y-auto">
                      {symptomsList.map(s => (
                        <div key={s.id} className="bg-zinc-950 px-3 py-2 rounded-lg text-xs flex justify-between">
                          <span className="text-zinc-200">{s.text}</span>
                          <span className="text-zinc-500">{s.date}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* MODUŁ 2: Paszport Pojazdu Modal */}
                {showPassportModal && (
                  <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-zinc-900 border border-amber-500/40 rounded-2xl max-w-md w-full p-6 relative">
                      <button onClick={() => setShowPassportModal(false)} className="absolute top-4 right-4 text-zinc-400">✕</button>
                      <div className="text-center space-y-3">
                        <QrCode className="w-24 h-24 text-amber-400 mx-auto bg-white p-2 rounded-xl" />
                        <h3 className="text-xl font-bold text-amber-400">Paszport Pojazdu</h3>
                        <div className="bg-zinc-950 p-3 rounded-xl text-xs text-left space-y-1 border border-zinc-800">
                          <div><strong>Auto:</strong> {activeVehicle.name}</div>
                          <div><strong>Rejestracja:</strong> {activeVehicle.plate}</div>
                          <div><strong>Licznik:</strong> {activeVehicle.currentOdometer} km</div>
                          <div><strong>Wartość rynkowa:</strong> {stats.estimatedCarValue} zł</div>
                        </div>
                        <button onClick={() => window.print()} className="w-full bg-amber-500 text-zinc-950 font-bold py-2.5 rounded-xl text-sm">Drukuj Kartę</button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ZAKŁADKA 2: TANKOWANIE + MODUŁ 4 (GŁOS) */}
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
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2"><Camera className="w-6 h-6 text-amber-500" /> Nowe tankowanie</h2>
                <button type="button" onClick={startVoiceInput} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition ${isListeningVoice ? 'bg-red-500 text-white animate-pulse' : 'bg-zinc-800 text-amber-400'}`}>
                  <Mic className="w-4 h-4" /> {isListeningVoice ? 'Słucham...' : 'Wprowadź głosem'}
                </button>
              </div>

              <label className="flex flex-col items-center justify-center border-2 border-dashed border-amber-500/40 bg-amber-500/5 rounded-2xl p-6 cursor-pointer mb-6">
                <Camera className="w-10 h-10 text-amber-500 mb-2" />
                <span className="font-bold text-amber-400 text-sm">{ocrLoading ? 'Przetwarzanie paragonu...' : 'Zrób zdjęcie lub wybierz z galerii'}</span>
                <input type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
              </label>

              {ocrStatus && <div className="mb-4 p-3 bg-zinc-950 border border-amber-500/30 rounded-xl text-xs text-amber-300">{ocrStatus}</div>}

              <form onSubmit={handleAddFuelLog} className="space-y-4">
                <div className="grid grid-cols-3 gap-3">
                  <div><label className="block text-xs text-zinc-400 mb-1">Cena/L</label><input type="number" step="0.01" required value={pricePerLiter} onChange={(e) => handlePriceOrTotalChange(e.target.value, totalCost)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5" /></div>
                  <div><label className="block text-xs text-zinc-400 mb-1">Kwota</label><input type="number" step="0.01" required value={totalCost} onChange={(e) => handlePriceOrTotalChange(pricePerLiter, e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5" /></div>
                  <div><label className="block text-xs text-zinc-400 mb-1">Litry</label><input type="number" step="0.01" required value={liters} onChange={(e) => handleLitersChange(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5" /></div>
                </div>

                <div>
                  <label className="block text-xs text-amber-400 font-bold mb-1">Przebieg (km) — poprzednio: {activeVehicle?.currentOdometer || 0} km</label>
                  <input type="number" required value={odometer} onChange={(e) => setOdometer(e.target.value)} className="w-full bg-zinc-950 border border-amber-500/50 rounded-xl px-4 py-3 text-lg font-bold" />
                  <div className="mt-2">
                    <input type="file" accept="image/*" id="odometer-input" className="hidden" onChange={handleOdometerUpload} />
                    <label htmlFor="odometer-input" className="inline-flex items-center justify-center w-full py-2 bg-zinc-950 hover:bg-zinc-800 border border-amber-500/50 text-amber-400 text-xs font-bold rounded-xl cursor-pointer">
                      {odometerOcrLoading ? '📷 Skanowanie licznika...' : '📷 Wybierz zdjęcie licznika'}
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <input type="date" required value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm" />
                  <input type="time" required value={time} onChange={(e) => setTime(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm" />
                </div>

                <button type="submit" disabled={isSubmitting} className="w-full bg-amber-500 text-zinc-950 font-bold py-3.5 rounded-xl">{isSubmitting ? 'Zapisywanie...' : 'Zapisz tankowanie'}</button>
              </form>
            </div>
          )
        )}

        {/* ZAKŁADKA 3: SERWIS */}
        {activeTab === 'service' && (
          !activeVehicle ? (
            <div className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <Car className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold mb-6">Dodaj pojazd w zakładce Flota</h2>
              <button onClick={() => setActiveTab('fleet')} className="bg-amber-500 text-zinc-950 font-bold px-6 py-3 rounded-xl">Przejdź do floty</button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-6">
                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-amber-500" /> Terminy OC/AC i Przeglądu</h2>
                  <form onSubmit={handleSaveVehicleDates} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className="block text-xs text-zinc-400 mb-1">OC/AC do</label><input type="date" value={insuranceExpiryInput} onChange={(e) => setInsuranceExpiryInput(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm" /></div>
                      <div><label className="block text-xs text-zinc-400 mb-1">Przegląd do</label><input type="date" value={inspectionExpiryInput} onChange={(e) => setInspectionExpiryInput(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-sm" /></div>
                    </div>
                    <button type="submit" className="w-full bg-zinc-800 text-amber-400 font-bold py-2.5 rounded-xl text-xs">Zapisz terminy</button>
                  </form>
                </div>

                <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                  <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Wrench className="w-5 h-5 text-amber-500" /> Dodaj wpis serwisowy</h2>
                  <form onSubmit={handleAddServiceLog} className="space-y-4">
                    <select value={serviceType} onChange={(e) => setServiceType(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm">
                      <option value="Wymiana oleju i filtrów">Wymiana oleju i filtrów</option>
                      <option value="Klocki i tarcze hamulcowe">Klocki i tarcze hamulcowe</option>
                      <option value="Rozrząd">Wymiana rozrządu</option>
                      <option value="Inne">Inna naprawa</option>
                    </select>
                    <div className="grid grid-cols-2 gap-3">
                      <input type="number" required value={serviceOdo} onChange={(e) => setServiceOdo(e.target.value)} placeholder="Przebieg" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2" />
                      <input type="number" step="0.01" required value={serviceCost} onChange={(e) => setServiceCost(e.target.value)} placeholder="Koszt zł" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2" />
                    </div>
                    <button type="submit" className="w-full bg-amber-500 text-zinc-950 font-bold py-3 rounded-xl">Zapisz serwis</button>
                  </form>
                </div>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4">Historia serwisowa</h2>
                {stats.vehicleServices.length === 0 ? <p className="text-sm text-zinc-500">Brak wpisów.</p> : (
                  <div className="space-y-3">
                    {stats.vehicleServices.map(s => (
                      <div key={s.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex justify-between">
                        <div><div className="font-bold text-sm">{s.serviceType}</div><div className="text-xs text-zinc-400">{s.cost} zł • {s.date} • {s.odometer} km</div></div>
                        <button onClick={() => deleteDoc(doc(db, 'serviceLogs', s.id))} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* ZAKŁADKA 4: WYDATKI TCO */}
        {activeTab === 'expenses' && (
          !activeVehicle ? (
            <div className="max-w-xl mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl p-8 text-center">
              <Car className="w-12 h-12 text-amber-500 mx-auto mb-3" />
              <h2 className="text-lg font-bold mb-6">Dodaj pojazd w zakładce Flota</h2>
              <button onClick={() => setActiveTab('fleet')} className="bg-amber-500 text-zinc-950 font-bold px-6 py-3 rounded-xl">Przejdź do floty</button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4 flex items-center gap-2"><Receipt className="w-5 h-5 text-amber-500" /> Dodaj wydatek TCO</h2>
                <form onSubmit={handleAddExpenseLog} className="space-y-4">
                  <select value={expCategory} onChange={(e) => setExpCategory(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm">
                    <option value="Myjnia / Kosmetyka">Myjnia / Kosmetyka</option>
                    <option value="Autostrady / Parking">Autostrady / Parking</option>
                    <option value="Części / Opony">Części / Opony</option>
                    <option value="Ubezpieczenie OC/AC">Ubezpieczenie OC/AC</option>
                  </select>
                  <input type="number" step="0.01" required value={expAmount} onChange={(e) => setExpAmount(e.target.value)} placeholder="Kwota brutto zł" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5" />
                  <input type="text" value={expTitle} onChange={(e) => setExpTitle(e.target.value)} placeholder="Opis (np. Myjnia bezdotykowa)" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-sm" />
                  <button type="submit" className="w-full bg-amber-500 text-zinc-950 font-bold py-3 rounded-xl">Zapisz wydatek</button>
                </form>
              </div>

              <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
                <h2 className="text-lg font-bold mb-4">Rejestr wydatków TCO</h2>
                {stats.vehicleExpenses.length === 0 ? <p className="text-sm text-zinc-500">Brak wydatków.</p> : (
                  <div className="space-y-3">
                    {stats.vehicleExpenses.map(exp => (
                      <div key={exp.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex justify-between">
                        <div><div className="font-bold">{exp.category}: {exp.amount} zł</div><div className="text-xs text-zinc-400">{exp.title} • {exp.date}</div></div>
                        <button onClick={() => deleteDoc(doc(db, 'expenseLogs', exp.id))} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )
        )}

        {/* ZAKŁADKA 5: FLOTA POJAZDÓW */}
        {activeTab === 'fleet' && (
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-4">{editingVehicleId ? 'Edytuj pojazd' : 'Dodaj pojazd'}</h2>
              <form onSubmit={handleSaveVehicle} className="space-y-4">
                <input type="text" required value={vName} onChange={(e) => setVName(e.target.value)} placeholder="Marka i model" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5" />
                <input type="text" required value={vPlate} onChange={(e) => setVPlate(e.target.value)} placeholder="Rejestracja" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 uppercase" />
                <input type="number" required value={vInitialOdo} onChange={(e) => setVInitialOdo(e.target.value)} placeholder="Przebieg początkowy" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5" />
                <input type="number" value={vPurchasePrice} onChange={(e) => setVPurchasePrice(e.target.value)} placeholder="Cena zakupu auta w PLN (do wyceny TCO)" className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5" />
                <input type="date" value={vPurchaseDate} onChange={(e) => setVPurchaseDate(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm" />
                <select value={vFuelConfig} onChange={(e) => setVFuelConfig(e.target.value)} className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5">
                  <option value="PB95">Benzyna (PB95/98)</option>
                  <option value="LPG">LPG + PB95</option>
                  <option value="ON">Diesel (ON)</option>
                </select>
                <button type="submit" className="w-full bg-amber-500 text-zinc-950 font-bold py-3 rounded-xl">Zapisz</button>
              </form>
            </div>

            <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <h2 className="text-lg font-bold mb-4">Twoja flota</h2>
              <div className="space-y-3">
                {myVehicles.map(v => (
                  <div key={v.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex items-center justify-between">
                    <div><div className="font-bold">{v.name} ({v.plate})</div><div className="text-xs text-zinc-400">Stan licznika: {v.currentOdometer || v.initialOdometer} km</div></div>
                    <button onClick={() => handleDeleteVehicle(v.id)} className="text-red-400"><Trash2 className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ZAKŁADKA 6: ADMIN */}
        {activeTab === 'admin' && isAdmin && (
          <div className="bg-zinc-900 border border-amber-500/30 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-amber-400 mb-4">Panel Administratora ({allUsers.length} użytkowników)</h2>
            <div className="space-y-3">
              {allUsers.map(u => (
                <div key={u.id} className="bg-zinc-950 border border-zinc-800 p-4 rounded-xl flex justify-between items-center">
                  <div><div className="font-bold">{u.email}</div><div className="text-xs text-zinc-500">ID: {u.id}</div></div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Dolny pasek mobilny */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-zinc-900 border-t border-zinc-800 flex justify-around py-2.5 z-30 print:hidden">
        <button onClick={() => setActiveTab('dashboard')} className={`flex flex-col items-center text-[11px] ${activeTab === 'dashboard' ? 'text-amber-500' : 'text-zinc-400'}`}><TrendingUp className="w-5 h-5 mb-0.5" /> Pulpit</button>
        <button onClick={() => setActiveTab('refuel')} className={`flex flex-col items-center text-[11px] ${activeTab === 'refuel' ? 'text-amber-500' : 'text-zinc-400'}`}><Camera className="w-5 h-5 mb-0.5" /> Tankuj</button>
        <button onClick={() => setActiveTab('service')} className={`flex flex-col items-center text-[11px] ${activeTab === 'service' ? 'text-amber-500' : 'text-zinc-400'}`}><Wrench className="w-5 h-5 mb-0.5" /> Serwis</button>
        <button onClick={() => setActiveTab('expenses')} className={`flex flex-col items-center text-[11px] ${activeTab === 'expenses' ? 'text-amber-500' : 'text-zinc-400'}`}><Receipt className="w-5 h-5 mb-0.5" /> TCO</button>
        <button onClick={() => setActiveTab('fleet')} className={`flex flex-col items-center text-[11px] ${activeTab === 'fleet' ? 'text-amber-500' : 'text-zinc-400'}`}><Car className="w-5 h-5 mb-0.5" /> Flota</button>
      </nav>
    </div>
  );
}