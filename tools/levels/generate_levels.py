#!/usr/bin/env python3
"""Export the sole click-fill bank: accepted baseline + explicit intro overrides."""
from __future__ import annotations
import copy
import csv
import hashlib
import json
import math
from collections import Counter
from pathlib import Path
from nature_palette import (bilinear, colour_metrics, distance, diversity_report,
                            field_diagnostics, fit_palette, hex_to_lab, lab_to_linear, palette_distance)
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'data/levels'
DOC=ROOT/'docs/levels'
SOURCE_PATH=OUT/'source/target-fields.v1.json'
OVERRIDES_PATH=OUT/'source/overrides.v1.json'
DATA_PATH=OUT/'levels.v0.6.json'
VERSION='0.6.0'
SCHEMA_VERSION='4.1.0'
GENERATOR_REVISION='intro-structure-v1+constrained-shuffle-v2'
MAX_SHUFFLE_ATTEMPTS=4096
CHAPTER_INTENTS=[
    '先点选颜色，再点空槽；练习取回和重新落位，在倒计时内补全渐变。',
    '观察横纵两个方向，把候选色放入交织轨道；先观察再落位。',
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
def load_overrides():
    overrides=json.loads(OVERRIDES_PATH.read_text(encoding='utf-8'))
    if canonical_digest(overrides['overrides'])!=overrides['overridesSha256']:
        raise ValueError('Intro override digest does not match')
    if overrides['baselineTargetFieldsSha256']!=load_source()['targetFieldsSha256']:
        raise ValueError('Intro overrides target another baseline')
    if [v['levelId'] for v in overrides['overrides']]!=[f'L{i:03}' for i in range(1,13)]:
        raise ValueError('Intro override scope must be exactly L001-L012')
    return overrides
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
def shuffle_quality(pool,ordered):
    ranks={tile:i for i,tile in enumerate(ordered)}
    actual=[ranks[tile] for tile in pool]
    n=len(ordered)
    displaced=sum(i!=rank for i,rank in enumerate(actual))
    longest=1;run=1;last_direction=0;adjacent=0
    for a,b in zip(actual,actual[1:]):
        direction=b-a
        if abs(direction)==1:
            adjacent+=1
            run=run+1 if direction==last_direction else 2
            last_direction=direction
        else:
            run=1;last_direction=0
        longest=max(longest,run)
    return {'candidateCount':n,'displacedCount':displaced,'displacedRatio':round(displaced/n,6),
        'longestForwardOrReverseRun':longest,'adjacentTargetPairCount':adjacent,
        'adjacentTargetPairRatio':round(adjacent/max(1,n-1),6),
        'isForwardOrder':actual==list(range(n)),'isReverseOrder':actual==list(reversed(range(n)))}
def shuffle_passes(quality):
    n=quality['candidateCount']
    return (n>=4 and quality['displacedCount']>=math.ceil(n*.75)
        and quality['longestForwardOrReverseRun']<=2
        and quality['adjacentTargetPairCount']<=math.floor((n-1)*.35)
        and not quality['isForwardOrder'] and not quality['isReverseOrder'])
def constrained_shuffle(ordered,seed):
    if len(ordered)<4:
        raise ValueError('Formal levels require at least 4 candidates')
    rng=FixedRNG(seed)
    for attempt in range(1,MAX_SHUFFLE_ATTEMPTS+1):
        pool=rng.shuffle(ordered);quality=shuffle_quality(pool,ordered)
        if shuffle_passes(quality):
            return pool,{**quality,'acceptedAttempt':attempt,'maxAttempts':MAX_SHUFFLE_ATTEMPTS,
                'orderMetric':'non-anchor cells in exported canonical cell order; path traversal order for single rails'}
    raise ValueError('No valid constrained candidate shuffle within deterministic attempt cap')
def initial_state(cells,anchors,seed):
    target={c['id']:c['targetTileId'] for c in cells}
    board={cell:tile if cell in anchors else None for cell,tile in target.items()}
    pool,_=constrained_shuffle([target[c] for c in target if c not in anchors],seed)
    homes={tile:i for i,tile in enumerate(pool)}
    witness=[{'fromPoolIndex':homes[tile],'toCellId':cell} for cell,tile in target.items() if cell not in anchors]
    return board,pool,homes,witness
def time_limit_seconds(number,chapter,candidate_count):
    if number==1:
        return 45
    seconds_per_candidate=6 if chapter<=2 else 5 if chapter<=4 else 4
    return max(45,min(240,45+candidate_count*seconds_per_candidate))
def palette_from_parameters(paths,params):
    points=set(p for path in paths for p in path)
    if params['method']=='oklab-path-linear':
        a,b=params['endpointsLab']
        labs={p:tuple(x+(y-x)*i/(len(paths[0])-1) for x,y in zip(a,b)) for i,p in enumerate(paths[0])}
    else:
        w=max(p[0] for p in points)+1;h=max(p[1] for p in points)+1
        labs={p:bilinear(params['cornersLab'],p[0]/(w-1),p[1]/(h-1)) for p in points}
    return fit_palette(labs)
def lightness_fill_record(level):
    anchors=set(level['anchors']);result={'testedOrderCount':8,'fullColourHitOrders':[],'movableColourHitOrders':[]}
    for column_major in (False,True):
        primary,secondary=('x','y') if column_major else ('y','x')
        for p in (1,-1):
            for s in (1,-1):
                ordered=sorted(level['cells'],key=lambda c:(p*c[primary],s*c[secondary]))
                name=f"{'column' if column_major else 'row'}:{p:+d},{s:+d}"
                for key,candidates in [('fullColourHitOrders',ordered),('movableColourHitOrders',[c for c in ordered if c['id'] not in anchors])]:
                    lights=[hex_to_lab(c['targetHex'])[0] for c in candidates]
                    if all(abs(a-b)<=1e-12 for a,b in zip(lights,sorted(lights))):result[key].append(name)
    return {**result,'requiredNoHits':level['chapter']>=3,
        'scope':'8 flipped row/column-major ascending-L fills, for all colours and movable colours separately; excludes only these exact heuristics'}
def topology_record(level):
    cells=level['cells'];by={c['id']:c for c in cells};counts=Counter();neighbours={c:set() for c in by}
    for path in level['paths']:
        counts.update(path['cellIds'])
        for a,b in zip(path['cellIds'],path['cellIds'][1:]):neighbours[a].add(b);neighbours[b].add(a)
    shared=sorted(c for c,n in counts.items() if n>1)
    labs={c['id']:hex_to_lab(c['targetHex']) for c in cells}
    closest=min((distance(labs[a],labs[b]),a,b) for i,a in enumerate(labs) for b in list(labs)[i+1:])
    adjacent=min(distance(labs[a],labs[b]) for path in level['paths'] for a,b in zip(path['cellIds'],path['cellIds'][1:]))
    return {'cellCount':len(cells),'movableCount':len(cells)-len(level['anchors']),'pathCount':len(level['paths']),
        'sharedCellCount':len(shared),'branchNodeCount':sum(len(v)>=3 for v in neighbours.values()),
        'fourWayNodeCount':sum(len(v)==4 for v in neighbours.values()),'movableJunctionCount':len(set(shared)-set(level['anchors'])),
        'lightnessShortcutCheck':lightness_fill_record(level),'minPairDeltaEOK':round(closest[0],6),
        'closestPair':list(closest[1:]),'minAdjacentDeltaEOK':round(adjacent,6),'candidateMinPairThreshold':.02}
def resolved_targets():
    source=load_source();overrides=load_overrides();baseline={l['id']:l for l in source['levels']}
    specs={o['levelId']:o for o in overrides['overrides']};levels=[]
    for original in source['levels']:
        level=copy.deepcopy(original);spec=specs.get(level['id'])
        if spec:
            if spec['kind']=='path':
                coordinate_paths=[[tuple(p) for p in spec['points']]]
            elif spec['kind']=='grid':
                w,h=spec['columns'],spec['rows']
                coordinate_paths=[[(x,y) for x in range(w)] for y in range(h)]+[[(x,y) for y in range(h)] for x in range(w)]
            elif spec['kind']=='rails':
                coordinate_paths=[[tuple(p) for p in path] for path in spec['coordinatePaths']]
            else:
                donor=baseline[spec['geometryFromLevelId']];by={c['id']:(c['x'],c['y']) for c in donor['cells']}
                coordinate_paths=[[by[id] for id in p['cellIds']] for p in donor['paths']]
            points=(coordinate_paths[0] if spec['kind']=='path' else sorted(set(p for path in coordinate_paths for p in path),key=lambda p:(p[1],p[0])))
            w=max(x for x,y in points)+1;h=max(y for x,y in points)+1
            palette=copy.deepcopy(level['palette'])
            if spec['palette']=='natural-seed-corners':
                palette.pop('endpointsLab',None);palette['method']='oklab-bilinear-four-corners'
                palette['cornersLab']=[list(hex_to_lab(c)) for c in palette['seedCornersHex']]
                palette['cornersOrder']=['topLeft','topRight','bottomLeft','bottomRight']
                palette['fieldRule']='C(u,v)=(1-u)(1-v)TL+u(1-v)TR+(1-u)vBL+uvBR; u=x/(columns-1), v=y/(rows-1)'
                palette['twoAxisClues']='all rows and columns sample the same field; both axes must be continuous'
            colors,scale=palette_from_parameters(coordinate_paths,palette)
            level.update({'templateId':spec['templateId'],'geometryKind':'single' if spec['kind']=='path' else 'field-grid' if spec['kind']=='grid' else 'rail-network',
                'grid':{'columns':w,'rows':h},'paths':[{'id':f'p{i+1}','cellIds':[f'c{x}_{y}' for x,y in path]} for i,path in enumerate(coordinate_paths)],
                'cells':[{'id':f'c{x}_{y}','x':x,'y':y,'targetTileId':f't{level["number"]:03}_{i:02}','targetHex':colors[(x,y)]} for i,(x,y) in enumerate(points)]})
            level['anchors']=([level['cells'][0]['id'],level['cells'][-1]['id']] if spec['kind']=='path' else [f'c{x}_{y}' for x,y in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]])
            counts=Counter(c for p in level['paths'] for c in p['cellIds']);level['intersectionCellIds']=sorted(c for c,n in counts.items() if n>1)
            level['tiles']=[{'id':c['targetTileId'],'hex':c['targetHex'],'targetCellId':c['id'],'equivalenceGroup':c['targetHex']} for c in level['cells']]
            level['solution']['targetByCell']={c['id']:c['targetHex'] for c in level['cells']}
            level['solution']['equivalenceGroups']={c['targetHex']:[c['targetTileId']] for c in level['cells']}
            palette['commonChromaScale']=scale;palette['seedChromaRetention']=round(palette['adjustment']['seedChromaScale']*scale,6)
            palette['actualCornersHex']=([colors[coordinate_paths[0][0]],colors[coordinate_paths[0][-1]]] if spec['kind']=='path' else [colors[p] for p in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]])
            palette['metrics']=colour_metrics(list(colors.values()));palette['fieldChecks']=field_diagnostics(coordinate_paths,colors,palette)
            palette['samplingRevision']='intro-structure-v1; accepted theme and endpoint/corner directions preserved'
            level['palette']=palette;level['topology']=topology_record(level)
        # Neighbour diagnostics refer to the actually exported preceding level.
        level['palette']['distanceFromPrevious']=(round(palette_distance([c['targetHex'] for c in level['cells']],[c['targetHex'] for c in levels[-1]['cells']]),6) if levels else None)
        levels.append(level)
    return levels
