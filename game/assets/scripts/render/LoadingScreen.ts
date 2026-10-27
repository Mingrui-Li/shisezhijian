import { BlockInputEvents, Color, Graphics, Label, Layers, Node, Sprite, SpriteFrame, UITransform } from 'cc';

/** Keep these words as readable engine text, never baked into an illustration. */
export const HEALTHY_PLAY_LINES = [
  '抵制不良游戏，拒绝盗版游戏。',
  '注意自我保护，谨防受骗上当。',
  '适度游戏益脑，沉迷游戏伤身。',
  '合理安排时间，享受健康生活。',
] as const;

export const DEVELOPMENT_AGE_NOTE = '适龄说明 · 开发测试版';

export interface LoadingScreenOptions {
  parent: Node;
  width: number;
  height: number;
  safeTop: number;
  safeBottom: number;
  /** An illustration only: the logo, progress and declarations are live native UI. */
  artwork?: SpriteFrame | null;
  onAgeInfo?: () => void;
  /** Optional browser-test mirror. The Cocos controls always remain authoritative. */
  registerControl?: (label: string, invoke: () => void,
    bounds: { x: number; y: number; width: number; height: number }) => void;
  /** Remove only the supplied module-owned labels; never clear other screen controls. */
  clearControls?: (labels: readonly string[]) => void;
  onModal?: (open: boolean) => void;
}

/** A native Cocos loading view. Loading completion is controlled by its caller. */
export class LoadingScreen {
  readonly node: Node;
  private readonly options: LoadingScreenOptions;
  private readonly artworkNode: Node;
  private readonly fallbackNode: Node;
  private readonly fill: Graphics;
  private readonly status: Label;
  private readonly percentage: Label;
  private readonly trackWidth: number;
  private ageLayer: Node | null = null;
  private progress = 0;
  private controlLabels = new Set<string>();
  private destroying = false;

  constructor(options: LoadingScreenOptions) {
    this.options = options;
    const { parent, width, height, safeTop, safeBottom } = options;
    this.node = this.element('LoadingScreen', width / 2, height / 2, width, height, parent);
    // The parent uses the same center-origin UI space as Boot's root.
    this.node.setPosition(0, 0);
    this.node.addComponent(BlockInputEvents);
    this.round('CreamBackdrop', width / 2, height / 2, width + 2, height + 2, 0, '#FFF8EE');
    this.fallbackNode = this.element('ArtworkFallback', width / 2, height / 2, width, height);
    this.fallbackNode.setPosition(0, 0);
    this.drawFallback();
    this.artworkNode = this.element('LoadingIllustration', width / 2, height / 2, width, height);
    this.artworkNode.addComponent(Sprite).sizeMode = Sprite.SizeMode.CUSTOM;
    this.artworkNode.active = false;
    if (options.artwork) this.setArtwork(options.artwork);

    const titleY = Math.max(54, safeTop + 38);
    this.label('拾色之间', width / 2, titleY, width - 48, 58, 38, '#564740', true);
    this.label('收集自然的每一种颜色', width / 2, titleY + 42, width - 56, 28, 14, '#746053');

    const panelTop = height - safeBottom - 242;
    this.round('LoadingInformation', width / 2, (panelTop + height) / 2 + 16,
      width + 2, height - panelTop + 32, 36, '#FFF8EE');
    this.status = this.label('正在准备颜色', width / 2, panelTop + 28, width - 66, 26, 14, '#68574B');
    this.trackWidth = Math.min(288, width - 82);
    this.round('ProgressTrack', width / 2, panelTop + 58, this.trackWidth, 10, 5, '#EADDD0');
    const fillNode = this.element('ProgressFill', width / 2, panelTop + 58, this.trackWidth, 10);
    this.fill = fillNode.addComponent(Graphics);
    this.percentage = this.label('0%', width / 2, panelTop + 82, width - 72, 22, 12, '#756356');
    this.label('健康游戏忠告', width / 2, panelTop + 111, width - 48, 20, 12, '#655345', true);
    HEALTHY_PLAY_LINES.forEach((line, i) => {
      this.label(line, width / 2, panelTop + 134 + i * 18, width - 36, 18, 12, '#6E6055');
    });
    const ageEntry = this.round('AgeInformationEntry', width / 2, panelTop + 219,
      Math.min(244, width - 60), 34, 17, '#F1E7DA');
    ageEntry.getComponent(UITransform)!.setContentSize(Math.min(244, width - 60), 44);
    const ageLabel = this.label(DEVELOPMENT_AGE_NOTE, width / 2, panelTop + 219,
      width - 72, 30, 12, '#655549');
    // The label sits above the button but has no listener and does not intercept touches.
    ageEntry.on(Node.EventType.TOUCH_END, () => this.invokeAgeInfo());
    ageLabel.name = 'AgeInformationLabel';
    this.registerAgeEntry();
    this.setProgress(0);
  }

