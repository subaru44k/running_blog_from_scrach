import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AudioEngine } from '../../../lib/games/music/audio.mjs';
import { EASY_MUSIC, RHYTHM_TIMING, checkMelodyInput, chooseQuestion, countMissedNotes, easyNotes, isCorrectPitch, judgeRhythmTap, makeMelody, makeRhythmRound, melodyLength, noteFromMidi, rhythmTimelineAt } from '../../../lib/games/music/music.mjs';
import { FeedbackEffect, GameResult, MusicStaff, PianoKeyboard, ScoreDisplay, type MusicNote, type RhythmEvent } from './MusicParts';
import './music.css';

type Mode = 'note' | 'rhythm' | 'ear' | 'melody';
const noteLabel = (note: MusicNote) => ({ C: 'ド', D: 'レ', E: 'ミ', F: 'ファ', G: 'ソ', A: 'ラ', B: 'シ' } as Record<string, string>)[note.notationName] ?? note.notationName;
const modes: { id: Mode; icon: string; title: string; description: string; color: string }[] = [
  { id: 'note', icon: '𝄞', title: 'おんぷをよもう', description: 'がくふを見て、けんばんをおそう！', color: 'violet' },
  { id: 'rhythm', icon: '♩', title: 'リズムをたたこう', description: 'おんぷにあわせて、タップ！', color: 'peach' },
  { id: 'ear', icon: '♫', title: 'おとをきこう', description: 'きこえた音を、けんばんでさがそう！', color: 'mint' },
  { id: 'melody', icon: '♪', title: 'メロディまねっこ', description: 'おぼえたじゅんに、おしてみよう！', color: 'sky' },
];

function chromaticOctave(octave: number): MusicNote[] {
  return Array.from({ length: 12 }, (_, index) => noteFromMidi((octave + 1) * 12 + index));
}

function NoteMode({ onHome }: { onHome: () => void }) {
  const [clef, setClef] = useState<'treble' | 'bass'>('treble');
  const [run, setRun] = useState(0);
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState('この おんぷは どの音？');
  const [feedbackKind, setFeedbackKind] = useState('');
  const [litMidi, setLitMidi] = useState<number | null>(null);
  const [wrongMidi, setWrongMidi] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notes = useMemo(() => easyNotes(clef === 'treble' ? EASY_MUSIC.noteOctave : EASY_MUSIC.bassOctave), [clef]);
  const keys = useMemo(() => chromaticOctave(clef === 'treble' ? EASY_MUSIC.noteOctave : EASY_MUSIC.bassOctave), [clef]);
  const [question, setQuestion] = useState<MusicNote>(() => chooseQuestion(easyNotes()));

  const restart = useCallback((nextClef = clef) => {
    if (timer.current) clearTimeout(timer.current);
    locked.current = false;
    setIndex(0); setScore(0); setCorrect(0); setStreak(0); setFinished(false);
    setFeedback('この おんぷは どの音？'); setFeedbackKind(''); setLitMidi(null); setWrongMidi(null);
    setQuestion(chooseQuestion(easyNotes(nextClef === 'treble' ? EASY_MUSIC.noteOctave : EASY_MUSIC.bassOctave)));
    setRun((value) => value + 1);
  }, [clef]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const press = (note: MusicNote) => {
    if (locked.current || finished) return;
    void AudioEngine.unlock(); AudioEngine.playNote(note);
    if (isCorrectPitch(question, note)) {
      locked.current = true;
      setLitMidi(note.midi); setWrongMidi(null); setFeedback('せいかい！'); setFeedbackKind('success');
      setScore((value) => value + 10); setCorrect((value) => value + 1); setStreak((value) => value + 1);
      timer.current = setTimeout(() => {
        setLitMidi(null); setFeedbackKind('');
        if (index + 1 === EASY_MUSIC.questions) setFinished(true);
        else { setQuestion(chooseQuestion(notes, question.midi)); setIndex(index + 1); setFeedback('この おんぷは どの音？'); }
        locked.current = false;
      }, 610);
    } else {
      setWrongMidi(note.midi); setStreak(0); setFeedback('おしい！ もういちど'); setFeedbackKind('soft-miss');
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setWrongMidi(null), 380);
    }
  };
  if (finished) return <GameResult correct={correct} score={score} onRetry={() => restart()} onHome={onHome} />;
  return <>
    <ScoreDisplay score={score} streak={streak} progress={index} pop={feedbackKind === 'success'} />
    <div className="music-choices" role="group" aria-label="おんきごう">
      <button type="button" className={clef === 'treble' ? 'is-selected' : ''} onClick={() => { setClef('treble'); restart('treble'); }}>ト音記号</button>
      <button type="button" className={clef === 'bass' ? 'is-selected' : ''} onClick={() => { setClef('bass'); restart('bass'); }}>ヘ音記号</button>
    </div>
    <div className="music-stage"><div className="music-stage-label">このおんぷを よんでみよう</div><MusicStaff note={question} clef={clef} /></div>
    <FeedbackEffect message={feedback} kind={feedbackKind} burstKey={index + run * 10} />
    <PianoKeyboard notes={keys} onPress={press} litMidi={litMidi} wrongMidi={wrongMidi} />
  </>;
}

