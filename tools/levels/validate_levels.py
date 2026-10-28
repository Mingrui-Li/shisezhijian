#!/usr/bin/env python3
"""Numerical/structural/proof validation, never a human perception certificate."""
from __future__ import annotations

import copy
import hashlib
import json
import math
import re
import sys
from collections import Counter, deque
from pathlib import Path

sys.dont_write_bytecode=True
from generate_levels import (DATA_PATH, SCHEMA_VERSION, VERSION, build_bank,
                             canonical_digest, distance, hex_to_lab, initial_state,
                             lab_to_linear, load_source, load_overrides, resolved_targets, palette_from_parameters, time_limit_seconds,
                             constrained_shuffle, shuffle_quality, shuffle_passes, MAX_SHUFFLE_ATTEMPTS)

from nature_palette import (colour_metrics, diversity_report, load_recipes, palette_distance,
                            MIN_ADJACENT_PALETTE_DISTANCE, field_diagnostics)

ROOT=Path(__file__).resolve().parents[2]


def geometry_signature(level):
    points={c['id']:(c['x'],c['y']) for c in level['cells']}
    signatures=[]
    for transpose in (False,True):
        for sx in (-1,1):
            for sy in (-1,1):
                transformed={id:((p[1] if transpose else p[0])*sx,(p[0] if transpose else p[1])*sy) for id,p in points.items()}
                minx=min(p[0] for p in transformed.values());miny=min(p[1] for p in transformed.values())
                transformed={id:(p[0]-minx,p[1]-miny) for id,p in transformed.items()}
                paths=[tuple(transformed[id] for id in p['cellIds']) for p in level['paths']]
                signatures.append(tuple(sorted(min(p,tuple(reversed(p))) for p in paths)))
    return min(signatures)


def target_clue_signature(level,canonical=False):
    anchors=set(level['anchors'])
    transforms=[(False,1,1)] if not canonical else [(s,x,y) for s in (False,True) for x in (-1,1) for y in (-1,1)]
    signatures=[]
    for transpose,sx,sy in transforms:
        cells=[((c['y'] if transpose else c['x'])*sx,(c['x'] if transpose else c['y'])*sy,
                c['targetHex'],c['id'] in anchors) for c in level['cells']]
        minx=min(c[0] for c in cells) if canonical else 0
        miny=min(c[1] for c in cells) if canonical else 0
        signatures.append(tuple(sorted((x-minx,y-miny,color,anchor) for x,y,color,anchor in cells)))
    return min(signatures)


def replay_witness(level):
    board=dict(level['initialBoard']);pool=list(level['initialPool'])
    anchors=set(level['anchors'])
    for action in level['challenge']['witnessSolution']:
        if set(action)!={'fromPoolIndex','toCellId'}:
            return False,'证解只能使用候选区点击放置'
        destination=action['toCellId'];i=action['fromPoolIndex']
        if destination not in board or destination in anchors:
            return False,'证解目标不存在或试图覆盖锚点'
        if not isinstance(i,int) or isinstance(i,bool) or not 0<=i<len(pool):
            return False,'非法候选区索引'
        if pool[i] is None or board[destination] is not None:
            return False,'候选色块为空或目标不是空槽'
        board[destination]=pool[i];pool[i]=None
    tilehex={t['id']:t['hex'] for t in level['tiles']}
    solved=all(board[c['id']] is not None and tilehex[board[c['id']]]==c['targetHex'] for c in level['cells'])
    if not solved or any(t is not None for t in pool):
        return False,'证解未达到完整色带目标或候选区未空'
    return True,''


def independently_test_lightness_fill(level):
    """Refill eight spatial sequences from ascending-L ranks, without clues.

    Then repeat with anchors left fixed and only movable colours sorted. Equal
    L ties conservatively count as matching ranks regardless of HEX tie order.
    """
    anchors=set(level['anchors'])
    result={'testedOrderCount':8,'fullColourHitOrders':[],'movableColourHitOrders':[]}
    for column_major in (False,True):
        primary,secondary=('x','y') if column_major else ('y','x')
        for p in (1,-1):
            for s in (1,-1):
                ordered=sorted(level['cells'],key=lambda c:(p*c[primary],s*c[secondary]))
                name=f"{'column' if column_major else 'row'}:{p:+d},{s:+d}"
                for key,candidates in [('fullColourHitOrders',ordered),
                                       ('movableColourHitOrders',[c for c in ordered if c['id'] not in anchors])]:
                    target_lightness=[hex_to_lab(c['targetHex'])[0] for c in candidates]
                    sorted_lightness=sorted(target_lightness)
                    if all(abs(a-b)<=1e-12 for a,b in zip(target_lightness,sorted_lightness)):
                        result[key].append(name)
    return result


