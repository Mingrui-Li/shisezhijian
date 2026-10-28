import { Color, EventTouch, Graphics, Label, Layers, Node, Tween, tween, UITransform } from 'cc';

export type TutorialControlBounds = { x: number; y: number; width: number; height: number };
export type TutorialOptions = {
    /** The demonstration never reads or writes a real level, wallet, or save. */
    onStart?: () => void;
    registerControl?: (label: string, invoke: () => void, bounds: TutorialControlBounds) => void;
    clearControls?: () => void;
    onText?: (text: string) => void;
    reducedMotion?: boolean;
};

const palette = {
    background: '#FFF9F1', ink: '#615147', muted: '#918177', white: '#FFFFFF',
    coral: '#EE8B75', mint: '#DBEFE6', lilac: '#EEE7F6', butter: '#FFF0C8',
    border: '#EDE3D9', line: '#C8D8CE', selection: '#7E9C8F',
};

/** Three looping native-Cocos demonstrations. No real gameplay state is involved. */
export class TutorialScreen {
    private root: Node;
    private page = 0;
    private disposed = false;
    private animationClock: { elapsed: number } | null = null;

    constructor(parent: Node, private height: number, private top: number, private bottom: number,
        private onExit: () => void, private options: TutorialOptions = {}) {
        this.root = new Node('TutorialScreen');
        this.root.layer = Layers.Enum.UI_2D;
        this.root.addComponent(UITransform).setContentSize(390, height);
        parent.addChild(this.root);
        this.render();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.stopAnimation();
        this.options.clearControls?.();
        this.root.removeFromParent();
        this.root.destroy();
    }

    private stopAnimation(): void {
        if (this.animationClock) Tween.stopAllByTarget(this.animationClock);
        this.animationClock = null;
    }

    private render(): void {
        if (this.disposed) return;
        this.stopAnimation();
        this.options.clearControls?.();
        for (const child of [...this.root.children]) { child.removeFromParent(); child.destroy(); }
        this.box(195, this.height / 2, 390, this.height, 0, palette.background);
        this.circle(340, this.top + 143, 67, '#FFF0E6');
        this.circle(37, this.height - this.bottom - 142, 61, '#F2F5E9');
        this.label('拾色小课堂', 195, this.top + 26, 240, 36, 23, palette.ink, true);
        this.iconButton('退出教程', 38, this.top + 26, () => this.onExit());
        for (let i = 0; i < 3; i++) {
            this.box(166 + i * 29, this.top + 71, i === this.page ? 26 : 8, 8, 4,
                i === this.page ? palette.coral : '#E8DFD3');
        }
        const titles = ['点选颜色，补全渐变', '轻点改放，轻点收回', '三个帮手，从容拾色'];
        const descriptions = ['点下方颜色，再点上方空位', '改放到空位 · 收回原来的候选槽', '通关得积分，在道具屋兑换'];
        this.label(titles[this.page], 195, this.top + 115, 342, 35, 22, palette.ink, true);
        this.label(descriptions[this.page], 195, this.top + 153, 342, 30, 14, palette.muted);
        const cardTop = this.top + 185;
        const cardBottom = this.height - this.bottom - 128;
        this.box(195, (cardTop + cardBottom) / 2, 342, cardBottom - cardTop, 28, palette.white);
        const boardY = cardTop + Math.min(84, (cardBottom - cardTop) * 0.24);
        const trayY = boardY + 123;
        if (this.page === 0) this.fillDemo(boardY, trayY, cardBottom);
        else if (this.page === 1) this.adjustDemo(boardY, trayY, cardBottom);
        else this.propsDemo(cardTop, cardBottom);
        this.footer();
    }

    private loop(duration: number, draw: (elapsed: number) => void): void {
        const clock = { elapsed: 0 };
        this.animationClock = clock;
        draw(0);
        // The only repeating work is owned by this clock and is stopped on every page change/dispose.
        tween(clock).to(duration, { elapsed: duration }, { onUpdate: () => {
            if (!this.disposed && this.root.isValid) draw(clock.elapsed);
        } }).call(() => { clock.elapsed = 0; draw(0); }).union().repeatForever().start();
    }

