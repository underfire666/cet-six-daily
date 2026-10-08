"""Import public listening recordings and PDF questions, without inventing audio.

Use --download to fetch the publicly exposed, unencrypted HLS files. Conversion
requires --ffmpeg pointing to a local executable; it is not an app dependency.
Cached source pages/segments live in output/, final clips in public/audio/.
"""
import argparse
import concurrent.futures
import hashlib
import html
import importlib.util
import json
import re
import subprocess
import time
import urllib.request
from pathlib import Path
from urllib.parse import urljoin

BASE = Path(__file__).resolve().parents[1]
OUT = BASE / 'output/audio/cet6-listening-import'
DEST = BASE / 'src/content/imported'
STAMP = '2026-10-06T00:00:00.000Z'
SOURCE = 'src-cet6-2022-2026-listening-imported'
RANGES = [(1, 4), (5, 8), (9, 11), (12, 15), (16, 18), (19, 21), (22, 25)]
spec = importlib.util.spec_from_file_location('pdf_import', BASE / 'scripts/import-cet6-pdfs.py')
pdf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pdf)


def fetch(url, target):
    if target.exists() and target.stat().st_size:
        return target.read_bytes()
    for attempt in range(8):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': 'CET6-Daily-Content-Import/1.0'})
            with urllib.request.urlopen(req, timeout=45) as response:
                data = response.read()
            assert data, ('empty response', url)
            target.parent.mkdir(parents=True, exist_ok=True)
            temp = target.with_suffix(target.suffix + '.part')
            temp.write_bytes(data)
            temp.replace(target)
            return data
        except Exception as error:
            if attempt == 7:
                print('Download failed:', url, error, flush=True)
                raise
            time.sleep(1 + attempt)


def unwrap(value):
    if isinstance(value, list) and len(value) == 2 and isinstance(value[0], int):
        return unwrap(value[1])
    if isinstance(value, list):
        return [unwrap(v) for v in value]
    if isinstance(value, dict):
        return {key: unwrap(v) for key, v in value.items()}
    return value


def source_page(identity, download):
    url = f'https://english-exam.lazynote.cn/cet6/paper/{identity}/'
    target = OUT / f'{identity}.html'
    text = (fetch(url, target) if download else target.read_bytes()).decode('utf-8')
    island = re.search(r'<astro-island[^>]*component-url="[^"]*ListeningAudioBar[^>]*props="([^"]+)"', text)
    assert island, ('no public audio player', identity)
    props = unwrap(json.loads(html.unescape(island[1])))
    assert len(props['pieces']) == 7, ('expected seven groups', identity)
    for piece, (first, last) in zip(props['pieces'], RANGES):
        assert piece['anchor'] == f'lt-{first}' and piece['start'] < piece['end']
        assert f'{first}–{last}' in piece['label'], ('question range mismatch', identity)
    return {'document': identity, 'pageUrl': url, 'playlistUrl': props['src'], 'pieces': props['pieces']}


def download_recording(source):
    identity = source['document']
    directory = OUT / identity
    directory.mkdir(parents=True, exist_ok=True)
    playlist = fetch(source['playlistUrl'], directory / 'index.m3u8').decode('utf-8')
    assert not re.search(r'#EXT-X-KEY:(?!METHOD=NONE)', playlist), 'Encrypted streams are not supported'
    lines = [line.strip() for line in playlist.splitlines() if line.strip()]
    assert '#EXT-X-ENDLIST' in lines, ('not a complete recording', identity)
    segments = [line for line in lines if not line.startswith('#')]
    assert segments and all(line.endswith('.ts') for line in segments)
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        list(executor.map(lambda name: fetch(urljoin(source['playlistUrl'], name), directory / name), segments))
    joined = directory / 'recording.ts'
    with joined.open('wb') as stream:
        for name in segments:
            data = (directory / name).read_bytes()
            assert len(data) % 188 == 0 and data[0] == 0x47, ('invalid audio transport segment', identity, name)
            stream.write(data)
    source['recordingSha256'] = hashlib.sha256(joined.read_bytes()).hexdigest()
    source['recordingDuration'] = sum(float(x) for x in re.findall(r'#EXTINF:([\d.]+)', playlist))
    assert source['pieces'][-1]['end'] <= source['recordingDuration'] + 1
    print(identity, 'downloaded', len(segments), 'segments', flush=True)
    return source


