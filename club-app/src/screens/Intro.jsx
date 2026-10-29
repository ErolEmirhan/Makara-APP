import { useState } from 'react';
import { motion } from 'framer-motion';
import Stage3D from '../three/Stage3D';
import Sparkles from '../components/Sparkles';
import AuthSheet from './AuthSheet';
import { useAppData } from '../data/AppData';
import { PROGRAM } from '../config/loyalty';
import { formatPoints } from '../lib/format';

const rise = {
  hidden: { opacity: 0, y: 24, filter: 'blur(8px)' },
  show: (i) => ({
    opacity: 1,
    y: 0,
    filter: 'blur(0px)',
    transition: { delay: 0.5 + i * 0.12, duration: 0.9, ease: [0.16, 1, 0.3, 1] },
  }),
};

export default function Intro() {
  const { mode } = useAppData();
  const [auth, setAuth] = useState(null);

  return (
    <div className="app-shell">
      <main className="intro">
        <motion.div className="intro-top" initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <img className="wordmark" src={`${import.meta.env.BASE_URL}wordmark-pink.png`} alt="MAKARA" />
          <span className="badge is-soft">CLUB</span>
        </motion.div>

        <div className="intro-stage">
          <div className="intro-glow" />
          <Sparkles count={22} />
          <Stage3D model="roll" elevation={34} zoom={0.92} spin={0.28} />
        </div>

        <div className="intro-copy">
          <motion.h1 className="hero-title" variants={rise} initial="hidden" animate="show" custom={0}>
            Her tatlı an,
            <br />
            <span className="gradient-text">puana dönüşür.</span>
          </motion.h1>
          <motion.p className="hero-sub" variants={rise} initial="hidden" animate="show" custom={1}>
            MAKARA Club'a katıl; kasada kartını okut, puan biriktir, en sevdiğin lezzetleri hediye al.
            Üye olana {formatPoints(PROGRAM.welcomeBonus)} puan bizden.
          </motion.p>
          <motion.div className="steps" variants={rise} initial="hidden" animate="show" custom={2}>
            <span className="step"><b>1</b>Okut</span>
            <span className="step"><b>2</b>Kazan</span>
            <span className="step"><b>3</b>Tadını çıkar</span>
          </motion.div>
        </div>

        <motion.div className="intro-actions" variants={rise} initial="hidden" animate="show" custom={3}>
          <button className="btn btn-primary btn-block" onClick={() => setAuth('signup')}>
            Ücretsiz Üye Ol
          </button>
          <button className="btn btn-ghost btn-block" onClick={() => setAuth('signin')}>
            Zaten üyeyim
          </button>
          {mode === 'demo' && <p className="mode-note">Demo modu · bilgiler yalnızca bu cihazda saklanır</p>}
        </motion.div>
      </main>
      <AuthSheet mode={auth} onModeChange={setAuth} onClose={() => setAuth(null)} />
    </div>
  );
}
