import {
  BlockInputEvents, Color, EventTouch, Graphics, Label, Layers, Node,
  Sprite, SpriteFrame, UITransform,
} from 'cc';

export interface WinPanelOptions {
  parent: Node;
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
  score: number;
  pointsEarned: number;
  elapsedMs: number;
  movesSpent: number;
  levelNumber: number;
  levelTitle: string;
  /** True when this completion can still request the one-time extra reward. */
  doubleAvailable: boolean;
  onDouble: () => void;
  onNext: () => void;
  onHome: () => void;
  /** Transparent celebration artwork; fitted with contain and never stretched. */
  artwork?: SpriteFrame | null;
  registerControl?: (label: string, invoke: () => void,
    bounds: { x: number; y: number; width: number; height: number }) => void;
  onText?: (value: string) => void;
}

const C = {
  ink: '#655148', muted: '#9B8779', white: '#FFFEFB', coral: '#EC8D76',
  mint: '#EAF4E9', green: '#648770', gold: '#FFF0C4', goldInk: '#97702E',
};

/** A self-contained native victory composition, with no gameplay or reward mutations. */
export class WinPanel {
  readonly node: Node;
  private disposed = false;
  private readonly cardWidth: number;

  constructor(private readonly options: WinPanelOptions) {
    const { parent, width, height, safeTop, safeBottom } = options;
    this.node = new Node('WinPanel');
    this.node.layer = Layers.Enum.UI_2D;
    this.node.addComponent(UITransform).setContentSize(width, height);
    parent.addChild(this.node);
    this.node.setPosition(0, 0);
    this.node.addComponent(BlockInputEvents);
    const scrim = this.element('WinBackdrop', width / 2, height / 2, width + 2, height + 2);
    const backdrop = scrim.addComponent(Graphics);
    backdrop.fillColor = new Color(79, 66, 55, 92);
    backdrop.rect(-width / 2 - 1, -height / 2 - 1, width + 2, height + 2);
    backdrop.fill();

    const hasDouble = options.doubleAvailable && options.pointsEarned > 0;
    const available = Math.max(360, height - safeTop - safeBottom);
    // The smallest supported safe area (694 - 71 - 46) still fits a 553-high card.
    const cardHeight = Math.min(hasDouble ? 588 : 530, available - 24);
    this.cardWidth = Math.min(344, width - 36);
    const left = (width - this.cardWidth) / 2;
    const top = safeTop + (available - cardHeight) / 2;
    const centerX = width / 2;
    const centerY = top + cardHeight / 2;
    this.round('CardShadowWide', centerX, centerY + 9, this.cardWidth + 2, cardHeight, 32, new Color(67, 49, 34, 12));
    this.round('CardShadow', centerX, centerY + 4, this.cardWidth, cardHeight, 32, new Color(100, 72, 46, 14));
    this.round('VictoryCard', centerX, centerY, this.cardWidth, cardHeight, 32, C.white);

    // Only the illustration compresses on short screens; body type and hit areas remain readable.
    const heroHeight = Math.max(64, Math.min(150, cardHeight - (hasDouble ? 458 : 400)));
    const heroY = top + 14 + heroHeight / 2;
    if (options.artwork) this.artwork(options.artwork, centerX, heroY, this.cardWidth - 34, heroHeight);
    else this.fallbackArt(centerX, heroY, heroHeight);
    const titleY = top + 14 + heroHeight + 18;
    this.label('渐变完成', centerX, titleY, this.cardWidth - 40, 34, 25, C.ink, true);
    this.label(`第 ${options.levelNumber} 关 · ${options.levelTitle}`, centerX,
      titleY + 31, this.cardWidth - 40, 22, 12, C.muted);

    const scoreY = titleY + 90;
    const safeScore = Math.max(0, Math.round(Number.isFinite(options.score) ? options.score : 0));
    this.label(String(safeScore), centerX - 8, scoreY, 208, 88, 72, C.ink, true);
    this.label('分', centerX + 82, scoreY + 19, 28, 28, 15, C.muted);
    const pointsY = scoreY + 69;
    const earned = Math.max(0, Math.round(options.pointsEarned));
    this.round('PointsReceipt', centerX, pointsY, this.cardWidth - 48, 42, 15, C.mint);
    this.coin(left + 52, pointsY, 10);
    this.label('积分到账', centerX - 48, pointsY, 94, 28, 13, C.green);
    this.label(`+${earned}`, centerX + 75, pointsY, 106, 32, 21, C.green, true);

    const statsY = pointsY + 53;
    const statsWidth = (this.cardWidth - 58) / 2;
    this.label('用时', centerX - 72, statsY - 12, statsWidth, 20, 12, C.muted);
    this.label(this.formatTime(options.elapsedMs), centerX - 72, statsY + 11,
      statsWidth, 28, 19, C.ink, true);
    this.label('操作', centerX + 72, statsY - 12, statsWidth, 20, 12, C.muted);
    this.label(`${Math.max(0, Math.round(options.movesSpent))} 次`, centerX + 72, statsY + 11,
      statsWidth, 28, 19, C.ink, true);
    const divider = this.element('StatisticsDivider', centerX, statsY, 1, 30).addComponent(Graphics);
    divider.strokeColor = this.color('#EFE8DE'); divider.lineWidth = 1;
    divider.moveTo(0, -15); divider.lineTo(0, 15); divider.stroke();

    let nextY = statsY + 64;
    if (hasDouble) {
      const adY = statsY + 64;
      this.button('看视频双倍积分', centerX, adY, this.cardWidth - 48, 48,
        C.gold, () => options.onDouble());
      this.play(centerX - 101, adY, C.goldInk);
      this.label('看视频双倍', centerX - 26, adY, 120, 30, 15, C.goldInk, true);
      this.label(`再得 ${earned}`, centerX + 83, adY, 92, 30, 14, C.goldInk, true);
      nextY += 58;
    }
    const nextLabel = options.levelNumber >= 100 ? '返回关卡' : '下一关';
    this.round('PrimaryButtonShadow', centerX, nextY + 4, this.cardWidth - 48, 54, 20, '#DEAD97');
    this.button(nextLabel, centerX, nextY, this.cardWidth - 48, 54,
      C.coral, () => options.onNext());
    this.label(nextLabel, centerX - 5, nextY, this.cardWidth - 104, 32, 18, '#FFFFFF', true);
    this.chevron(centerX + 102, nextY, '#FFFFFF');
    const homeY = nextY + 54;
    this.label('返回首页', centerX, homeY, 180, 26, 13, C.muted);
    this.hit('返回首页', centerX, homeY, 180, 44, () => options.onHome());
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.node.isValid) { this.node.removeFromParent(); this.node.destroy(); }
  }

  private formatTime(value: number): string {
    const seconds = Math.max(0, Math.floor((Number.isFinite(value) ? value : 0) / 1000));
    return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
  }

  private artwork(frame: SpriteFrame, x: number, y: number, maxWidth: number, maxHeight: number): void {
    const node = this.element('VictoryIllustration', x, y, maxWidth, maxHeight);
    const sprite = node.addComponent(Sprite);
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = frame;
    const source = frame.originalSize;
    const scale = Math.min(maxWidth / Math.max(1, source.width), maxHeight / Math.max(1, source.height));
    node.getComponent(UITransform)!.setContentSize(source.width * scale, source.height * scale);
  }

  private fallbackArt(x: number, y: number, height: number): void {
    const scale = Math.min(1, height / 115);
    const g = this.element('CelebrationFallback', x, y, 240, height).addComponent(Graphics);
    g.fillColor = this.color('#FFF2D8'); g.ellipse(0, -7 * scale, 99 * scale, 45 * scale); g.fill();
    const colors = ['#F4B37F', '#E7B8C9', '#BDC5DE', '#A5D2BD', '#F2D690'];
    colors.forEach((hex, i) => {
      g.fillColor = this.color(hex);
      g.roundRect((i - 2) * 35 * scale - 15 * scale, -14 * scale + Math.abs(i - 2) * 8 * scale,
        30 * scale, 30 * scale, 8 * scale); g.fill();
    });
    this.spark(x - 76 * scale, y - 35 * scale, 7 * scale, '#DEAE59');
    this.spark(x + 82 * scale, y - 20 * scale, 6 * scale, '#D7B0C7');
    this.spark(x + 40 * scale, y - 46 * scale, 5 * scale, '#DEAE59');
  }

  private element(name: string, x: number, y: number, width = 1, height = 1): Node {
    const node = new Node(name); node.layer = Layers.Enum.UI_2D;
    node.addComponent(UITransform).setContentSize(width, height);
    node.setPosition(x - this.options.width / 2, this.options.height / 2 - y);
    this.node.addChild(node); return node;
  }
  private color(value: string | Color): Color { return typeof value === 'string' ? new Color().fromHEX(value) : value; }
  private round(name: string, x: number, y: number, width: number, height: number,
    radius: number, fill: string | Color): Node {
    const node = this.element(name, x, y, width, height);
    const g = node.addComponent(Graphics); g.fillColor = this.color(fill);
    g.roundRect(-width / 2, -height / 2, width, height, radius); g.fill(); return node;
  }
  private label(value: string, x: number, y: number, width: number, height: number,
    fontSize: number, hex: string, bold = false): void {
    this.options.onText?.(value);
    const label = this.element('VictoryText', x, y, width, height).addComponent(Label);
    label.string = value; label.useSystemFont = true; label.fontFamily = 'sans-serif';
    label.fontSize = fontSize; label.lineHeight = fontSize * 1.2; label.isBold = bold;
    label.color = this.color(hex); label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER; label.enableWrapText = false;
    label.overflow = Label.Overflow.SHRINK;
  }
  private hit(label: string, x: number, y: number, width: number, height: number, callback: () => void): void {
    const node = this.element(label, x, y, width, height);
    const invoke = () => { if (!this.disposed && this.node.isValid) callback(); };
    node.on(Node.EventType.TOUCH_END, (event: EventTouch) => { event.propagationStopped = true; invoke(); });
    this.options.registerControl?.(label, invoke, { x, y, width, height });
  }
  private button(label: string, x: number, y: number, width: number, height: number,
    fill: string, callback: () => void): void {
    this.round(label, x, y, width, height, 19, fill);
    this.hit(label, x, y, width, height, callback);
  }
  private coin(x: number, y: number, radius: number): void {
    const g = this.element('PointsCoin', x, y).addComponent(Graphics);
    g.fillColor = this.color('#E8CA80'); g.circle(0, 0, radius); g.fill();
    g.strokeColor = this.color('#FFF5D4'); g.lineWidth = 1.5; g.circle(0, 0, radius - 3); g.stroke();
    g.moveTo(0, -4); g.lineTo(0, 4); g.stroke();
  }
  private play(x: number, y: number, hex: string): void {
    const g = this.element('RewardVideoPlay', x, y).addComponent(Graphics); g.fillColor = this.color(hex);
    g.moveTo(-5, -7); g.lineTo(7, 0); g.lineTo(-5, 7); g.close(); g.fill();
  }
  private chevron(x: number, y: number, hex: string): void {
    const g = this.element('NextChevron', x, y).addComponent(Graphics); g.strokeColor = this.color(hex); g.lineWidth = 2.3;
    g.moveTo(-3, -5); g.lineTo(3, 0); g.lineTo(-3, 5); g.stroke();
  }
  private spark(x: number, y: number, radius: number, hex: string): void {
    const g = this.element('VictorySpark', x, y).addComponent(Graphics); g.fillColor = this.color(hex);
    g.moveTo(0, radius); g.lineTo(radius / 3, radius / 3); g.lineTo(radius, 0);
    g.lineTo(radius / 3, -radius / 3); g.lineTo(0, -radius); g.lineTo(-radius / 3, -radius / 3);
    g.lineTo(-radius, 0); g.lineTo(-radius / 3, radius / 3); g.close(); g.fill();
  }
}
