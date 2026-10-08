"""Import the supplied 2022-2026 explanation PDFs without duplicating June 2026.

Uses cached layout extraction, audits original exam pages independently, and only
writes packs once the complete batch passes. No network, audio synthesis or UI.
"""
import argparse
from collections import Counter
import hashlib
import importlib.util
import json
import re
from pathlib import Path
from pypdf import PdfReader

BASE = Path(__file__).resolve().parents[1]
OUT = BASE / 'output/pdf/cet6-history-import'
DEST = BASE / 'src/content/imported'
STAMP = '2026-10-06T00:00:00.000Z'
SOURCE = 'src-cet6-2022-2025-imported'
PARTS = [('cloze', 26, 35), ('matching', 36, 45), ('careful1', 46, 50), ('careful2', 51, 55)]
spec = importlib.util.spec_from_file_location('cet6_pdf', BASE / 'scripts/import-cet6-pdfs.py')
pdf = importlib.util.module_from_spec(spec)
spec.loader.exec_module(pdf)


def read_document(path, identity):
    fingerprint = hashlib.sha256(path.read_bytes()).hexdigest()
    cache = OUT / (identity + '.json')
    if cache.exists():
        data = json.loads(cache.read_text(encoding='utf-8'))
        if data['sha256'] == fingerprint:
            return data
    pages = [pdf.clean(p.extract_text(extraction_mode='layout')) for p in PdfReader(path).pages]
    data = {'id': identity, 'sha256': fingerprint, 'pages': pages}
    cache.write_text(json.dumps(data, ensure_ascii=False), encoding='utf-8')
    return data


def boundaries(pages):
    starts = {}
    for n, page in enumerate(pages):
        head = page.splitlines()[0] if page else ''
        if not re.match(r'^20\d{2}', head):
            continue
        for key, phrase in [('writing', '英语六级写作'), ('translation', '英语六级汉译英'),
                            ('listening', '英语六级听力'), ('cloze', '英语六级完形填空'),
                            ('matching', '英语六级长篇阅读')]:
            if phrase in head:
                assert key not in starts, ('duplicate chapter', key)
                starts[key] = n
        if '英语六级阅读理解' in head:
            key = 'careful1' if re.search(r'第\s*1\s*篇', head) else 'careful2'
            assert key not in starts, ('duplicate chapter', key)
            starts[key] = n
    assert {'writing', 'translation'} <= starts.keys(), ('missing subjective chapters', starts)
    return starts


def meta(identity, type_, suffix):
    year, month, set_no = identity.split('-')
    prefix = f'cet6:{year}-{month}:set{set_no}'
    return {'id': f'{prefix}:{suffix}', 'type': type_, 'title': f'{year}年{int(month)}月六级第{set_no}套',
            'sourceId': SOURCE, 'sourceType': 'past_exam', 'authenticity': 'past_exam', 'status': 'active',
            'version': '1.0.0', 'difficulty': 'normal', 'tags': ['CET-6', f'{year}-{month}', f'set{set_no}'],
            'createdAt': STAMP, 'updatedAt': STAMP,
            'rights': {'licenseStatus': 'unknown', 'rightsStatus': 'unverified'}}


STOP_WORDS = set('the and that this with from into have has had were been being will would should could can may more most much many than only also some such each their there these those them they which when what where while about after before both over under between through because therefore however first second finally today people other every make made still well very ever just then our your not but for are was its who how'.split())


def keywords(reference):
    words = re.findall(r"[A-Za-z][A-Za-z'-]{3,}", reference.lower())
    counts = Counter(word.strip("'-") for word in words if word not in STOP_WORDS)
    selected = [word for word, _ in counts.most_common(6)]
    assert len(selected) == 6 and all(word in reference.lower() for word in selected)
    return selected


