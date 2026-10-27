import {
  _decorator, BlockInputEvents, Color, Component, EventTouch, Graphics,
  JsonAsset, Label, Layers, Node, ResolutionPolicy, resources, sys, tween,
  UITransform, view, game as engineGame, Game, Sprite, SpriteFrame, Vec3, Rect,
} from 'cc';
import { Action, adaptLevel, createGame, GameState, LevelDefinition, reduceGame, startLevel, recoverInterruptedGame } from './core';
import { completeLevel, emptyProgress, ProgressSave, unlockedThrough } from './application/Progress';
import { LocalSave } from './platform/LocalSave';
import { RewardedVideo } from './platform/RewardedVideo';
import { theme } from './theme/Theme';
import { boardLayout } from './render/BoardLayout';
import { Feedback } from './platform/Feedback';
import { BrowserTestBridge } from './platform/BrowserTestBridge';
import { runtimeConfig } from './application/RuntimeConfig';
import { LoadingScreen } from './render/LoadingScreen';
import { TutorialScreen } from './render/TutorialScreen';

const { ccclass } = _decorator;
type Prop = 'locate' | 'peek' | 'addMoves';
const C = theme.colors;

/** One scene, engine-native UI, and a pure state reducer: no DOM / web framework. */
@ccclass('ShiseBoot')
export class ShiseBoot extends Component {
  private root!: Node;
  private height = 844;
  private top = 24;
  private bottom = 20;
  private levels: LevelDefinition[] = [];
  private save: ProgressSave = emptyProgress('');
  private storage = new LocalSave();
  private video = new RewardedVideo({ adUnitId: runtimeConfig.rewardedAdUnitId });
  private feedback!: Feedback;
  private bridge!: BrowserTestBridge;
  private brandFrame: SpriteFrame | null = null;
  private homeFrame: SpriteFrame | null = null;
  private splashFrame: SpriteFrame | null = null;
  private iconsFrame: SpriteFrame | null = null;
  private iconFrames = new Map<string, SpriteFrame>();
  private loading: LoadingScreen | null = null;
  private tutorial: TutorialScreen | null = null;
  private ready = false;
  private testOriginal: ProgressSave | null = null;
  private collectionPage = 0;
  private pendingSimulation: { finish: () => void; cancel: () => void; fail: () => void } | null = null;
  private screen: 'home' | 'levels' | 'game' | 'collection' | 'tutorial' = 'home';
  private chapterPage = 0;
  private selectedCell: string | null = null;
  private selectedPool: number | null = null;
  private trayPage = 0;
  private modalOpen = false;
  private notice = '';
  private actionBusy = false;
  private idSequence = 0;
  private dismissedFailure: string | null = null;

  onLoad(): void {
    const frame = view.getFrameSize();
    view.setDesignResolutionSize(390, 844, frame.width / frame.height > 0.65
      ? ResolutionPolicy.SHOW_ALL : ResolutionPolicy.FIXED_WIDTH);
    this.height = view.getVisibleSize().height;
    const safe = sys.getSafeAreaRect(false);
    this.top = Math.max(24, this.height - safe.yMax + 12);
    this.bottom = Math.max(20, safe.yMin + 12);
    try {
      const tt = (globalThis as unknown as { tt?: {
        getMenuButtonBoundingClientRect?: () => { bottom: number };
        getSystemInfoSync?: () => { windowWidth: number };
      } }).tt;
      const menu = tt?.getMenuButtonBoundingClientRect?.();
      const width = tt?.getSystemInfoSync?.().windowWidth;
      if (menu && width) this.top = Math.max(this.top, menu.bottom * 390 / width + 10);
    } catch { /* The safe-area fallback remains valid on hosts without a capsule API. */ }
    this.feedback = new Feedback(this.node);
    this.bridge = new BrowserTestBridge(runtimeConfig.testTools, () => ({
      screen: this.screen, testSession: !!this.testOriginal, modalOpen: this.modalOpen,
      level: this.save.game?.level.number ?? null, status: this.save.game?.attempt.status ?? null,
      moves: this.save.game?.attempt.remainingMoves ?? null, trayPage: this.trayPage + 1,
      inventory: this.save.game?.wallet.inventory ?? null, completed: this.save.completed.length,
    }), this.height);
    this.root = new Node('ShiseUI');
    this.root.layer = Layers.Enum.UI_2D;
    this.root.addComponent(UITransform).setContentSize(390, this.height);
    this.node.addChild(this.root);
    engineGame.on(Game.EVENT_HIDE, this.suspend, this);
    engineGame.on(Game.EVENT_SHOW, this.resume, this);
    this.renderLoading();
    // First launch always reaches the home screen. Tutorial is an explicit home entry.
    let assetsDone = 0;
    const art = ['splash-v2', 'home-v2', 'icons-v2'];
    const artworkReady = Promise.all(art.map((name, index) => new Promise<void>(resolve => {
      resources.load(`art/${name}/spriteFrame`, SpriteFrame, (error, frame) => {
        if (!error && frame) {
          if (index === 0) { this.splashFrame = frame; this.loading?.setArtwork(frame); }
          if (index === 1) this.homeFrame = frame;
          if (index === 2) this.iconsFrame = frame;
        } else console.error(`[Shise] Artwork unavailable: ${name}`, error);
        this.loading?.setProgress(0.12 + ++assetsDone * 0.20);
        resolve();
      });
    })));
    const loadingStarted = Date.now();
    resources.load('generated/levels', JsonAsset, async (error, asset) => {
      if (error || !asset) {
        this.clear();
        this.text('颜色还没准备好', 195, this.height / 2 - 24, 280, 30, 22);
        this.text('请检查 generated/levels 资源', 195, this.height / 2 + 16, 300, 40, 14, C.textSecondary);
        return;
      }
      try {
        const content = asset.json as { contentVersion: string; levels: unknown[] };
        this.levels = content.levels.map(adaptLevel);
        this.save = this.storage.load(content.contentVersion, this.levels);
        // Only valid level versions can be resumed; do not reinterpret old boards.
        if (this.save.game && !this.levels.some(l => l.id === this.save.game!.level.id)) this.save.game = null;
        await artworkReady;
        this.loading?.setProgress(1, '准备好了');
        // Keep the real completion state visible long enough for readable launch notices.
        const finish = () => {
          if (this.loading?.isAgeInfoOpen) { this.scheduleOnce(finish, 0.2); return; }
          this.ready = true; this.renderHome();
        };
        this.scheduleOnce(finish, Math.max(0.25, (3000 - (Date.now() - loadingStarted)) / 1000));
      } catch (error) {
        console.error('[Shise] Failed to adapt level content', error);
        this.clear();
        this.text('题库版本需要更新', 195, this.height / 2, 300, 40, 22);
      }
    });
  }

