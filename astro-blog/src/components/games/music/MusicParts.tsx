import React from 'react';
import { CLEF_REFERENCE_Y, STAFF_LINES_Y, WHITE_PITCH_CLASSES, staffYForNote } from '../../../lib/games/music/music.mjs';
import { MUSIC_GLYPH_PATHS } from './musicGlyphPaths';

export type MusicNote = { pitchClass: string; pitch: number; midi: number; octave: number; notationName: string; accidental: string | null };
export type RhythmEvent = { beat: number; duration: number; type: string };

const solfege: Record<string, string> = { C: 'ド', D: 'レ', E: 'ミ', F: 'ファ', G: 'ソ', A: 'ラ', B: 'シ' };

export function PianoKeyboard({ notes, onPress, showBlackKeys = false, litMidi = null, wrongMidi = null, disabled = false }: {
  notes: MusicNote[]; onPress: (note: MusicNote) => void; showBlackKeys?: boolean; litMidi?: number | null; wrongMidi?: number | null; disabled?: boolean;
}) {
  const whites = notes.filter((note) => WHITE_PITCH_CLASSES.includes(note.pitchClass));
  const blackBefore: Record<string, string> = { 'C#': 'C', 'D#': 'D', 'F#': 'F', 'G#': 'G', 'A#': 'A' };
  const blackKeys = showBlackKeys ? notes.filter((note) => blackBefore[note.pitchClass]) : [];
  return <div className="music-keyboard" role="group" aria-label="ピアノのけんばん">
    <div className="music-white-keys">{whites.map((note) => <button
      key={note.midi} type="button" disabled={disabled} onClick={() => onPress(note)}
      className={`music-key music-key-white ${litMidi === note.midi ? 'is-lit' : ''} ${wrongMidi === note.midi ? 'is-wrong' : ''}`}
      aria-label={`${solfege[note.notationName] ?? note.pitchClass} ${note.octave}`}
    ><span>{solfege[note.notationName] ?? note.pitchClass}</span></button>)}</div>
    {blackKeys.map((note) => {
      const previousIndex = whites.findIndex((white) => white.octave === note.octave && white.pitchClass === blackBefore[note.pitchClass]);
      if (previousIndex < 0) return null;
      return <button key={note.midi} type="button" disabled={disabled} onClick={() => onPress(note)}
        className={`music-key music-key-black ${litMidi === note.midi ? 'is-lit' : ''}`}
        style={{ left: `${(previousIndex + 1) * 100 / whites.length}%`, width: `${100 / whites.length * .58}%` }}
        aria-label={`${note.pitchClass} ${note.octave}`}><span>{note.pitchClass}</span></button>;
    })}
  </div>;
}

function ClefGlyph({ clef }: { clef: 'treble' | 'bass' }) {
  const referenceY = CLEF_REFERENCE_Y[clef];
  return <g className="music-clef-glyph" aria-hidden="true" data-reference-y={referenceY}
    transform={`translate(55 ${referenceY}) scale(0.08 -0.08)`}>
    <path d={MUSIC_GLYPH_PATHS[clef]} fill="#474170" />
  </g>;
}

function QuarterRest({ x }: { x: number }) {
  return <g className="music-quarter-rest" aria-label="四分休符" transform={`translate(${x - 11} 72) scale(0.08 -0.08)`}>
    <path d={MUSIC_GLYPH_PATHS.quarterRest} fill="#6148c8" />
  </g>;
}

