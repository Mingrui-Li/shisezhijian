#!/usr/bin/env python3
"""Render exact exported HEX colours as review figures; no image-model input.

Requires Pillow for documentation PNGs. Level generation remains standard-library
only. These figures are colour-content reviews, not browser/game screenshots.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


def font(size: int, bold: bool = False):
    names = [
        '/System/Library/Fonts/STHeiti Medium.ttc' if bold else '/System/Library/Fonts/STHeiti Light.ttc',
        '/System/Library/Fonts/Supplemental/Arial Unicode.ttf',
        '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf',
    ]
    for name in names:
        if Path(name).is_file():
            return ImageFont.truetype(name, size)
    return ImageFont.load_default(size=size)


def lab(value: str):
    def linear(n):
        n = int(n, 16) / 255
        return n / 12.92 if n <= .04045 else ((n + .055) / 1.055) ** 2.4
    r, g, b = (linear(value[i:i + 2]) for i in (1, 3, 5))
    l = (.4122214708 * r + .5363325363 * g + .0514459929 * b) ** (1 / 3)
    m = (.2119034982 * r + .6806995451 * g + .1073969566 * b) ** (1 / 3)
    s = (.0883024619 * r + .2817188376 * g + .6299787005 * b) ** (1 / 3)
    return (.2104542553 * l + .7936177850 * m - .0040720468 * s,
            1.9779984951 * l - 2.4285922050 * m + .4505937099 * s,
            .0259040371 * l + .7827717662 * m - .8086757660 * s)


def nature(level):
    palette = level.get('palette', {})
    for key in ('artDirection', 'nature', 'natureTheme', 'theme'):
        item = palette.get(key)
        if isinstance(item, dict):
            return item
    return palette


def draw_board(draw, level, box):
    x, y, width, height = box
    columns, rows = level['grid']['columns'], level['grid']['rows']
    pitch = min(width / columns, height / rows)
    gap = max(2, round(pitch * .105))
    size = round(pitch) - gap
    left = round(x + (width - columns * pitch + gap) / 2)
    top = round(y + (height - rows * pitch + gap) / 2)
    cells = {c['id']: c for c in level['cells']}
    centres = {i: (round(left + c['x'] * pitch + size / 2),
                   round(top + c['y'] * pitch + size / 2)) for i, c in cells.items()}
    edges = set()
    for path in level['paths']:
        for a, b in zip(path['cellIds'], path['cellIds'][1:]):
            edge = tuple(sorted((a, b)))
            if edge not in edges:
                draw.line((*centres[a], *centres[b]), fill='#A4ADA8', width=max(1, gap // 2))
                edges.add(edge)
    for c in cells.values():
        bx, by = round(left + c['x'] * pitch), round(top + c['y'] * pitch)
        draw.rectangle((bx, by, bx + size - 1, by + size - 1), fill=c['targetHex'])
        if c['id'] in level['anchors']:
            radius = max(2, min(4, size // 10))
            px, py = bx + size - radius - 1, by - 1
            draw.ellipse((px - radius - 1, py - radius - 1, px + radius + 1, py + radius + 1), fill='#FAFAF8')
            draw.ellipse((px - radius, py - radius, px + radius, py + radius), fill='#334E47')


def metrics(bank):
    chapters = []
    for ch in range(1, 6):
        levels = [l for l in bank['levels'] if l['chapter'] == ch]
        labs = [lab(c['targetHex']) for l in levels for c in l['cells']]
        chromas = [math.hypot(a, b) for _, a, b in labs]
        chapters.append({
            'chapter': ch,
            'levelCount': len(levels),
            'meanChromaOKLCH': round(sum(chromas) / len(chromas), 6),
            'fractionChromaBelow0_07': round(sum(c < .07 for c in chromas) / len(chromas), 6),
            'fractionChromaAtLeast0_12': round(sum(c >= .12 for c in chromas) / len(chromas), 6),
            'lightnessRange': [round(min(v[0] for v in labs), 6), round(max(v[0] for v in labs), 6)],
        })
    return {'contentVersion': bank['contentVersion'], 'chapters': chapters,
            'note': 'Chroma thresholds describe these exports; they are not universal aesthetic or human-vision thresholds.'}


def overview(bank, out):
    width, header, card_w, card_h, gap, columns = 2400, 120, 222, 244, 16, 10
    rows = math.ceil(len(bank['levels']) / columns)
    image = Image.new('RGB', (width, header + rows * (card_h + gap) + 40), '#EEEFE9')
    draw = ImageDraw.Draw(image)
    draw.text((28, 22), '拾色之间 · 百关自然色谱', font=font(35, True), fill='#263E36')
    draw.text((30, 70), '真实导出 HEX · 作者答案总览（非游戏开局）· 人工 / 真机配色审阅待完成', font=font(20), fill='#63716A')
    for n, level in enumerate(bank['levels']):
        x, y = 24 + (n % columns) * (card_w + gap), header + (n // columns) * (card_h + gap)
        draw.rounded_rectangle((x, y, x + card_w, y + card_h), radius=10, fill='#FCFCF9')
        draw.text((x + 10, y + 10), f"{level['id']} {level['title']}", font=font(15, True), fill='#263E36')
        info = nature(level)
        theme = str(info.get('themeName', info.get('name', '')))
        if theme:
            draw.text((x + 10, y + 32), theme[:13], font=font(13), fill='#67766E')
        draw_board(draw, level, (x + 12, y + 58, card_w - 24, 170))
    image.save(out)


def opening_review(bank,out):
    chosen=[bank['levels'][n-1] for n in [3,20,72,100]]
    image=Image.new('RGB',(1440,1510),'#F8F6EF');draw=ImageDraw.Draw(image)
    draw.text((30,20),'点击补色 · 初始空槽与固定候选槽',font=font(30,True),fill='#334A49')
    draw.text((30,66),'实际导出HEX布局审阅图 · 作者工具示意 · 非游戏截图 / 非真机验收',font=font(18),fill='#617574')
    for i,level in enumerate(chosen):
        x=24+(i%2)*708;y=110+(i//2)*695
        draw.rounded_rectangle((x,y,x+684,y+675),radius=18,fill='#FFFFFF')
        draw.text((x+20,y+16),f"{level['id']} {level['title']}",font=font(22,True),fill='#334A49')
        n=len(level['initialPool']);b=level['challenge']['moveBudget']
        draw.text((x+20,y+50),f"上方：固定锚点＋空槽   N={n}   B={b if b is not None else '不限'}",font=font(17),fill='#627B76')
        pitch=43;size=38;w=level['grid']['columns'];h=level['grid']['rows']
        left=x+(684-w*pitch)//2;top=y+88
        by={c['id']:c for c in level['cells']}
        for path in level['paths']:
            for a,bid in zip(path['cellIds'],path['cellIds'][1:]):
                a=by[a];bcell=by[bid]
                draw.line((left+a['x']*pitch+size//2,top+a['y']*pitch+size//2,left+bcell['x']*pitch+size//2,top+bcell['y']*pitch+size//2),fill='#B4C9C1',width=3)
        for c in level['cells']:
            bx=left+c['x']*pitch;byy=top+c['y']*pitch
            colour=c['targetHex'] if c['id'] in level['anchors'] else '#ECEFEB'
            draw.rounded_rectangle((bx,byy,bx+size-1,byy+size-1),radius=5,fill=colour)
            if c['id'] in level['anchors']:draw.ellipse((bx+30,byy-3,bx+38,byy+5),fill='#427868',outline='white',width=1)
        pool_top=y+380
        draw.text((x+20,pool_top-30),'下方：候选区第1页（固定空位不重排）',font=font(17),fill='#627B76')
        tiles={t['id']:t for t in level['tiles']}
        left=x+(684-6*pitch)//2
        for home,tile in enumerate(level['initialPool'][:18]):
            bx=left+(home%6)*pitch;byy=pool_top+(home//6)*pitch
            draw.rounded_rectangle((bx,byy,bx+size-1,byy+size-1),radius=5,fill=tiles[tile]['hex'])
        draw.text((x+20,y+535),f"先点候选色，再点空槽 · 共{math.ceil(n/18)}页 · {n}个固定候选槽",font=font(17),fill='#627B76')
        draw.text((x+20,y+572),'已放颜色可免费取回；移到另一空槽扣1步',font=font(17),fill='#627B76')
        draw.text((x+20,y+609),'占用目标不可覆盖 · 答案仅在作者图鉴可切换',font=font(17),fill='#627B76')
    image.save(out)


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--data',type=Path,default=Path('data/levels/levels.v0.4.json'))
    parser.add_argument('--out',type=Path,default=Path('assets/reviews/colors'))
    args=parser.parse_args();bank=json.loads(args.data.read_text());args.out.mkdir(parents=True,exist_ok=True)
    overview(bank,args.out/'nature-colors-100-v0.4.png')
    opening_review(bank,args.out/'click-fill-openings-v0.4.png')
    (args.out/'nature-colors-metrics-v0.4.json').write_text(json.dumps(metrics(bank),ensure_ascii=False,indent=2)+'\n')
    print(json.dumps({'data':str(args.data),'output':str(args.out),'figures':'exact target overview and click-fill openings; no browser/device capture'},ensure_ascii=False))


if __name__=='__main__':main()