def validate(bank,check_digest=True,check_reproducible=True):
    errors=[]
    levels=bank.get('levels',[])
    def check(condition,message):
        if not condition:
            errors.append(message)
    check(bank.get('schemaVersion')==SCHEMA_VERSION,'只接受schemaVersion 4.1.0')
    check(bank.get('contentVersion')==VERSION,'只接受contentVersion 0.6.0')
    check(bank.get('gameplayMode')=='click-fill' and bank.get('inputMode')=='tap','只接受点击补色模式')
    check(len(levels)==100,'题库必须100关')
    check([v['id'] for v in levels]==[f'L{i:03}' for i in range(1,101)],'关卡ID必须连续唯一')
    check(Counter(v['chapter'] for v in levels)=={i:20 for i in range(1,6)},'每章必须20关')
    check(len({v['seed'] for v in levels})==100,'seed必须唯一')
    worst_pair=(1,None);max_height=0;max_pool=0
    recipes=load_recipes()
    for l in levels:
        def ck(condition,message):
            check(condition,l['id']+': '+message)
        try:
            ck(l.get('gameplayMode')=='click-fill' and l.get('inputMode')=='tap','关卡必须点击补色')
            ck(l.get('contentVersion')==VERSION,'关卡内容版本必须0.6.0')
            ck(l.get('scoreEpoch','base-v1')==('expanded-0.6' if l['number']<=12 else 'base-v1'),'关卡积分周期必须与前十二关改版一致')
            cells=l['cells'];by={c['id']:c for c in cells};positions={(c['x'],c['y']) for c in cells}
            ck(len(by)==len(cells)==len(positions),'格位ID/坐标重复')
            ck(all(isinstance(v,int) and 0<=v<=5 for c in cells for v in [c['x'],c['y']]),'坐标需为0–5整数')
            w,h=l['grid']['columns'],l['grid']['rows']
            ck(1<=w<=6 and 1<=h<=6,'棋盘最多6×6')
            ck(max(c['x'] for c in cells)+1==w and max(c['y'] for c in cells)+1==h,'网格尺寸记录错误')
            counts=Counter();edges=set();path_signatures=set()
            for path in l['paths']:
                ids=path['cellIds']
                ck(len(ids)>=2 and len(ids)==len(set(ids)),'轨道至少2格且不可自重叠')
                ck(set(ids)<=set(by),'路径引用不存在格位')
                counts.update(ids)
                sig=min(tuple(ids),tuple(reversed(ids)))
                ck(sig not in path_signatures,'重复轨道');path_signatures.add(sig)
                for a,b in zip(ids,ids[1:]):
                    ck(abs(by[a]['x']-by[b]['x'])+abs(by[a]['y']-by[b]['y'])==1,'轨道断裂或非正交')
                    edges.add(tuple(sorted((a,b))))
                if l['geometryKind']!='single':
                    ck(len({by[id]['x'] for id in ids})==1 or len({by[id]['y'] for id in ids})==1,'二维色场轨道必须为直行或直列')
            ck(set(counts)==set(by),'轨道没有覆盖所有格位')
            shared=sorted(id for id,n in counts.items() if n>1)
            ck(shared==sorted(l['intersectionCellIds']),'交点声明不一致')
            ck(max(counts.values())<=2,'一格最多横纵两条路径')
            if l['geometryKind']!='single':
                ck(len(shared)>=(4 if l['chapter']>=2 else 2),'二维题须有多个耦合交点')
            neighbours={c:set() for c in by}
            for a,b in edges:
                neighbours[a].add(b);neighbours[b].add(a)
            seen={cells[0]['id']};queue=deque(seen)
            while queue:
                for next_cell in neighbours[queue.popleft()]-seen:
                    seen.add(next_cell);queue.append(next_cell)
            ck(seen==set(by),'轨网必须连通')
            for i,a in enumerate(cells):
                for b in cells[i+1:]:
                    if abs(a['x']-b['x'])+abs(a['y']-b['y'])==1:
                        ck(tuple(sorted((a['id'],b['id']))) in edges,'未连接的贴边格造成线索歧义')
            anchors=set(l['anchors']);target={c['id']:c['targetTileId'] for c in cells}
            ck(len(anchors)==len(l['anchors']) and anchors<=set(by),'锚点重复或不存在')
            ck(set(l['initialBoard'])==set(by),'初始棋盘缺格或多格')
            tilemap={t['id']:t for t in l['tiles']}
            ck(len(tilemap)==len(l['tiles'])==len(cells),'色块ID数量/唯一性错误')
            initial=[t for t in l['initialBoard'].values() if t is not None]+l['initialPool']
            ck(Counter(initial)==Counter(tilemap.keys()),'色块多重集不守恒')
            ck(all(l['initialBoard'][a]==target[a] for a in anchors),'锚点初始颜色错误')
            movable=[c['id'] for c in cells if c['id'] not in anchors]
            ck(bool(movable),'必须有可移动格')
            ck(any(l['initialBoard'][id]!=target[id] for id in by),'初始不得已经解开')
            ck(all(l['initialBoard'][id] is None for id in movable),'非锚点开局必须空缺')
            ck(len(l['initialPool'])==len(movable),'全部非锚点颜色必须位于下方候选区')
            ck(l['trayHomeByTile']=={tile:i for i,tile in enumerate(l['initialPool'])},'候选区初始索引错误')
            ck(l['trayHomeByTileRole'].startswith('initial-only;'),'候选索引只能描述初始开局')
            ck(l['shuffle']=={'algorithm':'xorshift32-fisher-yates-rejection-v2','scope':'non-anchor-tray-only','stableHomeSlots':False,'candidateSlots':'any-empty','maxAttempts':MAX_SHUFFLE_ATTEMPTS},'候选区打乱协议错误')
            ordered=[c['targetTileId'] for c in cells if c['id'] not in anchors]
            quality=shuffle_quality(l['initialPool'],ordered)
            ck(shuffle_passes(quality),'洗牌质量不足：候选必须至少4块、至少75%错位、顺逆连续不超过2且相邻目标对不超过35%')
            _,expected_quality=constrained_shuffle(ordered,l['seed'])
            ck(l['shuffleQuality']==expected_quality,'洗牌质量量化记录不符合确定性拒绝采样')
            ck(all(l['shuffleQuality'][key]==value for key,value in quality.items()),'洗牌质量量化记录与实际候选不符')
            if l['geometryKind']!='single':
                ck(4<=len(anchors)<=5,'正式二维题使用四角加至多1个辅助锚')
                ck(all(f'c{x}_{y}' in anchors for x,y in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]),'四角必须保留锚点')
            ck(len({c['targetHex'] for c in cells})==len(cells),'本关HEX重复')
            for c in cells:
                ck(re.fullmatch(r'#[0-9A-F]{6}',c['targetHex']) is not None,'HEX格式错误')
                t=tilemap[c['targetTileId']]
                ck(t['hex']==c['targetHex'] and t['targetCellId']==c['id'],'tile/cell目标不一致')
                ck(t['equivalenceGroup']==c['targetHex'],'等价组不一致')
                ck(l['solution']['targetByCell'][c['id']]==c['targetHex'],'判胜表不一致')
                ck(l['solution']['equivalenceGroups'][c['targetHex']]==[c['targetTileId']],'等价色组表不一致')
                ck(all(-1e-6<=v<=1+1e-6 for v in lab_to_linear(hex_to_lab(c['targetHex']))),'导出颜色不在sRGB色域')
            coordinate_paths=[[(by[id]['x'],by[id]['y']) for id in p['cellIds']] for p in l['paths']]
            expected,scale=palette_from_parameters(coordinate_paths,l['palette'])
            ck(all(expected[(c['x'],c['y'])]==c['targetHex'] for c in cells),'HEX无法由记录色场复现')
            ck(abs(scale-l['palette']['commonChromaScale'])<1e-10,'共同色域压缩比例错误')
            p=l['palette'];recipe=recipes[l['number']-1]
            ck(p['fieldChecks']==field_diagnostics(coordinate_paths,{(c['x'],c['y']):c['targetHex'] for c in cells},p),'色场线性/量化误差记录错误')
            ck(not p['fieldChecks']['localGamutMappingUsed'],'不允许局部色域映射破坏双线性场')
            ck(all(p[k]==recipe[k] for k in ['themeId','themeName','family','mood','brief']),'自然主题元数据与色卡源不一致')
            ck(p['seedCornersHex']==recipe['cornersHex'],'自然四角种子不能被静默替换')
            ck(l['title']==p['themeName'],'关名必须与当前自然主题一致')
            ck(p['commonChromaScale']>=.80,'共同色域映射保留低于.80')
            metrics=colour_metrics([c['targetHex'] for c in cells])
            ck(metrics==p['metrics'],'实际HEX的色度/亮度/色相指标记录错误')
            ck(metrics['meanChroma']>=.045 and metrics['maxChroma']>=.095,'色盘低色度主导，未满足丰富色彩候选线')
            ck(metrics['lowChromaRatio']<=.6,'低色度块占比过高')
            expected_corners=[by[f'c{x}_{y}']['targetHex'] for x,y in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]] if l['geometryKind']!='single' else [by[l['paths'][0]['cellIds'][0]]['targetHex'],by[l['paths'][0]['cellIds'][-1]]['targetHex']]
            ck(p['actualCornersHex']==expected_corners,'实际四角色条与目标不一致')
            if l['number']>1:
                previous=levels[l['number']-2]
                actual_distance=palette_distance([c['targetHex'] for c in cells],[c['targetHex'] for c in previous['cells']])
                ck(abs(actual_distance-p['distanceFromPrevious'])<1e-6,'与前关色盘距离记录错误')
                ck(actual_distance>=MIN_ADJACENT_PALETTE_DISTANCE,'相邻关实际色彩过于接近')
                ck(p['family']!=previous['palette']['family'],'相邻关自然家族重复')
                ck(p['mood']!=previous['palette']['mood'],'相邻关色彩气质重复')
                ck(metrics['mainColourSignature']!=previous['palette']['metrics']['mainColourSignature'],'相邻关主色签名重复')
            else:
                ck(p['distanceFromPrevious'] is None,'首关不应有前关距离')
            ck(l['qa'].get('colourArtReview')=='pending','艺术审阅必须保留pending')
            ck(l['palette']['method']==('oklab-path-linear' if l['geometryKind']=='single' else 'oklab-bilinear-four-corners'),'配色方法不符合轨道结构')
            labs={c['id']:hex_to_lab(c['targetHex']) for c in cells}
            minimum=min(distance(labs[a],labs[b]) for i,a in enumerate(labs) for b in list(labs)[i+1:])
            adjacent=min(distance(labs[a],labs[b]) for p in l['paths'] for a,b in zip(p['cellIds'],p['cellIds'][1:]))
            ck(minimum>=.020,'全局色差低于候选筛查线.020')
            ck(abs(minimum-l['difficulty']['minPairDeltaEOK'])<1e-6,'记录全局色差错误')
            ck(abs(adjacent-l['difficulty']['minAdjacentDeltaEOK'])<1e-6,'记录相邻色差错误')
            for p in l['paths']:
                ids=p['cellIds'];a=labs[ids[0]];b=labs[ids[-1]]
                for i,id in enumerate(ids):
                    t=i/(len(ids)-1)
                    expected_lab=tuple(x+(y-x)*t for x,y in zip(a,b))
                    ck(distance(expected_lab,labs[id])<.004,'同一行/列/教学轨道不符合连续线性渐变')
            if l['chapter']>=2:
                # Descriptive colour diversity only. A near-equal-L pair alone
                # does NOT rule out spatial brightness sorting; test that below.
                ck(any(abs(a[0]-b[0])<.012 and distance(a,b)>.030 for i,a in enumerate(labs.values()) for b in list(labs.values())[i+1:]),'后期缺少必须观察色相的近等明度色对')
            d=l['difficulty']
            ck(d['cellCount']==len(cells) and d['movableCount']==len(movable),'格/可动统计错误')
            ck(d['pathCount']==len(l['paths']),'路径数量错误')
            ck(d['sharedCellCount']==len(shared),'横纵共享格统计错误')
            ck(d['branchNodeCount']==sum(len(adjacent)>=3 for adjacent in neighbours.values()),'degree≥3分叉节点统计错误')
            ck(d['fourWayNodeCount']==sum(len(adjacent)==4 for adjacent in neighbours.values()),'degree=4四向节点统计错误')
            ck(d['movableJunctionCount']==len(set(shared)-anchors),'可动共享格统计错误')
            shortcut_test=independently_test_lightness_fill(l)
            shortcut_record=d['lightnessShortcutCheck']
            ck(all(shortcut_record[key]==value for key,value in shortcut_test.items()),'明度排序捷径检测记录与实际填盘不一致')
            ck(shortcut_record['requiredNoHits']==(l['chapter']>=3),'明度排序捷径筛查阶段错误')
            if l['chapter']>=3:
                ck(not shortcut_test['fullColourHitOrders'],'全盘按L排序存在空间填盘明度排序捷径')
                ck(not shortcut_test['movableColourHitOrders'],'去锚点按L排序存在空间填盘明度排序捷径')
            challenge=l['challenge'];m=challenge['minimumMoves'];witness=challenge['witnessSolution']
            exact=sum(tile is None for tile in l['initialBoard'].values())
            ck(exact==len(l['initialPool'])==len(movable)==m,'最低有效放置数应为初始空槽数N')
            ck(challenge['minimumMovesMetric']=='tray-to-empty-board-placements','最低动作度量必须点击放置')
            ck(not any(k in challenge for k in ['slackMoves','budgetFactor','budgetBuffer','moveBudget','moveAllowance','allowanceRatio','rhythmExtra']),'禁止遗留旧动作预算字段')
            ck(len(witness)==m,'证解长度不等于N')
            valid,message=replay_witness(l);ck(valid,message)
            ck(challenge['mode']=='time','全部关卡必须使用倒计时')
            seconds=challenge['timeLimitSeconds']
            ck(type(seconds) is int and 45<=seconds<=240,'倒计时必须为45–240的整数秒')
            ck(seconds==time_limit_seconds(l['number'],l['chapter'],m),'倒计时不符合章节时间公式')
            ck(challenge['revive']=={'maxPerAttempt':2,'addSeconds':30},'复活续时不符合规则')
            expected_board,pool,homes,expected_witness=initial_state(cells,l['anchors'],l['seed'])
            ck(expected_board==l['initialBoard'] and pool==l['initialPool'] and homes==l['trayHomeByTile'],'seed不能复现初始盘面与候选初始索引')
            ck(expected_witness==witness,'证解不能由固定候选顺序复现')
            qa=l['qa'];ck(qa['status']=='pending' and not qa['releaseApproved'],'全部候选必须保留人工QA pending')
            ck(all(qa[k]=='pending' for k in ['humanPlaytest','phoneDisplay','perceptualAlternativeSolutions','economyAndFailureRate','noAdHumanSolvability']),'不得预先宣称人工试玩/盈利/无广告人类通关验收')
            layout=l['layoutBudget']
            ck(layout['cellHitSize']>=44 and layout['cellPitch']>=layout['cellHitSize'],'触摸预算过小')
            ck(layout['poolRows']==math.ceil(len(l['initialPool'])/6),'待选行数错误')
            ck(layout['cellPitch']==48 and layout['poolColumns']==6,'布局必须保持候选区与轨道的格距契约')
            ck(layout['trayPageRows']==3 and layout['trayViewportHeight']==144 and layout['trayPageCapacity']==18,'候选区标准三行分页契约错误')
            ck(layout['allowedPageCapacities']==[18,12,6],'候选区小屏自适应分页容量错误')
            ck(layout['candidateSlots']=='any-empty' and layout['boardAndTrayNeverOverlap'],'色块可取回任意候选空槽，候选区与轨道须分区')
            ck(layout['trayNavigation']=='tap-pagination','候选区只能点击翻页')
            height=h*48+24+144
            ck(layout['estimatedBoardAndTrayHeight']==height and height<=456,'棋盘和候选视窗高度预算错误或超限')
            max_height=max(max_height,height);max_pool=max(max_pool,len(l['initialPool']))
            if minimum<worst_pair[0]:
                worst_pair=(minimum,l['id'])
        except (KeyError,ValueError,TypeError,IndexError,ZeroDivisionError) as e:
            errors.append(l['id']+': malformed content: '+str(e))
    exact_seen={};canonical_seen={}
    for l in levels:
        for canonical,seen in [(False,exact_seen),(True,canonical_seen)]:
            sig=target_clue_signature(l,canonical)
            check(sig not in seen,f"{l['id']}: 目标颜色+锚点与{seen.get(sig)}{'经旋转镜像后' if canonical else '精确'}重复")
            seen[sig]=l['id']
    art=diversity_report(bank) if len(levels)==100 else None
    if art:
        check(len(art['familyCounts'])>=12,'全库自然色彩家族不得少于12类')
        check(len(art['globalMetrics']['hueBins30Degrees'])==12,'全库必须覆盖12段有色度的色相')
    source=load_source()
    preserved_keys=['id','number','chapter','chapterName','order','title','templateId','geometryKind','seed','rhythm','grid','cells','paths','intersectionCellIds','anchors','tiles','solution','palette']
    check(bank.get('acceptedTargetFieldsSha256')==source['targetFieldsSha256'],'认可目标色场摘要不一致')
    check(bank.get('introOverridesSha256')==load_overrides()['overridesSha256'],'前十二关改版摘要不一致')
    for new,expected,accepted in zip(levels,resolved_targets(),source['levels']):
        check(all(new[k]==expected[k] for k in preserved_keys),new['id']+': 目标色场/轨道/锚点不能由基线加明确改版复现')
        if new['number']>=13:
            check(all(new[k]==accepted[k] for k in preserved_keys if k!='palette'),new['id']+': L013起不可变目标色场/轨道/锚点/身份被修改')
        else:
            check(new['title']==accepted['title'] and all(new['palette'][k]==accepted['palette'][k] for k in ['themeId','themeName','family','mood','brief','seedCornersHex']),new['id']+': 前十二关必须保持已认可自然主题')
    policy=bank['challengePolicy']
    check(policy['countedPlacementActions']==['tray-to-empty-board','board-to-empty-board'],'有效落位动作协议错误')
    check(policy['candidateSlots']=='any-empty' and policy['undoRefundsTime'] is False,'任意候选空槽与撤销协议错误')
    check(policy['mode']=='time' and policy['firstTimedLevel']==1,'全部关卡必须使用倒计时')
    check(policy['secondsPerCandidateByChapter']==[6,6,5,5,4],'章节时间比例错误')
    shuffle_policy=bank['shufflePolicy']
    check(shuffle_policy['minimumCandidates']==4 and shuffle_policy['minimumDisplacedRatio']==.75
        and shuffle_policy['maximumForwardOrReverseRun']==2 and shuffle_policy['maximumAdjacentTargetPairRatio']==.35
        and shuffle_policy['maxAttempts']==MAX_SHUFFLE_ATTEMPTS and shuffle_policy['candidateSlots']=='any-empty','全库洗牌质量策略错误')
    per_chapter=[]
    for ch in range(1,6):
        group=[l for l in levels if l['chapter']==ch]
        if not group:
            continue
        check([l['order'] for l in group]==list(range(1,21)),f'第{ch}章顺序错误')
        lower,upper=[(7,16),(16,20),(20,25),(25,30),(30,36)][ch-1]
        check(all(lower<=len(l['cells'])<=upper for l in group),f'第{ch}章规模必须{lower}–{upper}格')
        if ch>=2:
            check(len({geometry_signature(l) for l in group})>=8,f'第{ch}章结构变化不足，不能只换色')
        check(len(set(l['palette']['family'] for l in group))>=10,f'第{ch}章自然家族不足10类')
        chapter_chromas=[l['palette']['metrics']['meanChroma'] for l in group]
        chapter_ls=[l['palette']['metrics']['meanLightness'] for l in group]
        check(max(chapter_chromas)-min(chapter_chromas)>=.035,f'第{ch}章缺少明显浓淡色度变化')
        check(max(chapter_ls)-min(chapter_ls)>=.15,f'第{ch}章缺少明显明暗变化')
        check(group[-1]['rhythm']=='finale',f'第{ch}章末需finale')
        def range_of(fn,source=group):
            values=[fn(l) for l in source]
            return [min(values),max(values)]
        per_chapter.append({'chapter':ch,'name':group[0]['chapterName'],
                            'cellRange':range_of(lambda l:len(l['cells'])),
                            'movableRange':range_of(lambda l:l['difficulty']['movableCount']),
                            'sharedCellRange':range_of(lambda l:l['difficulty']['sharedCellCount']),
                            'branchNodeRange':range_of(lambda l:l['difficulty']['branchNodeCount']),
                            'fourWayNodeRange':range_of(lambda l:l['difficulty']['fourWayNodeCount']),
                            'lightnessFullHitLevelIds':[l['id'] for l in group if independently_test_lightness_fill(l)['fullColourHitOrders']],
                            'lightnessMovableHitLevelIds':[l['id'] for l in group if independently_test_lightness_fill(l)['movableColourHitOrders']],
                            'minimumMovesRange':range_of(lambda l:l['challenge']['minimumMoves']),
                            'timeLimitSecondsRange':range_of(lambda l:l['challenge']['timeLimitSeconds']),
                            'namedTemplateCount':len({l['templateId'] for l in group}),
                            'canonicalGeometryCount':len({geometry_signature(l) for l in group}),
                            'rhythm':dict(Counter(l['rhythm'] for l in group)),
                            'geometryKinds':dict(Counter(l['geometryKind'] for l in group))})
    if len(levels)==100:
        check(len(levels[0]['cells'])==7 and len(levels[0]['initialPool'])==5,'L001须7格5块待放')
        check(len(levels[1]['cells'])==9 and len(levels[1]['initialPool'])==7,'L002须9格7块待放')
        check(levels[2]['challenge']['minimumMoves']==7 and len(levels[2]['initialPool'])==7,'L003须双转弯9格7候选')
        check(all(len(l['initialPool'])>=4 for l in levels),'正式关卡至少4候选，不能通过二选顺逆序直接给答案')
        check([len(l['cells']) for l in levels[:12]]==[7,9,9,9,9,12,12,12,13,14,15,16],'前十二关结构阶梯错误')
        for index in (71,77):
            check(len(levels[index]['cells'])>=25 and levels[index]['difficulty']['sharedCellCount']>=9,f'L{index+1:03}不得退回短线，至少25格和9共享格')
        check(len(levels[-1]['cells'])==36 and levels[-1]['grid']=={'columns':6,'rows':6},'L100须完整6×6 36格')
        check(levels[-1]['challenge']['minimumMoves']==32,'L100须32个候选与初始空槽')
    reproduced=(bank==json.loads(json.dumps(build_bank()))) if check_reproducible else False
    if check_reproducible:
        check(reproduced,'整库不能由同一源码/seed精确复现')
    digest=hashlib.sha256(DATA_PATH.read_bytes()).hexdigest() if DATA_PATH.exists() else None
    if check_digest:
        check(digest==DATA_PATH.with_suffix('.sha256').read_text().split()[0],'数据SHA256不匹配')
    return {'status':'pass' if not errors else 'fail','contentVersion':bank.get('contentVersion'),
            'levelCount':len(levels),'errorCount':len(errors),'errors':errors,
            'namedTemplateCount':len({l['templateId'] for l in levels}),
            'canonicalGeometryCount':len({geometry_signature(l) for l in levels}),
            'uniqueExactTargetClueCount':len(exact_seen),'uniqueCanonicalTargetClueCount':len(canonical_seen),
            'minPairDeltaEOK':round(worst_pair[0],6),'minPairLevel':worst_pair[1],
            'maxCells':max(len(l['cells']) for l in levels),'maxPool':max_pool,
            'shuffleQuality':{'minimumCandidates':min(len(l['initialPool']) for l in levels),
                'minimumDisplacedRatio':min(l['shuffleQuality']['displacedRatio'] for l in levels),
                'maximumForwardOrReverseRun':max(l['shuffleQuality']['longestForwardOrReverseRun'] for l in levels),
                'maximumAdjacentTargetPairRatio':max(l['shuffleQuality']['adjacentTargetPairRatio'] for l in levels),
                'maximumRejectionAttemptsUsed':max(l['shuffleQuality']['acceptedAttempt'] for l in levels),
                'forwardOrReverseLevelIds':[l['id'] for l in levels if l['shuffleQuality']['isForwardOrder'] or l['shuffleQuality']['isReverseOrder']]},
            'maxBoardAndPoolHeight':max_height,'perChapter':per_chapter,
            'proofsReplayed':len(levels),'fixedSeedReproduction':'pass' if reproduced else 'not-run-or-failed',
            'lightnessShortcutScreen':{'requiredChapters':[3,4,5],'spatialOrdersPerMode':8,'modes':['all-colours','movable-colours-with-fixed-anchors'],
                                       'protectedLevelCount':sum(l['chapter']>=3 for l in levels),
                                       'protectedFullHitLevelIds':[l['id'] for l in levels if l['chapter']>=3 and independently_test_lightness_fill(l)['fullColourHitOrders']],
                                       'protectedMovableHitLevelIds':[l['id'] for l in levels if l['chapter']>=3 and independently_test_lightness_fill(l)['movableColourHitOrders']],
                                       'scope':'rules out only these exact rank-L fill heuristics; not perceptual uniqueness or proof against other shortcuts'},
            'colourDiversity':{'familyCount':len(art['familyCounts']) if art else None,'globalMetrics':art['globalMetrics'] if art else None,
                               'minimumAdjacentPaletteDistance':min(l['palette']['distanceFromPrevious'] for l in levels[1:]),
                               'baselineL013ToL100Invariant':'pass' if not any('不可变目标色场' in e for e in errors) else 'fail',
                               'introOverrideSource':'data/levels/source/overrides.v1.json',
                               'humanArtReview':'pending'},
            'sha256':digest,
            'notes':['100关全部保留人工QA pending；数值校验不证明人眼唯一合理解。',
                     '每关N次候选色点击放置证解已重放；证解不使用道具或广告，不证明真人能在倒计时内完成。',
                     '失败率、道具消耗、广告转化和实际时长均为待试玩/上线实验假设。',
                     '全部关卡仅锚点预填，其余空缺；候选初始索引只供复现，已放色可取回任意候选空槽。',
                     'L001–L012按明确作者改版增加轨道及采样，L013–L100保持基线目标色、轨道与锚点。',
                     '图鉴只做静态/模拟DOM检查，本轮没有浏览器视觉与真机验收。']}


