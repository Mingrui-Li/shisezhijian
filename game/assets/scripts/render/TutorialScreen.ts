import { Color, EventTouch, Graphics, Label, Layers, Node, UITransform } from 'cc';

export type TutorialControlBounds = { x: number; y: number; width: number; height: number };
export type TutorialOptions = {
    /** Defaults to returning home. No real level, inventory, or save is touched here. */
    onStart?: () => void;
    registerControl?: (label: string, invoke: () => void, bounds: TutorialControlBounds) => void;
    clearControls?: () => void;
    onText?: (text: string) => void;
};

const palette = {
    background: '#FFF9F1', ink: '#615147', muted: '#918177', white: '#FFFFFF',
    coral: '#EE8B75', coralPale: '#FFE7DD', mint: '#DBEFE6', lilac: '#EEE7F6',
    butter: '#FFF0C8', border: '#EDE3D9', line: '#C8D8CE', selection: '#7E9C8F',
};
type Tile = { color: string; home: number };

/** Standalone, native-Cocos practice scene; its tiny board is entirely local to this class. */
export class TutorialScreen {
    private root: Node;
    private page = 0;
    private disposed = false;
    private selected: { board: number } | { tray: number } | null = null;
    private board: (Tile | null)[] = [];
    private tray: (Tile | null)[] = [];
    private firstSolved = false;
    private practicedMove = false;
    private practicedReturn = false;
    private localMoves = 0;

    constructor(parent: Node, private height: number, private top: number, private bottom: number,
        private onExit: () => void, private options: TutorialOptions = {}) {
        this.root = new Node('TutorialScreen');
        this.root.layer = Layers.Enum.UI_2D;
        this.root.addComponent(UITransform).setContentSize(390, height);
        parent.addChild(this.root);
        this.resetPractice();
        this.render();
    }

    dispose(): void {
        if (this.disposed) return;
        this.disposed = true;
        this.root.removeFromParent();
        this.root.destroy();
    }

    private resetPractice(): void {
        this.selected = null;
        this.localMoves = 0;
        if (this.page === 0) {
            this.board = [null, null, null];
            this.tray = [{ color: '#EF8C74', home: 0 }];
            this.firstSolved = false;
        } else if (this.page === 1) {
            this.board = [null, { color: '#B9DCC8', home: 1 }, null, null];
            this.tray = [{ color: '#8EBDB9', home: 0 }, null];
            this.practicedMove = false;
            this.practicedReturn = false;
        }
    }

    private render(): void {
        if (this.disposed) return;
        this.options.clearControls?.();
        for (const child of [...this.root.children]) { child.removeFromParent(); child.destroy(); }
        this.box(195, this.height / 2, 390, this.height, 0, palette.background);
        this.circle(340, this.top + 143, 67, '#FFF0E6');
        this.circle(37, this.height - this.bottom - 142, 61, '#F2F5E9');
        this.label('拾色小课堂', 195, this.top + 26, 240, 36, 23, palette.ink, true);
        this.iconButton('退出教程', 38, this.top + 26, 'close', () => this.onExit());
        for (let i = 0; i < 3; i++) {
            this.box(166 + i * 29, this.top + 71, i === this.page ? 26 : 8, 8, 4,
                i === this.page ? palette.coral : '#E8DFD3');
        }
        const titles = ['点一下，颜色就到位', '想调整？轻轻点回来', '需要时，借一点小帮手'];
        const descriptions = [
            '先点下方色块，再点上方空位。\n试着补全这条渐变吧。',
            '点已填色块，再点空位改放。\n点它原来的候选槽，还能免费收回。',
            '先享受颜色，再慢慢挑战。\n每个道具都会清楚说明效果。',
        ];
        this.label(titles[this.page], 195, this.top + 121, 342, 35, 23, palette.ink, true);
        this.label(descriptions[this.page], 195, this.top + 164, 334, 51, 15, palette.muted);
        if (this.page < 2) this.practice();
        else this.helpers();
        this.footer();
    }

