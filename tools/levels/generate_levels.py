#!/usr/bin/env python3
"""Export the sole click-fill bank from exact, accepted target-field source data."""
from __future__ import annotations
import copy
import csv
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from nature_palette import (bilinear, colour_metrics, distance, diversity_report,
                            field_diagnostics, fit_palette, hex_to_lab, lab_to_linear)
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data/levels'
DOC=ROOT/'docs/levels'
SOURCE_PATH=OUT/'source/target-fields.v1.json'
DATA_PATH=OUT/'levels.v0.4.json'
VERSION='0.4.0-candidate'
SCHEMA_VERSION='3.0.0'
ALLOWANCE_RATIOS=[.70,.50,.35,.25,.18]
CHAPTER_INTENTS=[
    '先点选颜色，再点空槽；练习取回和重新落位，前四关不限步。',
    '观察横纵两个方向，把候选色放入交织轨道；放置宽容逐步收紧。',
    '20–25格，借助共享点同时判断一行和一列，减少试放。',
    '25–30格，利用色相和明度共同定位，先观察再点击落位。',
    '30–36格，稀疏轨网与完整色盘交替，以6×6终章完成色场。',
]
def canonical_digest(value):
    return hashlib.sha256(json.dumps(value,ensure_ascii=False,sort_keys=True,separators=(',',':')).encode()).hexdigest()
def load_source():
    source=json.loads(SOURCE_PATH.read_text(encoding='utf-8'))
    if canonical_digest(source['levels'])!=source['targetFieldsSha256']:
        raise ValueError('Accepted target-field source digest does not match')
    return source
class FixedRNG:
    def __init__(self,seed):self.state=seed&0xffffffff
    def next(self):
        x=self.state;x^=(x<<13)&0xffffffff;x^=x>>17;x^=(x<<5)&0xffffffff
        self.state=x&0xffffffff
        return self.state
    def shuffle(self,values):
        values=list(values)
        for i in range(len(values)-1,0,-1):
            j=self.next()%(i+1);values[i],values[j]=values[j],values[i]
        return values
def initial_state(cells,anchors,seed):
    target={c['id']:c['targetTileId'] for c in cells}
    board={cell:tile if cell in anchors else None for cell,tile in target.items()}
    pool=FixedRNG(seed).shuffle([target[c] for c in target if c not in anchors])
    homes={tile:i for i,tile in enumerate(pool)}
    witness=[{'fromPoolIndex':homes[tile],'toCellId':cell} for cell,tile in target.items() if cell not in anchors]
    return board,pool,homes,witness
def palette_from_parameters(paths,params):
    points=set(p for path in paths for p in path)
    if params['method']=='oklab-path-linear':
        a,b=params['endpointsLab']
        labs={p:tuple(x+(y-x)*i/(len(paths[0])-1) for x,y in zip(a,b)) for i,p in enumerate(paths[0])}
    else:
        w=max(p[0] for p in points)+1;h=max(p[1] for p in points)+1
        labs={p:bilinear(params['cornersLab'],p[0]/(w-1),p[1]/(h-1)) for p in points}
    return fit_palette(labs)
