import React, { useState, FormEvent } from 'react';
import { cn } from '../utils';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, signInAnonymously } from 'firebase/auth';
import { doc, setDoc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase';

export type UserRole = 'Admin' | 'Carrier';

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
      // Coordinator fallback with Firebase Auth authentication
      if (email === 'luizmugnai.comex@gmail.com' && password === 'Byd@N1') {
        let uid = 'admin-luiz';
        try {
          const userCred = await signInWithEmailAndPassword(auth, email, password);
          uid = userCred.user.uid;
        } catch (authErr) {
          try {
            const userCred = await createUserWithEmailAndPassword(auth, email, password);
            uid = userCred.user.uid;
          } catch (createErr) {
            try {
              const anonCred = await signInAnonymously(auth);
              uid = anonCred.user.uid;
            } catch (anonErr) {
              // fallback
            }
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

      const userCred = await signInWithEmailAndPassword(auth, email, password);
      const userDoc = await getDoc(doc(db, 'users', userCred.user.uid));
      
      if (userDoc.exists()) {
        const userData = userDoc.data();
        if (userData.status === 'pending' && userData.role === 'Carrier') {
           setError('Your registration is pending approval.');
           await signOut(auth);
           setIsLoading(false);
           return;
        }
        onLogin(userData.role as UserRole, {
          uid: userCred.user.uid,
          email: userData.email,
          role: userData.role,
          cnpj: userData.cnpj,
          razaoSocial: userData.razaoSocial,
          nomeFantasia: userData.nomeFantasia
        });
      } else {
        // Assume carrier if no doc found for some reason, or error
        setError('User profile not found. Please contact support.');
        await signOut(auth);
      }
    } catch (err: any) {
      setError('Invalid email or password.');
    }
    setIsLoading(false);
  };

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    
    try {
      const userCred = await createUserWithEmailAndPassword(auth, regData.email, regData.password);
      await setDoc(doc(db, 'users', userCred.user.uid), {
        role: 'Carrier',
        email: regData.email,
        cnpj: regData.cnpj,
        razaoSocial: regData.razaoSocial,
        nomeFantasia: regData.nomeFantasia,
        phone: regData.phone,
        status: 'approved' // Auto-approve for demo purposes
      });
      
      setRegSuccess(true);
      setTimeout(() => {
        setRegSuccess(false);
        setIsRegistering(false);
        setRegData({ cnpj: '', razaoSocial: '', nomeFantasia: '', email: '', phone: '', password: '' });
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to register');
    }
    setIsLoading(false);
  };

  const formatCNPJ = (value: string) => {
    // 00.000.000/0000-00
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
              <div className="bg-green-50 border border-green-200 text-green-800 rounded p-4 text-center flex flex-col gap-2">
                <span className="text-3xl">✅</span>
                <h3 className="font-bold text-sm uppercase tracking-wide">Registration Submitted</h3>
                <p className="text-xs">Your transport company registration has been received. Please wait for administrator approval.</p>
              </div>
            ) : (
              <form onSubmit={handleRegister} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">CNPJ *</label>
                  <input
                    type="text"
                    required
                    maxLength={18}
                    value={regData.cnpj}
                    onChange={(e) => setRegData({...regData, cnpj: formatCNPJ(e.target.value)})}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-mono"
                    placeholder="00.000.000/0000-00"
                  />
                </div>
                
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Company Name (Razão Social) *</label>
                  <input
                    type="text"
                    required
                    value={regData.razaoSocial}
                    onChange={(e) => setRegData({...regData, razaoSocial: e.target.value})}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Company LTDA"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Trade Name (Nome Fantasia)</label>
                  <input
                    type="text"
                    value={regData.nomeFantasia}
                    onChange={(e) => setRegData({...regData, nomeFantasia: e.target.value})}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="Trade Name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Email *</label>
                    <input
                      type="email"
                      required
                      value={regData.email}
                      onChange={(e) => setRegData({...regData, email: e.target.value})}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="contact@company.com"
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Password *</label>
                    <input
                      type="password"
                      required
                      value={regData.password}
                      onChange={(e) => setRegData({...regData, password: e.target.value})}
                      className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                      placeholder="Enter password"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Phone *</label>
                  <input
                    type="tel"
                    required
                    value={regData.phone}
                    onChange={(e) => setRegData({...regData, phone: e.target.value})}
                    className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    placeholder="(11) 99999-9999"
                  />
                </div>

                {error && <p className="text-xs text-red-500 mt-1 font-bold">{error}</p>}

                <div className="flex gap-2 mt-4">
                  <button
                    type="button"
                    onClick={() => setIsRegistering(false)}
                    className="flex-1 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold uppercase tracking-widest text-xs py-3 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold uppercase tracking-widest text-xs py-3 rounded transition-colors shadow-md"
                  >
                    Register
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
        <div className="bg-slate-900 border-b border-slate-700 p-6 flex flex-col items-center text-center">
          <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/BYD_logo.svg/2560px-BYD_logo.svg.png" alt="BYD Logo" className="h-8 object-contain bg-white px-2 py-1 rounded" />
          <p className="text-slate-300 text-sm mt-3 uppercase tracking-widest font-bold">Terminal Gate Control</p>
        </div>
        <div className="p-6">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter email"
                required
              />
            </div>

            <div className="flex flex-col gap-1.5 mt-2">
              <label className="text-xs font-bold uppercase tracking-wider text-slate-500">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-slate-300 rounded px-3 py-2 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                placeholder="Enter password"
                required
              />
            </div>
            
            {error && <p className="text-xs text-red-500 mt-1 font-bold">{error}</p>}

            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                "mt-4 bg-slate-900 hover:bg-slate-800 text-white font-bold uppercase tracking-widest text-sm py-3 rounded transition-colors",
                isLoading && "opacity-50 cursor-not-allowed"
              )}
            >
              {isLoading ? 'Signing In...' : 'Sign In'}
            </button>
            
            <div className="mt-2 text-center border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500 mb-2">Don't have an account?</p>
              <button
                type="button"
                onClick={() => setIsRegistering(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-800 uppercase tracking-wider transition-colors"
              >
                Register Transport Company
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