    private practice(): void {
        const cardTop = this.top + 207;
        const cardBottom = this.height - this.bottom - 129;
        const cardHeight = cardBottom - cardTop;
        const boardY = cardTop + cardHeight * 0.23;
        const trayY = cardTop + cardHeight * 0.73;
        this.box(195, (cardTop + cardBottom) / 2, 342, cardHeight, 28, palette.white);
        const size = this.page === 0 ? 66 : 57;
        const pitch = size + 8;
        const count = this.page === 0 ? 3 : 4;
        const startX = 195 - (count - 1) * pitch / 2;
        const anchors = this.page === 0 ? ['#DF6267', '#FFC18B'] : ['#65A0AB', '#E3EDCA'];
        const g = this.shape(195, boardY);
        g.strokeColor = this.color(palette.line); g.lineWidth = 3;
        g.moveTo(startX - 195, 0); g.lineTo(startX + (count - 1) * pitch - 195, 0); g.stroke();
        for (let index = 0; index < count; index++) {
            const x = startX + index * pitch;
            if (index === 0 || index === count - 1) {
                this.box(x, boardY, size, size, 12, anchors[index === 0 ? 0 : 1]);
                this.pin(x, boardY - size / 2 - 7);
            } else {
                const tile = this.board[index];
                const selected = this.selected !== null && 'board' in this.selected && this.selected.board === index;
                if (selected) this.box(x, boardY, size + 10, size + 10, 16, palette.mint);
                this.box(x, boardY, size, size, 12, tile?.color ?? '#FBF9F5', tile ? undefined : palette.border);
                this.hit(`教程上方${tile ? '色块' : '空槽'} ${index}`, x, boardY, size + 6, size + 6,
                    () => this.tapBoard(index));
                if (!tile && this.selected) this.spark(x, boardY, 8, palette.selection);
            }
        }
        this.label('固定颜色', startX, boardY + size / 2 + 24, 90, 24, 11, palette.muted);
        this.box(195, trayY, this.page === 0 ? 102 : 174, 82, 24, '#F5F6EF');
        for (let index = 0; index < this.tray.length; index++) {
            const x = 195 + (index - (this.tray.length - 1) / 2) * 74;
            const tile = this.tray[index];
            const selected = this.selected !== null && 'tray' in this.selected && this.selected.tray === index;
            const canReturn = !tile && this.selected !== null && 'board' in this.selected
                && this.board[this.selected.board]?.home === index;
            if (selected || canReturn) this.box(x, trayY, 68, 68, 17, palette.mint);
            this.box(x, trayY, 57, 57, 12, tile?.color ?? '#ECEFE6', tile ? undefined : '#D4DECE');
            this.hit(tile ? `教程候选色块 ${index + 1}` : `教程原候选空槽 ${index + 1}`, x, trayY, 68, 68,
                () => this.tapTray(index));
            if (!tile) this.returnIcon(x, trayY, '#A2B1A3');
        }
        const completed = this.page === 0 ? this.firstSolved : this.practicedMove && this.practicedReturn;
        if (completed) {
            this.tick(166, cardTop + cardHeight * 0.49, palette.selection);
            this.label(this.page === 0 ? '这条渐变，完成啦' : '改放、收回，都掌握啦', 211,
                cardTop + cardHeight * 0.49, 202, 28, 15, palette.selection, true);
        } else {
            const targetIsBoard = this.page === 0 ? this.selected !== null
                : !this.practicedMove;
            const handY = Math.min(cardBottom - 58, (targetIsBoard ? boardY : trayY) + size / 2 + 33);
            const handX = this.page === 0 ? 210 : (this.practicedMove ? 247 : 173);
            this.hand(handX, handY, palette.coral);
            if (this.page === 1) {
                this.box(195, cardTop + cardHeight * 0.49, 190, 30, 15, '#F6F5EE');
                this.label(this.practicedMove ? '再试试收回原候选槽' : '先把已填色块改放到空位',
                    195, cardTop + cardHeight * 0.49, 206, 27, 12, palette.muted);
            }
        }
        const detail = this.page === 0 ? '选中后再点一次，可以取消'
            : `本次练习用了 ${this.localMoves} 步 · 收回不返还已用步数`;
        this.label(detail, 195, cardBottom - 21, 310, 24, 11, palette.muted);
    }