  /** Updates actual resource progress; it never advances on a fake timer. */
  setProgress(progress: number, status?: string): void {
    if (!this.node.isValid) return;
    this.progress = Math.max(this.progress, Math.min(1, Number.isFinite(progress) ? progress : 0));
    if (status !== undefined) this.status.string = status;
    this.percentage.string = `${Math.round(this.progress * 100)}%`;
    this.fill.clear();
    const fillWidth = this.trackWidth * this.progress;
    if (fillWidth <= 0) return;
    this.fill.fillColor = new Color().fromHEX('#EA987B');
    this.fill.roundRect(-this.trackWidth / 2, -5, fillWidth, 10, Math.min(5, fillWidth / 2));
    this.fill.fill();
  }

  /** Cover the viewport without distorting the source illustration. */
  setArtwork(frame: SpriteFrame): void {
    if (!this.node.isValid) return;
    const { width, height } = this.options;
    const source = frame.originalSize;
    const scale = Math.max(width / Math.max(1, source.width), height / Math.max(1, source.height));
    const sprite = this.artworkNode.getComponent(Sprite)!;
    sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    sprite.spriteFrame = frame;
    this.artworkNode.getComponent(UITransform)!.setContentSize(source.width * scale, source.height * scale);
    this.artworkNode.active = true;
    this.fallbackNode.active = false;
  }

  /** Development disclosure; the production age mark is supplied by the Douyin platform. */
  openAgeInfo(): void {
    if (!this.node.isValid || this.ageLayer?.isValid) return;
    this.clearOwnControls();
    this.options.onModal?.(true);
    const { width, height } = this.options;
    this.ageLayer = this.round('AgeInformationScrim', width / 2, height / 2,
      width + 2, height + 2, 0, '#594E48');
    this.ageLayer.getComponent(Graphics)!.fillColor = new Color(89, 78, 72, 92);
    const scrim = this.ageLayer.getComponent(Graphics)!;
    scrim.clear(); scrim.rect(-width / 2, -height / 2, width, height); scrim.fill();
    this.ageLayer.addComponent(BlockInputEvents);
    const centerY = height / 2;
    this.round('AgeInformationCard', width / 2, centerY, width - 44, 326, 28, '#FFF9F0', this.ageLayer);
    this.label('适龄说明', width / 2, centerY - 113, width - 84, 36, 22, '#564740', true, this.ageLayer);
    this.label('开发测试版', width / 2, centerY - 75, width - 84, 24, 12, '#8C705C', false, this.ageLayer);
    this.label('本游戏通过点击色块完成渐变拼图，\n包含步数挑战和自愿观看广告的道具功能。',
      width / 2, centerY - 18, width - 80, 58, 14, '#6E5D50', false, this.ageLayer);
    this.label('正式适龄提示以抖音平台审核后展示为准。\n请合理安排游戏时间，未成年人请在\n监护人的指导下了解和体验游戏。',
      width / 2, centerY + 56, width - 80, 76, 13, '#6E5D50', false, this.ageLayer);
    const close = this.round('CloseAgeInformation', width / 2, centerY + 121,
      168, 42, 21, '#F3CEB2', this.ageLayer);
    this.label('知道了', width / 2, centerY + 121, 152, 38, 15, '#564740', true, this.ageLayer);
    close.on(Node.EventType.TOUCH_END, () => this.closeAgeInfo());
    this.register('关闭适龄说明', () => this.closeAgeInfo(),
      { x: width / 2, y: centerY + 121, width: 168, height: 42 });
  }

  closeAgeInfo(): void {
    if (!this.ageLayer) return;
    this.clearOwnControls();
    this.ageLayer.removeFromParent(); this.ageLayer.destroy(); this.ageLayer = null;
    if (!this.destroying) {
      this.options.onModal?.(false);
      this.registerAgeEntry();
    }
  }