def make_level(target):
    l=copy.deepcopy(target);topology=l.pop('topology')
    n=topology['movableCount'];number=l['number'];chapter=l['chapter']
    board,pool,homes,witness=initial_state(l['cells'],l['anchors'],l['seed'])
    ordered=[c['targetTileId'] for c in l['cells'] if c['id'] not in l['anchors']]
    _,quality=constrained_shuffle(ordered,l['seed'])
    lesson=('select-place' if number==1 else 'colour-order' if number==2 else 'return-adjust' if number==3 else 'follow-bend' if number==4 else 'time-budget' if number==5 else 'two-axis' if chapter==1 else 'coupled-junctions' if chapter<=3 else 'chromatic-field')
    tutorials={
        'select-place':'先点下方的颜色，再点上方的空位。',
        'colour-order':'看看两端的颜色，依次补全中间的渐变。',
        'return-adjust':'点选已放色块，再点空槽可调整；点下方任意空位可取回。',
        'follow-bend':'沿连接线观察，转弯的色带也要连续。',
        'time-budget':'在倒计时结束前补全色带；时间用完后可重开，或自愿看视频续时。',
        'two-axis':'先看横向，再看纵向；圆钉色块是固定线索。',
        'coupled-junctions':'一个交点同时属于两条色带，两个方向都要顺。',
        'chromatic-field':'深浅接近时，继续观察颜色向哪种色相变化。',
    }
    l.update({'contentVersion':VERSION,'gameplayMode':'click-fill','inputMode':'tap',
        'shuffle':{'algorithm':'xorshift32-fisher-yates-rejection-v2','scope':'non-anchor-tray-only',
            'stableHomeSlots':False,'candidateSlots':'any-empty','maxAttempts':MAX_SHUFFLE_ATTEMPTS},
        'shuffleQuality':quality,
        'lesson':lesson,'tutorialText':tutorials[lesson] if l['rhythm']=='teach' or number<=5 else '',
        'initialBoard':board,'initialPool':pool,'trayHomeByTile':homes,'trayHomeByTileRole':'initial-only; witness and seed reproduction, never a runtime return-slot binding',
        'challenge':{'mode':'time','timeLimitSeconds':time_limit_seconds(number,chapter,n),'minimumMoves':n,
            'minimumMovesMetric':'tray-to-empty-board-placements',
            'revive':{'maxPerAttempt':2,'addSeconds':30},
            'witnessSolution':witness,
            'notes':'N为初始空槽数。证解每块直接落入目标，N次成功放置即可完成；不证明人类失败率。'},
        'difficulty':{'band':chapter,**topology,'estimateSeconds':[15,45] if number<=4 else [60,180] if chapter<=2 else [120,360],
            'notes':'候选数、轨道耦合与每块可用时间组成难度阶梯；实际时长、失败率和感知替代解待试玩。'},
        'layoutBudget':{'referenceViewport':[390,844],'minimumViewport':[375,667],
            'cellHitSize':44,'cellPitch':48,'poolColumns':6,'poolRows':math.ceil(n/6),
            'trayPageRows':3,'trayPageCapacity':18,'allowedPageCapacities':[18,12,6],
            'trayViewportHeight':144,'trayNavigation':'tap-pagination','candidateSlots':'any-empty',
            'estimatedBoardAndTrayHeight':l['grid']['rows']*48+24+144,
            'boardAndTrayNeverOverlap':True,'trueDeviceValidation':'pending'},
        'qa':{'status':'pending','humanPlaytest':'pending','phoneDisplay':'pending',
            'perceptualAlternativeSolutions':'pending','economyAndFailureRate':'pending',
            'noAdHumanSolvability':'pending','colourArtReview':'pending','releaseApproved':False}})
    if number<=12:
        l['scoreEpoch']='expanded-0.6'
    return l