  onDestroy(): void {
    this.tutorial?.dispose(); this.loading?.destroy();
    engineGame.off(Game.EVENT_HIDE, this.suspend, this);
    engineGame.off(Game.EVENT_SHOW, this.resume, this);
    this.video.dispose();
  }

  private resume(): void { if (this.screen === 'game') {
    this.renderGame();
    if (this.save.game?.attempt.status === 'AdPending' && this.pendingSimulation) this.showSimulationSheet();
  } }

  private suspend(): void {
    this.selectedCell = null; this.selectedPool = null;
    if (this.save.game?.attempt.status === 'PreviewingReference')
      this.save.game = recoverInterruptedGame(this.save.game);
    this.persist();
  }

  private nextId(prefix: string): string { return `${prefix}-${Date.now()}-${++this.idSequence}`; }

  private persist(): boolean {
    if (this.testOriginal) return true;
    const stored = this.storage.write(this.save);
    if (!stored || this.storage.error) this.notice = this.storage.error;
    return stored;
  }

  private clear(): void {
    this.tutorial?.dispose(); this.tutorial = null;
    this.loading?.destroy(); this.loading = null;
    this.bridge.clear();
    for (const node of [...this.root.children]) { node.removeFromParent(); node.destroy(); }
    this.modalOpen = false;
    this.round(195, this.height / 2, 392, this.height + 2, 0, C.background);
  }

  private element(name: string, x: number, y: number, width: number, height: number, parent = this.root): Node {
    const node = new Node(name);
    node.layer = Layers.Enum.UI_2D;
    node.addComponent(UITransform).setContentSize(width, height);
    node.setPosition(x - 195, this.height / 2 - y);
    parent.addChild(node);
    return node;
  }

  private round(x: number, y: number, width: number, height: number, radius: number,
    hex: string, parent = this.root, stroke?: string): Node {
    const node = this.element('Shape', x, y, width, height, parent);
    const g = node.addComponent(Graphics);
    g.fillColor = new Color().fromHEX(hex);
    g.roundRect(-width / 2, -height / 2, width, height, Math.min(radius, height / 2, width / 2));
    g.fill();
    if (stroke) { g.strokeColor = new Color().fromHEX(stroke); g.lineWidth = 2; g.stroke(); }
    return node;
  }

  private text(value: string, x: number, y: number, width: number, height: number,
    size = 16, color: string = C.text, bold = false, parent = this.root): Node {
    this.bridge.text(value);
    const node = this.element('Text', x, y, width, height, parent);
    const label = node.addComponent(Label);
    label.string = value;
    label.fontFamily = theme.typography.family;
    label.useSystemFont = true;
    label.fontSize = size;
    label.lineHeight = size * 1.45;
    label.color = new Color().fromHEX(color);
    label.isBold = bold;
    label.horizontalAlign = Label.HorizontalAlign.CENTER;
    label.verticalAlign = Label.VerticalAlign.CENTER;
    label.overflow = Label.Overflow.SHRINK;
    return node;
  }