    private fillDemo(boardY: number, trayY: number, cardBottom: number): void {
        this.track([121, 195, 269], boardY);
        this.box(121, boardY, 66, 66, 12, '#DF6267');
        this.box(195, boardY, 66, 66, 12, '#FBF9F5', palette.border);
        this.box(269, boardY, 66, 66, 12, '#FFC18B');
        this.pin(121, boardY - 39); this.pin(269, boardY - 39);
        this.box(195, trayY, 100, 82, 24, '#F5F6EF');
        this.box(195, trayY, 58, 58, 12, '#ECEFE6');
        const selection = this.box(195, trayY, 76, 76, 17, palette.mint);
        const target = this.box(195, boardY, 76, 76, 17, palette.mint);
        // The moving copy is used only to explain a click; gameplay input itself remains tap-to-fill.
        const tile = this.box(195, trayY, 66, 66, 12, '#EF8C74');
        const hand = this.hand(211, trayY + 44);
        const hint = this.label('', 195, cardBottom - 29, 300, 30, 14, palette.selection, true);
        this.loop(5.6, t => {
            const flight = this.fraction(t, 2.0, 2.6);
            this.display(selection, t >= 0.6 && t < 2.0);
            this.display(target, t >= 1.5 && t < 2.7);
            this.place(tile, 195, trayY + (boardY - trayY) * (this.options.reducedMotion ? (t >= 2.3 ? 1 : 0) : flight));
            const handTravel = this.fraction(t, 0.9, 1.5);
            this.place(hand, 211, trayY + 44 + (boardY - trayY) * handTravel);
            this.display(hand, t < 2.7 && !this.options.reducedMotion, this.tapScale(t, [0.65, 1.75]));
            hint.string = t < 1.3 ? '① 点选颜色' : t < 2.7 ? '② 点上方空位' : '渐变完成';
        });
    }

    private adjustDemo(boardY: number, trayY: number, cardBottom: number): void {
        const xs = [92, 160, 228, 296];
        this.track(xs, boardY);
        xs.forEach((x, i) => this.box(x, boardY, 58, 58, 12,
            i === 0 ? '#65A0AB' : i === 3 ? '#E3EDCA' : '#FBF9F5', i === 1 || i === 2 ? palette.border : undefined));
        this.pin(xs[0], boardY - 35); this.pin(xs[3], boardY - 35);
        this.box(195, trayY, 100, 82, 24, '#F5F6EF');
        this.box(195, trayY, 58, 58, 12, '#ECEFE6', '#D4DECE');
        this.returnIcon(195, trayY, '#A2B1A3');
        const selection = this.box(160, boardY, 68, 68, 17, palette.mint);
        const destination = this.box(228, boardY, 68, 68, 17, palette.mint);
        const tile = this.box(160, boardY, 58, 58, 12, '#B9DCC8');
        const hand = this.hand(174, boardY + 41);
        const hint = this.label('', 195, cardBottom - 29, 310, 30, 14, palette.selection, true);
        this.loop(5.8, t => {
            const moving = this.fraction(t, 1.25, 1.8);
            const returning = this.fraction(t, 3.35, 4.0);
            let tileX = 160 + 68 * moving;
            let tileY = boardY;
            if (t >= 3.35) { tileX = 228 + (195 - 228) * returning; tileY += (trayY - boardY) * returning; }
            if (this.options.reducedMotion) {
                tileX = t < 1.55 ? 160 : t < 3.7 ? 228 : 195;
                tileY = t < 3.7 ? boardY : trayY;
            }
            this.place(tile, tileX, tileY);
            this.place(selection, t < 2.5 ? 160 : 228, boardY);
            this.display(selection, (t > 0.4 && t < 1.25) || (t > 2.5 && t < 3.35));
            this.place(destination, t < 2.5 ? 228 : 195, t < 2.5 ? boardY : trayY);
            this.display(destination, (t > 0.9 && t < 1.8) || (t > 3.0 && t < 4.0));
            let handX = t < 0.8 ? 174 : t < 2.5 ? 174 + 68 * this.fraction(t, 0.8, 1.2) : 242;
            let handY = boardY + 41;
            if (t >= 2.9) { const a = this.fraction(t, 2.9, 3.3); handX = 242 + (209 - 242) * a; handY += (trayY - boardY) * a; }
            this.place(hand, handX, handY);
            this.display(hand, t < 4.1 && !this.options.reducedMotion, this.tapScale(t, [0.5, 1.2, 2.65, 3.35]));
            hint.string = t < 2.4 ? '改放：点色块，再点空位' : t < 4.1 ? '收回：点色块，再点任意空槽' : '已收回待选区';
        });
    }

