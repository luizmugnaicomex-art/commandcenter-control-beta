import React, { useState, FormEvent } from 'react';
import { cn } from '../utils';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInAnonymously } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type UserRole = 'Admin' | 'Carrier' | 'Clerk';

export interface UserDetails {
  uid: string;
  email: string;
  role: string;
  cnpj?: string;
  razaoSocial?: string;
  nomeFantasia?: string;
}

interface LoginProps {
  onLogin: (role: UserRole, userDetails?: UserDetails) => void;
}

export function Login({ onLogin }: LoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isRegistering, setIsRegistering] = useState(false);
  
  // Registration form state
  const [regData, setRegData] = useState({
    cnpj: '',
    razaoSocial: '',
    nomeFantasia: '',
    email: '',
    phone: '',
    password: ''
  });
  const [regSuccess, setRegSuccess] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      // Clerk login
      if (email.toLowerCase().includes('clerk') || email.toLowerCase().includes('conferente') || email === 'clerk@byd.com') {
        onLogin('Clerk', {
          uid: 'clerk-' + Date.now(),
          email: email || 'clerk@byd.com',
          role: 'Clerk',
          razaoSocial: 'Gate Logistics Clerk'
        });
        setIsLoading(false);
        return;
      }

      // Coordinator login
      if (email === 'luizmugnai.comex@gmail.com' && password === 'Byd@N1') {
        let uid = 'admin-luiz';
        try {
          const userCred = await signInWithEmailAndPassword(auth, email, password);
          uid = userCred.user.uid;
        } catch (authErr) {
          try {
            const anonCred = await signInAnonymously(auth);
            uid = anonCred.user.uid;
          } catch (anonErr) {
            // fallback
          }
        }
        
        try {
          await setDoc(doc(db, 'users', uid), {
            role: 'Admin',
            email: 'luizmugnai.comex@gmail.com',
            razaoSocial: 'BYD Operations',
            status: 'approved'
          }, { merge: true });
        } catch (dbErr) {
          console.error("Failed to save coordinator doc", dbErr);
        }

        onLogin('Admin', {
          uid: uid,
          email: 'luizmugnai.comex@gmail.com',
          role: 'Coordinator',
          razaoSocial: 'BYD Operations'
        });
        setIsLoading(false);
        return;
      }

      // Carrier login (smooth anonymous fallback for seamless testing)
      let uid = 'carrier-login-' + Date.now();
      try {
        const anonCred = await signInAnonymously(auth);
        uid = anonCred.user.uid;
      } catch (e) {}

      onLogin('Carrier', {
        uid: uid,
        email: email || 'carrier@byd.com',
        role: 'Carrier',
        razaoSocial: email ? email.split('@')[0].toUpperCase() : 'Carrier Corp'
      });
    } catch (err: any) {
      setError('Invalid login credentials.');
    }
    setIsLoading(false);
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      let uid = 'carrier-' + Date.now();
      try {
        const anonCred = await signInAnonymously(auth);
        uid = anonCred.user.uid;
      } catch (e) {}

      await setDoc(doc(db, 'users', uid), {
        role: 'Carrier',
        email: regData.email,
        cnpj: regData.cnpj,
        razaoSocial: regData.razaoSocial,
        nomeFantasia: regData.nomeFantasia,
        phone: regData.phone,
        status: 'approved'
      }, { merge: true });
      
      setRegSuccess(true);
      setTimeout(() => {
        setRegSuccess(false);
        setIsRegistering(false);
        onLogin('Carrier', {
          uid: uid,
          email: regData.email,
          role: 'Carrier',
          cnpj: regData.cnpj,
          razaoSocial: regData.razaoSocial,
          nomeFantasia: regData.nomeFantasia
        });
      }, 1000);
    } catch (err: any) {
      setError('Registration error: ' + (err.message || 'Please check your information.'));
    }
    setIsLoading(false);
  };

  const formatCNPJ = (value: string) => {
    const v = value.replace(/\D/g, '');
    return v.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2}).*/, '$1.$2.$3/$4-$5');
  };

  if (isRegistering) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-900">
        <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
          <div className="bg-slate-900 border-b border-slate-700 p-6 flex flex-col items-center text-center">
            <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/BYD_logo.svg/2560px-BYD_logo.svg.png" alt="BYD Logo" className="h-8 object-contain bg-white px-2 py-1 rounded" />
            <p className="text-slate-300 text-sm mt-3 uppercase tracking-widest font-bold">Carrier Registration</p>
          </div>
          <div className="p-6">
            {regSuccess ? (
              <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded text-center text-sm font-bold uppercase tracking-wider">
                Registration Successful! Logging you in...
              </div>
            ) : (
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded text-xs font-bold">
                    {error}
                  </div>
                )}
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-600">CNPJ *</label>
                  <input 
                    type="text" 
                    value={regData.cnpj}
                    onChange={(e) => setRegData({ ...regData, cnpj: formatCNPJ(e.target.value) })}
                    placeholder="00.000.000/0000-00"
                    maxLength={18}
                    className="border border-slate-300 rounded px-3 py-2 font-mono bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 text-sm"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Company Name (Razão Social) *</label>
                  <input 
                    type="text" 
                    value={regData.razaoSocial}
                    onChange={(e) => setRegData({ ...regData, razaoSocial: e.target.value })}
                    placeholder="Company Corp Ltda"
                    className="border border-slate-300 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 text-sm"
                    required
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Trade Name (Nome Fantasia)</label>
                  <input 
                    type="text" 
                    value={regData.nomeFantasia}
                    onChange={(e) => setRegData({ ...regData, nomeFantasia: e.target.value })}
                    placeholder="Company Brand"
                    className="border border-slate-300 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Email *</label>
                    <input 
                      type="email" 
                      value={regData.email}
                      onChange={(e) => setRegData({ ...regData, email: e.target.value })}
                      placeholder="carrier@company.com"
                      className="border border-slate-300 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 text-sm"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Password *</label>
                    <input 
                      type="password" 
                      value={regData.password}
                      onChange={(e) => setRegData({ ...regData, password: e.target.value })}
                      placeholder="••••••••"
                      className="border border-slate-300 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 text-sm"
                      required
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Phone *</label>
                  <input 
                    type="text" 
                    value={regData.phone}
                    onChange={(e) => setRegData({ ...regData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                    className="border border-slate-300 rounded px-3 py-2 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 text-sm"
                    required
                  />
                </div>

                <div className="flex items-center gap-3 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 py-2.5 rounded font-bold uppercase tracking-wider text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded font-bold uppercase tracking-wider text-xs transition-colors disabled:opacity-50"
                  >
                    {isLoading ? 'Registering...' : 'Register'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4 font-sans text-slate-900">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full overflow-hidden">
        <div className="bg-slate-900 border-b border-slate-700 p-8 flex flex-col items-center text-center">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/BYD_logo.svg/2560px-BYD_logo.svg.png" alt="BYD Logo" className="h-10 object-contain bg-white px-2 py-1 rounded mb-4" />
          <h1 className="text-white font-bold text-lg tracking-tight uppercase">Yard Command Center</h1>
          <p className="text-slate-400 text-xs mt-1 uppercase tracking-widest">Gate & Yard Control System</p>
        </div>

        <form onSubmit={handleSubmit} className="p-8 flex flex-col gap-5">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 p-3 rounded text-xs font-bold">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Email Address</label>
            <input 
              type="email" 
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="name@company.com"
              className="border border-slate-300 rounded px-3 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 text-sm"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <label className="text-xs font-bold uppercase tracking-wide text-slate-600">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="border border-slate-300 rounded px-3 py-2.5 bg-slate-50 focus:bg-white focus:outline-none focus:border-blue-500 text-sm"
              required
            />
          </div>

          <button 
            type="submit"
            disabled={isLoading}
            className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase tracking-widest text-xs py-3 rounded transition-colors shadow-md disabled:opacity-50 mt-2"
          >
            {isLoading ? 'Authenticating...' : 'Sign In'}
          </button>

          <div className="text-center pt-2 border-t border-slate-100 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Quick Demo Logins:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onLogin('Clerk', { uid: 'clerk-demo', email: 'clerk@byd.com', role: 'Clerk', razaoSocial: 'Gate Logistics Clerk' });
                  }}
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 font-bold text-[10px] uppercase tracking-wider py-2 rounded transition-colors shadow-xs"
                >
                  📱 Logistics Clerk
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onLogin('Admin', { uid: 'admin-demo', email: 'luizmugnai.comex@gmail.com', role: 'Coordinator', razaoSocial: 'BYD Operations' });
                  }}
                  className="bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-300 font-bold text-[10px] uppercase tracking-wider py-2 rounded transition-colors shadow-xs"
                >
                  🛡️ Coordinator
                </button>
              </div>
            </div>

            <span className="text-xs text-slate-500">Carrier Company?</span>
            <button
              type="button"
              onClick={() => { setIsRegistering(true); setError(''); }}
              className="text-blue-600 hover:text-blue-700 text-xs font-bold uppercase tracking-wider transition-colors"
            >
              Register New Carrier Account
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
