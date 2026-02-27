import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, CheckCircle, Circle, User, Activity, LogOut, 
  Plus, Trash2, TrendingUp, Calendar, Lock, Video,
  ChevronRight, Dumbbell, ClipboardList, Settings,
  BarChart2, Camera, ArrowLeft, UploadCloud, Link as LinkIcon,
  Sparkles, Bot, Code, Lightbulb, AlertTriangle, Home,
  Droplets, Moon, PersonStanding, Clock, MessageSquare,
  Pause, RotateCcw, Utensils, ChefHat, Image as ImageIcon,
  Edit2, Flame, ThumbsUp, ThumbsDown, Medal, Target
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// --- GEMINI API CONFIG ---
const apiKey = "AIzaSyBwsnLQTWqG7YArJE4hkT8Jp27QQwUz2e4"; 

// Generic Text Generation (Works perfectly for Coach Tips and Nutritionist)
async function generateAIFeedback(prompt, systemInstruction) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] }
      })
    });
    const data = await response.json();
    if (data.error) console.error("API Error:", data.error.message);
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No insights could be generated right now.";
  } catch (err) {
    console.error(err);
    return "Error connecting to the AI Coach.";
  }
}

// --- CONSTANTS ---
const CATEGORIES = [
  { name: "Tae bo", img: "https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=600&q=80" },
  { name: "Crossfit", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80" },
  { name: "Body combat", img: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=600&q=80" },
  { name: "Stick mobility", img: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80" },
  { name: "Functional flow", img: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=600&q=80" },
  { name: "Fitness", img: "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=600&q=80" },
  { name: "Stretching", img: "https://images.unsplash.com/photo-1544367567-0f2fcb009e0b?auto=format&fit=crop&w=600&q=80" } 
];

const MEAL_CATEGORIES = [
  { name: "Keto", img: "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?auto=format&fit=crop&w=600&q=80" },
  { name: "Vegan", img: "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&q=80" },
  { name: "Carnivore", img: "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=600&q=80" },
  { name: "Mediterranean", img: "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=600&q=80" },
  { name: "Pescatarian", img: "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80" },
  { name: "Lenten Fasting", img: "https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=600&q=80" }
];

const FITNESS_GOALS = ["Weight Loss", "Muscle Gain", "Endurance & Stamina", "Flexibility & Mobility", "General Health"];

// --- FIREBASE INITIALIZATION ---
let app, auth, db, appId;

try {
  const firebaseConfig = {
    apiKey: "AIzaSyD3er01roP71kOET0ebyQyzJxfNcvHUWE8",
    authDomain: "sam-fit-73b88.firebaseapp.com",
    projectId: "sam-fit-73b88",
    storageBucket: "sam-fit-73b88.firebasestorage.app",
    messagingSenderId: "805503830384",
    appId: "1:805503830384:web:d8eb1271e8f3f3425367b5"
  };

  appId = 'samfit-live'; 
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
} catch (error) {
  console.error("Firebase init error:", error);
}

// --- MAIN APP COMPONENT ---
export default function App() {
  const [fbUser, setFbUser] = useState(null);
  const [isDbLoading, setIsDbLoading] = useState(true);
  
  const [users, setUsers] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [meals, setMeals] = useState([]);
  const [logs, setLogs] = useState([]);
  const [feedbacks, setFeedbacks] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [sessionStartTime, setSessionStartTime] = useState(null);

  // Global CSS to remove arrows from number inputs for the habit tracker
  useEffect(() => {
    const style = document.createElement('style');
    style.innerHTML = `
      input[type=number]::-webkit-inner-spin-button, 
      input[type=number]::-webkit-outer-spin-button { -webkit-appearance: none; margin: 0; }
      input[type=number] { -moz-appearance: textfield; }
    `;
    document.head.appendChild(style);

    window.alert = (msg) => {
      const el = document.createElement('div');
      el.className = 'fixed top-4 right-4 bg-zinc-900 border border-emerald-900/50 text-emerald-400 px-6 py-4 rounded-xl shadow-2xl z-[9999] font-sans text-sm tracking-wide transition-opacity duration-500';
      el.innerText = msg;
      document.body.appendChild(el);
      setTimeout(() => { el.classList.add('opacity-0'); setTimeout(() => el.remove(), 500); }, 5000); 
    };
  }, []);

  useEffect(() => {
    if (!auth) { setIsDbLoading(false); return; }
    const initAuth = async () => {
      try { await signInAnonymously(auth); } 
      catch (err) { console.error("Auth Error:", err); setIsDbLoading(false); }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, user => { setFbUser(user); });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!fbUser || !db) return;

    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'samfit_users');
    const exercisesRef = collection(db, 'artifacts', appId, 'public', 'data', 'samfit_exercises');
    const mealsRef = collection(db, 'artifacts', appId, 'public', 'data', 'samfit_meals');
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'samfit_logs');
    const feedbackRef = collection(db, 'artifacts', appId, 'public', 'data', 'samfit_feedbacks');

    let uLoaded = false, eLoaded = false, mLoaded = false, lLoaded = false, fLoaded = false;
    const checkLoaded = () => { if (uLoaded && eLoaded && mLoaded && lLoaded && fLoaded) setIsDbLoading(false); };

    const unsubUsers = onSnapshot(usersRef, (snap) => {
      const data = snap.docs.map(d => d.data());
      setUsers(data);
      if (!currentUser && fbUser) {
        const matchingUser = data.find(u => u.firebaseUid === fbUser.uid);
        if (matchingUser && matchingUser.active) {
          loginProcess(matchingUser);
        }
      }
      uLoaded = true; checkLoaded();
    });

    const unsubEx = onSnapshot(exercisesRef, (snap) => { setExercises(snap.docs.map(d => d.data())); eLoaded = true; checkLoaded(); });
    const unsubMeals = onSnapshot(mealsRef, (snap) => { setMeals(snap.docs.map(d => d.data())); mLoaded = true; checkLoaded(); });
    const unsubLogs = onSnapshot(logsRef, (snap) => { setLogs(snap.docs.map(d => d.data())); lLoaded = true; checkLoaded(); });
    const unsubFb = onSnapshot(feedbackRef, (snap) => { setFeedbacks(snap.docs.map(d => d.data())); fLoaded = true; checkLoaded(); });

    return () => { unsubUsers(); unsubEx(); unsubMeals(); unsubLogs(); unsubFb(); };
  }, [fbUser]); 

  const loginProcess = async (userObj) => {
    setCurrentUser(userObj);
    // Update last login timestamp in the background
    if (userObj.role !== 'admin' && db) {
      try {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', userObj.id), { ...userObj, lastLogin: Date.now() }, { merge: true });
      } catch (e) { console.error(e); }
    }
  };

  const handleLogin = async (username, password, rememberMe) => {
    setAuthError('');
    
    // HARDCODED ADMIN MASTER KEY
    if (username.toLowerCase() === 'samfit' && password === 'Sammassam') {
      setCurrentUser({ id: 'admin_master', username: 'Samfit', role: 'admin', active: true });
      return;
    }

    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      if (!user.active && user.role !== 'admin') {
        setAuthError("Your access has been revoked.");
        return;
      }
      if (rememberMe && fbUser && db) {
        try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', user.id), { ...user, firebaseUid: fbUser.uid }, { merge: true }); } 
        catch (err) { console.error("Failed to save remember me state", err); }
      }
      loginProcess(user);
      setSessionStartTime(Date.now());
    } else {
      setAuthError("Invalid credentials.");
    }
  };

  const handleLogout = async () => {
    if (currentUser && currentUser.firebaseUid && db && currentUser.role !== 'admin') {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', currentUser.id), { ...currentUser, firebaseUid: null }, { merge: true });
    }
    setCurrentUser(null);
    setSessionStartTime(null);
  };

  if (isDbLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <img src="https://samfit.co/logo.png" alt="Sam Fit" className="h-20 w-20 animate-pulse rounded-full border border-zinc-700 mb-6 object-cover" onError={(e) => { e.target.style.display='none'; }}/>
        <p className="text-zinc-500 uppercase tracking-widest text-sm animate-pulse">Loading Workspace...</p>
      </div>
    );
  }

  if (!currentUser) return <LoginScreen onLogin={handleLogin} error={authError} />;

  if (currentUser.role === 'user' && (!currentUser.profile?.weight || currentUser.profile?.weight === 0 || !currentUser.profile?.heightCm || currentUser.profile?.heightCm === 0)) {
    return <OnboardingScreen user={currentUser} db={db} appId={appId} />;
  }

  return (
    <div className="min-h-screen bg-black text-zinc-200 font-sans selection:bg-zinc-700 pb-24 md:pb-8">
      <nav className="border-b border-zinc-800 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img src="https://samfit.co/logo.png" alt="Sam Fit Logo" className="h-10 w-10 rounded-full object-cover border border-zinc-700 bg-black" onError={(e) => { e.target.style.display='none'; }} />
              <span className="text-xl font-bold tracking-[0.2em] uppercase text-white">Sam Fit</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-zinc-400 hidden sm:block">
                Logged in as <strong className="text-zinc-100">{currentUser.role === 'admin' ? 'Admin' : (currentUser.profile?.firstName || currentUser.username)}</strong>
              </span>
              <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-full transition-colors border border-transparent hover:border-zinc-800">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentUser.role === 'admin' ? (
          <AdminDashboard users={users} logs={logs} exercises={exercises} meals={meals} feedbacks={feedbacks} />
        ) : (
          <UserDashboard user={currentUser} users={users} exercises={exercises} meals={meals} logs={logs} sessionStartTime={sessionStartTime} />
        )}
      </main>
    </div>
  );
}

