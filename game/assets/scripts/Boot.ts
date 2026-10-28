import {
  _decorator, BlockInputEvents, Color, Component, EventTouch, Graphics,
  JsonAsset, Label, Layers, Node, ResolutionPolicy, resources, sys, tween,
  UITransform, view, game as engineGame, Game, Sprite, SpriteFrame, Vec3, Rect, Size,
} from 'cc';
import { Action, adaptLevel, createGame, GameState, LevelDefinition, reduceGame, startLevel, recoverInterruptedGame, PROP_PRICES, canClaimDoubleScore } from './core';
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
import { WinPanel } from './render/WinPanel';

const { ccclass } = _decorator;
type Prop = 'locate' | 'peek' | 'addTime';
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
  private video = new RewardedVideo({ adUnitId: runtimeConfig.rewardedAdUnitId,
    runtime: (globalThis as unknown as { tt?: object }).tt || {} });
  private feedback!: Feedback;
  private bridge!: BrowserTestBridge;
  private homeFrame: SpriteFrame | null = null;
  private splashFrame: SpriteFrame | null = null;
  private iconsFrame: SpriteFrame | null = null;
  private homeArtFrame: SpriteFrame | null = null;
  private winFrame: SpriteFrame | null = null;
  private iconFrames = new Map<string, SpriteFrame>();
  private loading: LoadingScreen | null = null;
  private tutorial: TutorialScreen | null = null;
  private winPanel: WinPanel | null = null;
  private ready = false;
  private screen: 'home' | 'levels' | 'game' | 'shop' | 'tutorial' = 'home';
  private chapterPage = 0;
  private selectedCell: string | null = null;
  private selectedPool: number | null = null;
  private trayPage = 0;
  private modalOpen = false;
  private notice = '';
  private actionBusy = false;
  private idSequence = 0;
  private dismissedFailure: string | null = null;
  private timerLabel: Label | null = null;
  private clockAt = Date.now();
  private clockSavedAt = 0;
  private appHidden = false;

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
    this.bridge = new BrowserTestBridge(runtimeConfig.browserAccessibility, () => ({
      screen: this.loading ? 'loading' : this.screen, modalOpen: this.modalOpen, version: runtimeConfig.version,
      level: this.save.game?.level.number ?? null, status: this.save.game?.attempt.status ?? null,
      remainingTimeMs: this.save.game?.attempt.remainingTimeMs ?? null, points: this.save.game?.wallet.points ?? 0, trayPage: this.trayPage + 1,
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
    const art = ['splash-v2', 'home-v2', 'icons-v2', 'win-rosette-v1'];
    const artworkReady = Promise.all(art.map((name, index) => new Promise<void>(resolve => {
      resources.load(`art/${name}/spriteFrame`, SpriteFrame, (error, frame) => {
        if (!error && frame) {
          if (index === 0) { this.splashFrame = frame; this.loading?.setArtwork(frame); }
          if (index === 1) this.homeFrame = frame;
          if (index === 2) this.iconsFrame = frame;
          if (index === 3) this.winFrame = frame;
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
        if (!this.save.game) this.save.game = createGame(this.levels[0], this.nextId('attempt'));
        this.persist();
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
    this.tutorial?.dispose(); this.loading?.destroy(); this.winPanel?.dispose();
    engineGame.off(Game.EVENT_HIDE, this.suspend, this);
    engineGame.off(Game.EVENT_SHOW, this.resume, this);
    this.video.dispose();
  }

  private resume(): void { this.appHidden = false; this.clockAt = Date.now(); if (this.screen === 'game') {
    this.renderGame();
  } }

  private suspend(): void {
    this.consumeTime(true); this.appHidden = true;
    this.selectedCell = null; this.selectedPool = null;
    if (this.save.game?.attempt.status === 'PreviewingReference')
      this.save.game = recoverInterruptedGame(this.save.game);
    this.persist();
  }

  private nextId(prefix: string): string { return `${prefix}-${Date.now()}-${++this.idSequence}`; }

  update(): void {
    const wasPlaying = this.save.game?.attempt.status === 'Playing';
    this.consumeTime();
    if (wasPlaying && this.save.game?.attempt.status === 'Failed' && this.screen === 'game') this.renderGame();
  }

  private consumeTime(force = false): void {
    const now = Date.now();
    if (!this.ready || this.screen !== 'game' || this.modalOpen || this.appHidden || this.save.game?.attempt.status !== 'Playing') {
      this.clockAt = now; return;
    }
    const deltaMs = Math.max(0, now - this.clockAt);
    if (!force && deltaMs < 200) return;
    this.clockAt = now;
    if (!deltaMs) return;
    this.save.game = reduceGame(this.save.game, { type: 'elapse', deltaMs }).state;
    this.updateTimerLabel();
    if (now - this.clockSavedAt >= 5000 || this.save.game.attempt.status === 'Failed') {
      this.persist(); this.clockSavedAt = now;
    }
  }

  private updateTimerLabel(): void {
    if (!this.timerLabel?.isValid || !this.save.game) return;
    const seconds = Math.ceil(this.save.game.attempt.remainingTimeMs / 1000);
    this.timerLabel.string = `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
    this.timerLabel.color = new Color().fromHEX(seconds <= 10 ? C.warning : C.text);
  }

  private persist(): boolean {
    const stored = this.storage.write(this.save);
    if (!stored || this.storage.error) this.notice = this.storage.error;
    return stored;
  }

  private persistConfirmedReward(retry = 0): void {
    if (this.persist()) return;
    this.notice = '奖励已确认，正在重试保存，请暂时不要关闭游戏';
    if (retry < 3) this.scheduleOnce(() => this.persistConfirmedReward(retry + 1), 2);
    else this.notice = '奖励已确认，但本地保存仍失败，请保留游戏并稍后重试';
  }

  private clear(): void {
    this.timerLabel = null;
    this.tutorial?.dispose(); this.tutorial = null;
    this.winPanel?.dispose(); this.winPanel = null;
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
    const names = ['home', 'tutorial', 'settings', 'shop', 'locate', 'peek', 'addTime', 'undo', 'back', 'next', 'return', 'cancel'];
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
        locate: '✦', peek: '◉', addTime: '+', undo: '↶', back: '‹', next: '›', return: '↧', cancel: '×' };
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
        clearControls: () => this.bridge.clear(), onText: value => this.bridge.text(value), reducedMotion: this.save.settings.reducedMotion });
  }

  private renderHome(): void {
    this.consumeTime(true);
    if (this.screen === 'game') this.persist();
    if (this.save.game?.attempt.status === 'PreviewingReference') {
      this.save.game = reduceGame(this.save.game, { type: 'endPeek' }).state; this.persist();
    }
    this.screen = 'home'; this.clear();
    const mainY = this.height - this.bottom - 206;
    if (this.homeFrame) {
      if (!this.homeArtFrame) {
        const source = this.homeFrame;
        const width = source.originalSize.width, height = source.originalSize.height;
        this.homeArtFrame = new SpriteFrame(); this.homeArtFrame.texture = source.texture;
        this.homeArtFrame.rect = new Rect(0, height * 0.18, width, height * 0.55);
        this.homeArtFrame.originalSize = new Size(width, height * 0.55);
      }
      const artTop = this.top + 144, artBottom = mainY - 49;
      const size = this.homeArtFrame.originalSize;
      const scale = Math.min(374 / size.width, Math.max(100, artBottom - artTop) / size.height);
      this.artwork(this.homeArtFrame, 195, (artTop + artBottom) / 2, size.width * scale, size.height * scale);
    }
    this.round(83, this.top + 21, 122, 36, 18, C.butter);
    this.text(`✦ ${this.save.game?.wallet.points || 0}`, 83, this.top + 21, 116, 30, 14, C.text, true);
    this.iconButton('settings', '设置', 344, this.top + 21, 44, () => this.openSettings());
    this.text('拾色之间', 195, this.top + 69, 304, 62, 38, C.text, true);
    this.text('100 道自然色彩 · 5 段拾色旅程', 195, this.top + 113, 304, 26, 12, C.textSecondary);
    const next = unlockedThrough(this.save, this.levels.map(l => l.id));
    const resume = this.save.game;
    const continuing = resume && resume.attempt.status !== 'Won' && (resume.attempt.elapsedMs > 0 || resume.attempt.movesSpent > 0);
    const levelNumber = continuing ? resume.level.number : next + 1;
    this.round(195, mainY + 5, 310, 62, 28, '#E7B5A2');
    this.button(continuing ? '继续游戏' : '开始游戏', 195, mainY, 310, 62,
      () => continuing ? this.renderGame() : this.enterLevel(next), C.primary, '#FFFFFF');
    this.text(`第 ${levelNumber} 关 · ${this.levels[levelNumber - 1]?.title || '自然的颜色'}`,
      195, mainY + 49, 320, 24, 12, C.textSecondary);
    const cards = [
      { icon: 'home', label: '关卡', fill: C.mint, action: () => { this.chapterPage = Math.floor(next / 20); this.renderLevels(); } },
      { icon: 'tutorial', label: '教程', fill: C.butter, action: () => this.openTutorial() },
      { icon: 'addTime', label: '道具', fill: C.lilac, action: () => this.renderShop() },
    ];
    cards.forEach((card, index) => {
      const x = 83 + index * 112, y = mainY + 129;
      this.round(x, y + 3, 100, 96, 22, '#EDE5DA');
      this.button('', x, y, 100, 96, card.action, card.fill, C.text, this.root, false, card.label);
      this.icon(card.icon, x, y - 13, 66);
      this.text(card.label, x, y + 28, 88, 24, 14, C.text, true);
    });
    this.text(`${this.save.completed.length} / 100`, 195, this.height - this.bottom - 9, 200, 18, 12, C.textSecondary);
  }

  private renderShop(): void {
    this.consumeTime(true); if (this.screen === 'game') this.persist(); this.screen = 'shop'; this.clear();
    this.iconButton('back', '返回首页', 40, this.top + 22, 44, () => this.renderHome());
    this.text('道具', 195, this.top + 20, 190, 36, 24, C.text, true);
    this.round(195, this.top + 80, 184, 44, 22, C.butter);
    this.text(`✦  ${this.save.game?.wallet.points || 0} 积分`, 195, this.top + 80, 180, 40, 17, C.text, true);
    const descriptions = {
      locate: ['点睛', '归位并固定 1 块颜色', '每关最多 2 次'],
      peek: ['窥色', '展示一条完整色路 3 秒', '每关最多 1 次'],
      addTime: ['续时', '为本关增加 30 秒', '每关最多 2 次'],
    };
    (['locate', 'peek', 'addTime'] as Prop[]).forEach((prop, index) => {
      const y = this.top + 175 + index * 133;
      this.round(195, y + 4, 342, 122, 24, '#EBE4D8');
      this.round(195, y, 342, 122, 24, C.surface);
      this.round(79, y - 10, 76, 76, 22, [C.mint, C.lilac, C.butter][index]);
      this.icon(prop, 79, y - 10, 68);
      this.text(descriptions[prop][0], 223, y - 36, 200, 28, 19, C.text, true);
      this.text(descriptions[prop][1], 231, y - 8, 216, 24, 13, C.textSecondary);
      this.text(`库存 ${this.save.game?.wallet.inventory[prop] || 0} · ${descriptions[prop][2]}`,
        217, y + 15, 216, 22, 11, C.textSecondary);
      this.button(`${PROP_PRICES[prop]} 积分购买`, 235, y + 44, 196, 32,
        () => this.buyProp(prop), C.primary, '#FFFFFF', this.root, false, `购买${descriptions[prop][0]}`);
    });
    this.text(this.notice || '通关获得积分，最佳成绩提升还能补发差额', 195,
      this.height - this.bottom - 24, 344, 40, 12, C.textSecondary);
  }

  private buyProp(prop: Prop, inGame = false): void {
    if (!this.save.game) return;
    const before = this.save.game;
    const result = reduceGame(before, { type: 'purchaseProp', prop });
    if (result.changed) {
      this.save.game = result.state;
      if (!this.persist()) { this.save.game = before; this.notice = '保存未成功，积分未扣除，请稍后再试'; }
      else this.notice = '已放入道具背包';
    } else this.notice = result.reason || '积分不足，通关后再来看看';
    if (inGame) { this.renderGame(); this.openProp(prop); }
    else this.renderShop();
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

  private renderLevels(): void {
    this.consumeTime(true);
    if (this.screen === 'game') this.persist();
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
      this.button(`${index + 1}${done ? ' ✓' : ''}`,
        72 + i % 4 * 82, this.top + 157 + Math.floor(i / 4) * 72, 62, 56,
        () => { if (allowed) this.enterLevel(index); else { this.notice = `完成第 ${index} 关后解锁`; this.renderLevels(); } },
        done ? C.mint : allowed ? C.butter : C.disabled, allowed ? C.text : C.textSecondary);
    }
    const pagerY = Math.min(this.height - this.bottom - 46, this.top + 573);
    this.button('上一章', 100, pagerY, 120, 48, () => {
      if (this.chapterPage > 0) { this.chapterPage--; this.renderLevels(); }
    }, C.surface, C.text);
    this.button('下一章', 290, pagerY, 120, 48, () => {
      if (this.chapterPage < 4) { this.chapterPage++; this.renderLevels(); }
    }, C.surface, C.text);
    this.text(this.notice || '完成当前关卡，就能开启下一道风景', 195, this.height - this.bottom, 342, 28, 13, C.textSecondary);
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
    this.consumeTime(true);
    const result = reduceGame(this.save.game, action);
    if (result.changed) {
      this.save.game = result.state;
      this.selectedCell = null; this.selectedPool = null;
      completeLevel(this.save, this.levels.map(l => l.id));
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
    this.consumeTime(true);
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
    this.text(`第 ${level.number} 关`, 152, this.top + 46, 106, 22, 12, C.textSecondary);
    this.round(253, this.top + 47, 92, 30, 15, C.butter);
    this.timerLabel = this.text('', 253, this.top + 47, 88, 30, 17, C.text, true).getComponent(Label);
    this.updateTimerLabel();
    const xy = (cellId: string) => {
      const cell = level.cells.find(c => c.id === cellId)!;
      return { x: boardStartX + cell.x * pitch, y: boardStartY + cell.y * pitch };
    };
    const groupWidth = Math.min(370, Math.max(264, layout.groupWidth + 30));
    this.round(195, layout.groupTop + layout.groupHeight / 2 + 5, groupWidth,
      layout.groupHeight + 36, 27, '#E8E3D7');
    this.round(195, layout.groupTop + layout.groupHeight / 2, groupWidth,
      layout.groupHeight + 36, 27, '#FFFEFB');
    this.round(195, layout.trayTop + layout.trayHeight / 2, Math.min(groupWidth - 12, layout.trayWidth + 18),
      layout.trayHeight + 16, 16, '#F0F1E9');
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
        () => { this.chapterPage = level.chapter - 1; this.renderLevels(); }, C.surface, C.text);
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
    (['locate', 'peek', 'addTime'] as Prop[]).forEach((prop, i) => {
      const names = { locate: '点睛', peek: '窥色', addTime: '续时' };
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
    this.consumeTime(true);
    const state = this.save.game!;
    if (state.attempt.status !== 'Playing') { this.renderGame(); return; }
    if (state.attempt.pool[index]) {
      this.selectedPool = this.selectedPool === index ? null : index;
      this.selectedCell = null; this.notice = ''; this.renderGame();
    } else if (this.selectedCell) {
      this.dispatch({ type: 'returnToTray', fromCellId: this.selectedCell, toPoolIndex: index });
    }
  }

  private tapCell(cellId: string): void {
    this.consumeTime(true);
    const state = this.save.game!;
    if (state.attempt.status !== 'Playing') { this.renderGame(); return; }
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
    this.consumeTime(true);
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
    const state = this.save.game!;
    const attempt = state.attempt;
    this.modalOpen = true; this.bridge.modal();
    this.winPanel?.dispose();
    this.winPanel = new WinPanel({
      parent: this.root, width: 390, height: this.height, safeTop: this.top, safeBottom: this.bottom,
      score: attempt.score || 0, pointsEarned: attempt.pointsEarned, elapsedMs: attempt.elapsedMs,
      movesSpent: attempt.movesSpent, levelNumber: state.level.number, levelTitle: state.level.title,
      doubleAvailable: canClaimDoubleScore(state), artwork: this.winFrame,
      onDouble: () => this.requestVideo('doubleScore'),
      onNext: () => state.level.number < 100 ? this.enterLevel(state.level.number) : this.renderLevels(),
      onHome: () => this.renderHome(),
      registerControl: (label, invoke, bounds) => this.bridge.control(label, invoke, bounds),
      onText: value => this.bridge.text(value),
    });
  }

  private openFail(): void {
    const state = this.save.game!;
    const max = state.level.challenge.revive.maxPerAttempt;
    const canRevive = state.attempt.revivesUsed < max;
    const entitlement = state.wallet.pendingRevives[0];
    const { layer, top } = this.sheet('时间到了', '当前盘面已保留，复活后接着完成', 414);
    this.button('×', 327, top + 24, 40, 40, () => {
      this.dismissedFailure = state.attempt.id; this.renderGame();
    }, C.surface, C.text, layer, true);
    this.text(`本关还可复活 ${Math.max(0, max - state.attempt.revivesUsed)} 次`, 195, top + 142,
      290, 26, 13, C.textSecondary, false, layer);
    if (canRevive) {
      this.button(entitlement ? `使用已获得的 +${entitlement.amount} 秒` : `▷ 看视频复活 +${state.level.challenge.revive.addSeconds} 秒`,
        195, top + 196, 288, 56, () => {
          this.dismissedFailure = null;
          if (entitlement) this.dispatch({ type: 'applyPendingRevive', requestId: entitlement.requestId });
          else this.requestVideo('revive');
        }, C.primary, '#FFFFFF', layer, true);
    } else this.text('本关复活次数已用完', 195, top + 196, 288, 56, 16, C.textSecondary, false, layer);
    this.button('免费重新开始', 195, top + 268, 288, 48,
      () => this.dispatch({ type: 'restart', attemptId: this.nextId('attempt') }), C.mint, C.text, layer, true);
    this.button('返回关卡', 195, top + 335, 220, 48,
      () => { this.chapterPage = state.level.chapter - 1; this.renderLevels(); }, C.surface, C.textSecondary, layer, true);
  }

  private openProp(prop: Prop): void {
    this.consumeTime(true);
    const state = this.save.game!;
    if (state.attempt.status !== 'Playing') { this.renderGame(); return; }
    const names = { locate: '点睛', peek: '窥色', addTime: '续时' };
    const descriptions = { locate: '归位并固定 1 块颜色', peek: '选择一条色路，展示完整颜色 3 秒', addTime: '为本关倒计时增加 30 秒' };
    const { layer, top } = this.sheet(names[prop], descriptions[prop], 430);
    const limits = { locate: 2, peek: 1, addTime: 2 };
    const usesLeft = limits[prop] - state.attempt.propUses[prop];
    const stock = state.wallet.inventory[prop];
    this.text(`库存 ${stock} · 本关还可用 ${usesLeft} 次`, 195, top + 142, 290, 28, 14, C.textSecondary, false, layer);
    this.text(this.notice || `积分余额 ${state.wallet.points}`, 195, top + 173, 290, 26, 13, C.textSecondary, false, layer);
    if (usesLeft <= 0) this.text('本关使用次数已用完', 195, top + 225, 280, 48, 16, C.textSecondary, false, layer);
    else this.button(stock > 0 ? '使用道具' : `${PROP_PRICES[prop]} 积分购买 1 个`, 195, top + 225, 280, 50, () => {
      if (stock <= 0) { this.buyProp(prop, true); return; }
      this.notice = '';
      if (prop === 'peek') { this.openPathPicker(); return; }
      this.dispatch(prop === 'locate' ? { type: 'locate' } : { type: 'addTime' });
    }, C.primary, '#FFFFFF', layer, true);
    if (state.attempt.propRestockAdsGranted < 1 && stock === 0 && usesLeft > 0)
      this.button('▷ 看视频领取 1 个', 195, top + 293, 280, 48,
        () => this.requestVideo('restock', prop), C.butter, C.text, layer, true);
    else this.button(`积分购买 · ${PROP_PRICES[prop]} 分`, 195, top + 293, 280, 48,
      () => this.buyProp(prop, true), C.lilac, C.text, layer, true);
    this.button('继续游戏', 195, top + 365, 230, 44,
      () => { this.notice = ''; this.renderGame(); }, C.surface, C.text, layer, true);
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

  private requestVideo(rewardType: 'revive' | 'restock' | 'doubleScore', prop?: Prop): void {
    if (!this.video.available) {
      this.renderGame();
      const { layer, top } = this.sheet('广告暂不可用', '激励视频广告位尚未开通，开通后即可领取奖励', 280);
      this.button('返回游戏', 195, top + 197, 260, 48, () => this.renderGame(), C.mint, C.text, layer, true);
      return;
    }
    const requestId = this.nextId('reward');
    const before = this.save.game!;
    const result = reduceGame(before, { type: 'beginReward', requestId, rewardType, prop });
    if (!result.changed) { this.notice = result.reason || '本次奖励暂不可领取'; this.renderGame(); return; }
    this.save.game = result.state;
    if (!this.persist()) { this.save.game = before; this.renderGame(); return; }
    this.renderGame();
    this.sheet('正在准备视频', '完整观看后发放奖励；提前关闭不会扣除道具或积分', 240);
    this.video.show(outcome => {
      if (!this.save.game) return;
      const settled = reduceGame(this.save.game, { type: 'settleReward', requestId, outcome });
      this.save.game = settled.state;
      this.notice = outcome === 'completed' ? '' : outcome === 'failed'
        ? '视频暂不可用，盘面和库存已保留' : '未完整观看，本次没有领取奖励';
      if (outcome === 'completed') this.persistConfirmedReward();
      else this.persist();
      if (this.screen === 'game') this.renderGame();
      else if (this.screen === 'shop') this.renderShop();
      else this.renderHome();
    });
  }
}
