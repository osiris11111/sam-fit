import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, CheckCircle, Circle, User, Activity, LogOut, 
  Plus, Trash2, TrendingUp, Calendar, Lock, Video,
  ChevronRight, Dumbbell, ClipboardList, Settings,
  BarChart2, Camera, ArrowLeft, UploadCloud, Link as LinkIcon,
  Sparkles, Bot, Code, Lightbulb
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged, signInWithCustomToken } from 'firebase/auth';
import { getFirestore, collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';

// --- GEMINI API CONFIG ---
const apiKey = "AIzaSyCWbHhg6XI1hbHC_uqvjLTYn3l7R8WKkA8"; 

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
  // Your real live Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyD3er01roP71kOET0ebyQyzJxfNcvHUWE8",
    authDomain: "sam-fit-73b88.firebaseapp.com",
    projectId: "sam-fit-73b88",
    storageBucket: "sam-fit-73b88.firebasestorage.app",
    messagingSenderId: "805503830384",
    appId: "1:805503830384:web:d8eb1271e8f3f3425367b5"
  };

  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  appId = 'samfit-live'; // Standardized namespace for your database
} catch (error) {
  console.error("Firebase init error:", error);
}

// --- MAIN APP COMPONENT ---
export default function App() {
  const [fbUser, setFbUser] = useState(null);
  const [isDbLoading, setIsDbLoading] = useState(true);
  
  // App State mapped from Firebase
  const [users, setUsers] = useState([]);
  const [exercises, setExercises] = useState([]);
  const [logs, setLogs] = useState([]);
  const [currentUser, setCurrentUser] = useState(null);
  const [authError, setAuthError] = useState('');

  // Override standard alerts so they work cleanly inside the app
  useEffect(() => {
    window.alert = (msg) => {
      const el = document.createElement('div');
      el.className = 'fixed top-4 right-4 bg-zinc-900 border border-emerald-900/50 text-emerald-400 px-6 py-4 rounded-xl shadow-2xl z-[9999] font-sans text-sm tracking-wide transition-opacity duration-500';
      el.innerText = msg;
      document.body.appendChild(el);
      setTimeout(() => { el.classList.add('opacity-0'); setTimeout(() => el.remove(), 500); }, 8000); // Extended timeout for reading
    };
    window.confirm = () => true; 
  }, []);

  // 1. Initialize Firebase Auth
  useEffect(() => {
    if (!auth) {
      setIsDbLoading(false);
      return;
    }
    const initAuth = async () => {
      try {
        if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
          try {
            await signInWithCustomToken(auth, __initial_auth_token);
          } catch (tokenErr) {
            // The preview token will fail against your personal Firebase config, so we gracefully fallback
            await signInAnonymously(auth);
          }
        } else {
          await signInAnonymously(auth);
        }
      } catch (err) {
        console.error("Auth Error:", err);
        // This specifically catches the "configuration-not-found" error you are seeing!
        if (err.message && (err.message.includes('configuration-not-found') || err.message.includes('operation-not-allowed'))) {
          alert("⚠️ ALMOST THERE! You must go to your Firebase Console -> Authentication -> Sign-in Method, and click 'Enable' on Anonymous Login. Then refresh!");
        }
        setIsDbLoading(false);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, user => {
      setFbUser(user);
    });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Data from Firestore
  useEffect(() => {
    if (!fbUser || !db) {
      // If auth failed to initialize completely, we still want to clear the loading state so the screen isn't blank
      setTimeout(() => setIsDbLoading(false), 2000); 
      return;
    }

    // References
    const usersRef = collection(db, 'artifacts', appId, 'public', 'data', 'samfit_users');
    const exercisesRef = collection(db, 'artifacts', appId, 'public', 'data', 'samfit_exercises');
    const logsRef = collection(db, 'artifacts', appId, 'public', 'data', 'samfit_logs');

    let uLoaded = false, eLoaded = false, lLoaded = false;
    const checkLoaded = () => { if (uLoaded && eLoaded && lLoaded) setIsDbLoading(false); };

    const unsubUsers = onSnapshot(usersRef, (snap) => {
      const data = snap.docs.map(d => d.data());
      // Seed Admin if no users exist
      if (data.length === 0) {
        seedAdmin();
      } else {
        setUsers(data);
      }
      uLoaded = true; checkLoaded();
    }, (err) => console.error("Firestore Error:", err));

    const unsubEx = onSnapshot(exercisesRef, (snap) => {
      setExercises(snap.docs.map(d => d.data()));
      eLoaded = true; checkLoaded();
    }, (err) => console.error(err));

    const unsubLogs = onSnapshot(logsRef, (snap) => {
      setLogs(snap.docs.map(d => d.data()));
      lLoaded = true; checkLoaded();
    }, (err) => console.error(err));

    return () => { unsubUsers(); unsubEx(); unsubLogs(); };
  }, [fbUser]);

  // Seed default admin and a test client to Firestore
  const seedAdmin = async () => {
    if (!db) return;
    const adminUser = {
      id: 'admin_001',
      username: 'admin',
      password: 'adminpassword',
      role: 'admin',
      active: true,
      profile: { firstName: 'SamFit', lastName: 'Admin', photo: '' }
    };
    const demoClient = {
      id: 'client_001',
      username: 'client',
      password: 'clientpassword',
      role: 'user',
      active: true,
      profile: { firstName: 'Demo', lastName: 'Client', heightM: 1, heightCm: 80, weight: 80, photo: '' }
    };
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', adminUser.id), adminUser);
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', demoClient.id), demoClient);
    } catch (error) {
      console.error(error);
    }
  };

  // Auth Handlers
  const handleLogin = (username, password) => {
    setAuthError('');
    const user = users.find(u => u.username === username && u.password === password);
    if (user) {
      if (!user.active && user.role !== 'admin') {
        setAuthError("Your access has been revoked. Please contact the administrator.");
        return;
      }
      setCurrentUser(user);
    } else {
      setAuthError("Invalid credentials. Please check your username and password.");
    }
  };

  const handleLogout = () => setCurrentUser(null);

  if (isDbLoading) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-white">
        <img src="logo.jpg" alt="Sam Fit" className="h-20 w-20 animate-pulse rounded-full border border-zinc-700 mb-6 object-cover" />
        <p className="text-zinc-500 uppercase tracking-widest text-sm animate-pulse">Loading Workspace...</p>
      </div>
    );
  }

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} error={authError} />;
  }

  return (
    <div className="min-h-screen bg-black text-zinc-200 font-sans selection:bg-zinc-700">
      {/* Top Navigation */}
      <nav className="border-b border-zinc-800 bg-black/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-3">
              <img src="logo.jpg" alt="Sam Fit Logo" className="h-10 w-10 rounded-full object-cover border border-zinc-700" />
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {currentUser.role === 'admin' ? (
          <AdminDashboard users={users} logs={logs} exercises={exercises} />
        ) : (
          <UserDashboard user={currentUser} users={users} exercises={exercises} logs={logs} />
        )}
      </main>
    </div>
  );
}

