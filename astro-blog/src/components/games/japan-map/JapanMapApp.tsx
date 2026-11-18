import { useEffect, useRef, useState } from 'react';
import prefectures from '../../../lib/games/japan-map/prefectures.json';
import { makeRound } from '../../../lib/games/japan-map/quiz.mjs';
import './japan-map.css';

type Place = { id: string; name: string; kana: string; path: string; point: number[] };
type CityMap = { land: string; cities: Place[]; wards?: Place[] };
type Audience = 'adult' | 'child';
type Mode = 'study' | 'quiz';
type Topic = 'cities' | 'prefectures';
type Settings = {
  audience: Audience;
  mode: Mode;
  topic: Topic;
  prefecture: string;
  viewed: string[];
};
type Question = { answer: Place; choices: Place[] };

const defaults: Settings = { audience: 'adult', mode: 'study', topic: 'cities', prefecture: '', viewed: [] };
const storageKey = 'japan-map-v1';
const cityMaps = import.meta.glob<{ default: CityMap }>('../../../lib/games/japan-map/[0-9][0-9].json');
const regionNames = [
  ['北海道・東北', 'ほっかいどう・とうほく', 1, 7],
  ['関東', 'かんとう', 8, 14],
  ['中部', 'ちゅうぶ', 15, 23],
  ['近畿', 'きんき', 24, 30],
  ['中国・四国', 'ちゅうごく・しこく', 31, 39],
  ['九州・沖縄', 'きゅうしゅう・おきなわ', 40, 47],
] as const;

function readSettings(): Settings {
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) ?? 'null');
    if (!saved) return defaults;
    return {
      audience: saved.audience === 'child' ? 'child' : 'adult',
      mode: saved.mode === 'quiz' ? 'quiz' : 'study',
      topic: saved.topic === 'prefectures' ? 'prefectures' : 'cities',
      prefecture: prefectures.some((prefecture) => prefecture.id === saved.prefecture) ? saved.prefecture : '',
      viewed: Array.isArray(saved.viewed)
        ? [...new Set<string>(saved.viewed.filter((id: unknown) => typeof id === 'string' && /^[0-9]{5}$/.test(id)))]
        : [],
    };
  } catch {
    return defaults;
  }
}

function GeographyMap({ detail, places, highlight, onPick, child }: {
  detail?: CityMap;
  places: Place[];
  highlight?: Place;
  onPick?: (place: Place) => void;
  child: boolean;
}) {
  return (
    <div className="jm-map">
      <svg viewBox={detail ? '0 0 560 400' : '0 0 544 512'} role="img"
        aria-label={detail?.wards ? (child ? 'しと くの ちず' : '市と区の地図')
          : detail ? (child ? 'しのちず' : '市の地図') : (child ? 'にほんのちず' : '日本地図')}>
        {!detail && <g className="jm-inset">
          <rect x="18" y="36" width="171" height="134" rx="12" />
          <text x="31" y="57">{child ? 'おきなわ' : '沖縄'}</text>
        </g>}
        {detail && <path className="jm-land" d={detail.land} />}
        {places.map((place) => (
          <path key={place.id} className={`jm-area ${highlight?.id === place.id ? 'jm-active-area' : ''}`}
            d={place.path} onClick={onPick ? () => onPick(place) : undefined}
            data-pickable={onPick ? '' : undefined}>
            {onPick && <title>{child ? place.kana : place.name}</title>}
          </path>
        ))}
        {highlight && <g pointerEvents="none">
          <path className="jm-outline" d={highlight.path} />
          <circle className="jm-marker" cx={highlight.point[0]} cy={highlight.point[1]} r="4.5" />
        </g>}
      </svg>
    </div>
  );
}