    private tapBoard(index: number): void {
        if (this.board[index]) {
            this.selected = this.selected !== null && 'board' in this.selected && this.selected.board === index
                ? null : { board: index };
        } else if (this.selected !== null && 'tray' in this.selected) {
            const home = this.selected.tray;
            this.board[index] = this.tray[home];
            this.tray[home] = null;
            this.selected = null;
            this.localMoves++;
            if (this.page === 0) this.firstSolved = true;
        } else if (this.selected !== null && 'board' in this.selected) {
            this.board[index] = this.board[this.selected.board];
            this.board[this.selected.board] = null;
            this.selected = null;
            this.localMoves++;
            if (this.page === 1) this.practicedMove = true;
        }
        this.render();
    }

    private tapTray(index: number): void {
        if (this.tray[index]) {
            this.selected = this.selected !== null && 'tray' in this.selected && this.selected.tray === index
                ? null : { tray: index };
        } else if (this.selected !== null && 'board' in this.selected) {
            const tile = this.board[this.selected.board];
            if (tile?.home === index) {
                this.tray[index] = tile;
                this.board[this.selected.board] = null;
                this.selected = null;
                if (this.page === 0) this.firstSolved = false;
                if (this.page === 1) this.practicedReturn = true;
            }
        }
        this.render();
    }

    private helpers(): void {
        const firstY = this.top + 245;
        const available = this.height - this.bottom - 126 - (this.top + 204);
        const rowHeight = Math.min(88, (available - 76) / 3);
        const rows = [
            { title: '点睛', detail: '帮一块颜色找到位置', color: palette.mint, icon: 'wand' },
            { title: '窥色', detail: '看一眼完整色带，持续 3 秒', color: palette.lilac, icon: 'eye' },
            { title: '续步', detail: '再添 5 步，接着慢慢想', color: palette.butter, icon: 'plus' },
        ] as const;
        rows.forEach((row, index) => {
            const y = firstY + index * rowHeight;
            this.box(195, y, 342, rowHeight - 9, 22, palette.white);
            this.circle(70, y, 25, row.color);
            this.icon(row.icon, 70, y, palette.ink);
            this.label(row.title, 188, y - 12, 168, 27, 17, palette.ink, true);
            this.label(row.detail, 213, y + 14, 225, 25, 12, palette.muted);
        });
        const y = firstY + 3 * rowHeight + 4;
        this.box(195, y, 342, 64, 22, '#F3F3E9');
        this.label('放入 / 改放  1 步', 195, y - 12, 304, 23, 14, palette.ink, true);
        this.label('收回免费 · 选中免费 · 用完可重来', 195, y + 13, 310, 23, 12, palette.muted);
    }

    private footer(): void {
        const y = this.height - this.bottom - 55;
        const canContinue = this.page === 2 || (this.page === 0 ? this.firstSolved : this.practicedMove && this.practicedReturn);
        if (this.page > 0) this.button('上一步', 79, y, 108, 54, palette.white, palette.muted,
            () => { this.page--; this.resetPractice(); this.render(); });
        const nextX = this.page === 0 ? 195 : 252;
        const nextWidth = this.page === 0 ? 276 : 214;
        this.button(this.page === 2 ? '开始拾色' : '下一步', nextX, y, nextWidth, 54,
            canContinue ? palette.coral : '#F0E4DB', canContinue ? '#FFFFFF' : '#B6A89C',
            canContinue ? () => {
                if (this.page === 2) { (this.options.onStart ?? this.onExit)(); return; }
                this.page++; this.resetPractice(); this.render();
            } : undefined);
        this.label('教程练习不会消耗道具或影响进度', 195, this.height - this.bottom - 11, 342, 22, 11, palette.muted);
    }

