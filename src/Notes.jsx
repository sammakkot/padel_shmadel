import { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { db } from './firebase.js';
import styles from './Notes.module.css';

const NOTE_COUNT = 5;

function emptyNotes() {
  return Array(NOTE_COUNT).fill('');
}

export default function Notes({ lang = 'en' }) {
  const [notes, setNotes] = useState(emptyNotes());
  const [saving, setSaving] = useState(false);

  const isRu = lang === 'ru';
  const T = {
    title:       isRu ? 'Заметки'                                          : 'Notes',
    placeholder0: isRu ? 'Например: Петя выбыл до конца марта с травмой'  : 'e.g. John is out with injury till end of March',
    placeholder:  isRu ? 'Добавить заметку…'                              : 'Add a note…',
  };

  useEffect(() => {
    const ref = doc(db, 'meta', 'notes');
    const unsub = onSnapshot(ref, (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setNotes(data.notes || emptyNotes());
      }
    }, err => console.error('Notes listen error:', err));
    return unsub;
  }, []);

  const saveNotes = async (newNotes) => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'meta', 'notes'), { notes: newNotes }, { merge: true });
    } catch (err) {
      console.error('Notes save error:', err);
    }
    setSaving(false);
  };

  const updateNote = (idx, value) => {
    const next = notes.map((n, i) => i === idx ? value : n);
    setNotes(next);
    saveNotes(next);
  };

  return (
    <section className={styles.section}>
      <div className={styles.header}>
        <span className={styles.title}>{T.title}</span>
        {saving && <span className={styles.savingDot} />}
      </div>
      <div className={styles.list}>
        {notes.map((note, idx) => (
          <input
            key={idx}
            className={styles.noteInput}
            type="text"
            value={note}
            placeholder={idx === 0 ? T.placeholder0 : T.placeholder}
            onChange={e => updateNote(idx, e.target.value)}
          />
        ))}
      </div>
    </section>
  );
}