def read_article(identity, part, first, last, text):
    if part == 'cloze':
        intro = text[:re.search(r'(?m)^26\.', text).start()]
        banks = list(re.finditer(r'(?m)^A\)?\s+[A-Za-z-]+(?:\s+I\)?\s+[A-Za-z-]+)?\s*$', intro))
        assert banks, ('missing word bank', identity)
        bank = banks[-1]
        opts = {m[1]: m[2] for m in re.finditer(r'([A-O])\)?\s+([A-Za-z-]+)', intro[bank.start():])}
        assert len(opts) == 15, ('word bank', identity, len(opts))
        choices = [{'id': key, 'text': opts[key]} for key in sorted(opts)]
        questions, _ = pdf.questions(text, first, last, 'cloze', choices)
        body = intro[:bank.start()].split('once.', 1)[1]
        groups = [pdf.english_head(block) for block in re.split(r'\n\n+', body.strip())]
        groups = [block for block in groups if block]
        passage = '\n\n'.join(groups)
        for number in range(26, 36):
            candidates = list(re.finditer(rf'\b{number}\b', passage))
            if len(candidates) > 1:
                # Real numbers such as "30 seconds" are not numbered blanks.
                prompt = questions[number-26]['prompt']
                context = re.split(rf'_+\(?{number}\)?_+', prompt)
                assert len(context) == 2, ('ambiguous blank context', identity, number)
                left = ' '.join(context[0].split()[-6:])
                right = ' '.join(context[1].split()[:6])
                candidates = [m for m in candidates if passage[:m.start()].rstrip().endswith(left)
                              and passage[m.end():].lstrip().startswith(right)]
            assert len(candidates) == 1, ('blank', identity, number)
            match = candidates[0]
            passage = passage[:match.start()] + f'[{number}] _____' + passage[match.end():]
        assert len({q['answerId'] for q in questions}) == 10, ('reused cloze answer', identity)
        for question in questions:
            if re.fullmatch(r'_+\(?\d+\)?_+\.?', question['prompt']):
                marker = f'[{question["examNumber"]}] _____'
                context = [sentence for sentence in re.split(r'(?<=[.!?])\s+', passage) if marker in sentence]
                assert len(context) == 1, ('missing cloze sentence context', identity, question['examNumber'])
                question['prompt'] = context[0]
        title, minutes, kind = '选词填空', 8, 'cloze'
    elif part == 'matching':
        intro = text[:re.search(r'(?m)^36\.', text).start()]
        paras = pdf.marked_paragraphs(intro, r'^([A-Z])\)\s*')
        assert len(paras) >= 10 and [p[0] for p in paras] == [chr(65+i) for i in range(len(paras))]
        choices = [{'id': key, 'text': '段落 ' + key} for key, _ in paras]
        questions, _ = pdf.questions(text, first, last, 'matching', choices)
        passage = '\n\n'.join(key + ') ' + body for key, body in paras)
        title, minutes, kind = '信息匹配', 12, 'matching'
    else:
        questions, intro = pdf.questions(text, first, last, 'careful')
        paras = pdf.marked_paragraphs(intro, r'^P(\d+)\s+(?=[A-Za-z"\'“])')
        assert len(paras) >= 3 and [p[0] for p in paras] == [str(i+1) for i in range(len(paras))]
        passage = '\n\n'.join(body for _, body in paras)
        title, minutes, kind = '仔细阅读 · ' + ('第一篇' if part == 'careful1' else '第二篇'), 6, 'careful'
    item = meta(identity, 'reading', part)
    for question in questions:
        question['id'] = f'{item["id"]}:q{question["examNumber"]}'
    return {**item, 'title': item['title'] + ' · ' + title, 'passage': passage, 'questions': questions,
            'estimatedMinutes': minutes, 'vocabulary': {}, 'exerciseType': kind}


def writing_task(identity, chapter):
    model = re.search(r'【参考范文[^】]*】[^\n]*\n', chapter)
    assert model, ('missing essay', identity)
    prompt = pdf.join(chapter[chapter.index('Directions:'):model.start()].splitlines())
    raw = chapter[model.end():chapter.index('【参考译文】', model.end())]
    paragraphs = [pdf.join(p.splitlines()) for p in re.split(r'\n\n+', raw.strip()) if p.strip()]
    essay = '\n\n'.join(paragraphs)
    assert 150 <= len(essay.split()) <= 200, ('essay length', identity, len(essay.split()))
    assert 3 <= len(paragraphs) <= 5, ('essay paragraphs', identity, len(paragraphs))
    requirements = ['150–200 词', '围绕题目主题展开，论点清晰，举例具体']
    if 'begins with the sentence' in prompt:
        requirements.append('将题目给定句子放在文章开头')
    item = meta(identity, 'writing', 'writing')
    return {**item, 'title': item['title'] + ' · 写作', 'level': 'essay', 'prompt': prompt,
            'requirements': requirements, 'suggestedWords': keywords(essay), 'referenceEssay': essay,
            'outline': [{'type': kind, 'content': p} for kind, p in zip(['introduction', 'body', 'conclusion'],
                         [paragraphs[0], '\n\n'.join(paragraphs[1:-1]), paragraphs[-1]])],
            'referenceExplanation': pdf.detail(chapter[chapter.index('【参考译文】')+len('【参考译文】'):], teaching=True),
            'scoringPoints': ['紧扣题目主题与要求', '论点清晰，举例具体', '段落连贯，语言准确', '满足字数要求'],
            'mockFeedback': {'summary': '请对照参考范文检查主题、题面要求、段落衔接与表达；当前为规则估分。', 'issues': [], 'details': []},
            'suggestedWordsRange': [150, 200]}