// --- ONBOARDING SCREEN ---
function OnboardingScreen({ user, db, appId }) {
  const [weight, setWeight] = useState('');
  const [heightM, setHeightM] = useState('1');
  const [heightCm, setHeightCm] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async (e) => {
    e.preventDefault();
    if (!weight || !heightCm) return alert("Please fill in your details to continue.");
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', user.id), {
        ...user,
        profile: { ...user.profile, weight: Number(weight), heightM: Number(heightM), heightCm: Number(heightCm), fitnessGoal: FITNESS_GOALS[0] }
      }, { merge: true });
    } catch(err) { alert("Error saving profile"); }
    setIsSaving(false);
  };

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center px-4 bg-[url('https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/90 backdrop-blur-md"></div>
      <div className="w-full max-w-md bg-zinc-950 border border-zinc-800 rounded-3xl p-8 relative z-10 shadow-2xl">
        <h2 className="text-2xl font-bold text-white uppercase tracking-widest mb-2 text-center">Welcome to Sam Fit</h2>
        <p className="text-zinc-400 text-sm text-center mb-8">Before we begin, let's set your baseline metrics so we can track your progress.</p>
        
        <form onSubmit={handleSave} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase mb-2">Height (Meters)</label>
              <input type="number" min="0" className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-zinc-500 outline-none text-center font-mono" value={heightM} onChange={e => setHeightM(e.target.value)} required />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase mb-2">Height (CM)</label>
              <input type="number" min="0" max="99" placeholder="e.g. 80" className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-zinc-500 outline-none text-center font-mono" value={heightCm} onChange={e => setHeightCm(e.target.value)} required />
            </div>
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase mb-2">Current Weight (KG)</label>
            <input type="number" step="0.1" placeholder="e.g. 75.5" className="w-full bg-black border border-zinc-800 rounded-xl px-4 py-4 text-white focus:border-zinc-500 outline-none text-center font-mono text-xl" value={weight} onChange={e => setWeight(e.target.value)} required />
          </div>
          <button type="submit" disabled={isSaving} className="w-full bg-white text-black font-bold uppercase tracking-widest py-4 rounded-xl hover:bg-zinc-200 transition-colors mt-4">
            {isSaving ? 'Saving...' : 'Start My Journey'}
          </button>
        </form>
      </div>
    </div>
  );
}

// --- LOGIN SCREEN ---
function LoginScreen({ onLogin, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center px-4 bg-[url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/85 backdrop-blur-sm"></div>
      
      <div className="w-full max-w-md bg-zinc-950/90 border border-zinc-800 rounded-3xl shadow-2xl overflow-hidden relative z-10">
        <div className="p-8 pb-10">
          <div className="flex justify-center mb-6">
             <img src="https://samfit.co/logo.png" alt="Sam Fit" className="h-28 w-28 rounded-full border border-zinc-700 bg-black object-cover shadow-[0_0_30px_rgba(255,255,255,0.05)]" onError={(e) => { e.target.style.display='none'; }} />
          </div>
          <h2 className="text-2xl font-bold text-center text-white uppercase tracking-[0.2em]">Sam Fit Portal</h2>
          <p className="text-center text-zinc-500 text-xs tracking-[0.3em] uppercase mt-2 mb-8 font-bold">By Athletes, For Athletes</p>
          
          {error && <div className="bg-red-950/50 border border-red-900/50 text-red-400 text-xs font-bold tracking-widest uppercase p-4 rounded-lg mb-6 text-center">{error}</div>}
          
          <form onSubmit={(e) => { e.preventDefault(); onLogin(username, password, rememberMe); }} className="space-y-5">
            <input type="text" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-600 text-sm" placeholder="USERNAME" value={username} onChange={e => setUsername(e.target.value)} required />
            <input type="password" className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-600 text-sm" placeholder="PASSWORD" value={password} onChange={e => setPassword(e.target.value)} required />
            
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center space-x-3 cursor-pointer group" onClick={() => setRememberMe(!rememberMe)}>
                <div className={`w-5 h-5 rounded flex items-center justify-center border transition-colors ${rememberMe ? 'bg-white border-white' : 'bg-black border-zinc-600 group-hover:border-zinc-400'}`}>
                  {rememberMe && <CheckCircle size={14} className="text-black" />}
                </div>
                <span className="text-xs font-bold tracking-wider text-zinc-400 uppercase group-hover:text-white transition-colors">Remember Me</span>
              </label>
            </div>

            <button type="submit" className="w-full bg-white text-black font-bold uppercase tracking-widest py-4 rounded-xl hover:bg-zinc-200 transition-colors shadow-lg mt-4 text-sm">
              Enter Arena
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

// --- ADMIN DASHBOARD ---
function AdminDashboard({ users, logs, exercises, meals, feedbacks }) {
  const [activeTab, setActiveTab] = useState('users');
  const clients = users.filter(u => u.role === 'user');

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-zinc-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'users', label: 'Manage Clients', icon: <User size={16}/> },
          { id: 'exercises', label: 'Manage Exercises', icon: <Dumbbell size={16}/> },
          { id: 'meals', label: 'Manage Meals', icon: <ChefHat size={16}/> },
          { id: 'analytics', label: 'Client Analytics', icon: <BarChart2 size={16}/> }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`px-4 py-2 text-sm font-medium transition-all flex items-center space-x-2 whitespace-nowrap rounded-t-lg ${activeTab === tab.id ? 'bg-zinc-900 text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'}`}>
            {tab.icon} <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'users' && <AdminUserManagement users={clients} />}
      {activeTab === 'exercises' && <AdminExerciseManagement exercises={exercises} />}
      {activeTab === 'meals' && <AdminMealManagement meals={meals} />}
      {activeTab === 'analytics' && <AdminAnalytics clients={clients} logs={logs} feedbacks={feedbacks} />}
    </div>
  );
}

