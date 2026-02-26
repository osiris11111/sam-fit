import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, CheckCircle, Circle, User, Activity, LogOut, 
  Plus, Trash2, TrendingUp, Calendar, Lock, Video,
  ChevronRight, Dumbbell, ClipboardList, Settings,
  BarChart2, Camera, ArrowLeft, UploadCloud, Link as LinkIcon,
  Sparkles, Bot, Code, Lightbulb, AlertTriangle, Home,
  Droplets, Moon, PersonStanding, Clock, MessageSquare
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// --- GEMINI API CONFIG ---
const apiKey = "AIzaSyBwsnLQTWqG7YArJE4hkT8Jp27QQwUz2e4"; 

async function generateAIFeedback(prompt, systemInstruction) {
  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] }
      })
    });
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || "No insights could be generated right now.";
  } catch (err) {
    console.error(err);
    return "Error connecting to the AI Coach. Please try again later.";
  }
}

// --- MOCK CONSTANTS / CONFIG ---
const CATEGORIES = [
  { name: "Tae bo", img: "https://images.unsplash.com/photo-1555597673-b21d5c935865?auto=format&fit=crop&w=600&q=80" },
  { name: "Crossfit", img: "https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=600&q=80" },
  { name: "Body combat", img: "https://images.unsplash.com/photo-1599058917212-d750089bc07e?auto=format&fit=crop&w=600&q=80" },
  { name: "Stick mobility", img: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=600&q=80" },
  { name: "Functional flow", img: "https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?auto=format&fit=crop&w=600&q=80" },
  { name: "Fitness", img: "https://images.unsplash.com/photo-1534258936925-c58bed479fcb?auto=format&fit=crop&w=600&q=80" },
  { name: "Stretching", img: "https://images.unsplash.com/photo-1552286450-3a566f1030e2?auto=format&fit=crop&w=600&q=80" }
];

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
  const [logs, setLogs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');
  const [sessionStartTime, setSessionStartTime] = useState(null);

  useEffect(() => {
    window.alert = (msg) => {
      const el = document.createElement('div');
      el.className = 'fixed top-4 right-4 bg-zinc-900 border border-emerald-900/50 text-emerald-400 px-6 py-4 rounded-xl shadow-2xl z-[9999] font-sans text-sm tracking-wide transition-opacity duration-500';
      el.innerText = msg;
      document.body.appendChild(el);
      setTimeout(() => { el.classList.add('opacity-0'); setTimeout(() => el.remove(), 500); }, 5000); 
    };
  }, []);

  // 1. Initialize Firebase Auth
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

  // 2. Fetch Data & Auto-Login Logic
  useEffect(() => {
    if (!fbUser || !db) return;

    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'samfit_users');
    const exercisesRef = collection(db, 'artifacts', appId, 'public', 'data', 'samfit_exercises');
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'samfit_logs');

    let uLoaded = false, eLoaded = false, lLoaded = false;
    const checkLoaded = () => { if (uLoaded && eLoaded && lLoaded) setIsDbLoading(false); };

    const unsubUsers = onSnapshot(usersRef, (snap) => {
      const data = snap.docs.map(d => d.data());
      setUsers(data);
      
      // Auto-Login check (Remember Me functionality)
      if (!currentUser && fbUser) {
        const matchingUser = data.find(u => u.firebaseUid === fbUser.uid);
        if (matchingUser && matchingUser.active) {
          setCurrentUser(matchingUser);
          setSessionStartTime(Date.now());
        }
      }
      
      uLoaded = true; checkLoaded();
    });

    const unsubEx = onSnapshot(exercisesRef, (snap) => { setExercises(snap.docs.map(d => d.data())); eLoaded = true; checkLoaded(); });
    const unsubLogs = onSnapshot(logsRef, (snap) => { setLogs(snap.docs.map(d => d.data())); lLoaded = true; checkLoaded(); });

    return () => { unsubUsers(); unsubEx(); unsubLogs(); };
  }, [fbUser]); // Removed currentUser from dependencies to avoid loop

  // Auth Handlers
  const handleLogin = async (username, password, rememberMe) => {
    setAuthError('');
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      if (!user.active && user.role !== 'admin') {
        setAuthError("Your access has been revoked. Please contact the administrator.");
        return;
      }
      
      // If "Remember Me" is checked, link this device's Firebase Anonymous UID to the user profile
      if (rememberMe && fbUser && db) {
        try {
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', user.id), {
            ...user,
            firebaseUid: fbUser.uid
          }, { merge: true });
        } catch (err) { console.error("Failed to save remember me state", err); }
      }

      setCurrentUser(user);
      setSessionStartTime(Date.now());
    } else {
      setAuthError("Invalid credentials. Please check your username and password.");
    }
  };

  const handleLogout = async () => {
    // Unlink device UID so "Remember Me" is cleared
    if (currentUser && currentUser.firebaseUid && db) {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', currentUser.id), {
        ...currentUser,
        firebaseUid: null
      }, { merge: true });
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

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} error={authError} />;
  }

  return (
    <div className="min-h-screen bg-black text-zinc-200 font-sans selection:bg-zinc-700 pb-24 md:pb-8">
      {/* Top Navigation */}
      <nav className="border-b border-zinc-800 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img src="https://samfit.co/logo.png" alt="Sam Fit Logo" className="h-10 w-10 rounded-full object-cover border border-zinc-700 bg-black" onError={(e) => { e.target.style.display='none'; }} />
              <span className="text-xl font-bold tracking-[0.2em] uppercase text-white">Sam Fit</span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-zinc-400 hidden sm:block">
                Logged in as <strong className="text-zinc-100">{currentUser.role === 'admin' ? 'Admin' : currentUser.profile?.firstName || currentUser.username}</strong>
              </span>
              <button onClick={handleLogout} className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-full transition-colors border border-transparent hover:border-zinc-800">
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentUser.role === 'admin' ? (
          <AdminDashboard users={users} logs={logs} exercises={exercises} />
        ) : (
          <UserDashboard user={currentUser} users={users} exercises={exercises} logs={logs} sessionStartTime={sessionStartTime} />
        )}
      </main>
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
          
          {error && (
            <div className="bg-red-950/50 border border-red-900/50 text-red-400 text-xs font-bold tracking-widest uppercase p-4 rounded-lg mb-6 text-center animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}
          
          <form onSubmit={(e) => { e.preventDefault(); onLogin(username, password, rememberMe); }} className="space-y-5">
            <div>
              <input 
                type="text" 
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-600 text-sm"
                placeholder="USERNAME"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <input 
                type="password" 
                className="w-full bg-zinc-900/50 border border-zinc-800 rounded-xl px-4 py-4 text-white focus:outline-none focus:border-zinc-500 transition-colors placeholder-zinc-600 text-sm"
                placeholder="PASSWORD"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            
            <div className="flex items-center justify-between px-1">
              <label className="flex items-center space-x-2 cursor-pointer group">
                <div className={`w-4 h-4 rounded flex items-center justify-center border transition-colors ${rememberMe ? 'bg-white border-white' : 'bg-black border-zinc-600 group-hover:border-zinc-400'}`}>
                  {rememberMe && <CheckCircle size={12} className="text-black" />}
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
function AdminDashboard({ users, logs, exercises }) {
  const [activeTab, setActiveTab] = useState('users');
  const clients = users.filter(u => u.role === 'user');

  return (
    <div className="space-y-6">
      <div className="flex space-x-2 border-b border-zinc-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'users', label: 'Manage Clients', icon: <User size={16}/> },
          { id: 'exercises', label: 'Manage Exercises', icon: <Dumbbell size={16}/> },
          { id: 'analytics', label: 'Client Analytics', icon: <BarChart2 size={16}/> }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)} 
            className={`px-4 py-2 text-sm font-medium transition-all flex items-center space-x-2 whitespace-nowrap rounded-t-lg ${activeTab === tab.id ? 'bg-zinc-900 text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'}`}
          >
            {tab.icon} <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'users' && <AdminUserManagement users={clients} />}
      {activeTab === 'exercises' && <AdminExerciseManagement exercises={exercises} />}
      {activeTab === 'analytics' && <AdminAnalytics clients={clients} logs={logs} />}
    </div>
  );
}

