export const PITCH_CLASSES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const WHITE_PITCH_CLASSES = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
export const EASY_MUSIC = Object.freeze({ questions: 10, bpm: 88, noteOctave: 4, bassOctave: 3, melodyMin: 2, melodyMax: 5 });
export const RHYTHM_WINDOWS_MS = Object.freeze({ perfect: 100, good: 220 });
export const STAFF_LINES_Y = Object.freeze([32, 52, 72, 92, 112]);
export const CLEF_REFERENCE_Y = Object.freeze({ treble: 92, bass: 52 });
export const RHYTHM_TIMING = Object.freeze({ firstCountBeats: 4, barBeats: 4, previewBeats: 2 });

/** @typedef {{pitchClass:string,pitch:number,midi:number,octave:number,notationName:string,accidental:string|null}} MusicNote */

export function noteFromMidi(midi, notationName) {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) throw new RangeError('MIDI note must be 0–127');
  const pitchClass = PITCH_CLASSES[midi % 12];
  const spelling = notationName ?? pitchClass;
  const match = /^([A-G])([#b]?)$/.exec(spelling);
  if (!match) throw new Error('Invalid notation name');
  return {
    pitchClass,
    pitch: midi,
    midi,
    octave: Math.floor(midi / 12) - 1,
    notationName: match[1],
    accidental: match[2] || null,
  };
}

export function noteFromPitch(pitchClass, octave, notationName) {
  const offset = PITCH_CLASSES.indexOf(pitchClass);
  if (offset < 0 || !Number.isInteger(octave)) throw new Error('Invalid pitch');
  return noteFromMidi((octave + 1) * 12 + offset, notationName);
}

export function frequencyFromMidi(midi) {
  if (!Number.isInteger(midi) || midi < 0 || midi > 127) throw new RangeError('MIDI note must be 0–127');
  return 440 * 2 ** ((midi - 69) / 12);
}

/** Stem geometry for an isolated note; SVG y increases downward. */
export function staffStem(x, y) {
  const down = y <= STAFF_LINES_Y[2];
  return { x: x + (down ? -14 : 14), y1: y + (down ? 3 : -3), y2: y + (down ? 55 : -55) };
}

export function staffYForNote(note, clef) {
  const letters = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
  const bottom = clef === 'treble' ? 4 * 7 + 2 : clef === 'bass' ? 2 * 7 + 4 : null;
  if (bottom === null) throw new Error('Invalid clef');
  return 112 - (note.octave * 7 + letters.indexOf(note.notationName) - bottom) * 10;
}

/** @param {number} [octave] */
export function easyNotes(octave = EASY_MUSIC.noteOctave) {
  return WHITE_PITCH_CLASSES.map((pitchClass) => noteFromPitch(pitchClass, octave));
}

/** @param {MusicNote[]} notes @param {number|null} [previousMidi] @param {()=>number} [random] */
export function chooseQuestion(notes, previousMidi = null, random = Math.random) {
  const choices = notes.filter((note) => note.midi !== previousMidi);
  const pool = choices.length ? choices : notes;
  if (!pool.length) throw new Error('Question pool is empty');
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export function isCorrectPitch(expected, answer) {
  return expected.midi === answer.midi;
}

export function melodyLength(round, settings = EASY_MUSIC) {
  return Math.min(settings.melodyMax, settings.melodyMin + Math.floor(round / 2));
}

export function makeMelody(notes, length, random = Math.random) {
  const melody = [];
  for (let i = 0; i < length; i += 1) {
    melody.push(chooseQuestion(notes, melody.at(-1)?.midi ?? null, random));
  }
  return melody;
}

export function checkMelodyInput(melody, input) {
  const correct = input.every((note, index) => melody[index]?.midi === note.midi);
  return { correct, complete: correct && input.length === melody.length };
}

function rhythmEventsForCells(cells) {
  return cells.flatMap((cell, beat) => cell === 'eighths'
    ? [{ beat, duration: .5, type: 'note' }, { beat: beat + .5, duration: .5, type: 'note' }]
    : [{ beat, duration: 1, type: cell }]);
}

const OPENING_RHYTHM_CELLS = ['rest', 'rest', 'note', 'note'];
export const RHYTHM_OPENING_BAR = rhythmEventsForCells(OPENING_RHYTHM_CELLS);

/** Build a complete round once, so its notation and answer timing cannot reroll during play. */
export function makeRhythmRound(totalBars = EASY_MUSIC.questions, random = Math.random) {
  if (!Number.isInteger(totalBars) || totalBars < 1) throw new RangeError('Rhythm round needs at least one bar');
  const bars = [RHYTHM_OPENING_BAR];
  let previous = OPENING_RHYTHM_CELLS.join(',');
  for (let bar = 1; bar < totalBars; bar += 1) {
    const candidates = [];
    const thirdBeat = bar < 3 ? ['note'] : ['note', 'eighths'];
    const fourthBeat = bar < 3 ? ['note', 'rest'] : ['note', 'rest', 'eighths'];
    for (const second of ['rest', 'note']) {
      for (const third of thirdBeat) {
        for (const fourth of fourthBeat) {
          const cells = ['rest', second, third, fourth];
          if (cells.join(',') !== previous) candidates.push(cells);
        }
      }
    }
    const choice = candidates[Math.max(0, Math.min(candidates.length - 1, Math.floor(random() * candidates.length)))];
    bars.push(rhythmEventsForCells(choice));
    previous = choice.join(',');
  }
  return bars;
}

export function rhythmTimelineAt(nowMs, firstBarStartMs, bpm, totalBars = EASY_MUSIC.questions) {
  const rawBeat = (nowMs - firstBarStartMs) / (60000 / bpm);
  const beat = Math.abs(rawBeat - Math.round(rawBeat)) < 1e-9 ? Math.round(rawBeat) : rawBeat;
  const cycleBeats = RHYTHM_TIMING.barBeats + RHYTHM_TIMING.previewBeats;
  if (beat < 0) return { phase: 'count-in', barIndex: 0, countdown: Math.max(1, Math.min(RHYTHM_TIMING.firstCountBeats, Math.ceil(-beat))), beatInBar: 0 };
  if (beat >= (totalBars - 1) * cycleBeats + RHYTHM_TIMING.barBeats) return { phase: 'finished', barIndex: totalBars - 1, countdown: 0, beatInBar: RHYTHM_TIMING.barBeats };
  const cycle = Math.floor(beat / cycleBeats);
  const beatInCycle = beat - cycle * cycleBeats;
  if (beatInCycle >= RHYTHM_TIMING.barBeats) {
    return { phase: 'preview', barIndex: cycle + 1, countdown: Math.ceil(cycleBeats - beatInCycle), beatInBar: 0 };
  }
  return { phase: 'playing', barIndex: cycle, countdown: 0, beatInBar: beatInCycle };
}

export function judgeRhythmTap(tapMs, barStartMs, bpm, events, used = [], windows = RHYTHM_WINDOWS_MS) {
  const beatMs = 60000 / bpm;
  let nearest = null;
  for (let index = 0; index < events.length; index += 1) {
    if (events[index].type !== 'note' || used.includes(index)) continue;
    const errorMs = Math.abs(tapMs - (barStartMs + events[index].beat * beatMs));
    if (!nearest || errorMs < nearest.errorMs) nearest = { index, errorMs };
  }
  if (nearest && nearest.errorMs <= windows.good) {
    return { judgement: nearest.errorMs <= windows.perfect ? 'Perfect' : 'Good', index: nearest.index };
  }
  const beat = (tapMs - barStartMs) / beatMs;
  const rest = events.find((event) => event.type === 'rest' && beat >= event.beat - .12 && beat < event.beat + event.duration - .12);
  return { judgement: 'Miss', reason: rest ? 'rest' : 'timing', index: null };
}

export function countMissedNotes(events, used) {
  return events.reduce((count, event, index) => count + Number(event.type === 'note' && !used.includes(index)), 0);
}
