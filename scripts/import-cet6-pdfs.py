"""Convert the three supplied text PDFs; fail on missing/ambiguous answers."""
import argparse
import hashlib
import json
import re
from pathlib import Path
from pypdf import PdfReader

BASE = Path(__file__).resolve().parents[1]
OUT = BASE / 'output/pdf/cet6-2026-06-import'
DEST = BASE / 'src/content/imported'
STAMP = '2026-10-05T00:00:00.000Z'
SOURCE = 'src-cet6-2026-06-user-provided'


def clean(page):
    lines = [re.sub(r'[ \t]+', ' ', line.strip()) for line in page.splitlines()
             if 'lazynote.cn' not in line and not line.strip().startswith('Questions ')]
    return re.sub(r'\n{3,}', '\n\n', '\n'.join(lines)).strip()


def join(lines):
    text = re.sub(r'\s+', ' ', ' '.join(lines)).strip()
    text = re.sub(r'(?<=[\u3400-\u9fff]) +(?=[\u3400-\u9fff])', '', text)
    return re.sub(r'(?<=[A-Za-z])- (?=[a-z])', '-', text)


def english_head(text):
    lines = []
    depth = 0
    for line in text.splitlines():
        line = line.strip()
        if not line:
            continue
        if line.startswith('【'):
            break
        translated = False
        for char in line:
            if char in '(（': depth += 1
            elif char in ')）': depth = max(0,depth-1)
            elif '\u3400' <= char <= '\u9fff' and depth == 0: translated = True; break
        if translated: break
        lines.append(line)
    return join(lines)


def detail(text, teaching=False):
    # Stop before the document's extra grammar/vocabulary teaching chapters.
    if not teaching: text = re.split(r'(?m)^(?:[A-Z] ){2,}[A-Z].*', text)[0]
    text = re.split(r'(?m)^英 语 六 级.*全卷构成',text)[0]
    lines = text.strip().splitlines()
    groups, current = [], []
    for line in lines:
        if not line.strip() or line.startswith('【'):
            if current:
                groups.append(join(current)); current = []
        if line.strip():
            current.append(line)
    if current:
        groups.append(join(current))
    return '\n\n'.join(groups)


def questions(chapter, first, last, kind, options=None):
    matches = list(re.finditer(r'(?m)^(\d+)\.\s*', chapter))
    matches = [m for m in matches if first <= int(m.group(1)) <= last]
    assert [int(m.group(1)) for m in matches] == list(range(first, last + 1)), ('question sequence',first,last)
    result = []
    for i,m in enumerate(matches):
        n = int(m.group(1))
        block = chapter[m.end():matches[i+1].start() if i+1 < len(matches) else len(chapter)]
        answer = re.search(r'【答案】\s*([A-Z])', block)
        assert answer, ('missing answer',n)
        explanation = detail(block[answer.start():])
        if kind == 'careful':
            starts = list(re.finditer(r'(?m)^([A-D])\)\s*',block))[:4]
            assert [s.group(1) for s in starts] == list('ABCD'), ('options',n)
            prompt = english_head(block[:starts[0].start()])
            choices = [{'id':s.group(1),'text':english_head(block[s.end():starts[j+1].start() if j<3 else answer.start()])} for j,s in enumerate(starts)]
        else:
            prompt = english_head(block[:answer.start()])
            choices = options
        assert prompt and all(o['text'] for o in choices) and answer.group(1) in [o['id'] for o in choices], ('invalid question',n)
        short = re.search(r'【(?:依据|定位|锚点)】\s*(.*?)(?=\n\n|【|$)', explanation,re.S)
        hint = '根据空格前后的词性、搭配与上下文选择词语；每个词最多使用一次。' if kind=='cloze' else '先定位陈述句中的人物、数字或关键词，再比较原文同义表达。' if kind=='matching' else '回到原文定位题干关键词，比较选项与原文的含义。'
        result.append({'id':f'q{n}','prompt':prompt,'options':choices,'answerId':answer.group(1),'shortExplanation':short.group(1).strip() if short else explanation[:250],'detailedExplanation':explanation,'hint':hint,'examNumber':n})
    return result, chapter[:matches[0].start()]