def build_bank():
    source=load_source();overrides=load_overrides();levels=[make_level(v) for v in resolved_targets()]
    return {'schemaVersion':SCHEMA_VERSION,'contentVersion':VERSION,'gameplayMode':'click-fill','inputMode':'tap',
        'status':'candidate-human-qa-pending','generatedBy':'tools/levels/generate_levels.py',
        'acceptedTargetFieldsSha256':source['targetFieldsSha256'],'introOverridesSha256':overrides['overridesSha256'],
        'generatorRevision':GENERATOR_REVISION,
        'runtimePolicy':'load this fixed export only; reject any different schema or gameplay mode',
        'colourPolicy':{'recipeSource':'data/palettes/nature-palettes.v1.json','acceptedTargetSource':'data/levels/source/target-fields.v1.json',
            'introOverrideSource':'data/levels/source/overrides.v1.json',
            'strategy':'L001-L012 explicit larger rails and resampled original nature fields; L013-L100 exact baseline target HEXs, rails and anchors',
            'localGamutMapping':False,'humanArtReview':'pending'},
        'topologyMetricDefinitions':{'sharedCellCount':'cell referenced by a horizontal and a vertical path, including shared endpoints',
            'branchNodeCount':'node degree >= 3 in explicit rail-edge graph','fourWayNodeCount':'node degree = 4 in explicit rail-edge graph'},
        'lightnessShortcutPolicy':{'requiredFromChapter':3,'spatialOrderCount':8,'modes':['all-colours','movable-colours-with-fixed-anchors'],
            'condition':'no exact ascending-L target fill in any row/column-major flip','scope':'narrow heuristic exclusion only; not perceived uniqueness'},
        'challengePolicy':{'mode':'time','firstTimedLevel':1,'solvedBeforeFailure':True,
            'countedPlacementActions':['tray-to-empty-board','board-to-empty-board'],
            'occupiedBoardTarget':'reject; never overwrite or implicitly exchange','undoRefundsTime':False,'candidateSlots':'any-empty',
            'timeLimitFormula':'L001=45; other levels clamp(45 + N * secondsPerCandidate, 45, 240)',
            'secondsPerCandidateByChapter':[6,6,5,5,4],
            'reviveReward':'30 seconds after completed optional rewarded video, max 2 per attempt',
            'proofScope':'N initial empty cells require at least N placements; supplied N-action witness reaches exact target without props or ads; does not certify human completion within the timer'},
        'shufflePolicy':{'algorithm':'xorshift32-fisher-yates-rejection-v2','minimumCandidates':4,
            'minimumDisplacedRatio':.75,'maximumForwardOrReverseRun':2,'maximumAdjacentTargetPairRatio':.35,
            'maxAttempts':MAX_SHUFFLE_ATTEMPTS,'onExhaustion':'fail export; never fall back to answer order',
            'candidateSlots':'any-empty','initialHomeIndexRole':'author witness and opening reproduction only'},
        'chapters':[{'id':i+1,'name':levels[i*20]['chapterName'],'intent':CHAPTER_INTENTS[i],'levelCount':20} for i in range(5)],
        'templateUsage':dict(sorted(Counter(l['templateId'] for l in levels).items())),'levels':levels}