def rejection_probes(bank):
    """Ensure meaningful corruptions fail, without changing the real bank."""
    probes=[]
    def probe(name,mutate,required_error=None):
        broken=copy.deepcopy(bank);mutate(broken)
        result=validate(broken,check_digest=False,check_reproducible=False)
        rejected=result['status']=='fail' and (required_error is None or any(required_error in error for error in result['errors']))
        probes.append({'name':name,'rejected':rejected})
    probe('reject-old-schema',lambda b:b.update(schemaVersion='2.0.0'),'只接受schemaVersion')
    probe('reject-other-gameplay-mode',lambda b:b.update(gameplayMode='other'),'只接受点击补色')
    probe('reject-old-level-mode',lambda b:b['levels'][49].update(gameplayMode='other'),'关卡必须点击补色')
    probe('reject-occupied-non-anchor-start',lambda b:b['levels'][49]['initialBoard'].update({next(c['id'] for c in b['levels'][49]['cells'] if c['id'] not in b['levels'][49]['anchors']):b['levels'][49]['initialPool'][0]}),'非锚点开局必须空缺')
    probe('duplicate-initial-tile',lambda b:b['levels'][49]['initialPool'].__setitem__(0,b['levels'][49]['initialPool'][1]),'色块多重集不守恒')
    probe('legacy-action-budget-field',lambda b:b['levels'][99]['challenge'].update(moveBudget=1),'禁止遗留旧动作预算字段')
    probe('timer-too-short',lambda b:b['levels'][99]['challenge'].update(timeLimitSeconds=1),'倒计时必须为')
    probe('timer-formula-mismatch',lambda b:b['levels'][99]['challenge'].update(timeLimitSeconds=240),'倒计时不符合')
    probe('timer-mode-mismatch',lambda b:b['levels'][0]['challenge'].update(mode='none'),'全部关卡必须使用倒计时')
    probe('timer-first-level-mismatch',lambda b:b['levels'][0]['challenge'].update(timeLimitSeconds=51),'倒计时不符合')
    probe('revive-seconds-mismatch',lambda b:b['levels'][99]['challenge']['revive'].update(addSeconds=5),'复活续时不符合')
    probe('illegal-anchor-placement',lambda b:b['levels'][77]['challenge']['witnessSolution'][0].update(toCellId=b['levels'][77]['anchors'][0]),'试图覆盖锚点')
    probe('illegal-board-source-in-witness',lambda b:b['levels'][77]['challenge']['witnessSolution'][0].update(fromCellId=b['levels'][77]['anchors'][0]),'证解只能使用候选区点击放置')
    probe('mismatched-field-colour',lambda b:b['levels'][71]['cells'][7].update(targetHex='#FFFFFF'))
    probe('false-minimum-moves',lambda b:b['levels'][69]['challenge'].update(minimumMoves=b['levels'][69]['challenge']['minimumMoves']-1),'最低有效放置数')
    probe('seed-mismatch',lambda b:b['levels'][88].update(seed=b['levels'][88]['seed']+1),'seed不能复现')
    probe('false-tray-home',lambda b:b['levels'][88]['trayHomeByTile'].update({b['levels'][88]['initialPool'][0]:1}),'候选区初始索引错误')
    probe('missing-candidate',lambda b:b['levels'][49]['initialPool'].pop(),'全部非锚点颜色必须位于下方候选区')
    probe('reused-pool-slot-in-witness',lambda b:b['levels'][49]['challenge']['witnessSolution'][1].update(fromPoolIndex=b['levels'][49]['challenge']['witnessSolution'][0]['fromPoolIndex']),'候选色块为空')
    probe('occupied-target-in-witness',lambda b:b['levels'][49]['challenge']['witnessSolution'][1].update(toCellId=b['levels'][49]['challenge']['witnessSolution'][0]['toCellId']),'目标不是空槽')
    probe('false-move-metric',lambda b:b['levels'][49]['challenge'].update(minimumMovesMetric='other'),'最低动作度量必须点击放置')
    probe('wrong-input-mode',lambda b:b['levels'][49].update(inputMode='drag'),'关卡必须点击补色')
    probe('intro-score-epoch-missing',lambda b:b['levels'][0].pop('scoreEpoch'),'关卡积分周期')
    def force_pool_order(bank,reverse=False):
        level=bank['levels'][1]
        pool=[c['targetTileId'] for c in level['cells'] if c['id'] not in level['anchors']]
        if reverse:pool.reverse()
        level['initialPool']=pool;level['trayHomeByTile']={tile:i for i,tile in enumerate(pool)}
        level['challenge']['witnessSolution']=[{'fromPoolIndex':level['trayHomeByTile'][c['targetTileId']],'toCellId':c['id']} for c in level['cells'] if c['id'] not in level['anchors']]
    probe('ordered-candidate-answer-leak',lambda b:force_pool_order(b),'洗牌质量不足')
    probe('reversed-candidate-answer-leak',lambda b:force_pool_order(b,True),'洗牌质量不足')
    probe('false-shuffle-quality',lambda b:b['levels'][1]['shuffleQuality'].update(displacedCount=0),'洗牌质量量化记录')
    def force_row_major_L_fill(b):
        level=b['levels'][-1]
        ordered=sorted(level['cells'],key=lambda c:(c['y'],c['x']))
        colors=sorted((c['targetHex'] for c in ordered),key=lambda color:hex_to_lab(color)[0])
        for c,color in zip(ordered,colors):
            c['targetHex']=color
        # Other field metadata intentionally stays unchanged. The test requires
        # an explicit shortcut error, not just a palette-reconstruction failure.
    probe('obvious-row-major-lightness-shortcut',force_row_major_L_fill,'全盘按L排序存在空间填盘明度排序捷径')
    def repeat_previous_palette(b):
        previous={c['id']:c['targetHex'] for c in b['levels'][40]['cells']}
        level=b['levels'][41]
        for c in level['cells']:
            c['targetHex']=previous[c['id']]
        for t in level['tiles']:
            t['hex']=previous[t['targetCellId']]
            t['equivalenceGroup']=t['hex']
        level['solution']['targetByCell']=dict(previous)
        level['solution']['equivalenceGroups']={c['targetHex']:[c['targetTileId']] for c in level['cells']}
    probe('adjacent-actual-colour-repeat',repeat_previous_palette,'相邻关实际色彩过于接近')
    probe('false-colour-metric',lambda b:b['levels'][50]['palette']['metrics'].update(meanChroma=0),'色度/亮度/色相指标记录错误')
    probe('adjacent-family-repeat',lambda b:b['levels'][50]['palette'].update(family=b['levels'][49]['palette']['family']),'相邻关自然家族重复')
    probe('false-four-way-node-count',lambda b:b['levels'][99]['difficulty'].update(fourWayNodeCount=36),'degree=4四向节点统计错误')
    return probes


def main():
    bank=json.loads(DATA_PATH.read_text(encoding='utf-8'))
    report=validate(bank)
    probes=rejection_probes(bank)
    report['corruptionProbes']=probes
    if not all(p['rejected'] for p in probes):
        report['status']='fail';report['errors'].append('存在未拒绝的损坏数据探针');report['errorCount']=len(report['errors'])
    path=ROOT/'docs/levels/validation-report.json'
    path.write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    print(json.dumps(report,ensure_ascii=False,indent=2))
    raise SystemExit(0 if report['status']=='pass' else 1)


if __name__=='__main__':
    main()
