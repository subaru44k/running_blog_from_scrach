"""Build the offline map from the 47 MLIT N03 archives and MIC code workbook."""
import argparse
from concurrent.futures import ProcessPoolExecutor
import json
from math import cos, radians
from pathlib import Path
import unicodedata

from openpyxl import load_workbook
import shapefile
from shapely import make_valid, union_all
from shapely.geometry import box, shape

OUTPUT = Path(__file__).resolve().parents[1] / 'src/lib/games/japan-map'
# The Tokyo city map focuses on the mainland, where all 26 cities and 23 special wards are located.
TOKYO_MAINLAND = box(138, 34.85, 140.1, 36.1)
READING_CORRECTIONS = {
    '行田市': 'ぎょうだし',
    '本庄市': 'ほんじょうし',
    '羽生市': 'はにゅうし',
    '四條畷市': 'しじょうなわてし',
    '総社市': 'そうじゃし',
}


def hiragana(kana):
    return ''.join(chr(ord(char) - 96) for char in unicodedata.normalize('NFKC', kana))


def code_table(workbook):
    prefectures = {}
    cities = {}
    wards = {}
    with workbook.open('rb') as source:
        book = load_workbook(source, read_only=True, data_only=True)
        for code, pref, name, pref_kana, kana, *_ in list(book.worksheets[0].values)[1:]:
            if not code:
                continue
            if not name:
                prefectures[code[:2]] = {'id': code[:2], 'name': pref, 'kana': hiragana(pref_kana)}
            elif name.endswith('市'):
                cities[code[:5]] = {
                    'id': code[:5], 'name': name,
                    'kana': READING_CORRECTIONS.get(name, hiragana(kana)),
                }
            elif code.startswith('131') and name.endswith('区'):
                wards[code[:5]] = {'id': code[:5], 'name': name, 'kana': hiragana(kana)}
        book.close()
    assert len(prefectures) == 47 and len(cities) == 792 and len(wards) == 23
    return prefectures, cities, wards


def polygons(geometry):
    if geometry.is_empty:
        return
    if geometry.geom_type == 'Polygon':
        yield geometry
    elif geometry.geom_type in ('GeometryCollection', 'MultiPolygon'):
        for part in geometry.geoms:
            yield from polygons(part)


def fit(bounds, width, height, left=0, top=0):
    west, south, east, north = bounds
    ratio = cos(radians((north + south) / 2))
    scale = min(width / ((east - west) * ratio), height / (north - south))
    return lambda x, y: (
        left + width / 2 + (x - (west + east) / 2) * scale * ratio,
        top + height / 2 - (y - (north + south) / 2) * scale,
    )


def paths(geometry, project, tolerance, min_area=0):
    def ring_path(ring):
        coords = [','.join(f'{value:.1f}'.removesuffix('.0') for value in project(x, y))
                  for x, y in list(ring.coords)[:-1]]
        return 'M' + ' '.join(coords) + 'Z'

    parts = sorted(polygons(geometry), key=lambda polygon: polygon.area, reverse=True)
    return ''.join(
        ring_path(part.exterior) + ''.join(ring_path(ring) for ring in part.interiors)
        for index, polygon in enumerate(parts) if index == 0 or polygon.area >= min_area
        for part in polygons(polygon.simplify(tolerance, preserve_topology=True))
    )


def marker(geometry, project):
    point = max(polygons(geometry), key=lambda polygon: polygon.area).representative_point()
    return [round(value, 1) for value in project(point.x, point.y)]


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, separators=(',', ':')) + '\n')


def generate(source, prefecture, cities, wards):
    pref_id = prefecture['id']
    municipal_parts = {place['name']: [] for place in [*cities, *wards]}
    land = []
    archive = source / f'{pref_id}.zip'
    with shapefile.Reader(f'{archive}/N03-20260101_{pref_id}.shp', encoding='utf-8') as reader:
        for item in reader.iterShapeRecords():
            geometry = item.shape
            if geometry.shapeType == 0:
                continue
            west, south, east, north = geometry.bbox
            if pref_id == '13' and (north <= 34.85 or east < 138 or west > 140.1):
                continue
            if (east - west) * (north - south) < 0.000001:
                continue
            polygon = shape(geometry.__geo_interface__)
            if not polygon.is_valid:
                polygon = make_valid(polygon)
            if pref_id == '13':
                polygon = polygon.intersection(TOKYO_MAINLAND)
            parts = list(polygons(polygon))
            land.extend(parts)
            name = item.record['N03_004']
            if name in municipal_parts:
                municipal_parts[name].extend(parts)

    outline = union_all(land)
    detail = fit(outline.bounds, 522, 366, 19, 17)
    def place_map(place):
        pieces = municipal_parts[place['name']]
        if not pieces:
            raise ValueError(f'Missing geometry for {pref_id} {place["name"]}')
        boundary = union_all(pieces)
        return {
            **place, 'path': paths(boundary, detail, .00065, .000009),
            'point': marker(boundary, detail),
        }

    data = {
        'land': paths(outline, detail, .00085, .000015),
        'cities': [place_map(city) for city in cities],
    }
    if wards:
        data['wards'] = [place_map(ward) for ward in wards]
    write_json(OUTPUT / f'{pref_id}.json', data)

    if pref_id == '47':
        overview = fit(outline.bounds, 156, 106, 24, 56)
    else:
        overview = fit((128.1, 30.65, 146.3, 46.05), 500, 482, 22, 15)
        outline = outline.intersection(box(128.1, 30.65, 146.3, 46.05))
    return {
        **prefecture,
        'cityCount': len(cities),
        'path': paths(outline, overview, .018, .00052),
        'point': marker(outline, overview),
    }


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('source', type=Path, help='Directory with 01.zip through 47.zip and codes.xlsx')
    args = parser.parse_args()
    prefectures, cities, wards = code_table(args.source / 'codes.xlsx')
    with ProcessPoolExecutor(max_workers=4) as pool:
        futures = [
            pool.submit(generate, args.source, pref,
                        [city for key, city in cities.items() if key.startswith(pref_id)],
                        list(wards.values()) if pref_id == '13' else [])
            for pref_id, pref in prefectures.items()
        ]
        write_json(OUTPUT / 'prefectures.json', [future.result() for future in futures])