    private node(name: string, x: number, y: number, width = 1, height = 1): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.UI_2D;
        node.addComponent(UITransform).setContentSize(width, height);
        node.setPosition(x - 195, this.height / 2 - y);
        this.root.addChild(node);
        return node;
    }

    private color(hex: string): Color { return new Color().fromHEX(hex); }
    private shape(x: number, y: number): Graphics { return this.node('TutorialShape', x, y).addComponent(Graphics); }
    private box(x: number, y: number, width: number, height: number, radius: number, fill: string, stroke?: string): void {
        const g = this.shape(x, y);
        g.fillColor = this.color(fill);
        g.roundRect(-width / 2, -height / 2, width, height, Math.min(radius, height / 2));
        g.fill();
        if (stroke) { g.strokeColor = this.color(stroke); g.lineWidth = 2; g.stroke(); }
    }
    private circle(x: number, y: number, radius: number, fill: string): void {
        const g = this.shape(x, y); g.fillColor = this.color(fill); g.circle(0, 0, radius); g.fill();
    }
    private label(text: string, x: number, y: number, width: number, height: number, size: number,
        color = palette.ink, bold = false): void {
        this.options.onText?.(text);
        const label = this.node('TutorialText', x, y, width, height).addComponent(Label);
        label.string = text;
        label.useSystemFont = true; label.fontFamily = 'sans-serif';
        label.fontSize = size; label.lineHeight = size * 1.45;
        label.isBold = bold; label.color = this.color(color);
        label.horizontalAlign = Label.HorizontalAlign.CENTER;
        label.verticalAlign = Label.VerticalAlign.CENTER;
        label.overflow = Label.Overflow.SHRINK;
    }
    private hit(label: string, x: number, y: number, width: number, height: number, callback: () => void): void {
        const invoke = () => { if (!this.disposed) callback(); };
        this.node(label, x, y, width, height).on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true; invoke();
        });
        this.options.registerControl?.(label, invoke, { x, y, width, height });
    }
    private button(label: string, x: number, y: number, width: number, height: number, fill: string,
        color: string, callback?: () => void): void {
        this.box(x, y, width, height, height / 2, fill);
        this.label(label, x, y, width - 12, height - 4, 17, color, true);
        if (callback) this.hit(label, x, y, width, height, callback);
    }
    private iconButton(label: string, x: number, y: number, icon: 'close', callback: () => void): void {
        this.circle(x, y, 23, palette.white); this.icon(icon, x, y, palette.muted);
        this.hit(label, x, y, 46, 46, callback);
    }
    private pin(x: number, y: number): void {
        this.circle(x, y, 5, palette.white); this.circle(x, y, 2.7, '#9CA69B');
    }
    private tick(x: number, y: number, color: string): void {
        const g = this.shape(x, y); g.strokeColor = this.color(color); g.lineWidth = 3;
        g.moveTo(-6, 0); g.lineTo(-1, -5); g.lineTo(8, 6); g.stroke();
    }
    private spark(x: number, y: number, radius: number, color: string): void {
        const g = this.shape(x, y); g.fillColor = this.color(color);
        g.moveTo(0, radius); g.lineTo(radius * 0.28, radius * 0.28); g.lineTo(radius, 0);
        g.lineTo(radius * 0.28, -radius * 0.28); g.lineTo(0, -radius);
        g.lineTo(-radius * 0.28, -radius * 0.28); g.lineTo(-radius, 0);
        g.lineTo(-radius * 0.28, radius * 0.28); g.close(); g.fill();
    }
    private hand(x: number, y: number, color: string): void {
        const g = this.shape(x, y); g.strokeColor = this.color(color); g.lineWidth = 2.5;
        g.fillColor = this.color('#FFF4E9');
        g.moveTo(-5, -15); g.lineTo(-12, -3); g.bezierCurveTo(-15, 2, -10, 5, -7, 1);
        g.lineTo(-5, -1); g.lineTo(-5, 15); g.bezierCurveTo(-5, 21, 1, 21, 1, 15);
        g.lineTo(1, 6); g.bezierCurveTo(13, 10, 17, 2, 12, -12);
        g.lineTo(8, -19); g.lineTo(-1, -19); g.close(); g.fill(); g.stroke();
        g.moveTo(-9, 22); g.lineTo(-13, 27); g.moveTo(1, 27); g.lineTo(1, 32);
        g.moveTo(11, 23); g.lineTo(15, 27); g.stroke();
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
