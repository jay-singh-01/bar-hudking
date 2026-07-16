import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

interface AuthContextValue {
  session: Session | null;
  loading: boolean;
  error: string | null;
}

const AuthContext = createContext<AuthContextValue>({
  session: null,
  loading: true,
  error: null,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function init() {
      const {
        data: { session: existing },
      } = await supabase.auth.getSession();

      if (existing) {
        if (mounted) {
          setSession(existing);
          setLoading(false);
        }
        return;
      }

      // No persisted session yet: create an anonymous one. Supabase persists
      // it to localStorage, so returning visits reuse the same user_id and
      // therefore the same favorites/visited rows.
      const { data, error: signInError } =
        await supabase.auth.signInAnonymously();
      if (!mounted) return;

      if (signInError) {
        setError(signInError.message);
      } else {
        setSession(data.session);
      }
      setLoading(false);
    }

    init();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, error }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
