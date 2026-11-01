import { useEffect } from 'react';
import Sheet from '../components/Sheet';
import Icon from '../components/Icon';
import AnimatedNumber from '../components/AnimatedNumber';
import { formatPoints, haptic } from '../lib/format';

/** Kasada puan yüklendiğinde müşteriye gösterilen onay. */
export default function EarnSheet({ data, onClose }) {
  useEffect(() => {
    if (data) haptic([10, 40, 18]);
  }, [data?.key]);
  return (
    <Sheet open={Boolean(data)} onClose={onClose}>
      {data && (
        <div className="earned">
          <span className="check-ring">
            <Icon name="check" size={44} stroke={2.6} />
          </span>
          <h2 className="num">
            +<AnimatedNumber value={data.delta} duration={900} /> puan
          </h2>
          <p>Hesabına eklendi. Toplam puanın {formatPoints(data.total)}.</p>
          <button className="btn btn-primary btn-block btn-caps" style={{ marginTop: 18 }} onClick={onClose}>
            Harika
          </button>
        </div>
      )}
    </Sheet>
  );
}
