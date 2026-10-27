System.register("chunks:///_virtual/BoardLayout.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports('boardLayout', boardLayout);
      cclegacy._RF.push({}, "cb500mLWNhGebAmSgYOQIHD", "BoardLayout", undefined);
      /** Pure layout in the 390-wide design coordinate system; tray pages keep stable slot indices. */
      function boardLayout(height, safeTop, safeBottom, columns, rows, trayCount) {
        var gap = 6;
        var reservedBoardTop = safeTop + 110;
        var propsY = height - safeBottom - 32;
        var actionsY = propsY - 58;
        var pagerY = actionsY - 48;
        var trayBottom = pagerY - 24;
        var trayColumns = Math.min(6, Math.max(1, trayCount));
        var trayRows = Math.min(3, Math.max(1, Math.ceil(trayCount / trayColumns)));
        var boardSize = function boardSize(visibleTrayRows) {
          var trayHeight = visibleTrayRows * 44 + (visibleTrayRows - 1) * gap;
          var available = trayBottom - trayHeight - 40 - reservedBoardTop;
          return Math.min(52, (342 - (columns - 1) * gap) / columns, (available - (rows - 1) * gap) / rows);
        };
        while (trayRows > 1 && boardSize(trayRows) < 44) trayRows--;
        var cellSize = Math.max(24, boardSize(trayRows));
        var boardHeight = rows * cellSize + (rows - 1) * gap;
        var trayHeight = trayRows * 44 + (trayRows - 1) * gap;
        var trayTop = trayBottom - trayHeight;
        var boardTop = reservedBoardTop + Math.max(0, (trayTop - 40 - reservedBoardTop - boardHeight) / 2);
        return {
          cellSize: cellSize,
          pitch: cellSize + gap,
          boardTop: boardTop,
          boardHeight: boardHeight,
          boardStartX: 195 - (columns - 1) * (cellSize + gap) / 2,
          boardStartY: boardTop + cellSize / 2,
          trayColumns: trayColumns,
          trayRows: trayRows,
          trayCellSize: 44,
          trayPitch: 50,
          trayTop: trayTop,
          trayHeight: trayHeight,
          trayLabelY: trayTop - 18,
          slotsPerPage: trayColumns * trayRows,
          propsY: propsY,
          actionsY: actionsY,
          pagerY: pagerY,
          compact: cellSize < 44
        };
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/Boot.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './index.ts', './Progress.ts', './LocalSave.ts', './RewardedVideo.ts', './Theme.ts', './BoardLayout.ts', './Feedback.ts', './BrowserTestBridge.ts', './RuntimeConfig.ts'], function (exports) {
  var _inheritsLoose, _extends, _createForOfIteratorHelperLoose, cclegacy, _decorator, view, ResolutionPolicy, sys, resources, SpriteFrame, Node, Layers, UITransform, game, Game, JsonAsset, Graphics, Color, Label, tween, Vec3, Sprite, BlockInputEvents, Component, adaptLevel, recoverInterruptedGame, reduceGame, createGame, startLevel, unlockedThrough, emptyProgress, completeLevel, LocalSave, RewardedVideo, theme, boardLayout, Feedback, BrowserTestBridge, runtimeConfig;
  return {
    setters: [function (module) {
      _inheritsLoose = module.inheritsLoose;
      _extends = module.extends;
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      _decorator = module._decorator;
      view = module.view;
      ResolutionPolicy = module.ResolutionPolicy;
      sys = module.sys;
      resources = module.resources;
      SpriteFrame = module.SpriteFrame;
      Node = module.Node;
      Layers = module.Layers;
      UITransform = module.UITransform;
      game = module.game;
      Game = module.Game;
      JsonAsset = module.JsonAsset;
      Graphics = module.Graphics;
      Color = module.Color;
      Label = module.Label;
      tween = module.tween;
      Vec3 = module.Vec3;
      Sprite = module.Sprite;
      BlockInputEvents = module.BlockInputEvents;
      Component = module.Component;
    }, function (module) {
      adaptLevel = module.adaptLevel;
      recoverInterruptedGame = module.recoverInterruptedGame;
      reduceGame = module.reduceGame;
      createGame = module.createGame;
      startLevel = module.startLevel;
    }, function (module) {
      unlockedThrough = module.unlockedThrough;
      emptyProgress = module.emptyProgress;
      completeLevel = module.completeLevel;
    }, function (module) {
      LocalSave = module.LocalSave;
    }, function (module) {
      RewardedVideo = module.RewardedVideo;
    }, function (module) {
      theme = module.theme;
    }, function (module) {
      boardLayout = module.boardLayout;
    }, function (module) {
      Feedback = module.Feedback;
    }, function (module) {
      BrowserTestBridge = module.BrowserTestBridge;
    }, function (module) {
      runtimeConfig = module.runtimeConfig;
    }],
    execute: function () {
      var _dec, _class;
      cclegacy._RF.push({}, "9033czfhnpGFICdIXt9R6HG", "Boot", undefined);
      var ccclass = _decorator.ccclass;
      var C = theme.colors;

      /** One scene, engine-native UI, and a pure state reducer: no DOM / web framework. */
      var ShiseBoot = exports('ShiseBoot', (_dec = ccclass('ShiseBoot'), _dec(_class = /*#__PURE__*/function (_Component) {
        _inheritsLoose(ShiseBoot, _Component);
        function ShiseBoot() {
          var _this;
          for (var _len = arguments.length, args = new Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }
          _this = _Component.call.apply(_Component, [this].concat(args)) || this;
          _this.root = void 0;
          _this.height = 844;
          _this.top = 24;
          _this.bottom = 20;
          _this.levels = [];
          _this.save = emptyProgress('');
          _this.storage = new LocalSave();
          _this.video = new RewardedVideo({
            adUnitId: runtimeConfig.rewardedAdUnitId
          });
          _this.feedback = void 0;
          _this.bridge = void 0;
          _this.brandFrame = null;
          _this.ready = false;
          _this.testOriginal = null;
          _this.collectionPage = 0;
          _this.pendingSimulation = null;
          _this.screen = 'home';
          _this.chapterPage = 0;
          _this.selectedCell = null;
          _this.selectedPool = null;
          _this.trayPage = 0;
          _this.modalOpen = false;
          _this.notice = '';
          _this.actionBusy = false;
          _this.idSequence = 0;
          _this.dismissedFailure = null;
          return _this;
        }
        var _proto = ShiseBoot.prototype;
        _proto.onLoad = function onLoad() {
          var _this2 = this;
          var frame = view.getFrameSize();
          view.setDesignResolutionSize(390, 844, frame.width / frame.height > 0.65 ? ResolutionPolicy.SHOW_ALL : ResolutionPolicy.FIXED_WIDTH);
          this.height = view.getVisibleSize().height;
          var safe = sys.getSafeAreaRect(false);
          this.top = Math.max(24, this.height - safe.yMax + 12);
          this.bottom = Math.max(20, safe.yMin + 12);
          try {
            var tt = globalThis.tt;
            var menu = tt == null || tt.getMenuButtonBoundingClientRect == null ? void 0 : tt.getMenuButtonBoundingClientRect();
            var width = tt == null || tt.getSystemInfoSync == null ? void 0 : tt.getSystemInfoSync().windowWidth;
            if (menu && width) this.top = Math.max(this.top, menu.bottom * 390 / width + 10);
          } catch (_unused) {/* The safe-area fallback remains valid on hosts without a capsule API. */}
          this.feedback = new Feedback(this.node);
          this.bridge = new BrowserTestBridge(runtimeConfig.testTools, function () {
            var _this2$save$game$leve, _this2$save$game, _this2$save$game$atte, _this2$save$game2, _this2$save$game$atte2, _this2$save$game3, _this2$save$game$wall, _this2$save$game4;
            return {
              screen: _this2.screen,
              testSession: !!_this2.testOriginal,
              modalOpen: _this2.modalOpen,
              level: (_this2$save$game$leve = (_this2$save$game = _this2.save.game) == null ? void 0 : _this2$save$game.level.number) != null ? _this2$save$game$leve : null,
              status: (_this2$save$game$atte = (_this2$save$game2 = _this2.save.game) == null ? void 0 : _this2$save$game2.attempt.status) != null ? _this2$save$game$atte : null,
              moves: (_this2$save$game$atte2 = (_this2$save$game3 = _this2.save.game) == null ? void 0 : _this2$save$game3.attempt.remainingMoves) != null ? _this2$save$game$atte2 : null,
              trayPage: _this2.trayPage + 1,
              inventory: (_this2$save$game$wall = (_this2$save$game4 = _this2.save.game) == null ? void 0 : _this2$save$game4.wallet.inventory) != null ? _this2$save$game$wall : null,
              completed: _this2.save.completed.length
            };
          }, this.height);
          resources.load('art/brand/spriteFrame', SpriteFrame, function (error, frame) {
            if (!error && frame) {
              _this2.brandFrame = frame;
              if (_this2.ready && _this2.screen === 'home') _this2.renderHome();
            }
          });
          this.root = new Node('ShiseUI');
          this.root.layer = Layers.Enum.UI_2D;
          this.root.addComponent(UITransform).setContentSize(390, this.height);
          this.node.addChild(this.root);
          game.on(Game.EVENT_HIDE, this.suspend, this);
          game.on(Game.EVENT_SHOW, this.resume, this);
          this.renderLoading();
          resources.load('generated/levels', JsonAsset, function (error, asset) {
            if (error || !asset) {
              _this2.clear();
              _this2.text('颜色还没准备好', 195, _this2.height / 2 - 24, 280, 30, 22);
              _this2.text('请检查 generated/levels 资源', 195, _this2.height / 2 + 16, 300, 40, 14, C.textSecondary);
              return;
            }
            try {
              var content = asset.json;
              _this2.levels = content.levels.map(adaptLevel);
              _this2.save = _this2.storage.load(content.contentVersion, _this2.levels);
              _this2.ready = true;
              // Only valid level versions can be resumed; do not reinterpret old boards.
              if (_this2.save.game && !_this2.levels.some(function (l) {
                return l.id === _this2.save.game.level.id;
              })) _this2.save.game = null;
              if (!_this2.save.game && _this2.save.completed.length === 0) _this2.enterLevel(0);else _this2.renderHome();
            } catch (error) {
              console.error('[Shise] Failed to adapt level content', error);
              _this2.clear();
              _this2.text('题库版本需要更新', 195, _this2.height / 2, 300, 40, 22);
            }
          });
        };
        _proto.onDestroy = function onDestroy() {
          game.off(Game.EVENT_HIDE, this.suspend, this);
          game.off(Game.EVENT_SHOW, this.resume, this);
          this.video.dispose();
        };
        _proto.resume = function resume() {
          if (this.screen === 'game') {
            var _this$save$game;
            this.renderGame();
            if (((_this$save$game = this.save.game) == null ? void 0 : _this$save$game.attempt.status) === 'AdPending' && this.pendingSimulation) this.showSimulationSheet();
          }
        };
        _proto.suspend = function suspend() {
          var _this$save$game2;
          this.selectedCell = null;
          this.selectedPool = null;
          if (((_this$save$game2 = this.save.game) == null ? void 0 : _this$save$game2.attempt.status) === 'PreviewingReference') this.save.game = recoverInterruptedGame(this.save.game);
          this.persist();
        };
        _proto.nextId = function nextId(prefix) {
          return prefix + "-" + Date.now() + "-" + ++this.idSequence;
        };
        _proto.persist = function persist() {
          if (this.testOriginal) return true;
          var stored = this.storage.write(this.save);
          if (!stored || this.storage.error) this.notice = this.storage.error;
          return stored;
        };
        _proto.clear = function clear() {
          this.bridge.clear();
          for (var _i = 0, _arr = [].concat(this.root.children); _i < _arr.length; _i++) {
            var node = _arr[_i];
            node.removeFromParent();
            node.destroy();
          }
          this.modalOpen = false;
          this.round(195, this.height / 2, 392, this.height + 2, 0, C.background);
        };
        _proto.element = function element(name, x, y, width, height, parent) {
          if (parent === void 0) {
            parent = this.root;
          }
          var node = new Node(name);
          node.layer = Layers.Enum.UI_2D;
          node.addComponent(UITransform).setContentSize(width, height);
          node.setPosition(x - 195, this.height / 2 - y);
          parent.addChild(node);
          return node;
        };
        _proto.round = function round(x, y, width, height, radius, hex, parent, stroke) {
          if (parent === void 0) {
            parent = this.root;
          }
          var node = this.element('Shape', x, y, width, height, parent);
          var g = node.addComponent(Graphics);
          g.fillColor = new Color().fromHEX(hex);
          g.roundRect(-width / 2, -height / 2, width, height, Math.min(radius, height / 2, width / 2));
          g.fill();
          if (stroke) {
            g.strokeColor = new Color().fromHEX(stroke);
            g.lineWidth = 2;
            g.stroke();
          }
          return node;
        };
        _proto.text = function text(value, x, y, width, height, size, color, bold, parent) {
          if (size === void 0) {
            size = 16;
          }
          if (color === void 0) {
            color = C.text;
          }
          if (bold === void 0) {
            bold = false;
          }
          if (parent === void 0) {
            parent = this.root;
          }
          this.bridge.text(value);
          var node = this.element('Text', x, y, width, height, parent);
          var label = node.addComponent(Label);
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
        };
        _proto.button = function button(value, x, y, width, height, onTap, fill, color, parent, modalButton) {
          var _this3 = this;
          if (fill === void 0) {
            fill = C.primary;
          }
          if (color === void 0) {
            color = C.onPrimary;
          }
          if (parent === void 0) {
            parent = this.root;
          }
          if (modalButton === void 0) {
            modalButton = false;
          }
          var node = this.round(x, y, width, height, theme.radii.button, fill, parent);
          // Label and shape share the same center; labels deliberately do not carry input.
          var label = new Node('Label');
          label.layer = Layers.Enum.UI_2D;
          label.addComponent(UITransform).setContentSize(width - 16, height);
          var component = label.addComponent(Label);
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
          node.on(Node.EventType.TOUCH_START, function () {
            if ((!_this3.modalOpen || modalButton) && !_this3.save.settings.reducedMotion) tween(node).to(0.09, {
              scale: new Vec3(0.97, 0.97, 1)
            }).start();
          });
          var release = function release() {
            if (_this3.save.settings.reducedMotion) node.setScale(1, 1, 1);else tween(node).to(0.09, {
              scale: new Vec3(1, 1, 1)
            }).start();
          };
          var invoke = function invoke() {
            if ((!_this3.modalOpen || modalButton) && !_this3.actionBusy) onTap();
          };
          this.bridge.control(value, invoke, {
            x: x,
            y: y,
            width: width,
            height: height
          });
          node.on(Node.EventType.TOUCH_CANCEL, release);
          node.on(Node.EventType.TOUCH_END, function (event) {
            event.propagationStopped = true;
            release();
            invoke();
          });
          return node;
        };
        _proto.renderLoading = function renderLoading() {
          this.clear();
          this.hero(this.height * 0.42);
          this.text('拾色之间', 195, this.height * 0.62, 300, 48, 30, C.text, true);
          this.text('正在拾起自然的颜色…', 195, this.height * 0.69, 300, 30, 15, C.textSecondary);
        };
        _proto.hero = function hero(centerY) {
          var _this4 = this;
          if (this.brandFrame) {
            var icon = this.element('Brand', 195, centerY, 218, 218);
            var sprite = icon.addComponent(Sprite);
            sprite.sizeMode = Sprite.SizeMode.CUSTOM;
            sprite.spriteFrame = this.brandFrame;
            icon.getComponent(UITransform).setContentSize(218, 218);
            return;
          }
          this.round(133, centerY - 50, 146, 146, 72, C.butter);
          this.round(251, centerY + 34, 144, 144, 72, C.mint);
          var colors = ['#F4AD82', '#EC8D91', '#C9B4E3', '#F3D593', '#B9D9B7', '#9CCADD', '#F1C6A8', '#A6D7CB', '#B5B2DF'];
          colors.forEach(function (hex, i) {
            var x = 139 + i % 3 * 56;
            var y = centerY - 56 + Math.floor(i / 3) * 56;
            var tile = _this4.round(x, y, 48, 48, 12, hex);
            if (i === 2) tile.setRotationFromEuler(0, 0, -9);
          });
        };
        _proto.renderHome = function renderHome() {
          var _this$save$game3,
            _this5 = this,
            _this$levels;
          if (this.testOriginal) {
            this.save = this.testOriginal;
            this.testOriginal = null;
          }
          if (((_this$save$game3 = this.save.game) == null ? void 0 : _this$save$game3.attempt.status) === 'PreviewingReference') {
            this.save.game = reduceGame(this.save.game, {
              type: 'endPeek'
            }).state;
            this.persist();
          }
          this.screen = 'home';
          this.clear();
          this.button('⚙', 339, this.top + 22, 48, 48, function () {
            return _this5.openSettings();
          }, C.surface, C.text);
          this.text('今天，也拾一点好颜色', 177, this.top + 28, 280, 32, 15, C.textSecondary);
          this.hero(this.height * 0.31);
          this.text('拾色之间', 195, this.height * 0.50, 320, 50, 32, C.text, true);
          this.text('把散落的颜色，一点点放回美好', 195, this.height * 0.56, 340, 30, 15, C.textSecondary);
          var next = unlockedThrough(this.save, this.levels.map(function (l) {
            return l.id;
          }));
          var resume = this.save.game;
          var continuing = resume && resume.attempt.status !== 'Won';
          var levelNumber = continuing ? resume.level.number : next + 1;
          this.button(continuing ? '继续拾色  ›' : '开始拾色  ›', 195, this.height * 0.66, 280, 56, function () {
            return continuing ? _this5.renderGame() : _this5.enterLevel(next);
          });
          this.text("\u7B2C " + levelNumber + " \u5173 \xB7 " + (((_this$levels = this.levels[levelNumber - 1]) == null ? void 0 : _this$levels.title) || '自然的颜色'), 195, this.height * 0.66 + 45, 320, 28, 13, C.textSecondary);
          this.button('色彩旅程', 112, this.height * 0.80, 144, 52, function () {
            _this5.chapterPage = Math.floor(next / 20);
            _this5.renderLevels();
          }, C.mint, C.text);
          this.button('色谱收藏', 278, this.height * 0.80, 144, 52, function () {
            _this5.collectionPage = 0;
            _this5.renderCollection();
          }, C.lilac, C.text);
          this.text("\u5DF2\u62FE\u8D77 " + this.save.completed.length + " / 100 \u9053\u98CE\u666F", 195, this.height - this.bottom - 50, 300, 24, 13, C.textSecondary);
          if (runtimeConfig.testTools) this.button('体验版 · 测试工具', 195, this.height - this.bottom - 12, 216, 32, function () {
            return _this5.openTestTools();
          }, C.surface, C.textSecondary);
        };
        _proto.openSettings = function openSettings() {
          var _this6 = this;
          var _this$sheet = this.sheet('留一点安静给自己', '随时调整，不影响游戏进度', 414),
            layer = _this$sheet.layer,
            top = _this$sheet.top;
          var labels = {
            sound: '轻音效',
            haptics: '轻触反馈',
            reducedMotion: '减少动效'
          };
          ['sound', 'haptics', 'reducedMotion'].forEach(function (key, i) {
            _this6.button(labels[key] + "   " + (_this6.save.settings[key] ? '已开启' : '已关闭'), 195, top + 157 + i * 57, 280, 48, function () {
              _this6.save.settings[key] = !_this6.save.settings[key];
              _this6.persist();
              _this6.renderHome();
              _this6.openSettings();
            }, _this6.save.settings[key] ? C.mint : C.disabled, C.text, layer, true);
          });
          this.button('好了，继续拾色', 195, top + 348, 280, 48, function () {
            return _this6.renderHome();
          }, C.primary, C.onPrimary, layer, true);
        };
        _proto.renderCollection = function renderCollection() {
          var _this7 = this;
          this.screen = 'collection';
          this.clear();
          this.button('‹', 40, this.top + 24, 48, 48, function () {
            return _this7.renderHome();
          }, C.surface, C.text);
          this.text('我的色谱收藏', 195, this.top + 26, 250, 40, 22, C.text, true);
          var completed = this.levels.filter(function (level) {
            return _this7.save.completed.includes(level.id);
          });
          if (!completed.length) {
            this.hero(this.height * 0.36);
            this.text('还没有收下第一道风景', 195, this.height * 0.60, 330, 36, 20);
            this.text('完成关卡，就能把它的颜色留在这里', 195, this.height * 0.66, 342, 32, 14, C.textSecondary);
            this.button('去拾色', 195, this.height * 0.77, 260, 52, function () {
              return _this7.enterLevel(0);
            });
            return;
          }
          var pageSize = Math.max(2, Math.min(4, Math.floor((this.height - this.top - this.bottom - 190) / 122)));
          var pages = Math.ceil(completed.length / pageSize);
          this.collectionPage = Math.min(this.collectionPage, pages - 1);
          completed.slice(this.collectionPage * pageSize, (this.collectionPage + 1) * pageSize).forEach(function (level, i) {
            var y = _this7.top + 144 + i * 122;
            _this7.round(195, y, 342, 102, 20, C.surface);
            _this7.text(level.number + " \xB7 " + level.title, 195, y - 27, 310, 28, 16, C.text, true);
            var sample = level.cells.filter(function (_, index) {
              return index % Math.max(1, Math.floor(level.cells.length / 8)) === 0;
            }).slice(0, 8);
            sample.forEach(function (cell, j) {
              return _this7.round(195 + (j - (sample.length - 1) / 2) * 34, y + 14, 30, 30, 6, cell.targetHex);
            });
          });
          this.button('上一页', 85, this.height - this.bottom - 36, 110, 48, function () {
            if (_this7.collectionPage > 0) {
              _this7.collectionPage--;
              _this7.renderCollection();
            }
          }, C.surface, C.text);
          this.text(this.collectionPage + 1 + " / " + pages, 195, this.height - this.bottom - 36, 70, 32, 14);
          this.button('下一页', 305, this.height - this.bottom - 36, 110, 48, function () {
            if (_this7.collectionPage + 1 < pages) {
              _this7.collectionPage++;
              _this7.renderCollection();
            }
          }, C.surface, C.text);
        };
        _proto.openTestTools = function openTestTools() {
          var _this8 = this;
          var _this$sheet2 = this.sheet('体验版测试工具', '独立测试局，不影响正式进度和库存', 478),
            layer = _this$sheet2.layer,
            top = _this$sheet2.top;
          [1, 5, 12, 44, 72, 100].forEach(function (number, i) {
            return _this8.button("\u8BD5\u7B2C " + number + " \u5173", 118 + i % 2 * 154, top + 156 + Math.floor(i / 2) * 62, 142, 48, function () {
              return _this8.enterTestLevel(number - 1);
            }, i > 3 ? C.lilac : C.mint, C.text, layer, true);
          });
          this.text('每个测试局提供少量道具；限步与复活按原规则', 195, top + 347, 304, 50, 13, C.textSecondary, false, layer);
          this.button('返回游戏', 195, top + 416, 260, 48, function () {
            return _this8.renderHome();
          }, C.primary, C.onPrimary, layer, true);
        };
        _proto.enterTestLevel = function enterTestLevel(index) {
          if (!runtimeConfig.testTools) return;
          if (!this.testOriginal) this.testOriginal = this.save;
          var settings = _extends({}, this.save.settings);
          this.save = emptyProgress(this.testOriginal.contentVersion);
          this.save.settings = settings;
          this.save.game = createGame(this.levels[index], this.nextId('test'), {
            locate: 3,
            peek: 2,
            addMoves: 1
          });
          this.selectedPool = null;
          this.selectedCell = null;
          this.trayPage = 0;
          this.notice = '';
          this.renderGame();
        };
        _proto.renderLevels = function renderLevels() {
          var _this9 = this;
          this.screen = 'levels';
          this.clear();
          this.button('‹', 40, this.top + 24, 48, 48, function () {
            return _this9.renderHome();
          }, C.surface, C.text);
          var first = this.levels[this.chapterPage * 20];
          this.text("\u7B2C " + (this.chapterPage + 1) + " \u7AE0 \xB7 " + first.chapterName, 195, this.top + 26, 260, 40, 20, C.text, true);
          this.text('一关一关，拾起沿途的颜色', 195, this.top + 78, 320, 30, 15, C.textSecondary);
          var unlocked = unlockedThrough(this.save, this.levels.map(function (l) {
            return l.id;
          }));
          var _loop = function _loop() {
            var index = _this9.chapterPage * 20 + i;
            var level = _this9.levels[index];
            var allowed = index <= unlocked;
            var done = _this9.save.completed.includes(level.id);
            _this9.button(allowed ? "" + (index + 1) + (done ? ' ✓' : '') : '·', 72 + i % 4 * 82, _this9.top + 157 + Math.floor(i / 4) * 72, 62, 56, function () {
              if (allowed) _this9.enterLevel(index);
            }, done ? C.mint : allowed ? C.butter : C.disabled, allowed ? C.text : C.textSecondary);
          };
          for (var i = 0; i < 20; i++) {
            _loop();
          }
          var pagerY = Math.min(this.height - this.bottom - 46, this.top + 573);
          this.button('上一章', 100, pagerY, 120, 48, function () {
            if (_this9.chapterPage > 0) {
              _this9.chapterPage--;
              _this9.renderLevels();
            }
          }, C.surface, C.text);
          this.button('下一章', 290, pagerY, 120, 48, function () {
            if (_this9.chapterPage < 4) {
              _this9.chapterPage++;
              _this9.renderLevels();
            }
          }, C.surface, C.text);
          this.text('完成当前关卡，就能开启下一道风景', 195, this.height - this.bottom, 342, 28, 13, C.textSecondary);
        };
        _proto.enterLevel = function enterLevel(index) {
          var allowed = unlockedThrough(this.save, this.levels.map(function (l) {
            return l.id;
          }));
          if (index < 0 || index >= this.levels.length || index > allowed) return;
          this.save.game = this.save.game ? startLevel(this.save.game, this.levels[index], this.nextId('attempt')) : createGame(this.levels[index], this.nextId('attempt'));
          this.selectedCell = null;
          this.selectedPool = null;
          this.notice = '';
          this.trayPage = 0;
          this.persist();
          this.renderGame();
        };
        _proto.dispatch = function dispatch(action) {
          if (!this.save.game || this.actionBusy) return;
          var result = reduceGame(this.save.game, action);
          if (result.changed) {
            this.save.game = result.state;
            this.selectedCell = null;
            this.selectedPool = null;
            if (!this.testOriginal) completeLevel(this.save, this.levels.map(function (l) {
              return l.id;
            }));
            if (['place', 'move', 'locate'].includes(action.type)) this.feedback.play(result.state.attempt.status === 'Won' ? 'complete' : 'place', this.save.settings.sound, this.save.settings.haptics);
            this.notice = '';
            this.persist();
          } else if (result.reason) {
            this.notice = this.friendlyReason(result.reason);
          }
          this.renderGame();
        };
        _proto.friendlyReason = function friendlyReason(reason) {
          if (/stock|inventory/i.test(reason)) return '这个道具用完啦';
          if (/limit|maximum/i.test(reason)) return '这次的使用次数已用完';
          if (/lock|anchor/i.test(reason)) return '小圆点标记的颜色已经固定';
          return reason;
        };
        _proto.renderGame = function renderGame() {
          var _this10 = this,
            _level$paths$find$cel,
            _level$paths$find;
          if (!this.save.game) {
            this.renderHome();
            return;
          }
          this.screen = 'game';
          this.clear();
          var state = this.save.game;
          var level = state.level,
            attempt = state.attempt;
          var layout = boardLayout(this.height, this.top, this.bottom, level.grid.columns, level.grid.rows, attempt.pool.length);
          var cellSize = layout.cellSize,
            pitch = layout.pitch,
            boardStartX = layout.boardStartX,
            boardStartY = layout.boardStartY;
          this.button('‹', 40, this.top + 24, 48, 48, function () {
            _this10.selectedCell = null;
            _this10.selectedPool = null;
            _this10.renderHome();
          }, C.surface, C.text);
          this.button('•••', 350, this.top + 24, 44, 44, function () {
            return _this10.openGameMenu();
          }, C.surface, C.text);
          this.text("" + (this.testOriginal ? '测试 · ' : '') + level.number + "  " + level.title, 195, this.top + 16, 244, 32, 20, C.text, true);
          this.text("\u7B2C " + level.chapter + " \u7AE0 \xB7 " + level.chapterName, 195, this.top + 46, 244, 24, 13, C.textSecondary);
          this.round(195, this.top + 78, 154, 36, 18, C.mint);
          this.text(attempt.remainingMoves === null ? '慢慢填，慢慢看' : "\u5269\u4F59 " + attempt.remainingMoves + " \u6B65", 195, this.top + 78, 154, 36, 17, attempt.remainingMoves !== null && attempt.remainingMoves <= 3 ? C.warning : C.text);
          var xy = function xy(cellId) {
            var cell = level.cells.find(function (c) {
              return c.id === cellId;
            });
            return {
              x: boardStartX + cell.x * pitch,
              y: boardStartY + cell.y * pitch
            };
          };
          this.round(195, layout.boardTop + layout.boardHeight / 2, 356, layout.boardHeight + 12, 16, C.boardBackground);
          var tracks = this.element('Tracks', 195, 0, 390, this.height);
          tracks.setPosition(0, this.height / 2);
          var g = tracks.addComponent(Graphics);
          g.strokeColor = new Color().fromHEX(C.track);
          g.lineWidth = 2;
          level.paths.forEach(function (path) {
            path.cellIds.forEach(function (id, i) {
              var p = xy(id);
              if (!i) g.moveTo(p.x - 195, -p.y);else g.lineTo(p.x - 195, -p.y);
            });
            g.stroke();
          });
          var tileHex = function tileHex(id) {
            var _level$tiles$find;
            return ((_level$tiles$find = level.tiles.find(function (t) {
              return t.id === id;
            })) == null ? void 0 : _level$tiles$find.hex) || C.surface;
          };
          var previewCells = attempt.preview ? (_level$paths$find$cel = (_level$paths$find = level.paths.find(function (path) {
            return path.id === attempt.preview.pathId;
          })) == null ? void 0 : _level$paths$find.cellIds) != null ? _level$paths$find$cel : [] : [];
          var _loop3 = function _loop3() {
            var cell = _step.value;
            var p = xy(cell.id);
            var tile = attempt.board[cell.id];
            var locked = level.anchors.includes(cell.id) || attempt.auxiliaryLocks.includes(cell.id);
            var hex = previewCells.includes(cell.id) ? cell.targetHex : tileHex(tile);
            if (_this10.selectedCell === cell.id) _this10.round(p.x, p.y, cellSize + 6, cellSize + 6, 11, C.selection);
            var node = _this10.round(p.x, p.y, cellSize, cellSize, theme.radii.tile, hex, _this10.root, tile === null && !previewCells.includes(cell.id) ? C.border : undefined);
            node.on(Node.EventType.TOUCH_END, function (event) {
              event.propagationStopped = true;
              if (!_this10.modalOpen) _this10.tapCell(cell.id);
            });
            if (!locked) _this10.bridge.control("\u4E0A\u65B9" + (tile ? '色块' : '空槽') + " " + cell.id, function () {
              if (!_this10.modalOpen) _this10.tapCell(cell.id);
            }, {
              x: p.x,
              y: p.y,
              width: cellSize,
              height: cellSize
            });
            if (locked) {
              _this10.round(p.x + cellSize / 2 + 1, p.y - cellSize / 2 - 1, 7, 7, 4, C.surface);
              var marker = _this10.round(p.x + cellSize / 2 + 1, p.y - cellSize / 2 - 1, 4, 4, level.anchors.includes(cell.id) ? 2 : 0, C.text);
              if (!level.anchors.includes(cell.id)) marker.setRotationFromEuler(0, 0, 45);
            }
          };
          for (var _iterator = _createForOfIteratorHelperLoose(level.cells), _step; !(_step = _iterator()).done;) {
            _loop3();
          }
          this.text(attempt.preview ? '参考色路 · 3 秒后收起' : this.notice || (attempt.status === 'Failed' ? '步数已用完，可查看颜色，或选择继续本关' : this.selectedCell ? '点另一空槽改放，或放回待选区' : attempt.pool.every(function (id) {
            return id === null;
          }) ? '再看看颜色的衔接；可选中色块放回待选区' : level.tutorialText || '先点下方颜色，再点上方空格'), 195, layout.trayLabelY, 352, 28, 13, attempt.preview ? C.selection : C.textSecondary);
          this.round(195, layout.trayTop + layout.trayHeight / 2, 356, layout.trayHeight + 10, 16, C.boardBackground);
          var pages = Math.max(1, Math.ceil(attempt.pool.length / layout.slotsPerPage));
          this.trayPage = Math.min(pages - 1, this.trayPage);
          var firstSlot = this.trayPage * layout.slotsPerPage;
          var lastSlot = Math.min(attempt.pool.length, firstSlot + layout.slotsPerPage);
          var _loop2 = function _loop2(i) {
            var local = i - firstSlot;
            var id = attempt.pool[i];
            var x = 195 - (layout.trayColumns - 1) * layout.trayPitch / 2 + local % layout.trayColumns * layout.trayPitch;
            var y = layout.trayTop + 22 + Math.floor(local / layout.trayColumns) * layout.trayPitch;
            if (_this10.selectedPool === i) _this10.round(x, y, 50, 50, 11, C.selection);
            var node = _this10.round(x, y, 44, 44, 8, tileHex(id), _this10.root, id ? undefined : C.border);
            node.on(Node.EventType.TOUCH_END, function (event) {
              event.propagationStopped = true;
              if (!_this10.modalOpen) _this10.tapPool(i);
            });
            _this10.bridge.control("\u5019\u9009\u69FD " + (i + 1) + (id ? ' ' + tileHex(id) : ' 空'), function () {
              if (!_this10.modalOpen) _this10.tapPool(i);
            }, {
              x: x,
              y: y,
              width: 44,
              height: 44
            });
          };
          for (var i = firstSlot; i < lastSlot; i++) {
            _loop2(i);
          }
          this.button('‹', 64, layout.pagerY, 48, 32, function () {
            if (_this10.trayPage > 0) {
              _this10.trayPage--;
              _this10.renderGame();
            }
          }, C.surface, C.text);
          this.text("\u5F85\u9009\u533A " + (this.trayPage + 1) + " / " + pages, 195, layout.pagerY, 170, 30, 13, C.textSecondary);
          this.button('›', 326, layout.pagerY, 48, 32, function () {
            if (_this10.trayPage + 1 < pages) {
              _this10.trayPage++;
              _this10.renderGame();
            }
          }, C.surface, C.text);
          if (attempt.status === 'Failed') {
            this.button('继续本关', 64, layout.actionsY, 96, 48, function () {
              return _this10.openFail();
            }, C.mint, C.text);
            this.button('免费重开', 195, layout.actionsY, 144, 48, function () {
              return _this10.dispatch({
                type: 'restart',
                attemptId: _this10.nextId('attempt')
              });
            }, C.surface, C.text);
            this.button('选关', 326, layout.actionsY, 92, 48, function () {
              if (_this10.testOriginal) {
                _this10.renderHome();
                _this10.openTestTools();
              } else {
                _this10.chapterPage = level.chapter - 1;
                _this10.renderLevels();
              }
            }, C.surface, C.text);
          } else {
            this.button('取消选择', 64, layout.actionsY, 96, 48, function () {
              _this10.selectedCell = null;
              _this10.selectedPool = null;
              _this10.notice = '';
              _this10.renderGame();
            }, C.surface, C.text);
            this.button('放回待选区', 195, layout.actionsY, 144, 48, function () {
              if (_this10.selectedCell) _this10.dispatch({
                type: 'returnToTray',
                fromCellId: _this10.selectedCell
              });else {
                _this10.notice = '先点选上方已填的颜色';
                _this10.renderGame();
              }
            }, this.selectedCell ? C.mint : C.disabled, C.text);
            this.button('↶ 撤销', 326, layout.actionsY, 92, 48, function () {
              return _this10.dispatch({
                type: 'undo'
              });
            }, C.surface, C.text);
          }
          ['locate', 'peek', 'addMoves'].forEach(function (prop, i) {
            var names = {
              locate: '点睛',
              peek: '窥色',
              addMoves: '续步'
            };
            _this10.button(names[prop] + "  " + state.wallet.inventory[prop], 75 + i * 120, layout.propsY, 104, 52, function () {
              return _this10.openProp(prop);
            }, attempt.status === 'Playing' ? [C.mint, C.lilac, C.butter][i] : C.disabled, C.text);
          });
          this.text('撤销不返还步数', 195, this.height - this.bottom + 3, 300, 20, 12, C.textSecondary);
          if (attempt.status === 'Won') this.openWin();else if (attempt.status === 'Failed' && this.dismissedFailure !== attempt.id) this.openFail();
        };
        _proto.tapPool = function tapPool(index) {
          var state = this.save.game;
          if (state.attempt.status !== 'Playing') return;
          if (state.attempt.pool[index]) {
            this.selectedPool = this.selectedPool === index ? null : index;
            this.selectedCell = null;
            this.notice = '';
            this.renderGame();
          } else if (this.selectedCell) {
            var tile = state.attempt.board[this.selectedCell];
            if (tile && state.level.trayHomeByTile[tile] === index) this.dispatch({
              type: 'returnToTray',
              fromCellId: this.selectedCell
            });else {
              this.notice = '可以点“放回待选区”回到原槽';
              this.renderGame();
            }
          }
        };
        _proto.tapCell = function tapCell(cellId) {
          var state = this.save.game;
          if (state.attempt.status !== 'Playing') return;
          if (state.level.anchors.includes(cellId) || state.attempt.auxiliaryLocks.includes(cellId)) {
            this.notice = '带小圆点的颜色已经固定';
            this.renderGame();
            return;
          }
          if (this.selectedCell === cellId) {
            this.selectedCell = null;
            this.renderGame();
            return;
          }
          if (state.attempt.board[cellId] !== null) {
            if (this.selectedPool !== null || this.selectedCell !== null) {
              this.notice = '这里已有颜色，请先取回或选一个空格';
            } else {
              this.selectedCell = cellId;
              this.notice = '';
            }
            this.renderGame();
            return;
          }
          if (this.selectedPool !== null) {
            this.dispatch({
              type: 'place',
              poolIndex: this.selectedPool,
              toCellId: cellId
            });
          } else if (this.selectedCell) {
            this.dispatch({
              type: 'move',
              fromCellId: this.selectedCell,
              toCellId: cellId
            });
          } else {
            this.notice = '先点选下方的一块颜色';
            this.renderGame();
          }
        };
        _proto.sheet = function sheet(title, subtitle, height) {
          if (height === void 0) {
            height = 360;
          }
          this.modalOpen = true;
          this.bridge.modal();
          var layer = this.element('Modal', 195, this.height / 2, 390, this.height);
          layer.setPosition(0, 0);
          var overlay = this.round(195, this.height / 2, 390, this.height, 0, C.scrim, layer);
          var graphics = overlay.getComponent(Graphics);
          var alpha = Math.round(255 * theme.controls.scrimOpacity);
          var tint = new Color().fromHEX(C.scrim);
          tint.a = alpha;
          graphics.clear();
          graphics.fillColor = tint;
          graphics.rect(-195, -this.height / 2, 390, this.height);
          graphics.fill();
          overlay.addComponent(BlockInputEvents);
          var center = this.height / 2;
          var top = center - height / 2;
          var panel = this.round(195, center, 342, height, theme.radii.modal, C.surface, layer);
          panel.addComponent(BlockInputEvents);
          this.text(title, 195, top + 52, 286, 42, 25, C.text, true, layer);
          this.text(subtitle, 195, top + 99, 292, 52, 15, C.textSecondary, false, layer);
          return {
            layer: layer,
            top: top,
            center: center
          };
        };
        _proto.openGameMenu = function openGameMenu() {
          var _this11 = this;
          var state = this.save.game;
          if (!state || state.attempt.status === 'AdPending') return;
          var _this$sheet3 = this.sheet('这一道颜色，慢慢来', '离开会保留当前盘面', 360),
            layer = _this$sheet3.layer,
            top = _this$sheet3.top;
          this.button('继续这一关', 195, top + 157, 280, 48, function () {
            return _this11.renderGame();
          }, C.mint, C.text, layer, true);
          this.button('免费重新开始', 195, top + 220, 280, 48, function () {
            var confirm = _this11.sheet('重新拾起这些颜色？', '盘面恢复开局；已使用道具不会返还', 290);
            _this11.button('确定重开', 195, confirm.top + 162, 280, 48, function () {
              return _this11.dispatch({
                type: 'restart',
                attemptId: _this11.nextId('attempt')
              });
            }, C.primary, C.onPrimary, confirm.layer, true);
            _this11.button('再想想', 195, confirm.top + 224, 280, 44, function () {
              return _this11.renderGame();
            }, C.mint, C.text, confirm.layer, true);
          }, C.surface, C.text, layer, true);
          this.button('返回首页', 195, top + 283, 280, 48, function () {
            return _this11.renderHome();
          }, C.surface, C.textSecondary, layer, true);
        };
        _proto.openWin = function openWin() {
          var _this12 = this;
          var _this$sheet4 = this.sheet('这道风景，拾好啦', '颜色归位，给自己一点小小的掌声', 340),
            layer = _this$sheet4.layer,
            top = _this$sheet4.top;
          var n = this.save.game.level.number;
          if (this.testOriginal) {
            this.button('返回测试工具', 195, top + 185, 282, 56, function () {
              _this12.renderHome();
              _this12.openTestTools();
            }, C.primary, C.onPrimary, layer, true);
            this.button('再体验一次', 195, top + 256, 220, 48, function () {
              return _this12.enterTestLevel(n - 1);
            }, C.mint, C.text, layer, true);
            return;
          }
          this.button(n < 100 ? '继续下一道风景' : '重温色彩旅程', 195, top + 185, 282, 56, function () {
            return n < 100 ? _this12.enterLevel(n) : _this12.renderLevels();
          }, C.primary, C.onPrimary, layer, true);
          this.button('回到首页', 195, top + 256, 220, 48, function () {
            return _this12.renderHome();
          }, C.mint, C.text, layer, true);
        };
        _proto.openFail = function openFail() {
          var _this13 = this;
          var state = this.save.game;
          var max = state.level.challenge.revive.maxPerAttempt;
          var canRevive = state.attempt.revivesUsed < max;
          var entitlement = state.wallet.pendingRevives[0];
          var _this$sheet5 = this.sheet('就差一点点', this.notice || '步数用完了，颜色还为你留着', 414),
            layer = _this$sheet5.layer,
            top = _this$sheet5.top;
          this.button('×', 327, top + 24, 40, 40, function () {
            _this13.dismissedFailure = state.attempt.id;
            _this13.renderGame();
          }, C.surface, C.text, layer, true);
          this.text("\u672C\u5C40\u8FD8\u53EF\u590D\u6D3B " + Math.max(0, max - state.attempt.revivesUsed) + " \u6B21", 195, top + 142, 290, 26, 13, C.textSecondary, false, layer);
          if (canRevive) {
            this.button(entitlement ? "\u4F7F\u7528\u5DF2\u83B7\u5F97\u7684 +" + entitlement.amount + " \u6B65" : "\u25B7 \u770B\u89C6\u9891 +" + state.level.challenge.revive.addMoves + " \u6B65", 195, top + 196, 288, 56, function () {
              _this13.dismissedFailure = null;
              if (entitlement) _this13.dispatch({
                type: 'applyPendingRevive',
                requestId: entitlement.requestId
              });else _this13.requestVideo('revive');
            }, C.primary, C.onPrimary, layer, true);
          } else this.text('本局复活次数已用完', 195, top + 196, 288, 56, 16, C.textSecondary, false, layer);
          this.button('免费重开', 195, top + 268, 288, 48, function () {
            return _this13.dispatch({
              type: 'restart',
              attemptId: _this13.nextId('attempt')
            });
          }, C.mint, C.text, layer, true);
          this.button('返回选关', 195, top + 335, 220, 48, function () {
            if (_this13.testOriginal) {
              _this13.renderHome();
              _this13.openTestTools();
            } else {
              _this13.chapterPage = state.level.chapter - 1;
              _this13.renderLevels();
            }
          }, C.surface, C.textSecondary, layer, true);
        };
        _proto.openProp = function openProp(prop) {
          var _this14 = this;
          var state = this.save.game;
          if (state.attempt.status !== 'Playing') return;
          var names = {
            locate: '点睛',
            peek: '窥色',
            addMoves: '续步'
          };
          var descriptions = {
            locate: '帮一块颜色归位并固定，不花步数',
            peek: '选择一条色路，参考答案 3 秒',
            addMoves: '为这次尝试增加 5 步'
          };
          var _this$sheet6 = this.sheet(names[prop], descriptions[prop], 368),
            layer = _this$sheet6.layer,
            top = _this$sheet6.top;
          var limits = {
            locate: 2,
            peek: 1,
            addMoves: 2
          };
          var usesLeft = limits[prop] - state.attempt.propUses[prop];
          this.text("\u62E5\u6709 " + state.wallet.inventory[prop] + " \u4E2A \xB7 \u672C\u5C40\u53EF\u7528 " + usesLeft + " \u6B21", 195, top + 146, 290, 28, 15, C.textSecondary, false, layer);
          var stock = state.wallet.inventory[prop];
          var unavailable = usesLeft <= 0 ? '本局使用次数已用完' : prop === 'addMoves' && state.attempt.remainingMoves === null ? '教学关无需增加步数' : stock <= 0 && state.attempt.propRestockAdsGranted >= 1 ? '本局视频补货已用完' : '';
          if (unavailable) this.text(unavailable, 195, top + 207, 280, 56, 16, C.textSecondary, false, layer);else this.button(stock > 0 ? '使用一个' : '▷ 看视频领取 1 个', 195, top + 207, 280, 56, function () {
            if (stock <= 0) {
              _this14.requestVideo('restock', prop);
              return;
            }
            if (prop === 'peek') {
              _this14.openPathPicker();
              return;
            }
            _this14.dispatch(prop === 'locate' ? {
              type: 'locate'
            } : {
              type: 'addMoves'
            });
          }, C.primary, C.onPrimary, layer, true);
          this.button('先自己试试', 195, top + 284, 230, 48, function () {
            return _this14.renderGame();
          }, C.mint, C.text, layer, true);
        };
        _proto.openPathPicker = function openPathPicker() {
          var _this15 = this;
          this.renderGame();
          var paths = this.save.game.level.paths;
          var height = Math.min(this.height - this.top - this.bottom - 24, 180 + Math.ceil(paths.length / 3) * 50);
          var _this$sheet7 = this.sheet('想看看哪条色路？', '参考 3 秒后自动收起', height),
            layer = _this$sheet7.layer,
            top = _this$sheet7.top;
          this.button('×', 327, top + 24, 40, 40, function () {
            return _this15.renderGame();
          }, C.surface, C.text, layer, true);
          paths.forEach(function (path, i) {
            return _this15.button("\u8272\u8DEF " + (i + 1), 89 + i % 3 * 106, top + 153 + Math.floor(i / 3) * 50, 96, 44, function () {
              _this15.dispatch({
                type: 'peek',
                pathId: path.id,
                nowMs: Date.now()
              });
              var attemptId = _this15.save.game.attempt.id;
              _this15.scheduleOnce(function () {
                var _this15$save$game;
                if (((_this15$save$game = _this15.save.game) == null ? void 0 : _this15$save$game.attempt.id) !== attemptId) return;
                var result = reduceGame(_this15.save.game, {
                  type: 'expirePeek',
                  nowMs: Date.now()
                });
                if (result.changed) {
                  _this15.save.game = result.state;
                  _this15.persist();
                  if (_this15.screen === 'game') _this15.renderGame();
                }
              }, 3);
            }, C.lilac, C.text, layer, true);
          });
        };
        _proto.requestVideo = function requestVideo(rewardType, prop) {
          var _this16 = this;
          if (!this.video.available) {
            this.renderGame();
            var _this$sheet8 = this.sheet('视频还没准备好', this.video.unavailableReason, 280),
              layer = _this$sheet8.layer,
              top = _this$sheet8.top;
            this.button('知道了', 195, top + 197, 260, 48, function () {
              return _this16.renderGame();
            }, C.mint, C.text, layer, true);
            return;
          }
          var requestId = this.nextId('reward');
          var before = this.save.game;
          var result = reduceGame(before, {
            type: 'beginReward',
            requestId: requestId,
            rewardType: rewardType,
            prop: prop
          });
          if (!result.changed) {
            this.notice = '本次的视频补给次数已用完';
            this.renderGame();
            return;
          }
          this.save.game = result.state;
          if (!this.persist()) {
            this.save.game = before;
            this.renderGame();
            return;
          }
          this.video.show(function (outcome) {
            _this16.pendingSimulation = null;
            _this16.dispatch({
              type: 'settleReward',
              requestId: requestId,
              outcome: outcome
            });
            if (outcome !== 'completed') {
              _this16.notice = outcome === 'failed' ? '暂时没有可用视频，可免费重开或稍后再试' : '本次未领取奖励，盘面已保留';
              if (_this16.screen === 'game') _this16.renderGame();
            }
          }, function (finish, cancel, fail) {
            _this16.pendingSimulation = {
              finish: finish,
              cancel: cancel,
              fail: fail
            };
            _this16.renderGame();
            _this16.showSimulationSheet();
          });
        };
        _proto.showSimulationSheet = function showSimulationSheet() {
          var callbacks = this.pendingSimulation;
          if (!callbacks) return;
          var _this$sheet9 = this.sheet('开发预览 · 模拟激励视频', '这里只验证奖励流程\n还没有接入真实广告，也不会产生广告收益', 430),
            layer = _this$sheet9.layer,
            top = _this$sheet9.top;
          this.button('模拟完整看完', 195, top + 193, 280, 56, callbacks.finish, C.primary, C.onPrimary, layer, true);
          this.button('取消，不领取奖励', 195, top + 265, 280, 48, callbacks.cancel, C.mint, C.text, layer, true);
          this.button('模拟加载失败', 195, top + 333, 280, 48, callbacks.fail, C.surface, C.text, layer, true);
        };
        return ShiseBoot;
      }(Component)) || _class));
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/BrowserTestBridge.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _extends, cclegacy;
  return {
    setters: [function (module) {
      _extends = module.extends;
    }, function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      cclegacy._RF.push({}, "7d668rsLcZBTbmkEKi4FgrQ", "BrowserTestBridge", undefined);
      /** Optional tester-build accessibility for the Cocos canvas. Never runs in a tt host. */
      var BrowserTestBridge = exports('BrowserTestBridge', /*#__PURE__*/function () {
        function BrowserTestBridge(enabled, snapshot, height) {
          var _this = this;
          if (height === void 0) {
            height = 844;
          }
          this.controls = new Map();
          this.texts = [];
          this.sequence = 0;
          this.layer = null;
          this.snapshot = snapshot;
          this.height = height;
          if (!enabled || typeof document === 'undefined') return;
          this.layer = document.createElement('div');
          this.layer.setAttribute('aria-label', '拾色之间游戏操作');
          this.layer.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:10';
          document.body.appendChild(this.layer);
          var style = document.createElement('style');
          style.textContent = '.shise-control{opacity:0;border:0;padding:0;pointer-events:auto;position:fixed;cursor:pointer}.shise-control:focus-visible{opacity:1;background:transparent;color:transparent;outline:2px solid #554D72;border-radius:8px}';
          document.head.appendChild(style);
          var context = document.modelContext || navigator.modelContext;
          if (!context) return;
          var result = function result() {
            try {
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(_extends({}, _this.snapshot(), {
                    texts: [].concat(_this.texts),
                    controls: [].concat(_this.controls).map(function (_ref) {
                      var id = _ref[0],
                        item = _ref[1];
                      return {
                        id: id,
                        label: item.label
                      };
                    })
                  }))
                }]
              };
            } catch (error) {
              return {
                content: [{
                  type: 'text',
                  text: String(error)
                }]
              };
            }
          };
          var register = function register(tool) {
            try {
              Promise.resolve(context.registerTool(tool))["catch"](function () {});
            } catch (_unused) {/* Optional browser support. */}
          };
          register({
            name: 'shise_state',
            description: 'Read the visible Cocos tester UI state. Does not reveal puzzle answers.',
            inputSchema: {
              type: 'object',
              properties: {}
            },
            annotations: {
              readOnlyHint: true
            },
            execute: result
          });
          register({
            name: 'shise_tap',
            description: 'Tap a currently visible Cocos control by id from shise_state. Same callback as screen controls; no arbitrary state edits.',
            inputSchema: {
              type: 'object',
              properties: {
                id: {
                  type: 'string'
                }
              },
              required: ['id']
            },
            execute: function execute(input) {
              var _this$controls$get;
              (_this$controls$get = _this.controls.get(input.id)) == null || _this$controls$get.invoke();
              return result();
            }
          });
        }
        var _proto = BrowserTestBridge.prototype;
        _proto.clear = function clear() {
          var _this$layer;
          this.controls.clear();
          this.texts = [];
          (_this$layer = this.layer) == null || _this$layer.replaceChildren();
        };
        _proto.modal = function modal() {
          var _this$layer2;
          this.controls.clear();
          (_this$layer2 = this.layer) == null || _this$layer2.replaceChildren();
        };
        _proto.text = function text(value) {
          this.texts.push(value);
        };
        _proto.control = function control(label, invoke, bounds) {
          this.controls.set("control-" + ++this.sequence, {
            label: label,
            invoke: invoke
          });
          if (!this.layer || !bounds) return;
          var canvas = document.getElementById('GameCanvas');
          if (!canvas) return;
          var rect = canvas.getBoundingClientRect();
          var scale = Math.min(rect.width / 390, rect.height / this.height);
          var button = document.createElement('button');
          button.type = 'button';
          button.className = 'shise-control';
          button.textContent = label;
          button.setAttribute('aria-label', label);
          button.style.left = rect.x + rect.width / 2 + (bounds.x - 195 - bounds.width / 2) * scale + "px";
          button.style.top = rect.y + rect.height / 2 + (bounds.y - this.height / 2 - bounds.height / 2) * scale + "px";
          button.style.width = bounds.width * scale + "px";
          button.style.height = bounds.height * scale + "px";
          button.addEventListener('click', invoke);
          this.layer.appendChild(button);
        };
        return BrowserTestBridge;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/Feedback.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createForOfIteratorHelperLoose, cclegacy, AudioSource, resources, AudioClip;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
    }, function (module) {
      cclegacy = module.cclegacy;
      AudioSource = module.AudioSource;
      resources = module.resources;
      AudioClip = module.AudioClip;
    }],
    execute: function () {
      cclegacy._RF.push({}, "37e84RN6sZAzJJoVCPYBDkV", "Feedback", undefined);

      /** Optional, quiet feedback; missing audio or vibration never blocks an action. */
      var Feedback = exports('Feedback', /*#__PURE__*/function () {
        function Feedback(node) {
          var _this = this;
          this.source = void 0;
          this.clips = {};
          this.source = node.addComponent(AudioSource);
          var _loop = function _loop() {
            var name = _step.value;
            resources.load("audio/" + name, AudioClip, function (error, clip) {
              if (!error && clip) _this.clips[name] = clip;
            });
          };
          for (var _iterator = _createForOfIteratorHelperLoose(['place', 'complete']), _step; !(_step = _iterator()).done;) {
            _loop();
          }
        }
        var _proto = Feedback.prototype;
        _proto.play = function play(name, sound, haptics) {
          var clip = this.clips[name];
          if (sound && clip) {
            try {
              this.source.playOneShot(clip, name === 'place' ? 0.3 : 0.45);
            } catch (_unused) {/* Optional capability. */}
          }
          if (haptics) {
            var tt = globalThis.tt;
            try {
              tt == null || tt.vibrateShort == null || tt.vibrateShort({
                type: 'light',
                fail: function fail() {}
              });
            } catch (_unused2) {/* Optional capability. */}
          }
        };
        return Feedback;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/index.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createForOfIteratorHelperLoose, _extends, cclegacy;
  return {
    setters: [function (module) {
      _createForOfIteratorHelperLoose = module.createForOfIteratorHelperLoose;
      _extends = module.extends;
    }, function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        adaptLevel: adaptLevel,
        createGame: createGame,
        isLocked: isLocked,
        isSolved: isSolved,
        recoverInterruptedGame: recoverInterruptedGame,
        reduceGame: reduceGame,
        restoreAttempt: restoreAttempt,
        restoreGame: restoreGame,
        startLevel: startLevel
      });
      cclegacy._RF.push({}, "1df04cZonpCV73wI8qG2WJp", "index", undefined);
      /** Pure game rules. No Cocos, platform SDK, clock, randomness or storage dependencies. */
      var RULES_VERSION = exports('RULES_VERSION', 'click-fill-v1');
      var PROP_LIMITS = exports('PROP_LIMITS', Object.freeze({
        locate: 2,
        peek: 1,
        addMoves: 2
      }));
      var STARTER_INVENTORY = exports('STARTER_INVENTORY', Object.freeze({
        locate: 3,
        peek: 2,
        addMoves: 1
      }));
      var own = function own(object, key) {
        return Object.prototype.hasOwnProperty.call(object, key);
      };
      var emptyInventory = function emptyInventory() {
        return {
          locate: 0,
          peek: 0,
          addMoves: 0
        };
      };
      var hex = function hex(value) {
        if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Invalid HEX colour');
        return value.toUpperCase();
      };
      var object = function object(value, name) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error("Invalid " + name);
        return value;
      };
      var array = function array(value, name) {
        if (!Array.isArray(value)) throw new Error("Invalid " + name);
        return value;
      };
      var string = function string(value, name) {
        if (typeof value !== 'string' || value.length === 0) throw new Error("Invalid " + name);
        return value;
      };
      var integer = function integer(value, name, minimum) {
        if (minimum === void 0) {
          minimum = 0;
        }
        if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < minimum) throw new Error("Invalid " + name);
        return value;
      };

      /** Strict boundary adapter for the accepted candidate pack; it never repairs content. */
      function adaptLevel(input) {
        var raw = object(input, 'level');
        if (raw.gameplayMode !== 'click-fill' || raw.inputMode !== 'tap') throw new Error('Only click-fill levels are supported');
        var grid = object(raw.grid, 'grid');
        var challenge = object(raw.challenge, 'challenge');
        var revive = object(challenge.revive, 'revive');
        var solution = object(raw.solution, 'solution');
        if (array(solution.acceptedAlternativeLayouts, 'alternative layouts').length !== 0) {
          throw new Error('Alternative answer layouts require an explicit adapter upgrade');
        }
        if (challenge.mode !== 'none' && challenge.mode !== 'moves') throw new Error('Invalid challenge mode');
        var targetByCell = object(solution.targetByCell, 'targetByCell');
        var cells = array(raw.cells, 'cells').map(function (value) {
          var cell = object(value, 'cell');
          var id = string(cell.id, 'cell id');
          var targetHex = hex(cell.targetHex);
          if (hex(targetByCell[id]) !== targetHex) throw new Error('Cell and solution disagree');
          return {
            id: id,
            x: integer(cell.x, 'cell x'),
            y: integer(cell.y, 'cell y'),
            targetHex: targetHex
          };
        });
        var tiles = array(raw.tiles, 'tiles').map(function (value) {
          var tile = object(value, 'tile');
          return {
            id: string(tile.id, 'tile id'),
            hex: hex(tile.hex)
          };
        });
        var paths = array(raw.paths, 'paths').map(function (value) {
          var path = object(value, 'path');
          return {
            id: string(path.id, 'path id'),
            cellIds: array(path.cellIds, 'path cells').map(function (v) {
              return string(v, 'path cell');
            })
          };
        });
        var initialBoardRaw = object(raw.initialBoard, 'initialBoard');
        var initialBoard = Object.create(null);
        for (var _iterator = _createForOfIteratorHelperLoose(cells), _step; !(_step = _iterator()).done;) {
          var cell = _step.value;
          var value = initialBoardRaw[cell.id];
          initialBoard[cell.id] = value === null ? null : string(value, 'board tile');
        }
        var level = {
          gameplayMode: 'click-fill',
          inputMode: 'tap',
          id: string(raw.id, 'level id'),
          number: integer(raw.number, 'level number', 1),
          title: string(raw.title, 'level title'),
          chapter: integer(raw.chapter, 'chapter', 1),
          chapterName: string(raw.chapterName, 'chapterName'),
          contentVersion: string(raw.contentVersion, 'contentVersion'),
          grid: {
            columns: integer(grid.columns, 'columns', 1),
            rows: integer(grid.rows, 'rows', 1)
          },
          cells: cells,
          paths: paths,
          anchors: array(raw.anchors, 'anchors').map(function (v) {
            return string(v, 'anchor');
          }),
          tiles: tiles,
          initialBoard: initialBoard,
          initialPool: array(raw.initialPool, 'pool').map(function (v) {
            return string(v, 'pool tile');
          }),
          trayHomeByTile: Object.fromEntries(Object.entries(object(raw.trayHomeByTile, 'trayHomeByTile')).map(function (_ref) {
            var id = _ref[0],
              index = _ref[1];
            return [id, integer(index, 'home slot')];
          })),
          tutorialText: typeof raw.tutorialText === 'string' ? raw.tutorialText : '',
          challenge: {
            mode: challenge.mode,
            moveBudget: challenge.mode === 'none' ? null : integer(challenge.moveBudget, 'move budget', 1),
            revive: {
              maxPerAttempt: integer(revive.maxPerAttempt, 'revive limit'),
              addMoves: integer(revive.addMoves, 'revive amount')
            }
          }
        };
        if (!cells.length || new Set(cells.map(function (c) {
          return c.id;
        })).size !== cells.length) throw new Error('Duplicate or empty cells');
        if (new Set(cells.map(function (c) {
          return c.x + ":" + c.y;
        })).size !== cells.length) throw new Error('Duplicate coordinates');
        if (cells.some(function (c) {
          return c.x >= level.grid.columns || c.y >= level.grid.rows;
        })) throw new Error('Cell outside grid');
        if (new Set(tiles.map(function (t) {
          return t.id;
        })).size !== tiles.length) throw new Error('Duplicate tile IDs');
        if (new Set(paths.map(function (p) {
          return p.id;
        })).size !== paths.length) throw new Error('Duplicate path IDs');
        if (new Set(level.anchors).size !== level.anchors.length) throw new Error('Duplicate anchors');
        if (paths.some(function (p) {
          return !p.cellIds.length || p.cellIds.some(function (id) {
            return !own(initialBoard, id);
          });
        })) throw new Error('Invalid path reference');
        if (Object.keys(initialBoardRaw).length !== cells.length || Object.keys(targetByCell).length !== cells.length) throw new Error('Unexpected board cell');
        if (level.anchors.some(function (id) {
          return !own(initialBoard, id);
        })) throw new Error('Invalid anchor reference');
        var allTiles = [].concat(Object.values(initialBoard), level.initialPool).filter(function (v) {
          return v !== null;
        });
        var tileIds = new Set(tiles.map(function (t) {
          return t.id;
        }));
        if (allTiles.length !== tiles.length || new Set(allTiles).size !== tiles.length || allTiles.some(function (id) {
          return !tileIds.has(id);
        })) {
          throw new Error('Initial tile conservation failed');
        }
        if (cells.length !== tiles.length) throw new Error('One tile per target cell required');
        var targets = cells.map(function (c) {
          return c.targetHex;
        }).sort();
        var colours = tiles.map(function (t) {
          return t.hex;
        }).sort();
        if (targets.some(function (colour, i) {
          return colour !== colours[i];
        })) throw new Error('Target colour multiset mismatch');
        if (level.anchors.some(function (id) {
          return colourAt(level, initialBoard, id) !== cells.find(function (c) {
            return c.id === id;
          }).targetHex;
        })) {
          throw new Error('Initial anchor is not correct');
        }
        if (level.challenge.mode === 'none' && (level.challenge.revive.maxPerAttempt !== 0 || level.challenge.revive.addMoves !== 0)) {
          throw new Error('Tutorial cannot grant revival');
        }
        if (cells.some(function (cell) {
          return !level.anchors.includes(cell.id) && initialBoard[cell.id] !== null;
        })) throw new Error('Only anchor tiles may be prefilled');
        var movableCount = cells.length - level.anchors.length;
        if (movableCount < 1 || level.initialPool.length !== movableCount) throw new Error('All movable tiles must start in the tray');
        if (Object.keys(level.trayHomeByTile).length !== movableCount || level.initialPool.some(function (id, index) {
          return level.trayHomeByTile[id] !== index;
        })) throw new Error('Invalid permanent tray homes');
        if (challenge.minimumMovesMetric !== 'tray-to-empty-board-placements' || challenge.minimumMoves !== movableCount) throw new Error('Invalid minimum placement metric');
        if (level.number <= 4 !== (level.challenge.mode === 'none')) throw new Error('Only the first four levels are unlimited');
        if (level.challenge.moveBudget !== null && level.challenge.moveBudget < movableCount) throw new Error('Budget must permit a perfect placement solution');
        return level;
      }
      function colourAt(level, board, cellId) {
        var _level$tiles$find$hex, _level$tiles$find;
        var tileId = board[cellId];
        return tileId == null ? null : (_level$tiles$find$hex = (_level$tiles$find = level.tiles.find(function (tile) {
          return tile.id === tileId;
        })) == null ? void 0 : _level$tiles$find.hex) != null ? _level$tiles$find$hex : null;
      }
      function isSolved(level, board, pool) {
        return pool.length === level.initialPool.length && pool.every(function (id) {
          return id === null;
        }) && level.cells.every(function (cell) {
          return colourAt(level, board, cell.id) === cell.targetHex;
        });
      }
      function isLocked(state, cellId) {
        return state.level.anchors.includes(cellId) || state.attempt.auxiliaryLocks.includes(cellId);
      }
      function makeAttempt(level, attemptId) {
        string(attemptId, 'attempt ID');
        return {
          rulesVersion: RULES_VERSION,
          id: attemptId,
          levelId: level.id,
          levelContentVersion: level.contentVersion,
          revision: 0,
          status: isSolved(level, level.initialBoard, level.initialPool) ? 'Won' : 'Playing',
          board: _extends({}, level.initialBoard),
          pool: [].concat(level.initialPool),
          auxiliaryLocks: [],
          initialMoveBudget: level.challenge.moveBudget,
          remainingMoves: level.challenge.moveBudget,
          movesSpent: 0,
          totalMovesGranted: 0,
          undoStack: [],
          propUses: emptyInventory(),
          revivesUsed: 0,
          propRestockAdsGranted: 0,
          reviveAdsGranted: 0,
          pendingRewardRequestId: null,
          previousStatusBeforeAd: null,
          preview: null
        };
      }
      function validateInventory(inventory) {
        return {
          locate: integer(inventory.locate, 'locate stock'),
          peek: integer(inventory.peek, 'peek stock'),
          addMoves: integer(inventory.addMoves, 'addMoves stock')
        };
      }
      function createGame(level, attemptId, inventory) {
        if (inventory === void 0) {
          inventory = emptyInventory();
        }
        return {
          level: level,
          attempt: makeAttempt(level, attemptId),
          wallet: {
            inventory: validateInventory(inventory),
            rewardLedger: {},
            pendingRevives: []
          }
        };
      }
      function restoreLayout(level, input) {
        var raw = object(input, 'layout');
        var rawBoard = object(raw.board, 'saved board');
        if (Object.keys(rawBoard).length !== level.cells.length) throw new Error('Saved board size mismatch');
        var board = {};
        for (var _iterator2 = _createForOfIteratorHelperLoose(level.cells), _step2; !(_step2 = _iterator2()).done;) {
          var cell = _step2.value;
          board[cell.id] = rawBoard[cell.id] === null ? null : string(rawBoard[cell.id], 'saved tile');
        }
        var pool = array(raw.pool, 'saved tray').map(function (value) {
          return value === null ? null : string(value, 'saved tray tile');
        });
        var auxiliaryLocks = array(raw.auxiliaryLocks, 'saved locks').map(function (value) {
          return string(value, 'saved lock');
        });
        if (pool.length !== level.initialPool.length || pool.some(function (id, index) {
          return id !== null && id !== level.initialPool[index];
        })) throw new Error('Saved tray homes mismatch');
        var ids = [].concat(Object.values(board), pool).filter(function (id) {
          return id !== null;
        });
        var tileIds = new Set(level.tiles.map(function (tile) {
          return tile.id;
        }));
        if (ids.length !== tileIds.size || new Set(ids).size !== tileIds.size || ids.some(function (id) {
          return !tileIds.has(id);
        })) throw new Error('Saved tile conservation failed');
        if (level.anchors.some(function (id) {
          return board[id] !== level.initialBoard[id];
        })) throw new Error('Saved anchor moved');
        if (new Set(auxiliaryLocks).size !== auxiliaryLocks.length || auxiliaryLocks.some(function (id) {
          return !own(board, id) || level.anchors.includes(id) || colourAt(level, board, id) !== level.cells.find(function (cell) {
            return cell.id === id;
          }).targetHex;
        })) throw new Error('Saved lock invalid');
        return {
          board: board,
          pool: pool,
          auxiliaryLocks: auxiliaryLocks
        };
      }

      /** Restores only this rules/content version. Old attempts must be discarded, never reinterpreted. */
      function restoreAttempt(level, input) {
        var raw = object(input, 'attempt');
        if (raw.rulesVersion !== RULES_VERSION || raw.levelId !== level.id || raw.levelContentVersion !== level.contentVersion) throw new Error('Incompatible attempt rules or level version');
        var layout = restoreLayout(level, raw);
        var propUses = validateInventory(object(raw.propUses, 'saved prop uses'));
        for (var _i = 0, _arr = Object.keys(PROP_LIMITS); _i < _arr.length; _i++) {
          var prop = _arr[_i];
          if (propUses[prop] > PROP_LIMITS[prop]) throw new Error('Saved prop limit exceeded');
        }
        if (raw.initialMoveBudget !== level.challenge.moveBudget) throw new Error('Saved initial budget mismatch');
        var remainingMoves = raw.remainingMoves === null ? null : integer(raw.remainingMoves, 'saved remaining moves');
        var movesSpent = integer(raw.movesSpent, 'saved spent moves');
        var totalMovesGranted = integer(raw.totalMovesGranted, 'saved granted moves');
        if (remainingMoves === null !== (level.challenge.moveBudget === null)) throw new Error('Saved budget mode mismatch');
        if (remainingMoves !== null && remainingMoves !== level.challenge.moveBudget + totalMovesGranted - movesSpent) throw new Error('Saved move accounting mismatch');
        if (totalMovesGranted < propUses.addMoves * 5) throw new Error('Saved granted moves mismatch');
        var revivesUsed = integer(raw.revivesUsed, 'saved revival count');
        var propRestockAdsGranted = integer(raw.propRestockAdsGranted, 'saved restock count');
        var reviveAdsGranted = integer(raw.reviveAdsGranted, 'saved rewarded revival count');
        if (revivesUsed > level.challenge.revive.maxPerAttempt || propRestockAdsGranted > 1 || reviveAdsGranted > revivesUsed) throw new Error('Saved reward limit exceeded');
        var status = raw.status;
        if (!['Playing', 'Won', 'Failed', 'AdPending', 'PreviewingReference'].includes(status)) throw new Error('Saved status invalid');
        var solved = isSolved(level, layout.board, layout.pool);
        var previousStatusBeforeAd = raw.previousStatusBeforeAd === null ? null : raw.previousStatusBeforeAd;
        var pendingRewardRequestId = raw.pendingRewardRequestId === null ? null : string(raw.pendingRewardRequestId, 'pending request');
        var baseStatus = status === 'AdPending' ? previousStatusBeforeAd : status === 'PreviewingReference' ? 'Playing' : status;
        if (!['Playing', 'Won', 'Failed'].includes(baseStatus != null ? baseStatus : '')) throw new Error('Saved base status invalid');
        if (solved !== (baseStatus === 'Won') || baseStatus === 'Failed' && remainingMoves !== 0 || baseStatus === 'Playing' && remainingMoves === 0) throw new Error('Saved status disagrees with board or budget');
        if (status === 'AdPending' !== (pendingRewardRequestId !== null && previousStatusBeforeAd !== null)) throw new Error('Saved ad state invalid');
        var preview = null;
        if (status === 'PreviewingReference') {
          var item = object(raw.preview, 'saved preview');
          var pathId = string(item.pathId, 'saved preview path');
          if (!level.paths.some(function (path) {
            return path.id === pathId;
          }) || typeof item.expiresAtMs !== 'number' || !Number.isFinite(item.expiresAtMs)) throw new Error('Saved preview invalid');
          preview = {
            pathId: pathId,
            expiresAtMs: item.expiresAtMs
          };
        } else if (raw.preview !== null) throw new Error('Unexpected saved preview');
        var undoStack = array(raw.undoStack, 'saved history').map(function (value) {
          var entry = object(value, 'saved history entry');
          if (!['place', 'move', 'returnToTray', 'locate'].includes(entry.kind)) throw new Error('Incompatible history action');
          return _extends({
            kind: entry.kind
          }, restoreLayout(level, entry));
        });
        return _extends({}, layout, {
          rulesVersion: RULES_VERSION,
          id: string(raw.id, 'saved attempt ID'),
          levelId: level.id,
          levelContentVersion: level.contentVersion,
          revision: integer(raw.revision, 'saved revision'),
          status: status,
          initialMoveBudget: level.challenge.moveBudget,
          remainingMoves: remainingMoves,
          movesSpent: movesSpent,
          totalMovesGranted: totalMovesGranted,
          undoStack: undoStack,
          propUses: propUses,
          revivesUsed: revivesUsed,
          propRestockAdsGranted: propRestockAdsGranted,
          reviveAdsGranted: reviveAdsGranted,
          pendingRewardRequestId: pendingRewardRequestId,
          previousStatusBeforeAd: previousStatusBeforeAd,
          preview: preview
        });
      }

      /** The application may preserve wallet/progress separately when an incompatible attempt is discarded. */
      function restoreGame(level, input) {
        var raw = object(input, 'saved game');
        var attempt = restoreAttempt(level, raw.attempt);
        var rawWallet = object(raw.wallet, 'saved wallet');
        var inventory = validateInventory(object(rawWallet.inventory, 'saved inventory'));
        var rewardLedger = {};
        for (var _i2 = 0, _Object$entries = Object.entries(object(rawWallet.rewardLedger, 'reward ledger')); _i2 < _Object$entries.length; _i2++) {
          var _Object$entries$_i = _Object$entries[_i2],
            id = _Object$entries$_i[0],
            value = _Object$entries$_i[1];
          var item = object(value, 'reward request');
          if (!validId(id) || item.id !== id || !['pending', 'granted', 'cancelled', 'failed'].includes(item.status) || !['revive', 'restock'].includes(item.rewardType)) throw new Error('Saved reward request invalid');
          var rewardType = item.rewardType;
          var prop = rewardType === 'restock' ? item.prop : null;
          var amount = integer(item.amount, 'saved reward amount', 1);
          if (rewardType === 'restock' && (!own(PROP_LIMITS, prop) || amount !== 1)) throw new Error('Saved restock reward invalid');
          rewardLedger[id] = {
            id: id,
            attemptId: string(item.attemptId, 'reward attempt'),
            levelId: string(item.levelId, 'reward level'),
            levelContentVersion: string(item.levelContentVersion, 'reward content version'),
            rewardType: rewardType,
            prop: prop,
            amount: amount,
            status: item.status
          };
        }
        if (Object.values(rewardLedger).filter(function (item) {
          return item.status === 'pending';
        }).length > 1) throw new Error('Multiple pending rewards');
        if (attempt.pendingRewardRequestId) {
          var request = rewardLedger[attempt.pendingRewardRequestId];
          if (!request || request.status !== 'pending' || request.attemptId !== attempt.id || request.levelId !== level.id || request.levelContentVersion !== level.contentVersion) throw new Error('Saved pending reward mismatch');
        }
        var pendingRevives = array(rawWallet.pendingRevives, 'pending revivals').map(function (value) {
          var item = object(value, 'pending revival');
          var requestId = string(item.requestId, 'pending revival request');
          var request = rewardLedger[requestId];
          var originAttemptId = string(item.originAttemptId, 'pending revival attempt');
          var amount = integer(item.amount, 'pending revival amount', 1);
          if (!request || request.status !== 'granted' || request.rewardType !== 'revive' || request.attemptId !== originAttemptId || request.amount !== amount) throw new Error('Saved pending revival mismatch');
          return {
            requestId: requestId,
            originAttemptId: originAttemptId,
            amount: amount
          };
        });
        if (new Set(pendingRevives.map(function (item) {
          return item.requestId;
        })).size !== pendingRevives.length) throw new Error('Duplicate pending revival');
        return {
          level: level,
          attempt: attempt,
          wallet: {
            inventory: inventory,
            rewardLedger: rewardLedger,
            pendingRevives: pendingRevives
          }
        };
      }
      /** Application owns sequential level unlocks and one-time starter/chapter grants. */
      function startLevel(previous, level, attemptId) {
        if (attemptId === previous.attempt.id || Object.values(previous.wallet.rewardLedger).some(function (request) {
          return request.attemptId === attemptId;
        })) {
          throw new Error('A new attempt ID is required');
        }
        return {
          level: level,
          attempt: makeAttempt(level, attemptId),
          wallet: cloneWallet(previous.wallet)
        };
      }
      /** Resume presentation-independent state. Unverified ad requests remain in the ledger. */
      function recoverInterruptedGame(state) {
        if (state.attempt.status !== 'PreviewingReference' && state.attempt.status !== 'AdPending') return state;
        var next = clone(state);
        if (next.attempt.status === 'PreviewingReference') {
          next.attempt.preview = null;
          next.attempt.status = 'Playing';
        } else {
          var _next$attempt$previou;
          next.attempt.status = (_next$attempt$previou = next.attempt.previousStatusBeforeAd) != null ? _next$attempt$previou : 'Failed';
          next.attempt.previousStatusBeforeAd = null;
          next.attempt.pendingRewardRequestId = null;
        }
        next.attempt.revision++;
        return next;
      }
      function cloneWallet(wallet) {
        var rewardLedger = {};
        for (var _i3 = 0, _Object$keys = Object.keys(wallet.rewardLedger); _i3 < _Object$keys.length; _i3++) {
          var id = _Object$keys[_i3];
          rewardLedger[id] = _extends({}, wallet.rewardLedger[id]);
        }
        return {
          inventory: _extends({}, wallet.inventory),
          rewardLedger: rewardLedger,
          pendingRevives: wallet.pendingRevives.map(function (item) {
            return _extends({}, item);
          })
        };
      }
      function clone(state) {
        var attempt = state.attempt;
        return {
          level: state.level,
          attempt: _extends({}, attempt, {
            board: _extends({}, attempt.board),
            pool: [].concat(attempt.pool),
            auxiliaryLocks: [].concat(attempt.auxiliaryLocks),
            undoStack: [].concat(attempt.undoStack),
            propUses: _extends({}, attempt.propUses),
            preview: attempt.preview ? _extends({}, attempt.preview) : null
          }),
          wallet: cloneWallet(state.wallet)
        };
      }
      function snapshot(state, kind) {
        state.attempt.undoStack.push({
          kind: kind,
          board: _extends({}, state.attempt.board),
          pool: [].concat(state.attempt.pool),
          auxiliaryLocks: [].concat(state.attempt.auxiliaryLocks)
        });
      }
      function rejected(state, reason) {
        return {
          state: state,
          changed: false,
          reason: reason,
          events: []
        };
      }
      function committed(state, events) {
        if (events === void 0) {
          events = [];
        }
        state.attempt.revision++;
        return {
          state: state,
          changed: true,
          events: events
        };
      }
      function resolveBoard(state, spendMove) {
        var attempt = state.attempt;
        if (spendMove) {
          attempt.movesSpent++;
          if (attempt.remainingMoves !== null) attempt.remainingMoves--;
        }
        if (isSolved(state.level, attempt.board, attempt.pool)) {
          attempt.status = 'Won';
          return [{
            type: 'won',
            levelId: state.level.id,
            attemptId: attempt.id
          }];
        }
        if (attempt.remainingMoves !== null && attempt.remainingMoves <= 0) {
          attempt.status = 'Failed';
          return [{
            type: 'failed',
            levelId: state.level.id,
            attemptId: attempt.id
          }];
        }
        attempt.status = 'Playing';
        return [];
      }
      function propReason(state, prop) {
        if (state.attempt.status !== 'Playing') return '当前状态不能使用道具';
        if (state.attempt.propUses[prop] >= PROP_LIMITS[prop]) return '本次尝试已达道具使用上限';
        if (state.wallet.inventory[prop] <= 0) return '道具库存不足';
        return undefined;
      }
      function spendProp(state, prop) {
        state.wallet.inventory[prop]--;
        state.attempt.propUses[prop]++;
      }
      function validId(value) {
        return typeof value === 'string' && value.length > 0 && value !== '__proto__' && value !== 'constructor' && value !== 'prototype';
      }

      /** Returns a new atomic snapshot. Persist the entire snapshot together, before animations. */
      function reduceGame(state, action) {
        var attempt = state.attempt;
        if (action.type === 'restart') {
          if (!validId(action.attemptId) || action.attemptId === attempt.id || Object.values(state.wallet.rewardLedger).some(function (r) {
            return r.attemptId === action.attemptId;
          })) {
            return rejected(state, '重开必须使用新的尝试 ID');
          }
          var next = startLevel(state, state.level, action.attemptId);
          return committed(next);
        }
        if (action.type === 'settleReward') return settleReward(state, action.requestId, action.outcome);
        if (action.type === 'beginReward') return beginReward(state, action);
        if (action.type === 'applyPendingRevive') {
          if (attempt.status !== 'Failed' || attempt.revivesUsed >= state.level.challenge.revive.maxPerAttempt) return rejected(state, '当前不能使用待用复活权益');
          var item = state.wallet.pendingRevives.find(function (r) {
            return r.requestId === action.requestId;
          });
          if (!item) return rejected(state, '待用复活权益不存在');
          var _next = clone(state);
          _next.wallet.pendingRevives = _next.wallet.pendingRevives.filter(function (r) {
            return r.requestId !== action.requestId;
          });
          applyRevive(_next, item.amount);
          return committed(_next);
        }
        if (action.type === 'endPeek' || action.type === 'expirePeek' || action.type === 'suspend') {
          if (attempt.status !== 'PreviewingReference') return rejected(state, '没有正在显示的参考');
          if (action.type === 'expirePeek' && (!Number.isFinite(action.nowMs) || action.nowMs < attempt.preview.expiresAtMs)) return rejected(state, '参考尚未到期');
          var _next2 = clone(state);
          _next2.attempt.status = 'Playing';
          _next2.attempt.preview = null;
          return committed(_next2);
        }
        if (attempt.status !== 'Playing') return rejected(state, '当前状态不能操作棋盘');
        if (action.type === 'move') {
          var from = action.fromCellId,
            to = action.toCellId;
          if (from === to || !own(attempt.board, from) || !own(attempt.board, to) || isLocked(state, from) || isLocked(state, to) || !attempt.board[from] || attempt.board[to] !== null) {
            return rejected(state, '请选择色块和另一个空格');
          }
          var _next3 = clone(state);
          snapshot(_next3, 'move');
          _next3.attempt.board[to] = _next3.attempt.board[from];
          _next3.attempt.board[from] = null;
          return committed(_next3, resolveBoard(_next3, true));
        }
        if (action.type === 'returnToTray') {
          var _from = action.fromCellId;
          if (!own(attempt.board, _from) || isLocked(state, _from) || !attempt.board[_from]) return rejected(state, '请选择可取回的色块');
          var index = state.level.trayHomeByTile[attempt.board[_from]];
          if (!Number.isInteger(index) || attempt.pool[index] !== null) return rejected(state, '色块的候选槽不可用');
          var _next4 = clone(state);
          snapshot(_next4, 'returnToTray');
          _next4.attempt.pool[index] = _next4.attempt.board[_from];
          _next4.attempt.board[_from] = null;
          return committed(_next4, resolveBoard(_next4, false));
        }
        if (action.type === 'place') {
          var _index = action.poolIndex,
            target = action.toCellId;
          if (!Number.isInteger(_index) || _index < 0 || _index >= attempt.pool.length || !attempt.pool[_index] || !own(attempt.board, target) || attempt.board[target] !== null || isLocked(state, target)) {
            return rejected(state, '请把待选色块放入空格');
          }
          var _next5 = clone(state);
          snapshot(_next5, 'place');
          _next5.attempt.board[target] = _next5.attempt.pool[_index];
          _next5.attempt.pool[_index] = null;
          return committed(_next5, resolveBoard(_next5, true));
        }
        if (action.type === 'undo') {
          var entry = attempt.undoStack[attempt.undoStack.length - 1];
          if (!entry) return rejected(state, '还没有可以撤销的操作');
          var _next6 = clone(state);
          _next6.attempt.undoStack.pop();
          _next6.attempt.board = _extends({}, entry.board);
          _next6.attempt.pool = [].concat(entry.pool);
          _next6.attempt.auxiliaryLocks = [].concat(entry.auxiliaryLocks);
          return committed(_next6);
        }
        if (action.type === 'addMoves') {
          var reason = propReason(state, 'addMoves');
          if (reason) return rejected(state, reason);
          if (attempt.remainingMoves === null) return rejected(state, '教学关无需增加步数');
          var _next7 = clone(state);
          spendProp(_next7, 'addMoves');
          _next7.attempt.remainingMoves += 5;
          _next7.attempt.totalMovesGranted += 5;
          return committed(_next7);
        }
        if (action.type === 'peek') {
          var _reason = propReason(state, 'peek');
          if (_reason) return rejected(state, _reason);
          if (!state.level.paths.some(function (p) {
            return p.id === action.pathId;
          }) || !Number.isFinite(action.nowMs)) return rejected(state, '请选择一条有效色路');
          var _next8 = clone(state);
          spendProp(_next8, 'peek');
          _next8.attempt.status = 'PreviewingReference';
          _next8.attempt.preview = {
            pathId: action.pathId,
            expiresAtMs: action.nowMs + 3000
          };
          return committed(_next8);
        }
        if (action.type === 'locate') {
          var _reason2 = propReason(state, 'locate');
          if (_reason2) return rejected(state, _reason2);
          var candidates = state.level.cells.filter(function (c) {
            return !isLocked(state, c.id) && colourAt(state.level, attempt.board, c.id) !== c.targetHex;
          });
          var _target = candidates[0];
          if (!_target) return rejected(state, '没有可归位的色块');
          var sourceCell = state.level.cells.find(function (c) {
            return !isLocked(state, c.id) && colourAt(state.level, attempt.board, c.id) === _target.targetHex;
          });
          var sourcePool = attempt.pool.findIndex(function (id) {
            var _state$level$tiles$fi;
            return id !== null && ((_state$level$tiles$fi = state.level.tiles.find(function (t) {
              return t.id === id;
            })) == null ? void 0 : _state$level$tiles$fi.hex) === _target.targetHex;
          });
          if (!sourceCell && sourcePool < 0) return rejected(state, '没有可用的目标色块');
          var _next9 = clone(state);
          snapshot(_next9, 'locate');
          var displacedTile = _next9.attempt.board[_target.id];
          if (displacedTile !== null) {
            var home = state.level.trayHomeByTile[displacedTile];
            if (!Number.isInteger(home) || _next9.attempt.pool[home] !== null) return rejected(state, '原色块候选槽不可用');
            _next9.attempt.pool[home] = displacedTile;
          }
          if (sourceCell) {
            _next9.attempt.board[_target.id] = _next9.attempt.board[sourceCell.id];
            _next9.attempt.board[sourceCell.id] = null;
          } else {
            _next9.attempt.board[_target.id] = _next9.attempt.pool[sourcePool];
            _next9.attempt.pool[sourcePool] = null;
          }
          _next9.attempt.auxiliaryLocks.push(_target.id);
          spendProp(_next9, 'locate');
          return committed(_next9, resolveBoard(_next9, false));
        }
        return rejected(state, '未知动作');
      }
      function beginReward(state, action) {
        var attempt = state.attempt;
        if (!validId(action.requestId) || own(state.wallet.rewardLedger, action.requestId)) return rejected(state, '奖励请求 ID 已使用或无效');
        // A detached, unconfirmed request remains busy until the platform resolves it.
        if (Object.values(state.wallet.rewardLedger).some(function (r) {
          return r.status === 'pending';
        })) return rejected(state, '已有视频请求等待确认');
        if (action.rewardType === 'revive') {
          if (attempt.status !== 'Failed' || attempt.revivesUsed >= state.level.challenge.revive.maxPerAttempt) return rejected(state, '当前不能申请视频复活');
        } else {
          if (attempt.status !== 'Playing' || !action.prop || !own(PROP_LIMITS, action.prop)) return rejected(state, '当前不能申请道具补货');
          if (attempt.propRestockAdsGranted >= 1) return rejected(state, '本次尝试已领取过道具补货');
          if (state.wallet.inventory[action.prop] !== 0 || attempt.propUses[action.prop] >= PROP_LIMITS[action.prop]) return rejected(state, '当前道具无需或无法补货');
        }
        var next = clone(state);
        next.wallet.rewardLedger[action.requestId] = {
          id: action.requestId,
          attemptId: attempt.id,
          levelId: state.level.id,
          levelContentVersion: state.level.contentVersion,
          rewardType: action.rewardType,
          amount: action.rewardType === 'revive' ? state.level.challenge.revive.addMoves : 1,
          prop: action.rewardType === 'restock' ? action.prop : null,
          status: 'pending'
        };
        next.attempt.previousStatusBeforeAd = attempt.status;
        next.attempt.status = 'AdPending';
        next.attempt.pendingRewardRequestId = action.requestId;
        return committed(next, [{
          type: 'rewardRequested',
          requestId: action.requestId
        }]);
      }
      function applyRevive(state, amount) {
        var _state$attempt$remain;
        state.attempt.remainingMoves = ((_state$attempt$remain = state.attempt.remainingMoves) != null ? _state$attempt$remain : 0) + amount;
        state.attempt.totalMovesGranted += amount;
        state.attempt.revivesUsed++;
        state.attempt.status = 'Playing';
      }
      function settleReward(state, requestId, outcome) {
        var request = own(state.wallet.rewardLedger, requestId) ? state.wallet.rewardLedger[requestId] : undefined;
        if (!request || request.status !== 'pending') return rejected(state, '奖励请求不存在或已经处理');
        var next = clone(state);
        var sameAttempt = request.attemptId === next.attempt.id && request.levelId === next.level.id && request.levelContentVersion === next.level.contentVersion;
        if (sameAttempt && next.attempt.pendingRewardRequestId === requestId) {
          var _next$attempt$previou2;
          next.attempt.status = (_next$attempt$previou2 = next.attempt.previousStatusBeforeAd) != null ? _next$attempt$previou2 : 'Failed';
          next.attempt.previousStatusBeforeAd = null;
          next.attempt.pendingRewardRequestId = null;
        }
        next.wallet.rewardLedger[requestId].status = outcome === 'completed' ? 'granted' : outcome;
        if (outcome !== 'completed') return committed(next);
        var deferred = false;
        if (request.rewardType === 'restock') {
          next.wallet.inventory[request.prop] += request.amount;
          if (sameAttempt) next.attempt.propRestockAdsGranted++;
        } else if (sameAttempt && next.attempt.status === 'Failed' && next.attempt.revivesUsed < next.level.challenge.revive.maxPerAttempt) {
          applyRevive(next, request.amount);
          next.attempt.reviveAdsGranted++;
        } else {
          deferred = true;
          next.wallet.pendingRevives.push({
            requestId: requestId,
            originAttemptId: request.attemptId,
            amount: request.amount
          });
        }
        return committed(next, [{
          type: 'rewardGranted',
          requestId: requestId,
          deferred: deferred
        }]);
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/LocalSave.ts", ['cc', './Progress.ts', './index.ts', './RestoreProgress.ts', './SnapshotStore.ts'], function (exports) {
  var cclegacy, sys, SAVE_KEY, emptyProgress, recoverInterruptedGame, reduceGame, restoreProgress, SnapshotStore;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
      sys = module.sys;
    }, function (module) {
      SAVE_KEY = module.SAVE_KEY;
      emptyProgress = module.emptyProgress;
    }, function (module) {
      recoverInterruptedGame = module.recoverInterruptedGame;
      reduceGame = module.reduceGame;
    }, function (module) {
      restoreProgress = module.restoreProgress;
    }, function (module) {
      SnapshotStore = module.SnapshotStore;
    }],
    execute: function () {
      cclegacy._RF.push({}, "6a69fdRr95PNZ1CVyvqoWI1", "LocalSave", undefined);
      var LocalSave = exports('LocalSave', /*#__PURE__*/function () {
        function LocalSave(backend) {
          if (backend === void 0) {
            backend = sys.localStorage;
          }
          this.error = '';
          this.snapshots = null;
          this.recoveryId = 0;
          this.backend = backend;
        }
        var _proto = LocalSave.prototype;
        _proto.load = function load(contentVersion, levels) {
          var _this = this;
          this.snapshots = new SnapshotStore(this.backend, SAVE_KEY, function (input) {
            return restoreProgress(input, contentVersion, levels, "restored-" + Date.now() + "-" + ++_this.recoveryId);
          });
          var latest = this.snapshots.load();
          this.error = this.snapshots.error;
          if (latest.value) return this.recoverColdStart(latest.value);
          // Earlier development snapshots contribute only validated global data, never old board rules.
          for (var _i = 0, _arr = ['shisezhijian.progress.v1', 'shisezhijian.progress.v1.backup']; _i < _arr.length; _i++) {
            var key = _arr[_i];
            try {
              var value = this.backend.getItem(key);
              if (!value) continue;
              var parsed = restoreProgress(JSON.parse(value), contentVersion, levels, "restored-" + Date.now() + "-" + ++this.recoveryId);
              return this.recoverColdStart(parsed);
            } catch (_unused) {
              this.error = '本地存档暂时不可用';
            }
          }
          return emptyProgress(contentVersion);
        };
        _proto.recoverColdStart = function recoverColdStart(save) {
          if (!save.game) return save;
          save.game = recoverInterruptedGame(save.game);
          // A cold-started process has no surviving SDK instance to resolve the old callback. Release
          // only unconfirmed requests so they cannot permanently block all future videos. Confirmed
          // grants and deferred revival entitlements remain exactly as saved; no reward is invented.
          for (var _i2 = 0, _Object$values = Object.values(save.game.wallet.rewardLedger); _i2 < _Object$values.length; _i2++) {
            var request = _Object$values[_i2];
            if (request.status === 'pending') {
              save.game = reduceGame(save.game, {
                type: 'settleReward',
                requestId: request.id,
                outcome: 'failed'
              }).state;
            }
          }
          return save;
        };
        _proto.write = function write(save) {
          if (!this.snapshots) {
            this.error = '本地存档尚未读取，本次进度尚未保存';
            return false;
          }
          var saved = this.snapshots.write(save);
          this.error = this.snapshots.error;
          return saved;
        };
        return LocalSave;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/main", ['./Boot.ts', './Progress.ts', './RestoreProgress.ts', './RuntimeConfig.ts', './index.ts', './BrowserTestBridge.ts', './Feedback.ts', './LocalSave.ts', './RewardedVideo.ts', './SnapshotStore.ts', './BoardLayout.ts', './Theme.ts'], function () {
  return {
    setters: [null, null, null, null, null, null, null, null, null, null, null, null],
    execute: function () {}
  };
});

System.register("chunks:///_virtual/Progress.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports({
        completeLevel: completeLevel,
        defaultSettings: defaultSettings,
        emptyProgress: emptyProgress,
        unlockedThrough: unlockedThrough
      });
      cclegacy._RF.push({}, "c27d8dExudLQ6MO6zlGWqTt", "Progress", undefined);
      function defaultSettings() {
        return {
          sound: true,
          haptics: true,
          reducedMotion: false
        };
      }
      var SAVE_KEY = exports('SAVE_KEY', 'shisezhijian.click-fill.progress.v2');
      function emptyProgress(contentVersion) {
        return {
          version: 2,
          gameplayMode: 'click-fill',
          inputMode: 'tap',
          contentVersion: contentVersion,
          completed: [],
          starterGranted: false,
          chapterGifts: [],
          settings: defaultSettings(),
          game: null
        };
      }

      /** Progress has no engine dependency; the storage adapter decides where it is written. */
      function completeLevel(save, allIds) {
        if (!save.game || save.game.attempt.status !== 'Won') return;
        var id = save.game.level.id;
        if (!save.completed.includes(id)) save.completed.push(id);
        if (id === 'L004' && !save.starterGranted) {
          save.game.wallet.inventory.locate += 3;
          save.game.wallet.inventory.peek += 2;
          save.game.wallet.inventory.addMoves += 1;
          save.starterGranted = true;
        }
        for (var chapter = 1; chapter <= 5; chapter++) {
          var ids = allIds.slice((chapter - 1) * 20, chapter * 20);
          if (ids.length === 20 && ids.every(function (levelId) {
            return save.completed.includes(levelId);
          }) && !save.chapterGifts.includes(chapter)) {
            save.game.wallet.inventory.locate++;
            save.game.wallet.inventory.peek++;
            save.game.wallet.inventory.addMoves++;
            save.chapterGifts.push(chapter);
          }
        }
      }
      function unlockedThrough(save, allIds) {
        var firstUnfinished = allIds.findIndex(function (id) {
          return !save.completed.includes(id);
        });
        return firstUnfinished < 0 ? allIds.length - 1 : firstUnfinished;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/RestoreProgress.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc', './index.ts', './Progress.ts'], function (exports) {
  var _extends, cclegacy, createGame, restoreGame, unlockedThrough, defaultSettings;
  return {
    setters: [function (module) {
      _extends = module.extends;
    }, function (module) {
      cclegacy = module.cclegacy;
    }, function (module) {
      createGame = module.createGame;
      restoreGame = module.restoreGame;
    }, function (module) {
      unlockedThrough = module.unlockedThrough;
      defaultSettings = module.defaultSettings;
    }],
    execute: function () {
      exports('restoreProgress', restoreProgress);
      cclegacy._RF.push({}, "b4464JW0ZxFf5eu9UBd6dnQ", "RestoreProgress", undefined);
      function record(value, name) {
        if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error("Invalid " + name);
        return value;
      }

      /** Settings damage cannot erase otherwise valid earned progress or inventory. */
      function restoreSettings(value) {
        var defaults = defaultSettings();
        if (!value || typeof value !== 'object' || Array.isArray(value)) return defaults;
        var raw = value;
        return {
          sound: typeof raw.sound === 'boolean' ? raw.sound : defaults.sound,
          haptics: typeof raw.haptics === 'boolean' ? raw.haptics : defaults.haptics,
          reducedMotion: typeof raw.reducedMotion === 'boolean' ? raw.reducedMotion : defaults.reducedMotion
        };
      }

      /**
       * Extracts global player rights from supported save envelopes and binds them to current content.
       * The old attempt is never interpreted using new rules. Invalid wallets throw so storage can try
       * another backup rather than silently replacing earned inventory or confirmed rewards with zero.
       */
      function restoreProgress(input, contentVersion, levels, attemptId) {
        if (!levels.length || !contentVersion) throw new Error('Current content is required');
        var raw = record(input, 'progress');
        if (raw.version !== 1 && raw.version !== 2) throw new Error('Unsupported progress version');
        if (typeof raw.contentVersion !== 'string' || !raw.contentVersion) throw new Error('Invalid saved content version');
        if (typeof raw.starterGranted !== 'boolean' || !Array.isArray(raw.completed) || !Array.isArray(raw.chapterGifts)) throw new Error('Invalid global progress');
        var allIds = levels.map(function (level) {
          return level.id;
        });
        var ids = new Set(allIds);
        var completed = raw.completed;
        var chapterGifts = raw.chapterGifts;
        if (completed.some(function (id) {
          return typeof id !== 'string' || !ids.has(id);
        }) || new Set(completed).size !== completed.length) throw new Error('Invalid completed levels');
        if (chapterGifts.some(function (chapter) {
          return typeof chapter !== 'number' || !Number.isInteger(chapter) || chapter < 1 || chapter > 5;
        }) || new Set(chapterGifts).size !== chapterGifts.length) throw new Error('Invalid chapter gift markers');
        var save = {
          version: 2,
          gameplayMode: 'click-fill',
          inputMode: 'tap',
          contentVersion: contentVersion,
          completed: [].concat(completed),
          starterGranted: raw.starterGranted,
          chapterGifts: [].concat(chapterGifts),
          settings: restoreSettings(raw.settings),
          game: null
        };
        if (raw.game === null) {
          // A pristine save has no wallet yet. A played save without one cannot be reconstructed safely.
          if (save.completed.length || save.starterGranted || save.chapterGifts.length) throw new Error('Played progress is missing its wallet');
          return save;
        }
        var rawGame = record(raw.game, 'saved game');
        var unlocked = unlockedThrough(save, allIds);
        var savedLevelId = rawGame.level && typeof rawGame.level === 'object' ? rawGame.level.id : undefined;
        var savedIndex = levels.findIndex(function (level) {
          return level.id === savedLevelId;
        });
        var level = levels[savedIndex >= 0 && savedIndex <= unlocked ? savedIndex : unlocked];
        var fresh = createGame(level, attemptId);
        // Validate the wallet independently of any damaged/obsolete board or attempt metadata.
        var walletOnly = restoreGame(level, _extends({}, fresh, {
          wallet: rawGame.wallet
        }));
        var restored = null;
        if (savedLevelId === level.id) {
          try {
            restored = restoreGame(level, rawGame);
          } catch (_unused) {/* Only the attempt is replaced below. */}
        }
        if (restored) save.game = restored;else {
          var rawAttempt = rawGame.attempt;
          var oldAttemptId = rawAttempt && typeof rawAttempt === 'object' ? rawAttempt.id : undefined;
          if (attemptId === oldAttemptId || Object.values(walletOnly.wallet.rewardLedger).some(function (request) {
            return request.attemptId === attemptId;
          })) throw new Error('Replacement attempt ID must be fresh');
          save.game = walletOnly;
        }
        return save;
      }
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/RewardedVideo.ts", ['./rollupPluginModLoBabelHelpers.js', 'cc'], function (exports) {
  var _createClass, cclegacy;
  return {
    setters: [function (module) {
      _createClass = module.createClass;
    }, function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      exports('isDouyinRuntime', isDouyinRuntime);
      cclegacy._RF.push({}, "fa437tIuMNGJKePVe585mbB", "RewardedVideo", undefined);
      function globalRuntime() {
        var runtime = globalThis.tt;
        return runtime === undefined ? null : runtime != null ? runtime : {};
      }
      function isDouyinRuntime() {
        return typeof globalThis.tt !== 'undefined';
      }

      /** Full viewing is confirmed by the real SDK close result; web simulation must be explicit. */
      var RewardedVideo = exports('RewardedVideo', /*#__PURE__*/function () {
        function RewardedVideo(options) {
          var _options$adUnitId$tri, _options$adUnitId, _options$timeoutMs, _this$runtime;
          if (options === void 0) {
            options = {};
          }
          this.simulationAvailable = void 0;
          this.available = void 0;
          this.unavailableReason = void 0;
          this.runtime = void 0;
          this.adUnitId = void 0;
          this.timeoutMs = void 0;
          this.cancelActive = null;
          this.runtime = options.runtime === undefined ? globalRuntime() : options.runtime;
          this.adUnitId = (_options$adUnitId$tri = (_options$adUnitId = options.adUnitId) == null ? void 0 : _options$adUnitId.trim()) != null ? _options$adUnitId$tri : '';
          this.timeoutMs = Math.max(1000, (_options$timeoutMs = options.timeoutMs) != null ? _options$timeoutMs : 180000);
          this.simulationAvailable = this.runtime === null;
          this.available = this.simulationAvailable || this.adUnitId.length > 0 && typeof ((_this$runtime = this.runtime) == null ? void 0 : _this$runtime.createRewardedVideoAd) === 'function';
          this.unavailableReason = !this.adUnitId ? '激励视频尚未配置，请免费重试' : '当前环境暂不支持激励视频，请免费重试';
        }
        var _proto = RewardedVideo.prototype;
        _proto.show = function show(onResult, presentSimulation) {
          var _this = this;
          if (this.cancelActive || !this.available) {
            onResult('failed');
            return;
          }
          if (this.simulationAvailable) {
            if (!presentSimulation) {
              onResult('failed');
              return;
            }
            var _settled = false;
            var _settle = function _settle(result) {
              if (_settled) return;
              _settled = true;
              _this.cancelActive = null;
              onResult(result);
            };
            this.cancelActive = function () {
              return _settle('cancelled');
            };
            try {
              presentSimulation(function () {
                return _settle('completed');
              }, function () {
                return _settle('cancelled');
              }, function () {
                return _settle('failed');
              });
            } catch (_unused) {
              _settle('failed');
            }
            return;
          }
          var ad;
          try {
            ad = this.runtime.createRewardedVideoAd({
              adUnitId: this.adUnitId
            });
          } catch (_unused2) {
            onResult('failed');
            return;
          }
          var settled = false;
          var timer = null;
          var close = function close(result) {
            // Current SDKs return count even in ordinary single-video mode; follow its documented
            // precedence. One request still grants one reward, regardless of a larger count.
            var completed = (result == null ? void 0 : result.count) !== undefined ? Number.isInteger(result.count) && result.count >= 1 : (result == null ? void 0 : result.isEnded) === true;
            settle(completed ? 'completed' : 'cancelled');
          };
          var error = function error(_error) {
            return settle('failed');
          };
          var settle = function settle(result) {
            if (settled) return;
            settled = true;
            if (timer !== null) clearTimeout(timer);
            _this.cancelActive = null;
            try {
              ad.offClose == null || ad.offClose(close);
            } catch (_unused3) {/* SDK cleanup must not duplicate or suppress settlement. */}
            try {
              ad.offError == null || ad.offError(error);
            } catch (_unused4) {/* Same as above. */}
            try {
              ad.destroy == null || ad.destroy();
            } catch (_unused5) {/* Same as above. */}
            onResult(result);
          };
          this.cancelActive = function () {
            return settle('cancelled');
          };
          try {
            ad.onClose(close);
            if (settled) return;
            ad.onError(error);
            if (settled) return;
            timer = setTimeout(function () {
              return settle('failed');
            }, this.timeoutMs);
            Promise.resolve(ad.load()).then(function () {
              if (!settled) return ad.show();
              return undefined;
            })["catch"](error);
          } catch (caught) {
            error();
          }
        }

        /** Intentionally request only the explicitly labelled web simulation. */;
        _proto.showSimulation = function showSimulation(onResult, present) {
          if (!this.simulationAvailable) {
            onResult('failed');
            return;
          }
          this.show(onResult, present);
        };
        _proto.dispose = function dispose() {
          var _this$cancelActive;
          (_this$cancelActive = this.cancelActive) == null || _this$cancelActive.call(this);
        };
        _createClass(RewardedVideo, [{
          key: "isShowing",
          get: function get() {
            return this.cancelActive !== null;
          }
        }]);
        return RewardedVideo;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/RuntimeConfig.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      cclegacy._RF.push({}, "6f523+AJOBIzo7ibmFPINeQ", "RuntimeConfig", undefined);
      /** This artifact is a tester build. Set testTools=false before a release build. */
      var runtimeConfig = exports('runtimeConfig', {
        version: '0.1.0-test.1',
        testTools: true,
        rewardedAdUnitId: ''
      });
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/SnapshotStore.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      cclegacy._RF.push({}, "de107QKa/pPHZGOq3FTUsSK", "SnapshotStore", undefined);
      /** Synchronous storage shared by Cocos localStorage, tt storage and the test backend. */
      /**
       * Two independently valid, monotonically versioned snapshots. An existing good copy is never
       * overwritten until a replacement has been written and read back byte-for-byte. The format is
       * an integrity/compatibility envelope, not an anti-cheat signature or a cloud save.
       */
      var SnapshotStore = exports('SnapshotStore', /*#__PURE__*/function () {
        function SnapshotStore(backend, key, validate) {
          this.error = '';
          this.revision = 0;
          this.backend = backend;
          this.key = key;
          this.validate = validate;
        }
        var _proto = SnapshotStore.prototype;
        _proto.decode = function decode(key, encoded) {
          var raw = JSON.parse(encoded);
          if (raw && typeof raw === 'object' && 'snapshotFormat' in raw) {
            var envelope = raw;
            if (envelope.snapshotFormat !== 1 || !Number.isSafeInteger(envelope.revision) || envelope.revision < 1 || !('payload' in envelope)) throw new Error('Invalid snapshot envelope');
            return {
              key: key,
              revision: envelope.revision,
              value: this.validate(envelope.payload),
              encoded: encoded
            };
          }
          // Earlier saves had a plain versioned progress payload, before the storage envelope existed.
          return {
            key: key,
            revision: 0,
            value: this.validate(raw),
            encoded: encoded
          };
        };
        _proto.inspect = function inspect() {
          var valid = [];
          var warning = false;
          var found = false;
          for (var _i = 0, _arr = [this.key, this.key + ".backup"]; _i < _arr.length; _i++) {
            var _key = _arr[_i];
            try {
              var encoded = this.backend.getItem(_key);
              if (encoded === null || encoded === '') continue;
              found = true;
              valid.push(this.decode(_key, encoded));
            } catch (_unused) {
              warning = true;
            }
          }
          valid.sort(function (a, b) {
            return b.revision - a.revision || Number(a.key.endsWith('.backup')) - Number(b.key.endsWith('.backup'));
          });
          return {
            valid: valid,
            warning: warning,
            found: found
          };
        };
        _proto.load = function load() {
          var _latest$revision, _latest$value;
          var inspected = this.inspect();
          var latest = inspected.valid[0];
          this.revision = (_latest$revision = latest == null ? void 0 : latest.revision) != null ? _latest$revision : 0;
          this.error = inspected.warning ? '部分本地存档不可用，已尝试恢复有效副本' : '';
          return {
            value: (_latest$value = latest == null ? void 0 : latest.value) != null ? _latest$value : null,
            revision: this.revision,
            warning: inspected.warning,
            found: inspected.found
          };
        };
        _proto.write = function write(value) {
          try {
            var _inspected$valid$;
            var inspected = this.inspect();
            var nextRevision = Math.max.apply(Math, [this.revision].concat(inspected.valid.map(function (snapshot) {
              return snapshot.revision;
            }))) + 1;
            if (!Number.isSafeInteger(nextRevision)) throw new Error('Snapshot revision exhausted');
            var encoded = JSON.stringify({
              snapshotFormat: 1,
              revision: nextRevision,
              payload: value
            });
            this.decode(this.key, encoded); // Never overwrite good storage with unserialisable/invalid state.
            var latestKey = (_inspected$valid$ = inspected.valid[0]) == null ? void 0 : _inspected$valid$.key;
            // Write the older, invalid or absent slot first, preserving the newest legal previous save.
            var firstKey = latestKey === this.key ? this.key + ".backup" : this.key;
            var secondKey = firstKey === this.key ? this.key + ".backup" : this.key;
            var committed = 0;
            for (var _i2 = 0, _arr2 = [firstKey, secondKey]; _i2 < _arr2.length; _i2++) {
              var _key2 = _arr2[_i2];
              if (_key2 === latestKey && !committed) continue;
              try {
                this.backend.setItem(_key2, encoded);
                var readback = this.backend.getItem(_key2);
                if (readback !== encoded) throw new Error('Snapshot readback mismatch');
                this.decode(_key2, readback);
                committed++;
              } catch (_unused2) {
                // Keep the newest old copy if no replacement has been verified. With empty storage,
                // trying the other slot is safe; after a verified write, mirroring is also safe.
              }
            }
            if (!committed) throw new Error('No new snapshot verified');
            this.revision = nextRevision;
            this.error = committed < 2 ? '进度已保存，备用存档暂时不可写' : '';
            return true;
          } catch (_unused3) {
            this.error = '本地空间不足或存储不可用，本次进度尚未保存';
            return false;
          }
        };
        return SnapshotStore;
      }());
      cclegacy._RF.pop();
    }
  };
});

System.register("chunks:///_virtual/Theme.ts", ['cc'], function (exports) {
  var cclegacy;
  return {
    setters: [function (module) {
      cclegacy = module.cclegacy;
    }],
    execute: function () {
      cclegacy._RF.push({}, "649d3vwyeFMWJhMxsC5995Y", "Theme", undefined);
      // Generated by tools/design/sync-theme.mjs from design-tokens.json. Do not edit.
      // Puzzle tile faces always use exact level HEX, never this theme palette.
      var theme = exports('theme', {
        "colors": {
          "background": "#FFF9F0",
          "boardBackground": "#F7F7F2",
          "surface": "#FFFFFF",
          "text": "#54483F",
          "textSecondary": "#75695E",
          "primary": "#E97860",
          "primaryPressed": "#E16E57",
          "onPrimary": "#30221C",
          "mint": "#D9EEE4",
          "lilac": "#E9E2F5",
          "butter": "#FFF0C4",
          "border": "#E9E1D6",
          "track": "#C6D0C9",
          "warning": "#A74630",
          "selection": "#554D72",
          "disabled": "#ECE7DF",
          "scrim": "#54483F"
        },
        "spacing": {
          "unit": 4,
          "xs": 4,
          "sm": 8,
          "md": 12,
          "lg": 16,
          "xl": 24,
          "xxl": 32
        },
        "radii": {
          "tile": 8,
          "button": 26,
          "card": 20,
          "modal": 28,
          "pill": 99
        },
        "typography": {
          "family": "sans-serif",
          "title": 30,
          "chapter": 18,
          "body": 16,
          "button": 18,
          "caption": 13,
          "moves": 20
        },
        "controls": {
          "minimumTouchSize": 48,
          "primaryHeight": 56,
          "secondaryHeight": 48,
          "iconSize": 24,
          "scrimOpacity": 0.16
        },
        "board": {
          "preferredCellSize": 52,
          "minimumVisibleCellSize": 44,
          "preferredGap": 8,
          "minimumGap": 6,
          "maximumColumns": 6,
          "maximumRows": 6,
          "trayColumns": 6,
          "trayRowsPerPage": 3,
          "trayPageSize": 18
        },
        "motion": {
          "pressMs": 90,
          "placementMs": 160,
          "modalMs": 220,
          "completeMs": 650
        }
      });
      cclegacy._RF.pop();
    }
  };
});

(function(r) {
  r('virtual:///prerequisite-imports/main', 'chunks:///_virtual/main'); 
})(function(mid, cid) {
    System.register(mid, [cid], function (_export, _context) {
    return {
        setters: [function(_m) {
            var _exportObj = {};

            for (var _key in _m) {
              if (_key !== "default" && _key !== "__esModule") _exportObj[_key] = _m[_key];
            }
      
            _export(_exportObj);
        }],
        execute: function () { }
    };
    });
});
//# sourceMappingURL=index.js.map