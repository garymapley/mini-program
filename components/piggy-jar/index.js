// components/piggy-jar/index.js
// 存钱罐 + 金币飞入动画
Component({
  options: {
    styleIsolation: 'isolated'
  },

  properties: {
    // 当前已省金额
    amount: { type: Number, value: 0 },
    // 存钱罐"装满"对应的金额（用于计算罐内金币液面高度）
    goal: { type: Number, value: 100 },
    // 一枚金币从起点飞到罐口的时长（毫秒）
    duration: { type: Number, value: 680 }
  },

  data: {
    fillPercent: 0, // 罐内金币液面百分比
    coins: [],      // 正在飞行的金币
    jarBounce: false,
    spark: false
  },

  observers: {
    'amount, goal': function (amount, goal) {
      this._updateFill(amount, goal);
    }
  },

  lifetimes: {
    attached() {
      this._updateFill(this.data.amount, this.data.goal);
    },
    detached() {
      clearTimeout(this._shakeTimer);
      clearTimeout(this._sparkTimer);
    }
  },

  methods: {
    _updateFill(amount, goal) {
      const g = Number(goal) || 0;
      let pct = g > 0 ? (Number(amount) / g) * 100 : 0;
      pct = Math.max(0, Math.min(100, pct));
      this.setData({ fillPercent: pct });
    },

    /**
     * 触发一枚金币飞入存钱罐。
     * @param {Object} startRect 起点矩形(可选)，来自 wx.createSelectorQuery().boundingClientRect()
     *                           不传时默认从屏幕底部中间飞出。
     * @param {String} label 金币下方显示的文案(可选)，例如 "+¥2.00"
     */
    flyCoin(startRect, label) {
      const query = this.createSelectorQuery();
      query.select('.jar-body').boundingClientRect();
      query.exec((res) => {
        const jar = res && res[0];
        if (!jar) return;

        const sys = (wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync());
        const from = startRect || {
          left: (sys.windowWidth || 375) / 2 - 22,
          top: (sys.windowHeight || 667) - 90,
          width: 44,
          height: 44
        };

        const coinSize = 22; // 约等于 44rpx（按 375 设计宽度换算）
        const startX = from.left + ((from.width || coinSize) / 2) - coinSize / 2;
        const startY = from.top + ((from.height || coinSize) / 2) - coinSize / 2;
        const targetX = jar.left + jar.width / 2 - coinSize / 2;
        const targetY = jar.top + jar.height * 0.26 - coinSize / 2;

        const id = (this._seq = (this._seq || 0) + 1);
        const coin = {
          id,
          x: startX,
          y: startY,
          tx: 0,
          ty: 0,
          dur: this.data.duration,
          label: label || ''
        };

        this.setData({ coins: this.data.coins.concat(coin) }, () => {
          // 先渲染在起点，再设目标坐标触发过渡动画
          setTimeout(() => {
            const idx = this.data.coins.findIndex((c) => c.id === id);
            if (idx < 0) return;
            this.setData({
              [`coins[${idx}].tx`]: targetX - startX,
              [`coins[${idx}].ty`]: targetY - startY
            });
          }, 24);
        });

        // 兜底：动画结束事件未触发时也要清理并晃动
        setTimeout(() => {
          const rest = this.data.coins.filter((c) => c.id !== id);
          if (rest.length !== this.data.coins.length) {
            this.setData({ coins: rest });
            this._bounce();
          }
        }, this.data.duration + 500);
      });
    },

    // 金币到达罐口
    onCoinArrive(e) {
      const id = Number(e.currentTarget.dataset.id);
      const coins = this.data.coins.filter((c) => c.id !== id);
      if (coins.length === this.data.coins.length) return; // 已清理
      this.setData({ coins });
      this._bounce();
    },

    _bounce() {
      this.setData({ jarBounce: true, spark: true });
      clearTimeout(this._shakeTimer);
      this._shakeTimer = setTimeout(() => this.setData({ jarBounce: false }), 320);
      clearTimeout(this._sparkTimer);
      this._sparkTimer = setTimeout(() => this.setData({ spark: false }), 660);
    },

    onJarTap() {
      this._bounce();
      this.triggerEvent('jartap');
    }
  }
});