function AdminUserManagement({ users }) {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [gender, setGender] = useState('Male');
  const [age, setAge] = useState('');

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUsername || !newPassword || !age || !db) return;
    const newUserId = 'user_' + Date.now();
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', newUserId), {
        id: newUserId, username: newUsername, password: newPassword, role: 'user', active: true,
        adminData: { gender, age: Number(age) }, // Private admin notes
        profile: { firstName: '', lastName: '', heightM: 0, heightCm: 0, weight: 0, photo: '', fitnessGoal: FITNESS_GOALS[0] }
      });
      setNewUsername(''); setNewPassword(''); setAge(''); alert("Client added successfully!");
    } catch (err) { alert("Error adding user: " + err.message); }
  };

  const toggleAccess = async (user) => {
    if (!db) return;
    try { await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', user.id), { ...user, active: !user.active }, { merge: true }); } 
    catch (err) { alert("Error updating access: " + err.message); }
  };

  // Helper to determine Activity status
  const getActivityStatus = (lastLogin) => {
    if (!lastLogin) return <span className="text-zinc-500 font-mono">Never logged in</span>;
    const daysInactive = Math.floor((Date.now() - lastLogin) / 86400000);
    if (daysInactive <= 3) return <span className="text-emerald-500 font-bold font-mono flex items-center"><Circle fill="currentColor" size={8} className="mr-1"/> Active</span>;
    return <span className="text-amber-500 font-mono">Inactive {daysInactive} days</span>;
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 h-fit">
        <h3 className="text-lg font-bold text-white mb-6 flex items-center"><Plus size={18} className="mr-2 text-zinc-400"/> Create Client</h3>
        <form onSubmit={handleAddUser} className="space-y-4">
          <input type="text" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white" value={newUsername} onChange={e => setNewUsername(e.target.value)} required placeholder="Username" />
          <input type="text" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="Password" />
          <div className="grid grid-cols-2 gap-3 pt-2 border-t border-zinc-900">
             <div>
               <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Gender (Admin Only)</label>
               <select className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white outline-none" value={gender} onChange={e => setGender(e.target.value)}>
                 <option>Male</option><option>Female</option>
               </select>
             </div>
             <div>
               <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Age (Admin Only)</label>
               <input type="number" min="1" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white outline-none" value={age} onChange={e => setAge(e.target.value)} required placeholder="e.g. 28"/>
             </div>
          </div>
          <button type="submit" className="w-full bg-white text-black text-sm font-bold uppercase py-3 rounded-lg hover:bg-zinc-200 mt-2">Generate Access</button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50"><h3 className="text-lg font-bold text-white">Client Directory</h3></div>
        <div className="divide-y divide-zinc-800 max-h-[600px] overflow-y-auto">
          {users.map(u => (
            <div key={u.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-zinc-900/80 gap-4">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border overflow-hidden shrink-0 ${u.active ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-red-950/30 border-red-900/50 text-red-500'}`}>
                  {u.profile?.photo ? <img src={u.profile.photo} className="w-full h-full object-cover"/> : (u.profile?.firstName ? u.profile.firstName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase())}
                </div>
                <div>
                  <div className="text-white font-medium flex items-center">
                    {u.profile?.firstName} {u.profile?.lastName} 
                    {u.adminData && <span className="ml-2 px-2 py-0.5 rounded bg-zinc-800 text-[10px] font-bold text-zinc-400">{u.adminData.gender} • {u.adminData.age}y</span>}
                  </div>
                  <div className="text-xs text-zinc-500 font-mono mt-1">User: <span className="text-zinc-300">{u.username}</span> | Pass: <span className="text-zinc-300">{u.password}</span></div>
                  <div className="text-xs mt-1">{getActivityStatus(u.lastLogin)}</div>
                </div>
              </div>
              <button onClick={() => toggleAccess(u)} className={`px-4 py-2 text-xs font-bold uppercase rounded-lg flex items-center ${u.active ? 'bg-black text-zinc-300 border border-zinc-700' : 'bg-white text-black'}`}>
                {u.active ? 'Revoke Access' : 'Restore Access'}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminExerciseManagement({ exercises }) {
  const [editId, setEditId] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [videoUrl, setVideoUrl] = useState('');
  const [instructions, setInstructions] = useState('');
  const [intensity, setIntensity] = useState('High');
  const [duration, setDuration] = useState('15');
  const [isGeneratingLibrary, setIsGeneratingLibrary] = useState(false);

  const startEdit = (ex) => {
    setEditId(ex.id); setTitle(ex.title); setCategory(ex.category); 
    setInstructions(ex.instructions || ''); setVideoUrl(ex.videoUrl || '');
    setIntensity(ex.intensity || 'High'); setDuration(ex.duration || '15');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditId(null); setTitle(''); setInstructions(''); setVideoUrl(''); setCategory(CATEGORIES[0].name); setIntensity('High'); setDuration('15');
  };

  const handleSaveExercise = async (e) => {
    e.preventDefault();
    if (!title || !db) return;
    const saveId = editId || ('ex_' + Date.now());
    
    let finalUrl = videoUrl;
    if (videoUrl && !videoUrl.startsWith('EMBED:') && !videoUrl.startsWith('DIRECT:') && !videoUrl.startsWith('IFRAME:')) {
      if (videoUrl.includes('youtube') || videoUrl.includes('youtu.be') || videoUrl.includes('vimeo')) {
        finalUrl = 'EMBED:' + videoUrl;
      } else if (videoUrl.includes('<iframe')) {
        finalUrl = 'IFRAME:' + videoUrl;
      } else {
        finalUrl = 'DIRECT:' + videoUrl;
      }
    }

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_exercises', saveId), { 
        id: saveId, title, category, instructions, videoUrl: finalUrl, intensity, duration 
      }, { merge: true });
      cancelEdit();
      alert(editId ? "Exercise updated successfully!" : "Exercise added successfully!");
    } catch (err) { alert("Error saving exercise: " + err.message); }
  };

  // HARDCODED MASS GENERATOR (100% RELIABLE)
  const seedWorkoutLibrary = async () => {
    if (!db || !window.confirm("Instantly add 10 structured workouts to all 7 categories (70 Total)?")) return;
    setIsGeneratingLibrary(true);
    
    const templates = ["Foundations", "Endurance Protocol", "Strength Builder", "Core Crusher", "Agility Drills", "Power Moves", "Speed Intervals", "Burnout Session", "Mobility Flow", "Max Intensity"];
    
    try {
      for (const cat of CATEGORIES) {
        for (let i = 0; i < 10; i++) {
          const id = `ex_auto_${cat.name.replace(/\s+/g, '')}_${i}_${Date.now()}`;
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_exercises', id), {
            id: id, 
            title: `${templates[i]}`, // Only the name, no category prefix!
            category: cat.name, 
            instructions: `1. Warm up thoroughly.\n2. Focus on proper form and controlled breathing.\n3. Complete specified sets and rounds.\n4. Stay hydrated.`, 
            intensity: i % 2 === 0 ? "High" : "Low", // Alternates High and Low
            duration: String(15 + (i * 5)), // Alternates durations (15, 20, 25...)
            videoUrl: ''
          });
        }
      }
      alert(`Success! Generated 70 workouts.`);
    } catch (err) { alert("Error generating library: " + err.message); }
    setIsGeneratingLibrary(false);
  };

  const clearAutoExercises = async () => {
    if (!db) return;
    const confirmDelete = window.confirm("WARNING: Are you absolutely sure you want to PERMANENTLY DELETE all auto-generated workouts? Custom workouts will stay.");
    if (!confirmDelete) return;
    
    setIsGeneratingLibrary(true);
    try {
      const autoEx = exercises.filter(e => e.id.includes('ex_auto_'));
      for (const ex of autoEx) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_exercises', ex.id));
      }
      alert(`Successfully deleted ${autoEx.length} auto-generated workouts.`);
    } catch (err) { alert("Error deleting: " + err.message); }
    setIsGeneratingLibrary(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="space-y-6">
        <div className={`border rounded-xl p-6 transition-colors ${editId ? 'bg-zinc-900 border-blue-500/50' : 'bg-zinc-950 border-zinc-800'}`}>
          <h3 className="text-lg font-bold text-white mb-6 flex items-center">
            {editId ? <Edit2 size={18} className="mr-2 text-blue-400"/> : <Plus size={18} className="mr-2 text-zinc-400"/>} 
            {editId ? 'Edit Exercise' : 'New Exercise'}
          </h3>
          <form onSubmit={handleSaveExercise} className="space-y-4">
            <input type="text" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Exercise Name" />
            <select className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white" value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            
            <div className="grid grid-cols-2 gap-3">
               <div>
                 <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Duration (Mins)</label>
                 <input type="number" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white" value={duration} onChange={e => setDuration(e.target.value)} required placeholder="e.g. 15" />
               </div>
               <div>
                 <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Intensity</label>
                 <select className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white" value={intensity} onChange={e => setIntensity(e.target.value)}>
                    <option value="High">High</option><option value="Low">Low</option>
                 </select>
               </div>
            </div>

            <div>
               <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Video Link (YouTube, Vimeo, MP4)</label>
               <input type="url" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="Paste link here..." />
            </div>
            <div>
               <label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">Instructions (3 Sentences max)</label>
               <textarea className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white h-24" value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Instructions..." />
            </div>
            <div className="flex gap-2 mt-2">
              <button type="submit" className={`flex-1 text-black text-sm font-bold uppercase py-3 rounded-lg ${editId ? 'bg-blue-400 hover:bg-blue-300' : 'bg-white hover:bg-zinc-200'}`}>
                {editId ? 'Save Changes' : 'Save Exercise'}
              </button>
              {editId && <button type="button" onClick={cancelEdit} className="flex-1 bg-zinc-800 text-white text-sm font-bold uppercase py-3 rounded-lg hover:bg-zinc-700">Cancel</button>}
            </div>
          </form>
        </div>
        <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-6">
          <h4 className="text-amber-500 font-bold text-sm mb-2">Library Automation</h4>
          <button onClick={seedWorkoutLibrary} disabled={isGeneratingLibrary} className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase py-3 rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="mr-2"/>{isGeneratingLibrary ? 'Generating...' : 'Auto-Generate 70 Workouts'}
          </button>
          <button onClick={clearAutoExercises} disabled={isGeneratingLibrary} className="w-full bg-red-950 hover:bg-red-900 text-red-500 border border-red-900/50 text-xs font-bold uppercase py-3 rounded-lg mt-3 transition-colors">
            {isGeneratingLibrary ? 'Processing...' : 'Delete Auto-Generated'}
          </button>
        </div>
      </div>
      <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50"><h3 className="text-lg font-bold text-white">Library ({exercises.length})</h3></div>
        <div className="divide-y divide-zinc-800 max-h-[700px] overflow-y-auto">
          {exercises.map(ex => (
            <div key={ex.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/80">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center border border-zinc-800 shrink-0"><Dumbbell size={20} className="text-zinc-600" /></div>
                <div>
                  <div className="text-white font-medium">{ex.title}</div>
                  <div className="text-[10px] font-bold uppercase text-zinc-500 flex items-center mt-1">
                     {ex.category} <span className="mx-2">•</span> <Clock size={10} className="mr-1"/> {ex.duration}m <span className="mx-2">•</span> <Flame size={10} className="mr-1"/> {ex.intensity}
                  </div>
                </div>
              </div>
              <div className="flex space-x-2 shrink-0">
                <button onClick={() => startEdit(ex)} className="p-2 text-zinc-500 hover:text-blue-400 bg-zinc-900 rounded-lg"><Edit2 size={16}/></button>
                <button onClick={() => {if(db && window.confirm("Delete this?")) deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_exercises', ex.id))}} className="p-2 text-zinc-600 hover:text-red-500 bg-zinc-900 rounded-lg"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminMealManagement({ meals }) {
  const [editId, setEditId] = useState(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(MEAL_CATEGORIES[0].name);
  const [instructions, setInstructions] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isGeneratingLibrary, setIsGeneratingLibrary] = useState(false);

  const startEdit = (meal) => {
    setEditId(meal.id); setTitle(meal.title); setCategory(meal.category); setInstructions(meal.instructions || ''); setImageUrl(meal.imageUrl || '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const cancelEdit = () => {
    setEditId(null); setTitle(''); setInstructions(''); setImageUrl(''); setCategory(MEAL_CATEGORIES[0].name);
  };

  const handleSaveMeal = async (e) => {
    e.preventDefault();
    if (!title || !db) return;
    const saveId = editId || ('meal_' + Date.now());
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_meals', saveId), { 
        id: saveId, title, category, instructions, imageUrl: imageUrl || 'https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=600&q=80' 
      }, { merge: true });
      cancelEdit(); alert(editId ? "Recipe updated!" : "Meal added successfully!");
    } catch (err) { alert("Error saving meal: " + err.message); }
  };

  // HARDCODED MASS GENERATOR (100% RELIABLE)
  const seedMealLibrary = async () => {
    if (!db || !window.confirm("Instantly add 5 healthy recipes to all diet categories (30 Total)?")) return;
    setIsGeneratingLibrary(true);
    
    const templates = {
      "Keto": ["Steak & Eggs", "Avocado Bacon Bowl", "Keto Chicken Parmesan", "Garlic Butter Shrimp", "Zucchini Noodles with Pesto"],
      "Vegan": ["Lentil Soup", "Chickpea Curry", "Tofu Scramble", "Vegan Buddha Bowl", "Quinoa Salad"],
      "Carnivore": ["Ribeye Steak", "Ground Beef Patty", "Pork Belly Bits", "Lamb Chops", "Chicken Livers"],
      "Mediterranean": ["Greek Salad", "Grilled Chicken Tzatziki", "Hummus & Pita", "Baked Falafel", "Shrimp Saganaki"],
      "Pescatarian": ["Grilled Salmon", "Shrimp Tacos", "Tuna Salad", "Baked Cod", "Seafood Paella"],
      "Lenten Fasting": ["Fasolia (Bean Stew)", "Mujadara (Lentils & Rice)", "Potato Kebbeh", "Batata Harra", "Spinach Fatayer"]
    };

    const photoBanks = {
      "Keto": ["https://images.unsplash.com/photo-1473093295043-cdd812d0e601?w=600", "https://images.unsplash.com/photo-1603048297172-c92544798d5e?w=600", "https://images.unsplash.com/photo-1544025162-811114cd3543?w=600", "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600", "https://images.unsplash.com/photo-1432139555190-58524dae6a5a?w=600"],
      "Vegan": ["https://images.unsplash.com/photo-1512621776951-a57141f2eefd?w=600", "https://images.unsplash.com/photo-1490645935967-10de6ba17061?w=600", "https://images.unsplash.com/photo-1540420773420-3366772f4999?w=600", "https://images.unsplash.com/photo-1482049016688-2d3e1b311543?w=600", "https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=600"],
      "Carnivore": ["https://images.unsplash.com/photo-1600891964092-4316c288032e?w=600", "https://images.unsplash.com/photo-1544025162-811114cd3543?w=600", "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600", "https://images.unsplash.com/photo-1615937657715-bc7b4b7962c1?w=600", "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?w=600"],
      "Mediterranean": ["https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?w=600", "https://images.unsplash.com/photo-1529059997568-3d847b1154f0?w=600", "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=600", "https://images.unsplash.com/photo-1528699633788-424224dc89b5?w=600", "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600"],
      "Pescatarian": ["https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?w=600", "https://images.unsplash.com/photo-1559742811-822873691df8?w=600", "https://images.unsplash.com/photo-1498654896293-37aacf113fd9?w=600", "https://images.unsplash.com/photo-1599084990807-3344d3148963?w=600", "https://images.unsplash.com/photo-1615141982883-c7da0e698b0b?w=600"],
      "Lenten Fasting": ["https://images.unsplash.com/photo-1546069901-ba9599a7e63c?w=600", "https://images.unsplash.com/photo-1511690656952-34342bb7c2f2?w=600", "https://images.unsplash.com/photo-1520072959219-c595dc870360?w=600", "https://images.unsplash.com/photo-1542528180-a1208c5169a5?w=600", "https://images.unsplash.com/photo-1505253716362-afaea1d3d1af?w=600"]
    };

    const recipeText = `Ingredients:\n- 1 main protein/base\n- 2 cups fresh vegetables\n- 1 tbsp healthy fats (olive oil/avocado)\n- Spices to taste\n\nDirections:\n1. Prep ingredients and heat your pan.\n2. Cook the base until done.\n3. Serve fresh and enjoy your healthy meal!`;

    try {
      let catIndex = 0;
      for (const cat of MEAL_CATEGORIES) {
        for (let i = 0; i < 5; i++) { 
          const id = `meal_auto_${cat.name.replace(/\s+/g, '')}_${i}_${Date.now()}`;
          const assignedImage = photoBanks[cat.name][i % photoBanks[cat.name].length];
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_meals', id), {
            id: id, title: templates[cat.name][i], category: cat.name, instructions: recipeText, imageUrl: assignedImage
          });
        }
        catIndex++;
      }
      alert(`Success! Generated 30 healthy meals.`);
    } catch (err) { alert("Error generating meals: " + err.message); }
    setIsGeneratingLibrary(false);
  };

  const clearAutoMeals = async () => {
    if (!db) return;
    const confirmDelete = window.confirm("WARNING: Are you absolutely sure you want to PERMANENTLY DELETE all auto-generated meals?");
    if (!confirmDelete) return;

    setIsGeneratingLibrary(true);
    try {
      const autoMeals = meals.filter(m => m.id.includes('meal_auto_'));
      for (const meal of autoMeals) {
        await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_meals', meal.id));
      }
      alert(`Successfully deleted ${autoMeals.length} auto-generated meals.`);
    } catch (err) { alert("Error deleting: " + err.message); }
    setIsGeneratingLibrary(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="space-y-6">
        <div className={`border rounded-xl p-6 transition-colors ${editId ? 'bg-zinc-900 border-emerald-500/50' : 'bg-zinc-950 border-zinc-800'}`}>
          <h3 className="text-lg font-bold text-white mb-6 flex items-center">
             {editId ? <Edit2 size={18} className="mr-2 text-emerald-400"/> : <ChefHat size={18} className="mr-2 text-zinc-400"/>}
             {editId ? 'Edit Recipe' : 'Add Recipe'}
          </h3>
          <form onSubmit={handleSaveMeal} className="space-y-4">
            <input type="text" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white" value={title} onChange={e => setTitle(e.target.value)} required placeholder="Recipe Name" />
            <select className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white" value={category} onChange={e => setCategory(e.target.value)}>
              {MEAL_CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
            <input type="url" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white" value={imageUrl} onChange={e => setImageUrl(e.target.value)} placeholder="Photo URL" />
            <textarea className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white h-48" value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Full Recipe Directions..." />
            
            <div className="flex gap-2 mt-2">
              <button type="submit" className={`flex-1 text-white text-sm font-bold uppercase py-3 rounded-lg ${editId ? 'bg-emerald-500 hover:bg-emerald-400' : 'bg-emerald-600 hover:bg-emerald-500'}`}>
                {editId ? 'Save Changes' : 'Save Recipe'}
              </button>
              {editId && <button type="button" onClick={cancelEdit} className="flex-1 bg-zinc-800 text-white text-sm font-bold uppercase py-3 rounded-lg hover:bg-zinc-700">Cancel</button>}
            </div>
          </form>
        </div>
        <div className="bg-emerald-950/20 border border-emerald-900/50 rounded-xl p-6">
          <h4 className="text-emerald-500 font-bold text-sm mb-2">Library Automation</h4>
          <button onClick={seedMealLibrary} disabled={isGeneratingLibrary} className="w-full bg-emerald-700 hover:bg-emerald-600 text-white text-xs font-bold uppercase py-3 rounded-lg flex items-center justify-center">
            <Sparkles size={14} className="mr-2"/>{isGeneratingLibrary ? 'Processing...' : 'Auto-Generate 30 Meals'}
          </button>
          <button onClick={clearAutoMeals} disabled={isGeneratingLibrary} className="w-full bg-red-950 hover:bg-red-900 text-red-500 border border-red-900/50 text-xs font-bold uppercase py-3 rounded-lg mt-3 transition-colors">
            {isGeneratingLibrary ? 'Processing...' : 'Delete Auto-Generated'}
          </button>
        </div>
      </div>
      <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50"><h3 className="text-lg font-bold text-white">Recipe Library ({meals.length})</h3></div>
        <div className="divide-y divide-zinc-800 max-h-[700px] overflow-y-auto">
          {meals.map(m => (
            <div key={m.id} className="p-4 flex items-center justify-between hover:bg-zinc-900/80">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-black rounded-lg overflow-hidden border border-zinc-800 shrink-0">
                  <img src={m.imageUrl} className="w-full h-full object-cover"/>
                </div>
                <div>
                  <div className="text-white font-medium">{m.title}</div>
                  <div className="text-[10px] font-bold uppercase text-emerald-500">{m.category}</div>
                </div>
              </div>
              <div className="flex space-x-2">
                <button onClick={() => startEdit(m)} className="p-2 text-zinc-500 hover:text-emerald-400 bg-zinc-900 rounded-lg"><Edit2 size={16}/></button>
                <button onClick={() => {if(db && window.confirm("Delete this?")) deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_meals', m.id))}} className="p-2 text-zinc-600 hover:text-red-500 bg-zinc-900 rounded-lg"><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminAnalytics({ clients, logs, feedbacks }) {
  const [selectedUserId, setSelectedUserId] = useState(clients[0]?.id || null);
  const [coachNote, setCoachNote] = useState('');
  
  const selectedUser = clients.find(c => c.id === selectedUserId);
  const userLogs = logs.filter(l => l.userId === selectedUserId).sort((a,b) => new Date(a.date) - new Date(b.date)); 
  const userFeedbacks = feedbacks.filter(f => f.userId === selectedUserId).sort((a,b) => b.timestamp - a.timestamp);

  useEffect(() => { if (selectedUser) setCoachNote(selectedUser.coachNote || ''); }, [selectedUser]);

  const handleSaveNote = async () => {
    if (!db || !selectedUser) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', selectedUser.id), { 
        ...selectedUser, coachNote, coachNoteTimestamp: Date.now() 
      }, { merge: true });
      alert("Note sent! It will disappear from their screen in 24 hours.");
    } catch(err) { alert("Error saving note."); }
  };

  // Weekly calculations
  const last7DaysLogs = [...userLogs].reverse().slice(0, 7);
  const weeklyWorkouts = last7DaysLogs.reduce((acc, log) => acc + (log.exercises?.length || 0), 0);
  const weeklyWater = last7DaysLogs.reduce((acc, log) => acc + Number(log.water || 0), 0);
  const weeklySleep = last7DaysLogs.reduce((acc, log) => acc + Number(log.sleep || 0), 0);
  const avgSleep = last7DaysLogs.length > 0 ? (weeklySleep / last7DaysLogs.length).toFixed(1) : 0;

  const chartLogs = userLogs.filter(l => l.weightLog > 0).slice(-10);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 overflow-y-auto max-h-[600px]">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 px-2">Select Client</h3>
        <div className="space-y-1">
          {clients.map(c => (
            <button key={c.id} onClick={() => setSelectedUserId(c.id)} className={`w-full text-left px-4 py-3 rounded-lg flex items-center space-x-3 ${selectedUserId === c.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'}`}>
              <div className="w-6 h-6 rounded-full bg-black border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                {c.profile?.photo ? <img src={c.profile.photo} className="w-full h-full object-cover"/> : <User size={12}/>}
              </div>
              <span className="truncate text-sm">{c.profile?.firstName ? `${c.profile.firstName} ${c.profile.lastName}` : c.username}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-3 space-y-6">
        {selectedUser ? (
          <>
            <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl border-l-4 border-l-amber-500">
              <h3 className="text-sm font-bold text-white flex items-center mb-3 uppercase tracking-widest"><MessageSquare size={16} className="mr-2 text-amber-500"/> Direct Coach Note <span className="text-zinc-500 text-[10px] ml-2">(24h Expiry)</span></h3>
              <textarea className="w-full bg-black border border-zinc-800 rounded-lg p-4 text-sm text-white focus:border-amber-500/50 outline-none mb-3 min-h-[100px]" value={coachNote} onChange={e => setCoachNote(e.target.value)} placeholder="Write an encouraging note..." />
              <button onClick={handleSaveNote} className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase px-6 py-2 rounded-lg">Pin to Client Home</button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
                <div className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-1 flex items-center"><Calendar size={12} className="mr-1"/> 7-Day Workouts</div>
                <div className="text-3xl font-light text-white">{weeklyWorkouts}</div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
                <div className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-1 flex items-center"><Droplets size={12} className="mr-1"/> 7-Day Water</div>
                <div className="text-3xl font-light text-white">{weeklyWater} <span className="text-sm text-zinc-500">L</span></div>
              </div>
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-5">
                <div className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-1 flex items-center"><Moon size={12} className="mr-1"/> Avg Sleep</div>
                <div className="text-3xl font-light text-white">{avgSleep} <span className="text-sm text-zinc-500">Hrs</span></div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Daily Log List */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col max-h-[400px]">
                 <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 shrink-0"><h3 className="text-sm font-bold text-white uppercase tracking-widest">Full Activity Log</h3></div>
                 <div className="p-4 space-y-3 overflow-y-auto flex-1">
                   {[...userLogs].reverse().map(log => (
                     <div key={log.id} className="bg-black p-4 rounded-xl border border-zinc-800/50">
                       <div className="flex justify-between items-start mb-3 border-b border-zinc-900 pb-2">
                         <div className="text-xs font-bold text-white flex items-center"><Calendar size={12} className="mr-2 text-zinc-500"/> {log.date}</div>
                         <div className="text-[10px] font-bold text-zinc-500 bg-zinc-900 px-2 py-1 rounded">{log.hoursTrained} hrs</div>
                       </div>
                       <div className="flex gap-4 mb-3 pt-1">
                          <div className={`flex items-center text-[10px] font-bold text-blue-400`}><Droplets size={12} className="mr-1"/> {log.water || 0} L</div>
                          <div className={`flex items-center text-[10px] font-bold text-amber-400`}><PersonStanding size={12} className="mr-1"/> {log.stretch || 0} Min</div>
                          <div className={`flex items-center text-[10px] font-bold text-purple-400`}><Moon size={12} className="mr-1"/> {log.sleep || 0} Hrs</div>
                       </div>
                       {log.food && <div className="text-[10px] text-zinc-400 bg-zinc-900/50 p-2 rounded"><strong className="text-white">Diet:</strong> {log.food}</div>}
                     </div>
                   ))}
                   {userLogs.length === 0 && <div className="text-center text-zinc-500 text-sm py-8">No activity recorded yet.</div>}
                 </div>
              </div>

              {/* Feedback List */}
              <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden flex flex-col max-h-[400px]">
                 <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50 shrink-0"><h3 className="text-sm font-bold text-white uppercase tracking-widest">Exercise Feedback</h3></div>
                 <div className="p-4 space-y-3 overflow-y-auto flex-1">
                   {userFeedbacks.map(fb => (
                     <div key={fb.id} className="bg-black p-4 rounded-xl border border-zinc-800/50 flex items-start justify-between">
                       <div>
                         <div className="text-xs font-bold text-white mb-1">{fb.exerciseTitle}</div>
                         <div className="text-[10px] text-zinc-500 font-mono">{new Date(fb.timestamp).toLocaleDateString()}</div>
                       </div>
                       <div className={`px-3 py-1 rounded flex items-center text-[10px] font-bold uppercase tracking-widest ${fb.rating === 'Enjoyed' ? 'bg-emerald-950/50 text-emerald-500' : 'bg-red-950/50 text-red-500'}`}>
                         {fb.rating === 'Enjoyed' ? <ThumbsUp size={12} className="mr-1"/> : <ThumbsDown size={12} className="mr-1"/>} {fb.rating}
                       </div>
                     </div>
                   ))}
                   {userFeedbacks.length === 0 && <div className="text-center text-zinc-500 text-sm py-8">No feedback submitted yet.</div>}
                 </div>
              </div>
            </div>

          </>
        ) : <div className="text-zinc-500 p-12 text-center">Select a client</div>}
      </div>
    </div>
  );
}

// --- USER DASHBOARD (WITH BOTTOM NAV) ---
function UserDashboard({ user, users, exercises, meals, logs, sessionStartTime }) {
  const [activeTab, setActiveTab] = useState('home'); 
  const [targetWorkoutCat, setTargetWorkoutCat] = useState(null);

  const goToWorkout = (category) => {
    setTargetWorkoutCat(category);
    setActiveTab('workouts');
  };

  return (
    <>
      <div className="pb-8 animate-in fade-in duration-500">
        {activeTab === 'home' && <UserHome user={user} logs={logs} exercises={exercises} goToWorkout={goToWorkout} setActiveTab={setActiveTab} sessionStartTime={sessionStartTime} />}
        {activeTab === 'workouts' && <UserWorkouts exercises={exercises} user={user} preSelectedCategory={targetWorkoutCat} clearSelection={() => setTargetWorkoutCat(null)} appId={appId} db={db} />}
        {activeTab === 'meals' && <UserMeals meals={meals} />}
        {activeTab === 'journal' && <UserJournal user={user} logs={logs} appId={appId} db={db} />}
        {activeTab === 'profile' && <UserProfile user={user} logs={logs} appId={appId} db={db} />}
      </div>

      <div className="fixed bottom-0 left-0 w-full bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800 pb-safe z-50">
        <div className="flex justify-around items-center h-16 max-w-lg mx-auto px-2">
          {[
            { id: 'home', label: 'Home', icon: <Home size={20}/> },
            { id: 'workouts', label: 'Classes', icon: <Dumbbell size={20}/> },
            { id: 'meals', label: 'Meals', icon: <Utensils size={20}/> },
            { id: 'journal', label: 'Journal', icon: <ClipboardList size={20}/> },
            { id: 'profile', label: 'Profile', icon: <User size={20}/> }
          ].map(tab => (
            <button 
              key={tab.id} onClick={() => { setActiveTab(tab.id); if(tab.id !== 'workouts') setTargetWorkoutCat(null); }} 
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === tab.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-400'}`}
            >
              {tab.icon}
              <span className="text-[9px] sm:text-[10px] font-bold tracking-widest uppercase">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// HOME SCREEN
function UserHome({ user, logs, exercises, goToWorkout, setActiveTab, sessionStartTime }) {
  const [time, setTime] = useState(0);
  const [isActive, setIsActive] = useState(true); 
  const userLogs = logs.filter(l => l.userId === user.id);

  // Check coach note expiration (24 hours = 86400000 ms)
  const isCoachNoteValid = user.coachNote && user.coachNoteTimestamp && (Date.now() - user.coachNoteTimestamp < 86400000);

  useEffect(() => {
    if (!sessionStartTime) return;
    const initialOffset = Date.now() - sessionStartTime;
    setTime(initialOffset);
    let interval = null;
    if (isActive) {
      interval = setInterval(() => { setTime(Date.now() - sessionStartTime); }, 1000);
    } else { clearInterval(interval); }
    return () => clearInterval(interval);
  }, [isActive, sessionStartTime]);

  const formatTime = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const h = Math.floor(totalSeconds / 3600).toString().padStart(2, '0');
    const m = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, '0');
    const s = (totalSeconds % 60).toString().padStart(2, '0');
    return `${h}:${m}:${s}`;
  };

  const today = new Date();
  const dailyCatIndex = (today.getFullYear() + today.getMonth() + today.getDate()) % CATEGORIES.length;
  const dailyCategory = CATEGORIES[dailyCatIndex];

  // Specific dynamic routine mapped uniquely from the Daily Focus
  const fullBodyRoutines = [
    { title: "Build Muscle", img: "https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=600&q=80", cat: "Fitness" },
    { title: "Full Body Power", img: "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=600&q=80", cat: "Crossfit" },
    { title: "Core Crusher", img: "https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?auto=format&fit=crop&w=600&q=80", cat: "Functional flow" },
    { title: "Combat Endurance", img: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=600&q=80", cat: "Tae bo" }
  ];
  const wotd = fullBodyRoutines[(dailyCatIndex + 1) % fullBodyRoutines.length]; 

  return (
    <div className="space-y-6 max-w-md mx-auto w-full pt-2">
      <div className="flex items-center justify-between mb-2 px-2">
        <div>
          <h1 className="text-2xl font-bold text-white">Hi, {user.profile?.firstName || user.username}</h1>
          <p className="text-zinc-500 text-[10px] font-bold uppercase tracking-widest">Let's crush it today.</p>
        </div>
        <div className="w-12 h-12 bg-zinc-900 rounded-full border border-zinc-700 overflow-hidden flex items-center justify-center">
          {user.profile?.photo ? <img src={user.profile.photo} className="w-full h-full object-cover"/> : <User size={20} className="text-zinc-500"/>}
        </div>
      </div>

      <div className="bg-zinc-900/50 border border-zinc-800 rounded-2xl p-4 flex items-center justify-between">
         <div className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${isActive ? 'bg-red-500 animate-pulse' : 'bg-zinc-600'}`}></div>
            <div className="text-2xl font-mono text-white tracking-wider">{formatTime(time)}</div>
         </div>
         <div className="flex space-x-2">
            <button onClick={() => setIsActive(!isActive)} className="w-10 h-10 rounded-full bg-white text-black flex items-center justify-center hover:bg-zinc-200">
               {isActive ? <Pause size={18}/> : <Play size={18} className="ml-1"/>}
            </button>
            <button onClick={() => { setIsActive(false); setTime(0); }} className="w-10 h-10 rounded-full bg-zinc-800 text-white flex items-center justify-center hover:bg-zinc-700">
               <RotateCcw size={16}/>
            </button>
         </div>
      </div>

      {isCoachNoteValid && (
        <div className="bg-amber-950/20 border border-amber-900/50 rounded-2xl p-5 relative animate-in fade-in">
          <div className="flex items-center text-amber-500 mb-2"><MessageSquare size={16} className="mr-2"/><span className="text-[10px] font-bold tracking-widest uppercase">Coach Note</span></div>
          <p className="text-amber-100/90 text-sm leading-relaxed whitespace-pre-wrap">{user.coachNote}</p>
        </div>
      )}

      {/* Daily Focus Box */}
      <div onClick={() => goToWorkout(dailyCategory.name)} className="relative h-32 rounded-2xl overflow-hidden cursor-pointer shadow-lg border border-zinc-800 group">
        <div className="absolute inset-0 bg-black/50 group-hover:bg-black/30 transition-colors z-10"></div>
        <img src={dailyCategory.img} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
        <div className="absolute inset-0 z-20 flex flex-col justify-center p-6">
          <span className="bg-white text-black text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest w-fit mb-2">Daily Focus</span>
          <h3 className="text-2xl font-bold text-white uppercase tracking-widest drop-shadow-lg">{dailyCategory.name}</h3>
        </div>
      </div>

      {/* Full Body Power Box */}
      <div className="relative h-40 rounded-2xl overflow-hidden shadow-lg border border-red-900/50 group bg-red-950 flex flex-col justify-end p-5">
        <img src={wotd.img} className="absolute inset-0 w-full h-full object-cover opacity-40 group-hover:scale-105 transition-transform duration-500 mix-blend-overlay" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 to-transparent z-10"></div>
        <div className="relative z-20">
          <h3 className="text-2xl font-bold text-white uppercase tracking-widest mb-3">{wotd.title}</h3>
          <button onClick={() => goToWorkout(wotd.cat)} className="w-full bg-red-600 hover:bg-red-500 text-white text-xs font-bold uppercase py-3 rounded-xl transition-colors">Start Routine</button>
        </div>
      </div>

      {/* Analytics & Meals Small Boxes */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-black border border-zinc-800 rounded-2xl p-5 flex flex-col justify-between">
           <Activity size={24} className="text-zinc-600 mb-4"/>
           <div>
             <div className="text-3xl font-light text-white">{userLogs.reduce((acc, log) => acc + (Number(log.hoursTrained) || 0), 0)} <span className="text-sm text-zinc-500">hrs</span></div>
             <div className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Time Trained</div>
           </div>
        </div>
        <div onClick={() => setActiveTab('meals')} className="bg-gradient-to-br from-emerald-950/40 to-black border border-emerald-900/30 rounded-2xl p-5 flex flex-col justify-between cursor-pointer group">
           <ChefHat size={24} className="text-emerald-500 mb-4 group-hover:scale-110 transition-transform"/>
           <div>
             <div className="text-lg font-bold text-white mb-1">Nutrition</div>
             <div className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest">Healthy Meals</div>
           </div>
        </div>
      </div>
    </div>
  );
}

function UserMeals({ meals }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [activeMeal, setActiveMeal] = useState(null); 

  const categoryMeals = meals.filter(m => m.category === selectedCategory);

  if (activeMeal) {
    return (
      <div className="fixed inset-0 z-[100] bg-black overflow-y-auto animate-in fade-in slide-in-from-bottom-8">
         <div className="relative h-64 sm:h-80 w-full bg-zinc-900">
            <button onClick={() => setActiveMeal(null)} className="absolute top-6 left-4 z-10 bg-black/50 backdrop-blur-md p-3 rounded-full text-white hover:bg-black/80">
              <ArrowLeft size={20}/>
            </button>
            <img src={activeMeal.imageUrl} className="w-full h-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent"></div>
            <div className="absolute bottom-6 left-6 right-6">
               <span className="text-emerald-500 text-[10px] font-bold uppercase tracking-widest mb-2 block">{activeMeal.category} Recipe</span>
               <h2 className="text-3xl font-bold text-white leading-tight">{activeMeal.title}</h2>
            </div>
         </div>
         <div className="max-w-3xl mx-auto p-6 pb-24">
            <h3 className="text-sm font-bold text-white uppercase tracking-widest mb-4 flex items-center"><ChefHat size={16} className="mr-2 text-emerald-500"/> Instructions</h3>
            <div className="text-zinc-300 whitespace-pre-wrap leading-relaxed bg-zinc-950 border border-zinc-800 p-6 rounded-2xl text-sm">
              {activeMeal.instructions}
            </div>
         </div>
      </div>
    );
  }

  if (selectedCategory) {
    return (
      <div className="space-y-6 animate-in fade-in max-w-5xl mx-auto pt-2">
        <button onClick={() => setSelectedCategory(null)} className="flex items-center text-sm font-bold uppercase tracking-widest text-zinc-400 hover:text-white group">
          <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back
        </button>
        <div className="border-b border-zinc-800 pb-4">
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest">{selectedCategory}</h2>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-2">
          {categoryMeals.length > 0 ? categoryMeals.map(meal => (
            <div key={meal.id} onClick={() => setActiveMeal(meal)} className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden flex flex-col shadow-xl cursor-pointer hover:border-emerald-500/50 transition-colors group">
               <div className="h-32 w-full bg-zinc-900 relative">
                  <img src={meal.imageUrl} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"/>
               </div>
               <div className="p-4">
                  <h4 className="text-sm font-bold text-white leading-tight">{meal.title}</h4>
               </div>
            </div>
          )) : (
            <div className="col-span-full py-20 text-center text-zinc-500 bg-zinc-950/50 rounded-3xl border border-dashed border-zinc-800">No recipes found for this diet yet.</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto w-full pt-4">
      <h2 className="text-xl font-bold text-white mb-6 tracking-wide text-center uppercase">Meal Prep Plans</h2>
      <div className="grid grid-cols-1 gap-4">
        {MEAL_CATEGORIES.map(cat => (
          <div key={cat.name} onClick={() => setSelectedCategory(cat.name)} className="relative h-32 rounded-3xl overflow-hidden cursor-pointer shadow-lg border border-zinc-800 group">
            <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-colors z-10"></div>
            <img src={cat.img} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 z-20 flex flex-col justify-center p-6 text-left">
              <h3 className="text-xl font-bold text-white uppercase tracking-widest drop-shadow-lg">{cat.name}</h3>
              <div className="text-[10px] font-bold tracking-widest uppercase text-emerald-400 mt-2 flex items-center"><Utensils size={12} className="mr-2"/> View Recipes</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function UserWorkouts({ exercises, user, preSelectedCategory, clearSelection, appId, db }) {
  const [selectedCategory, setSelectedCategory] = useState(preSelectedCategory || null);
  const categoryExercises = exercises.filter(e => e.category === selectedCategory);

  useEffect(() => { if (preSelectedCategory) setSelectedCategory(preSelectedCategory); }, [preSelectedCategory]);

  if (selectedCategory) {
    return (
      <div className="space-y-6 animate-in fade-in max-w-5xl mx-auto pt-2">
        <button onClick={() => { setSelectedCategory(null); clearSelection(); }} className="flex items-center text-sm font-bold uppercase tracking-widest text-zinc-400 hover:text-white group">
          <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back
        </button>
        <div className="border-b border-zinc-800 pb-4">
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest">{selectedCategory}</h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {categoryExercises.map(ex => <ExerciseCard key={ex.id} exercise={ex} user={user} appId={appId} db={db} />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto w-full pt-4">
      <h2 className="text-xl font-bold text-white mb-6 tracking-wide text-center uppercase">Choose Workout</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATEGORIES.map(cat => (
          <div key={cat.name} onClick={() => setSelectedCategory(cat.name)} className="group relative h-40 rounded-3xl overflow-hidden cursor-pointer shadow-lg border border-zinc-800">
            <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-colors z-10"></div>
            <img src={cat.img} alt={cat.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
              <h3 className="text-xl font-bold text-white uppercase tracking-widest drop-shadow-lg">{cat.name}</h3>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function ExerciseCard({ exercise, user, appId, db }) {
  const [sets, setSets] = useState(1);
  const [reps, setReps] = useState(5);
  const [tips, setTips] = useState('');
  const [isLoadingTips, setIsLoadingTips] = useState(false);
  const [feedbackSent, setFeedbackSent] = useState(false);

  const handleGetTips = async () => {
    if (tips) { setTips(''); return; }
    setIsLoadingTips(true);
    const prompt = `Give me 3 quick, bulleted pro-tips on proper form and 1 common mistake to avoid for: "${exercise.title}". Keep it extremely brief.`;
    const res = await generateAIFeedback(prompt, "You are an elite personal trainer focusing on safe form.");
    setTips(res);
    setIsLoadingTips(false);
  };

  const sendFeedback = async (rating) => {
    if (!db || feedbackSent) return;
    try {
      const fbId = `fb_${user.id}_${Date.now()}`;
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_feedbacks', fbId), {
        id: fbId, userId: user.id, userName: user.username, exerciseId: exercise.id, exerciseTitle: exercise.title, rating, timestamp: Date.now()
      });
      setFeedbackSent(true);
      alert(`Feedback recorded: ${rating}`);
    } catch(err) { console.error("Feedback error", err); }
  };

  const renderVideo = () => {
    if (!exercise.videoUrl) return <div className="flex flex-col items-center justify-center text-zinc-700 h-full w-full absolute inset-0"><Video size={40} className="mb-3 opacity-30" /><span className="text-xs uppercase tracking-widest font-bold">No Video</span></div>;
    let url = exercise.videoUrl.replace('EMBED:', '').replace('DIRECT:', '');
    if (url.includes('youtube') || url.includes('youtu.be')) {
      const ytMatch = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
      if (ytMatch && ytMatch[2].length === 11) url = `https://www.youtube.com/embed/${ytMatch[2]}`;
      return <iframe src={url} className="w-full h-full absolute inset-0 border-0" allowFullScreen></iframe>;
    }
    return <video src={url} controls className="w-full h-full absolute inset-0 object-cover"></video>;
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden flex flex-col">
      <div className="aspect-video bg-black relative flex items-center justify-center border-b border-zinc-800 group overflow-hidden">
        {renderVideo()}
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <h4 className="text-lg font-bold text-white leading-tight">{exercise.title}</h4>
        
        {/* Intensity & Duration Tags */}
        <div className="flex items-center mt-2 mb-4 space-x-3 text-[10px] font-bold uppercase tracking-widest text-zinc-500">
           <span className="flex items-center text-amber-500"><Flame size={12} className="mr-1"/> {exercise.intensity || 'High'} Intensity</span>
           <span className="text-zinc-700">•</span>
           <span className="flex items-center"><Clock size={12} className="mr-1"/> {exercise.duration || 15} Mins</span>
        </div>

        {exercise.instructions && <div className="mb-4 p-4 bg-zinc-900/50 rounded-xl text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed">{exercise.instructions}</div>}
        
        {/* Feedback Buttons */}
        <div className="flex space-x-2 mb-6">
           <button onClick={() => sendFeedback('Enjoyed')} disabled={feedbackSent} className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase py-2 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"><ThumbsUp size={12} className="mr-1"/> Enjoyed</button>
           <button onClick={() => sendFeedback('Not Much')} disabled={feedbackSent} className="flex-1 bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-[10px] font-bold uppercase py-2 rounded-lg flex items-center justify-center transition-colors disabled:opacity-50"><ThumbsDown size={12} className="mr-1"/> Not Much</button>
        </div>

        {tips && (
          <div className="mb-4 p-4 bg-amber-950/20 border border-amber-900/30 rounded-xl text-xs text-zinc-300 whitespace-pre-wrap animate-in fade-in">
             <strong className="text-amber-500 block mb-2 font-bold uppercase tracking-widest">Coach's Form Tips</strong>
             {tips}
          </div>
        )}

        <button onClick={handleGetTips} disabled={isLoadingTips} className="text-[10px] font-bold tracking-widest uppercase text-amber-500 hover:text-amber-400 flex items-center mb-6 disabled:opacity-50 transition-colors">
          <Sparkles size={12} className="mr-1"/> {isLoadingTips ? 'Consulting...' : tips ? 'Hide Tips' : '✨ AI Coach Tips'}
        </button>

        <div className="mt-auto">
          <div className="grid grid-cols-2 gap-3 mb-4">
             <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Sets</label>
                <select value={sets} onChange={e => setSets(e.target.value)} className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm outline-none">
                   <option value={1}>1 Set</option>
                   <option value={2}>2 Sets</option>
                   <option value={3}>3 Sets</option>
                </select>
             </div>
             <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Reps</label>
                <select value={reps} onChange={e => setReps(e.target.value)} className="w-full bg-black border border-zinc-800 text-white rounded-xl p-3 text-sm outline-none">
                   <option value={5}>5 Reps</option>
                   <option value={10}>10 Reps</option>
                   <option value={15}>15 Reps</option>
                </select>
             </div>
          </div>
          <button onClick={() => alert("Great job! Keep the momentum going.")} className="w-full bg-white text-black text-sm font-bold uppercase tracking-widest py-4 rounded-xl hover:bg-zinc-200 transition-colors">Mark as Done</button>
        </div>
      </div>
    </div>
  );
}

function UserJournal({ user, logs, appId, db }) {
  const todayDate = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayDate);
  const existingLog = logs.find(l => l.userId === user.id && l.date === date);
  const [food, setFood] = useState('');
  const [hours, setHours] = useState('');
  const [water, setWater] = useState('');
  const [stretch, setStretch] = useState('');
  const [sleep, setSleep] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    setFood(existingLog?.food || ''); setHours(existingLog?.hoursTrained || '');
    setWater(existingLog?.water || ''); setStretch(existingLog?.stretch || ''); setSleep(existingLog?.sleep || '');
    setAiAnalysis('');
  }, [date, existingLog]);

  const handleAnalyzeDiet = async () => {
    if (!food) return alert("Please add some nutrition notes first!");
    setIsAnalyzing(true);
    const prompt = `Analyze this daily food log: "${food}". Give a brief 3-bullet summary: 1. Quality, 2. Praise, 3. Suggestion.`;
    const response = await generateAIFeedback(prompt, "You are a professional nutritionist. Keep responses concise.");
    setAiAnalysis(response);
    setIsAnalyzing(false);
  };

  const handleSave = async () => {
    if (!db) return;
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_logs', `log_${user.id}_${date}`), {
        id: `log_${user.id}_${date}`, userId: user.id, date, food, 
        hoursTrained: Number(hours), water: Number(water), stretch: Number(stretch), sleep: Number(sleep), 
        weightLog: user.profile?.weight || 0
      });
      alert('Journal entry safely stored in the cloud.');
    } catch (err) { alert("Error saving: " + err.message); }
    setIsSaving(false);
  };

  return (
    <div className="max-w-md mx-auto w-full pt-4 space-y-6">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
        <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
          <h3 className="text-xl font-bold text-white tracking-wide">Daily Log</h3>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-black border border-zinc-800 text-xs font-mono text-zinc-300 rounded-lg px-3 py-2 outline-none" />
        </div>
        <div className="space-y-6">
          
          <div>
             <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-3">Daily Habits</label>
             <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl border bg-black border-zinc-800 group focus-within:border-blue-500/50 transition-colors">
                   <Droplets size={20} className="mb-2 text-blue-500"/>
                   <div className="flex items-center text-white font-mono border-b border-zinc-700 focus-within:border-blue-500 pb-1">
                      <input type="number" min="0" step="0.1" value={water} onChange={e => setWater(e.target.value)} placeholder="0" className="w-8 bg-transparent text-center outline-none text-sm"/>
                      <span className="text-[10px] text-zinc-500 font-bold ml-1">L</span>
                   </div>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl border bg-black border-zinc-800 group focus-within:border-amber-500/50 transition-colors">
                   <PersonStanding size={20} className="mb-2 text-amber-500"/>
                   <div className="flex items-center text-white font-mono border-b border-zinc-700 focus-within:border-amber-500 pb-1">
                      <input type="number" min="0" value={stretch} onChange={e => setStretch(e.target.value)} placeholder="0" className="w-8 bg-transparent text-center outline-none text-sm"/>
                      <span className="text-[10px] text-zinc-500 font-bold ml-1">MIN</span>
                   </div>
                </div>
                <div className="flex flex-col items-center justify-center p-3 rounded-2xl border bg-black border-zinc-800 group focus-within:border-purple-500/50 transition-colors">
                   <Moon size={20} className="mb-2 text-purple-500"/>
                   <div className="flex items-center text-white font-mono border-b border-zinc-700 focus-within:border-purple-500 pb-1">
                      <input type="number" min="0" step="0.5" value={sleep} onChange={e => setSleep(e.target.value)} placeholder="0" className="w-8 bg-transparent text-center outline-none text-sm"/>
                      <span className="text-[10px] text-zinc-500 font-bold ml-1">HRS</span>
                   </div>
                </div>
             </div>
          </div>

          <div>
             <div className="flex items-center justify-between mb-3">
               <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase">Nutrition Notes</label>
               <button onClick={handleAnalyzeDiet} disabled={isAnalyzing || !food} className="text-[10px] font-bold tracking-widest uppercase text-emerald-500 hover:text-emerald-400 flex items-center disabled:opacity-50 transition-colors">
                 <Sparkles size={12} className="mr-1"/> {isAnalyzing ? 'Analyzing...' : 'AI Analyze'}
               </button>
             </div>
             <textarea className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-sm text-white min-h-[100px] outline-none" placeholder="Meals, snacks, macros..." value={food} onChange={e => setFood(e.target.value)}></textarea>
             {aiAnalysis && (
               <div className="mt-3 p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl text-xs text-zinc-300 whitespace-pre-wrap animate-in fade-in">
                 <strong className="text-emerald-500 block mb-2 font-bold uppercase tracking-widest">AI Nutritionist</strong>
                 {aiAnalysis}
               </div>
             )}
          </div>
          
          <div>
            <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-3">Training Hours</label>
            <div className="flex items-center text-white font-mono border border-zinc-800 rounded-2xl p-4 bg-black focus-within:border-zinc-500 transition-colors">
              <input type="number" step="0.5" min="0" className="w-full bg-transparent outline-none text-sm" placeholder="e.g. 1.5" value={hours} onChange={e => setHours(e.target.value)} />
              <span className="text-xs text-zinc-500 font-bold ml-2">HRS</span>
            </div>
          </div>

          <button onClick={handleSave} disabled={isSaving} className="w-full bg-white text-black text-sm font-bold uppercase tracking-widest py-4 rounded-xl hover:bg-zinc-200 transition-colors">
            {isSaving ? 'Saving...' : 'Commit to Log'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserProfile({ user, logs, appId, db }) {
  const [profile, setProfile] = useState({ fitnessGoal: FITNESS_GOALS[0], ...user.profile });
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef(null);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!db) return;
    setIsUpdating(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', user.id), { ...user, profile }, { merge: true });
      alert('Profile synced! Make sure to log your Journal today to chart this weight.');
    } catch (err) { alert("Error updating: " + err.message); }
    setIsUpdating(false);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 800000) return alert("Photo too large! Please choose a smaller image.");
    const reader = new FileReader();
    reader.onloadend = async () => {
      const base64String = reader.result;
      setProfile(prev => ({ ...prev, photo: base64String }));
      if (db) await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', user.id), { ...user, profile: { ...profile, photo: base64String } }, { merge: true });
    };
    reader.readAsDataURL(file);
  };

  const userLogs = logs.filter(l => l.userId === user.id);
  const chartLogs = [...userLogs].filter(l => l.weightLog && l.weightLog > 0).sort((a,b) => new Date(a.date) - new Date(b.date)).slice(-7); 

  // Achievement Logic
  const last7DaysLogs = [...userLogs].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0, 7);
  const isHydrated = last7DaysLogs.reduce((acc, log) => acc + Number(log.water || 0), 0) >= 14; // Avg 2L/day
  const isRested = last7DaysLogs.reduce((acc, log) => acc + Number(log.sleep || 0), 0) >= 49; // Avg 7hrs/day
  const isConsistent = last7DaysLogs.length >= 4;

  return (
    <div className="max-w-md mx-auto w-full pt-4 space-y-6">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6">
        <div className="flex flex-col items-center mb-8 pt-4">
          <div className="relative group cursor-pointer mb-4" onClick={() => fileInputRef.current?.click()}>
            <div className="w-28 h-28 bg-black rounded-full border-2 border-zinc-700 flex items-center justify-center overflow-hidden relative">
              {profile.photo ? <img src={profile.photo} className="w-full h-full object-cover" /> : <User size={48} className="text-zinc-700" />}
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"><Camera size={24} className="text-white"/></div>
            </div>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" />
          </div>
          <h3 className="text-2xl font-bold text-white uppercase tracking-widest">{profile.firstName ? `${profile.firstName} ${profile.lastName}` : user.username}</h3>
        </div>
        <form onSubmit={handleUpdate} className="space-y-4">
          
          <div className="mb-4">
            <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center"><Target size={12} className="mr-1"/> Fitness Goal</label>
            <select value={profile.fitnessGoal} onChange={e => setProfile({...profile, fitnessGoal: e.target.value})} className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-white outline-none">
               {FITNESS_GOALS.map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">H (M)</label><input type="number" className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-white font-mono outline-none" value={profile.heightM} onChange={e => setProfile({...profile, heightM: e.target.value})} /></div>
            <div><label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">H (CM)</label><input type="number" className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-white font-mono outline-none" value={profile.heightCm} onChange={e => setProfile({...profile, heightCm: e.target.value})} /></div>
            <div><label className="block text-[10px] font-bold text-zinc-500 uppercase mb-2">W (KG)</label><input type="number" step="0.1" className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-white font-mono outline-none" value={profile.weight} onChange={e => setProfile({...profile, weight: e.target.value})} /></div>
          </div>
          <button type="submit" disabled={isUpdating} className="w-full bg-zinc-900 text-white border border-zinc-800 text-sm font-bold uppercase tracking-widest py-4 rounded-xl mt-4">Save Profile</button>
        </form>
      </div>

      {/* ACHIEVEMENTS BOX */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 relative">
         <h4 className="text-[10px] font-bold tracking-widest text-zinc-500 mb-4 uppercase flex items-center"><Medal size={14} className="mr-2"/> Weekly Achievements</h4>
         <div className="space-y-3">
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${isConsistent ? 'bg-amber-950/20 border-amber-900/50' : 'bg-black border-zinc-800'}`}>
               <div className="flex items-center"><Flame size={16} className={`mr-3 ${isConsistent ? 'text-amber-500' : 'text-zinc-700'}`}/><span className={`text-sm font-bold tracking-wide ${isConsistent ? 'text-white' : 'text-zinc-500'}`}>Iron Discipline</span></div>
               <span className="text-[10px] font-mono text-zinc-500">4+ Workouts</span>
            </div>
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${isHydrated ? 'bg-blue-950/20 border-blue-900/50' : 'bg-black border-zinc-800'}`}>
               <div className="flex items-center"><Droplets size={16} className={`mr-3 ${isHydrated ? 'text-blue-500' : 'text-zinc-700'}`}/><span className={`text-sm font-bold tracking-wide ${isHydrated ? 'text-white' : 'text-zinc-500'}`}>Hydration Hero</span></div>
               <span className="text-[10px] font-mono text-zinc-500">2L+ / Day</span>
            </div>
            <div className={`p-4 rounded-2xl border flex items-center justify-between ${isRested ? 'bg-purple-950/20 border-purple-900/50' : 'bg-black border-zinc-800'}`}>
               <div className="flex items-center"><Moon size={16} className={`mr-3 ${isRested ? 'text-purple-500' : 'text-zinc-700'}`}/><span className={`text-sm font-bold tracking-wide ${isRested ? 'text-white' : 'text-zinc-500'}`}>Recovery Master</span></div>
               <span className="text-[10px] font-mono text-zinc-500">7hr+ / Night</span>
            </div>
         </div>
      </div>

      {/* WEIGHT HISTORY CHART */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 relative">
        <h4 className="text-[10px] font-bold tracking-widest text-zinc-500 mb-8 uppercase flex items-center"><TrendingUp size={14} className="mr-2"/> Weight Trajectory</h4>
        <div className="h-40 flex items-end justify-between space-x-2 w-full overflow-x-auto pb-4 pt-8 border-b border-zinc-900">
          {chartLogs.length > 1 ? chartLogs.map((log, i) => {
            const maxWeight = Math.max(...chartLogs.map(l => l.weightLog || 0), 100);
            const heightPercentage = ((log.weightLog || 0) / maxWeight) * 100;
            return (
              <div key={i} className="flex flex-col items-center flex-1 min-w-[30px] group relative h-full justify-end">
                <div className="absolute -top-6 opacity-0 group-hover:opacity-100 bg-white text-black font-bold font-mono text-[10px] px-2 py-1 rounded transition-opacity z-10 whitespace-nowrap">{log.weightLog} kg</div>
                <div className="w-full max-w-[30px] bg-zinc-800 group-hover:bg-zinc-500 transition-colors rounded-t" style={{ height: `${heightPercentage}%`, minHeight: '10%' }}></div>
                <span className="text-[9px] font-mono text-zinc-600 mt-2 whitespace-nowrap">{log.date.substring(5)}</span>
              </div>
            );
          }) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 text-xs absolute inset-0 px-8 text-center leading-relaxed">
              Log your weight in the Daily Journal for at least 2 days to generate your progress chart!
            </div>
          )}
        </div>
      </div>
    </div>
  );
}