def parse_materials(row, source):
    identity, text = row['document'], row['text']
    year, month, set_no = identity.split('-')
    beginnings = list(re.finditer(r'(?m)^1 (?=[A-Za-z“"\'])', text))
    assert len(beginnings) == 7, ('transcript group count', identity)
    items, checks = [], []
    doc = json.loads((BASE / f'output/pdf/cet6-history-import/{identity}.json').read_text(encoding='utf-8'))
    manifest = json.loads((DEST / 'cet6-history-manifest.json').read_text(encoding='utf-8'))
    document = next(d for d in manifest['documents'] if d['id'] == identity)
    exam = '\n\n'.join(doc['pages'][:document['chapters']['writing']-1])
    exam = exam.split('Part II', 1)[1].split('Part III', 1)[0]
    for i, (begin, piece, (first, last)) in enumerate(zip(beginnings, source['pieces'], RANGES)):
        chunk = text[begin.start():beginnings[i+1].start() if i < 6 else len(text)]
        markers = list(re.finditer(r'(?m)^(\d+)\.\s*(?=A\))', chunk))
        assert [int(m[1]) for m in markers] == list(range(first, last+1)), ('question order', identity, i)
        transcript_raw = chunk[:markers[0].start()]
        paragraphs = pdf.marked_paragraphs(transcript_raw, r'(?:\A|\n\n)(\d{1,2})\s+(?=[A-Za-z“"\'])')
        assert [int(n) for n, _ in paragraphs] == list(range(1, len(paragraphs)+1))
        transcript = '\n\n'.join(p for _, p in paragraphs)
        stable_id = f'cet6:{year}-{month}:set{set_no}:listening:g{i+1}'
        questions = []
        for j, marker in enumerate(markers):
            number = int(marker[1])
            block = chunk[marker.end():markers[j+1].start() if j+1 < len(markers) else len(chunk)]
            block = re.split(r'(?m)^Section [ABC]\b|^Directions:', block)[0]
            option_end = block.index('【题目】')
            starts = list(re.finditer(r'(?m)^([A-D])\)\s*', block[:option_end]))
            assert [m[1] for m in starts] == list('ABCD'), ('choices', identity, number)
            options = [{'id': m[1], 'text': pdf.english_head(block[m.end():starts[k+1].start() if k < 3 else option_end])} for k, m in enumerate(starts)]
            answer = re.search(r'【答案】\s*([A-D])', block)
            assert answer
            prompt = pdf.english_head(block[option_end+len('【题目】'):])
            explanation = pdf.detail(block[answer.start():])
            short = re.search(r'【定位】\s*(.*?)(?=\n\n|【|$)', explanation, re.S)
            assert prompt and all(o['text'] for o in options) and len(explanation) > 100
            questions.append({'id': f'{stable_id}:q{number}', 'examNumber': number, 'prompt': prompt, 'options': options,
                              'answerId': answer[1], 'shortExplanation': short[1].strip() if short else explanation[:250],
                              'detailedExplanation': explanation, 'hint': '回听对应对话或篇章，留意题干关键词、转折和同义表达。'})
            # Independent comparison with the original exam, not its answer chapter.
            original_start = re.search(rf'(?m)^{number}\.\s*', exam)
            assert original_start, ('original question missing', identity, number)
            original = re.split(rf'(?m)^{number+1}\.\s*|^Section |^Directions:|^Part III', exam[original_start.end():])[0]
            original_options = list(re.finditer(r'(?m)^([A-D])\)\s*', original))
            assert [m[1] for m in original_options] == list('ABCD'), ('original options', identity, number)
            for k, m in enumerate(original_options):
                value = pdf.english_head(original[m.end():original_options[k+1].start() if k < 3 else len(original)])
                normalize = lambda s: re.sub(r'\s+', '', s)
                assert normalize(value) == normalize(options[k]['text']), ('option mismatch', identity, number, m[1], value, options[k]['text'])
            checks.append({'document': identity, 'question': number, 'originalOptions': 'PASS', 'groupAnchor': piece['anchor']})
        section = 'A' if i < 2 else 'B' if i < 4 else 'C'
        label = '长对话' if i < 2 else '听力篇章' if i < 4 else '讲座与讲话'
        item = {'id': stable_id, 'type': 'listening', 'title': f'{year}年{int(month)}月六级第{set_no}套 · {label} {i+1 if i < 2 else i-1 if i < 4 else i-3}',
                'kind': 'dialogue' if i < 2 else 'passage', 'listeningSection': section,
                'sourceId': SOURCE, 'sourceType': 'past_exam', 'authenticity': 'past_exam', 'visibility': 'public',
                'status': 'active', 'version': '1.0.0', 'difficulty': 'hard', 'tags': ['CET-6', f'{year}-{month}', f'set{set_no}', f'section-{section}'],
                'createdAt': STAMP, 'updatedAt': STAMP, 'rights': {'licenseStatus': 'unknown', 'rightsStatus': 'unverified'},
                'provenance': {'sourceType': 'user_provided', 'sourceUrl': source['pageUrl'], 'sourceFingerprint': doc['sha256'], 'retrievedAt': STAMP},
                'transcript': transcript, 'keySentences': [], 'vocabulary': {}, 'questions': questions,
                'estimatedMinutes': round((piece['end']-piece['start'])/60)+len(questions),
                'audio': {'type': 'file', 'src': f'/audio/cet6/{identity}/g{i+1}.mp3', 'duration': round(piece['end']-piece['start'], 3)}}
        items.append(item)
    return items, checks


