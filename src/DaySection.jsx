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

// Check if a specific array of players (all must be filled) share a 90-min window
function groupHasWindow(group) {
  if (group.some(p => !p.name || !p.from || !p.till)) return false;
  const overlapStart = Math.max(...group.map(p => timeToMins(p.from)));
  const overlapEnd   = Math.min(...group.map(p => timeToMins(p.till)));
  return overlapEnd - overlapStart >= 90;
}

// Return combinations of size k from array
function combinations(arr, k) {
  if (k === 0) return [[]];
  if (arr.length < k) return [];
  const [first, ...rest] = arr;
  const withFirst    = combinations(rest, k - 1).map(c => [first, ...c]);
  const withoutFirst = combinations(rest, k);
  return [...withFirst, ...withoutFirst];
}

// Core analysis: returns { matched, playingIndices, outIndices, unsettled, windowFrom, windowTill }
function analyzeDay(players) {
  const filledIndices = players
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p.name && p.from && p.till)
    .map(({ i }) => i);

  const filledCount = filledIndices.length;

  // Not enough players yet
  if (filledCount < 4) {
    return { matched: false, playingIndices: null, outIndices: [], unsettled: false, windowFrom: null, windowTill: null };
  }

  // Try all combinations of 4 filled players to find a winning group
  const combos = combinations(filledIndices, 4);
  for (const combo of combos) {
    const group = combo.map(i => players[i]);
    if (groupHasWindow(group)) {
      const outIndices = filledIndices.filter(i => !combo.includes(i));
      // Calculate the actual overlap window
      const overlapStart = Math.max(...group.map(p => timeToMins(p.from)));
      const overlapEnd   = Math.min(...group.map(p => timeToMins(p.till)));
      // Convert minutes back to time string
      const toTimeStr = mins => `${Math.floor(mins/60)}:${mins%60 === 0 ? '00' : '30'}`;
      return {
        matched: true,
        playingIndices: combo,
        outIndices,
        unsettled: false,
        windowFrom: toTimeStr(overlapStart),
        windowTill: toTimeStr(overlapEnd),
      };
    }
  }

  // 4+ filled but no matching window
  return { matched: false, playingIndices: null, outIndices: [], unsettled: filledCount >= 4, windowFrom: null, windowTill: null };
}

function emptyPlayer() {
  return { name: '', from: '', till: '', willBook: false };
}

// ── Locale strings ────────────────────────────────────────────────────────────

const DAY_NAMES_EN    = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES_EN  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DAY_NAMES_RU    = ['Воскресенье','Понедельник','Вторник','Среда','Четверг','Пятница','Суббота'];
const MONTH_NAMES_RU  = ['янв','фев','мар','апр','май','июн','июл','авг','сен','окт','ноя','дек'];

// ── Component ─────────────────────────────────────────────────────────────────

