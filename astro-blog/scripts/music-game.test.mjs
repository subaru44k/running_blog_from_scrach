import test from 'node:test';
import assert from 'node:assert/strict';
import { CLEF_REFERENCE_Y, EASY_MUSIC, STAFF_LINES_Y, checkMelodyInput, chooseQuestion, countMissedNotes, easyNotes, frequencyFromMidi, isCorrectPitch, judgeRhythmTap, makeMelody, makeRhythmRound, melodyLength, noteFromMidi, noteFromPitch, rhythmTimelineAt, staffStem, staffYForNote } from '../src/lib/games/music/music.mjs';

test('MIDI pitch and notation spelling stay separate', () => {
  assert.deepEqual(noteFromPitch('C', 4), { pitchClass: 'C', pitch: 60, midi: 60, octave: 4, notationName: 'C', accidental: null });
  assert.equal(noteFromMidi(61, 'Db').notationName, 'D');
  assert.equal(noteFromMidi(61, 'Db').accidental, 'b');
  assert.equal(noteFromMidi(61, 'C#').midi, noteFromMidi(61, 'Db').midi);
  assert.equal(noteFromPitch('B', 4).midi, 71);
});

test('all white-key pitches match A4=440 Hz twelve-tone equal temperament', () => {
  const expected = [
    ['C', 60, 261.625565], ['D', 62, 293.664768], ['E', 64, 329.627557],
    ['F', 65, 349.228231], ['G', 67, 391.995436], ['A', 69, 440],
    ['B', 71, 493.883301],
  ];
  for (const [name, midi, hertz] of expected) {
    const note = noteFromPitch(name, 4);
    assert.equal(note.midi, midi, `${name}4 MIDI`);
    assert.ok(Math.abs(frequencyFromMidi(note.midi) - hertz) < .001, `${name}4 frequency`);
  }
  assert.equal(noteFromPitch('C', 5).midi, 72);
  assert.ok(Math.abs(frequencyFromMidi(72) - 523.251131) < .001);
});

test('clef reference points align with their staff lines', () => {
  assert.deepEqual(STAFF_LINES_Y, [32, 52, 72, 92, 112]);
  assert.equal(staffYForNote(noteFromPitch('G', 4), 'treble'), CLEF_REFERENCE_Y.treble);
  assert.equal(staffYForNote(noteFromPitch('F', 3), 'bass'), CLEF_REFERENCE_Y.bass);
  assert.equal(staffYForNote(noteFromPitch('C', 4), 'treble'), 132);
  assert.equal(staffYForNote(noteFromPitch('C', 3), 'bass'), 82);
});

test('isolated note stems switch side and direction at the middle line in both clefs', () => {
  for (const [clef, octave, names] of [['treble', 4, ['A', 'B', 'C']], ['bass', 3, ['C', 'D', 'E']]]) {
    for (const [index, name] of names.entries()) {
      const noteOctave = clef === 'treble' && name === 'C' ? 5 : octave;
      const y = staffYForNote(noteFromPitch(name, noteOctave), clef);
      assert.equal(y, 82 - index * 10);
      const stem = staffStem(224, y);
      const down = index >= 1;
      assert.equal(stem.x, down ? 210 : 238);
      assert.equal(stem.y1, y + (down ? 3 : -3));
      assert.equal(stem.y2 > stem.y1, down);
    }
  }
});

test('note question generation uses the pool and avoids immediate repeats', () => {
  const notes = easyNotes();
  assert.equal(notes.length, 7);
  assert.ok(notes.every((note) => !note.accidental));
  const question = chooseQuestion(notes, notes[0].midi, () => 0);
  assert.equal(question.midi, notes[1].midi);
  assert.equal(isCorrectPitch(question, noteFromMidi(question.midi)), true);
  assert.equal(isCorrectPitch(question, notes[0]), false);
});

