import DaySection from './DaySection.jsx';
import Notes from './Notes.jsx';
import styles from './App.module.css';

const DAY_COUNT = 10;

function getDays() {
  const days = [];
  const now = new Date();
  for (let i = 0; i < DAY_COUNT; i++) {
    const d = new Date(now);
    d.setDate(now.getDate() + i);
    days.push(d);
  }
  return days;
}

function dateKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function App() {
  const days = getDays();

  return (
    <div className={styles.app}>
      <header className={styles.header}>
        <h1 className={styles.title}>
          PADEL <span className={styles.accent}>SHMADEL</span>
        </h1>
        <p className={styles.tagline}>Let's find 4 people for a 1.5 hour slot. Next 10 days.</p>
      </header>

      <main className={styles.main}>
        {days.map((day, i) => (
          <DaySection key={dateKey(day)} day={day} dayIndex={i} docId={dateKey(day)} />
        ))}
        <Notes lang="en" />
      </main>
    </div>
  );
}