function MapQuiz({ places, detail, child }: { places: Place[]; detail?: CityMap; child: boolean }) {
  const t = (adult: string, kana: string) => child ? kana : adult;
  const label = (place: Place) => child ? place.kana : place.name;
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<string[]>([]);
  const [index, setIndex] = useState(0);
  const questionHeading = useRef<HTMLHeadingElement>(null);
  const nextButton = useRef<HTMLButtonElement>(null);
  const question = questions[index];
  const picked = answers[index];
  const missed = questions.filter((item, position) => answers[position] && answers[position] !== item.answer.id);
  const finished = questions.length > 0 && index === questions.length;

  useEffect(() => {
    if (picked) nextButton.current?.focus({ preventScroll: true });
    else if (questions.length) questionHeading.current?.focus({ preventScroll: true });
  }, [index, picked, questions]);

  function start(targets = places) {
    setQuestions(makeRound(places, targets));
    setAnswers([]);
    setIndex(0);
  }

  return (
    <div className="jm-workspace">
      <GeographyMap detail={detail} places={places} highlight={question?.answer} child={child} />
      <section className="jm-panel" aria-label={t('クイズ', 'くいず')}>
        {question ? <>
          <p className="jm-progress">{index + 1} / {questions.length}</p>
          <h2 ref={questionHeading} tabIndex={-1}>{detail?.wards ? t('この市・区はどこ？', 'この し・くは どこ？') : detail ? t('この市はどこ？', 'この しは どこ？') : t('この都道府県はどこ？', 'この とどうふけんは どこ？')}</h2>
          <p className="jm-muted">{t('オレンジ色で示した場所の名前を選ぼう。', 'おれんじいろの ばしょの なまえを えらぼう。')}</p>
          <div className="jm-choices">
            {question.choices.map((place) => (
              <button key={place.id} type="button" className="jm-button"
                data-answer={picked ? place.id === question.answer.id ? 'correct' : place.id === picked ? 'wrong' : undefined : undefined}
                disabled={Boolean(picked)} onClick={() => setAnswers([...answers, place.id])}>
                {label(place)}
              </button>
            ))}
          </div>
          <div className="jm-feedback" role="status">
            {picked && (picked === question.answer.id
              ? t('正解！', 'せいかい！')
              : t('正解は「', 'せいかいは「') + label(question.answer) + t('」です。', '」だよ。'))}
          </div>
          {picked && <button ref={nextButton} type="button" className="jm-button jm-primary" onClick={() => setIndex(index + 1)}>
            {index + 1 === questions.length ? t('結果を見る', 'けっかを みる') : t('次の問題', 'つぎの もんだい')}
          </button>}
        </> : finished ? <>
          <h2 ref={questionHeading} tabIndex={-1}>{t('クイズの結果', 'くいずの けっか')}</h2>
          <p className="jm-result" role="status">{questions.length - missed.length} / {questions.length} {t('問正解', 'もん せいかい')}</p>
          {missed.length > 0 && <>
            <p className="jm-muted">{t('もう一度見てみよう', 'もういちど みてみよう')}</p>
            <ul className="jm-missed">{missed.map(({ answer }) => <li key={answer.id}>{label(answer)}</li>)}</ul>
            <button type="button" className="jm-button jm-primary" onClick={() => start(missed.map(({ answer }) => answer))}>
              {t('間違えた問題を復習', 'まちがえた もんだいを もういちど')}
            </button>
          </>}
          <button type="button" className="jm-button" onClick={() => start()}>{t('新しい問題に挑戦', 'あたらしい もんだいに ちょうせん')}</button>
        </> : <>
          <h2>{t('地図クイズ', 'ちずくいず')}</h2>
          <p className="jm-muted">{t('地図に出る場所の名前を選ぼう。', 'ちずに でる ばしょの なまえを えらぼう。')}</p>
          <p className="jm-muted">{Math.min(5, places.length)}{t('問・時間制限なし', 'もん・じかんは はからないよ')}</p>
          <button type="button" className="jm-button jm-primary" onClick={() => start()}>{t('クイズを始める', 'くいずを はじめる')}</button>
        </>}
      </section>
    </div>
  );
}

