import { useState, useEffect } from 'react';
import { supabase } from './lib/supabaseClient';
import { Login } from './components/Login';
import { Dashboard } from './components/Dashboard';

function App() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check active session on initial load
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen to changes in auth state (e.g. login, signout)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="auth-page-wrapper" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="ambient-glow" />
        <div className="spinner" style={{ width: '3rem', height: '3rem' }} />
      </div>
    );
  }

  return (
    <>
      {!session ? (
        <Login onAuthSuccess={() => supabase.auth.getSession().then(({ data: { session } }) => setSession(session))} />
      ) : (
        <Dashboard onLogout={() => setSession(null)} />
      )}
    </>
  );
}

export default App;