function EarMode({ onHome }: { onHome: () => void }) {
  const notes = useMemo(() => easyNotes(), []);
  const keys = useMemo(() => chromaticOctave(4), []);
  const [question, setQuestion] = useState<MusicNote>(() => chooseQuestion(easyNotes()));
  const [index, setIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState('きいてみよう！');
  const [kind, setKind] = useState('');
  const [litMidi, setLitMidi] = useState<number | null>(null);
  const [wrongMidi, setWrongMidi] = useState<number | null>(null);
  const [finished, setFinished] = useState(false);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const id = setTimeout(() => AudioEngine.playNote(question, .7), 350);
    return () => { clearTimeout(id); if (timer.current) clearTimeout(timer.current); };
  }, [question]);
  const replay = () => { void AudioEngine.unlock(); AudioEngine.playNote(question, .7); setFeedback('よく きいてね ♪'); setKind(''); };
  const press = (note: MusicNote) => {
    if (locked.current || finished) return;
    void AudioEngine.unlock(); AudioEngine.playNote(note);
    if (isCorrectPitch(question, note)) {
      locked.current = true; setLitMidi(note.midi); setWrongMidi(null); setFeedback('せいかい！'); setKind('success');
      setScore((value) => value + 10); setCorrect((value) => value + 1); setStreak((value) => value + 1);
      timer.current = setTimeout(() => {
        setLitMidi(null); setKind('');
        if (index + 1 === EASY_MUSIC.questions) setFinished(true);
        else { setQuestion(chooseQuestion(notes, question.midi)); setIndex(index + 1); setFeedback('きいてみよう！'); }
        locked.current = false;
      }, 680);
    } else {
      setWrongMidi(note.midi); setFeedback('おしい！ もういちど きいてみよう'); setKind('soft-miss'); setStreak(0);
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => setWrongMidi(null), 380);
    }
  };
  const restart = () => { if (timer.current) clearTimeout(timer.current); locked.current = false; setQuestion(chooseQuestion(notes)); setIndex(0); setScore(0); setCorrect(0); setStreak(0); setFinished(false); setFeedback('きいてみよう！'); setKind(''); setLitMidi(null); setWrongMidi(null); };
  if (finished) return <GameResult correct={correct} score={score} onRetry={restart} onHome={onHome} />;
  return <>
    <ScoreDisplay score={score} streak={streak} progress={index} pop={kind === 'success'} />
    <div className="music-listen-stage"><span className="music-listen-icon" aria-hidden="true">♫</span><strong>どの音が なったかな？</strong><button type="button" className="music-secondary" onClick={replay}>♪ もういちどきく</button>{!AudioEngine.isAvailable() && <small>音が出せないので ヒント：{noteLabel(question)}</small>}</div>
    <FeedbackEffect message={feedback} kind={kind} burstKey={index} />
    <PianoKeyboard notes={keys} onPress={press} litMidi={litMidi} wrongMidi={wrongMidi} />
  </>;
}

