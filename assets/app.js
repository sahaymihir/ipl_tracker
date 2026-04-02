(function () {
  const AUTH_NOTICE_KEY = 'sattasheet:auth-notice'

  function isLocalHostname(hostname) {
    const normalized = String(hostname || '').trim().toLowerCase()

    return (
      normalized === 'localhost' ||
      normalized === '127.0.0.1' ||
      normalized === '0.0.0.0' ||
      normalized === '::1' ||
      normalized.endsWith('.local')
    )
  }

  function getPublicAppUrl(config) {
    const candidate = config && config.appUrl ? String(config.appUrl).trim() : ''

    if (!candidate) return ''

    try {
      const url = new URL(candidate)
      if (isLocalHostname(url.hostname)) return ''
      return url.toString().replace(/\/+$/, '')
    } catch (error) {
      return ''
    }
  }

  function getConfirmedAt(user) {
    if (!user) return ''
    return user.email_confirmed_at || user.confirmed_at || ''
  }

  function getErrorMessage(error, fallback) {
    if (typeof error === 'string' && error.trim()) return error.trim()
    if (error && typeof error.message === 'string' && error.message.trim()) return error.message.trim()
    return fallback || 'Unexpected error.'
  }

  function getSupabaseErrorMeta(error) {
    const message = getErrorMessage(error, '')
    const details = error && typeof error.details === 'string' ? error.details.trim() : ''
    const hint = error && typeof error.hint === 'string' ? error.hint.trim() : ''
    const code = error && error.code ? String(error.code).trim() : ''
    const normalized = [message, details, hint, code]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    const isMissingBetsTable =
      code === 'PGRST205' ||
      normalized.includes("could not find the table 'public.bets'") ||
      normalized.includes('public.bets') && normalized.includes('schema cache') ||
      normalized.includes('relation "public.bets" does not exist') ||
      normalized.includes('relation "bets" does not exist')

    return {
      code,
      message,
      details,
      hint,
      normalized,
      isMissingBetsTable
    }
  }

  function isMissingBetsTableError(error) {
    return getSupabaseErrorMeta(error).isMissingBetsTable
  }

  function getBetsSetupState(routeLabel) {
    const area = routeLabel || 'app'

    return {
      icon: 'database',
      title: 'Finish Supabase setup',
      message: `The ${area} expects a public.bets table, but Supabase could not find it in the schema cache.`,
      action: 'Run the SQL in supabase/setup.sql in the Supabase SQL editor, then refresh this page.'
    }
  }

  function getBetsSetupInlineMessage() {
    return 'Supabase could not find public.bets. Run the SQL in supabase/setup.sql, then retry.'
  }

  function isUserEmailConfirmed(user) {
    if (!user) return false
    if (!user.email) return true
    return Boolean(getConfirmedAt(user))
  }

  function pushAuthNotice(notice) {
    if (!notice || !notice.message) return

    try {
      window.sessionStorage.setItem(AUTH_NOTICE_KEY, JSON.stringify(notice))
    } catch (error) {
      // Ignore storage failures so auth can continue.
    }
  }

  function consumeAuthNotice() {
    try {
      const rawValue = window.sessionStorage.getItem(AUTH_NOTICE_KEY)
      if (!rawValue) return null
      window.sessionStorage.removeItem(AUTH_NOTICE_KEY)
      return JSON.parse(rawValue)
    } catch (error) {
      return null
    }
  }

  function createVerificationNotice(user, message) {
    return {
      tone: 'info',
      email: user && user.email ? user.email : '',
      showResend: true,
      message:
        message ||
        'Verify your email before continuing into the dashboard. You can resend the verification link below.'
    }
  }

  function getRuntimeConfig() {
    const config = window.__APP_CONFIG__ || {}

    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      return {
        error: 'Missing Supabase configuration. Set SUPABASE_URL and SUPABASE_ANON_KEY in Vercel, then redeploy or restart `vercel dev`.'
      }
    }

    return { config }
  }

  function createSupabaseClient() {
    const runtime = getRuntimeConfig()
    if (runtime.error) {
      return {
        client: null,
        config: runtime.config || null,
        error: runtime.error
      }
    }

    return {
      client: window.supabase.createClient(runtime.config.supabaseUrl, runtime.config.supabaseAnonKey),
      config: runtime.config,
      error: null
    }
  }

  function usesHtmlRoutes() {
    return /\.html$/i.test(window.location.pathname)
  }

  function pageHref(page, hash) {
    const path = usesHtmlRoutes()
      ? `${page}.html`
      : (page === 'index' ? '/' : `/${page}`)
    const safeHash = hash
      ? (hash.startsWith('#') ? hash : `#${hash}`)
      : ''
    return `${path}${safeHash}`
  }

  function getEmailRedirectUrl(config) {
    const baseUrl = getPublicAppUrl(config)

    if (!baseUrl) return ''

    try {
      return new URL('/dashboard', baseUrl).toString()
    } catch (error) {
      return ''
    }
  }

  async function redirectIfSessionExists(client, targetPage) {
    const { data: { session } } = await client.auth.getSession()

    if (session && !isUserEmailConfirmed(session.user)) {
      pushAuthNotice(createVerificationNotice(session.user))
      await client.auth.signOut()
      return null
    }

    if (session) {
      window.location.href = pageHref(targetPage || 'dashboard')
    }
    return session
  }

  async function requireSession(client) {
    const { data: { session } } = await client.auth.getSession()
    if (!session) {
      window.location.href = pageHref('index')
      return null
    }

    if (!isUserEmailConfirmed(session.user)) {
      pushAuthNotice(createVerificationNotice(session.user))
      await client.auth.signOut()
      window.location.href = pageHref('index')
      return null
    }

    return session
  }

  async function signOut(client) {
    try {
      if (client && client.auth) {
        const { error } = await client.auth.signOut({ scope: 'local' })
        if (error) {
          throw error
        }
      }
    } finally {
      try {
        window.sessionStorage.removeItem(AUTH_NOTICE_KEY)
      } catch (error) {
        // Ignore storage cleanup failures.
      }

      document.body.style.overflow = ''
      window.location.href = pageHref('index')
    }
  }

  async function fetchBets(client, userId) {
    const { data, error } = await client
      .from('bets')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true })

    if (error) {
      throw error
    }

    return data || []
  }

  function toNumber(value) {
    return Number(value || 0)
  }

  function formatAmount(value) {
    return Math.round(value || 0).toLocaleString('en-IN')
  }

  function formatCompact(value) {
    const absolute = Math.abs(value || 0)
    if (absolute >= 100000) return `${(absolute / 100000).toFixed(1)}L`
    if (absolute >= 1000) return `${(absolute / 1000).toFixed(1)}K`
    return formatAmount(absolute)
  }

  function formatDate(dateString) {
    return new Date(`${dateString}T00:00:00`).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    }).toUpperCase()
  }

  function formatShortTime(date) {
    return new Intl.DateTimeFormat('en-IN', {
      hour: 'numeric',
      minute: '2-digit'
    }).format(date)
  }

  function escapeHtml(value) {
    const div = document.createElement('div')
    div.textContent = value == null ? '' : String(value)
    return div.innerHTML
  }

  function getDisplayName(user) {
    const metadata = (user && (user.user_metadata || user.raw_user_meta_data)) || {}
    const candidates = [
      metadata.full_name,
      metadata.display_name,
      metadata.name,
      user && user.full_name,
      user && user.display_name,
      user && user.name
    ]

    for (const candidate of candidates) {
      if (candidate && String(candidate).trim()) {
        return String(candidate).trim()
      }
    }
    if (user && user.email) {
      return user.email.split('@')[0]
    }
    return 'Operator'
  }

  function getResult(bet) {
    if (bet.result) return bet.result
    if (bet.banaya == null) return 'pending'
    return toNumber(bet.banaya) > toNumber(bet.lagaya) ? 'win' : 'loss'
  }

  function sortByChronologicalOrder(left, right) {
    const dateDiff = new Date(left.date) - new Date(right.date)
    if (dateDiff !== 0) return dateDiff
    return new Date(left.created_at || 0) - new Date(right.created_at || 0)
  }

  function sortByReverseChronologicalOrder(left, right) {
    const dateDiff = new Date(right.date) - new Date(left.date)
    if (dateDiff !== 0) return dateDiff
    return new Date(right.created_at || 0) - new Date(left.created_at || 0)
  }

  function groupDailyBets(bets) {
    const map = {}

    bets.forEach((bet) => {
      const key = bet.date
      if (!map[key]) {
        map[key] = {
          date: bet.date,
          lagaya: 0,
          banaya: 0,
          netProfit: 0,
          totalBets: 0,
          pendingCount: 0,
          settledCount: 0,
          wins: 0,
          losses: 0
        }
      }

      const bucket = map[key]
      const result = getResult(bet)
      bucket.lagaya += toNumber(bet.lagaya)
      bucket.banaya += bet.banaya == null ? 0 : toNumber(bet.banaya)
      bucket.netProfit += toNumber(bet.net_profit)
      bucket.totalBets += 1

      if (result === 'pending') {
        bucket.pendingCount += 1
      } else {
        bucket.settledCount += 1
      }

      if (result === 'win') bucket.wins += 1
      if (result === 'loss') bucket.losses += 1
    })

    return Object.values(map).sort((left, right) => new Date(left.date) - new Date(right.date))
  }

  function filterBetsByRange(bets, range) {
    if (range !== '7d') return [...bets]

    const daily = groupDailyBets(bets)
    const lastSevenDates = daily.slice(-7).map((day) => day.date)
    const visibleDates = new Set(lastSevenDates)
    return bets.filter((bet) => visibleDates.has(bet.date))
  }

  function computeBetStats(bets) {
    const sortedAsc = [...bets].sort(sortByChronologicalOrder)
    const sortedDesc = [...bets].sort(sortByReverseChronologicalOrder)
    const settled = sortedAsc.filter((bet) => getResult(bet) !== 'pending')
    const pending = sortedAsc.filter((bet) => getResult(bet) === 'pending')
    const wins = settled.filter((bet) => getResult(bet) === 'win')
    const losses = settled.filter((bet) => getResult(bet) === 'loss')
    const invested = sortedAsc.reduce((sum, bet) => sum + toNumber(bet.lagaya), 0)
    const returned = sortedAsc.reduce((sum, bet) => sum + (bet.banaya == null ? 0 : toNumber(bet.banaya)), 0)
    const netProfit = sortedAsc.reduce((sum, bet) => sum + toNumber(bet.net_profit), 0)
    const roi = invested > 0 ? (netProfit / invested) * 100 : 0
    const winRate = settled.length > 0 ? (wins.length / settled.length) * 100 : 0
    const trackedDays = new Set(sortedAsc.map((bet) => bet.date)).size
    const averageStake = sortedAsc.length > 0 ? invested / sortedAsc.length : 0
    const openExposure = pending.reduce((sum, bet) => sum + toNumber(bet.lagaya), 0)
    const daily = groupDailyBets(sortedAsc)

    const settledDesc = [...settled].sort(sortByReverseChronologicalOrder)
    let streak = 0
    let streakType = ''
    if (settledDesc.length > 0) {
      streakType = getResult(settledDesc[0])
      settledDesc.forEach((bet) => {
        if (getResult(bet) === streakType) streak += 1
      })
      for (let index = 0; index < settledDesc.length; index += 1) {
        if (getResult(settledDesc[index]) !== streakType) {
          streak = index
          break
        }
      }
      if (streak === 0) streak = settledDesc.length
    }

    let cumulative = 0
    const equitySeries = sortedAsc.map((bet) => {
      cumulative += toNumber(bet.net_profit)
      return {
        date: bet.date,
        value: cumulative
      }
    })

    const peakDay = daily.length
      ? [...daily].sort((left, right) => right.netProfit - left.netProfit)[0]
      : null
    const worstDay = daily.length
      ? [...daily].sort((left, right) => left.netProfit - right.netProfit)[0]
      : null

    return {
      bets: sortedAsc,
      recentBets: sortedDesc,
      settled,
      pending,
      wins,
      losses,
      invested,
      returned,
      netProfit,
      roi,
      winRate,
      trackedDays,
      averageStake,
      openExposure,
      totalBets: sortedAsc.length,
      daily,
      streak,
      streakType,
      equitySeries,
      peakDay,
      worstDay
    }
  }

  window.SattaSheetApp = {
    AUTH_NOTICE_KEY,
    createSupabaseClient,
    getRuntimeConfig,
    getEmailRedirectUrl,
    getPublicAppUrl,
    isUserEmailConfirmed,
    getErrorMessage,
    getSupabaseErrorMeta,
    isMissingBetsTableError,
    getBetsSetupState,
    getBetsSetupInlineMessage,
    pushAuthNotice,
    consumeAuthNotice,
    redirectIfSessionExists,
    requireSession,
    signOut,
    fetchBets,
    computeBetStats,
    filterBetsByRange,
    groupDailyBets,
    formatAmount,
    formatCompact,
    formatDate,
    formatShortTime,
    escapeHtml,
    getDisplayName,
    getResult,
    pageHref
  }
})()
