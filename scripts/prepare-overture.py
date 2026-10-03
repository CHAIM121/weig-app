"""Convert downloaded Overture GeoJSON sequences to WEIG import records.
Usage: python scripts/prepare-overture.py input.geojsonseq RELEASE output.json
No API keys required. Does not copy Google data or infer kosher status.
"""
import json
import sys


def convert(feature, release):
    p = feature.get('properties', {})
    geometry = feature.get('geometry', {})
    if geometry.get('type') != 'Point':
        raise ValueError('Expected Point')
    lng, lat = geometry['coordinates'][:2]
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        raise ValueError('Invalid coordinates')
    name = (p.get('names') or {}).get('primary')
    external_id = feature.get('id') or p.get('id')
    if not name or not external_id:
        raise ValueError('Missing identity/name')
    address = (p.get('addresses') or [{}])[0]
    taxonomy = p.get('taxonomy') or {}
    category = taxonomy.get('primary') or (p.get('categories') or {}).get('primary') or 'other'
    return dict(external_id=external_id, name=name,
                names=p.get('names') or {}, latitude=lat, longitude=lng,
                address=', '.join(str(address[k]) for k in ['freeform', 'locality', 'region', 'country'] if address.get(k)),
                city=address.get('locality'), country=address.get('country'),
                category=category, website=(p.get('websites') or [None])[0],
                phone=(p.get('phones') or [None])[0],
                confidence=p.get('confidence'), operating_status=p.get('operating_status'),
                release=release, raw=p)


if __name__ == '__main__':
    records = []
    skipped = 0
    with open(sys.argv[1], encoding='utf-8') as source:
        for line in source:
            if not line.strip():
                continue
            try:
                records.append(convert(json.loads(line.lstrip('\x1e')), sys.argv[2]))
            except (ValueError, KeyError, TypeError):
                skipped += 1
    with open(sys.argv[3], 'w', encoding='utf-8') as target:
        json.dump(records, target, ensure_ascii=False)
    print(json.dumps(dict(records=len(records), skipped=skipped)))