def marked_paragraphs(text, marker):
    matches = list(re.finditer(marker,text,re.M))
    result=[]
    for i,m in enumerate(matches):
        content = english_head(text[m.end():matches[i+1].start() if i+1<len(matches) else len(text)])
        assert content, ('paragraph',m.group(1))
        result.append((m.group(1),content))
    return result


def metadata(set_no, type_, suffix):
    return {'id':f'cet6:2026-06:set{set_no}:{suffix}','type':type_,'title':f'2026年6月六级第{set_no}套 · {suffix}', 'sourceId':SOURCE,'sourceType':'past_exam','authenticity':'past_exam','status':'active','version':'1.0.0','difficulty':'normal','tags':['CET-6','2026-06',f'set{set_no}'],'createdAt':STAMP,'updatedAt':STAMP,
            'rights':{'licenseStatus':'unknown','rightsStatus':'unverified'}}


def pack(type_,items):
    return {'id':f'pack-cet6-2026-06-{type_}','name':f'2026年6月六级 · {type_}','version':'1.0.0','contentType':type_,'sourceId':SOURCE,'createdAt':STAMP,'updatedAt':STAMP,'rights':{'licenseStatus':'unknown','rightsStatus':'unverified'},'items':items}


def audit_original_exam(exam, articles, set_no):
    """Compare analysis-derived prompts/options against the separate exam pages."""
    checks=[]
    for article in articles:
        if article['exerciseType']=='cloze': continue
        for q in article['questions']:
            n=q['examNumber'];match=re.search(rf'(?m)^{n}\.\s*',exam)
            assert match, ('original question missing',set_no,n)
            rest=re.split(rf'(?m)^{n+1}\.\s*|^Part IV|^Section C|^Directions:|^Passage Two',exam[match.end():])[0]
            if article['exerciseType']=='matching':
                assert english_head(rest)==q['prompt'], ('original statement mismatch',set_no,n)
            else:
                starts=list(re.finditer(r'(?m)^([A-D])\)\s*',rest));assert len(starts)==4
                assert english_head(rest[:starts[0].start()])==q['prompt'], ('original prompt mismatch',set_no,n)
                for j,m in enumerate(starts):
                    original=english_head(rest[m.end():starts[j+1].start() if j<3 else len(rest)])
                    assert original==q['options'][j]['text'], ('original option mismatch',set_no,n,m.group(1))
            checks.append({'set':set_no,'question':n,'originalExamText':'PASS'})
    return checks