def convert_clip(ffmpeg, source, pair):
    item, piece = pair
    target = BASE / 'public' / item['audio']['src'].lstrip('/')
    target.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run([str(ffmpeg.resolve()), '-v', 'error', '-y', '-ss', str(piece['start']), '-i', str(OUT / source['document'] / 'recording.ts'),
                    '-t', str(piece['end']-piece['start']), '-vn', '-ac', '1', '-ar', '44100', '-codec:a', 'libmp3lame', '-b:a', '64k', '-map_metadata', '-1', str(target)], check=True)
    subprocess.run([str(ffmpeg.resolve()), '-v', 'error', '-xerror', '-i', str(target), '-f', 'null', '-'], check=True)
    data = target.read_bytes()
    assert len(data) > 100000, ('audio too small', item['id'])
    return {'materialId': item['id'], 'src': item['audio']['src'], 'sizeBytes': len(data), 'sha256': hashlib.sha256(data).hexdigest(),
                   'duration': item['audio']['duration'], 'mimeType': 'audio/mpeg', 'sourcePageUrl': source['pageUrl'],
                   'playlistUrl': source['playlistUrl'], 'recordingSha256': source['recordingSha256'],
                   'start': piece['start'], 'end': piece['end'], 'anchor': piece['anchor'], 'retrievedAt': STAMP,
                   'rights': {'licenseStatus': 'unknown', 'rightsStatus': 'unverified'}}

def convert(sources, pending, ffmpeg):
    items, audit, assets = [], [], []
    for row, source in zip(pending, sources):
        materials, checks = parse_materials(row, source)
        audit.extend(checks)
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
            assets.extend(executor.map(lambda pair: convert_clip(ffmpeg, source, pair), zip(materials, source['pieces'])))
        items.extend(materials)
        print(source['document'], 'converted and decoded 7 clips', flush=True)
    by_document = {s['document']: [x['id'] for x in items if x['provenance']['sourceUrl'] == s['pageUrl']] for s in sources}
    documents = json.loads((DEST / 'cet6-history-manifest.json').read_text(encoding='utf-8'))['documents']
    mappings = []
    for doc in documents:
        identity = doc['id']
        canonical = identity
        if identity not in by_document:
            cached = json.loads((BASE / f'output/pdf/cet6-history-import/{identity}.json').read_text(encoding='utf-8'))
            original = '\n\n'.join(cached['pages'][:doc['chapters']['writing']-1])
            listening = original.split('Part II', 1)[1].split('Part III', 1)[0]
            references = re.findall(r'本部分与\s*(20\d{2})年\s*(\d+)月第\s*(\d+)套\s*共用', listening)
            assert len(references) == 3 and len(set(references)) == 1, ('ambiguous shared recording', identity)
            y, m, n = references[0]
            canonical = f'{y}-{int(m):02d}-{n}'
        assert canonical in by_document, ('unknown shared listening reference', identity)
        mappings.append({'document': identity, 'listeningDocument': canonical, 'materialIds': by_document[canonical]})
    assert len(items) == 133 and sum(len(x['questions']) for x in items) == 475
    pack = {'id': 'pack-cet6-2022-2026-listening', 'name': '2022–2026年六级 · 听力', 'version': '1.0.0', 'contentType': 'listening',
            'sourceId': SOURCE, 'createdAt': STAMP, 'updatedAt': STAMP, 'rights': {'licenseStatus': 'unknown', 'rightsStatus': 'unverified'}, 'items': items}
    manifest = {'schemaVersion': 1, 'importedAt': STAMP, 'years': [2022, 2023, 2024, 2025, 2026], 'listeningEnabled': True,
                'papers': 19, 'materials': 133, 'questions': 475, 'documents': mappings, 'assets': assets,
                'notes': 'Active listening import manifest. The reading-import manifests record the earlier no-audio snapshot.'}
    (DEST / 'cet6-2022-2026-listening.json').write_text(json.dumps(pack, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (DEST / 'cet6-listening-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (OUT / 'original-question-audit.json').write_text(json.dumps({'result': 'PASS', 'count': len(audit), 'checks': audit}, ensure_ascii=False, indent=2), encoding='utf-8')
    print('PASS: 19 recordings, 133 clips, 475 independently checked questions', flush=True)


def main(args):
    OUT.mkdir(parents=True, exist_ok=True)
    pending = json.loads((BASE / 'output/pdf/cet6-history-import/listening-pending.json').read_text(encoding='utf-8'))
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as executor:
        sources = list(executor.map(lambda row: source_page(row['document'], args.download), pending))
    (OUT / 'source-pages.json').write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding='utf-8')
    print('Audio sources verified:', len(sources), flush=True)
    if args.pages_only:
        return
    if args.download:
        # One recording at a time, at most eight simultaneous public downloads.
        sources = [download_recording(source) for source in sources]
    else:
        for source in sources:
            recording = OUT / source['document'] / 'recording.ts'
            source['recordingSha256'] = hashlib.sha256(recording.read_bytes()).hexdigest()
    (OUT / 'source-pages.json').write_text(json.dumps(sources, ensure_ascii=False, indent=2), encoding='utf-8')
    # Content conversion follows after all sources have been downloaded.
    if args.ffmpeg:
        convert(sources, pending, args.ffmpeg)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--download', action='store_true')
    parser.add_argument('--pages-only', action='store_true')
    parser.add_argument('--ffmpeg', type=Path)
    main(parser.parse_args())