  get isAgeInfoOpen(): boolean { return !!this.ageLayer?.isValid; }

  destroy(): void {
    this.destroying = true;
    this.closeAgeInfo();
    this.clearOwnControls();
    if (!this.node.isValid) return;
    this.node.removeFromParent(); this.node.destroy();
  }

  private invokeAgeInfo(): void {
    if (this.options.onAgeInfo) this.options.onAgeInfo();
    else this.openAgeInfo();
  }

  private registerAgeEntry(): void {
    const { width, height, safeBottom } = this.options;
    this.register(DEVELOPMENT_AGE_NOTE, () => this.invokeAgeInfo(),
      { x: width / 2, y: height - safeBottom - 23, width: Math.min(244, width - 60), height: 44 });
  }

  private register(label: string, invoke: () => void,
    bounds: { x: number; y: number; width: number; height: number }): void {
    this.controlLabels.add(label);
    this.options.registerControl?.(label, invoke, bounds);
  }

  private clearOwnControls(): void {
    if (this.controlLabels.size) this.options.clearControls?.([...this.controlLabels]);
    this.controlLabels.clear();
  }

  private element(name: string, x: number, y: number, width: number, height: number,
    parent: Node = this.node): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.addComponent(UITransform).setContentSize(width, height);
    node.setPosition(x - this.options.width / 2, this.options.height / 2 - y);
    parent.addChild(node);
    return node;
  }

  private round(name: string, x: number, y: number, width: number, height: number,
    radius: number, hex: string, parent: Node = this.node): Node {
    const node = this.element(name, x, y, width, height, parent);
    // Containers share the screen's center origin; nested visual children still use absolute UI coordinates.
    if (parent !== this.node) {
      const parentPosition = parent.position;
      node.setPosition(node.position.x - parentPosition.x, node.position.y - parentPosition.y);
    }
    const graphics = node.addComponent(Graphics);
    graphics.fillColor = new Color().fromHEX(hex);
    graphics.roundRect(-width / 2, -height / 2, width, height, Math.min(radius, width / 2, height / 2));
    graphics.fill();
    return node;
  }

  private label(value: string, x: number, y: number, width: number, height: number,
    size: number, hex: string, bold = false, parent: Node = this.node): Label {
    const node = this.element('LoadingText', x, y, width, height, parent);
    if (parent !== this.node) {
      const parentPosition = parent.position;
      node.setPosition(node.position.x - parentPosition.x, node.position.y - parentPosition.y);
    }
    const label = node.addComponent(Label);
    label.string = value;
    label.useSystemFont = true;
    label.fontFamily = 'sans-serif';
    label.fontSize = size;
    label.lineHeight = size * 1.45;
    label.isBold = bold;
    label.color = new Color().fromHEX(hex);
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.enableWrapText = true;
    label.overflow = Label.Overflow.NONE;
    return label;
  }

  private drawFallback(): void {
    const { width, height, safeBottom } = this.options;
    const heroY = Math.min(height * 0.45, height - safeBottom - 338);
    this.round('SoftSky', width / 2, height * 0.28, width + 4, height * 0.58, 0, '#F7E7DF', this.fallbackNode);
    this.round('CloudLeft', 17, heroY - 89, 172, 82, 40, '#FFF9F0', this.fallbackNode);
    this.round('CloudRight', width - 12, heroY - 144, 196, 96, 48, '#FFF6EB', this.fallbackNode);
    this.round('MintHill', width / 2 + 68, heroY + 124, width + 90, 204, 102, '#DAE9D6', this.fallbackNode);
    this.round('PeachHill', 43, heroY + 174, width + 76, 174, 86, '#F3C7AC', this.fallbackNode);
    const colors = ['#F0AC86', '#E5A4AB', '#B4ABC9', '#92BCB1', '#E7CC8E'];
    colors.forEach((hex, i) => {
      const tile = this.round('FloatingColor', width / 2 + (i - 2) * 48,
        heroY - 4 + Math.abs(i - 2) * 18, 40, 40, 11, hex, this.fallbackNode);
      tile.setRotationFromEuler(0, 0, (i - 2) * -7);
    });
  }
}