def main(folder):
    OUT.mkdir(parents=True,exist_ok=True); DEST.mkdir(parents=True,exist_ok=True)
    reading=[];writing=[];translation=[];manifest=[];pending=[];audit=[]
    supplied = {}
    for path in folder.glob('*.pdf'):
        match = re.search(r'2026年6月第([123])套', path.name)
        if not match: continue
        set_no = int(match[1])
        assert set_no not in supplied, ('duplicate June 2026 PDF', set_no)
        supplied[set_no] = path
    assert set(supplied) == {1,2,3}, 'June 2026 sets 1-3 are required'
    for set_no,path in sorted(supplied.items()):
        reader=PdfReader(path)
        pages=[clean(p.extract_text(extraction_mode='layout')) for p in reader.pages]
        (OUT/f'set-{set_no}-layout.txt').write_text('\n\f\n'.join(pages),encoding='utf-8')
        starts={}
        for n,p in enumerate(pages):
            head=p.splitlines()[0] if p else ''
            if not head.startswith('2026'):continue
            for key,phrase in [('writing','英语六级写作'),('cloze','英语六级完形填空'),('matching','英语六级长篇阅读'),('translation','英语六级汉译英'),('listening','英语六级听力')]:
                if phrase in head: starts[key]=n
            if '英语六级阅读理解' in head:
                starts['careful1' if re.search(r'第\s*1\s*篇',head) else 'careful2']=n
        def chapter(key):
            n=starts[key];end=min([v for v in starts.values() if v>n]+[len(pages)])
            return '\n\n'.join(pages[n:end])
        for part,first,last in [('cloze',26,35),('matching',36,45),('careful1',46,50),('careful2',51,55)]:
            text=chapter(part)
            if part=='cloze':
                intro=text[:re.search(r'(?m)^26\.',text).start()]
                opts={m.group(1):m.group(2) for m in re.finditer(r'([A-O])\)\s*([A-Za-z-]+)',intro)}
                assert len(opts)==15, ('word bank',set_no,len(opts))
                choices=[{'id':key,'text':opts[key]} for key in sorted(opts)]
                qs,_=questions(text,first,last,'cloze',choices)
                body=intro.split('once.',1)[1]
                body=body[:re.search(r'(?m)^A\)',body).start()]
                groups=[]; lines=[]
                for line in body.splitlines():
                    if re.search(r'[\u3400-\u9fff]',line):
                        if lines: groups.append(join(lines));lines=[]
                    elif line.strip(): lines.append(line)
                if lines:groups.append(join(lines))
                passage='\n\n'.join(groups)
                for number in range(26,36):
                    assert re.search(rf'\b{number}\b',passage), ('blank missing',set_no,number)
                    passage=re.sub(rf'\b{number}\b',f'[{number}] _____',passage)
                title='选词填空'; minutes=8; exercise='cloze'
            elif part=='matching':
                intro=text[:re.search(r'(?m)^36\.',text).start()]
                paras=marked_paragraphs(intro,r'^([A-Z])\)\s*')
                assert len(paras)>=10 and [p[0] for p in paras]==[chr(65+i) for i in range(len(paras))],('matching paragraphs',set_no)
                choices=[{'id':key,'text':'段落 '+key} for key,_ in paras]
                qs,_=questions(text,first,last,'matching',choices)
                passage='\n\n'.join(key+') '+body for key,body in paras)
                title='信息匹配';minutes=12;exercise='matching'
            else:
                qs,intro=questions(text,first,last,'careful')
                paras=marked_paragraphs(intro,r'^P(\d+)\s+(?=[A-Za-z"\'“])')
                assert len(paras)>=3 and [p[0] for p in paras]==[str(i+1) for i in range(len(paras))],('careful paragraphs',set_no,part)
                passage='\n\n'.join(body for _,body in paras)
                title='仔细阅读 · '+('第一篇' if part=='careful1' else '第二篇');minutes=6;exercise='careful'
            for q in qs: q['id']=f'cet6:2026-06:set{set_no}:{part}:q{q["examNumber"]}'
            item={**metadata(set_no,'reading',part),'title':f'2026年6月六级第{set_no}套 · {title}','passage':passage,'questions':qs,'estimatedMinutes':minutes,'vocabulary':{},'exerciseType':exercise}
            reading.append(item)
        w=chapter('writing')
        model=re.search(r'【参考范文[^】]*】[^\n]*\n',w);assert model
        prompt=join(w[w.index('Directions:'):model.start()].splitlines())
        essay_raw=w[model.end():w.index('【参考译文】',model.end())]
        essay='\n\n'.join(join(p.splitlines()) for p in re.split(r'\n\n+',essay_raw.strip()) if p.strip())
        assert 140<=len(essay.split())<=210,('essay length',set_no,len(essay.split()))
        opening=re.search(r'"([^"]+)"',prompt);assert opening
        words={1:['urbanization','nature','city','residents','green','environment'],2:['social','responsibility','young','people','society','development'],3:['globalization','traditional','Chinese','culture','cultural','confidence']}[set_no]
        assert all(word.lower() in essay.lower() for word in words), ('writing keywords',set_no)
        paragraphs=essay.split('\n\n')
        writing.append({**metadata(set_no,'writing','writing'),'title':f'2026年6月六级第{set_no}套 · 写作','level':'essay','prompt':prompt,'requirements':['150–200 词','将题目给定句子原样放在文章开头','围绕主题评论、举例或结合个人经历展开'],'suggestedWords':words, 'referenceEssay':essay,'outline':[{'type':kind,'content':p} for kind,p in zip(['introduction','body','conclusion'],paragraphs)],'scoringPoints':['紧扣题目给定主题','论点清晰，举例具体','段落连贯，语言准确','满足首句和字数要求'],'mockFeedback':{'summary':'请对照参考范文检查主题、首句要求、段落衔接与表达；当前为规则估分。','issues':[],'details':[]},'suggestedWordsRange':[150,200]})
        t=chapter('translation')
        begin=t.index('You should write your answer on Answer Sheet 2.')+len('You should write your answer on Answer Sheet 2.')
        finish=t.index('参考译文',begin)
        chinese=join(t[begin:finish].splitlines())
        after=t[finish:].split('正确」四档评分。',1)[1]
        reference=english_head(after)
        assert len(chinese)>100 and len(reference)>200,('translation',set_no)
        keywords={1:['science and technology','telemedicine','medical resources','remote areas','diagnosis','health records'],2:['e-commerce','rural','logistics','agricultural products','live-streaming','revitalization'],3:['drone','export','high-definition','rural','pesticides','deliver']}[set_no]
        assert all(word.lower() in reference.lower() for word in keywords), ('translation keywords',set_no)
        translation.append({**metadata(set_no,'translation','translation'),'title':f'2026年6月六级第{set_no}套 · 段落翻译','level':'paragraph','promptChinese':chinese,'keywords':keywords,'referenceTranslation':reference,'scoringPoints':['完整传达原文信息','时态和主谓一致准确','术语和固定搭配恰当','句间衔接自然'],'mockFeedback':{'summary':'对照参考译文检查信息是否完整、术语是否准确；当前为规则估分。','issues':[],'details':[]},'estimatedMinutes':15})
        writing[-1]['referenceExplanation']=detail(w[w.index('【参考译文】')+len('【参考译文】'):],teaching=True)
        translation[-1]['referenceExplanation']=detail(t[t.index('【衔接】'):],teaching=True)
        if 'listening' in starts:
            text=chapter('listening')
            # Retain full checked transcript/keys as a text archive; no fabricated audio.
            pending.append({'set':set_no,'status':'missing_audio','text':text,'answerCount':len(re.findall(r'【答案】\s*[A-D]',text))})
            assert pending[-1]['answerCount']==25
        manifest.append({'set':set_no,'documentSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'pages':len(pages),'chapters':{key:value+1 for key,value in starts.items()},'readingQuestions':30,'writingTasks':1,'translationTasks':1,'listeningStatus':'missing_audio' if 'listening' in starts else 'shared_with_set1'})
        audit.extend(audit_original_exam('\n\n'.join(pages[:starts['writing']]),[a for a in reading if f':set{set_no}:' in a['id']],set_no))
    assert len(manifest)==3
    for type_,items in [('reading',reading),('writing',writing),('translation',translation)]:
        (DEST/f'cet6-2026-06-{type_}.json').write_text(json.dumps(pack(type_,items),ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (OUT/'listening-pending.json').write_text(json.dumps(pending,ensure_ascii=False,indent=2),encoding='utf-8')
    (OUT/'original-question-audit.json').write_text(json.dumps({'result':'PASS','count':len(audit),'checks':audit},ensure_ascii=False,indent=2),encoding='utf-8')
    (DEST/'cet6-2026-06-manifest.json').write_text(json.dumps({'schemaVersion':1,'importedAt':STAMP,'documents':manifest,'readingArticles':len(reading),'readingQuestions':sum(len(a['questions']) for a in reading),'writingTasks':3,'translationTasks':3,'listeningEnabled':False},ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps({'readingArticles':len(reading),'readingQuestions':90,'writingTasks':3,'translationTasks':3,'audio':'not supplied'},ensure_ascii=False))


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('folder',type=Path)
    main(parser.parse_args().folder)