def translation_task(identity, chapter):
    begin = chapter.index('You should write your answer on Answer Sheet 2.') + len('You should write your answer on Answer Sheet 2.')
    finish = chapter.index('参考译文', begin)
    chinese = pdf.join(chapter[begin:finish].splitlines())
    after = chapter[finish:].split('正确」四档评分。', 1)[1]
    reference = pdf.english_head(after)
    assert len(chinese) > 100 and len(reference) > 300, ('translation length', identity)
    item = meta(identity, 'translation', 'translation')
    return {**item, 'title': item['title'] + ' · 段落翻译', 'level': 'paragraph', 'promptChinese': chinese,
            'keywords': keywords(reference), 'referenceTranslation': reference,
            'referenceExplanation': pdf.detail(chapter[chapter.index('【衔接】'):], teaching=True),
            'scoringPoints': ['完整传达原文信息', '时态和主谓一致准确', '术语和固定搭配恰当', '句间衔接自然'],
            'mockFeedback': {'summary': '对照参考译文检查信息是否完整、术语是否准确；当前为规则估分。', 'issues': [], 'details': []},
            'estimatedMinutes': 15}


def make_pack(type_, items):
    return {'id': f'pack-cet6-2022-2025-{type_}', 'name': f'2022–2025年六级 · {type_}',
            'version': '1.0.0', 'contentType': type_, 'sourceId': SOURCE, 'createdAt': STAMP, 'updatedAt': STAMP,
            'rights': {'licenseStatus': 'unknown', 'rightsStatus': 'unverified'}, 'items': items}


def audit_passages(exam, articles, identity):
    checks = []
    normalize = lambda value: re.sub(r'\s+', '', pdf.join(value.splitlines()))
    for article in articles:
        part = article['id'].rsplit(':', 1)[-1]
        if part == 'cloze':
            original = exam.split('Part III', 1)[1].split('Section B', 1)[0].split('once.', 1)[1]
            banks = list(re.finditer(r'(?m)^A\)?\s+[A-Za-z-]+(?:\s+I\)?\s+[A-Za-z-]+)?\s*$', original))
            assert banks, ('original word bank missing', identity)
            bank = banks[-1]
            bank_words = {m[1]: m[2] for m in re.finditer(r'([A-O])\)?\s+([A-Za-z-]+)', original[bank.start():])}
            assert bank_words == {o['id']: o['text'] for o in article['questions'][0]['options']}, ('original word bank differs', identity)
            restored = re.sub(r'\[(\d+)\] _____', r'\1', article['passage'])
            assert normalize(original[:bank.start()]) == normalize(restored), ('original cloze passage differs', identity)
        elif part == 'matching':
            original = exam.split('Section B', 1)[-1]
            # There is also a listening Section B: use the final matching directions.
            original = original.split('Each paragraph is marked with a letter.', 1)[1]
            original = original[:re.search(r'(?m)^36\.', original).start()]
            original = original[re.search(r'(?m)^A\)\s*', original).start():]
            assert normalize(original) == normalize(article['passage']), ('original matching passage differs', identity)
        else:
            marker = 'Passage One' if part == 'careful1' else 'Passage Two'
            first = 46 if part == 'careful1' else 51
            original = exam.split(marker, 1)[1]
            original = original[:re.search(rf'(?m)^{first}\.', original).start()]
            assert normalize(original) == normalize(article['passage']), ('original careful passage differs', identity, part)
        checks.append({'document': identity, 'exercise': part, 'originalPassageAndBank': 'PASS'})
    return checks