function MelodyMode({ onHome }: { onHome: () => void }) {
  const notes = useMemo(() => easyNotes(), []);
  const keys = useMemo(() => chromaticOctave(4), []);
  const [index, setIndex] = useState(0);
  const [melody, setMelody] = useState<MusicNote[]>(() => makeMelody(easyNotes(), melodyLength(0)));
  const [input, setInput] = useState<MusicNote[]>([]);
  const [phase, setPhase] = useState<'listen' | 'input'>('listen');
  const [litMidi, setLitMidi] = useState<number | null>(null);
  const [wrongMidi, setWrongMidi] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [streak, setStreak] = useState(0);
  const [feedback, setFeedback] = useState('よく きいてね ♪');
  const [kind, setKind] = useState('');
  const [finished, setFinished] = useState(false);
  const [playToken, setPlayToken] = useState(0);
  const locked = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    setPhase('listen'); setInput([]); setFeedback('よく きいてね ♪'); setKind(''); setLitMidi(null);
    const start = setTimeout(async () => {
      await AudioEngine.playSequence(melody, (_, note) => setLitMidi(note.midi), controller.signal);
      if (!controller.signal.aborted) { setLitMidi(null); setPhase('input'); setFeedback('まねしてね！'); }
    }, 380);
    return () => { controller.abort(); clearTimeout(start); if (timer.current) clearTimeout(timer.current); };
  }, [melody, playToken]);
  const replay = () => { if (phase === 'input') { void AudioEngine.unlock(); setPlayToken((value) => value + 1); } };
  const press = (note: MusicNote) => {
    if (phase !== 'input' || locked.current || finished) return;
    void AudioEngine.unlock(); AudioEngine.playNote(note);
    setLitMidi(note.midi);
    setTimeout(() => setLitMidi((current) => current === note.midi ? null : current), 260);
    const nextInput = [...input, note];
    const result = checkMelodyInput(melody, nextInput);
    if (!result.correct) {
      setWrongMidi(note.midi); setInput([]); setStreak(0); setFeedback('おしい！ はじめから どうぞ'); setKind('soft-miss');
      setTimeout(() => setWrongMidi(null), 380);
    } else if (result.complete) {
      locked.current = true; setInput(nextInput); setFeedback('せいかい！'); setKind('success');
      setScore((value) => value + 10); setCorrect((value) => value + 1); setStreak((value) => value + 1);
      timer.current = setTimeout(() => {
        if (index + 1 === EASY_MUSIC.questions) setFinished(true);
        else { setIndex(index + 1); setMelody(makeMelody(notes, melodyLength(index + 1))); }
        locked.current = false;
      }, 750);
    } else { setInput(nextInput); setFeedback(`${nextInput.length} / ${melody.length} おん`); setKind(''); }
  };
  const restart = () => { if (timer.current) clearTimeout(timer.current); locked.current = false; setIndex(0); setScore(0); setCorrect(0); setStreak(0); setFinished(false); setMelody(makeMelody(notes, melodyLength(0))); setPlayToken((value) => value + 1); };
  if (finished) return <GameResult correct={correct} score={score} onRetry={restart} onHome={onHome} />;
  return <>
    <ScoreDisplay score={score} streak={streak} progress={index} pop={kind === 'success'} />
    <div className="music-melody-stage"><div className="music-stage-label">{phase === 'listen' ? 'おとを おぼえよう' : 'おなじ じゅんばんで おそう'}</div><div className="music-melody-dots" aria-label={`${melody.length}おんのメロディ`}>{melody.map((_, dot) => <span key={dot} className={dot < input.length ? 'is-filled' : ''}>♪</span>)}</div>{!AudioEngine.isAvailable() && <small>音が出せないので ヒント：{melody.map(noteLabel).join(' → ')}</small>}{phase === 'input' && <button type="button" className="music-secondary" onClick={replay}>♫ もういちどきく</button>}</div>
    <FeedbackEffect message={feedback} kind={kind} burstKey={index} />
    <PianoKeyboard notes={keys} onPress={press} litMidi={litMidi} wrongMidi={wrongMidi} disabled={phase !== 'input'} />
  </>;
}

