document.addEventListener('DOMContentLoaded', async () => {
  const app = window.SattaSheetApp
  const runtime = app.createSupabaseClient()
  const client = runtime.client

  const state = {
    user: null,
    bets: [],
    range: 'all'
  }

  const charts = {}
  let chartRenderToken = 0

  const elements = {
    fatal: document.getElementById('fatal-state'),
    app: document.getElementById('analytics-app'),
    heroNet: document.getElementById('analytics-net'),
    heroRoi: document.getElementById('analytics-roi'),
    heroRange: document.getElementById('analytics-range-copy'),
    heroSubtitle: document.getElementById('analytics-subtitle'),
    userBadge: document.getElementById('analytics-user-badge'),
    userName: document.getElementById('analytics-user-name'),
    userEmail: document.getElementById('analytics-user-email'),
    rangeButtons: document.querySelectorAll('[data-range]'),
    lastSync: document.getElementById('analytics-last-sync'),
    kpiPeakDay: document.getElementById('kpi-peak-day'),
    kpiPeakValue: document.getElementById('kpi-peak-value'),
    kpiWorstDay: document.getElementById('kpi-worst-day'),
    kpiWorstValue: document.getElementById('kpi-worst-value'),
    kpiWinRate: document.getElementById('kpi-win-rate'),
    kpiOpenExposure: document.getElementById('kpi-open-exposure'),
    kpiTrackedDays: document.getElementById('kpi-tracked-days'),
    kpiSettled: document.getElementById('kpi-settled'),
    volumeCanvas: document.getElementById('volume-chart'),
    equityCanvas: document.getElementById('equity-chart'),
    distributionCanvas: document.getElementById('distribution-chart'),
    pnlCanvas: document.getElementById('pnl-chart'),
    distributionTotal: document.getElementById('distribution-total'),
    legendWins: document.getElementById('legend-wins'),
    legendLosses: document.getElementById('legend-losses'),
    legendPending: document.getElementById('legend-pending'),
    breakdownList: document.getElementById('breakdown-list'),
    signoutButtons: document.querySelectorAll('[data-signout]')
  }

  function getInitials(name) {
    return String(name || 'Operator')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0].toUpperCase())
      .join('')
  }

  function formatSigned(value, compact) {
    const absolute = compact ? app.formatCompact(Math.abs(value || 0)) : app.formatAmount(Math.abs(value || 0))
    return `${value >= 0 ? '+' : '-'}₹${absolute}`
  }

  function showFatal(error) {
    const setupState = app.isMissingBetsTableError(error)
      ? app.getBetsSetupState('analytics')
      : null
    const message = app.getErrorMessage(error, 'Unable to load analytics right now.')

    Object.keys(charts).forEach(destroyChart)
    elements.app.classList.add('hidden')
    elements.fatal.classList.remove('hidden')
    elements.fatal.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined">${setupState ? setupState.icon : 'error'}</span>
        <h3>${app.escapeHtml(setupState ? setupState.title : 'Analytics unavailable')}</h3>
        <p class="empty-copy">${app.escapeHtml(setupState ? setupState.message : message)}</p>
        ${setupState ? `<p class="empty-copy">${app.escapeHtml(setupState.action)}</p>` : ''}
      </div>
    `
  }

  function destroyChart(name) {
    if (charts[name]) {
      charts[name].destroy()
      delete charts[name]
    }
  }

  function bindSignOutButtons() {
    elements.signoutButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true
        await app.signOut(client)
      })
    })
  }

  function setRange(range) {
    state.range = range
    elements.rangeButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.range === range)
    })
    render()
  }

  function getVisibleStats() {
    const visibleBets = app.filterBetsByRange(state.bets, state.range)
    return app.computeBetStats(visibleBets)
  }

  function createGradient(context, colorA, colorB) {
    const gradient = context.createLinearGradient(0, 0, 0, 240)
    gradient.addColorStop(0, colorA)
    gradient.addColorStop(1, colorB)
    return gradient
  }

  function getAxisOptions() {
    return {
      x: {
        ticks: { color: '#91a0c7' },
        grid: { display: false }
      },
      y: {
        ticks: {
          color: '#91a0c7',
          callback: (value) => `₹${app.formatCompact(value)}`
        },
        grid: { color: 'rgba(137, 160, 216, 0.12)' }
      }
    }
  }

  function renderHero(stats) {
    const displayName = app.getDisplayName(state.user)
    const rangeLabel = state.range === '7d' ? 'last 7 tracked days' : 'full ledger history'

    elements.heroNet.textContent = formatSigned(stats.netProfit, false)
    elements.heroNet.className = `hero-value ${stats.netProfit >= 0 ? 'value-positive' : 'value-negative'}`
    elements.heroRoi.textContent = `${stats.roi >= 0 ? '+' : ''}${stats.roi.toFixed(1)}% ROI`
    elements.heroRange.textContent = rangeLabel
    elements.heroSubtitle.textContent = `Analytics is reading ${stats.totalBets} ${stats.totalBets === 1 ? 'entry' : 'entries'} from ${rangeLabel}, comparing lagaya, banaya, cumulative edge, and result distribution.`
    elements.userBadge.textContent = getInitials(displayName)
    elements.userName.textContent = displayName
    elements.userEmail.textContent = state.user.email || 'No email on file'
    elements.lastSync.textContent = `Synced ${app.formatShortTime(new Date())}`
  }

  function renderKpis(stats) {
    const peakDay = stats.peakDay
    const worstDay = stats.worstDay

    elements.kpiPeakDay.textContent = peakDay ? app.formatDate(peakDay.date) : 'No peak day yet'
    elements.kpiPeakValue.textContent = peakDay ? formatSigned(peakDay.netProfit, false) : '—'
    elements.kpiPeakValue.className = `summary-value ${peakDay && peakDay.netProfit >= 0 ? 'value-positive' : ''}`
    elements.kpiWorstDay.textContent = worstDay ? app.formatDate(worstDay.date) : 'No worst day yet'
    elements.kpiWorstValue.textContent = worstDay ? formatSigned(worstDay.netProfit, false) : '—'
    elements.kpiWorstValue.className = `summary-value ${worstDay && worstDay.netProfit < 0 ? 'value-negative' : ''}`
    elements.kpiWinRate.textContent = `${stats.winRate.toFixed(1)}%`
    elements.kpiOpenExposure.textContent = `₹${app.formatAmount(stats.openExposure)}`
    elements.kpiTrackedDays.textContent = String(stats.trackedDays)
    elements.kpiSettled.textContent = String(stats.settled.length)
  }

  function ensureVolumeChart() {
    if (charts.volume) return charts.volume

    const ctx = elements.volumeCanvas.getContext('2d')
    charts.volume = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Lagaya',
            data: [],
            borderRadius: 14,
            borderSkipped: false
          },
          {
            label: 'Banaya',
            data: [],
            borderRadius: 14,
            borderSkipped: false
          }
        ]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        interaction: { intersect: false, mode: 'index' },
        plugins: {
          legend: {
            labels: {
              color: '#d3d8ef',
              boxWidth: 12,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          }
        },
        scales: getAxisOptions()
      }
    })

    return charts.volume
  }

  function renderVolumeChart(stats) {
    const daily = stats.daily
    const ctx = elements.volumeCanvas.getContext('2d')
    const investedGradient = createGradient(ctx, 'rgba(151, 169, 255, 0.9)', 'rgba(151, 169, 255, 0.12)')
    const returnedGradient = createGradient(ctx, 'rgba(153, 247, 255, 0.92)', 'rgba(153, 247, 255, 0.12)')
    const chart = ensureVolumeChart()

    chart.data.labels = daily.map((day) => app.formatDate(day.date).slice(0, 6))
    chart.data.datasets[0].data = daily.map((day) => day.lagaya)
    chart.data.datasets[0].backgroundColor = investedGradient
    chart.data.datasets[1].data = daily.map((day) => day.banaya)
    chart.data.datasets[1].backgroundColor = returnedGradient
    chart.update('none')
  }

  function ensureEquityChart() {
    if (charts.equity) return charts.equity

    const ctx = elements.equityCanvas.getContext('2d')
    charts.equity = new Chart(ctx, {
      type: 'line',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Equity',
            data: [],
            borderColor: '#c180ff',
            fill: true,
            tension: 0.26,
            pointRadius: 0,
            pointHoverRadius: 2,
            borderWidth: 2
          }
        ]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: getAxisOptions()
      }
    })

    return charts.equity
  }

  function renderEquityChart(stats) {
    const points = stats.equitySeries
    const ctx = elements.equityCanvas.getContext('2d')
    const gradient = createGradient(ctx, 'rgba(193, 128, 255, 0.24)', 'rgba(193, 128, 255, 0)')
    const chart = ensureEquityChart()

    chart.data.labels = points.map((point) => app.formatDate(point.date).slice(0, 6))
    chart.data.datasets[0].data = points.map((point) => point.value)
    chart.data.datasets[0].backgroundColor = gradient
    chart.update('none')
  }

  function ensureDistributionChart() {
    if (charts.distribution) return charts.distribution

    const ctx = elements.distributionCanvas.getContext('2d')
    charts.distribution = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Wins', 'Losses', 'Pending'],
        datasets: [
          {
            data: [0, 0, 0],
            backgroundColor: ['#7af1d6', '#ff7b95', '#ffcc73'],
            borderWidth: 0,
            hoverOffset: 4
          }
        ]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: { legend: { display: false } }
      }
    })

    return charts.distribution
  }

  function renderDistributionChart(stats) {
    const wins = stats.wins.length
    const losses = stats.losses.length
    const pending = stats.pending.length
    const chart = ensureDistributionChart()

    elements.distributionTotal.textContent = String(stats.totalBets)
    elements.legendWins.textContent = String(wins)
    elements.legendLosses.textContent = String(losses)
    elements.legendPending.textContent = String(pending)

    chart.data.datasets[0].data = [wins, losses, pending]
    chart.update('none')
  }

  function ensurePnlChart() {
    if (charts.pnl) return charts.pnl

    const ctx = elements.pnlCanvas.getContext('2d')
    charts.pnl = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: [],
        datasets: [
          {
            label: 'Daily P&L',
            data: [],
            borderRadius: 14,
            borderSkipped: false
          }
        ]
      },
      options: {
        animation: false,
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: getAxisOptions()
      }
    })

    return charts.pnl
  }

  function renderPnlChart(stats) {
    const daily = stats.daily
    const chart = ensurePnlChart()

    chart.data.labels = daily.map((day) => app.formatDate(day.date).slice(0, 6))
    chart.data.datasets[0].data = daily.map((day) => day.netProfit)
    chart.data.datasets[0].backgroundColor = daily.map((day) => day.netProfit >= 0 ? '#7af1d6' : '#ff7b95')
    chart.update('none')
  }

  function renderBreakdown(stats) {
    const rows = [...stats.daily].reverse()

    if (!rows.length) {
      elements.breakdownList.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-outlined">monitoring</span>
          <h3>No tracked days yet</h3>
          <p class="empty-copy">Daily breakdown rows appear after the first logged entry.</p>
        </div>
      `
      return
    }

    elements.breakdownList.innerHTML = rows.map((day) => `
      <article class="breakdown-row ${day.pendingCount ? 'pending' : day.netProfit >= 0 ? 'positive' : 'negative'}">
        <div class="breakdown-main">
          <div class="breakdown-date">
            <span class="meta-label">${app.formatDate(day.date)}</span>
            <strong>${day.totalBets} ${day.totalBets === 1 ? 'entry' : 'entries'}</strong>
          </div>
          <strong class="${day.netProfit >= 0 ? 'value-positive' : 'value-negative'}">${formatSigned(day.netProfit, false)}</strong>
        </div>
        <div class="breakdown-grid">
          <div class="breakdown-stat">
            <span class="meta-label">Lagaya</span>
            <strong>₹${app.formatAmount(day.lagaya)}</strong>
          </div>
          <div class="breakdown-stat">
            <span class="meta-label">Banaya</span>
            <strong>₹${app.formatAmount(day.banaya)}</strong>
          </div>
          <div class="breakdown-stat">
            <span class="meta-label">Settled</span>
            <strong>${day.settledCount}</strong>
          </div>
          <div class="breakdown-stat">
            <span class="meta-label">Pending</span>
            <strong>${day.pendingCount}</strong>
          </div>
        </div>
      </article>
    `).join('')
  }

  function renderCharts(stats) {
    chartRenderToken += 1
    const visibleStats = stats || getVisibleStats()
    renderVolumeChart(visibleStats)
    renderEquityChart(visibleStats)
    renderDistributionChart(visibleStats)
    renderPnlChart(visibleStats)
  }

  function scheduleChartRender(stats) {
    const token = ++chartRenderToken

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        if (token !== chartRenderToken) return
        renderCharts(stats)
      })
    })
  }

  function render(options) {
    const settings = options || {}
    const stats = getVisibleStats()

    renderHero(stats)
    renderKpis(stats)
    renderBreakdown(stats)

    if (settings.includeCharts === false) return
    if (settings.deferCharts) {
      scheduleChartRender(stats)
      return
    }

    renderCharts(stats)
  }

  if (!client) {
    showFatal(runtime.error)
    return
  }

  const session = await app.requireSession(client)
  if (!session) return

  state.user = session.user
  bindSignOutButtons()
  elements.app.classList.remove('hidden')
  render({ includeCharts: false })

  try {
    state.bets = await app.fetchBets(client, state.user.id)
    elements.fatal.classList.add('hidden')
    render({ deferCharts: true })
  } catch (error) {
    showFatal(error)
    return
  }

  elements.rangeButtons.forEach((button) => {
    button.addEventListener('click', () => setRange(button.dataset.range))
  })

})
