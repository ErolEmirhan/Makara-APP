import { BranchProvider, useBranch } from './context/BranchContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider } from './context/AppContext';
import { BranchSetup } from './components/auth/BranchSetup';
import { LoginScreen } from './components/auth/LoginScreen';
import { SplashScreen } from './components/auth/SplashScreen';
import { MainScreen } from './screens/MainScreen';

function AppRouter() {
  const { configured, connecting } = useBranch();
  const { phase } = useAuth();

  if (!configured) {
    if (connecting) {
      return (
        <div className="min-h-dvh flex items-center justify-center bg-slate-950">
          <div className="w-10 h-10 border-4 border-indigo-300 border-t-indigo-500 rounded-full animate-spin" />
        </div>
      );
    }
    return <BranchSetup />;
  }
  if (phase === 'login') return <LoginScreen />;
  if (phase === 'splash') return <SplashScreen />;
  return <MainScreen />;
}

export default function App() {
  return (
    <BranchProvider>
      <AuthProvider>
        <AppProvider>
          <AppRouter />
        </AppProvider>
      </AuthProvider>
    </BranchProvider>
  );
}