export default function JapanMapApp() {
  const [settings, setSettings] = useState<Settings>(defaults);
  const [ready, setReady] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [pickedPrefecture, setPickedPrefecture] = useState('');
  const [pickedCity, setPickedCity] = useState('');
  const [loaded, setLoaded] = useState<{ id: string; data?: CityMap }>();
  const [attempt, setAttempt] = useState(0);
  const locationHeading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    setSettings(readSettings());
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(storageKey, JSON.stringify(settings));
    } catch {
      // The game still works with storage turned off.
    }
  }, [ready, settings]);

  const child = settings.audience === 'child';
  const t = (adult: string, kana: string) => child ? kana : adult;
  const label = (place: Place) => child ? place.kana : place.name;
  const currentPrefecture = prefectures.find(({ id }) => id === settings.prefecture);
  const national = settings.topic === 'prefectures';
  const visiblePrefecture = !national && !choosing ? currentPrefecture : undefined;
  const mapId = visiblePrefecture?.id;

  useEffect(() => {
    if (!mapId) return;
    let active = true;
    const load = cityMaps[`../../../lib/games/japan-map/${mapId}.json`];
    load().then(({ default: data }) => {
      if (active) setLoaded({ id: mapId, data });
    }).catch(() => {
      if (active) setLoaded({ id: mapId });
    });
    return () => { active = false; };
  }, [mapId, attempt]);

  const detail = mapId && loaded?.id === mapId ? loaded.data : undefined;
  const places = detail?.wards ? [...detail.wards, ...detail.cities] : detail?.cities ?? prefectures;
  const selected = places.find(({ id }) => id === (national ? pickedPrefecture : pickedCity));
  const viewed = new Set(settings.viewed);
  const totalViewed = places.filter(({ id }) => viewed.has(id)).length;
  const viewedLabel = detail?.wards ? t('見た市・区', 'みた し・く') : t('見た市', 'みた し');

  function placeButtons(items: Place[]) {
    return items.map((place) => (
      <button key={place.id} type="button" className="jm-button"
        aria-pressed={place.id === selected?.id} onClick={() => studyPick(place)}>
        {label(place)}{viewed.has(place.id) && <span className="jm-check" role="img" aria-label={viewedLabel}>✓</span>}
      </button>
    ));
  }

  function openPrefecture(id: string) {
    setPickedCity('');
    setLoaded((previous) => previous?.id === id && previous.data ? previous : undefined);
    setChoosing(false);
    setSettings((previous) => ({ ...previous, prefecture: id, topic: 'cities' }));
    locationHeading.current?.focus();
  }

  function studyPick(place: Place) {
    if (national) {
      setPickedPrefecture(place.id);
    } else if (!detail) {
      openPrefecture(place.id);
    } else {
      setPickedCity(place.id);
      setSettings((previous) => previous.viewed.includes(place.id)
        ? previous : { ...previous, viewed: [...previous.viewed, place.id] });
    }
  }

  function toggle<T extends 'audience' | 'mode' | 'topic'>(key: T, value: Settings[T]) {
    if (key === 'topic') setChoosing(false);
    setSettings((previous) => ({ ...previous, [key]: value }));
  }

  const mapQuiz = settings.mode === 'quiz' && (national || detail);
  return (
    <div className="jm">
      <header className="jm-header">
        <h1>{t('日本地図でまなぼう', 'にほんちずで まなぼう')}</h1>
        <p>{t('47都道府県、792市、東京23区。地図を見ながら、名前と場所を覚えよう。', '47の とどうふけん、792の し、とうきょう23く。ちずを みて、なまえと ばしょを おぼえよう。')}</p>
      </header>
      <div className="jm-controls">
        <div className="jm-switch" role="group" aria-label={t('遊び方', 'あそびかた')}>
          <button type="button" aria-pressed={settings.mode === 'study'} onClick={() => toggle('mode', 'study')}>{t('勉強モード', 'べんきょう')}</button>
          <button type="button" aria-pressed={settings.mode === 'quiz'} onClick={() => toggle('mode', 'quiz')}>{t('クイズモード', 'くいず')}</button>
        </div>
        <div className="jm-switch" role="group" aria-label={t('学ぶ範囲', 'まなぶ はんい')}>
          <button type="button" aria-pressed={national} onClick={() => toggle('topic', 'prefectures')}>{t('都道府県', 'とどうふけん')}</button>
          <button type="button" aria-pressed={!national} onClick={() => toggle('topic', 'cities')}>{t('市', 'し')}</button>
        </div>
        <div className="jm-switch" role="group" aria-label={t('表示する文字', 'つかう もじ')}>
          <button type="button" aria-pressed={!child} onClick={() => toggle('audience', 'adult')}>{t('大人向け', 'おとなむけ')}</button>
          <button type="button" aria-pressed={child} onClick={() => toggle('audience', 'child')}>こどもむけ</button>
        </div>
      </div>

      <div className="jm-location">
        <h2 ref={locationHeading} tabIndex={-1}>{visiblePrefecture ? label(visiblePrefecture) : t('日本全国', 'にほん ぜんこく')}</h2>
        {visiblePrefecture ? <button type="button" className="jm-button" onClick={() => setChoosing(true)}>{t('日本地図に戻る', 'にほんの ちずに もどる')}</button>
          : currentPrefecture && <button type="button" className="jm-button" onClick={() => openPrefecture(currentPrefecture.id)}>
            {t('前回の', 'まえの ')}{label(currentPrefecture)}{t('へ', ' へ')}
          </button>}
      </div>

      {mapId && !detail ? (
        <div className="jm-panel" role="status">
          {loaded?.id === mapId ? <>
            <p>{t('地図を読み込めませんでした。', 'ちずを よみこめなかったよ。')}</p>
            <button type="button" className="jm-button" onClick={() => { setLoaded(undefined); setAttempt(attempt + 1); }}>{t('もう一度読み込む', 'もういちど')}</button>
          </> : <p>{t('地図を読み込み中…', 'ちずを よみこんでいるよ…')}</p>}
        </div>
      ) : mapQuiz ? (
        <MapQuiz key={mapId ?? 'national'} places={places} detail={detail} child={child} />
      ) : (
        <div className="jm-workspace">
          <GeographyMap detail={detail} places={places} highlight={selected} onPick={studyPick} child={child} />
          <section className="jm-panel" aria-label={detail?.wards ? t('市と区の一覧', 'しと くの いちらん') : detail ? t('市の一覧', 'しの いちらん') : t('都道府県の一覧', 'とどうふけんの いちらん')}>
            {detail ? <>
              <h2>{detail.wards ? t('市と区を見てみよう', 'しと くを みてみよう') : t('市を見てみよう', 'しを みてみよう')}</h2>
              <p className="jm-muted">{viewedLabel} {totalViewed} / {places.length}</p>
              <div className="jm-selected" role="status">
                {selected ? <><strong>{label(selected)}</strong>{!child && <span>{selected.kana}</span>}</>
                  : <span>{t('地図か一覧から選ぼう。', 'ちずか いちらんから えらぼう。')}</span>}
              </div>
              {detail.wards ? (
                <div className="jm-list jm-pref-list">
                  <h3>{t('東京23区', 'とうきょう23く')}</h3>
                  <div className="jm-city-list">{placeButtons(detail.wards)}</div>
                  <h3>{t('東京都の26市', 'とうきょうとの 26の し')}</h3>
                  <div className="jm-city-list">{placeButtons(detail.cities)}</div>
                </div>
              ) : <div className="jm-list jm-city-list">{placeButtons(detail.cities)}</div>}
            </> : <>
              <h2>{t('都道府県を選ぼう', 'とどうふけんを えらぼう')}</h2>
              {national && <div className="jm-selected">
                <div role="status">{selected ? <><strong>{label(selected)}</strong>{!child && <span>{selected.kana}</span>}</>
                  : <span>{t('地図か一覧から選ぼう。', 'ちずか いちらんから えらぼう。')}</span>}</div>
                {selected && <button type="button" className="jm-button" onClick={() => openPrefecture(selected.id)}>{selected.id === '13' ? t('東京都の市と区を見る', 'とうきょうとの しと くを みる') : t('この都道府県の市を見る', 'この とどうふけんの しを みる')}</button>}
              </div>}
              <div className="jm-list jm-pref-list">
                {regionNames.map(([name, kana, start, end]) => (
                  <section key={start} aria-label={child ? kana : name}>
                    <h3>{child ? kana : name}</h3>
                    <div className="jm-region">
                      {prefectures.slice(start - 1, end).map((place) => (
                        <button key={place.id} type="button" className="jm-button"
                          aria-pressed={national ? selected?.id === place.id : undefined}
                          onClick={() => studyPick(place)}>{label(place)}</button>
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            </>}
          </section>
        </div>
      )}

      <footer className="jm-source">
        {t('地図は学習用に簡略化しています。東京都の地図は本土部分を中心に表示します。', 'ちずは べんきょうようです。とうきょうとの ちずは、しや くが ある ところを おおきく だしています。')}
        <div>
          <a href="https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2026.html">{t('国土交通省「国土数値情報（行政区域）」を加工', 'ちずの もとでーた')}</a>
          <a href="https://www.soumu.go.jp/denshijiti/code.html">{t('総務省「全国地方公共団体コード」', 'なまえの もとでーた')}</a>
        </div>
      </footer>
    </div>
  );
}