def main(folder):
    OUT.mkdir(parents=True, exist_ok=True)
    reading, writing, translation, documents, audit, pending = [], [], [], [], [], []
    seen = set()
    for path in sorted(folder.glob('*.pdf')):
        match = re.search(r'(20\d{2})年(\d+)月第(\d+)套', path.name)
        assert match, ('unidentified PDF', path.name)
        year, month, set_no = int(match[1]), int(match[2]), int(match[3])
        assert 2022 <= year <= 2026 and set_no in (1, 2, 3)
        identity = f'{year}-{month:02d}-{set_no}'
        assert identity not in seen, ('duplicate document identity', identity)
        seen.add(identity)
        doc = read_document(path, identity)
        pages = doc['pages']
        starts = boundaries(pages)
        exam = '\n\n'.join(pages[:starts['writing']])
        def chapter(key):
            begin = starts[key]
            end = min([v for v in starts.values() if v > begin] + [len(pages)])
            return '\n\n'.join(pages[begin:end])
        new_articles, references = [], []
        for part, first, last in PARTS:
            if part in starts:
                item = read_article(identity, part, first, last, chapter(part))
                new_articles.append(item)
                references.append(item['id'])
            else:
                shared = re.search(r'本部分与\s*(20\d{2})年\s*(\d+)月第\s*(\d+)套\s*共用', exam)
                assert shared, ('missing reading without shared reference', identity, part)
                references.append(f'cet6:{shared[1]}-{int(shared[2]):02d}:set{shared[3]}:{part}')
        audit.extend({**row, 'document': identity} for row in pdf.audit_original_exam(exam, new_articles, identity))
        audit.extend(audit_passages(exam, new_articles, identity))
        w = writing_task(identity, chapter('writing'))
        t = translation_task(identity, chapter('translation'))
        normalize = lambda value: re.sub(r'\s+', '', value)
        original_prompt = exam[exam.index('Directions:'):].split('Part II', 1)[0]
        assert normalize(original_prompt) == normalize(w['prompt']), ('original writing prompt differs', identity)
        original_chinese = re.split(r'You\s+should\s+write\s+your\s+answer\s+on\s+Answer\s+Sheet\s+2\.', exam.split('Part IV', 1)[1], maxsplit=1)[1]
        assert normalize(original_chinese) == normalize(t['promptChinese']), ('original translation prompt differs', identity)
        audit.extend([{'document': identity, 'originalWritingPrompt': 'PASS'},
                      {'document': identity, 'originalTranslationPrompt': 'PASS'}])
        if 'listening' in starts:
            text = chapter('listening')
            count = len(re.findall(r'【答案】\s*[A-D]', text))
            assert count == 25, ('listening count', identity, count)
            pending.append({'document': identity, 'status': 'missing_audio', 'answerCount': count, 'text': text})
        documents.append({'id': identity, 'documentSha256': doc['sha256'], 'pages': len(pages),
                          'chapters': {key: value+1 for key, value in starts.items()}, 'readingIds': references,
                          'newReadingQuestions': sum(len(a['questions']) for a in new_articles),
                          'writingId': w['id'], 'translationId': t['id'],
                          'listeningStatus': 'missing_audio' if 'listening' in starts else 'shared_with_set1'})
        # Preserve the existing three packs and their IDs/content byte-for-byte.
        if (year, month) != (2026, 6):
            reading.extend(new_articles)
            writing.append(w)
            translation.append(t)
        print(identity, 'checked', len(new_articles), 'reading groups', flush=True)
    assert len(documents) == 33, ('expected 33 documents', len(documents))
    all_reading = reading + json.loads((DEST / 'cet6-2026-06-reading.json').read_text(encoding='utf-8'))['items']
    known = {a['id'] for a in all_reading}
    assert all(id_ in known for doc in documents for id_ in doc['readingIds']), 'unresolved shared exercise'
    fingerprints = [hashlib.sha256(re.sub(r'\s+', ' ', a['passage']).strip().encode()).hexdigest() for a in all_reading]
    assert len(set(fingerprints)) == len(fingerprints), 'duplicate reading passage; must reconcile identity before import'
    total_questions = sum(len(a['questions']) for a in all_reading)
    manifest = {'schemaVersion': 1, 'importedAt': STAMP, 'years': [2022, 2023, 2024, 2025, 2026],
                'documents': documents, 'readingArticles': len(all_reading), 'readingQuestions': total_questions,
                'writingTasks': len(writing)+3, 'translationTasks': len(translation)+3,
                'listeningEnabled': False, 'pendingListeningQuestions': sum(p['answerCount'] for p in pending),
                'added': {'readingArticles': len(reading), 'readingQuestions': sum(len(a['questions']) for a in reading),
                          'writingTasks': len(writing), 'translationTasks': len(translation)}}
    # No partial pack writes until all documents, references and audits succeed.
    for type_, items in [('reading', reading), ('writing', writing), ('translation', translation)]:
        (DEST / f'cet6-2022-2025-{type_}.json').write_text(json.dumps(make_pack(type_, items), ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (DEST / 'cet6-history-manifest.json').write_text(json.dumps(manifest, ensure_ascii=False, indent=2)+'\n', encoding='utf-8')
    (OUT / 'original-question-audit.json').write_text(json.dumps({'result': 'PASS', 'count': len(audit), 'checks': audit}, ensure_ascii=False, indent=2), encoding='utf-8')
    (OUT / 'listening-pending.json').write_text(json.dumps(pending, ensure_ascii=False, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in manifest.items() if k != 'documents'}, ensure_ascii=False))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('folder', type=Path)
    main(parser.parse_args().folder)