    private propsDemo(cardTop: number, cardBottom: number): void {
        const available = cardBottom - cardTop;
        const rowHeight = Math.min(88, (available - 36) / 3);
        const firstY = cardTop + 28 + rowHeight / 2;
        const rows = [
            { title: '点睛', detail: '自动填对并固定 1 块', color: palette.mint, icon: 'wand' },
            { title: '窥色', detail: '查看完整色带 3 秒', color: palette.lilac, icon: 'eye' },
            { title: '续时', detail: '本关倒计时增加 30 秒', color: palette.butter, icon: 'plus' },
        ] as const;
        const highlights: Node[] = [];
        rows.forEach((row, index) => {
            const y = firstY + index * rowHeight;
            highlights.push(this.box(195, y, 318, rowHeight - 5, 20, row.color));
            this.circle(72, y, 23, row.color); this.icon(row.icon, 72, y, palette.ink);
            this.label(row.title, 153, y - 13, 100, 28, 17, palette.ink, true);
            this.label(row.detail, 220, y + 13, 233, 27, 12, palette.muted);
        });
        const hand = this.hand(305, firstY + 15);
        const stars = [this.spark(300, firstY - 14, 7, '#DCA34B'),
            this.spark(313, firstY - 2, 4, '#DCA34B')];
        this.loop(5.7, t => {
            const row = Math.min(2, Math.floor(t / 1.9));
            const phase = (t % 1.9) / 1.9;
            highlights.forEach((node, i) => this.display(node, i === row, 1));
            const travel = this.options.reducedMotion ? row : Math.min(2, t / 1.9);
            this.place(hand, 305, firstY + Math.min(2, travel) * rowHeight + 15);
            this.display(hand, !this.options.reducedMotion, phase > 0.2 && phase < 0.42 ? 0.88 : 1);
            stars.forEach((star, i) => { this.place(star, 300 + i * 13, firstY + row * rowHeight - 14 + i * 12);
                this.display(star, phase > 0.42 && phase < 0.8, 0.7 + Math.sin(phase * Math.PI) * 0.4); });
        });
    }

    private fraction(t: number, start: number, end: number): number {
        const value = Math.max(0, Math.min(1, (t - start) / (end - start)));
        return value * value * (3 - 2 * value);
    }
    private tapScale(t: number, taps: number[]): number {
        if (this.options.reducedMotion) return 1;
        return taps.some(tap => Math.abs(t - tap) < 0.12) ? 0.87 : 1;
    }
    private place(node: Node, x: number, y: number): void { node.setPosition(x - 195, this.height / 2 - y); }
    private display(node: Node, visible: boolean, scale = 1): void {
        node.active = visible; node.setScale(scale, scale, 1);
    }
    private track(xs: number[], y: number): void {
        const g = this.shape(195, y); g.strokeColor = this.color(palette.line); g.lineWidth = 3;
        g.moveTo(xs[0] - 195, 0); g.lineTo(xs[xs.length - 1] - 195, 0); g.stroke();
    }

    private footer(): void {
        const y = this.height - this.bottom - 55;
        if (this.page > 0) this.button('上一步', 79, y, 108, 54, palette.white, palette.muted,
            () => { this.page--; this.render(); });
        this.button(this.page === 2 ? '开始拾色' : '下一步', this.page === 0 ? 195 : 252,
            y, this.page === 0 ? 276 : 214, 54, palette.coral, '#FFFFFF', () => {
                if (this.page === 2) (this.options.onStart ?? this.onExit)();
                else { this.page++; this.render(); }
            });
        this.label('自动循环演示 · 随时翻页', 195, this.height - this.bottom - 11, 342, 22, 11, palette.muted);
    }

