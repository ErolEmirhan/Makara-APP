import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useAppData } from '../data/AppData';
import { ToastProvider, useToast } from '../components/Toast';
import Splash from '../components/Splash';
import TabBar from '../components/TabBar';
import Sheet from '../components/Sheet';
import ActivityList from '../components/ActivityList';
import Celebration from '../components/Celebration';
import Icon from '../components/Icon';
import Intro from './Intro';
import CompleteProfile from './CompleteProfile';
import Home from './Home';
import Rewards from './Rewards';
import RewardSheet from './RewardSheet';
import Offers from './Offers';
import Profile from './Profile';
import MemberPass from './MemberPass';
import SimulateSheet from './SimulateSheet';

const TAB_ORDER = ['home', 'rewards', 'offers', 'profile'];

function MainApp() {
  const { member, activity } = useAppData();
  const toast = useToast();
  const [tab, setTab] = useState('home');
  const [direction, setDirection] = useState(1);
  const [passOpen, setPassOpen] = useState(false);
  const [reward, setReward] = useState(null);
  const [rewardOpen, setRewardOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [simOpen, setSimOpen] = useState(false);
  const [celebration, setCelebration] = useState(null);
  const lastPoints = useRef(member.points);

  // Puan arttığında (kasadan yükleme) kutlama; azaldığında (ödül) bildirim.
  useEffect(() => {
    const prev = lastPoints.current;
    lastPoints.current = member.points;
    if (prev === undefined || prev === member.points) return;
    if (member.points > prev) {
      setPassOpen(false);
      setCelebration({ delta: member.points - prev, total: member.points, key: Date.now() });
    } else {
      const last = activity.find((a) => a.type === 'redeem');
      toast(last ? `${last.title} ödülün onaylandı · afiyet olsun!` : 'Ödülün onaylandı', <Icon name="gift" size={18} />);
    }
  }, [member.points]);

  const goTab = useCallback(
    (next) => {
      setDirection(TAB_ORDER.indexOf(next) >= TAB_ORDER.indexOf(tab) ? 1 : -1);
      setTab(next);
      window.scrollTo({ top: 0 });
    },
    [tab],
  );

  const openReward = useCallback((r) => {
    setReward(r);
    setRewardOpen(true);
  }, []);

  const screens = {
    home: (
      <Home
        onOpenCard={() => setPassOpen(true)}
        onOpenReward={openReward}
        onOpenActivity={() => setActivityOpen(true)}
        onGoTab={goTab}
        onSimulate={() => setSimOpen(true)}
      />
    ),
    rewards: <Rewards onOpenReward={openReward} />,
    offers: <Offers />,
    profile: <Profile onOpenActivity={() => setActivityOpen(true)} onSimulate={() => setSimOpen(true)} />,
  };

  return (
    <div className="app-shell">
      <div className="ambient" />
      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.div
          key={tab}
          custom={direction}
          initial={{ opacity: 0, x: 24 * direction }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -24 * direction }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
        >
          {screens[tab]}
        </motion.div>
      </AnimatePresence>

      <TabBar active={tab} onChange={goTab} onCard={() => setPassOpen(true)} />

      <MemberPass open={passOpen} onClose={() => setPassOpen(false)} />
      <RewardSheet reward={reward} open={rewardOpen} onClose={() => setRewardOpen(false)} />
      <Sheet open={activityOpen} onClose={() => setActivityOpen(false)} title="Puan geçmişi" tall>
        <ActivityList items={activity} grouped />
      </Sheet>
      <SimulateSheet open={simOpen} onClose={() => setSimOpen(false)} />
      <Celebration data={celebration} onDone={() => setCelebration(null)} />
    </div>
  );
}

export default function CustomerApp() {
  const { ready, user, member, needsProfile, busy } = useAppData();
  if (!ready) return <Splash />;
  if (!user || (busy && !member)) return <Intro />;
  if (needsProfile) return <CompleteProfile />;
  if (!member) return <Splash />;
  return (
    <ToastProvider>
      <MainApp />
    </ToastProvider>
  );
}