def make_level(target):
    l=copy.deepcopy(target);topology=l.pop('topology')
    n=topology['movableCount'];number=l['number'];chapter=l['chapter']
    board,pool,homes,witness=initial_state(l['cells'],l['anchors'],l['seed'])
    ratio=ALLOWANCE_RATIOS[chapter-1];extra=2 if l['rhythm']=='buffer' else 0
    allowance=max(2,math.ceil(n*ratio))+extra;bounded=number>=5
    lesson=('select-place' if number==1 else 'colour-order' if number==2 else 'return-adjust' if number==3 else 'follow-bend' if number==4 else 'move-budget' if number==5 else 'two-axis' if chapter==1 else 'coupled-junctions' if chapter<=3 else 'chromatic-field')
    tutorials={
        'select-place':'先点下方的颜色，再点上方的空位。',
        'colour-order':'看看两端的颜色，依次补全中间的渐变。',
        'return-adjust':'点选已放色块，再点空槽可调整；点下方它的空位可免费取回。',
        'follow-bend':'沿连接线观察，转弯的色带也要连续。',
        'move-budget':'每次放入或移到空槽用1步；取回候选区不扣步。',
        'two-axis':'先看横向，再看纵向；圆钉色块是固定线索。',
        'coupled-junctions':'一个交点同时属于两条色带，两个方向都要顺。',
        'chromatic-field':'深浅接近时，继续观察颜色向哪种色相变化。',
    }
    l.update({'contentVersion':VERSION,'gameplayMode':'click-fill','inputMode':'tap',
        'shuffle':{'algorithm':'xorshift32-fisher-yates-v1','scope':'non-anchor-tray-only','stableHomeSlots':True},
        'lesson':lesson,'tutorialText':tutorials[lesson] if l['rhythm']=='teach' or number<=5 else '',
        'initialBoard':board,'initialPool':pool,'trayHomeByTile':homes,
        'challenge':{'mode':'moves' if bounded else 'none','minimumMoves':n,
            'minimumMovesMetric':'tray-to-empty-board-placements','moveBudget':n+allowance if bounded else None,
            'moveAllowance':allowance if bounded else None,'allowanceRatio':ratio if bounded else None,
            'rhythmExtra':extra if bounded else 0,
            'revive':{'maxPerAttempt':2 if bounded else 0,'addMoves':max(5,math.ceil(n*.2)) if bounded else 0},
            'witnessSolution':witness,
            'notes':'N为初始空槽数。证解每块直接落入目标，N次成功放置即可完成；不证明人类失败率。'},
        'difficulty':{'band':chapter,**topology,'estimateSeconds':[15,45] if number<=4 else [60,180] if chapter<=2 else [120,360],
            'notes':'候选数、轨道耦合和放置宽容组成难度阶梯；实际时长、失败率和感知替代解待试玩。'},
        'layoutBudget':{'referenceViewport':[390,844],'minimumViewport':[375,667],
            'cellHitSize':44,'cellPitch':48,'poolColumns':6,'poolRows':math.ceil(n/6),
            'trayPageRows':3,'trayPageCapacity':18,'allowedPageCapacities':[18,12,6],
            'trayViewportHeight':144,'trayNavigation':'tap-pagination','stableHomeSlots':True,
            'estimatedBoardAndTrayHeight':l['grid']['rows']*48+24+144,
            'boardAndTrayNeverOverlap':True,'trueDeviceValidation':'pending'},
        'qa':{'status':'pending','humanPlaytest':'pending','phoneDisplay':'pending',
            'perceptualAlternativeSolutions':'pending','economyAndFailureRate':'pending',
            'noAdHumanSolvability':'pending','colourArtReview':'pending','releaseApproved':False}})
    return l
def build_bank():
    source=load_source();levels=[make_level(v) for v in source['levels']]
    return {'schemaVersion':SCHEMA_VERSION,'contentVersion':VERSION,'gameplayMode':'click-fill','inputMode':'tap',
        'status':'candidate-human-qa-pending','generatedBy':'tools/levels/generate_levels.py',
        'acceptedTargetFieldsSha256':source['targetFieldsSha256'],
        'runtimePolicy':'load this fixed export only; reject any different schema or gameplay mode',
        'colourPolicy':{'recipeSource':'data/palettes/nature-palettes.v1.json','acceptedTargetSource':'data/levels/source/target-fields.v1.json',
            'strategy':'exact accepted target HEXs and rail geometry; no colour regeneration','localGamutMapping':False,'humanArtReview':'pending'},
        'topologyMetricDefinitions':{'sharedCellCount':'cell referenced by a horizontal and a vertical path, including shared endpoints',
            'branchNodeCount':'node degree >= 3 in explicit rail-edge graph','fourWayNodeCount':'node degree = 4 in explicit rail-edge graph'},
        'lightnessShortcutPolicy':{'requiredFromChapter':3,'spatialOrderCount':8,'modes':['all-colours','movable-colours-with-fixed-anchors'],
            'condition':'no exact ascending-L target fill in any row/column-major flip','scope':'narrow heuristic exclusion only; not perceived uniqueness'},
        'challengePolicy':{'firstBoundedMoveLevel':5,'solvedBeforeFailure':True,
            'chargedActions':['tray-to-empty-board','board-to-empty-board'],
            'freeActions':['board-to-own-home-tray','select','cancel','same-source','invalid-tap'],
            'occupiedBoardTarget':'reject; never overwrite or implicitly exchange','undoReturnsMoves':False,'fixedTrayHomeSlots':True,
            'budgetFormula':'B = N + max(2, ceil(N * chapterRatio)) + rhythmExtra','allowanceRatiosByChapter':ALLOWANCE_RATIOS,
            'bufferLevels':'orders 8,12,16 keep their geometry and add rhythmExtra=2',
            'reviveReward':'max(5,ceil(N*0.20)) moves after completed optional rewarded video, max 2 per attempt',
            'proofScope':'N initial empty cells require at least N charged placements; supplied N-action witness reaches exact target without props or ads'},
        'chapters':[{'id':i+1,'name':levels[i*20]['chapterName'],'intent':CHAPTER_INTENTS[i],'levelCount':20} for i in range(5)],
        'templateUsage':dict(sorted(Counter(l['templateId'] for l in levels).items())),'levels':levels}
