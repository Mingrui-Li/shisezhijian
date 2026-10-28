"""Verify rendered filing drafts, exact source transcription and source snapshots."""
from pathlib import Path
import hashlib
import json
import re
from docx import Document
from pypdf import PdfReader
import pdfplumber
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'output/copyright'
ANNEX = OUT / '核验附件'
QA = ROOT / 'tmp/copyright/qa-final'
QA.mkdir(parents=True, exist_ok=True)
MANIFEST = json.loads((ANNEX / '源程序清单与校验.json').read_text())
normalize = lambda s: re.sub(r'\s+', '', s)
rows = [s.expandtabs(4) for f in MANIFEST['files']
        for s in (ROOT / f['file']).read_text().splitlines() if s.strip()]
word = Document(OUT / '拾色之间游戏软件_V1.1.0_源程序鉴别材料.docx')
assert [p.text for p in word.paragraphs if p.text.strip()] == rows
for item in MANIFEST['files']:
    data = (ROOT / item['file']).read_bytes()
    assert hashlib.sha256(data).hexdigest() == item['sha256']
    snap = ANNEX / '客户端源文件快照' / Path(item['file']).relative_to('game/assets/scripts')
    assert snap.read_bytes() == data

results = {'sourceFiles': len(MANIFEST['files']), 'sourceNonblankLines': len(rows),
    'sourceWordExact': True, 'sourceSnapshotsExact': True, 'documents': {}}
for folder, expected_pages in [('manual-final', 14), ('application-final', 4), ('source-final', 56)]:
    render = ROOT / 'tmp/copyright' / folder
    pdf = next(render.glob('*.pdf'))
    assert len(PdfReader(pdf).pages) == expected_pages
    stats = []
    with pdfplumber.open(pdf) as doc:
        for idx, page in enumerate(doc.pages):
            body = page.crop((35, 44, page.width - 35, page.height - 39))
            text = page.extract_text()
            assert '济南青骓互动信息科技有限公司' in text
            assert '拾色之间游戏软件' in text
            assert '\ufffd' not in text
            assert all(c['x0'] >= 0 and c['x1'] <= page.width + 1 for c in page.chars)
            lines = body.extract_text_lines()
            if folder == 'source-final':
                assert normalize(body.extract_text()) == normalize(''.join(rows[idx*50:(idx+1)*50])), f'Source PDF mismatch page {idx+1}'
                assert len(lines) >= (50 if idx < 55 else 37)
            if folder == 'manual-final':
                if idx in [2, 3, 4, 5]:
                    assert len(page.images) == 1 and page.images[0]['height'] > 430
                else:
                    assert len(lines) >= 30
            header = page.crop((0, 0, page.width, 42)).extract_words()
            assert any(w['x1'] > 520 for w in header), 'Page number must be at the right'
            stats.append({'page': idx+1, 'bodyLines': len(lines), 'images': len(page.images)})
    results['documents'][pdf.name] = {'pages': expected_pages, 'pageStats': stats}
    images = sorted(render.glob('page-*.png'), key=lambda p: int(p.stem.split('-')[1]))
    assert len(images) == expected_pages
    for start in range(0, len(images), 8):
        sheet = Image.new('RGB', (1500, 1110), '#dddddd')
        draw = ImageDraw.Draw(sheet)
        for i, path in enumerate(images[start:start+8]):
            im = Image.open(path).convert('RGB'); im.thumbnail((365, 520))
            x, y = (i % 4) * 375 + 5, (i // 4) * 555 + 25
            sheet.paste(im, (x, y)); draw.text((x, y-19), f'{folder} / {start+i+1}', fill='black')
        sheet.save(QA / f'{folder}-{start//8+1}.jpg', quality=90)
(ANNEX / '材料核验记录.json').write_text(json.dumps(results, ensure_ascii=False, indent=2))
print(json.dumps({'passed': True, 'documents': {k: v['pages'] for k,v in results['documents'].items()},
    'sourceWordAndPdfExact': True, 'snapshotsExact': True, 'manualTextLinesAndImageDimensions': True}, ensure_ascii=False))
