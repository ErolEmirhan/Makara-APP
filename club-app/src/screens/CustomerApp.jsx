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
import Club from './Club';
import AllRewardsSheet from './AllRewardsSheet';
import RewardSheet from './RewardSheet';
import More from './More';
import EditProfileSheet from './EditProfileSheet';
import TierSheet from './TierSheet';
import BranchesSheet from './BranchesSheet';
import MemberCode from './MemberCode';
import EarnSheet from './EarnSheet';
import SimulateSheet from './SimulateSheet';

/** Kapanış animasyonu sırasında içerik kaybolmasın diye son değeri tutan sayfa durumu. */
function useSheet() {
  const [state, setState] = useState({ open: false, value: null });
  const show = useCallback((value = null) => setState({ open: true, value }), []);
  const hide = useCallback(() => setState((s) => ({ ...s, open: false })), []);
  return { open: state.open, value: state.value, show, hide };
}

function MainApp() {
  const { member, activity } = useAppData();
  const toast = useToast();
  const [tab, setTab] = useState('home');
  const code = useSheet();
  const reward = useSheet();
  const allRewards = useSheet();
  const product = useSheet();
  const history = useSheet();
  const tier = useSheet();
  const branches = useSheet();
  const editProfile = useSheet();
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

  const goTab = useCallback((next) => {
    setTab(next);
    window.scrollTo({ top: 0 });
  }, []);

  const openReward = useCallback(
    (r) => {
      product.hide();
      allRewards.hide();
      reward.show(r);
    },
    [product.hide, allRewards.hide, reward.show],
  );

  return (
    <div className="app-shell">
      {tab === 'home' && (
        <Home
          onOpenCode={() => code.show()}
          onOpenReward={openReward}
          onOpenAllRewards={() => allRewards.show()}
          onOpenTier={() => tier.show()}
          onOpenBranches={() => branches.show()}
          onGoTab={goTab}
          onSimulate={() => simulate.show()}
        />
      )}
      {tab === 'menu' && <Menu onOpenProduct={product.show} />}
      {tab === 'club' && (
        <Club
          onOpenReward={openReward}
          onOpenAllRewards={() => allRewards.show()}
          onOpenHistory={() => history.show()}
          onOpenHow={() => tier.show()}
        />
      )}
      {tab === 'more' && (
        <More
          onEditProfile={() => editProfile.show()}
          onOpenHistory={() => history.show()}
          onOpenTier={() => tier.show()}
          onOpenBranches={() => branches.show()}
          onSimulate={() => simulate.show()}
        />
      )}

      <TabBar active={tab} onChange={goTab} onCode={() => code.show()} />

      <MemberCode open={code.open} onClose={code.hide} />
      <RewardSheet reward={reward.value} open={reward.open} onClose={reward.hide} />
      <AllRewardsSheet open={allRewards.open} onClose={allRewards.hide} onOpenReward={openReward} />
      <ProductSheet product={product.value} open={product.open} onClose={product.hide} onOpenReward={openReward} />
      <Sheet open={history.open} onClose={history.hide} title="Puan geçmişi" tall>
        <ActivityList items={activity} grouped />
      </Sheet>
      <TierSheet open={tier.open} onClose={tier.hide} />
      <BranchesSheet open={branches.open} onClose={branches.hide} />
      <EditProfileSheet open={editProfile.open} onClose={editProfile.hide} />
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
