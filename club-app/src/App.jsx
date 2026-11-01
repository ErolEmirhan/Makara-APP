import { lazy, Suspense, useEffect, useState } from 'react';
import { AppDataProvider } from './data/AppData';
import CustomerApp from './screens/CustomerApp';
import Splash from './components/Splash';

const KasaApp = lazy(() => import('./kasa/KasaApp'));

function useHashRoute() {
  const [hash, setHash] = useState(() => window.location.hash);
  useEffect(() => {
    const onHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return hash;
}

export default function App() {
  const hash = useHashRoute();
  // #kasa (önerilen) ve eski #/kasa biçimi
  const isKasa = hash === '#kasa' || hash.startsWith('#/kasa');
  return (
    <AppDataProvider>
      {isKasa ? (
        <Suspense fallback={<Splash />}>
          <KasaApp />
        </Suspense>
      ) : (
        <CustomerApp />
      )}
    </AppDataProvider>
  );
}
