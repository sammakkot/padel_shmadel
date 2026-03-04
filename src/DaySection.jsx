import { useState, useEffect, useRef } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import styles from './DaySection.module.css';

// ── Time helpers ──────────────────────────────────────────────────────────────

const TIMES = [];
for (let h = 7; h <= 22; h++) {
  TIMES.push(`${h}:00`);
  if (h < 22) TIMES.push(`${h}:30`);
}

function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m === 0 ? '00' : '30'} ${suffix}`;
}

function timeToMins(t) {
  if (!t) return null;
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}

function hasCommonWindow(players) {
  const filled = players.filter(p => p.name && p.from && p.till);
  if (filled.length < 4) return false;
  const ranges = filled.map(p => ({
    from: timeToMins(p.from),
    till: timeToMins(p.till),
  }));
  const overlapStart = Math.max(...ranges.map(r => r.from));
  const overlapEnd = Math.min(...ranges.map(r => r.till));
  return overlapEnd - overlapStart >= 90;
}

function emptyPlayer() {
  return { name: '', from: '', till: '', willBook: false };
}

// ── Date label helpers ────────────────────────────────────────────────────────

const DAY_NAMES_EN = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES_EN = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES_RU = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const MONTH_NAMES_RU = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function DaySection({ day, dayIndex, docId, lang = 'en' }) {
  const [players, setPlayers] = useState([
    emptyPlayer(), emptyPlayer(), emptyPlayer(), emptyPlayer(),
  ]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const prevMatch = useRef(false);
  const [celebrate, setCelebrate] = useState(false);

  const isRu = lang === 'ru';
  const T = {
    today:             isRu ? 'Сегодня'          : 'Today',
    tomorrow:          isRu ? 'Завтра'            : 'Tomorrow',
    matchFound:        isRu ? '✓ Игра состоится!' : '✓ Game On!',
    playerPlaceholder: isRu ? 'Имя игрока'        : 'Player name',
    from:              isRu ? 'С'                 : 'From',
    till:              isRu ? 'До'                : 'Till',
    book:              isRu ? 'Бронь'             : 'Book',
    addMore:           isRu ? '+ Добавить игрока' : '+ Add another player',
    loading:           isRu ? 'Загрузка…'         : 'Loading…',
    dayNames:          isRu ? DAY_NAMES_RU        : DAY_NAMES_EN,
    monthNames:        isRu ? MONTH_NAMES_RU      : MONTH_NAMES_EN,
  };

  // ── Subscribe to Firestore ──────────────────────────────────────────────────
  useEffect(() => {
    const ref = doc(db, 'days', docId);
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setPlayers(data.players || [emptyPlayer(), emptyPlayer(), emptyPlayer(), emptyPlayer()]);
      }
      setLoading(false);
    }, (err) => {
      console.error('Firestore listen error:', err);
      setLoading(false);
    });
    return unsub;
  }, [docId]);

  // ── Reactive match detection + celebration ──────────────────────────────────
  const matched = hasCommonWindow(players);

  useEffect(() => {
    if (matched && !prevMatch.current) {
      setCelebrate(true);
      const t = setTimeout(() => setCelebrate(false), 2800);
      prevMatch.current = true;
      return () => clearTimeout(t);
    }
    if (!matched) {
      prevMatch.current = false;
      setCelebrate(false);
    }
  }, [matched]);

  // ── Save to Firestore ───────────────────────────────────────────────────────
  const saveToFirestore = async (newPlayers) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'days', docId), { players: newPlayers }, { merge: true });
    } catch (err) {
      console.error('Save error:', err);
    }
    setSaving(false);
  };

  // ── Field updates ───────────────────────────────────────────────────────────
  const updatePlayer = (idx, field, value) => {
    setPlayers(prev => {
      const next = prev.map((p, i) => (i === idx ? { ...p, [field]: value } : p));
      saveToFirestore(next);
      return next;
    });
  };

  const toggleBook = (idx) => {
    setPlayers(prev => {
      const isChecking = !prev[idx].willBook;
      const next = prev.map((p, i) => ({
        ...p,
        willBook: i === idx ? isChecking : isChecking ? false : p.willBook,
      }));
      saveToFirestore(next);
      return next;
    });
  };

  const addMore = () => {
    setPlayers(prev => {
      const next = [...prev, emptyPlayer()];
      saveToFirestore(next);
      return next;
    });
  };

  // ── Derived state ───────────────────────────────────────────────────────────
  const bookerIdx = players.findIndex(p => p.willBook);
  const label = dayIndex === 0 ? T.today : dayIndex === 1 ? T.tomorrow : T.dayNames[day.getDay()];
  const dateStr = `${T.monthNames[day.getMonth()]} ${day.getDate()}`;

  const sectionClass = [
    styles.section,
    matched ? styles.matched : '',
    celebrate ? styles.celebrate : '',
  ].filter(Boolean).join(' ');

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <section className={sectionClass}>
      {matched && <div className={styles.shimmer} />}
      <div className={styles.header}>
        <div className={styles.dayLabel}>
          <span className={styles.dayName}>{label}</span>
          <span className={styles.dayDate}>{dateStr}</span>
        </div>
        <div className={styles.badges}>
          {matched && <span className={styles.matchBadge}>{T.matchFound}</span>}
          {saving && <span className={styles.savingDot} title="Saving…" />}
        </div>
      </div>

      {loading ? (
        <p className={styles.loading}>{T.loading}</p>
      ) : (
        <>
          <div className={styles.grid}>
            {players.map((p, idx) => {
              const isBooker = bookerIdx === idx;
              const grayed = bookerIdx !== -1 && !isBooker;
              return (
                <div key={idx} className={`${styles.row} ${grayed ? styles.grayed : ''}`}>
                  <span className={styles.slotNum}>{idx + 1}</span>
                  <input
                    className={styles.nameInput}
                    placeholder={T.playerPlaceholder}
                    value={p.name}
                    onChange={e => updatePlayer(idx, 'name', e.target.value)}
                  />
                  <select
                    className={styles.timeSelect}
                    value={p.from}
                    onChange={e => updatePlayer(idx, 'from', e.target.value)}
                  >
                    <option value="">{T.from}</option>
                    {TIMES.map(t => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                  </select>
                  <select
                    className={styles.timeSelect}
                    value={p.till}
                    onChange={e => updatePlayer(idx, 'till', e.target.value)}
                  >
                    <option value="">{T.till}</option>
                    {TIMES.map(t => (
                      <option key={t} value={t}>{formatTime(t)}</option>
                    ))}
                  </select>
                  <label className={`${styles.bookLabel} ${grayed ? styles.bookDisabled : ''}`}>
                    <input
                      type="checkbox"
                      checked={p.willBook}
                      disabled={grayed}
                      onChange={() => toggleBook(idx)}
                    />
                    <span className={styles.bookText}>{T.book}</span>
                  </label>
                </div>
              );
            })}
          </div>
          <button className={styles.addMore} onClick={addMore}>
            {T.addMore}
          </button>
        </>
      )}
    </section>
  );
}