function AdminUserManagement({ users }) {
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUsername || !newPassword || !db) return;
    
    const newUserId = 'user_' + Date.now();
    const newUser = {
      id: newUserId,
      username: newUsername,
      password: newPassword,
      role: 'user',
      active: true,
      coachNote: "Welcome to Sam Fit! I'm excited to help you crush your goals. Check your daily workouts and log your journals!",
      profile: { firstName: '', lastName: '', heightM: 0, heightCm: 0, weight: 0, photo: '' }
    };
    
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', newUserId), newUser);
      setNewUsername(''); setNewPassword('');
      alert("Client added successfully!");
    } catch (err) { alert("Error adding user: " + err.message); }
  };

  const toggleAccess = async (user) => {
    if (!db) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', user.id), { ...user, active: !user.active }, { merge: true });
    } catch (err) { alert("Error updating access: " + err.message); }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 h-fit relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-500 to-zinc-800"></div>
        <h3 className="text-lg font-bold text-white mb-6 flex items-center tracking-wide"><Plus size={18} className="mr-2 text-zinc-400"/> Create Client</h3>
        <form onSubmit={handleAddUser} className="space-y-4">
          <div>
            <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase mb-2">Username</label>
            <input type="text" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-zinc-500 outline-none transition-colors" value={newUsername} onChange={e => setNewUsername(e.target.value)} required placeholder="e.g. jdoe123" />
          </div>
          <div>
            <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase mb-2">Password</label>
            <input type="text" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-zinc-500 outline-none transition-colors" value={newPassword} onChange={e => setNewPassword(e.target.value)} required placeholder="Temporary password" />
          </div>
          <button type="submit" className="w-full bg-white text-black text-sm font-bold tracking-widest uppercase py-3 rounded-lg hover:bg-zinc-200 transition-colors mt-2">
            Generate Access
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h3 className="text-lg font-bold text-white tracking-wide">Client Directory</h3>
        </div>
        <div className="divide-y divide-zinc-800 max-h-[600px] overflow-y-auto">
          {users.map(u => (
            <div key={u.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-zinc-900/80 transition-colors gap-4">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border overflow-hidden shrink-0 ${u.active ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-red-950/30 border-red-900/50 text-red-500'}`}>
                  {u.profile?.photo ? <img src={u.profile.photo} className="w-full h-full object-cover"/> : (u.profile?.firstName ? u.profile.firstName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase())}
                </div>
                <div>
                  <div className="text-white font-medium flex items-center tracking-wide">
                    {u.profile?.firstName} {u.profile?.lastName} 
                    {!u.profile?.firstName && <span className="text-zinc-600 italic text-sm">Profile Pending</span>}
                  </div>
                  <div className="text-xs text-zinc-500 font-mono mt-1">User: <span className="text-zinc-300">{u.username}</span> | Pass: <span className="text-zinc-300">{u.password}</span></div>
                </div>
              </div>
              <div>
                <button onClick={() => toggleAccess(u)} className={`px-4 py-2 text-xs font-bold tracking-wider uppercase rounded-lg flex items-center w-full sm:w-auto justify-center transition-colors ${u.active ? 'bg-black text-zinc-300 border border-zinc-700 hover:bg-zinc-900 hover:text-white' : 'bg-white text-black hover:bg-zinc-200'}`}>
                  {u.active ? <Lock size={14} className="mr-2"/> : <CheckCircle size={14} className="mr-2"/>} {u.active ? 'Revoke Access' : 'Restore Access'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminExerciseManagement({ exercises }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [instructions, setInstructions] = useState('');
  const [isGeneratingLibrary, setIsGeneratingLibrary] = useState(false);

  const handleSaveExercise = async (e) => {
    e.preventDefault();
    if (!title || !db) return;

    const newExId = 'ex_' + Date.now();
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_exercises', newExId), {
        id: newExId, title, category, instructions, videoUrl: ''
      });
      setTitle(''); setInstructions('');
      alert("Exercise added successfully!");
    } catch (err) { alert("Error adding exercise: " + err.message); }
  };

  const handleDelete = async (id) => {
    if (!db || !window.confirm("Delete this exercise permanently?")) return;
    try { await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_exercises', id)); } 
    catch (err) { alert("Error deleting: " + err.message); }
  };

  // Magic 70-workout seeder
  const seedWorkoutLibrary = async () => {
    if (!db) return;
    if (!window.confirm("This will instantly add 10 pre-written workouts to all 7 categories (70 total). You can edit them later to add video links. Continue?")) return;
    
    setIsGeneratingLibrary(true);
    
    // Quick template generator
    const templates = [
      "Foundations", "Endurance Protocol", "Strength Builder", "Core Crusher", "Agility Drills", 
      "Power Moves", "Speed Intervals", "Burnout Session", "Mobility Flow", "Max Intensity"
    ];
    
    let counter = 0;
    try {
      for (const cat of CATEGORIES) {
        for (let i = 0; i < 10; i++) {
          const id = `ex_auto_${cat.name.replace(/\s+/g, '')}_${i}_${Date.now()}`;
          await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_exercises', id), {
            id: id,
            title: `${cat.name}: ${templates[i]}`,
            category: cat.name,
            instructions: `1. Warm up thoroughly.\n2. Focus on form over speed.\n3. Complete specified sets and rounds.\n4. Stay hydrated.\n\n(Coach: Edit this text and add your video link above)`,
            videoUrl: ''
          });
          counter++;
        }
      }
      alert(`Success! Generated ${counter} total exercises across all categories.`);
    } catch (err) {
      alert("Error generating library: " + err.message);
    }
    setIsGeneratingLibrary(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="space-y-6">
        <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-500 to-zinc-800"></div>
          <h3 className="text-lg font-bold text-white mb-6 flex items-center tracking-wide"><Plus size={18} className="mr-2 text-zinc-400"/> New Exercise</h3>
          <form onSubmit={handleSaveExercise} className="space-y-4">
            <div>
              <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase mb-2">Exercise Name</label>
              <input type="text" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-zinc-500 outline-none" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Kettlebell Swings" />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase mb-2">Category</label>
              <select className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-zinc-500 outline-none" value={category} onChange={e => setCategory(e.target.value)}>
                {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase mb-2">Written Instructions (Optional)</label>
              <textarea className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-zinc-500 outline-none h-24" value={instructions} onChange={e => setInstructions(e.target.value)} placeholder="Step-by-step guidance..." />
            </div>
            <button type="submit" className="w-full bg-white text-black text-sm font-bold tracking-widest uppercase py-3 rounded-lg hover:bg-zinc-200 transition-colors mt-2">Save Exercise</button>
          </form>
        </div>

        <div className="bg-amber-950/20 border border-amber-900/50 rounded-xl p-6">
          <h4 className="text-amber-500 font-bold text-sm mb-2 flex items-center"><Sparkles size={16} className="mr-2"/> Library Automation</h4>
          <p className="text-xs text-zinc-400 mb-4 leading-relaxed">Instantly populate your app with 10 structured placeholders for every category. Perfect for starting fresh.</p>
          <button 
            onClick={seedWorkoutLibrary} 
            disabled={isGeneratingLibrary}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold tracking-widest uppercase py-3 rounded-lg transition-colors disabled:opacity-50"
          >
            {isGeneratingLibrary ? 'Generating 70 Workouts...' : 'Auto-Generate Course Library'}
          </button>
        </div>
      </div>

      <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h3 className="text-lg font-bold text-white tracking-wide">Exercise Library <span className="text-zinc-500 text-sm ml-2">({exercises.length})</span></h3>
        </div>
        <div className="divide-y divide-zinc-800 max-h-[700px] overflow-y-auto">
          {exercises.map(ex => (
            <div key={ex.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-zinc-900/80 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-12 h-12 bg-black rounded-lg flex items-center justify-center border border-zinc-800 shrink-0">
                  <Dumbbell size={20} className="text-zinc-600" />
                </div>
                <div>
                  <div className="text-white font-medium tracking-wide">{ex.title}</div>
                  <div className="text-[10px] font-bold tracking-widest uppercase text-zinc-500 mt-1">{ex.category} {ex.videoUrl ? '• VIDEO ADDED' : '• NO VIDEO'}</div>
                </div>
              </div>
              <button onClick={() => handleDelete(ex.id)} className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-950/30 rounded transition-colors"><Trash2 size={18} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AdminAnalytics({ clients, logs }) {
  const [selectedUserId, setSelectedUserId] = useState(clients[0]?.id || null);
  const [coachNote, setCoachNote] = useState('');
  const [isSavingNote, setIsSavingNote] = useState(false);
  
  const selectedUser = clients.find(c => c.id === selectedUserId);
  const userLogs = logs.filter(l => l.userId === selectedUserId).sort((a,b) => new Date(b.date) - new Date(a.date));

  // Load existing note when user changes
  useEffect(() => {
    if (selectedUser) setCoachNote(selectedUser.coachNote || '');
  }, [selectedUser]);

  const handleSaveNote = async () => {
    if (!db || !selectedUser) return;
    setIsSavingNote(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', selectedUser.id), {
        ...selectedUser,
        coachNote: coachNote
      }, { merge: true });
      alert("Coach note sent to client's home screen!");
    } catch(err) { alert("Error saving note."); }
    setIsSavingNote(false);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 overflow-y-auto max-h-[600px]">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 px-2">Select Client</h3>
        <div className="space-y-1">
          {clients.map(c => (
            <button key={c.id} onClick={() => setSelectedUserId(c.id)} className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${selectedUserId === c.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'}`}>
              <div className="w-6 h-6 rounded-full bg-black border border-zinc-700 flex items-center justify-center overflow-hidden shrink-0">
                {c.profile?.photo ? <img src={c.profile.photo} className="w-full h-full object-cover"/> : <User size={12}/>}
              </div>
              <span className="truncate text-sm">{c.profile?.firstName || c.username}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="lg:col-span-3 space-y-6">
        {selectedUser ? (
          <>
            <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl border-l-4 border-l-amber-500">
              <h3 className="text-sm font-bold text-white flex items-center mb-3 uppercase tracking-widest"><MessageSquare size={16} className="mr-2 text-amber-500"/> Direct Coach Note</h3>
              <p className="text-xs text-zinc-400 mb-3">This message will appear prominently on the client's Home Screen.</p>
              <textarea 
                className="w-full bg-black border border-zinc-800 rounded-lg p-4 text-sm text-white focus:border-amber-500/50 outline-none mb-3 min-h-[100px]"
                value={coachNote} onChange={e => setCoachNote(e.target.value)} placeholder="Write an encouraging note, advice, or custom plan here..."
              />
              <button onClick={handleSaveNote} disabled={isSavingNote} className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold uppercase tracking-widest px-6 py-2 rounded-lg transition-colors">
                {isSavingNote ? 'Sending...' : 'Pin to Client Home'}
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
               <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><TrendingUp size={48}/></div>
                 <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-2">Current Weight</div>
                 <div className="text-4xl font-light text-white">{selectedUser.profile?.weight || '--'} <span className="text-sm text-zinc-500 font-normal">kg</span></div>
               </div>
               <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Activity size={48}/></div>
                 <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-2">Total Sessions</div>
                 <div className="text-4xl font-light text-white">{userLogs.length}</div>
               </div>
               <div className="bg-zinc-950 border border-zinc-800 p-6 rounded-xl relative overflow-hidden group">
                 <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity"><Calendar size={48}/></div>
                 <div className="text-zinc-500 text-xs uppercase tracking-widest font-bold mb-2">Hours Trained</div>
                 <div className="text-4xl font-light text-white">{userLogs.reduce((sum, log) => sum + (Number(log.hoursTrained) || 0), 0)} <span className="text-sm text-zinc-500 font-normal">hrs</span></div>
               </div>
            </div>

            <div className="bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
               <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50">
                 <h3 className="text-lg font-bold text-white tracking-wide">Activity Log</h3>
               </div>
               <div className="p-6 space-y-4 max-h-[400px] overflow-y-auto">
                 {userLogs.length > 0 ? userLogs.map(log => (
                   <div key={log.id} className="bg-black p-5 rounded-xl border border-zinc-800/50">
                     <div className="flex justify-between items-start mb-3 border-b border-zinc-900 pb-3">
                       <div className="text-sm font-bold text-white flex items-center tracking-wide"><Calendar size={14} className="mr-2 text-zinc-500"/> {log.date}</div>
                       <div className="text-xs font-bold tracking-widest text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full">{log.hoursTrained} hrs</div>
                     </div>
                     
                     <div className="flex gap-4 mb-4 pt-2">
                        <div className={`flex items-center text-xs font-bold ${log.water ? 'text-blue-400' : 'text-zinc-600'}`}><Droplets size={14} className="mr-1"/> Water</div>
                        <div className={`flex items-center text-xs font-bold ${log.stretch ? 'text-amber-400' : 'text-zinc-600'}`}><PersonStanding size={14} className="mr-1"/> Stretch</div>
                        <div className={`flex items-center text-xs font-bold ${log.sleep ? 'text-purple-400' : 'text-zinc-600'}`}><Moon size={14} className="mr-1"/> Sleep</div>
                     </div>

                     <p className="text-sm text-zinc-300 mb-4 bg-zinc-900/30 p-3 rounded-lg"><span className="text-zinc-500 font-bold text-xs uppercase tracking-widest block mb-1">Diet Notes</span> {log.food || 'No diet details logged.'}</p>
                     
                     {log.exercises?.length > 0 && (
                       <div>
                         <span className="text-zinc-500 font-bold text-xs uppercase tracking-widest block mb-2">Exercises</span>
                         <div className="flex flex-wrap gap-2">
                           {log.exercises.map((ex, i) => (
                             <div key={i} className="text-[10px] border border-zinc-800 inline-flex items-center px-2 py-1 rounded bg-black">
                               <CheckCircle size={10} className="text-zinc-500 mr-1"/><span className="text-white mr-1">{ex.title}</span> <span className="text-zinc-500">{ex.sets}x{ex.rounds}</span>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 )) : <div className="text-sm text-zinc-500 py-12 text-center">No activity logged yet.</div>}
               </div>
            </div>
          </>
        ) : (
          <div className="bg-zinc-950 border border-zinc-800 p-12 rounded-xl text-center text-zinc-500 flex flex-col items-center justify-center min-h-[400px]">
            <Activity size={48} className="mb-4 opacity-20" />
            <p className="tracking-wide">Select a client to view their analytics</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- USER DASHBOARD (WITH BOTTOM NAV) ---
function UserDashboard({ user, users, exercises, logs, sessionStartTime }) {
  const [activeTab, setActiveTab] = useState('home'); 

  return (
    <>
      <div className="pb-8 animate-in fade-in duration-500">
        {activeTab === 'home' && <UserHome user={user} sessionStartTime={sessionStartTime} />}
        {activeTab === 'workouts' && <UserWorkouts exercises={exercises} user={user} />}
        {activeTab === 'journal' && <UserJournal user={user} logs={logs} />}
        {activeTab === 'profile' && <UserProfile user={user} logs={logs} appId={appId} db={db} />}
      </div>

      {/* FIXED BOTTOM NAVIGATION BAR */}
      <div className="fixed bottom-0 left-0 w-full bg-zinc-950/95 backdrop-blur-lg border-t border-zinc-800 pb-safe z-50">
        <div className="flex justify-around items-center h-16 max-w-md mx-auto px-4">
          {[
            { id: 'home', label: 'Home', icon: <Home size={20}/> },
            { id: 'workouts', label: 'Classes', icon: <Dumbbell size={20}/> },
            { id: 'journal', label: 'Journal', icon: <ClipboardList size={20}/> },
            { id: 'profile', label: 'Profile', icon: <User size={20}/> }
          ].map(tab => (
            <button 
              key={tab.id}
              onClick={() => setActiveTab(tab.id)} 
              className={`flex flex-col items-center justify-center w-full h-full space-y-1 transition-colors ${activeTab === tab.id ? 'text-white' : 'text-zinc-500 hover:text-zinc-400'}`}
            >
              {tab.icon}
              <span className="text-[10px] font-bold tracking-widest uppercase">{tab.label}</span>
            </button>
          ))}
        </div>
      </div>
    </>
  );
}

// NEW COMPONENT: Home Screen with Timer and Coach Notes
function UserHome({ user, sessionStartTime }) {
  const [elapsedTime, setElapsedTime] = useState('00:00:00');

  useEffect(() => {
    if (!sessionStartTime) return;
    const interval = setInterval(() => {
      const diff = Date.now() - sessionStartTime;
      const h = Math.floor(diff / 3600000).toString().padStart(2, '0');
      const m = Math.floor((diff % 3600000) / 60000).toString().padStart(2, '0');
      const s = Math.floor((diff % 60000) / 1000).toString().padStart(2, '0');
      setElapsedTime(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionStartTime]);

  return (
    <div className="space-y-6 max-w-md mx-auto w-full pt-4">
      <div className="text-center mb-8">
        <h1 className="text-3xl font-light text-white mb-2">Welcome Back, <br/><span className="font-bold">{user.profile?.firstName || user.username}</span></h1>
        <p className="text-zinc-500 text-xs font-bold uppercase tracking-[0.2em]">Ready to conquer today?</p>
      </div>

      {/* Live Session Timer */}
      <div className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 p-8 rounded-3xl flex flex-col items-center justify-center shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 p-4 opacity-5"><Clock size={100}/></div>
        <div className="text-zinc-500 text-xs font-bold tracking-widest uppercase mb-4 flex items-center"><span className="w-2 h-2 rounded-full bg-red-500 animate-pulse mr-2"></span> Active Session</div>
        <div className="text-5xl md:text-6xl font-mono text-white tracking-wider font-light drop-shadow-[0_0_15px_rgba(255,255,255,0.1)]">{elapsedTime}</div>
      </div>

      {/* Coach's Note Board */}
      {user.coachNote && (
        <div className="bg-amber-950/20 border border-amber-900/30 rounded-3xl p-6 relative overflow-hidden mt-6">
          <div className="flex items-center text-amber-500 mb-4">
            <MessageSquare size={18} className="mr-2"/>
            <span className="text-xs font-bold tracking-widest uppercase">Note from Coach</span>
          </div>
          <p className="text-amber-100/90 text-sm leading-relaxed whitespace-pre-wrap">{user.coachNote}</p>
        </div>
      )}
    </div>
  );
}

function UserWorkouts({ exercises, user }) {
  const [selectedCategory, setSelectedCategory] = useState(null);
  const categoryExercises = exercises.filter(e => e.category === selectedCategory);

  const handleComplete = async (exercise, sets, rounds) => {
    alert(`Awesome work completing ${exercise.title}! Make sure to log it in your Daily Journal.`);
  };

  if (selectedCategory) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
        <button onClick={() => setSelectedCategory(null)} className="flex items-center text-sm font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors group">
          <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back
        </button>
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest">{selectedCategory}</h2>
          <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full">{categoryExercises.length} Classes</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
          {categoryExercises.length > 0 ? categoryExercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onComplete={handleComplete} />
          )) : (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800 rounded-3xl bg-zinc-950/50">
              <Dumbbell size={48} className="mb-4 opacity-20" />
              <p className="tracking-wide">No classes assigned here yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-md mx-auto w-full pt-4">
      <h2 className="text-xl font-bold text-white mb-6 tracking-wide text-center uppercase">Choose Discipline</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {CATEGORIES.map(cat => (
          <div key={cat.name} onClick={() => setSelectedCategory(cat.name)} className="group relative h-40 rounded-3xl overflow-hidden cursor-pointer shadow-lg hover:border-zinc-500 transition-all border border-zinc-800">
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

function ExerciseCard({ exercise, onComplete }) {
  const [sets, setSets] = useState(5);
  const [rounds, setRounds] = useState(1);

  // Simple video renderer logic
  const renderVideo = () => {
    if (!exercise.videoUrl) return <div className="flex flex-col items-center justify-center text-zinc-700 h-full w-full absolute inset-0"><Video size={40} className="mb-3 opacity-30" /><span className="text-xs uppercase tracking-widest font-bold">No Video Provided</span></div>;
    
    if (exercise.videoUrl.startsWith('IFRAME:')) return <div className="w-full h-full absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:border-0" dangerouslySetInnerHTML={{ __html: exercise.videoUrl.replace('IFRAME:', '') }} />;
    
    let url = exercise.videoUrl.replace('EMBED:', '').replace('DIRECT:', '');
    if (url.includes('youtube') || url.includes('youtu.be') || exercise.videoUrl.startsWith('EMBED:')) {
      const ytMatch = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
      if (ytMatch && ytMatch[2].length === 11) url = `https://www.youtube.com/embed/${ytMatch[2]}`;
      return <iframe src={url} className="w-full h-full absolute inset-0 border-0" allowFullScreen></iframe>;
    }
    
    return <video src={url} controls className="w-full h-full absolute inset-0 object-cover"></video>;
  };

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-3xl overflow-hidden shadow-xl flex flex-col hover:border-zinc-700 transition-colors">
      <div className="aspect-video bg-black relative flex items-center justify-center border-b border-zinc-800 group overflow-hidden">
        {renderVideo()}
      </div>
      <div className="p-6 flex-1 flex flex-col">
        <h4 className="text-lg font-bold text-white mb-2 tracking-wide">{exercise.title}</h4>
        
        {exercise.instructions && (
          <div className="mb-6 p-4 bg-zinc-900/50 rounded-xl text-xs text-zinc-400 whitespace-pre-wrap leading-relaxed border border-zinc-800/50">
            {exercise.instructions}
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 mb-6 mt-auto">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Sets</label>
            <select value={sets} onChange={e => setSets(Number(e.target.value))} className="w-full bg-black border border-zinc-800 text-white text-sm rounded-xl p-3 outline-none focus:border-zinc-500">
              {[1,2,3,4,5,10,15].map(n => <option key={n} value={n}>{n} Sets</option>)}
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-2">Rounds</label>
            <select value={rounds} onChange={e => setRounds(Number(e.target.value))} className="w-full bg-black border border-zinc-800 text-white text-sm rounded-xl p-3 outline-none focus:border-zinc-500">
              {[1,2,3,4,5].map(n => <option key={n} value={n}>{n} Rounds</option>)}
            </select>
          </div>
        </div>

        <button onClick={() => onComplete(exercise, sets, rounds)} className="w-full bg-white text-black text-sm font-bold tracking-widest uppercase py-4 rounded-xl flex items-center justify-center transition-all hover:bg-zinc-200">
          <CheckCircle size={18} className="mr-2" /> Mark as Done
        </button>
      </div>
    </div>
  );
}

function UserJournal({ user, logs }) {
  const todayDate = new Date().toISOString().split('T')[0];
  const [date, setDate] = useState(todayDate);
  
  const existingLog = logs.find(l => l.userId === user.id && l.date === date);
  const [food, setFood] = useState('');
  const [hours, setHours] = useState(0);
  
  // New Habit Tracker States
  const [water, setWater] = useState(false);
  const [stretch, setStretch] = useState(false);
  const [sleep, setSleep] = useState(false);
  
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setFood(existingLog?.food || '');
    setHours(existingLog?.hoursTrained || 0);
    setWater(existingLog?.water || false);
    setStretch(existingLog?.stretch || false);
    setSleep(existingLog?.sleep || false);
  }, [date, existingLog]);

  const handleSave = async () => {
    if (!db) return;
    setIsSaving(true);
    const logId = `log_${user.id}_${date}`;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_logs', logId), {
        id: logId, userId: user.id, date,
        exercises: existingLog?.exercises || [],
        food, hoursTrained: Number(hours), weightLog: user.profile?.weight || 0,
        water, stretch, sleep // Save habits to cloud
      });
      alert('Journal entry safely stored in the cloud.');
    } catch (err) { alert("Error saving: " + err.message); }
    setIsSaving(false);
  };

  return (
    <div className="max-w-md mx-auto w-full pt-4 space-y-6">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
        <div className="flex justify-between items-center mb-6 border-b border-zinc-800 pb-4">
          <h3 className="text-xl font-bold text-white tracking-wide">Daily Log</h3>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} className="bg-black border border-zinc-800 text-xs font-mono text-zinc-300 rounded-lg px-3 py-2 outline-none" />
        </div>

        <div className="space-y-6">
          {/* HABIT TRACKER */}
          <div>
             <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-3">Daily Habits</label>
             <div className="grid grid-cols-3 gap-2">
                <button onClick={() => setWater(!water)} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-colors ${water ? 'bg-blue-950/40 border-blue-500 text-blue-400' : 'bg-black border-zinc-800 text-zinc-600'}`}>
                   <Droplets size={24} className="mb-2"/>
                   <span className="text-[10px] font-bold uppercase tracking-wider">Water</span>
                </button>
                <button onClick={() => setStretch(!stretch)} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-colors ${stretch ? 'bg-amber-950/40 border-amber-500 text-amber-400' : 'bg-black border-zinc-800 text-zinc-600'}`}>
                   <PersonStanding size={24} className="mb-2"/>
                   <span className="text-[10px] font-bold uppercase tracking-wider">Stretch</span>
                </button>
                <button onClick={() => setSleep(!sleep)} className={`flex flex-col items-center justify-center p-3 rounded-2xl border transition-colors ${sleep ? 'bg-purple-950/40 border-purple-500 text-purple-400' : 'bg-black border-zinc-800 text-zinc-600'}`}>
                   <Moon size={24} className="mb-2"/>
                   <span className="text-[10px] font-bold uppercase tracking-wider">Sleep</span>
                </button>
             </div>
          </div>

          <div>
            <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-3">Nutrition Notes</label>
            <textarea className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-sm text-white min-h-[100px] outline-none" placeholder="Meals, snacks, macros..." value={food} onChange={e => setFood(e.target.value)}></textarea>
          </div>
          
          <div>
            <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-3">Training Hours</label>
            <input type="number" step="0.5" min="0" className="w-full bg-black border border-zinc-800 rounded-2xl p-4 text-sm text-white outline-none" value={hours} onChange={e => setHours(e.target.value)} />
          </div>

          <button onClick={handleSave} disabled={isSaving} className="w-full bg-white text-black text-sm font-bold tracking-widest uppercase py-4 rounded-xl hover:bg-zinc-200 transition-colors shadow-lg">
            {isSaving ? 'Saving...' : 'Commit to Log'}
          </button>
        </div>
      </div>
    </div>
  );
}

function UserProfile({ user, logs, appId, db }) {
  const [profile, setProfile] = useState(user.profile);
  const [isUpdating, setIsUpdating] = useState(false);
  const fileInputRef = useRef(null);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!db) return;
    setIsUpdating(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', user.id), { ...user, profile }, { merge: true });
      alert('Profile synced to cloud.');
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
      
      // Auto-save photo instantly
      if (db) {
        await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', user.id), {
          ...user, profile: { ...profile, photo: base64String }
        }, { merge: true });
      }
    };
    reader.readAsDataURL(file);
  };

  const userLogs = logs.filter(l => l.userId === user.id);

  return (
    <div className="max-w-md mx-auto w-full pt-4 space-y-6">
      <div className="bg-zinc-950 border border-zinc-800 rounded-3xl p-6 relative overflow-hidden">
        <div className="flex flex-col items-center mb-8 pt-4">
          {/* PROFILE PICTURE UPLOAD */}
          <div className="relative group cursor-pointer mb-4" onClick={() => fileInputRef.current?.click()}>
            <div className="w-28 h-28 bg-black rounded-full border-2 border-zinc-700 flex items-center justify-center overflow-hidden shadow-2xl relative">
              {profile.photo ? (
                <img src={profile.photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-zinc-700" />
              )}
              {/* Camera overlay */}
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <Camera size={24} className="text-white"/>
              </div>
            </div>
            <input type="file" accept="image/*" ref={fileInputRef} onChange={handlePhotoUpload} className="hidden" />
          </div>
          <h3 className="text-2xl font-bold text-white tracking-wide">{profile.firstName || 'New'} {profile.lastName || 'Client'}</h3>
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-[0.2em] mt-2">Sam Fit Member</p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">First</label>
              <input type="text" className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-white outline-none" value={profile.firstName} onChange={e => setProfile({...profile, firstName: e.target.value})} />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">Last</label>
              <input type="text" className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-white outline-none" value={profile.lastName} onChange={e => setProfile({...profile, lastName: e.target.value})} />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-zinc-900">
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">H (M)</label>
              <input type="number" className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-white font-mono outline-none" value={profile.heightM} onChange={e => setProfile({...profile, heightM: e.target.value})} />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">H (CM)</label>
              <input type="number" className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-white font-mono outline-none" value={profile.heightCm} onChange={e => setProfile({...profile, heightCm: e.target.value})} />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">W (KG)</label>
              <input type="number" step="0.1" className="w-full bg-black border border-zinc-800 rounded-xl p-3 text-sm text-white font-mono outline-none" value={profile.weight} onChange={e => setProfile({...profile, weight: e.target.value})} />
            </div>
          </div>
          <button type="submit" disabled={isUpdating} className="w-full bg-zinc-900 text-white border border-zinc-800 text-sm font-bold tracking-widest uppercase py-4 rounded-xl mt-4 hover:bg-zinc-800 transition-colors">
            {isUpdating ? 'Syncing...' : 'Save Profile'}
          </button>
        </form>
      </div>
      
      {/* Mini Stats Summary */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-black border border-zinc-800 p-6 rounded-3xl text-center">
           <div className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">Total Workouts</div>
           <div className="text-3xl font-light text-white font-mono">{userLogs.reduce((acc, log) => acc + (log.exercises?.length || 0), 0)}</div>
        </div>
        <div className="bg-black border border-zinc-800 p-6 rounded-3xl text-center">
           <div className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">Hours Trained</div>
           <div className="text-3xl font-light text-white font-mono">{userLogs.reduce((acc, log) => acc + Number(log.hoursTrained || 0), 0)}</div>
        </div>
      </div>
    </div>
  );
}