test('rhythm timing and rests are judged with adjustable windows', () => {
  const events = [{ beat: 0, duration: 1, type: 'note' }, { beat: 1, duration: 1, type: 'rest' }, { beat: 2, duration: 1, type: 'note' }, { beat: 3, duration: 1, type: 'note' }];
  const start = 1000;
  const beatMs = 60000 / EASY_MUSIC.bpm;
  assert.deepEqual(judgeRhythmTap(start + 20, start, EASY_MUSIC.bpm, events), { judgement: 'Perfect', index: 0 });
  assert.deepEqual(judgeRhythmTap(start + 160, start, EASY_MUSIC.bpm, events), { judgement: 'Good', index: 0 });
  assert.deepEqual(judgeRhythmTap(start + beatMs * 1.3, start, EASY_MUSIC.bpm, events), { judgement: 'Miss', reason: 'rest', index: null });
  assert.equal(countMissedNotes(events, [0, 2]), 1);
});

test('the opening rhythm gives two beats of rest before two simple taps', () => {
  const events = makeRhythmRound(1)[0];
  assert.deepEqual(events.map(({ beat, type }) => [beat, type]), [[0, 'rest'], [1, 'rest'], [2, 'note'], [3, 'note']]);
  assert.equal(events.reduce((beats, event) => beats + event.duration, 0), 4);
  const beatMs = 60000 / EASY_MUSIC.bpm;
  assert.deepEqual(judgeRhythmTap(beatMs, 0, EASY_MUSIC.bpm, events), { judgement: 'Miss', reason: 'rest', index: null });
  assert.deepEqual(judgeRhythmTap(2 * beatMs, 0, EASY_MUSIC.bpm, events), { judgement: 'Perfect', index: 2 });
});

test('every generated bar starts with rest and rounds vary without changing meter', () => {
  const earlyChoices = makeRhythmRound(10, () => 0);
  const lateChoices = makeRhythmRound(10, () => .99);
  assert.equal(earlyChoices.length, 10);
  assert.deepEqual(earlyChoices[0], lateChoices[0]);
  assert.notDeepEqual(earlyChoices.slice(1), lateChoices.slice(1));
  for (const bars of [earlyChoices, lateChoices]) {
    for (const [index, events] of bars.entries()) {
      assert.deepEqual(events[0], { beat: 0, duration: 1, type: 'rest' });
      assert.equal(events.reduce((beats, event) => beats + event.duration, 0), 4);
      assert.equal(events.some((event) => event.type === 'note'), true);
      if (index > 0) assert.notDeepEqual(events, bars[index - 1]);
    }
  }
  const beatMs = 60000 / EASY_MUSIC.bpm;
  assert.deepEqual(judgeRhythmTap(beatMs * .4, 0, EASY_MUSIC.bpm, earlyChoices[1]), { judgement: 'Miss', reason: 'rest', index: null });
});

test('rhythm starts after four count beats and previews the next bar for two beats', () => {
  const firstStart = 5000;
  const beatMs = 60000 / EASY_MUSIC.bpm;
  assert.deepEqual(rhythmTimelineAt(firstStart - 4 * beatMs, firstStart, EASY_MUSIC.bpm), { phase: 'count-in', barIndex: 0, countdown: 4, beatInBar: 0 });
  assert.deepEqual(rhythmTimelineAt(firstStart, firstStart, EASY_MUSIC.bpm), { phase: 'playing', barIndex: 0, countdown: 0, beatInBar: 0 });
  assert.deepEqual(rhythmTimelineAt(firstStart + 4 * beatMs, firstStart, EASY_MUSIC.bpm), { phase: 'preview', barIndex: 1, countdown: 2, beatInBar: 0 });
  assert.deepEqual(rhythmTimelineAt(firstStart + 6 * beatMs, firstStart, EASY_MUSIC.bpm), { phase: 'playing', barIndex: 1, countdown: 0, beatInBar: 0 });
});

test('melody length and ordered answers', () => {
  const notes = easyNotes();
  const melody = makeMelody(notes, melodyLength(4), () => 0);
  assert.equal(melody.length, 4);
  assert.ok(melody.every((note, index) => index === 0 || note.midi !== melody[index - 1].midi));
  assert.deepEqual(checkMelodyInput(melody, melody.slice(0, 2)), { correct: true, complete: false });
  assert.deepEqual(checkMelodyInput(melody, melody), { correct: true, complete: true });
  assert.deepEqual(checkMelodyInput(melody, [melody[1]]), { correct: false, complete: false });
});