// --- LOGIN SCREEN ---
function LoginScreen({ onLogin, error }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  return (
    <div className="min-h-screen bg-black flex flex-col justify-center items-center px-4 bg-[url('https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=2000&q=80')] bg-cover bg-center">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm"></div>
      
      <div className="w-full max-w-md bg-zinc-950/90 border border-zinc-800 rounded-2xl shadow-2xl overflow-hidden relative z-10">
        <div className="p-8">
          <div className="flex justify-center mb-8">
             <img src="logo.jpg" alt="Sam Fit" className="h-28 w-28 rounded-full border border-zinc-700 object-cover shadow-[0_0_30px_rgba(255,255,255,0.05)]" />
          </div>
          <h2 className="text-2xl font-bold text-center text-white uppercase tracking-[0.2em] mb-6">Sam Fit Portal</h2>
          
          {error && (
            <div className="bg-red-950/50 border border-red-900/50 text-red-400 text-xs font-bold tracking-widest uppercase p-4 rounded-lg mb-6 text-center animate-in fade-in slide-in-from-top-2">
              {error}
            </div>
          )}
          
          <form onSubmit={(e) => { e.preventDefault(); onLogin(username, password); }} className="space-y-6">
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-zinc-400 mb-2">Username</label>
              <input 
                type="text" 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors placeholder-zinc-700"
                placeholder="Enter username"
                value={username}
                onChange={e => setUsername(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold tracking-widest uppercase text-zinc-400 mb-2">Password</label>
              <input 
                type="password" 
                className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-zinc-500 focus:ring-1 focus:ring-zinc-500 transition-colors placeholder-zinc-700"
                placeholder="Enter password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="w-full bg-white text-black font-bold uppercase tracking-widest py-3 rounded-lg hover:bg-zinc-200 transition-colors shadow-lg mt-2">
              Log In
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
      profile: { firstName: '', lastName: '', heightM: 0, heightCm: 0, weight: 0, photo: '' }
    };
    
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', newUserId), newUser);
      setNewUsername('');
      setNewPassword('');
      alert("Client added successfully!");
    } catch (err) {
      alert("Error adding user: " + err.message);
    }
  };

  const toggleAccess = async (user) => {
    if (!db) return;
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', user.id), {
        ...user,
        active: !user.active
      }, { merge: true });
    } catch (err) {
      alert("Error updating access: " + err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Add User Form */}
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

      {/* User List */}
      <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/50">
          <h3 className="text-lg font-bold text-white tracking-wide">Client Directory</h3>
        </div>
        <div className="divide-y divide-zinc-800 max-h-[600px] overflow-y-auto">
          {users.map(u => (
            <div key={u.id} className="p-6 flex flex-col sm:flex-row sm:items-center justify-between hover:bg-zinc-900/80 transition-colors gap-4">
              <div className="flex items-center space-x-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-lg border ${u.active ? 'bg-zinc-900 border-zinc-700 text-white' : 'bg-red-950/30 border-red-900/50 text-red-500'}`}>
                  {u.profile?.firstName ? u.profile.firstName.charAt(0).toUpperCase() : u.username.charAt(0).toUpperCase()}
                </div>
                <div>
                  <div className="text-white font-medium flex items-center tracking-wide">
                    {u.profile?.firstName} {u.profile?.lastName} 
                    {!u.profile?.firstName && <span className="text-zinc-600 italic text-sm">Profile Pending</span>}
                  </div>
                  <div className="text-xs text-zinc-500 font-mono mt-1">
                    User: <span className="text-zinc-300">{u.username}</span> | Pass: <span className="text-zinc-300">{u.password}</span>
                  </div>
                </div>
              </div>
              <div>
                <button 
                  onClick={() => toggleAccess(u)}
                  className={`px-4 py-2 text-xs font-bold tracking-wider uppercase rounded-lg flex items-center w-full sm:w-auto justify-center transition-colors ${u.active ? 'bg-black text-zinc-300 border border-zinc-700 hover:bg-zinc-900 hover:text-white' : 'bg-white text-black hover:bg-zinc-200'}`}
                >
                  {u.active ? <Lock size={14} className="mr-2"/> : <CheckCircle size={14} className="mr-2"/>}
                  {u.active ? 'Revoke Access' : 'Restore Access'}
                </button>
              </div>
            </div>
          ))}
          {users.length === 0 && (
            <div className="p-12 flex flex-col items-center justify-center text-zinc-600">
              <User size={40} className="mb-4 opacity-50" />
              <p>No clients registered yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminExerciseManagement({ exercises }) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0].name);
  const [uploadType, setUploadType] = useState('direct'); // 'direct', 'embed', 'iframe', 'upload'
  const [videoUrl, setVideoUrl] = useState('');
  const [iframeCode, setIframeCode] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [isSuggestingTitle, setIsSuggestingTitle] = useState(false);
  const fileInputRef = useRef(null);

  const handleSuggestTitle = async () => {
    setIsSuggestingTitle(true);
    const prompt = `Suggest a single, highly effective exercise name that fits the fitness category "${category}". Just return the name of the exercise, nothing else. No quotes, no extra text.`;
    const res = await generateAIFeedback(prompt, "You are an expert fitness programmer.");
    setTitle(res.replace(/["']/g, '').trim());
    setIsSuggestingTitle(false);
  };

  const handleSaveExercise = async (e) => {
    e.preventDefault();
    if (!title || !db) return;

    let finalUrl = '';

    // We now prefix the URL so the player knows EXACTLY how to render it
    if (uploadType === 'direct') {
      finalUrl = 'DIRECT:' + videoUrl;
    } else if (uploadType === 'embed') {
      finalUrl = 'EMBED:' + videoUrl;
    } else if (uploadType === 'iframe') {
      finalUrl = 'IFRAME:' + iframeCode;
    } else if (uploadType === 'upload' && fileInputRef.current?.files[0]) {
      const file = fileInputRef.current.files[0];
      
      // Strict limit to avoid Firestore 1MB document crash
      if (file.size > 800000) { 
        alert("File too large! Cloud database limits direct uploads to ~800KB. Please use a Direct Link for larger videos.");
        return;
      }

      setIsUploading(true);
      try {
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => resolve(reader.result);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        // Use DIRECT prefix so the native player renders the base64 string
        finalUrl = 'DIRECT:' + base64Data;
      } catch (err) {
        alert("Error reading file.");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }

    const newExId = 'ex_' + Date.now();
    const newEx = {
      id: newExId,
      title,
      category,
      videoUrl: finalUrl
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_exercises', newExId), newEx);
      setTitle('');
      setVideoUrl('');
      setIframeCode('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      alert("Exercise added successfully!");
    } catch (err) {
      alert("Error adding exercise: " + err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!db || !window.confirm("Delete this exercise permanently?")) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_exercises', id));
    } catch (err) {
      alert("Error deleting: " + err.message);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Add Exercise Form */}
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-6 h-fit relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-500 to-zinc-800"></div>
        <h3 className="text-lg font-bold text-white mb-6 flex items-center tracking-wide"><Plus size={18} className="mr-2 text-zinc-400"/> New Exercise</h3>
        
        <form onSubmit={handleSaveExercise} className="space-y-5">
          <div>
            <div className="flex justify-between items-center mb-2">
              <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase">Exercise Name</label>
              <button 
                type="button"
                onClick={handleSuggestTitle}
                disabled={isSuggestingTitle}
                className="text-[10px] font-bold text-amber-500 hover:text-amber-400 transition-colors flex items-center disabled:opacity-50 uppercase tracking-widest"
              >
                <Sparkles size={12} className="mr-1"/> {isSuggestingTitle ? 'Generating...' : '✨ Auto-Suggest'}
              </button>
            </div>
            <input type="text" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-zinc-500 outline-none" value={title} onChange={e => setTitle(e.target.value)} required placeholder="e.g. Kettlebell Swings" />
          </div>
          
          <div>
            <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase mb-2">Category</label>
            <select className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-zinc-500 outline-none" value={category} onChange={e => setCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c.name} value={c.name}>{c.name}</option>)}
            </select>
          </div>

          <div className="pt-2 border-t border-zinc-800">
            <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">Video Source</label>
            <div className="flex flex-col space-y-2 mb-4">
              <div className="flex space-x-2">
                <button type="button" onClick={() => setUploadType('direct')} className={`flex-1 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg flex items-center justify-center transition-colors ${uploadType === 'direct' ? 'bg-zinc-800 text-white' : 'bg-black text-zinc-500 border border-zinc-800'}`}>
                   Direct MP4
                </button>
                <button type="button" onClick={() => setUploadType('embed')} className={`flex-1 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg flex items-center justify-center transition-colors ${uploadType === 'embed' ? 'bg-zinc-800 text-white' : 'bg-black text-zinc-500 border border-zinc-800'}`}>
                   YT/Vimeo
                </button>
                <button type="button" onClick={() => setUploadType('iframe')} className={`flex-1 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg flex items-center justify-center transition-colors ${uploadType === 'iframe' ? 'bg-zinc-800 text-white' : 'bg-black text-zinc-500 border border-zinc-800'}`}>
                   Raw Iframe
                </button>
                <button type="button" onClick={() => setUploadType('upload')} className={`flex-1 py-2 text-[10px] font-bold tracking-wider uppercase rounded-lg flex items-center justify-center transition-colors ${uploadType === 'upload' ? 'bg-zinc-800 text-white' : 'bg-black text-zinc-500 border border-zinc-800'}`}>
                   Upload
                </button>
              </div>
            </div>

            {uploadType === 'direct' && (
              <div>
                <input type="url" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-zinc-500 outline-none mb-2" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="https://samfit.co/videos/class.mp4" required />
                <p className="text-[10px] text-zinc-500 font-mono bg-zinc-900/50 p-2 rounded">
                  ✅ <b>Best Option:</b> Paste a direct link to an .mp4 file hosted on your website. This uses the un-blockable native video player.
                </p>
              </div>
            )}

            {uploadType === 'embed' && (
              <div>
                <input type="url" className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-zinc-500 outline-none mb-2" value={videoUrl} onChange={e => setVideoUrl(e.target.value)} placeholder="YouTube or Vimeo URL" required />
                <p className="text-[10px] text-zinc-500 font-mono bg-zinc-900/50 p-2 rounded">
                  Paste a standard YouTube or Vimeo link. The app will automatically convert it.
                </p>
              </div>
            )}
            
            {uploadType === 'iframe' && (
              <textarea className="w-full bg-black border border-zinc-800 rounded-lg px-4 py-3 text-sm text-white focus:border-zinc-500 outline-none min-h-[100px] font-mono" value={iframeCode} onChange={e => setIframeCode(e.target.value)} placeholder='Paste full <iframe src="..."></iframe> code here' required />
            )}

            {uploadType === 'upload' && (
              <div>
                <input type="file" accept="video/mp4,video/webm" ref={fileInputRef} className="w-full text-sm text-zinc-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-bold file:bg-zinc-800 file:text-white hover:file:bg-zinc-700 mb-2" required />
                <p className="text-[10px] text-zinc-500 font-mono bg-zinc-900/50 p-2 rounded">
                  ⚠️ <b>Database Limit:</b> Direct app uploads are saved to the database (max 800KB). For larger videos, host them on GitHub/YouTube and use the link options.
                </p>
              </div>
            )}
          </div>

          <button type="submit" disabled={isUploading} className="w-full bg-white text-black text-sm font-bold tracking-widest uppercase py-3 rounded-lg hover:bg-zinc-200 transition-colors mt-4 disabled:opacity-50">
            {isUploading ? 'Processing...' : 'Save Exercise'}
          </button>
        </form>
      </div>

      {/* Exercise List */}
      <div className="lg:col-span-2 bg-zinc-950 border border-zinc-800 rounded-xl overflow-hidden">
        <div className="px-6 py-5 border-b border-zinc-800 bg-zinc-900/50">
          <h3 className="text-lg font-bold text-white tracking-wide">Exercise Library</h3>
        </div>
        <div className="divide-y divide-zinc-800 max-h-[600px] overflow-y-auto">
          {exercises.length > 0 ? exercises.map(ex => (
            <div key={ex.id} className="p-4 sm:p-6 flex items-center justify-between hover:bg-zinc-900/80 transition-colors">
              <div className="flex items-center space-x-4">
                <div className="w-16 h-12 bg-black rounded flex items-center justify-center border border-zinc-800 shrink-0">
                  {ex.videoUrl ? <Play size={16} className="text-zinc-500" /> : <Video size={16} className="text-zinc-700" />}
                </div>
                <div>
                  <div className="text-white font-medium tracking-wide">{ex.title}</div>
                  <div className="text-xs font-bold tracking-widest uppercase text-zinc-500 mt-1">{ex.category}</div>
                </div>
              </div>
              <button onClick={() => handleDelete(ex.id)} className="p-2 text-zinc-600 hover:text-red-500 hover:bg-red-950/30 rounded transition-colors">
                <Trash2 size={18} />
              </button>
            </div>
          )) : (
            <div className="p-12 flex flex-col items-center justify-center text-zinc-600">
              <Dumbbell size={40} className="mb-4 opacity-50" />
              <p>No exercises added yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function AdminAnalytics({ clients, logs }) {
  const [selectedUserId, setSelectedUserId] = useState(clients[0]?.id || null);
  
  const selectedUser = clients.find(c => c.id === selectedUserId);
  const userLogs = logs.filter(l => l.userId === selectedUserId).sort((a,b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
      <div className="bg-zinc-950 border border-zinc-800 rounded-xl p-4 overflow-y-auto max-h-[600px]">
        <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest mb-4 px-2">Select Client</h3>
        <div className="space-y-1">
          {clients.map(c => (
            <button 
              key={c.id} 
              onClick={() => setSelectedUserId(c.id)}
              className={`w-full text-left px-4 py-3 rounded-lg transition-colors flex items-center space-x-3 ${selectedUserId === c.id ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:bg-zinc-900'}`}
            >
              <User size={16} />
              <span className="truncate">{c.profile?.firstName || c.username}</span>
            </button>
          ))}
          {clients.length === 0 && <p className="text-xs text-zinc-600 px-2 italic">No clients available.</p>}
        </div>
      </div>

      <div className="lg:col-span-3 space-y-6">
        {selectedUser ? (
          <>
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
                   <div key={log.id} className="bg-black p-5 rounded-xl border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                     <div className="flex justify-between items-start mb-3 border-b border-zinc-900 pb-3">
                       <div className="text-sm font-bold text-white flex items-center tracking-wide"><Calendar size={14} className="mr-2 text-zinc-500"/> {log.date}</div>
                       <div className="text-xs font-bold tracking-widest text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full">{log.hoursTrained} hrs</div>
                     </div>
                     <p className="text-sm text-zinc-300 mb-4 bg-zinc-900/30 p-3 rounded-lg"><span className="text-zinc-500 font-bold text-xs uppercase tracking-widest block mb-1">Diet Notes</span> {log.food || 'No diet details logged.'}</p>
                     
                     {log.exercises?.length > 0 && (
                       <div>
                         <span className="text-zinc-500 font-bold text-xs uppercase tracking-widest block mb-2">Exercises</span>
                         <div className="flex flex-wrap gap-2">
                           {log.exercises.map((ex, i) => (
                             <div key={i} className="text-xs border border-zinc-800 inline-flex items-center px-3 py-1.5 rounded-lg bg-black">
                               <CheckCircle size={12} className="text-zinc-500 mr-2"/>
                               <span className="text-white font-medium mr-2">{ex.title}</span> 
                               <span className="text-zinc-500 font-mono">{ex.sets}x{ex.rounds}</span>
                             </div>
                           ))}
                         </div>
                       </div>
                     )}
                   </div>
                 )) : <div className="text-sm text-zinc-500 py-12 text-center flex flex-col items-center"><ClipboardList size={32} className="mb-3 opacity-20"/> No activity logged yet.</div>}
               </div>
            </div>
          </>
        ) : (
          <div className="bg-zinc-950 border border-zinc-800 p-12 rounded-xl text-center text-zinc-500 flex flex-col items-center justify-center h-full min-h-[400px]">
            <Activity size={48} className="mb-4 opacity-20" />
            <p className="tracking-wide">Select a client to view their analytics</p>
          </div>
        )}
      </div>
    </div>
  );
}

// --- USER DASHBOARD ---
function UserDashboard({ user, users, exercises, logs }) {
  const [activeTab, setActiveTab] = useState('workouts'); // workouts, journal, profile

  return (
    <div className="space-y-8">
      {/* Mobile-friendly Tab Navigation */}
      <div className="flex space-x-2 border-b border-zinc-800 pb-2 overflow-x-auto no-scrollbar">
        {[
          { id: 'workouts', label: 'Workouts', icon: <Dumbbell size={16}/> },
          { id: 'journal', label: 'Daily Journal', icon: <ClipboardList size={16}/> },
          { id: 'profile', label: 'My Profile', icon: <User size={16}/> }
        ].map(tab => (
          <button 
            key={tab.id}
            onClick={() => setActiveTab(tab.id)} 
            className={`px-4 py-2 font-medium text-sm transition-all flex items-center space-x-2 whitespace-nowrap rounded-t-lg ${activeTab === tab.id ? 'bg-zinc-900 text-white border-b-2 border-white' : 'text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900/50'}`}
          >
            {tab.icon} <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {activeTab === 'workouts' && <UserWorkouts exercises={exercises} user={user} />}
      {activeTab === 'journal' && <UserJournal user={user} logs={logs} />}
      {activeTab === 'profile' && <UserProfile user={user} logs={logs} />}
    </div>
  );
}

function UserWorkouts({ exercises, user }) {
  const [selectedCategory, setSelectedCategory] = useState(null);

  const categoryExercises = exercises.filter(e => e.category === selectedCategory);

  const handleComplete = async (exercise, sets, rounds) => {
    if (!db) return;
    try {
      alert(`Awesome work completing ${exercise.title}! Make sure to record it in your Daily Journal.`);
    } catch (err) {
      console.error(err);
    }
  };

  if (selectedCategory) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <button 
          onClick={() => setSelectedCategory(null)}
          className="flex items-center text-sm font-bold uppercase tracking-widest text-zinc-400 hover:text-white transition-colors group"
        >
          <ArrowLeft size={16} className="mr-2 group-hover:-translate-x-1 transition-transform" /> Back to Categories
        </button>
        
        <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
          <h2 className="text-2xl font-bold text-white uppercase tracking-widest">{selectedCategory}</h2>
          <span className="text-xs font-mono text-zinc-500 bg-zinc-900 px-3 py-1 rounded-full">{categoryExercises.length} Workouts</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 pt-4">
          {categoryExercises.length > 0 ? categoryExercises.map(ex => (
            <ExerciseCard key={ex.id} exercise={ex} onComplete={handleComplete} />
          )) : (
            <div className="col-span-full py-20 flex flex-col items-center justify-center text-zinc-500 border border-dashed border-zinc-800 rounded-2xl bg-zinc-950/50">
              <Dumbbell size={48} className="mb-4 opacity-20" />
              <p className="tracking-wide">No exercises assigned to this category yet.</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Categories Grid View
  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-white mb-6 tracking-wide">Choose Your Discipline</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {CATEGORIES.map(cat => (
          <div 
            key={cat.name}
            onClick={() => setSelectedCategory(cat.name)}
            className="group relative h-48 rounded-2xl overflow-hidden cursor-pointer shadow-lg hover:shadow-xl hover:shadow-zinc-800/50 transition-all border border-zinc-800 hover:border-zinc-600"
          >
            <div className="absolute inset-0 bg-black/60 group-hover:bg-black/40 transition-colors z-10"></div>
            <img src={cat.img} alt={cat.name} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" />
            <div className="absolute inset-0 z-20 flex flex-col items-center justify-center p-6 text-center">
              <h3 className="text-2xl font-bold text-white uppercase tracking-widest drop-shadow-lg">{cat.name}</h3>
              <div className="mt-4 opacity-0 group-hover:opacity-100 transform translate-y-4 group-hover:translate-y-0 transition-all duration-300">
                <span className="bg-white text-black text-xs font-bold px-4 py-2 rounded-full uppercase tracking-widest">Enter Class</span>
              </div>
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
  const [tips, setTips] = useState('');
  const [isLoadingTips, setIsLoadingTips] = useState(false);

  const handleGetTips = async () => {
    if (tips) {
      setTips(''); // Toggle off
      return;
    }
    setIsLoadingTips(true);
    const prompt = `Give me 3 quick, bulleted pro-tips on proper form and 1 common mistake to avoid for the exercise: "${exercise.title}". Keep it extremely brief and punchy.`;
    const res = await generateAIFeedback(prompt, "You are an elite Sam Fit personal trainer focusing on safe form.");
    setTips(res);
    setIsLoadingTips(false);
  };

  // Smart URL parser that strictly follows the Admin's chosen rendering method
  const embedData = React.useMemo(() => {
    const rawUrl = exercise.videoUrl || '';
    if (!rawUrl) return { url: '', type: 'none' };

    // 1. Check for explicit prefixes added by the new Admin system
    if (rawUrl.startsWith('IFRAME:')) {
      return { url: rawUrl.replace('IFRAME:', ''), type: 'iframe-raw' };
    }
    if (rawUrl.startsWith('DIRECT:')) {
      return { url: rawUrl.replace('DIRECT:', ''), type: 'video' };
    }
    if (rawUrl.startsWith('EMBED:')) {
      let url = rawUrl.replace('EMBED:', '');
      
      // Auto-format standard links for YouTube
      const ytMatch = url.match(/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/);
      if (ytMatch && ytMatch[2].length === 11) {
        url = `https://www.youtube.com/embed/${ytMatch[2]}`;
      }
      // Auto-format standard links for Vimeo
      const vimeoMatch = url.match(/(?:www\.|player\.)?vimeo.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)/i);
      if (vimeoMatch && vimeoMatch[1]) {
        url = `https://player.vimeo.com/video/${vimeoMatch[1]}`;
      }
      return { url: url, type: 'embed' };
    }

    // 2. Fallback for older entries without a prefix
    const lowerUrl = rawUrl.toLowerCase();
    if (lowerUrl.includes('<iframe')) return { url: rawUrl, type: 'iframe-raw' };
    if (lowerUrl.includes('youtube') || lowerUrl.includes('youtu.be') || lowerUrl.includes('vimeo')) return { url: rawUrl, type: 'embed' };
    
    return { url: rawUrl, type: 'video' };
  }, [exercise.videoUrl]);

  return (
    <div className="bg-zinc-950 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl flex flex-col hover:border-zinc-700 transition-colors">
      {/* Video Placeholder */}
      <div className="aspect-video bg-black relative flex items-center justify-center border-b border-zinc-800 group">
        {embedData.type === 'iframe-raw' ? (
          <div 
            className="w-full h-full absolute inset-0 [&>iframe]:w-full [&>iframe]:h-full [&>iframe]:absolute [&>iframe]:inset-0 [&>iframe]:border-0"
            dangerouslySetInnerHTML={{ __html: embedData.url }} 
          />
        ) : embedData.type === 'embed' ? (
          <>
            <iframe 
              src={embedData.url} 
              className="w-full h-full absolute inset-0 border-0 z-10" 
              allowFullScreen
            ></iframe>
            <a href={embedData.url} target="_blank" rel="noreferrer" className="absolute top-2 right-2 z-20 bg-black/80 text-white text-[10px] px-3 py-1 rounded font-bold uppercase opacity-0 group-hover:opacity-100 transition-opacity backdrop-blur-sm border border-zinc-700">
              Open Video
            </a>
          </>
        ) : embedData.type === 'video' ? (
          <video src={embedData.url} controls className="w-full h-full absolute inset-0 object-cover"></video>
        ) : (
          <div className="flex flex-col items-center justify-center text-zinc-700">
            <Video size={40} className="mb-3 opacity-50" />
            <span className="text-xs uppercase tracking-widest font-bold">No Video</span>
          </div>
        )}
      </div>
      
      <div className="p-6 flex-1 flex flex-col">
        <h4 className="text-lg font-bold text-white mb-6 tracking-wide">{exercise.title}</h4>
        
        <div className="grid grid-cols-2 gap-4 mb-8 flex-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Sets</label>
            <select 
              value={sets} 
              onChange={e => setSets(Number(e.target.value))}
              className="w-full bg-black border border-zinc-800 text-white text-sm rounded-lg p-3 outline-none focus:border-zinc-500 transition-colors"
            >
              <option value={5}>5 Sets</option>
              <option value={10}>10 Sets</option>
              <option value={15}>15 Sets</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold uppercase tracking-widest text-zinc-500 mb-2">Rounds</label>
            <select 
              value={rounds} 
              onChange={e => setRounds(Number(e.target.value))}
              className="w-full bg-black border border-zinc-800 text-white text-sm rounded-lg p-3 outline-none focus:border-zinc-500 transition-colors"
            >
              <option value={1}>1 Round</option>
              <option value={2}>2 Rounds</option>
              <option value={3}>3 Rounds</option>
            </select>
          </div>
        </div>

        {tips && (
          <div className="mb-6 p-4 bg-zinc-900/80 border border-zinc-800 rounded-xl text-sm text-zinc-300 leading-relaxed animate-in fade-in slide-in-from-top-2">
            <div className="flex items-center text-amber-500 mb-3">
              <Lightbulb size={16} className="mr-2"/>
              <span className="text-xs font-bold tracking-widest uppercase">Form & Safety Tips</span>
            </div>
            <div className="whitespace-pre-wrap text-xs">{tips}</div>
          </div>
        )}

        <div className="space-y-3 mt-auto">
          <button 
            onClick={() => onComplete(exercise, sets, rounds)}
            className="w-full bg-zinc-900 hover:bg-zinc-800 text-white border border-zinc-800 hover:border-zinc-600 text-sm font-bold tracking-widest uppercase py-4 rounded-xl flex items-center justify-center transition-all"
          >
            <CheckCircle size={18} className="mr-2 text-zinc-400" />
            Mark as Done
          </button>
          
          <button 
            onClick={handleGetTips}
            disabled={isLoadingTips}
            className="w-full bg-transparent text-zinc-400 hover:text-amber-400 text-xs font-bold tracking-widest uppercase py-3 rounded-xl flex items-center justify-center transition-all disabled:opacity-50"
          >
            <Sparkles size={14} className="mr-2" />
            {isLoadingTips ? 'Consulting Coach...' : tips ? 'Hide Tips' : '✨ AI Form Tips'}
          </button>
        </div>
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
  const [isSaving, setIsSaving] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  useEffect(() => {
    setFood(existingLog?.food || '');
    setHours(existingLog?.hoursTrained || 0);
    setAiAnalysis(''); // Reset analysis on date change
  }, [date, existingLog]);

  const handleSave = async () => {
    if (!db) return;
    setIsSaving(true);
    const logId = `log_${user.id}_${date}`;
    const logData = {
      id: logId,
      userId: user.id,
      date,
      exercises: existingLog?.exercises || [], // preserve existing if any
      food,
      hoursTrained: Number(hours),
      weightLog: user.profile?.weight || 0
    };

    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_logs', logId), logData);
      alert('Journal entry safely stored in the cloud.');
    } catch (err) {
      alert("Error saving: " + err.message);
    }
    setIsSaving(false);
  };

  const handleAnalyzeDiet = async () => {
    if (!food) return alert("Please add some nutrition notes first!");
    setIsAnalyzing(true);
    const prompt = `Analyze this daily food log for a fitness client: "${food}". Give a very brief 3-bullet point summary: 1. Estimated quality, 2. Praise, 3. One suggestion for improvement. Keep it encouraging and short.`;
    const response = await generateAIFeedback(prompt, "You are a professional nutritionist at Sam Fit gym. Keep responses very concise and directly address the user.");
    setAiAnalysis(response);
    setIsAnalyzing(false);
  };

  const currentExercises = existingLog?.exercises || [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-700 to-black"></div>
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-8 gap-4">
            <h3 className="text-xl font-bold text-white tracking-wide">Daily Journal</h3>
            <input 
              type="date" 
              value={date} 
              onChange={e => setDate(e.target.value)}
              className="bg-black border border-zinc-800 text-sm font-mono text-zinc-300 rounded-lg px-4 py-2 outline-none focus:border-zinc-500"
            />
          </div>

          <div className="space-y-6">
            <div>
              <div className="flex justify-between items-center mb-3">
                <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase">Nutrition Notes</label>
                <button 
                  onClick={handleAnalyzeDiet} 
                  disabled={isAnalyzing || !food}
                  className="text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors flex items-center disabled:opacity-50"
                >
                  <Sparkles size={14} className="mr-1"/> {isAnalyzing ? 'Analyzing...' : '✨ Analyze Diet'}
                </button>
              </div>
              <textarea 
                className="w-full bg-black border border-zinc-800 rounded-xl p-4 text-sm text-white placeholder-zinc-700 min-h-[140px] outline-none focus:border-zinc-600 transition-colors"
                placeholder="List your meals, snacks, and water intake..."
                value={food}
                onChange={e => setFood(e.target.value)}
              ></textarea>
              
              {aiAnalysis && (
                <div className="mt-3 p-4 bg-emerald-950/20 border border-emerald-900/30 rounded-xl animate-in fade-in slide-in-from-top-2">
                  <div className="flex items-center text-emerald-500 mb-2">
                    <Bot size={16} className="mr-2"/>
                    <span className="text-xs font-bold tracking-widest uppercase">AI Nutrition Coach</span>
                  </div>
                  <div className="text-sm text-zinc-300 whitespace-pre-wrap leading-relaxed">{aiAnalysis}</div>
                </div>
              )}
            </div>
            
            <div>
              <label className="block text-xs font-bold tracking-widest text-zinc-500 uppercase mb-3">Training Duration</label>
              <div className="relative max-w-xs">
                <input 
                  type="number" 
                  step="0.5" min="0"
                  className="w-full bg-black border border-zinc-800 rounded-xl p-4 pr-12 text-sm text-white outline-none focus:border-zinc-600 transition-colors"
                  value={hours}
                  onChange={e => setHours(e.target.value)}
                />
                <div className="absolute inset-y-0 right-0 flex items-center pr-4 text-xs font-bold text-zinc-600 uppercase">Hours</div>
              </div>
            </div>

            <button onClick={handleSave} disabled={isSaving} className="bg-white text-black text-sm font-bold tracking-widest uppercase px-8 py-4 rounded-xl hover:bg-zinc-200 transition-colors shadow-lg disabled:opacity-50">
              {isSaving ? 'Saving to Cloud...' : 'Commit to Log'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 h-full flex flex-col">
          <h3 className="text-lg font-bold text-white mb-2 tracking-wide">Completed Workouts</h3>
          <p className="text-xs text-zinc-500 mb-6 font-mono border-b border-zinc-800 pb-4">{date}</p>
          
          <div className="space-y-4 flex-1 overflow-y-auto pr-2">
            {currentExercises.length > 0 ? currentExercises.map((ex, i) => (
              <div key={i} className="flex items-start space-x-4 bg-black p-4 rounded-xl border border-zinc-800">
                <CheckCircle size={18} className="text-zinc-400 mt-0.5 shrink-0" />
                <div>
                  <div className="text-sm font-bold text-white tracking-wide">{ex.title}</div>
                  <div className="text-xs text-zinc-500 font-mono mt-1">{ex.sets} sets • {ex.rounds} rounds</div>
                </div>
              </div>
            )) : (
              <div className="flex flex-col items-center justify-center py-12 text-zinc-600 h-full">
                <Dumbbell size={32} className="mb-4 opacity-30" />
                <p className="text-xs font-bold tracking-widest uppercase text-center max-w-[200px]">No workouts logged for this date.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function UserProfile({ user, logs }) {
  const [profile, setProfile] = useState(user.profile);
  const [isUpdating, setIsUpdating] = useState(false);
  const [aiInsights, setAiInsights] = useState('');
  const [isGettingInsights, setIsGettingInsights] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!db) return;
    setIsUpdating(true);
    try {
      await setDoc(doc(db, 'artifacts', appId, 'public', 'data', 'samfit_users', user.id), {
        ...user,
        profile
      }, { merge: true });
      alert('Profile updated and synced to cloud.');
    } catch (err) {
      alert("Error updating profile: " + err.message);
    }
    setIsUpdating(false);
  };

  const handleGetInsights = async () => {
    setIsGettingInsights(true);
    const totalWorkouts = userLogs.reduce((acc, log) => acc + (log.exercises?.length || 0), 0);
    const totalHours = userLogs.reduce((acc, log) => acc + Number(log.hoursTrained || 0), 0);
    const recentWeight = profile.weight;
    
    const prompt = `Client metrics: ${totalWorkouts} total workouts recorded, ${totalHours} total hours trained, current weight ${recentWeight}kg. Give a short, highly motivational 2-paragraph pep talk acting as their personal trainer from Sam Fit gym. Acknowledge their effort and give them a hype boost!`;
    const response = await generateAIFeedback(prompt, "You are an elite, highly motivational personal trainer at Sam Fit gym. Use a hype, encouraging tone.");
    setAiInsights(response);
    setIsGettingInsights(false);
  };

  const userLogs = logs.filter(l => l.userId === user.id).sort((a,b) => new Date(a.date) - new Date(b.date));
  const recentLogs = userLogs.slice(-7); 

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Profile Form */}
      <div className="lg:col-span-1 bg-zinc-950 border border-zinc-800 rounded-2xl p-6 relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-zinc-700 to-black"></div>
        <div className="flex flex-col items-center mb-8 pt-4">
          <div className="relative group cursor-pointer mb-6">
            <div className="w-28 h-28 bg-black rounded-full border border-zinc-700 flex items-center justify-center overflow-hidden shadow-2xl">
              {profile.photo ? (
                <img src={profile.photo} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User size={48} className="text-zinc-700" />
              )}
            </div>
          </div>
          <h3 className="text-xl font-bold text-white tracking-wide">{profile.firstName || 'New'} {profile.lastName || 'Client'}</h3>
          <p className="text-xs font-bold text-zinc-500 uppercase tracking-[0.2em] mt-2">Sam Fit Member</p>
        </div>

        <form onSubmit={handleUpdate} className="space-y-5">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">First Name</label>
              <input type="text" className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-zinc-600 outline-none transition-colors" value={profile.firstName} onChange={e => setProfile({...profile, firstName: e.target.value})} />
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">Last Name</label>
              <input type="text" className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm text-white focus:border-zinc-600 outline-none transition-colors" value={profile.lastName} onChange={e => setProfile({...profile, lastName: e.target.value})} />
            </div>
          </div>

          <div className="border-t border-zinc-900 pt-6 mt-6">
            <h4 className="text-xs font-bold tracking-widest text-white uppercase mb-5 flex items-center"><Activity size={14} className="mr-2 text-zinc-500"/> Body Metrics</h4>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">Height (M)</label>
                <input type="number" min="0" step="1" className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm font-mono text-white focus:border-zinc-600 outline-none transition-colors" value={profile.heightM} onChange={e => setProfile({...profile, heightM: e.target.value})} />
              </div>
              <div>
                <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">Height (CM)</label>
                <input type="number" min="0" max="99" className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm font-mono text-white focus:border-zinc-600 outline-none transition-colors" value={profile.heightCm} onChange={e => setProfile({...profile, heightCm: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">Weight (KG)</label>
              <input type="number" step="0.1" className="w-full bg-black border border-zinc-800 rounded-lg p-3 text-sm font-mono text-white focus:border-zinc-600 outline-none transition-colors" value={profile.weight} onChange={e => setProfile({...profile, weight: e.target.value})} />
            </div>
          </div>

          <button type="submit" disabled={isUpdating} className="w-full bg-white text-black text-sm font-bold tracking-widest uppercase py-4 rounded-xl mt-8 hover:bg-zinc-200 transition-colors disabled:opacity-50">
            {isUpdating ? 'Syncing...' : 'Update Metrics'}
          </button>
        </form>
      </div>

      {/* Progress Chart & Stats */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 lg:p-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4">
            <h3 className="text-xl font-bold text-white flex items-center tracking-wide">
              <TrendingUp size={20} className="mr-3 text-zinc-500" /> My Progress Tracker
            </h3>
            <button 
              onClick={handleGetInsights}
              disabled={isGettingInsights}
              className="bg-zinc-900 border border-zinc-700 hover:border-zinc-500 text-white text-xs font-bold tracking-widest uppercase px-4 py-2 rounded-lg transition-all flex items-center disabled:opacity-50"
            >
              <Sparkles size={14} className="mr-2 text-amber-400"/>
              {isGettingInsights ? 'Consulting Coach...' : '✨ Ask AI Coach'}
            </button>
          </div>
          
          {aiInsights && (
            <div className="mb-8 p-5 bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-xl relative overflow-hidden animate-in fade-in slide-in-from-top-2">
              <div className="absolute -right-4 -top-4 opacity-5"><Bot size={100}/></div>
              <div className="flex items-center text-amber-500 mb-3">
                <Bot size={18} className="mr-2"/>
                <span className="text-xs font-bold tracking-widest uppercase text-amber-500">Coach's Feedback</span>
              </div>
              <div className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap relative z-10">{aiInsights}</div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-10">
             <div className="bg-black border border-zinc-800/50 p-6 rounded-xl">
               <div className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">Current BMI</div>
               <div className="text-3xl font-light text-white font-mono">
                 {profile.heightM > 0 && profile.weight > 0 ? 
                   (profile.weight / Math.pow(Number(profile.heightM) + Number(profile.heightCm)/100, 2)).toFixed(1) 
                   : '--'}
               </div>
             </div>
             <div className="bg-black border border-zinc-800/50 p-6 rounded-xl">
               <div className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">Total Workouts</div>
               <div className="text-3xl font-light text-white font-mono">{userLogs.reduce((acc, log) => acc + (log.exercises?.length || 0), 0)}</div>
             </div>
             <div className="bg-black border border-zinc-800/50 p-6 rounded-xl">
               <div className="text-[10px] font-bold tracking-widest text-zinc-500 uppercase mb-2">Hours Trained</div>
               <div className="text-3xl font-light text-white font-mono">{userLogs.reduce((acc, log) => acc + Number(log.hoursTrained || 0), 0)}</div>
             </div>
          </div>

          <div className="bg-black border border-zinc-800 rounded-xl p-6 lg:p-8 relative">
            <h4 className="text-[10px] font-bold tracking-widest text-zinc-500 mb-8 uppercase">Weight Trajectory</h4>
            <div className="h-48 flex items-end justify-between space-x-2 md:space-x-6 w-full overflow-x-auto pb-4 pt-8 border-b border-zinc-900">
              {recentLogs.length > 0 ? recentLogs.map((log, i) => {
                const maxWeight = Math.max(...recentLogs.map(l => l.weightLog || 0), 100);
                const heightPercentage = ((log.weightLog || 0) / maxWeight) * 100;
                
                return (
                  <div key={i} className="flex flex-col items-center flex-1 min-w-[40px] group relative h-full justify-end">
                    <div className="absolute -top-8 opacity-0 group-hover:opacity-100 bg-white text-black font-bold font-mono text-[10px] px-2 py-1 rounded transition-opacity z-10 whitespace-nowrap">
                      {log.weightLog} kg
                    </div>
                    <div 
                      className="w-full max-w-[40px] bg-zinc-800 group-hover:bg-zinc-500 transition-colors rounded-t" 
                      style={{ height: `${heightPercentage}%`, minHeight: '10%' }}
                    ></div>
                    <span className="text-[10px] font-mono text-zinc-600 mt-3 whitespace-nowrap">{log.date.substring(5)}</span>
                  </div>
                );
              }) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-zinc-600 text-sm absolute inset-0">
                  <Activity size={32} className="mb-3 opacity-20"/>
                  Log your journal daily to generate a chart.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}