    private node(name: string, x: number, y: number, width = 1, height = 1): Node {
        const node = new Node(name); node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(width, height);
        node.setPosition(x - 195, this.height / 2 - y); this.root.addChild(node); return node;
    }
    private color(hex: string): Color { return new Color().fromHEX(hex); }
    private shape(x: number, y: number): Graphics { return this.node('TutorialShape', x, y).addComponent(Graphics); }
    private box(x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string): Node {
        const g = this.shape(x, y); g.fillColor = this.color(fill);
        g.roundRect(-width / 2, -height / 2, width, height, Math.min(radius, height / 2)); g.fill();
        if (stroke) { g.strokeColor = this.color(stroke); g.lineWidth = 2; g.stroke(); }
        return g.node;
    }
    private circle(x: number, y: number, radius: number, fill: string): Node {
        const g = this.shape(x, y); g.fillColor = this.color(fill); g.circle(0, 0, radius); g.fill(); return g.node;
    }
    private label(text: string, x: number, y: number, width: number, height: number, size: number,
        color = palette.ink, bold = false): Label {
        this.options.onText?.(text);
        const label = this.node('TutorialText', x, y, width, height).addComponent(Label);
        label.string = text; label.useSystemFont = true; label.fontFamily = 'sans-serif';
        label.fontSize = size; label.lineHeight = size * 1.45; label.isBold = bold; label.color = this.color(color);
        label.horizontalAlign = Label.HorizontalAlign.CENTER; label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK; return label;
    }
    private hit(label: string, x: number, y: number, width: number, height: number, callback: () => void): void {
        const invoke = () => { if (!this.disposed) callback(); };
        this.node(label, x, y, width, height).on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true; invoke();
        });
        this.options.registerControl?.(label, invoke, { x, y, width, height });
    }
    private button(label: string, x: number, y: number, width: number, height: number, fill: string,
        color: string, callback: () => void): void {
        this.box(x, y, width, height, height / 2, fill);
        this.label(label, x, y, width - 12, height - 4, 17, color, true);
        this.hit(label, x, y, width, height, callback);
    }
    private iconButton(label: string, x: number, y: number, callback: () => void): void {
        this.circle(x, y, 23, palette.white); this.icon('close', x, y, palette.muted);
        this.hit(label, x, y, 46, 46, callback);
    }
    private pin(x: number, y: number): void {
        this.circle(x, y, 5, palette.white); this.circle(x, y, 2.7, '#9CA69B');
    }
    private spark(x: number, y: number, radius: number, color: string): Node {
        const g = this.shape(x, y); g.fillColor = this.color(color);
        g.moveTo(0, radius); g.lineTo(radius * 0.28, radius * 0.28); g.lineTo(radius, 0);
        g.lineTo(radius * 0.28, -radius * 0.28); g.lineTo(0, -radius);
        g.lineTo(-radius * 0.28, -radius * 0.28); g.lineTo(-radius, 0);
        g.lineTo(-radius * 0.28, radius * 0.28); g.close(); g.fill(); return g.node;
    }
    private hand(x: number, y: number): Node {
        const g = this.shape(x, y); g.strokeColor = this.color(palette.coral); g.lineWidth = 2.5;
        g.fillColor = this.color('#FFF4E9');
        g.moveTo(-5, -15); g.lineTo(-12, -3); g.bezierCurveTo(-15, 2, -10, 5, -7, 1);
        g.lineTo(-5, -1); g.lineTo(-5, 15); g.bezierCurveTo(-5, 21, 1, 21, 1, 15);
        g.lineTo(1, 6); g.bezierCurveTo(13, 10, 17, 2, 12, -12);
        g.lineTo(8, -19); g.lineTo(-1, -19); g.close(); g.fill(); g.stroke(); return g.node;
    }
    private returnIcon(x: number, y: number, color: string): void {
        const g = this.shape(x, y); g.strokeColor = this.color(color); g.lineWidth = 2;
        g.moveTo(-9, 6); g.lineTo(3, 6); g.bezierCurveTo(12, 6, 12, -8, 3, -8);
        g.moveTo(-4, 12); g.lineTo(-10, 6); g.lineTo(-4, 0); g.stroke();
    }
    private icon(kind: 'close' | 'wand' | 'eye' | 'plus', x: number, y: number, color: string): void {
        const g = this.shape(x, y); g.strokeColor = this.color(color); g.lineWidth = 2.6;
        if (kind === 'close') {
            g.moveTo(-6, -6); g.lineTo(6, 6); g.moveTo(-6, 6); g.lineTo(6, -6); g.stroke();
        } else if (kind === 'wand') {
            g.moveTo(-10, -11); g.lineTo(7, 8); g.stroke();
            this.spark(x + 8, y - 9, 6, color); this.spark(x - 5, y - 14, 3, color);
        } else if (kind === 'eye') {
            g.moveTo(-15, 0); g.bezierCurveTo(-6, 13, 6, 13, 15, 0);
            g.bezierCurveTo(6, -13, -6, -13, -15, 0); g.stroke();
            g.fillColor = this.color(color); g.circle(0, 0, 4.5); g.fill();
        } else {
            g.circle(0, 0, 13); g.moveTo(-6, 0); g.lineTo(6, 0); g.moveTo(0, -6); g.lineTo(0, 6); g.stroke();
        }
    }
}
