document.addEventListener('DOMContentLoaded', async () => {
  const app = window.SattaSheetApp
  const runtime = app.createSupabaseClient()
  const client = runtime.client
  const RECENT_BETS_STEP = 5

  const state = {
    user: null,
    bets: [],
    stats: null,
    filter: 'all',
    editingBetId: null,
    visibleRecentCount: RECENT_BETS_STEP
  }

  const elements = {
    fatal: document.getElementById('fatal-state'),
    app: document.getElementById('dashboard-app'),
    status: document.getElementById('dashboard-status'),
    heroNet: document.getElementById('hero-net'),
    heroNetTone: document.getElementById('hero-net-tone'),
    heroRoi: document.getElementById('hero-roi'),
    heroExposure: document.getElementById('hero-exposure'),
    heroTracked: document.getElementById('hero-tracked'),
    heroCopy: document.getElementById('hero-copy'),
    heroSpark: document.getElementById('hero-spark'),
    welcomeName: document.getElementById('welcome-name'),
    metricInvested: document.getElementById('metric-invested'),
    metricReturned: document.getElementById('metric-returned'),
    metricWinRate: document.getElementById('metric-win-rate'),
    metricAverage: document.getElementById('metric-average'),
    barInvested: document.getElementById('bar-invested'),
    barReturned: document.getElementById('bar-returned'),
    barWinRate: document.getElementById('bar-win-rate'),
    barAverage: document.getElementById('bar-average'),
    activityList: document.getElementById('activity-list'),
    activityCount: document.getElementById('activity-count'),
    activityMoreWrap: document.getElementById('activity-more-wrap'),
    activityShowMore: document.getElementById('activity-show-more'),
    liveList: document.getElementById('live-list'),
    liveCount: document.getElementById('live-count'),
    drawer: document.getElementById('entry-drawer'),
    drawerScrim: document.getElementById('entry-drawer-scrim'),
    drawerKicker: document.getElementById('drawer-kicker'),
    drawerTitle: document.getElementById('drawer-title'),
    drawerCopy: document.getElementById('drawer-copy'),
    openDrawerButtons: document.querySelectorAll('[data-open-drawer]'),
    closeDrawer: document.getElementById('entry-drawer-close'),
    cancelDrawer: document.getElementById('bet-cancel'),
    logoutButtons: document.querySelectorAll('[data-signout]'),
    form: document.getElementById('bet-form'),
    formError: document.getElementById('bet-form-error'),
    formDate: document.getElementById('bet-date'),
    formMatch: document.getElementById('bet-match'),
    formLagaya: document.getElementById('bet-lagaya'),
    formBanaya: document.getElementById('bet-banaya'),
    projectedNet: document.getElementById('projected-net'),
    submit: document.getElementById('bet-submit'),
    filterButtons: document.querySelectorAll('[data-filter]'),
    navLinks: document.querySelectorAll('[data-nav-link]'),
    lastUpdated: document.getElementById('last-updated')
  }

  function formatSigned(value, compact) {
    const absolute = compact ? app.formatCompact(Math.abs(value || 0)) : app.formatAmount(Math.abs(value || 0))
    return `${value >= 0 ? '+' : '-'}₹${absolute}`
  }

  function fallbackLabel(bet, index) {
    if (bet.match_label && String(bet.match_label).trim()) {
      return String(bet.match_label).trim()
    }

    const result = app.getResult(bet)
    if (result === 'pending') return `Open market entry #${index + 1}`
    if (result === 'win') return `Settled profit #${index + 1}`
    return `Settled ledger #${index + 1}`
  }

  function getDeleteLabel(bet) {
    if (bet.match_label && String(bet.match_label).trim()) {
      return String(bet.match_label).trim()
    }

    return `${app.formatDate(bet.date)} · ₹${app.formatAmount(bet.lagaya)} stake`
  }

  function showFatal(error) {
    const setupState = app.isMissingBetsTableError(error)
      ? app.getBetsSetupState('dashboard')
      : null
    const message = app.getErrorMessage(error, 'Unable to load the dashboard right now.')

    elements.app.classList.add('hidden')
    elements.fatal.classList.remove('hidden')
    elements.fatal.innerHTML = `
      <div class="empty-state">
        <span class="material-symbols-outlined">${setupState ? setupState.icon : 'error'}</span>
        <h3>${app.escapeHtml(setupState ? setupState.title : 'Dashboard unavailable')}</h3>
        <p class="empty-copy">${app.escapeHtml(setupState ? setupState.message : message)}</p>
        ${setupState ? `<p class="empty-copy">${app.escapeHtml(setupState.action)}</p>` : ''}
      </div>
    `
  }

  function showStatus(message, tone) {
    if (!message) {
      elements.status.hidden = true
      elements.status.textContent = ''
      return
    }

    elements.status.hidden = false
    elements.status.classList.remove('hidden')
    elements.status.dataset.tone = tone || 'info'
    elements.status.textContent = message
  }

  function bindSignOutButtons() {
    elements.logoutButtons.forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true
        await app.signOut(client)
      })
    })
  }

  function setActiveFilter(filter) {
    state.filter = filter
    state.visibleRecentCount = RECENT_BETS_STEP
    elements.filterButtons.forEach((button) => {
      button.classList.toggle('is-active', button.dataset.filter === filter)
    })
    renderActivity()
  }

  function revealMoreActivity() {
    state.visibleRecentCount += RECENT_BETS_STEP
    renderActivity()
  }

  function syncHashNavigation() {
    const current = (window.location.hash || '#ledger').replace('#', '') || 'ledger'
    const activeSection = current === 'live' ? 'live' : 'ledger'

    elements.navLinks.forEach((link) => {
      const target = link.dataset.navLink
      link.classList.toggle('is-active', target === activeSection)
    })

    if (current === 'new-entry') {
      openDrawer()
    }
  }

  function setDrawerMode(mode, bet) {
    const isEditing = mode === 'edit' && bet

    state.editingBetId = isEditing ? bet.id : null
    elements.drawerKicker.textContent = isEditing ? 'Edit Pending Bet' : 'Log Entry'
    elements.drawerTitle.textContent = isEditing ? 'Update pending transaction' : 'New bet transaction'
    elements.drawerCopy.textContent = isEditing
      ? 'Adjust the pending bet or add the final banaya value to settle it.'
      : 'Insert directly into the `bets` table and let Supabase compute the generated result fields.'
    elements.submit.textContent = isEditing ? 'Save changes' : 'Log entry'
  }

  function findBetById(betId) {
    return state.bets.find((bet) => String(bet.id) === String(betId)) || null
  }

  function resetDrawerForm() {
    elements.form.reset()
    elements.formDate.value = new Date().toISOString().split('T')[0]
    elements.projectedNet.textContent = 'Pending'
    elements.projectedNet.className = 'detail-value value-pending'
    elements.formError.hidden = true
    elements.submit.disabled = false
    setDrawerMode('create')
  }

  function fillDrawerForm(bet) {
    elements.formDate.value = bet.date || new Date().toISOString().split('T')[0]
    elements.formMatch.value = bet.match_label || ''
    elements.formLagaya.value = bet.lagaya == null ? '' : String(bet.lagaya)
    elements.formBanaya.value = bet.banaya == null ? '' : String(bet.banaya)
    updateProjectedNet()
    elements.formError.hidden = true
    elements.submit.disabled = false
  }

  function openDrawer(options) {
    const settings = options || {}
    const bet = settings.bet || null

    if (bet) {
      setDrawerMode('edit', bet)
      fillDrawerForm(bet)
    } else {
      resetDrawerForm()
    }

    elements.drawer.classList.add('is-open')
    elements.drawer.setAttribute('aria-hidden', 'false')
    document.body.style.overflow = 'hidden'
  }

  function openEditDrawer(betId) {
    const bet = findBetById(betId)

    if (!bet) {
      showStatus('That bet could not be found anymore. Refresh and try again.', 'error')
      return
    }

    if (app.getResult(bet) !== 'pending') {
      showStatus('Only pending bets can be edited from this view.', 'info')
      return
    }

    openDrawer({ bet })
  }

  async function handleDeleteBet(betId, triggerButton) {
    const bet = findBetById(betId)

    if (!bet) {
      showStatus('That bet could not be found anymore. Refresh and try again.', 'error')
      return
    }

    const label = getDeleteLabel(bet)
    const firstConfirmation = window.confirm(
      `Delete the bet "${label}" from ${app.formatDate(bet.date)}? This will remove it from your ledger history.`
    )

    if (!firstConfirmation) return

    const secondConfirmation = window.confirm(
      `Final confirmation: permanently delete "${label}"? This action cannot be undone.`
    )

    if (!secondConfirmation) return

    if (triggerButton) {
      triggerButton.disabled = true
    }

    const { error } = await client
      .from('bets')
      .delete()
      .eq('id', bet.id)
      .eq('user_id', state.user.id)

    if (triggerButton) {
      triggerButton.disabled = false
    }

    if (error) {
      showStatus(app.getErrorMessage(error, 'Unable to delete the bet right now.'), 'error')
      return
    }

    if (state.editingBetId && String(state.editingBetId) === String(bet.id)) {
      closeDrawer()
    }

    showStatus('Bet deleted successfully.', 'success')
    await refresh()
  }

  function closeDrawer() {
    elements.drawer.classList.remove('is-open')
    elements.drawer.setAttribute('aria-hidden', 'true')
    document.body.style.overflow = ''
    resetDrawerForm()

    if ((window.location.hash || '') === '#new-entry') {
      history.replaceState({}, '', app.pageHref('dashboard'))
      syncHashNavigation()
    }
  }

  function updateProjectedNet() {
    const lagaya = parseFloat(elements.formLagaya.value) || 0
    const banayaValue = elements.formBanaya.value

    if (banayaValue === '') {
      elements.projectedNet.textContent = 'Pending'
      elements.projectedNet.className = 'detail-value value-pending'
      return
    }

    const banaya = parseFloat(banayaValue) || 0
    const net = banaya - lagaya
    elements.projectedNet.textContent = formatSigned(net, false)
    elements.projectedNet.className = `detail-value ${net >= 0 ? 'value-positive' : 'value-negative'}`
  }

  function renderHeroSpark() {
    const points = state.stats.equitySeries

    if (!points.length) {
      elements.heroSpark.innerHTML = `
        <div class="spark-caption">
          <span>No performance curve yet</span>
          <span>Log your first entry</span>
        </div>
      `
      return
    }

    const values = points.map((item) => item.value)
    const min = Math.min(...values, 0)
    const max = Math.max(...values, 0)
    const range = Math.max(max - min, 1)
    const width = 520
    const height = 260
    const path = points.map((item, index) => {
      const x = points.length === 1 ? width / 2 : (index / (points.length - 1)) * width
      const y = height - (((item.value - min) / range) * (height - 28) + 14)
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`
    }).join(' ')
    const fillPath = `${path} L ${width} ${height} L 0 ${height} Z`
    const startDate = app.formatDate(points[0].date)
    const endDate = app.formatDate(points[points.length - 1].date)

    elements.heroSpark.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="spark-fill" x1="0%" x2="0%" y1="0%" y2="100%">
            <stop offset="0%" stop-color="rgba(151,169,255,0.42)"></stop>
            <stop offset="100%" stop-color="rgba(151,169,255,0)"></stop>
          </linearGradient>
          <linearGradient id="spark-line" x1="0%" x2="100%" y1="0%" y2="0%">
            <stop offset="0%" stop-color="#99f7ff"></stop>
            <stop offset="100%" stop-color="#97a9ff"></stop>
          </linearGradient>
        </defs>
        <path d="${fillPath}" fill="url(#spark-fill)"></path>
        <path d="${path}" fill="none" stroke="url(#spark-line)" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></path>
      </svg>
      <div class="spark-caption">
        <span>${startDate}</span>
        <span>${endDate}</span>
      </div>
    `
  }

  function renderHero() {
    const { netProfit, roi, openExposure, trackedDays, totalBets } = state.stats
    const displayName = app.getDisplayName(state.user)
    const greeting = totalBets > 0
      ? `Tracking ${totalBets} entries across ${trackedDays} ${trackedDays === 1 ? 'day' : 'days'} with live sync to Supabase.`
      : 'You are ready to start logging live entries.'

    elements.welcomeName.textContent = displayName
    elements.heroNet.textContent = formatSigned(netProfit, false)
    elements.heroNet.className = `hero-value ${netProfit >= 0 ? 'value-positive' : 'value-negative'}`
    elements.heroNetTone.textContent = `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}% ROI`
    elements.heroNetTone.className = `chip ${netProfit >= 0 ? '-positive' : '-negative'}`
    elements.heroRoi.textContent = `${roi >= 0 ? '+' : ''}${roi.toFixed(1)}%`
    elements.heroExposure.textContent = `₹${app.formatAmount(openExposure)}`
    elements.heroTracked.textContent = `${trackedDays} ${trackedDays === 1 ? 'day' : 'days'}`
    elements.heroCopy.textContent = greeting
    elements.lastUpdated.textContent = `Synced ${app.formatShortTime(new Date())}`
    renderHeroSpark()
  }

  function renderMetrics() {
    const { invested, returned, winRate, averageStake } = state.stats
    elements.metricInvested.textContent = `₹${app.formatAmount(invested)}`
    elements.metricReturned.textContent = `₹${app.formatAmount(returned)}`
    elements.metricWinRate.textContent = `${winRate.toFixed(1)}%`
    elements.metricAverage.textContent = `₹${app.formatAmount(averageStake)}`

    const maxMoney = Math.max(invested, returned, averageStake, 1)
    elements.barInvested.style.width = `${Math.max((invested / maxMoney) * 100, 8)}%`
    elements.barReturned.style.width = `${Math.max((returned / maxMoney) * 100, 8)}%`
    elements.barWinRate.style.width = `${Math.max(winRate, 8)}%`
    elements.barAverage.style.width = `${Math.max((averageStake / maxMoney) * 100, 8)}%`
  }

  function renderActivity() {
    const filtered = state.stats.recentBets.filter((bet) => {
      if (state.filter === 'all') return true
      return app.getResult(bet) === state.filter
    })
    const visible = filtered.slice(0, state.visibleRecentCount)
    const remaining = Math.max(filtered.length - visible.length, 0)

    elements.activityCount.textContent = `${filtered.length} ${filtered.length === 1 ? 'entry' : 'entries'}`

    if (!filtered.length) {
      elements.activityList.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-outlined">search_off</span>
          <h3>No entries in this filter</h3>
          <p class="empty-copy">Switch filters or log a new position to populate the ledger.</p>
        </div>
      `
      elements.activityMoreWrap.hidden = true
      return
    }

    elements.activityList.innerHTML = visible.map((bet, index) => {
      const result = app.getResult(bet)
      const net = Number(bet.net_profit || 0)
      const label = app.escapeHtml(fallbackLabel(bet, index))
      const returnValue = bet.banaya == null ? 'Awaiting' : `₹${app.formatAmount(bet.banaya)}`
      const netValue = result === 'pending' ? 'Pending' : formatSigned(net, false)
      const actions = `
        <div class="ledger-row-actions">
          ${result === 'pending'
            ? `<button class="text-button entry-inline-button" data-edit-bet="${bet.id}" type="button">Edit</button>`
            : ''}
          <button class="text-button entry-inline-button is-danger" data-delete-bet="${bet.id}" type="button">Delete</button>
        </div>
      `

      return `
        <article class="ledger-row ${result}">
          <div class="ledger-row-top">
            <div class="ledger-row-date">${app.formatDate(bet.date)}</div>
            <span class="result-pill ${result}">${result}</span>
          </div>
          <div class="ledger-row-title" title="${label}">${label}</div>
          <div class="ledger-row-stats">
            <div class="ledger-row-stat">
              <span class="ledger-row-label">Lagaya</span>
              <strong class="ledger-row-value">₹${app.formatAmount(bet.lagaya)}</strong>
            </div>
            <div class="ledger-row-stat">
              <span class="ledger-row-label">Banaya</span>
              <strong class="ledger-row-value ${result === 'pending' ? 'value-pending' : ''}">${returnValue}</strong>
            </div>
            <div class="ledger-row-stat">
              <span class="ledger-row-label">Net</span>
              <strong class="ledger-row-value ${result === 'pending' ? 'value-pending' : net >= 0 ? 'value-positive' : 'value-negative'}">${netValue}</strong>
            </div>
          </div>
          ${actions}
        </article>
      `
    }).join('')

    if (remaining > 0) {
      elements.activityShowMore.textContent = `Show ${Math.min(RECENT_BETS_STEP, remaining)} more bets`
      elements.activityMoreWrap.hidden = false
      return
    }

    elements.activityMoreWrap.hidden = true
  }

  function renderLive() {
    const pending = state.stats.pending.slice().sort((left, right) => new Date(right.date) - new Date(left.date))
    elements.liveCount.textContent = `${pending.length} ${pending.length === 1 ? 'live position' : 'live positions'}`

    if (!pending.length) {
      elements.liveList.innerHTML = `
        <div class="empty-state">
          <span class="material-symbols-outlined">bolt</span>
          <h3>No live exposure</h3>
          <p class="empty-copy">Every open entry appears here until the return value is filled in.</p>
        </div>
      `
      return
    }

    elements.liveList.innerHTML = pending.map((bet, index) => `
      <article class="feed-card pending">
        <div class="feed-head">
          <div>
            <div class="eyebrow">${app.formatDate(bet.date)}</div>
            <h3 class="feed-title">${app.escapeHtml(fallbackLabel(bet, index))}</h3>
            <p class="feed-caption">This entry is still waiting on a final return.</p>
          </div>
          <div class="feed-head-actions">
            <button class="text-button entry-inline-button" data-edit-bet="${bet.id}" type="button">Edit</button>
            <button class="text-button entry-inline-button is-danger" data-delete-bet="${bet.id}" type="button">Delete</button>
            <span class="result-pill pending">Pending</span>
          </div>
        </div>
        <div class="detail-grid">
          <div class="detail-card">
            <span class="meta-label">Stake</span>
            <strong class="detail-value">₹${app.formatAmount(bet.lagaya)}</strong>
          </div>
          <div class="detail-card">
            <span class="meta-label">Exposure</span>
            <strong class="detail-value value-pending">₹${app.formatAmount(bet.lagaya)}</strong>
          </div>
          <div class="detail-card">
            <span class="meta-label">State</span>
            <strong class="detail-value value-pending">Awaiting result</strong>
          </div>
        </div>
      </article>
    `).join('')
  }

  function renderAll() {
    state.stats = app.computeBetStats(state.bets)
    renderHero()
    renderMetrics()
    renderActivity()
    renderLive()
  }

  async function refresh() {
    state.bets = await app.fetchBets(client, state.user.id)
    renderAll()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    const wasEditing = Boolean(state.editingBetId)

    const lagaya = parseFloat(elements.formLagaya.value)
    const banayaValue = elements.formBanaya.value
    const banaya = banayaValue === '' ? null : parseFloat(banayaValue)
    const date = elements.formDate.value
    const matchLabel = elements.formMatch.value.trim() || null

    if (!lagaya || lagaya <= 0) {
      elements.formError.hidden = false
      elements.formError.textContent = 'Lagaya must be greater than zero.'
      return
    }

    if (!date) {
      elements.formError.hidden = false
      elements.formError.textContent = 'Choose the ledger date for this entry.'
      return
    }

    elements.formError.hidden = true
    elements.submit.disabled = true
    elements.submit.textContent = wasEditing ? 'Saving...' : 'Logging...'

    const payload = {
      date,
      lagaya,
      banaya,
      match_label: matchLabel
    }

    const { error } = state.editingBetId
      ? await client
        .from('bets')
        .update(payload)
        .eq('id', state.editingBetId)
        .eq('user_id', state.user.id)
      : await client
        .from('bets')
        .insert({
          user_id: state.user.id,
          ...payload
        })

    elements.submit.disabled = false
    elements.submit.textContent = wasEditing ? 'Save changes' : 'Log entry'

    if (error) {
      elements.formError.hidden = false
      elements.formError.textContent = app.isMissingBetsTableError(error)
        ? app.getBetsSetupInlineMessage()
        : app.getErrorMessage(error, 'Unable to save the bet right now.')
      return
    }

    closeDrawer()
    showStatus(wasEditing ? 'Bet updated successfully.' : 'Entry logged successfully.', 'success')
    await refresh()
  }

  if (!client) {
    showFatal(runtime.error)
    return
  }

  const session = await app.requireSession(client)
  if (!session) return

  state.user = session.user
  elements.formDate.value = new Date().toISOString().split('T')[0]
  bindSignOutButtons()

  try {
    await refresh()
    elements.fatal.classList.add('hidden')
    elements.app.classList.remove('hidden')
    syncHashNavigation()
  } catch (error) {
    showFatal(error)
    return
  }

  window.addEventListener('hashchange', syncHashNavigation)
  elements.openDrawerButtons.forEach((button) => button.addEventListener('click', openDrawer))
  elements.closeDrawer.addEventListener('click', closeDrawer)
  elements.cancelDrawer.addEventListener('click', closeDrawer)
  elements.drawerScrim.addEventListener('click', closeDrawer)
  elements.activityList.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete-bet]')
    if (deleteButton) {
      void handleDeleteBet(deleteButton.dataset.deleteBet, deleteButton)
      return
    }

    const editButton = event.target.closest('[data-edit-bet]')
    if (!editButton) return
    openEditDrawer(editButton.dataset.editBet)
  })
  elements.liveList.addEventListener('click', (event) => {
    const deleteButton = event.target.closest('[data-delete-bet]')
    if (deleteButton) {
      void handleDeleteBet(deleteButton.dataset.deleteBet, deleteButton)
      return
    }

    const editButton = event.target.closest('[data-edit-bet]')
    if (!editButton) return
    openEditDrawer(editButton.dataset.editBet)
  })
  elements.activityShowMore.addEventListener('click', revealMoreActivity)
  elements.formLagaya.addEventListener('input', updateProjectedNet)
  elements.formBanaya.addEventListener('input', updateProjectedNet)
  elements.form.addEventListener('submit', handleSubmit)
  elements.filterButtons.forEach((button) => {
    button.addEventListener('click', () => setActiveFilter(button.dataset.filter))
  })

  setActiveFilter('all')
})
