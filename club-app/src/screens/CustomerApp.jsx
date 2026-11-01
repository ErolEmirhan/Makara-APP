import { useCallback, useEffect, useRef, useState } from 'react';
import { useAppData } from '../data/AppData';
import { ToastProvider, useToast } from '../components/Toast';
import Splash from '../components/Splash';
import TabBar from '../components/TabBar';
import Sheet from '../components/Sheet';
import ActivityList from '../components/ActivityList';
import Icon from '../components/Icon';
import Welcome from './Welcome';
import CompleteProfile from './CompleteProfile';
import Home from './Home';
import Menu from './Menu';
import ProductSheet from './ProductSheet';
import Rewards from './Rewards';
import RewardSheet from './RewardSheet';
import Profile from './Profile';
import MemberCode from './MemberCode';
import EarnSheet from './EarnSheet';
import OffersSheet from './OffersSheet';
import SimulateSheet from './SimulateSheet';

/** Kapanış animasyonu sırasında içerik kaybolmasın diye son değeri tutan sayfa durumu. */
function useSheet() {
  const [state, setState] = useState({ open: false, value: null });
  return {
    open: state.open,
    value: state.value,
    show: useCallback((value = null) => setState({ open: true, value }), []),
    hide: useCallback(() => setState((s) => ({ ...s, open: false })), []),
  };
}

function MainApp() {
  const { member, activity } = useAppData();
  const toast = useToast();
  const [tab, setTab] = useState('home');
  const [menuCategory, setMenuCategory] = useState(null);
  const code = useSheet();
  const reward = useSheet();
  const product = useSheet();
  const history = useSheet();
  const offers = useSheet();
  const simulate = useSheet();
  const [earned, setEarned] = useState(null);
  const lastPoints = useRef(member.points);

  // Puan arttığında (kasadan yükleme) onay; azaldığında (ödül) bildirim.
  useEffect(() => {
    const prev = lastPoints.current;
    lastPoints.current = member.points;
    if (prev === undefined || prev === member.points) return;
    if (member.points > prev) {
      code.hide();
      setEarned({ delta: member.points - prev, total: member.points, key: Date.now() });
    } else {
      const last = activity.find((a) => a.type === 'redeem');
      toast(last ? `${last.title} ödülün onaylandı` : 'Ödülün onaylandı', <Icon name="check" size={18} stroke={2.4} />);
    }
  }, [member.points]);

  const goTab = useCallback((next, categoryId = null) => {
    if (next === 'menu') setMenuCategory(categoryId);
    setTab(next);
    window.scrollTo({ top: 0 });
  }, []);

  const openReward = useCallback(
    (r) => {
      product.hide();
      reward.show(r);
    },
    [product, reward],
  );

  return (
    <div className="app-shell">
      {tab === 'home' && (
        <Home
          onOpenCode={() => code.show()}
          onOpenReward={openReward}
          onOpenProduct={product.show}
          onOpenActivity={() => history.show()}
          onOpenOffers={() => offers.show()}
          onGoTab={goTab}
          onSimulate={() => simulate.show()}
        />
      )}
      {tab === 'menu' && <Menu initialCategory={menuCategory} onOpenProduct={product.show} />}
      {tab === 'rewards' && <Rewards onOpenReward={openReward} />}
      {tab === 'profile' && <Profile onOpenActivity={() => history.show()} onSimulate={() => simulate.show()} />}

      <TabBar active={tab} onChange={goTab} onCode={() => code.show()} />

      <MemberCode open={code.open} onClose={code.hide} />
      <RewardSheet reward={reward.value} open={reward.open} onClose={reward.hide} />
      <ProductSheet product={product.value} open={product.open} onClose={product.hide} onOpenReward={openReward} />
      <OffersSheet open={offers.open} onClose={offers.hide} />
      <Sheet open={history.open} onClose={history.hide} title="Puan geçmişi" tall>
        <ActivityList items={activity} grouped />
      </Sheet>
      <SimulateSheet open={simulate.open} onClose={simulate.hide} />
      <EarnSheet data={earned} onClose={() => setEarned(null)} />
    </div>
  );
}

export default function CustomerApp() {
  const { ready, user, member, needsProfile, busy } = useAppData();
  if (!ready) return <Splash />;
  if (!user || (busy && !member)) return <Welcome />;
  if (needsProfile) return <CompleteProfile />;
  if (!member) return <Splash />;
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