function RhythmMode({ onHome }: { onHome: () => void }) {
  const bpm = EASY_MUSIC.bpm;
  const beatMs = 60000 / bpm;
  const [patterns, setPatterns] = useState<RhythmEvent[][]>(() => makeRhythmRound());
  const [run, setRun] = useState(0);
  const [phase, setPhase] = useState<'ready' | 'count-in' | 'playing' | 'preview'>('ready');
  const [barIndex, setBarIndex] = useState(0);
  const [countdown, setCountdown] = useState(4);
  const [cursorBeat, setCursorBeat] = useState(0);
  const [score, setScore] = useState(0);
  const [correct, setCorrect] = useState(0);
  const [feedback, setFeedback] = useState('はじめの 2はくは おやすみ。じゅんびができたら スタート！');
  const [kind, setKind] = useState('');
  const [finished, setFinished] = useState(false);
  const startMs = useRef(Number.POSITIVE_INFINITY);
  const used = useRef<number[]>([]);
  const broken = useRef(false);
  const completed = useRef(-1);
  const activeBar = useRef(-1);
  const lastBeat = useRef(-1);
  const lastCursorUpdate = useRef(0);
  const raf = useRef(0);
  const patternFor = useCallback((bar: number): RhythmEvent[] => patterns[bar], [patterns]);
  useEffect(() => {
    if (run === 0) return;
    let live = true;
    startMs.current = performance.now() + beatMs * RHYTHM_TIMING.firstCountBeats;
    used.current = []; broken.current = false; completed.current = -1; activeBar.current = -1; lastBeat.current = -1;
    const cycleBeats = RHYTHM_TIMING.barBeats + RHYTHM_TIMING.previewBeats;
    const finishBar = (bar: number) => {
      if (completed.current >= bar) return null;
      const events = patternFor(bar);
      const misses = countMissedNotes(events, used.current);
      if (misses) { broken.current = true; setFeedback('Miss · つぎの しょうせつへ'); setKind('soft-miss'); }
      if (!broken.current) {
        setCorrect((value) => value + 1);
        if (events.some((event) => event.type === 'rest')) setScore((value) => value + 5);
      }
      completed.current = bar;
      used.current = [];
      broken.current = false;
      return misses;
    };
    const tick = () => {
      if (!live) return;
      const now = performance.now();
      const beatNumber = Math.floor((now - startMs.current) / beatMs);
      if (beatNumber !== lastBeat.current) {
        lastBeat.current = beatNumber;
        if (beatNumber >= -RHYTHM_TIMING.firstCountBeats && beatNumber < (EASY_MUSIC.questions - 1) * cycleBeats + RHYTHM_TIMING.barBeats) {
          AudioEngine.playMetronomeBeat(beatNumber < 0 ? beatNumber === -RHYTHM_TIMING.firstCountBeats : beatNumber % cycleBeats === 0);
        }
      }
      const position = rhythmTimelineAt(now, startMs.current, bpm);
      if (position.phase === 'finished') {
        finishBar(EASY_MUSIC.questions - 1);
        setFinished(true);
        return;
      }
      if (position.phase === 'count-in') {
        setPhase('count-in'); setCountdown(position.countdown);
      } else if (position.phase === 'preview') {
        const misses = finishBar(position.barIndex - 1);
        setPhase('preview'); setBarIndex(position.barIndex); setCountdown(position.countdown); setCursorBeat(0);
        if (misses === 0) { setFeedback('つぎの リズムを よんでね'); setKind(''); }
      } else {
        if (activeBar.current !== position.barIndex) {
          activeBar.current = position.barIndex;
          setBarIndex(position.barIndex); setPhase('playing'); setFeedback(position.barIndex === 0 ? 'はじめの 2はくは おやすみ！' : 'はじめの 1はくは おやすみ！'); setKind('');
        }
        if (now - lastCursorUpdate.current >= 32) { setCursorBeat(position.beatInBar); lastCursorUpdate.current = now; }
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { live = false; cancelAnimationFrame(raf.current); };
  }, [run, beatMs, patternFor]);
  const tap = () => {
    const now = performance.now();
    const position = rhythmTimelineAt(now, startMs.current, bpm);
    if (position.phase !== 'playing' || finished) return;
    AudioEngine.playNote(noteFromMidi(72), .13);
    const currentBar = position.barIndex;
    if (currentBar !== activeBar.current) return;
    const judgement = judgeRhythmTap(now, startMs.current + currentBar * (RHYTHM_TIMING.barBeats + RHYTHM_TIMING.previewBeats) * beatMs, bpm, patternFor(currentBar), used.current);
    if (judgement.index !== null && judgement.index !== undefined) used.current.push(judgement.index);
    if (judgement.judgement === 'Perfect') { setScore((value) => value + 10); setFeedback('Perfect ✦'); setKind('success'); }
    else if (judgement.judgement === 'Good') { setScore((value) => value + 6); setFeedback('Good ♪'); setKind('success'); }
    else { broken.current = true; setFeedback(judgement.reason === 'rest' ? 'きゅうふは おやすみ！' : 'おしい！ つぎの音で タップ'); setKind('soft-miss'); }
  };
  const restart = () => { startMs.current = Number.POSITIVE_INFINITY; setPatterns(makeRhythmRound()); setBarIndex(0); setCountdown(4); setCursorBeat(0); setScore(0); setCorrect(0); setFeedback('はじめの 2はくは おやすみ。じゅんびができたら スタート！'); setKind(''); setFinished(false); setPhase('ready'); setRun(0); };
  const start = () => { void AudioEngine.unlock(); setFeedback('1、2、3、4！'); setKind(''); setPhase('count-in'); setRun((value) => value + 1); };
  if (finished) return <GameResult correct={correct} score={score} onRetry={restart} onHome={onHome} />;
  return <>
    <ScoreDisplay score={score} progress={barIndex} bpm={bpm} pop={kind === 'success'} />
    <div className="music-stage"><div className="music-stage-label">4 / 4　{phase === 'ready' ? 'リズムを みてね' : `${barIndex + 1} しょうせつめ`}</div>{(phase === 'count-in' || phase === 'preview') && <div className="music-countdown" aria-live="polite"><strong>{countdown}</strong><span>{phase === 'count-in' ? 'はじまるよ！' : 'つぎの しょうせつ'}</span></div>}<MusicStaff rhythm={patternFor(barIndex)} cursorBeat={phase === 'playing' ? cursorBeat : undefined} /></div>
    <FeedbackEffect message={feedback} kind={kind} burstKey={barIndex} />
    {phase === 'ready' ? <button type="button" className="music-start-button" onClick={start}>▶ はじめる</button> : <button type="button" className={`music-tap-pad ${kind === 'success' ? 'is-hit' : ''}`} onPointerDown={() => void AudioEngine.unlock()} onClick={tap} disabled={phase !== 'playing'} aria-label="リズムに合わせてタップ"><span>タップ！</span><small>{phase === 'playing' ? barIndex === 0 ? '2はく やすんでから タップ' : '1はく やすんでから タップ' : 'カウントを きいてね'}</small></button>}
  </>;
}

export default function MusicApp() {
  const [mode, setMode] = useState<Mode | null>(null);
  const [session, setSession] = useState(0);
  const open = (nextMode: Mode) => { void AudioEngine.unlock(); setSession((value) => value + 1); setMode(nextMode); };
  const home = () => { setMode(null); };
  const current = modes.find((item) => item.id === mode);
  return <div className="music-app">
    {!mode ? <>
      <div className="music-hero"><span className="music-eyebrow">MUSIC PLAYROOM</span><h1>おとで あそぼう<span aria-hidden="true"> ♪</span></h1><p>すきなゲームを えらんでね！</p><span className="music-hero-star star-one" aria-hidden="true">✦</span><span className="music-hero-star star-two" aria-hidden="true">♫</span></div>
      <div className="music-mode-grid">{modes.map((item) => <button key={item.id} type="button" className={`music-mode-card ${item.color}`} onClick={() => open(item.id)}><span className="music-mode-icon" aria-hidden="true">{item.icon}</span><span className="music-mode-copy"><strong>{item.title}</strong><small>{item.description}</small></span><span className="music-mode-arrow" aria-hidden="true">→</span></button>)}</div>
    </> : <>
      <div className="music-game-heading"><button type="button" className="music-back" onClick={home}>← もどる</button><h1 className="music-game-title"><span aria-hidden="true">{current?.icon}</span> {current?.title}</h1><span className="music-easy-badge">かんたん</span></div>
      <div className="music-game-body" key={`${mode}-${session}`}>
        {mode === 'note' && <NoteMode onHome={home} />}
        {mode === 'rhythm' && <RhythmMode onHome={home} />}
        {mode === 'ear' && <EarMode onHome={home} />}
        {mode === 'melody' && <MelodyMode onHome={home} />}
      </div>
    </>}
  </div>;
}