  private button(value: string, x: number, y: number, width: number, height: number,
    onTap: () => void, fill: string = C.primary, color: string = C.onPrimary,
    parent = this.root, modalButton = false, semanticLabel?: string): Node {
    const node = this.round(x, y, width, height, theme.radii.button, fill, parent);
    // Label and shape share the same center; labels deliberately do not carry input.
    const label = new Node('Label');
    label.layer = Layers.Enum.UI_2D;
    label.addComponent(UITransform).setContentSize(width - 16, height);
    const component = label.addComponent(Label);
    component.string = value;
    component.fontFamily = theme.typography.family;
    component.useSystemFont = true;
    component.fontSize = height < 50 ? 15 : 18;
    component.lineHeight = 26;
    component.isBold = false;
    component.color = new Color().fromHEX(color);
    component.horizontalAlign = Label.HorizontalAlign.CENTER;
    component.verticalAlign = Label.VerticalAlign.CENTER;
    component.overflow = Label.Overflow.SHRINK;
    node.addChild(label);
    node.on(Node.EventType.TOUCH_START, () => {
      if ((!this.modalOpen || modalButton) && !this.save.settings.reducedMotion)
        tween(node).to(0.09, { scale: new Vec3(0.97, 0.97, 1) }).start();
    });
    const release = () => {
      if (this.save.settings.reducedMotion) node.setScale(1, 1, 1);
      else tween(node).to(0.09, { scale: new Vec3(1, 1, 1) }).start();
    };
    const invoke = () => { if ((!this.modalOpen || modalButton) && !this.actionBusy) onTap(); };
    this.bridge.control(semanticLabel || value, invoke, { x, y, width, height });
    node.on(Node.EventType.TOUCH_CANCEL, release);
    node.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
      event.propagationStopped = true;
      release();
      invoke();
    });
    return node;
  }

  private renderLoading(): void {
    this.clear();
    this.loading = new LoadingScreen({ parent: this.root, width: 390, height: this.height,
      safeTop: this.top, safeBottom: this.bottom, artwork: this.splashFrame || undefined,
      registerControl: (label, invoke, bounds) => this.bridge.control(label, invoke, bounds),
      clearControls: labels => this.bridge.removeControls(labels) });
    this.loading.setProgress(0.05, '正在准备颜色');
  }

  private artwork(frame: SpriteFrame, x: number, y: number, width: number, height: number, parent = this.root): Node {
    const node = this.element('Illustration', x, y, width, height, parent);
    const sprite = node.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.spriteFrame = frame;
    node.getComponent(UITransform)!.setContentSize(width, height);
    return node;
  }

  private icon(name: string, x: number, y: number, size = 40, parent = this.root): void {
    const names = ['home', 'tutorial', 'settings', 'collection', 'locate', 'peek', 'addMoves', 'undo', 'back', 'next', 'return', 'cancel'];
    const index = names.indexOf(name);
    if (this.iconsFrame && index >= 0) {
      let frame = this.iconFrames.get(name);
      if (!frame) {
        const source = this.iconsFrame;
        const width = source.originalSize.width / 4, height = source.originalSize.height / 3;
        frame = new SpriteFrame(); frame.texture = source.texture;
        frame.rect = new Rect(index % 4 * width, Math.floor(index / 4) * height, width, height);
        this.iconFrames.set(name, frame);
      }
      this.artwork(frame, x, y, size, size, parent);
    } else {
      const symbols: Record<string, string> = { home: '⌂', tutorial: '▤', settings: '⚙', collection: '▧',
        locate: '✦', peek: '◉', addMoves: '+', undo: '↶', back: '‹', next: '›', return: '↧', cancel: '×' };
      this.text(symbols[name] || '·', x, y, size, size, size * 0.65, C.text, false, parent);
    }
  }

  private iconButton(name: string, label: string, x: number, y: number, size: number,
    invoke: () => void, fill: string = C.surface): void {
    this.button('', x, y, size, size, invoke, fill, C.text, this.root, false, label);
    this.icon(name, x, y, size * 0.85);
  }

  private openTutorial(): void {
    this.clear(); this.screen = 'tutorial';
    this.tutorial = new TutorialScreen(this.root, this.height, this.top, this.bottom,
      () => this.renderHome(), { onStart: () => {
          if (this.save.game && this.save.game.attempt.status !== 'Won') this.renderGame();
          else this.enterLevel(unlockedThrough(this.save, this.levels.map(l => l.id)));
        },
        registerControl: (label, invoke, bounds) => this.bridge.control(label, invoke, bounds),
        clearControls: () => this.bridge.clear(), onText: value => this.bridge.text(value) });
  }

  private hero(centerY: number): void {
    if (this.brandFrame) {
      const icon = this.element('Brand', 195, centerY, 218, 218);
      const sprite = icon.addComponent(Sprite); sprite.sizeMode = Sprite.SizeMode.CUSTOM; sprite.spriteFrame = this.brandFrame;
      icon.getComponent(UITransform)!.setContentSize(218, 218);
      return;
    }
    this.round(133, centerY - 50, 146, 146, 72, C.butter);
    this.round(251, centerY + 34, 144, 144, 72, C.mint);
    const colors = ['#F4AD82', '#EC8D91', '#C9B4E3', '#F3D593', '#B9D9B7', '#9CCADD', '#F1C6A8', '#A6D7CB', '#B5B2DF'];
    colors.forEach((hex, i) => {
      const x = 139 + (i % 3) * 56;
      const y = centerY - 56 + Math.floor(i / 3) * 56;
      const tile = this.round(x, y, 48, 48, 12, hex);
      if (i === 2) tile.setRotationFromEuler(0, 0, -9);
    });
  }

  private renderHome(): void {
    if (this.testOriginal) { this.save = this.testOriginal; this.testOriginal = null; }
    if (this.save.game?.attempt.status === 'PreviewingReference') {
      this.save.game = reduceGame(this.save.game, { type: 'endPeek' }).state; this.persist();
    }
    this.screen = 'home'; this.clear();
    const mainY = Math.max(this.top + 364, this.height * 0.61);
    if (this.homeFrame) this.artwork(this.homeFrame, 195, mainY - 170, 390, 585);
    this.iconButton('settings', '设置', 344, this.top + 21, 44, () => this.openSettings());
    this.text('拾色之间', 195, this.top + 69, 304, 62, 38, C.text, true);
    this.text('100 道自然色彩 · 5 段拾色旅程', 195, this.top + 113, 304, 26, 12, C.textSecondary);
    const next = unlockedThrough(this.save, this.levels.map(l => l.id));
    const resume = this.save.game;
    const continuing = resume && resume.attempt.status !== 'Won';
    const levelNumber = continuing ? resume.level.number : next + 1;
    this.round(195, mainY + 5, 310, 62, 28, '#E7B5A2');
    this.button(continuing ? '继续游戏' : '开始游戏', 195, mainY, 310, 62,
      () => continuing ? this.renderGame() : this.enterLevel(next), C.primary, '#FFFFFF');
    this.text(`第 ${levelNumber} 关 · ${this.levels[levelNumber - 1]?.title || '自然的颜色'}`,
      195, mainY + 49, 320, 24, 12, C.textSecondary);
    const cards = [
      { icon: 'home', label: '关卡', fill: C.mint, action: () => { this.chapterPage = Math.floor(next / 20); this.renderLevels(); } },
      { icon: 'tutorial', label: '教程', fill: C.butter, action: () => this.openTutorial() },
      { icon: 'collection', label: '收藏', fill: C.lilac, action: () => { this.collectionPage = 0; this.renderCollection(); } },
    ];
    cards.forEach((card, index) => {
      const x = 83 + index * 112, y = mainY + 129;
      this.round(x, y + 3, 100, 96, 22, '#EDE5DA');
      this.button('', x, y, 100, 96, card.action, card.fill, C.text, this.root, false, card.label);
      this.icon(card.icon, x, y - 13, 66);
      this.text(card.label, x, y + 28, 88, 24, 14, C.text, true);
    });
    this.text(`${this.save.completed.length} / 100`, 195, this.height - this.bottom - 31, 200, 24, 12, C.textSecondary);
    if (runtimeConfig.testTools) this.button('体验版测试', 195, this.height - this.bottom,
      120, 28, () => this.openTestTools(), C.background, C.textSecondary);
  }

  private openSettings(): void {
    const { layer, top } = this.sheet('设置', '', 414);
    const labels = { sound: '轻音效', haptics: '轻触反馈', reducedMotion: '减少动效' };
    (['sound', 'haptics', 'reducedMotion'] as const).forEach((key, i) => {
      this.button(`${labels[key]}   ${this.save.settings[key] ? '已开启' : '已关闭'}`,
        195, top + 157 + i * 57, 280, 48, () => {
          this.save.settings[key] = !this.save.settings[key]; this.persist();
          this.renderHome(); this.openSettings();
        }, this.save.settings[key] ? C.mint : C.disabled, C.text, layer, true);
    });
    this.button('好了，继续拾色', 195, top + 348, 280, 48, () => this.renderHome(), C.primary, C.onPrimary, layer, true);
  }

  private renderCollection(): void {
    this.screen = 'collection'; this.clear();
    this.button('‹', 40, this.top + 24, 48, 48, () => this.renderHome(), C.surface, C.text);
    this.text('我的色谱收藏', 195, this.top + 26, 250, 40, 22, C.text, true);
    const completed = this.levels.filter(level => this.save.completed.includes(level.id));
    if (!completed.length) {
      this.hero(this.height * 0.36);
      this.text('还没有收下第一道风景', 195, this.height * 0.60, 330, 36, 20);
      this.text('完成关卡，就能把它的颜色留在这里', 195, this.height * 0.66, 342, 32, 14, C.textSecondary);
      this.button('去拾色', 195, this.height * 0.77, 260, 52, () => this.enterLevel(0));
      return;
    }
    const pageSize = Math.max(2, Math.min(4, Math.floor((this.height - this.top - this.bottom - 190) / 122)));
    const pages = Math.ceil(completed.length / pageSize);
    this.collectionPage = Math.min(this.collectionPage, pages - 1);
    completed.slice(this.collectionPage * pageSize, (this.collectionPage + 1) * pageSize).forEach((level, i) => {
      const y = this.top + 144 + i * 122;
      this.round(195, y, 342, 102, 20, C.surface);
      this.text(`${level.number} · ${level.title}`, 195, y - 27, 310, 28, 16, C.text, true);
      const sample = level.cells.filter((_, index) => index % Math.max(1, Math.floor(level.cells.length / 8)) === 0).slice(0, 8);
      sample.forEach((cell, j) => this.round(195 + (j - (sample.length - 1) / 2) * 34,
        y + 14, 30, 30, 6, cell.targetHex));
    });
    this.button('上一页', 85, this.height - this.bottom - 36, 110, 48, () => {
      if (this.collectionPage > 0) { this.collectionPage--; this.renderCollection(); }
    }, C.surface, C.text);
    this.text(`${this.collectionPage + 1} / ${pages}`, 195, this.height - this.bottom - 36, 70, 32, 14);
    this.button('下一页', 305, this.height - this.bottom - 36, 110, 48, () => {
      if (this.collectionPage + 1 < pages) { this.collectionPage++; this.renderCollection(); }
    }, C.surface, C.text);
  }

  private openTestTools(): void {
    const { layer, top } = this.sheet('体验版测试工具', '独立测试局，不影响正式进度和库存', 478);
    [1, 5, 12, 44, 72, 100].forEach((number, i) => this.button(`试第 ${number} 关`,
      118 + i % 2 * 154, top + 156 + Math.floor(i / 2) * 62, 142, 48,
      () => this.enterTestLevel(number - 1), i > 3 ? C.lilac : C.mint, C.text, layer, true));
    this.button('预览加载页', 195, top + 347, 230, 42, () => {
      this.renderLoading(); this.screen = 'home';
      this.loading?.setProgress(1, '准备好了');
      this.iconButton('cancel', '返回首页', 345, this.top + 20, 42, () => this.renderHome());
    }, C.butter, C.text, layer, true);
    this.button('返回游戏', 195, top + 416, 260, 48, () => this.renderHome(), C.primary, C.onPrimary, layer, true);
  }

  private enterTestLevel(index: number): void {
    if (!runtimeConfig.testTools) return;
    if (!this.testOriginal) this.testOriginal = this.save;
    const settings = { ...this.save.settings };
    this.save = emptyProgress(this.testOriginal.contentVersion); this.save.settings = settings;
    this.save.game = createGame(this.levels[index], this.nextId('test'), { locate: 3, peek: 2, addMoves: 1 });
    this.selectedPool = null; this.selectedCell = null; this.trayPage = 0; this.notice = '';
    this.renderGame();
  }

  private renderLevels(): void {
    this.screen = 'levels';
    this.clear();
    this.button('‹', 40, this.top + 24, 48, 48, () => this.renderHome(), C.surface, C.text);
    const first = this.levels[this.chapterPage * 20];
    this.text(`第 ${this.chapterPage + 1} 章 · ${first.chapterName}`, 195, this.top + 26, 260, 40, 20, C.text, true);
    this.text('一关一关，拾起沿途的颜色', 195, this.top + 78, 320, 30, 15, C.textSecondary);
    const unlocked = unlockedThrough(this.save, this.levels.map(l => l.id));
    for (let i = 0; i < 20; i++) {
      const index = this.chapterPage * 20 + i;
      const level = this.levels[index];
      const allowed = index <= unlocked;
      const done = this.save.completed.includes(level.id);
      this.button(allowed ? `${index + 1}${done ? ' ✓' : ''}` : '·',
        72 + i % 4 * 82, this.top + 157 + Math.floor(i / 4) * 72, 62, 56,
        () => { if (allowed) this.enterLevel(index); },
        done ? C.mint : allowed ? C.butter : C.disabled, allowed ? C.text : C.textSecondary);
    }
    const pagerY = Math.min(this.height - this.bottom - 46, this.top + 573);
    this.button('上一章', 100, pagerY, 120, 48, () => {
      if (this.chapterPage > 0) { this.chapterPage--; this.renderLevels(); }
    }, C.surface, C.text);
    this.button('下一章', 290, pagerY, 120, 48, () => {
      if (this.chapterPage < 4) { this.chapterPage++; this.renderLevels(); }
    }, C.surface, C.text);
    this.text('完成当前关卡，就能开启下一道风景', 195, this.height - this.bottom, 342, 28, 13, C.textSecondary);
  }

  private enterLevel(index: number): void {
    const allowed = unlockedThrough(this.save, this.levels.map(l => l.id));
    if (index < 0 || index >= this.levels.length || index > allowed) return;
    this.save.game = this.save.game
      ? startLevel(this.save.game, this.levels[index], this.nextId('attempt'))
      : createGame(this.levels[index], this.nextId('attempt'));
    this.selectedCell = null;
    this.selectedPool = null;
    this.notice = '';
    this.trayPage = 0;
    this.persist();
    this.renderGame();
  }

  private dispatch(action: Action): void {
    if (!this.save.game || this.actionBusy) return;
    const result = reduceGame(this.save.game, action);
    if (result.changed) {
      this.save.game = result.state;
      this.selectedCell = null; this.selectedPool = null;
      if (!this.testOriginal) completeLevel(this.save, this.levels.map(l => l.id));
      if (['place', 'move', 'locate'].includes(action.type)) this.feedback.play(
        result.state.attempt.status === 'Won' ? 'complete' : 'place', this.save.settings.sound, this.save.settings.haptics);
      this.notice = '';
      this.persist();
    } else if (result.reason) {
      this.notice = this.friendlyReason(result.reason);
    }
    this.renderGame();
  }

  private friendlyReason(reason: string): string {
    if (/stock|inventory/i.test(reason)) return '这个道具用完啦';
    if (/limit|maximum/i.test(reason)) return '这次的使用次数已用完';
    if (/lock|anchor/i.test(reason)) return '小圆点标记的颜色已经固定';
    return reason;
  }

  private renderGame(): void {
    if (!this.save.game) { this.renderHome(); return; }
    this.screen = 'game';
    this.clear();
    const state = this.save.game;
    const { level, attempt } = state;
    const layout = boardLayout(this.height, this.top, this.bottom, level.grid.columns,
      level.grid.rows, attempt.pool.length);
    const { cellSize, pitch, boardStartX, boardStartY } = layout;
    this.iconButton('back', '返回首页', 40, this.top + 22, 44, () => {
      this.selectedCell = null; this.selectedPool = null; this.renderHome();
    });
    this.iconButton('settings', '关卡菜单', 350, this.top + 22, 44, () => this.openGameMenu());
    this.text(`${level.title}`, 195, this.top + 14, 244, 30, 19, C.text, true);
    this.text(`${this.testOriginal ? '体验 · ' : ''}第 ${level.number} 关`, attempt.remainingMoves === null ? 195 : 157,
      this.top + 43, 136, 22, 12, C.textSecondary);
    if (attempt.remainingMoves !== null) {
      this.round(263, this.top + 45, 72, 26, 13, attempt.remainingMoves <= 3 ? '#FCE0D9' : '#FFFFFF');
      this.text(`${attempt.remainingMoves} 步`, 263, this.top + 45, 72, 26, 14,
        attempt.remainingMoves <= 3 ? C.warning : C.text, true);
    }
    const xy = (cellId: string) => {
      const cell = level.cells.find(c => c.id === cellId)!;
      return { x: boardStartX + cell.x * pitch, y: boardStartY + cell.y * pitch };
    };
    const boardWidth = level.grid.columns * cellSize + (level.grid.columns - 1) * 6;
    this.round(195, layout.boardTop + layout.boardHeight / 2 + 5, Math.min(368, boardWidth + 36),
      layout.boardHeight + 42, 24, '#EFE9DE');
    this.round(195, layout.boardTop + layout.boardHeight / 2, Math.min(368, boardWidth + 36),
      layout.boardHeight + 42, 24, '#FFFEFB');
    const tracks = this.element('Tracks', 195, 0, 390, this.height);
    tracks.setPosition(0, this.height / 2);
    const g = tracks.addComponent(Graphics);
    g.strokeColor = new Color().fromHEX(C.track);
    g.lineWidth = 2;
    level.paths.forEach(path => {
      path.cellIds.forEach((id, i) => {
        const p = xy(id);
        if (!i) g.moveTo(p.x - 195, -p.y); else g.lineTo(p.x - 195, -p.y);
      });
      g.stroke();
    });
    const tileHex = (id: string | null) => level.tiles.find(t => t.id === id)?.hex || C.surface;
    const previewCells = attempt.preview
      ? level.paths.find(path => path.id === attempt.preview!.pathId)?.cellIds ?? [] : [];
    for (const cell of level.cells) {
      const p = xy(cell.id);
      const tile = attempt.board[cell.id];
      const locked = level.anchors.includes(cell.id) || attempt.auxiliaryLocks.includes(cell.id);
      const hex = previewCells.includes(cell.id) ? cell.targetHex : tileHex(tile);
      if (this.selectedCell === cell.id) this.round(p.x, p.y, cellSize + 8, cellSize + 8, 12, '#A6CEC3');
      const node = this.round(p.x, p.y, cellSize, cellSize, theme.radii.tile, hex,
        this.root, tile === null && !previewCells.includes(cell.id) ? '#DDD7CB' : undefined);
      node.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
        event.propagationStopped = true;
        if (!this.modalOpen) this.tapCell(cell.id);
      });
      if (!locked) this.bridge.control(`上方${tile ? '色块' : '空槽'} ${cell.id}`, () => { if (!this.modalOpen) this.tapCell(cell.id); }, { x: p.x, y: p.y, width: cellSize, height: cellSize });
      if (locked) {
        this.round(p.x + cellSize / 2 + 1, p.y - cellSize / 2 - 1, 7, 7, 4, C.surface);
        const marker = this.round(p.x + cellSize / 2 + 1, p.y - cellSize / 2 - 1,
          4, 4, level.anchors.includes(cell.id) ? 2 : 0, C.text);
        if (!level.anchors.includes(cell.id)) marker.setRotationFromEuler(0, 0, 45);
      }
    }
    // Instructions live in the interactive tutorial, not permanently on the play board.
    if (attempt.preview || this.notice) this.text(attempt.preview ? '参考色路 · 3 秒' : this.notice,
      195, layout.trayLabelY - 6, 352, 26, 12, C.textSecondary);
    const trayWidth = layout.trayColumns * 50 + 18;
    this.round(195, layout.trayTop + layout.trayHeight / 2 + 3, trayWidth,
      layout.trayHeight + 22, 19, '#EEE8DD');
    this.round(195, layout.trayTop + layout.trayHeight / 2, trayWidth,
      layout.trayHeight + 22, 19, '#F2F1EA');
    const pages = Math.max(1, Math.ceil(attempt.pool.length / layout.slotsPerPage));
    this.trayPage = Math.min(pages - 1, this.trayPage);
    const firstSlot = this.trayPage * layout.slotsPerPage;
    const lastSlot = Math.min(attempt.pool.length, firstSlot + layout.slotsPerPage);
    for (let i = firstSlot; i < lastSlot; i++) {
      const local = i - firstSlot;
      const id = attempt.pool[i];
      const x = 195 - (layout.trayColumns - 1) * layout.trayPitch / 2
        + local % layout.trayColumns * layout.trayPitch;
      const y = layout.trayTop + 22 + Math.floor(local / layout.trayColumns) * layout.trayPitch;
      if (this.selectedPool === i) this.round(x, y, 52, 52, 12, '#A6CEC3');
      const node = this.round(x, y, 44, 44, 8, tileHex(id), this.root, id ? undefined : C.border);
      node.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
        event.propagationStopped = true;
        if (!this.modalOpen) this.tapPool(i);
      });
      this.bridge.control(`候选槽 ${i + 1}${id ? ' ' + tileHex(id) : ' 空'}`, () => { if (!this.modalOpen) this.tapPool(i); }, { x, y, width: 44, height: 44 });
    }
    if (pages > 1) {
    this.iconButton('back', '上一页候选', 130, layout.pagerY, 40, () => {
      if (this.trayPage > 0) { this.trayPage--; this.renderGame(); }
    });
    this.text(`${this.trayPage + 1} / ${pages}`, 195, layout.pagerY, 70, 26, 12, C.textSecondary);
    this.iconButton('next', '下一页候选', 260, layout.pagerY, 40, () => {
      if (this.trayPage + 1 < pages) { this.trayPage++; this.renderGame(); }
    });
    }
    if (attempt.status === 'Failed') {
      this.button('继续本关', 64, layout.actionsY, 96, 48, () => this.openFail(), C.mint, C.text);
      this.button('免费重开', 195, layout.actionsY, 144, 48,
        () => this.dispatch({ type: 'restart', attemptId: this.nextId('attempt') }), C.surface, C.text);
      this.button('选关', 326, layout.actionsY, 92, 48,
        () => { if (this.testOriginal) { this.renderHome(); this.openTestTools(); }
          else { this.chapterPage = level.chapter - 1; this.renderLevels(); } }, C.surface, C.text);
    } else {
    this.iconButton('cancel', '取消选择', 133, layout.actionsY, 44, () => {
      this.selectedCell = null; this.selectedPool = null; this.notice = ''; this.renderGame();
    }, this.selectedCell || this.selectedPool !== null ? C.surface : C.background);
    this.iconButton('return', '放回待选区', 195, layout.actionsY, 44, () => {
      if (this.selectedCell) this.dispatch({ type: 'returnToTray', fromCellId: this.selectedCell });
      else { this.notice = '先点选上方已填的颜色'; this.renderGame(); }
    }, this.selectedCell ? C.mint : C.background);
    this.iconButton('undo', '撤销', 257, layout.actionsY, 44,
      () => this.dispatch({ type: 'undo' }), C.surface);
    }
    (['locate', 'peek', 'addMoves'] as Prop[]).forEach((prop, i) => {
      const names = { locate: '点睛', peek: '窥色', addMoves: '续步' };
      const x = 79 + i * 116;
      this.round(x, layout.propsY + 3, 100, 70, 20, '#EAE3D8');
      this.button('', x, layout.propsY, 100, 70,
        () => this.openProp(prop), attempt.status === 'Playing' ? [C.mint, C.lilac, C.butter][i] : C.disabled,
        C.text, this.root, false, names[prop]);
      this.icon(prop, x, layout.propsY - 10, 48);
      this.text(names[prop], x, layout.propsY + 22, 80, 22, 12, C.text);
      this.round(x + 33, layout.propsY - 23, 22, 22, 11, C.surface);
      this.text(String(state.wallet.inventory[prop]), x + 33, layout.propsY - 23, 22, 22, 11, C.text);
    });
    if (attempt.status === 'Won') this.openWin();
    else if (attempt.status === 'Failed' && this.dismissedFailure !== attempt.id) this.openFail();
  }

  private tapPool(index: number): void {
    const state = this.save.game!;
    if (state.attempt.status !== 'Playing') return;
    if (state.attempt.pool[index]) {
      this.selectedPool = this.selectedPool === index ? null : index;
      this.selectedCell = null; this.notice = ''; this.renderGame();
    } else if (this.selectedCell) {
      const tile = state.attempt.board[this.selectedCell];
      if (tile && state.level.trayHomeByTile[tile] === index)
        this.dispatch({ type: 'returnToTray', fromCellId: this.selectedCell });
      else { this.notice = '可以点“放回待选区”回到原槽'; this.renderGame(); }
    }
  }

  private tapCell(cellId: string): void {
    const state = this.save.game!;
    if (state.attempt.status !== 'Playing') return;
    if (state.level.anchors.includes(cellId) || state.attempt.auxiliaryLocks.includes(cellId)) {
      this.notice = '带小圆点的颜色已经固定'; this.renderGame(); return;
    }
    if (this.selectedCell === cellId) {
      this.selectedCell = null; this.renderGame(); return;
    }
    if (state.attempt.board[cellId] !== null) {
      if (this.selectedPool !== null || this.selectedCell !== null) {
        this.notice = '这里已有颜色，请先取回或选一个空格';
      } else { this.selectedCell = cellId; this.notice = ''; }
      this.renderGame(); return;
    }
    if (this.selectedPool !== null) {
      this.dispatch({ type: 'place', poolIndex: this.selectedPool, toCellId: cellId });
    } else if (this.selectedCell) {
      this.dispatch({ type: 'move', fromCellId: this.selectedCell, toCellId: cellId });
    } else { this.notice = '先点选下方的一块颜色'; this.renderGame(); }
  }

  private sheet(title: string, subtitle: string, height = 360): { layer: Node; top: number; center: number } {
    this.modalOpen = true; this.bridge.modal();
    const layer = this.element('Modal', 195, this.height / 2, 390, this.height);
    layer.setPosition(0, 0);
    const overlay = this.round(195, this.height / 2, 390, this.height, 0, C.scrim, layer);
    const graphics = overlay.getComponent(Graphics)!;
    const alpha = Math.round(255 * theme.controls.scrimOpacity);
    const tint = new Color().fromHEX(C.scrim);
    tint.a = alpha;
    graphics.clear(); graphics.fillColor = tint;
    graphics.rect(-195, -this.height / 2, 390, this.height); graphics.fill();
    overlay.addComponent(BlockInputEvents);
    const center = this.height / 2;
    const top = center - height / 2;
    const panel = this.round(195, center, 342, height, theme.radii.modal, C.surface, layer);
    panel.addComponent(BlockInputEvents);
    this.text(title, 195, top + 52, 286, 42, 25, C.text, true, layer);
    this.text(subtitle, 195, top + 99, 292, 52, 15, C.textSecondary, false, layer);
    return { layer, top, center };
  }

  private openGameMenu(): void {
    const state = this.save.game;
    if (!state || state.attempt.status === 'AdPending') return;
    const { layer, top } = this.sheet('这一道颜色，慢慢来', '离开会保留当前盘面', 360);
    this.button('继续这一关', 195, top + 157, 280, 48, () => this.renderGame(), C.mint, C.text, layer, true);
    this.button('免费重新开始', 195, top + 220, 280, 48, () => {
      const confirm = this.sheet('重新拾起这些颜色？', '盘面恢复开局；已使用道具不会返还', 290);
      this.button('确定重开', 195, confirm.top + 162, 280, 48,
        () => this.dispatch({ type: 'restart', attemptId: this.nextId('attempt') }), C.primary, C.onPrimary, confirm.layer, true);
      this.button('再想想', 195, confirm.top + 224, 280, 44,
        () => this.renderGame(), C.mint, C.text, confirm.layer, true);
    }, C.surface, C.text, layer, true);
    this.button('返回首页', 195, top + 283, 280, 48,
      () => this.renderHome(), C.surface, C.textSecondary, layer, true);
  }

  private openWin(): void {
    const { layer, top } = this.sheet('这道风景，拾好啦', '颜色归位，给自己一点小小的掌声', 340);
    const n = this.save.game!.level.number;
    if (this.testOriginal) {
      this.button('返回测试工具', 195, top + 185, 282, 56, () => { this.renderHome(); this.openTestTools(); }, C.primary, C.onPrimary, layer, true);
      this.button('再体验一次', 195, top + 256, 220, 48, () => this.enterTestLevel(n - 1), C.mint, C.text, layer, true);
      return;
    }
    this.button(n < 100 ? '继续下一道风景' : '重温色彩旅程', 195, top + 185, 282, 56,
      () => n < 100 ? this.enterLevel(n) : this.renderLevels(), C.primary, C.onPrimary, layer, true);
    this.button('回到首页', 195, top + 256, 220, 48,
      () => this.renderHome(), C.mint, C.text, layer, true);
  }

  private openFail(): void {
    const state = this.save.game!;
    const max = state.level.challenge.revive.maxPerAttempt;
    const canRevive = state.attempt.revivesUsed < max;
    const entitlement = state.wallet.pendingRevives[0];
    const { layer, top } = this.sheet('就差一点点', this.notice || '步数用完了，颜色还为你留着', 414);
    this.button('×', 327, top + 24, 40, 40, () => {
      this.dismissedFailure = state.attempt.id; this.renderGame();
    }, C.surface, C.text, layer, true);
    this.text(`本局还可复活 ${Math.max(0, max - state.attempt.revivesUsed)} 次`, 195, top + 142,
      290, 26, 13, C.textSecondary, false, layer);
    if (canRevive) {
      this.button(entitlement ? `使用已获得的 +${entitlement.amount} 步` : `▷ 看视频 +${state.level.challenge.revive.addMoves} 步`,
        195, top + 196, 288, 56, () => {
          this.dismissedFailure = null;
          if (entitlement) this.dispatch({ type: 'applyPendingRevive', requestId: entitlement.requestId });
          else this.requestVideo('revive');
        }, C.primary, C.onPrimary, layer, true);
    } else this.text('本局复活次数已用完', 195, top + 196, 288, 56, 16, C.textSecondary, false, layer);
    this.button('免费重开', 195, top + 268, 288, 48,
      () => this.dispatch({ type: 'restart', attemptId: this.nextId('attempt') }), C.mint, C.text, layer, true);
    this.button('返回选关', 195, top + 335, 220, 48,
      () => { if (this.testOriginal) { this.renderHome(); this.openTestTools(); }
        else { this.chapterPage = state.level.chapter - 1; this.renderLevels(); } }, C.surface, C.textSecondary, layer, true);
  }

  private openProp(prop: Prop): void {
    const state = this.save.game!;
    if (state.attempt.status !== 'Playing') return;
    const names = { locate: '点睛', peek: '窥色', addMoves: '续步' };
    const descriptions = { locate: '帮一块颜色归位并固定，不花步数', peek: '选择一条色路，参考答案 3 秒', addMoves: '为这次尝试增加 5 步' };
    const { layer, top } = this.sheet(names[prop], descriptions[prop], 368);
    const limits = { locate: 2, peek: 1, addMoves: 2 };
    const usesLeft = limits[prop] - state.attempt.propUses[prop];
    this.text(`拥有 ${state.wallet.inventory[prop]} 个 · 本局可用 ${usesLeft} 次`, 195, top + 146, 290, 28, 15, C.textSecondary, false, layer);
    const stock = state.wallet.inventory[prop];
    const unavailable = usesLeft <= 0 ? '本局使用次数已用完'
      : prop === 'addMoves' && state.attempt.remainingMoves === null ? '教学关无需增加步数'
        : stock <= 0 && state.attempt.propRestockAdsGranted >= 1 ? '本局视频补货已用完' : '';
    if (unavailable) this.text(unavailable, 195, top + 207, 280, 56, 16, C.textSecondary, false, layer);
    else this.button(stock > 0 ? '使用一个' : '▷ 看视频领取 1 个', 195, top + 207, 280, 56, () => {
      if (stock <= 0) { this.requestVideo('restock', prop); return; }
      if (prop === 'peek') { this.openPathPicker(); return; }
      this.dispatch(prop === 'locate' ? { type: 'locate' } : { type: 'addMoves' });
    }, C.primary, C.onPrimary, layer, true);
    this.button('先自己试试', 195, top + 284, 230, 48,
      () => this.renderGame(), C.mint, C.text, layer, true);
  }

  private openPathPicker(): void {
    this.renderGame();
    const paths = this.save.game!.level.paths;
    const height = Math.min(this.height - this.top - this.bottom - 24, 180 + Math.ceil(paths.length / 3) * 50);
    const { layer, top } = this.sheet('想看看哪条色路？', '参考 3 秒后自动收起', height);
    this.button('×', 327, top + 24, 40, 40, () => this.renderGame(), C.surface, C.text, layer, true);
    paths.forEach((path, i) => this.button(`色路 ${i + 1}`, 89 + i % 3 * 106, top + 153 + Math.floor(i / 3) * 50,
      96, 44, () => {
        this.dispatch({ type: 'peek', pathId: path.id, nowMs: Date.now() });
        const attemptId = this.save.game!.attempt.id;
        this.scheduleOnce(() => {
          if (this.save.game?.attempt.id !== attemptId) return;
          const result = reduceGame(this.save.game, { type: 'expirePeek', nowMs: Date.now() });
          if (result.changed) {
            this.save.game = result.state; this.persist();
            if (this.screen === 'game') this.renderGame();
          }
        }, 3);
      }, C.lilac, C.text, layer, true));
  }

  private requestVideo(rewardType: 'revive' | 'restock', prop?: Prop): void {
    if (!this.video.available) {
      this.renderGame();
      const { layer, top } = this.sheet('视频还没准备好', this.video.unavailableReason, 280);
      this.button('知道了', 195, top + 197, 260, 48, () => this.renderGame(), C.mint, C.text, layer, true);
      return;
    }
    const requestId = this.nextId('reward');
    const before = this.save.game!;
    const result = reduceGame(before, { type: 'beginReward', requestId, rewardType, prop });
    if (!result.changed) { this.notice = '本次的视频补给次数已用完'; this.renderGame(); return; }
    this.save.game = result.state;
    if (!this.persist()) { this.save.game = before; this.renderGame(); return; }
    this.video.show(outcome => {
      this.pendingSimulation = null;
      this.dispatch({ type: 'settleReward', requestId, outcome });
      if (outcome !== 'completed') {
        this.notice = outcome === 'failed' ? '暂时没有可用视频，可免费重开或稍后再试' : '本次未领取奖励，盘面已保留';
        if (this.screen === 'game') this.renderGame();
      }
    }, (finish, cancel, fail) => {
      this.pendingSimulation = { finish, cancel, fail };
      this.renderGame(); this.showSimulationSheet();
    });
  }

  private showSimulationSheet(): void {
    const callbacks = this.pendingSimulation;
    if (!callbacks) return;
    const { layer, top } = this.sheet('开发预览 · 模拟激励视频', '这里只验证奖励流程\n还没有接入真实广告，也不会产生广告收益', 430);
    this.button('模拟完整看完', 195, top + 193, 280, 56, callbacks.finish, C.primary, C.onPrimary, layer, true);
    this.button('取消，不领取奖励', 195, top + 265, 280, 48, callbacks.cancel, C.mint, C.text, layer, true);
    this.button('模拟加载失败', 195, top + 333, 280, 48, callbacks.fail, C.surface, C.text, layer, true);

  }
}
