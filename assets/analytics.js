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

  function showFatal(message) {
    elements.fatal.classList.remove('hidden')
    elements.fatal.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined">error</span>
        <h3>Analytics unavailable</h3>
        <p class="empty-copy">${app.escapeHtml(message)}</p>
      </div>
    `
  }

  function destroyChart(name) {
    if (charts[name]) {
      charts[name].destroy()
      delete charts[name]
    }
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

  function renderVolumeChart(stats) {
    destroyChart('volume')

    const daily = stats.daily
    const labels = daily.map((day) => app.formatDate(day.date).slice(0, 6))
    const ctx = elements.volumeCanvas.getContext('2d')
    const investedGradient = createGradient(ctx, 'rgba(151, 169, 255, 0.9)', 'rgba(151, 169, 255, 0.12)')
    const returnedGradient = createGradient(ctx, 'rgba(153, 247, 255, 0.92)', 'rgba(153, 247, 255, 0.12)')

    charts.volume = new Chart(ctx, {
      type: 'bar',
      data: {
        labels,
        datasets: [
          {
            label: 'Lagaya',
            data: daily.map((day) => day.lagaya),
            borderRadius: 14,
            borderSkipped: false,
            backgroundColor: investedGradient
          },
          {
            label: 'Banaya',
            data: daily.map((day) => day.banaya),
            borderRadius: 14,
            borderSkipped: false,
            backgroundColor: returnedGradient
          }
        ]
      },
      options: {
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
        scales: {
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
    })
  }

  function renderEquityChart(stats) {
    destroyChart('equity')

    const points = stats.equitySeries
    const ctx = elements.equityCanvas.getContext('2d')
    const gradient = createGradient(ctx, 'rgba(193, 128, 255, 0.28)', 'rgba(193, 128, 255, 0)')

    charts.equity = new Chart(ctx, {
      type: 'line',
      data: {
        labels: points.map((point) => app.formatDate(point.date).slice(0, 6)),
        datasets: [
          {
            label: 'Equity',
            data: points.map((point) => point.value),
            borderColor: '#c180ff',
            backgroundColor: gradient,
            fill: true,
            tension: 0.34,
            pointRadius: 0,
            pointHoverRadius: 4,
            borderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
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
    })
  }

  function renderDistributionChart(stats) {
    destroyChart('distribution')

    const wins = stats.wins.length
    const losses = stats.losses.length
    const pending = stats.pending.length
    const ctx = elements.distributionCanvas.getContext('2d')

    elements.distributionTotal.textContent = String(stats.totalBets)
    elements.legendWins.textContent = String(wins)
    elements.legendLosses.textContent = String(losses)
    elements.legendPending.textContent = String(pending)

    charts.distribution = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['Wins', 'Losses', 'Pending'],
        datasets: [
          {
            data: [wins, losses, pending],
            backgroundColor: ['#7af1d6', '#ff7b95', '#ffcc73'],
            borderWidth: 0,
            hoverOffset: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '72%',
        plugins: { legend: { display: false } }
      }
    })
  }

  function renderPnlChart(stats) {
    destroyChart('pnl')

    const daily = stats.daily
    const ctx = elements.pnlCanvas.getContext('2d')

    charts.pnl = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: daily.map((day) => app.formatDate(day.date).slice(0, 6)),
        datasets: [
          {
            label: 'Daily P&L',
            data: daily.map((day) => day.netProfit),
            borderRadius: 14,
            borderSkipped: false,
            backgroundColor: daily.map((day) => day.netProfit >= 0 ? '#7af1d6' : '#ff7b95')
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
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
    })
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

  function render() {
    const stats = getVisibleStats()
    renderHero(stats)
    renderKpis(stats)
    renderVolumeChart(stats)
    renderEquityChart(stats)
    renderDistributionChart(stats)
    renderPnlChart(stats)
    renderBreakdown(stats)
  }

  if (!client) {
    showFatal(runtime.error)
    return
  }

  const session = await app.requireSession(client)
  if (!session) return

  state.user = session.user
  elements.app.classList.remove('hidden')

  try {
    await app.seedBetsIfNeeded(client, state.user.id)
    state.bets = await app.fetchBets(client, state.user.id)
    render()
  } catch (error) {
    showFatal(error.message || 'Unable to load analytics right now.')
    return
  }

  elements.rangeButtons.forEach((button) => {
    button.addEventListener('click', () => setRange(button.dataset.range))
  })

  elements.signoutButtons.forEach((button) => {
    button.addEventListener('click', async () => {
      await app.signOut(client)
    })
  })
})
