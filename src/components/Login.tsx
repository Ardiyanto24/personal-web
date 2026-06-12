import React, { useState } from 'react';
import { supabase } from '../lib/supabaseClient';
import { Mail, Lock, User, Eye, EyeOff, Sparkles } from 'lucide-react';

interface LoginProps {
  onAuthSuccess: () => void;
}

export const Login: React.FC<LoginProps> = ({ onAuthSuccess }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg(null);
    setInfoMsg(null);

    try {
      if (isSignUp) {
        // Sign Up Flow
        const { error, data } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              full_name: fullName,
            },
          },
        });

        if (error) throw error;

        // If email confirmation is required, inform user, else login
        if (data.session) {
          onAuthSuccess();
        } else {
          setInfoMsg('Registrasi berhasil! Silakan periksa email Anda untuk verifikasi akun.');
          // Clear inputs
          setEmail('');
          setPassword('');
          setFullName('');
        }
      } else {
        // Sign In Flow
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;
        onAuthSuccess();
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Terjadi kesalahan. Silakan coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-page-wrapper">
      <div className="ambient-glow" />
      
      <div className="auth-card-container glass-container">
        <div className="auth-header">
          <div className="brand-logo">
            <Sparkles className="logo-icon" />
          </div>
          <h1>Chronicle</h1>
          <p className="brand-subtitle">
            {isSignUp ? 'Buat jurnal personal Anda hari ini' : 'Catat aktivitas, keuangan, dan habit Anda'}
          </p>
        </div>

        {/* Auth Mode Toggle */}
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${!isSignUp ? 'active' : ''}`}
            onClick={() => {
              setIsSignUp(false);
              setErrorMsg(null);
              setInfoMsg(null);
            }}
          >
            Masuk
          </button>
          <button
            type="button"
            className={`auth-tab ${isSignUp ? 'active' : ''}`}
            onClick={() => {
              setIsSignUp(true);
              setErrorMsg(null);
              setInfoMsg(null);
            }}
          >
            Daftar
          </button>
        </div>

        {/* Error and Info Alerts */}
        {errorMsg && (
          <div className="auth-alert alert-error">
            <span>{errorMsg}</span>
          </div>
        )}
        {infoMsg && (
          <div className="auth-alert alert-success">
            <span>{infoMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="auth-form">
          {isSignUp && (
            <div className="form-group">
              <label className="form-label" htmlFor="fullName">Nama Lengkap</label>
              <div className="input-wrapper">
                <User className="input-field-icon" size={18} />
                <input
                  id="fullName"
                  type="text"
                  className="form-input with-icon"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={isSignUp}
                />
              </div>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="email">Email</label>
            <div className="input-wrapper">
              <Mail className="input-field-icon" size={18} />
              <input
                id="email"
                type="email"
                className="form-input with-icon"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">Kata Sandi</label>
            <div className="input-wrapper">
              <Lock className="input-field-icon" size={18} />
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                className="form-input with-icon pr-10"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
              <button
                type="button"
                className="password-toggle-btn"
                onClick={() => setShowPassword(!showPassword)}
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? (
              <span className="spinner" />
            ) : (
              <span>{isSignUp ? 'Buat Akun' : 'Masuk ke Chronicle'}</span>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