def write_catalogue(bank):
    fields=['id','chapter','chapterName','order','title','templateId','rhythm','cellCount','candidateCount',
        'sharedCellCount','branchNodeCount','fourWayNodeCount','minimumPlacements','moveBudget','moveAllowance','reviveAddMoves','orderedPaths','targetHexByPath']
    rows=[]
    for l in bank['levels']:
        d=l['difficulty'];c=l['challenge'];colors={v['id']:v['targetHex'] for v in l['cells']}
        rows.append({**{k:l[k] for k in fields if k in l},**{k:d[k] for k in ['cellCount','sharedCellCount','branchNodeCount','fourWayNodeCount']},
            'candidateCount':len(l['initialPool']),'minimumPlacements':c['minimumMoves'],'moveBudget':c['moveBudget'],'moveAllowance':c['moveAllowance'],
            'reviveAddMoves':c['revive']['addMoves'],'orderedPaths':' | '.join(' > '.join(p['cellIds']) for p in l['paths']),
            'targetHexByPath':' | '.join(' '.join(colors[v] for v in p['cellIds']) for p in l['paths'])})
    with (DOC/'catalogue.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
    text=['# 点击补色百关目录 v0.4','','唯一运行题库：`data/levels/levels.v0.4.json`。上方只预填固定锚点，下方为固定归位槽的候选色。',
        'N为初始空槽/候选色数量，也是无道具精确目标的最低有效放置数。前四关不限步，第五关起B=N+max(2,ceil(N×章节比例))+舒缓加成。',
        '允许免费取回；落位与移到另一空槽各扣1步。占用格不可覆盖。人工试玩、真机显示和商业效果待验收。','']
    for chapter in bank['chapters']:
        text += [f'## 第{chapter["id"]}章 · {chapter["name"]}','',chapter['intent'],'',
            '| 关卡 | 自然主题 | 模板 | 总格/候选 | N / B | 可试放宽容 |','| --- | --- | --- | --- | --- | --- |']
        for l in bank['levels']:
            if l['chapter']!=chapter['id']:continue
            c=l['challenge'];budget=c['moveBudget'] if c['moveBudget'] is not None else '不限';allowance=c['moveAllowance'] if c['moveAllowance'] is not None else '不限'
            text.append(f'| {l["id"]} | {l["title"]} | {l["templateId"]} | {len(l["cells"])}/{len(l["initialPool"])} | {c["minimumMoves"]} / {budget} | {allowance} |')
        text.append('')
    (DOC/'catalogue.md').write_text('\n'.join(text)+'\n',encoding='utf-8')
def write_palette_overview(bank,report):
    from html import escape
    parts=['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>百关自然色彩 · 作者答案总览 v0.4</title><style>body{margin:24px;background:#f8f6ef;color:#38454a;font:14px/1.6 system-ui,sans-serif}.grid{display:grid;grid-template-columns:repeat(10,minmax(90px,1fr));gap:12px}.item{padding:10px;background:white;border-radius:12px}.item h3{font-size:12px;margin:0}.item p{font-size:11px}.item svg{width:100%;height:auto}a{color:#287c78}@media(max-width:900px){.grid{grid-template-columns:repeat(5,1fr)}}@media(max-width:500px){.grid{grid-template-columns:repeat(3,1fr)}} </style><h1>100个自然色场</h1><p>作者答案总览，非游戏开局。颜色、轨道与原有锚点保持已认可版本。真实玩法见<a href="atlas.html">点击补色图鉴</a>，默认上方空槽、下方候选。</p>']
    for ch in bank['chapters']:
        parts.append(f'<section class="chapter"><h2>{ch["id"]:02} · {ch["name"]}</h2><div class="grid">')
        for l in bank['levels']:
            if l['chapter']!=ch['id']:continue
            parts.append(f'<article class="item" id="{l["id"]}"><h3><a href="atlas.html#{l["id"]}">{l["id"]}</a> {escape(l["title"])}</h3><p>{l["palette"]["family"]}</p><svg viewBox="0 0 {l["grid"]["columns"]*20} {l["grid"]["rows"]*20}" role="img" aria-label="{l["id"]}作者目标颜色">')
            for c in l['cells']:
                parts.append(f'<rect x="{c["x"]*20}" y="{c["y"]*20}" width="18" height="18" rx="2" fill="{c["targetHex"]}"/>')
            parts.append('</svg></article>')
        parts.append('</div></section>')
    parts.append('</html>');(DOC/'palette-overview.html').write_text(''.join(parts),encoding='utf-8')
def main():
    OUT.mkdir(parents=True,exist_ok=True);DOC.mkdir(parents=True,exist_ok=True)
    bank=build_bank();payload=json.dumps(bank,ensure_ascii=False,indent=2)+'\n'
    DATA_PATH.write_text(payload,encoding='utf-8');digest=hashlib.sha256(payload.encode()).hexdigest()
    DATA_PATH.with_suffix('.sha256').write_text(digest+'  '+DATA_PATH.name+'\n')
    report=diversity_report(bank)
    summary={'schemaVersion':SCHEMA_VERSION,'contentVersion':VERSION,'gameplayMode':'click-fill','levelCount':100,
        'dataSha256':digest,'acceptedTargetFieldsSha256':bank['acceptedTargetFieldsSha256'],'namedTemplateCount':len(bank['templateUsage']),
        'perChapter':[],'colourDiversity':{'globalMetrics':report['globalMetrics'],'familyCount':len(report['familyCounts'])}}
    for ch in range(1,6):
        group=[l for l in bank['levels'] if l['chapter']==ch];bounded=[l for l in group if l['number']>=5]
        def r(fn,ls=group):return [min(fn(l) for l in ls),max(fn(l) for l in ls)]
        summary['perChapter'].append({'chapter':ch,'name':group[0]['chapterName'],'cellRange':r(lambda l:len(l['cells'])),
            'candidateRange':r(lambda l:len(l['initialPool'])),'moveBudgetRange':r(lambda l:l['challenge']['moveBudget'],bounded),
            'moveAllowanceRange':r(lambda l:l['challenge']['moveAllowance'],bounded)})
    (OUT/'levels.v0.4.summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (DOC/'palette-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (DOC/'palette-report.md').write_text('# 百关自然色彩诊断 v0.4\n\n已认可目标HEX保持不变。全库12类自然家族、12段色相覆盖；平均色度C='+str(report['globalMetrics']['meanChroma'])+'。\n\n逐关诊断见[JSON](palette-report.json)，作者答案总览见[色彩总览](palette-overview.html)。数值筛查不证明美术质量、感知唯一解或手机可辨性，人工与真机验收仍待进行。\n',encoding='utf-8')
    write_palette_overview(bank,report);write_catalogue(bank)
    template=Path(__file__).with_name('atlas.template.html').read_text(encoding='utf-8')
    (DOC/'atlas.html').write_text(template.replace('/*__BANK__*/',json.dumps(bank,ensure_ascii=False,separators=(',',':'))),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
if __name__=='__main__':main()
