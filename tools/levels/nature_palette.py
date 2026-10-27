"""Deterministic natural-colour field selection and descriptive diagnostics.

No hue-wheel recolouring, RGB clipping or local gamut correction. Four original
sRGB seeds are fitted as one OKLab bilinear field; candidates retain their
recorded seed relationship. Numeric screens are authoring heuristics only.
"""
from __future__ import annotations
import itertools
import json
import math
from collections import Counter
from functools import lru_cache
from pathlib import Path

ROOT=Path(__file__).resolve().parents[2]
RECIPE_PATH=ROOT/'data/palettes/nature-palettes.v1.json'
LOW_CHROMA=.035
MIN_PAIR=.020
MIN_ADJACENT_PALETTE_DISTANCE=.032


def lab_to_linear(lab):
    L,a,b=lab
    l=(L+.3963377774*a+.2158037573*b)**3
    m=(L-.1055613458*a-.0638541728*b)**3
    s=(L-.0894841775*a-1.2914855480*b)**3
    return (4.0767416621*l-3.3077115913*m+.2309699292*s,
            -1.2684380046*l+2.6097574011*m-.3413193965*s,
            -.0041960863*l-.7034186147*m+1.7076147010*s)


@lru_cache(maxsize=50000)
def hex_to_lab(value):
    def linear(x):
        x=int(x,16)/255
        return x/12.92 if x<=.04045 else ((x+.055)/1.055)**2.4
    r,g,b=(linear(value[i:i+2]) for i in (1,3,5))
    l=(.4122214708*r+.5363325363*g+.0514459929*b)**(1/3)
    m=(.2119034982*r+.6806995451*g+.1073969566*b)**(1/3)
    s=(.0883024619*r+.2817188376*g+.6299787005*b)**(1/3)
    return (.2104542553*l+.7936177850*m-.0040720468*s,
            1.9779984951*l-2.4285922050*m+.4505937099*s,
            .0259040371*l+.7827717662*m-.8086757660*s)


def distance(a,b):
    return math.sqrt(sum((x-y)**2 for x,y in zip(a,b)))


def rgb_hex(lab):
    rgb=lab_to_linear(lab)
    if not all(-1e-8<=c<=1+1e-8 for c in rgb):
        raise ValueError(f'outside gamut: {rgb}')
    def gamma(x):
        # Tiny matrix roundoff at exact black/white is not a gamut operation.
        x=max(0,min(1,x))
        return 12.92*x if x<=.0031308 else 1.055*x**(1/2.4)-.055
    return '#'+''.join(f'{round(gamma(c)*255):02X}' for c in rgb)


def fit_palette(labs):
    def fitted(scale):
        return {p:(v[0],v[1]*scale,v[2]*scale) for p,v in labs.items()}
    def ingamut(values):
        return all(all(-1e-8<=c<=1+1e-8 for c in lab_to_linear(v)) for v in values.values())
    scale=1.
    if not ingamut(labs):
        low,high=0.,1.
        for _ in range(42):
            mid=(low+high)/2
            if ingamut(fitted(mid)):low=mid
            else:high=mid
        scale=low*.999
    return {p:rgb_hex(v) for p,v in fitted(scale).items()},scale


def bilinear(corners,u,v):
    tl,tr,bl,br=corners
    return tuple((1-u)*(1-v)*a+u*(1-v)*b+(1-u)*v*c+u*v*d
                 for a,b,c,d in zip(tl,tr,bl,br))


def palette_distance(a,b):
    """Symmetric mean closest-colour distance, actual occupied HEXs (0–1 OKLab)."""
    aa=[hex_to_lab(h) for h in a];bb=[hex_to_lab(h) for h in b]
    return (sum(min(distance(x,y) for y in bb) for x in aa)/len(aa)
            +sum(min(distance(x,y) for x in aa) for y in bb)/len(bb))/2