export function MusicStaff({ note, clef, rhythm, cursorBeat }: { note?: MusicNote; clef?: 'treble' | 'bass'; rhythm?: RhythmEvent[]; cursorBeat?: number }) {
  const isRhythm = Boolean(rhythm);
  const y = note && clef ? staffYForNote(note, clef) : 0;
  return <svg className="music-staff" viewBox="0 0 480 155" role="img" aria-label={isRhythm ? 'リズムふ' : `${clef === 'bass' ? 'ヘ' : 'ト'}おんきごうの ごせんふ`}>
    <rect x="2" y="8" width="476" height="139" rx="22" fill="#fffdf9" />
    {STAFF_LINES_Y.map((line) => <line key={line} x1="30" x2="452" y1={line} y2={line} stroke="#a7abc8" strokeWidth="2" />)}
    <ClefGlyph clef={clef === 'bass' ? 'bass' : 'treble'} />
    {note && <g>
      {y >= 132 && <line x1="200" x2="248" y1="132" y2="132" stroke="#474170" strokeWidth="2" />}
      {y <= 12 && <line x1="200" x2="248" y1="12" y2="12" stroke="#474170" strokeWidth="2" />}
      <ellipse cx="224" cy={y} rx="15" ry="10" transform={`rotate(-20 224 ${y})`} fill="#6148c8" />
      <line x1="238" x2="238" y1={y - 3} y2={y - 55} stroke="#6148c8" strokeWidth="3" strokeLinecap="round" />
      {note.accidental && <text x="187" y={y + 8} fontSize="30" fill="#474170">{note.accidental === '#' ? '♯' : '♭'}</text>}
    </g>}
    {rhythm?.map((event, index) => {
      const x = 145 + event.beat * 70;
      return <g key={`${event.beat}-${index}`}>
        {event.type === 'rest' ? <QuarterRest x={x} /> : <>
          <ellipse cx={x} cy="82" rx="10" ry="7" transform={`rotate(-20 ${x} 82)`} fill="#6148c8" />
          <line x1={x + 9} x2={x + 9} y1="79" y2="39" stroke="#6148c8" strokeWidth="2.5" />
          {event.duration === .5 && <path d={`M ${x + 9} 39 Q ${x + 30} 48 ${x + 19} 60`} fill="none" stroke="#6148c8" strokeWidth="3" />}
        </>}
      </g>;
    })}
    {isRhythm && typeof cursorBeat === 'number' && <line x1={145 + Math.max(0, Math.min(4, cursorBeat)) * 70} x2={145 + Math.max(0, Math.min(4, cursorBeat)) * 70} y1="20" y2="125" stroke="#f29953" strokeWidth="3" strokeLinecap="round" />}
  </svg>;
}

export function ScoreDisplay({ score, streak, progress, total = 10, bpm, pop = false }: { score: number; streak?: number; progress: number; total?: number; bpm?: number; pop?: boolean }) {
  return <div className="music-stats">
    <div className={`music-stat ${pop ? 'is-pop' : ''}`}><span>スコア</span><strong>{score}</strong></div>
    <div className="music-stat"><span>{typeof bpm === 'number' ? 'テンポ' : 'れんぞく'}</span><strong>{typeof bpm === 'number' ? `${bpm} BPM` : `${streak ?? 0} ★`}</strong></div>
    <div className="music-stat"><span>すすみぐあい</span><strong>{Math.min(progress + 1, total)} / {total}</strong></div>
  </div>;
}

export function FeedbackEffect({ message, kind, burstKey }: { message: string; kind?: string; burstKey?: number }) {
  return <div className={`music-feedback ${kind ?? ''}`} role="status" aria-live="polite">
    <span>{message}</span>
    {kind === 'success' && <span key={burstKey} className="music-sparkles" aria-hidden="true">♪ ✦ ♪</span>}
  </div>;
}

export function GameResult({ correct, score, total = 10, onRetry, onHome }: { correct: number; score: number; total?: number; onRetry: () => void; onHome: () => void }) {
  return <div className="music-result">
    <div className="music-result-icon" aria-hidden="true">✦</div>
    <h2>できた！</h2>
    <p>{total}もんの チャレンジ おつかれさま！</p>
    <div className="music-result-numbers"><span><strong>{correct}</strong><small>せいかい</small></span><span><strong>{score}</strong><small>スコア</small></span></div>
    <div className="music-result-actions"><button type="button" className="music-primary" onClick={onRetry}>もういちど</button><button type="button" className="music-secondary" onClick={onHome}>トップにもどる</button></div>
  </div>;
}