export default function DaySection({ day, dayIndex, docId, lang = 'en' }) {
  const [players, setPlayers] = useState([
    emptyPlayer(), emptyPlayer(), emptyPlayer(), emptyPlayer(),
  ]);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);
  const prevMatch               = useRef(false);
  const [celebrate, setCelebrate] = useState(false);

  const isRu = lang === 'ru';
  const T = {
    today:             isRu ? 'Сегодня'                              : 'Today',
    tomorrow:          isRu ? 'Завтра'                               : 'Tomorrow',
    matchFound:        isRu ? '✓ Игра состоится!'                    : '✓ Game On!',
    unsettled:         isRu ? '⚠ Игроки ещё не согласовали время'   : '⚠ Players haven\'t found a common slot yet',
    playerPlaceholder: isRu ? 'Имя игрока'                          : 'Player name',
    from:              isRu ? 'С'                                    : 'From',
    till:              isRu ? 'До'                                   : 'Till',
    willBook:          isRu ? 'Я бронирую'                          : 'I will book',
    addMore:           isRu ? '+ Добавить игрока'                   : '+ Add another player',
    resetDay:          isRu ? 'Сбросить день'                       : 'Reset day',
    resetConfirm:      isRu ? 'Сбросить все записи на этот день? Это действие нельзя отменить.' : 'Reset all entries for this day? This cannot be undone.',
    loading:           isRu ? 'Загрузка…'                           : 'Loading…',
    notPlaying:        isRu ? 'не играет'                           : 'not playing',
    dayNames:          isRu ? DAY_NAMES_RU                          : DAY_NAMES_EN,
    monthNames:        isRu ? MONTH_NAMES_RU                        : MONTH_NAMES_EN,
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

  // ── Derived analysis ────────────────────────────────────────────────────────
  const { matched, playingIndices, outIndices, unsettled, windowFrom, windowTill } = analyzeDay(players);

  // ── Celebration trigger ─────────────────────────────────────────────────────
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

  const resetDay = () => {
    const blank = [emptyPlayer(), emptyPlayer(), emptyPlayer(), emptyPlayer()];
    setPlayers(blank);
    saveToFirestore(blank);
  };

  // ── Derived display ─────────────────────────────────────────────────────────
  const bookerIdx  = players.findIndex(p => p.willBook);
  const label      = dayIndex === 0 ? T.today : dayIndex === 1 ? T.tomorrow : T.dayNames[day.getDay()];
  const dateStr    = `${T.monthNames[day.getMonth()]} ${day.getDate()}`;

  const sectionClass = [
    styles.section,
    matched   ? styles.matched   : '',
    celebrate ? styles.celebrate : '',
    unsettled ? styles.unsettled : '',
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
          {matched && (
            <div className={styles.matchInfo}>
              <span className={styles.matchBadge}>{T.matchFound}</span>
              <span className={styles.matchWindow}>
                {formatTime(windowFrom)} – {formatTime(windowTill)}
              </span>
            </div>
          )}
          {saving     && <span className={styles.savingDot} title="Saving…" />}
        </div>
      </div>

      {/* Unsettled warning */}
      {unsettled && !matched && (
        <div className={styles.warningBanner}>
          {T.unsettled}
        </div>
      )}

      {loading ? (
        <p className={styles.loading}>{T.loading}</p>
      ) : (
        <>
          <div className={styles.grid}>
            {players.map((p, idx) => {
              const isBooker  = bookerIdx === idx;
              const grayed    = bookerIdx !== -1 && !isBooker;
              const isOut     = outIndices.includes(idx);

              return (
                <div
                  key={idx}
                  className={[
                    styles.row,
                    grayed ? styles.grayed  : '',
                    isOut  ? styles.out     : '',
                  ].filter(Boolean).join(' ')}
                >
                  <span className={styles.slotNum}>{idx + 1}</span>

                  <div className={styles.nameCell}>
                    <input
                      className={styles.nameInput}
                      placeholder={T.playerPlaceholder}
                      value={p.name}
                      onChange={e => updatePlayer(idx, 'name', e.target.value)}
                    />
                    {isOut && (
                      <span className={styles.notPlayingTag}>{T.notPlaying}</span>
                    )}
                  </div>

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

                  <label className={`${styles.bookLabel} ${grayed || isOut ? styles.bookDisabled : ''}`}>
                    <input
                      type="checkbox"
                      checked={p.willBook}
                      disabled={grayed || isOut}
                      onChange={() => toggleBook(idx)}
                    />
                    <span className={styles.bookText}>{T.willBook}</span>
                  </label>
                </div>
              );
            })}
          </div>

          <button className={styles.addMore} onClick={addMore}>
            {T.addMore}
          </button>

          <button
            className={styles.resetBtn}
            onClick={() => { if (window.confirm(T.resetConfirm)) resetDay(); }}
          >
            {T.resetDay}
          </button>
        </>
      )}
    </section>
  );
}