def colour_metrics(colors):
    labs=[hex_to_lab(h) for h in colors]
    chromas=[math.hypot(a,b) for _,a,b in labs]
    lightness=[l for l,_,_ in labs]
    hues=[math.degrees(math.atan2(b,a))%360 for (_,a,b),c in zip(labs,chromas) if c>=LOW_CHROMA]
    histogram=[0.]*12
    for (_,a,b),c in zip(labs,chromas):
        if c>=LOW_CHROMA:histogram[int((math.degrees(math.atan2(b,a))%360)//30)]+=c
    ordered_bins=sorted(range(12),key=lambda i:(-histogram[i],i))
    dominant=[i for i in ordered_bins if histogram[i]>0][:2]
    mean_l=sum(lightness)/len(labs);mean_c=sum(chromas)/len(labs)
    # Coarse semantic signature, not the level ID or exact colour values.
    light_class='dark' if mean_l<.48 else 'light' if mean_l>.72 else 'mid'
    c_class='soft' if mean_c<.07 else 'colourful' if mean_c<.115 else 'vivid'
    signature='-'.join(map(str,sorted(dominant)))+':'+light_class+':'+c_class
    hs=sorted(hues)
    coverage=360-max([b-a for a,b in zip(hs,hs[1:])]+[hs[0]+360-hs[-1]]) if len(hs)>1 else 0
    return {'meanChroma':round(mean_c,6),'minChroma':round(min(chromas),6),
            'maxChroma':round(max(chromas),6),'lowChromaThreshold':LOW_CHROMA,
            'lowChromaRatio':round(sum(c<LOW_CHROMA for c in chromas)/len(labs),6),
            'belowChroma007Ratio':round(sum(c<.07 for c in chromas)/len(labs),6),
            'vividChroma012Ratio':round(sum(c>=.12 for c in chromas)/len(labs),6),
            'meanLightness':round(mean_l,6),'lightnessRange':[round(min(lightness),6),round(max(lightness),6)],
            'hueBins30Degrees':[i for i in range(12) if histogram[i]>0],
            'chromaWeightedHueHistogram':[round(v/sum(histogram),6) if sum(histogram) else 0 for v in histogram],
            'hueCoverageDegrees':round(coverage,2),'dominantHueBins':dominant,'mainColourSignature':signature,
            'lightnessClass':light_class,'chromaClass':c_class,
            'scope':'descriptive actual 8-bit HEX metrics; not a human vision or display guarantee'}


@lru_cache(maxsize=1)
def load_recipes():
    source=json.loads(RECIPE_PATH.read_text(encoding='utf-8'))
    entries=source['palettes']
    if [p['number'] for p in entries]!=list(range(1,101)):
        raise ValueError('natural recipes must have numbered entries 1–100')
    return entries


def corner_candidates(seed_corners,number):
    """Seed first, then bounded, explicitly logged adjustments and permutations.

    The first stage only rearranges given colours. Next stages expand/contract
    their existing L/C and apply small independent L perturbations. No candidate
    switches to a generic family or rotates all seed hues.
    """
    seed_labs=[hex_to_lab(h) for h in seed_corners]
    permutations=list(itertools.permutations(range(4)))
    # Given order first; fixed lexicographic remainder is reproducible.
    mean_l=sum(p[0] for p in seed_labs)/4
    settings=[(1.,1.,0.),(1.12,1.,0.),(.9,1.1,0.),(1.25,1.,0.),
              (1.,1.15,0.),(1.35,.9,0.),(1.15,1.1,.035),
              (1.25,1.,.055),(1.4,.9,.075),(1.1,1.05,-.055)]
    for stage,(lscale,cscale,jitter) in enumerate(settings):
        for perm in permutations:
            corners=[]
            for i,j in enumerate(perm):
                L,a,b=seed_labs[j]
                # Non-uniform bounded offset changes the field's two axes,
                # instead of washing the whole board into a neutral centre.
                pattern=[-1,.45,.8,-.25]
                offset=jitter*pattern[(i+number)%4]
                resolved_l=L if stage==0 else max(.16,min(.94,mean_l+(L-mean_l)*lscale+offset))
                corners.append((resolved_l,a*cscale,b*cscale))
            yield corners,{'stage':stage,'seedCornerPermutation':list(perm),
                           'lightnessContrastScale':lscale,'seedChromaScale':cscale,
                           'lightnessJitterAmplitude':jitter,'hueAdjustmentDegrees':0,
                           'lightnessClamp':None if stage==0 else [.16,.94]}


def choose_palette(paths,number,anchors,shortcut_test,previous=None):
    recipe=load_recipes()[number-1]
    points=sorted(set(p for path in paths for p in path))
    w=max(x for x,y in points)+1;h=max(y for x,y in points)+1
    reasons=Counter();best=None;attempts=0
    for corners,adjustment in corner_candidates(recipe['cornersHex'],number):
        if best and adjustment['stage']>best[4]['stage']:
            break
        attempts+=1
        if number<=4:
            # Use two distinct natural seeds on the teaching path. Each recipe
            # still records all four; avoid invented neutral tutorial colours.
            labs={p:tuple(a+(b-a)*i/(len(paths[0])-1) for a,b in zip(corners[0],corners[1]))
                  for i,p in enumerate(paths[0])}
        else:
            labs={p:bilinear(corners,p[0]/(w-1),p[1]/(h-1)) for p in points}
        colors,scale=fit_palette(labs)
        if scale<.80:
            reasons['gamut-retention-below-0.80']+=1;continue
        values=list(colors.values());actual=[hex_to_lab(c) for c in values]
        minimum=min(distance(a,b) for i,a in enumerate(actual) for b in actual[i+1:])
        if minimum<MIN_PAIR+.0005:
            reasons['minimum-pair-delta']+=1;continue
        if len(set(values))<len(values):
            reasons['duplicate-hex']+=1;continue
        if number>=21 and not any(abs(a[0]-b[0])<.012 and distance(a,b)>.030 for i,a in enumerate(actual) for b in actual[i+1:]):
            reasons['missing-near-equal-lightness-pair']+=1;continue
        shortcut=shortcut_test(points,colors,anchors)
        if number>=41 and (shortcut['fullColourHitOrders'] or shortcut['movableColourHitOrders']):
            reasons['lightness-sorting-shortcut']+=1;continue
        metrics=colour_metrics(values)
        if metrics['meanChroma']<.045 or metrics['maxChroma']<.095 or metrics['lowChromaRatio']>.6:
            reasons['neutral-dominated-palette']+=1;continue
        previous_distance=None
        if previous:
            previous_distance=palette_distance(values,[c['targetHex'] for c in previous['cells']])
            if previous_distance<MIN_ADJACENT_PALETTE_DISTANCE:
                reasons['adjacent-palette-too-similar']+=1;continue
            if metrics['mainColourSignature']==previous['palette']['metrics']['mainColourSignature']:
                reasons['adjacent-main-colour-signature']+=1;continue
        # Preserve original seed orientation if it meets all requirements. Each
        # stage is searched fully to prefer strong separation and seed retention.
        score=minimum+.03*metrics['meanChroma']+.01*scale
        if best is None or score>best[0]:
            best=(score,colors,scale,corners,adjustment,metrics,previous_distance,attempts)
        if best and (attempts%24==0 or number<=4):
            break
    if best is None:
        raise ValueError(f'L{number:03} natural seed {recipe["themeName"]} has no valid bounded candidate; rejected={dict(reasons)}')
    _,colors,scale,corners,adjustment,metrics,previous_distance,accepted_attempt=best
    if number<=4:
        params={'method':'oklab-path-linear','endpointsLab':corners[:2]}
    else:
        params={'method':'oklab-bilinear-four-corners','cornersOrder':['topLeft','topRight','bottomLeft','bottomRight'],
                'cornersLab':corners,
                'fieldRule':'C(u,v)=(1-u)(1-v)TL+u(1-v)TR+(1-u)vBL+uvBR; u=x/(columns-1), v=y/(rows-1)',
                'twoAxisClues':'all rows and columns sample the same field; both axes must be continuous'}
    params.update({'recipeSource':'data/palettes/nature-palettes.v1.json','themeId':recipe['themeId'],
                   'themeName':recipe['themeName'],'family':recipe['family'],'mood':recipe['mood'],
                   'brief':recipe['brief'],'seedCornersHex':recipe['cornersHex'],
                   'actualCornersHex':[colors[p] for p in [(0,0),(w-1,0),(0,h-1),(w-1,h-1)]] if number>=5 else [colors[paths[0][0]],colors[paths[0][-1]]],
                   'selectionAttempt':accepted_attempt,'selectionCandidateCount':attempts,'adjustment':adjustment,
                   'rejectionCounts':dict(sorted(reasons.items())),
                   'commonChromaScale':scale,'gamutMapping':'one bounded common chroma scale >= 0.80 at fixed L; no local mapping, no RGB clipping',
                   'seedChromaRetention':round(adjustment['seedChromaScale']*scale,6),
                   'maxCornerDeltaEFromPermutedSeed':round(max(distance((c[0],c[1]*scale,c[2]*scale),hex_to_lab(recipe['cornersHex'][j])) for c,j in zip(corners,adjustment['seedCornerPermutation'])),6),
                   'encoding':'sRGB 8-bit HEX','reference':'https://bottosson.github.io/posts/oklab/',
                   'metrics':metrics,'distanceFromPrevious':round(previous_distance,6) if previous_distance is not None else None,
                   'reviewStatus':'candidate-pending-human-colour-review'})
    return colors,params


def field_diagnostics(paths,colors,params):
    actual={p:hex_to_lab(h) for p,h in colors.items()}
    path_error=0.
    for path in paths:
        a,b=actual[path[0]],actual[path[-1]]
        for i,p in enumerate(path):
            t=i/(len(path)-1)
            expected=tuple(x+(y-x)*t for x,y in zip(a,b))
            path_error=max(path_error,distance(actual[p],expected))
    if params['method']=='oklab-path-linear':
        a,b=params['endpointsLab']
        requested={p:tuple(x+(y-x)*i/(len(paths[0])-1) for x,y in zip(a,b)) for i,p in enumerate(paths[0])}
    else:
        w=max(x for x,y in colors)+1;h=max(y for x,y in colors)+1
        requested={p:bilinear(params['cornersLab'],p[0]/(w-1),p[1]/(h-1)) for p in colors}
    scale=params['commonChromaScale']
    quantisation=max(distance(actual[p],(v[0],v[1]*scale,v[2]*scale)) for p,v in requested.items())
    return {'localGamutMappingUsed':False,'allowedPathLinearityDeltaEOK':.004,
            'maxObservedPathLinearityDeltaEOK':round(path_error,8),
            'maxHexQuantisationDeltaEOK':round(quantisation,8),
            'scope':'one shared field; path deviation only arises from 8-bit HEX quantisation'}


def diversity_report(bank):
    levels=bank['levels']
    all_colors=[c['targetHex'] for l in levels for c in l['cells']]
    report={'contentVersion':bank['contentVersion'],'status':'candidate-human-colour-review-pending',
            'scope':'actual occupied HEXs; numeric palette variety and gamut screens, not human judgement',
            'screenPolicy':{'minimumPairDeltaEOK':MIN_PAIR,'minimumAdjacentSymmetricNearestDistance':MIN_ADJACENT_PALETTE_DISTANCE,
                            'minimumMeanChromaPerLevel':.045,'minimumMaxChromaPerLevel':.095,
                            'maximumLowChromaRatioPerLevel':.6,'lowChromaThreshold':LOW_CHROMA,
                            'minimumGamutRetention':.80,'localGamutMappingAllowed':False,
                            'minimumFamilyCount':12,'minimumChapterFamilyCount':10,
                            'adjacentFamilyMoodSignatureMustDiffer':True,
                            'humanReview':'pending; screens cannot certify attractive, unambiguous or accessible colour'},
            'globalMetrics':colour_metrics(all_colors),
            'familyCounts':dict(sorted(Counter(l['palette']['family'] for l in levels).items())),
            'moodCounts':dict(sorted(Counter(l['palette']['mood'] for l in levels).items())),
            'perChapter':[],'levels':[]}
    for ch in range(1,6):
        group=[l for l in levels if l['chapter']==ch]
        report['perChapter'].append({'chapter':ch,'familyCount':len(set(l['palette']['family'] for l in group)),
            'moodCount':len(set(l['palette']['mood'] for l in group)),
            'metrics':colour_metrics([c['targetHex'] for l in group for c in l['cells']]),
            'meanChromaRange':[min(l['palette']['metrics']['meanChroma'] for l in group),max(l['palette']['metrics']['meanChroma'] for l in group)],
            'meanLightnessRange':[min(l['palette']['metrics']['meanLightness'] for l in group),max(l['palette']['metrics']['meanLightness'] for l in group)],
            'vividLevels':[l['id'] for l in group if l['palette']['metrics']['meanChroma']>=.10],
            'darkLevels':[l['id'] for l in group if l['palette']['metrics']['meanLightness']<.53],
            'brightLevels':[l['id'] for l in group if l['palette']['metrics']['meanLightness']>.70]})
    for l in levels:
        p=l['palette']
        report['levels'].append({'id':l['id'],'themeName':p['themeName'],'family':p['family'],'mood':p['mood'],
                                 'seedCornersHex':p['seedCornersHex'],'actualCornersHex':p['actualCornersHex'],
                                 'commonChromaScale':p['commonChromaScale'],'adjustment':p['adjustment'],
                                 'distanceFromPrevious':p['distanceFromPrevious'],'fieldChecks':p['fieldChecks'],**p['metrics']})
    return report