def write_catalogue(bank):
    fields=['id','chapter','chapterName','order','title','templateId','rhythm','cellCount','candidateCount',
        'sharedCellCount','branchNodeCount','fourWayNodeCount','minimumPlacements','timeLimitSeconds','reviveAddSeconds','orderedPaths','targetHexByPath']
    rows=[]
    for l in bank['levels']:
        d=l['difficulty'];c=l['challenge'];colors={v['id']:v['targetHex'] for v in l['cells']}
        rows.append({**{k:l[k] for k in fields if k in l},**{k:d[k] for k in ['cellCount','sharedCellCount','branchNodeCount','fourWayNodeCount']},
            'candidateCount':len(l['initialPool']),'minimumPlacements':c['minimumMoves'],'timeLimitSeconds':c['timeLimitSeconds'],
            'reviveAddSeconds':c['revive']['addSeconds'],'orderedPaths':' | '.join(' > '.join(p['cellIds']) for p in l['paths']),
            'targetHexByPath':' | '.join(' '.join(colors[v] for v in p['cellIds']) for p in l['paths'])})
    with (DOC/'catalogue.csv').open('w',encoding='utf-8-sig',newline='') as f:
        w=csv.DictWriter(f,fieldnames=fields);w.writeheader();w.writerows(rows)
    text=['# 点击补色百关目录 v0.6','','唯一运行题库：`data/levels/levels.v0.6.json`。上方只预填固定锚点，下方为乱序候选色，已放色可取回任意候选空槽。',
        'N为初始空槽/候选色数量，也是无道具精确目标的最低有效放置数。100关全部使用倒计时；L001为45秒，其余T=clamp(45+N×章节秒数,45,240)，章节秒数依次6、6、5、5、4。',
        '允许取回和调整；占用格不可覆盖。时间耗尽失败，自愿完成激励视频每次续时30秒，每局最多两次，也可免费重开。证解只证明可补全，不证明真人能在倒计时内完成。','']
    for chapter in bank['chapters']:
        text += [f'## 第{chapter["id"]}章 · {chapter["name"]}','',chapter['intent'],'',
            '| 关卡 | 自然主题 | 模板 | 总格/候选 | 最低放置数N | 倒计时/秒 |','| --- | --- | --- | --- | --- | --- |']
        for l in bank['levels']:
            if l['chapter']!=chapter['id']:continue
            c=l['challenge']
            text.append(f'| {l["id"]} | {l["title"]} | {l["templateId"]} | {len(l["cells"])}/{len(l["initialPool"])} | {c["minimumMoves"]} | {c["timeLimitSeconds"]} |')
        text.append('')
    (DOC/'catalogue.md').write_text('\n'.join(text)+'\n',encoding='utf-8')
