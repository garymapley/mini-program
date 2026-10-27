const categories = ['饮品', '美食', '购物', '出行', '其他'];
const quickAmounts = [5, 10, 20, 50];
const categoryStyle = {
  '饮品': { cls: 'drink', emoji: '🥤' },
  '美食': { cls: 'food', emoji: '🍜' },
  '购物': { cls: 'shopping', emoji: '🛍️' },
  '出行': { cls: 'travel', emoji: '🚕' },
  '其他': { cls: 'other', emoji: '✨' }
};
const sampleRecords = [];
function dateKey(date) {
  const d = date || new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
function money(value) { return (Number(value) || 0).toFixed(2); }
function displayDate(value) {
  const d = new Date(value);
  return `${d.getMonth()+1}月${d.getDate()}日`;
}
Page({
  data: { records: [], todayTotal: '0.00', monthTotal: '0.00', count: 0, jarAmount: 0, categories, quickAmounts, selectedQuickAmount: 0, activeCategory: '饮品', showForm: false, showGuide: false, amount: '', item: '', reason: '', todayLabel: '', monthLabel: '', streak: 0, selectedDay: '', selectedLabel: '', balance: '', balanceDate: '', balanceInput: '', showBalanceForm: false, periodMode: 'week', periodModeLabel: '一周', referenceAmount: '—', savedSinceSnapshot: '0.00', referenceStart: '', referenceEnd: '', periodStatus: '先填写微信零钱快照作为起点', hasBalance: false, periodComplete: false, showCard: false, cardCategory: '', cardClass: 'other', cardEmoji: '✨', cardReason: '', cardItem: '', cardAmount: '' },
  onLoad() {
    const now = new Date();
    const balance = wx.getStorageSync('wallet-balance') || '';
    const balanceDate = wx.getStorageSync('wallet-balance-date') || '';
    let balanceAt = Number(wx.getStorageSync('wallet-balance-at')) || Date.parse(String(balanceDate).replace(' ', 'T'));
    if (balance && !Number.isFinite(balanceAt)) balanceAt = now.getTime();
    if (balance && !wx.getStorageSync('wallet-balance-at')) wx.setStorageSync('wallet-balance-at', balanceAt);
    this.setData({ todayLabel: `${now.getMonth()+1}月${now.getDate()}日`, monthLabel: `${now.getMonth()+1}月`, selectedDay: dateKey(now), todayDate: dateKey(now), selectedLabel: `${now.getMonth()+1}月${now.getDate()}日`, balance, balanceDate, balanceAt });
    const saved = wx.getStorageSync('saved-money-records');
    if (!saved) wx.setStorageSync('saved-money-records', sampleRecords);
    const win = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.setData({ actionW: Math.round(240 / 750 * win.windowWidth) });
    if (!wx.getStorageSync('guide-seen')) this.setData({ showGuide: true });
    this.refresh();
  },
  onShow() { this.refresh(); },
  onPullDownRefresh() { this.refresh(); wx.stopPullDownRefresh(); },
  closeGuide() { wx.setStorageSync('guide-seen', '1'); this.setData({ showGuide: false }); },
  openGuide() { this.setData({ showGuide: true }); },
  onUnload() { if (this._countTimer) { clearInterval(this._countTimer); this._countTimer = null; } },
  refresh(opts) {
    opts = opts || {};
    const records = wx.getStorageSync('saved-money-records') || [];
    const today = dateKey();
    const selectedDay = this.data.selectedDay || today;
    const month = selectedDay.slice(0,7);
    const todays = records.filter(r => r.date === selectedDay);
    const monthly = records.filter(r => r.date.startsWith(month));
    const monthAmount = monthly.reduce((s,r)=>s+(Number(r.amount)||0),0);
    const activeDays = [...new Set(records.map(r => r.date))].sort().reverse();
    let streak = 0;
    if (activeDays.length) {
      let cursor = new Date();
      if (activeDays[0] !== today) cursor.setDate(cursor.getDate()-1);
      for (const day of activeDays) {
        if (day === dateKey(cursor)) { streak++; cursor.setDate(cursor.getDate()-1); } else break;
      }
    }
    const selectedDate = new Date(`${selectedDay}T00:00:00`);
    const period = this.calculateReference(records);
    const sortedRecordList = todays.slice().sort((a,b) => { if (!!b.pinned !== !!a.pinned) return (b.pinned?1:0)-(a.pinned?1:0); if (a.pinned && b.pinned) return (b.pinnedAt||0)-(a.pinnedAt||0); return b.createdAt-a.createdAt; });
    const todayNum = todays.reduce((s,r)=>s+(Number(r.amount)||0),0);
    this.setData({ records: sortedRecordList.map(r => ({ ...r, displayAmount: money(r.amount), displayTime: this.formatTime(r.createdAt), offset: 0, animate: false })), monthTotal: money(monthAmount), count: todays.length, jarAmount: monthAmount, streak, selectedLabel: `${selectedDate.getMonth()+1}月${selectedDate.getDate()}日`, monthLabel: `${selectedDate.getMonth()+1}月`, isToday: selectedDay === today, ...period });
    if (opts.animate && Number.isFinite(this._totalNum)) {
      this.startCountUp(this._totalNum, todayNum);
    } else {
      this._totalNum = todayNum;
      this.setData({ todayTotal: money(todayNum) });
    }
  },
  // 金额平滑计数滚动：从 from 缓动到 to
  startCountUp(from, to) {
    if (this._countTimer) { clearInterval(this._countTimer); this._countTimer = null; }
    const start = Date.now();
    const duration = 700;
    const fromN = Number(from) || 0;
    const toN = Number(to) || 0;
    if (fromN === toN) { this._totalNum = toN; this.setData({ todayTotal: money(toN) }); return; }
    const tick = () => {
      const t = Math.min(1, (Date.now() - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = fromN + (toN - fromN) * eased;
      this._totalNum = value;
      this.setData({ todayTotal: money(value) });
      if (t >= 1) {
        clearInterval(this._countTimer);
        this._countTimer = null;
        this._totalNum = toN;
        this.setData({ todayTotal: money(toN) });
      }
    };
    this._countTimer = setInterval(tick, 16);
  },
  choosePeriod(e) { this.setData({ periodMode: e.currentTarget.dataset.mode, periodModeLabel: e.currentTarget.dataset.mode === 'week' ? '一周' : '一个月' }); this.refresh(); },
  calculateReference(records) {
    const balance = Number(this.data.balance);
    const startAt = Number(this.data.balanceAt);
    if (this.data.balance === '' || !Number.isFinite(balance) || !Number.isFinite(startAt)) {
      return { hasBalance: false, referenceAmount: '—', savedSinceSnapshot: '0.00', referenceStart: '', referenceEnd: '', periodStatus: '先填写微信零钱快照作为起点', periodComplete: false };
    }
    const startDate = new Date(startAt);
    const endDate = new Date(startAt);
    if (this.data.periodMode === 'week') endDate.setDate(endDate.getDate() + 7);
    else endDate.setTime(new Date(startDate.getFullYear(), startDate.getMonth() + 1, 1).getTime() - 1);
    const endAt = endDate.getTime();
    const now = Date.now();
    const cutoff = Math.min(now, endAt);
    const startDay = dateKey(startDate);
    const endDay = dateKey(endDate);
    const saved = records.reduce((sum, record) => {
      const createdAt = Number(record.createdAt);
      const eventDay = String(record.date || '');
      return createdAt >= startAt && createdAt <= cutoff && eventDay >= startDay && eventDay <= endDay ? sum + (Number(record.amount) || 0) : sum;
    }, 0);
    const complete = now >= endAt;
    const daysLeft = Math.max(0, Math.ceil((endAt - now) / 86400000));
    return {
      hasBalance: true,
      referenceAmount: money(balance + saved),
      savedSinceSnapshot: money(saved),
      referenceStart: displayDate(startAt),
      referenceEnd: displayDate(endAt),
      periodStatus: complete ? '本周期已结束' : `周期进行中 · 还剩 ${daysLeft} 天`,
      periodComplete: complete
    };
  },
  onDateChange(e) { this.setData({ selectedDay: e.detail.value }); this.refresh(); },
  openBalanceForm() { this.setData({ showBalanceForm: true, balanceInput: this.data.balance || '' }); },
  closeBalanceForm() { this.setData({ showBalanceForm: false }); },
  onBalanceInput(e) { this.setData({ balanceInput: e.detail.value }); },
  saveBalance() {
    if (String(this.data.balanceInput).trim() === '') return wx.showToast({ title: '请输入当前余额', icon: 'none' });
    const value = Number(this.data.balanceInput);
    if (!Number.isFinite(value) || value < 0) return wx.showToast({ title: '请输入有效余额', icon: 'none' });
    const balance = money(value);
    const now = new Date();
    const balanceDate = `${dateKey(now)} ${this.formatTime(now.getTime())}`;
    wx.setStorageSync('wallet-balance', balance);
    wx.setStorageSync('wallet-balance-date', balanceDate);
    wx.setStorageSync('wallet-balance-at', now.getTime());
    this.setData({ balance, balanceDate, balanceAt: now.getTime(), showBalanceForm: false });
    this.refresh();
    wx.showToast({ title: '余额已更新', icon: 'success' });
  },
  openForm() { this.setData({ showForm: true, amount: '', selectedQuickAmount: 0, item: '', reason: '', activeCategory: '饮品' }); },
  closeForm() { this.setData({ showForm: false }); },
  stopTap() {},
  onAmountInput(e) { this.setData({ amount: e.detail.value, selectedQuickAmount: 0 }); },
  chooseAmount(e) { const amount = Number(e.currentTarget.dataset.amount); this.setData({ amount: String(amount), selectedQuickAmount: amount }); },
  onItemInput(e) { this.setData({ item: e.detail.value }); },
  onReasonInput(e) { this.setData({ reason: e.detail.value }); },
  chooseCategory(e) { this.setData({ activeCategory: e.currentTarget.dataset.name }); },
  saveRecord() {
    if (String(this.data.amount).trim() === '') return wx.showToast({ title: '先填入省下的金额', icon: 'none' });
    const amount = Number(this.data.amount);
    if (!Number.isFinite(amount) || amount <= 0) return wx.showToast({ title: '请输入大于 0 的有效金额', icon: 'none' });
    const records = wx.getStorageSync('saved-money-records') || [];
    const now = new Date();
    records.push({ id: `${now.getTime()}-${Math.random().toString(16).slice(2,6)}`, amount: Math.round(amount*100)/100, item: this.data.item.trim() || '一笔克制消费', reason: this.data.reason.trim() || '今天的我，做了更好的选择', category: this.data.activeCategory, date: this.data.selectedDay || dateKey(now), createdAt: now.getTime() });
    wx.setStorageSync('saved-money-records', records);
    this.setData({ showForm: false });
    this.refresh({ animate: true });
    this.flyCoinToJar(amount);
    wx.showToast({ title: '记下这份小小胜利', icon: 'success' });
  },
  deleteRecord(e) {
    const id = e.currentTarget.dataset.id;
    wx.showModal({ title: '删除这条记录？', content: '删除后统计金额也会相应减少。', confirmText: '删除', confirmColor: '#d66c4b', success: res => {
      if (res.confirm) { wx.setStorageSync('saved-money-records', (wx.getStorageSync('saved-money-records') || []).filter(r => r.id !== id)); this.refresh(); }
    }});
  },
  pinRecord(e) {
    const index = e.currentTarget.dataset.index;
    const record = this.data.records[index];
    if (!record) return;
    const all = wx.getStorageSync('saved-money-records') || [];
    const target = all.find(r => r.id === record.id);
    if (!target) return;
    if (target.pinned) { delete target.pinned; delete target.pinnedAt; }
    else { target.pinned = true; target.pinnedAt = Date.now(); }
    wx.setStorageSync('saved-money-records', all);
    this.refresh();
    wx.showToast({ title: target.pinned ? '已置顶' : '已取消置顶', icon: 'none' });
  },
  onSwipeStart(e) {
    const index = e.currentTarget.dataset.index;
    const record = this.data.records[index];
    if (!record) return;
    this._justSwiped = false;
    this._swipe = { index, startX: e.touches[0].clientX, startY: e.touches[0].clientY, base: record.offset || 0, moved: false, axis: '' };
  },
  onSwipeMove(e) {
    const swipe = this._swipe;
    if (!swipe) return;
    const dx = e.touches[0].clientX - swipe.startX;
    const dy = e.touches[0].clientY - swipe.startY;
    if (!swipe.axis) {
      if (Math.abs(dx) > 6 || Math.abs(dy) > 6) swipe.axis = Math.abs(dx) > Math.abs(dy) ? 'x' : 'y';
    }
    if (swipe.axis !== 'x') return;
    swipe.moved = true;
    const max = this.data.actionW;
    let offset = swipe.base + dx;
    if (offset > 0) offset = 0;
    if (offset < -max) offset = -max;
    this.setData({ [`records[${swipe.index}].offset`]: offset, [`records[${swipe.index}].animate`]: false });
  },
  onSwipeEnd() {
    const swipe = this._swipe;
    if (!swipe) return;
    this._swipe = null;
    const index = swipe.index;
    const record = this.data.records[index];
    if (!record || !swipe.moved) return;
    this._justSwiped = true;
    const max = this.data.actionW;
    const open = (record.offset || 0) < -max * 0.45;
    const updates = { [`records[${index}].animate`]: true, [`records[${index}].offset`]: open ? -max : 0 };
    this.data.records.forEach((item, i) => { if (i !== index && item.offset) { updates[`records[${i}].animate`] = true; updates[`records[${i}].offset`] = 0; } });
    this.setData(updates);
  },
  // 让一枚金币从底部按钮飞入存钱罐
  flyCoinToJar(amount) {
    const jar = this.selectComponent('#jar');
    if (!jar) return;
    jar.flyCoin(null, '+¥' + money(amount));
  },
  onJarTap() {
    // 点一下存钱罐：轻微晃动反馈
  },
  openCard(e) {
    if (this._justSwiped) { this._justSwiped = false; return; }
    const index = e.currentTarget.dataset.index;
    const record = this.data.records[index];
    if (!record) return;
    if (record.offset) {
      this.setData({ [`records[${index}].animate`]: true, [`records[${index}].offset`]: 0 });
      return;
    }
    const style = categoryStyle[record.category] || categoryStyle['其他'];
    this.setData({
      showCard: true,
      cardCategory: record.category,
      cardClass: style.cls,
      cardEmoji: style.emoji,
      cardReason: record.reason,
      cardItem: record.item,
      cardAmount: record.displayAmount
    });
  },
  closeCard() {
    this.setData({ showCard: false });
  },
  formatTime(value) {
    const d = new Date(value);
    return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
  }
});
