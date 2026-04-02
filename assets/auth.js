document.addEventListener('DOMContentLoaded', async () => {
  const app = window.SattaSheetApp
  const runtime = app.createSupabaseClient()
  const client = runtime.client
  const config = runtime.config || {}

  const state = {
    mode: 'login',
    pendingVerificationEmail: '',
    submitting: false
  }

  const elements = {
    status: document.getElementById('auth-status'),
    form: document.getElementById('auth-form'),
    formTitle: document.getElementById('auth-form-title'),
    formCopy: document.getElementById('auth-form-copy'),
    submit: document.getElementById('auth-submit'),
    submitLabel: document.getElementById('auth-submit-label'),
    resend: document.getElementById('resend-verification'),
    modeLogin: document.getElementById('mode-login'),
    modeSignup: document.getElementById('mode-signup'),
    switchLabel: document.getElementById('auth-switch-label'),
    switchButton: document.getElementById('auth-switch-button'),
    email: document.getElementById('email'),
    password: document.getElementById('password'),
    fullNameGroup: document.getElementById('full-name-group'),
    fullName: document.getElementById('full-name'),
    confirmGroup: document.getElementById('confirm-password-group'),
    confirmPassword: document.getElementById('confirm-password'),
    termsGroup: document.getElementById('terms-group'),
    terms: document.getElementById('terms'),
    previewEyebrow: document.getElementById('preview-eyebrow'),
    previewTitle: document.getElementById('preview-title'),
    previewCopy: document.getElementById('preview-copy'),
    previewPrimaryLabel: document.getElementById('preview-primary-label'),
    previewPrimaryValue: document.getElementById('preview-primary-value'),
    previewSecondaryLabel: document.getElementById('preview-secondary-label'),
    previewSecondaryValue: document.getElementById('preview-secondary-value'),
    previewTickerA: document.getElementById('preview-ticker-a'),
    previewTickerB: document.getElementById('preview-ticker-b'),
    previewTickerC: document.getElementById('preview-ticker-c')
  }

  const previewModes = {
    login: {
      eyebrow: 'Velocity Betting Engine',
      title: 'Re-enter the SattaSheet command layer.',
      copy: 'Live ledger, active exposure, and performance analytics stay one tap away once your Supabase session clears.',
      primaryLabel: 'Live Profit',
      primaryValue: '+₹84.6K',
      secondaryLabel: 'Verification',
      secondaryValue: 'Synced',
      tickerA: 'Realtime ledger online',
      tickerB: 'Analytics route armed',
      tickerC: 'Operator identity secure',
      formTitle: 'Sign in',
      formCopy: 'Use your Supabase identity to unlock the live dashboard, analytics, and account controls.',
      submit: 'Initialize access',
      switchLabel: 'New to the terminal?',
      switchAction: 'Create account'
    },
    signup: {
      eyebrow: 'Elite Operator Onboarding',
      title: 'Create a SattaSheet account built for real tracking.',
      copy: 'Full-name signup, email verification, and production-safe redirects are wired into the same live frontend flow.',
      primaryLabel: 'Operator Setup',
      primaryValue: 'Live',
      secondaryLabel: 'Verification',
      secondaryValue: 'Enabled',
      tickerA: 'Full-name metadata stored',
      tickerB: 'Redirects point to production',
      tickerC: 'Resend flow ready if needed',
      formTitle: 'Create account',
      formCopy: 'Set up a real Supabase account. We will store your full name in auth metadata and route verification to your deployed app.',
      submit: 'Create account',
      switchLabel: 'Already have an account?',
      switchAction: 'Sign in'
    }
  }

  function setStatus(message, tone) {
    if (!message) {
      elements.status.hidden = true
      elements.status.textContent = ''
      elements.status.dataset.tone = 'info'
      return
    }

    elements.status.hidden = false
    elements.status.dataset.tone = tone || 'info'
    elements.status.textContent = message
  }

  function setSubmitting(isSubmitting, label) {
    state.submitting = isSubmitting
    elements.submit.disabled = isSubmitting || !client
    elements.submitLabel.textContent = label
  }

  function setMode(mode) {
    state.mode = mode
    const copy = previewModes[mode]
    const isSignup = mode === 'signup'

    elements.modeLogin.classList.toggle('is-active', !isSignup)
    elements.modeSignup.classList.toggle('is-active', isSignup)
    elements.fullNameGroup.classList.toggle('hidden', !isSignup)
    elements.confirmGroup.classList.toggle('hidden', !isSignup)
    elements.termsGroup.classList.toggle('hidden', !isSignup)
    elements.previewEyebrow.textContent = copy.eyebrow
    elements.previewTitle.textContent = copy.title
    elements.previewCopy.textContent = copy.copy
    elements.previewPrimaryLabel.textContent = copy.primaryLabel
    elements.previewPrimaryValue.textContent = copy.primaryValue
    elements.previewSecondaryLabel.textContent = copy.secondaryLabel
    elements.previewSecondaryValue.textContent = copy.secondaryValue
    elements.previewTickerA.textContent = copy.tickerA
    elements.previewTickerB.textContent = copy.tickerB
    elements.previewTickerC.textContent = copy.tickerC
    elements.formTitle.textContent = copy.formTitle
    elements.formCopy.textContent = copy.formCopy
    elements.switchLabel.textContent = copy.switchLabel
    elements.switchButton.textContent = copy.switchAction
    elements.switchButton.dataset.mode = isSignup ? 'login' : 'signup'
    elements.submit.dataset.defaultLabel = copy.submit
    setSubmitting(false, copy.submit)
    setStatus('', 'info')
    elements.resend.classList.add('hidden')
  }

  function togglePasswordVisibility(button) {
    const input = document.getElementById(button.dataset.target)
    if (!input) return

    const nextType = input.type === 'password' ? 'text' : 'password'
    input.type = nextType
    button.setAttribute('aria-pressed', String(nextType === 'text'))
    button.querySelector('.material-symbols-outlined').textContent =
      nextType === 'text' ? 'visibility' : 'visibility_off'
  }

  async function handleLogin() {
    const email = elements.email.value.trim()
    const password = elements.password.value

    if (!email || !password) {
      setStatus('Enter both email and password to sign in.', 'error')
      return
    }

    setSubmitting(true, 'Authenticating...')
    setStatus('', 'info')

    const { error } = await client.auth.signInWithPassword({ email, password })

    if (error) {
      setSubmitting(false, elements.submit.dataset.defaultLabel)
      setStatus(error.message, 'error')
      if (/not confirmed/i.test(error.message)) {
        state.pendingVerificationEmail = email
        elements.resend.classList.remove('hidden')
      }
      return
    }

    window.location.href = app.pageHref('dashboard')
  }

  async function handleSignup() {
    const fullName = elements.fullName.value.trim()
    const email = elements.email.value.trim()
    const password = elements.password.value
    const confirmPassword = elements.confirmPassword.value

    if (!fullName) {
      setStatus('Add your full name so we can store it in your Supabase profile.', 'error')
      return
    }

    if (!email || !password) {
      setStatus('Email and password are required to create the account.', 'error')
      return
    }

    if (password.length < 6) {
      setStatus('Use at least 6 characters for the password.', 'error')
      return
    }

    if (password !== confirmPassword) {
      setStatus('Passwords do not match yet.', 'error')
      return
    }

    if (!elements.terms.checked) {
      setStatus('Accept the terms and privacy protocol to continue.', 'error')
      return
    }

    setSubmitting(true, 'Creating account...')
    setStatus('', 'info')

    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: app.getEmailRedirectUrl(config),
        data: {
          full_name: fullName
        }
      }
    })

    if (error) {
      setSubmitting(false, elements.submit.dataset.defaultLabel)
      setStatus(error.message, 'error')
      return
    }

    state.pendingVerificationEmail = email

    if (data && data.session) {
      window.location.href = app.pageHref('dashboard')
      return
    }

    setSubmitting(false, elements.submit.dataset.defaultLabel)
    setStatus('Account created. Check your inbox for the verification email, then continue into the dashboard.', 'success')
    elements.resend.classList.remove('hidden')
  }

  async function handleResend() {
    const email = (elements.email.value || state.pendingVerificationEmail || '').trim()

    if (!email) {
      setStatus('Enter the account email first, then resend the verification link.', 'error')
      return
    }

    elements.resend.disabled = true
    elements.resend.textContent = 'Sending...'

    const { error } = await client.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: app.getEmailRedirectUrl(config)
      }
    })

    elements.resend.disabled = false
    elements.resend.textContent = 'Resend verification email'

    if (error) {
      setStatus(error.message, 'error')
      return
    }

    setStatus('A fresh verification email is on the way.', 'success')
  }

  elements.modeLogin.addEventListener('click', () => setMode('login'))
  elements.modeSignup.addEventListener('click', () => setMode('signup'))
  elements.switchButton.addEventListener('click', () => setMode(elements.switchButton.dataset.mode))
  elements.resend.addEventListener('click', handleResend)

  document.querySelectorAll('[data-toggle-password]').forEach((button) => {
    button.addEventListener('click', () => togglePasswordVisibility(button))
  })

  elements.form.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!client || state.submitting) return

    if (state.mode === 'signup') {
      await handleSignup()
    } else {
      await handleLogin()
    }
  })

  setMode('login')

  if (!client) {
    setStatus(runtime.error, 'error')
    elements.submit.disabled = true
    return
  }

  await app.redirectIfSessionExists(client, 'dashboard')
})