def write_palette_overview(bank,report):
    from html import escape
    parts=['<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>百关自然色彩 · 作者答案总览 v0.6</title><style>body{margin:24px;background:#f8f6ef;color:#38454a;font:14px/1.6 system-ui,sans-serif}.grid{display:grid;grid-template-columns:repeat(10,minmax(90px,1fr));gap:12px}.item{padding:10px;background:white;border-radius:12px}.item h3{font-size:12px;margin:0}.item p{font-size:11px}.item svg{width:100%;height:auto}a{color:#287c78}@media(max-width:900px){.grid{grid-template-columns:repeat(5,1fr)}}@media(max-width:500px){.grid{grid-template-columns:repeat(3,1fr)}} </style><h1>100个自然色场</h1><p>作者答案总览，非游戏开局。前12关明确增加轨道与渐变采样，第13关起保留已认可目标色、轨道及锚点。真实玩法见<a href="atlas.html">点击补色图鉴</a>，默认上方空槽、下方候选。</p>']
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
        'introOverridesSha256':bank['introOverridesSha256'],'generatorRevision':GENERATOR_REVISION,
        'introTargets':[{'id':l['id'],'cells':len(l['cells']),'candidates':len(l['initialPool']),'seconds':l['challenge']['timeLimitSeconds']} for l in bank['levels'][:12]],
        'perChapter':[],'colourDiversity':{'globalMetrics':report['globalMetrics'],'familyCount':len(report['familyCounts'])}}
    for ch in range(1,6):
        group=[l for l in bank['levels'] if l['chapter']==ch]
        def r(fn,ls=group):return [min(fn(l) for l in ls),max(fn(l) for l in ls)]
        summary['perChapter'].append({'chapter':ch,'name':group[0]['chapterName'],'cellRange':r(lambda l:len(l['cells'])),
            'candidateRange':r(lambda l:len(l['initialPool'])),'timeLimitSecondsRange':r(lambda l:l['challenge']['timeLimitSeconds'])})
    (OUT/'levels.v0.6.summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (DOC/'palette-report.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    (DOC/'palette-report.md').write_text('# 百关自然色彩诊断 v0.6\n\n前12关按原自然主题扩大结构并重新采样；第13关起目标HEX与轨道保持基线。全库12类自然家族、12段色相覆盖；平均色度C='+str(report['globalMetrics']['meanChroma'])+'。\n\n逐关诊断见[JSON](palette-report.json)，作者答案总览见[色彩总览](palette-overview.html)。数值筛查不证明美术质量、感知唯一解或手机可辨性，人工与真机验收仍待进行。\n',encoding='utf-8')
    write_palette_overview(bank,report);write_catalogue(bank)
    template=Path(__file__).with_name('atlas.template.html').read_text(encoding='utf-8')
    (DOC/'atlas.html').write_text(template.replace('/*__BANK__*/',json.dumps(bank,ensure_ascii=False,separators=(',',':'))),encoding='utf-8')
    print(json.dumps(summary,ensure_ascii=False))
if __name__=='__main__':main()
