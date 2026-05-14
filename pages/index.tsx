import React, { useEffect, useMemo, useState } from 'react'

type AgentId = 'scout' | 'outreach' | 'onboard' | 'qa'
type SourceType = 'onchain' | 'x' | 'telegram' | 'reddit' | 'governance' | 'manual'
type RecipientType = 'founder' | 'dev' | 'agent' | 'kol' | 'influencer' | 'community'
type PlatformType = 'x' | 'telegram' | 'reddit' | 'discord' | 'email'
type ToneType = 'direct' | 'warm' | 'concise'
type MessageType = 'opener' | 'follow-up' | 'objection' | 'onboarding close'

type LeadStage = 'Scouted' | 'In conversation' | 'Qualified' | 'Onboarding' | 'Live'

type LeadSource = {
  platform: SourceType
  urlOrLabel: string
  signalText: string
  confidence: number
}

type ScoreBreakdown = {
  eligibility: number
  painSignal: number
  poolFit: number
  communityGap: number
  confidence: number
  total: number
}

type Lead = {
  id: string
  name: string
  ticker: string
  chain: string
  vertical: string
  score: number
  verdict: 'PREMIUM' | 'LEAD'
  stage: LeadStage
  mcap: string
  treasury: string
  painPoint: string
  hook: string
  nextAction: string
  poolSource: string
  tokenAddress?: string | null
  twitterHandle?: string | null
  telegramHandle?: string | null
  websiteUrl?: string | null
  sources: LeadSource[]
  scoreBreakdown: ScoreBreakdown
  confidence: number
  recommendedRecipient: RecipientType
  recommendedPlatform: PlatformType
  handoffAgent: AgentId
}

type ChatMessage = {
  role: 'user' | 'agent'
  text: string
}

const supportedChains = [
  'ETH',
  'SOL',
  'BNB',
  'Base',
  'AVAX',
  'Polygon',
  'Arbitrum',
  'Optimism',
  'Fantom',
  'All EVM-compatible chains',
]

const sourceTypes: SourceType[] = ['onchain', 'x', 'telegram', 'reddit', 'governance', 'manual']
const verticalOptions = ['DeFi', 'RWA', 'AI-Crypto', 'SocialFi', 'GameFi', 'Launchpad', 'Infrastructure']
const recipientOptions: RecipientType[] = ['founder', 'dev', 'agent', 'kol', 'influencer', 'community']
const platformOptions: PlatformType[] = ['x', 'telegram', 'reddit', 'discord', 'email']
const toneOptions: ToneType[] = ['direct', 'warm', 'concise']
const messageTypeOptions: MessageType[] = ['opener', 'follow-up', 'objection', 'onboarding close']

const agentMeta: Record<AgentId, { name: string; title: string; mission: string; action: string }> = {
  scout: {
    name: 'Scout',
    title: 'Strategic Lead Scout',
    action: 'Find campaign-ready pools',
    mission: 'Critically searches on-chain pools plus social, governance, Telegram, Reddit, and manual pain signals for AimHigher-ready projects.',
  },
  outreach: {
    name: 'Outreach',
    title: 'Platform Outreach Composer',
    action: 'Compose pain-led outreach',
    mission: 'Writes channel-specific messages for founders, devs, agents, KOLs, influencers, and community operators.',
  },
  onboard: {
    name: 'Onboard',
    title: 'Onboarding Agent',
    action: 'Walk project to launch',
    mission: 'Guides qualified teams through wallet connect, contract, reward amount, duration, deployment, funding, and tracking links.',
  },
  qa: {
    name: 'Q&A',
    title: 'Q&A Agent',
    action: 'Clear objections',
    mission: 'Answers questions about scoring, eligibility, competitor differences, pool mechanics, chains, and contributor rewards.',
  },
}



const onboardingSteps = [
  'Connect project wallet',
  'Paste token contract',
  'Set reward amount',
  'Choose campaign duration',
  'Deploy pool',
  'Fund reward pool',
  'Share contributor links',
  'Monitor capital dashboard',
]

const qaPrompts = [
  'How is AimHigher different from KOL marketing?',
  'What makes this lead eligible?',
  'How does the score avoid fake traffic?',
  'What should Outreach say if they ask about budget?',
]

function Logo() {
  return (
    <button type="button" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-3 border-0 bg-transparent p-0 text-left text-white" aria-label="AimHigher home">
      <span className="relative block h-9 w-9 shrink-0">
        <span className="absolute left-1 top-4 h-2 w-8 -rotate-45 rounded-full bg-[#6cff7f]" />
        <span className="absolute right-0 top-1 h-7 w-2 rounded-full bg-[#6cff7f]" />
        <span className="absolute right-0 top-1 h-2 w-7 rounded-full bg-[#6cff7f]" />
      </span>
      <span className="text-3xl font-black text-white md:text-4xl">AimHigher</span>
    </button>
  )
}

function composeOutreachMessage(lead: Lead, recipient: RecipientType, platform: PlatformType, tone: ToneType, messageType: MessageType) {
  const platformLimit = platform === 'email' ? 'longer note' : platform === 'x' ? 'short DM' : platform === 'reddit' ? 'comment-friendly note' : 'quick message'
  const recipientLabel = recipient === 'dev' ? 'core/dev team' : recipient === 'kol' ? 'KOL partner' : recipient === 'community' ? 'community lead' : recipient
  const qualifier = recipient === 'kol' || recipient === 'influencer'
    ? 'Do you have an audience segment that consistently drives wallet activity, not just clicks?'
    : 'Do you already have at least $2.5K in token or stable rewards allocated for growth incentives?'

  if (messageType === 'follow-up') {
    return `Following up on ${lead.name}: the main gap still looks like ${lead.painPoint.toLowerCase()} If you are open to it, I can sketch the smallest AimHigher pool that would test whether contributors can drive real capital. ${qualifier}`
  }

  if (messageType === 'objection') {
    return `Totally fair to question another growth tool. The difference here is that AimHigher rewards referred capital and wallet behavior instead of impressions, quests, or raw traffic. For ${lead.name}, the test would be simple: can a small pool produce measurable new holders?`
  }

  if (messageType === 'onboarding close') {
    return `${lead.name} looks qualified enough to model a pool. If you want, Aria can walk the team through wallet connect, token contract, reward amount, duration, deploy, and funding in about 10 minutes.`
  }

  const warmth = tone === 'warm' ? 'Really like what you are building.' : tone === 'concise' ? '' : 'Quick thought.'
  return `${warmth} Noticed ${lead.name} has a specific growth gap: ${lead.painPoint} AimHigher may be useful here because it pays for capital referred on-chain, not vanity reach. For a ${platformLimit} to a ${recipientLabel}, I would ask one thing first: ${qualifier}`.trim()
}

function answerQuestion(lead: Lead, prompt: string) {
  const lower = prompt.toLowerCase()
  if (lower.includes('eligible')) return `${lead.name} qualifies because it is on ${lead.chain}, has a live token/pool signal, sits around ${lead.mcap}, and appears to have at least ${lead.treasury} in reward capacity. The strongest evidence is: ${lead.sources[0]?.signalText || lead.painPoint}`
  if (lower.includes('fake')) return 'AimHigher weights referred capital and invested capital, while traffic quality is capped. That means bots, empty clicks, and inflated engagement cannot win unless real on-chain money follows.'
  if (lower.includes('budget')) return 'Outreach should ask one budget qualifier at a time: whether they can allocate at least $2.5K equivalent for a one-week pilot. If yes, Aria can map budget to campaign duration.'
  return 'KOL campaigns pay upfront for attention. AimHigher ties rewards to referred capital and wallet behavior, so the project can see whether spend creates real holders.'
}

export default function HomePage() {
  const leadsPerPage = 4
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginError, setLoginError] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [signupName, setSignupName] = useState('')
  const [activeAgent, setActiveAgent] = useState<AgentId>('scout')
  const [leads, setLeads] = useState<Lead[]>([])
  const [selectedLeadId, setSelectedLeadId] = useState('')
  const [leadPage, setLeadPage] = useState(1)
  const [scanStatus, setScanStatus] = useState('Scout is ready. Configure sources, then run a scan.')
  const [isScanning, setIsScanning] = useState(false)
  const [selectedChains, setSelectedChains] = useState<string[]>(supportedChains.slice(0, 9))
  const [selectedSources, setSelectedSources] = useState<SourceType[]>(['onchain', 'x', 'telegram', 'reddit', 'governance'])
  const [selectedVerticals, setSelectedVerticals] = useState<string[]>([])
  const [minimumScore, setMinimumScore] = useState(7)
  const [manualSignals, setManualSignals] = useState('')
  const [recipient, setRecipient] = useState<RecipientType>('founder')
  const [platform, setPlatform] = useState<PlatformType>('x')
  const [tone, setTone] = useState<ToneType>('direct')
  const [messageType, setMessageType] = useState<MessageType>('opener')
  const [onboardingStep, setOnboardingStep] = useState(1)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState<Record<AgentId, ChatMessage[]>>({
    scout: [{ role: 'agent', text: 'Scout is active first. Run a critical scan, inspect evidence, then hand a qualified lead to Outreach.' }],
    outreach: [{ role: 'agent', text: 'Outreach only composes after Scout selects a lead. Choose recipient, platform, tone, and message type.' }],
    onboard: [{ role: 'agent', text: 'Onboard starts after Outreach qualifies the project. One onboarding step at a time.' }],
    qa: [{ role: 'agent', text: 'Q&A is available when a lead raises an objection or needs a crisp answer.' }],
  })

  useEffect(() => {
    setIsAuthenticated(localStorage.getItem('aimhigher-team-authenticated') === 'true')
    setEmail(localStorage.getItem('aimhigher-team-email') || '')
    setIsLoading(false)
  }, [])

  const selectedLead = useMemo(() => leads.find((lead) => lead.id === selectedLeadId) || leads[0] || null, [leads, selectedLeadId])
  const totalLeadPages = Math.max(1, Math.ceil(leads.length / leadsPerPage))
  const paginatedLeads = useMemo(() => leads.slice((leadPage - 1) * leadsPerPage, leadPage * leadsPerPage), [leadPage, leads])

  const scrollToLogin = () => document.getElementById('login')?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const addAgentMessage = (agent: AgentId, text: string, role: ChatMessage['role'] = 'agent') => {
    setMessages((current) => ({ ...current, [agent]: [...current[agent], { role, text }] }))
  }

  const handleAuth = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoginError('')
    if (!email.includes('@')) return setLoginError('Enter a valid email address.')
    if (password.length < 6) return setLoginError('Password must be at least 6 characters.')
    if (isSignup && !signupName.trim()) return setLoginError('Enter your name.')

    try {
      const endpoint = isSignup ? '/api/auth/signup' : '/api/auth/login'
      const body = isSignup ? { email, password, name: signupName.trim() } : { email, password }
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!json.ok) return setLoginError(json.error || 'Authentication failed')
      localStorage.setItem('aimhigher-team-authenticated', 'true')
      localStorage.setItem('aimhigher-team-email', email)
      setIsAuthenticated(true)
    } catch {
      setLoginError('Network error. Check your connection.')
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('aimhigher-team-authenticated')
    localStorage.removeItem('aimhigher-team-email')
    setIsAuthenticated(false)
    setPassword('')
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 40)
  }

  const toggleChain = (chain: string) => {
    if (chain === 'All EVM-compatible chains') return
    setSelectedChains((current) => current.includes(chain) ? current.filter(item => item !== chain) : [...current, chain])
  }

  const toggleSource = (source: SourceType) => {
    setSelectedSources((current) => current.includes(source) ? current.filter(item => item !== source) : [...current, source])
  }

  const toggleVertical = (vertical: string) => {
    setSelectedVerticals((current) => current.includes(vertical) ? current.filter(item => item !== vertical) : [...current, vertical])
  }

  const runScout = async () => {
    setIsScanning(true)
    setActiveAgent('scout')
    setScanStatus('Scout is scanning GeckoTerminal pools across selected chains...')
    try {
      const response = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chains: selectedChains,
          sourceTypes: selectedSources,
          verticals: selectedVerticals,
          minimumScore,
          page: 1,
          pageSize: 30,
          manualSignals: manualSignals.split('\n').map(signal => signal.trim()).filter(Boolean),
        }),
      })
      const json = await response.json()
      const nextLeads = json?.data?.leads?.length ? json.data.leads as Lead[] : []
      setLeads(nextLeads)
      if (nextLeads.length) {
        setSelectedLeadId(nextLeads[0].id)
        setScanStatus(`Scout found ${nextLeads.length} qualifying pools. Review evidence, score breakdown, and hand one to Outreach.`)
        addAgentMessage('scout', `Scan complete: ${nextLeads.length} qualified leads. Highest fit is ${nextLeads[0].name} at ${nextLeads[0].score}/10.`)
      } else {
        setScanStatus('Scan completed — no pools met the minimum score/liquidity thresholds. Try broader chain selection or lower min score.')
        addAgentMessage('scout', 'Scan returned no qualifying leads. Try different chains, sources, or lower the minimum score.')
      }
    } catch (error) {
      setLeads([])
      setSelectedLeadId('')
      setScanStatus('GeckoTerminal API unreachable. Check network or try again later.')
      addAgentMessage('scout', 'Scan failed. GeckoTerminal API may be rate-limited or unreachable.')
    } finally {
      setIsScanning(false)
    }
  }

  const setLeadStage = (stage: LeadStage) => {
    if (!selectedLead) return
    setLeads((current) => current.map((lead) => lead.id === selectedLead.id ? { ...lead, stage } : lead))
  }

  const handoffTo = (agent: AgentId) => {
    if (!selectedLead) return
    setActiveAgent(agent)
    if (agent === 'outreach') {
      setRecipient(selectedLead.recommendedRecipient)
      setPlatform(selectedLead.recommendedPlatform)
      setLeadStage('In conversation')
      addAgentMessage('outreach', `Received ${selectedLead.name} from Scout. Pain point: ${selectedLead.painPoint}`)
    }
    if (agent === 'onboard') {
      setLeadStage('Onboarding')
      addAgentMessage('onboard', `${selectedLead.name} is qualified. Start at step ${onboardingStep}: ${onboardingSteps[onboardingStep - 1]}.`)
    }
    if (agent === 'qa') {
      addAgentMessage('qa', `Ready to answer objections for ${selectedLead.name}.`)
    }
  }

  const composeAndAddOutreachMessage = () => {
    if (!selectedLead) return
    const text = composeOutreachMessage(selectedLead, recipient, platform, tone, messageType)
    setLeadStage(messageType === 'onboarding close' ? 'Qualified' : 'In conversation')
    addAgentMessage('outreach', text)
  }

  const sendMessage = (preset?: string) => {
    if (!selectedLead) return
    const text = (preset || input).trim()
    if (!text) return
    addAgentMessage(activeAgent, text, 'user')
    if (activeAgent === 'outreach') addAgentMessage('outreach', composeOutreachMessage(selectedLead, recipient, platform, tone, messageType))
    if (activeAgent === 'scout') addAgentMessage('scout', `${selectedLead.name} remains ${selectedLead.verdict} at ${selectedLead.score}/10. Top source: ${selectedLead.sources[0]?.signalText || selectedLead.painPoint}`)
    if (activeAgent === 'onboard') addAgentMessage('onboard', `Next for ${selectedLead.name}: ${onboardingSteps[onboardingStep - 1]}. Keep the founder on this step before moving ahead.`)
    if (activeAgent === 'qa') addAgentMessage('qa', answerQuestion(selectedLead, text))
    setInput('')
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#050507] text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-[#6cff7f] border-t-transparent" />
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-[#050507] text-white">
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#050507]/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1680px] items-center justify-between px-5 py-5 md:px-10">
          <div className="flex items-center gap-10">
            <Logo />
            <p className="hidden rounded-full border border-[#6cff7f]/40 bg-[#6cff7f]/10 px-4 py-2 text-sm font-bold text-[#baffc2] md:block">
              Currently using: {agentMeta[activeAgent].name}
            </p>
          </div>
          {isAuthenticated ? (
            <button type="button" onClick={handleLogout} className="rounded-full border-0 bg-[#6cff7f] px-5 py-2 text-base font-bold text-black transition hover:bg-[#54e868]">
              Log out
            </button>
          ) : (
            <button type="button" onClick={scrollToLogin} className="rounded-full border-0 bg-[#6cff7f] px-5 py-2 text-base font-bold text-black transition hover:bg-[#54e868]">
              Log in
            </button>
          )}
        </div>
      </header>

      {!isAuthenticated ? (
        <main>
          <section className="relative overflow-hidden border-b border-white/10">
            <div className="pointer-events-none absolute inset-0 mx-auto max-w-[1740px] border-x border-white/10" />
            <div className="mx-auto grid min-h-[760px] max-w-[1680px] items-center gap-12 px-5 py-24 md:px-10 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6cff7f]">AimHigher Onboarding Team</p>
                <h1 className="mt-6 max-w-5xl text-[54px] font-light leading-[1.05] text-white md:text-[92px]">
                  Scout first.
                  <span className="block text-white/40">Then Outreach turns fit into <span className="text-[#6cff7f]">campaigns.</span></span>
                </h1>
                <p className="mt-8 max-w-2xl text-2xl leading-relaxed text-white/70">
                  A single-agent workspace for finding qualified pools, composing pain-led outreach, answering objections, and onboarding teams.
                </p>
                <div className="mt-7 flex max-w-3xl flex-wrap gap-2">
                  {supportedChains.map((chain) => (
                    <span key={chain} className="rounded-full border border-white/15 bg-white/[0.03] px-4 py-2 text-sm font-semibold text-white/70">{chain}</span>
                  ))}
                </div>
                <button type="button" onClick={scrollToLogin} className="mt-10 rounded-2xl bg-[#6cff7f] px-8 py-5 text-xl font-bold text-black transition hover:bg-[#54e868]">
                  Open team console
                </button>
              </div>
              <div className="rounded-[30px] border border-white/15 bg-white/[0.03] p-7">
                <p className="text-sm uppercase tracking-[0.24em] text-[#6cff7f]">Workflow</p>
                {(['scout', 'outreach', 'onboard', 'qa'] as AgentId[]).map((agent, index) => (
                  <div key={agent} className="mt-6 rounded-2xl border border-white/10 bg-black/25 p-5">
                    <p className="text-sm text-white/40">Step {index + 1}</p>
                    <h2 className="mt-1 text-2xl font-bold">{agentMeta[agent].name}: {agentMeta[agent].title}</h2>
                    <p className="mt-2 text-white/60">{agentMeta[agent].mission}</p>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section id="login" className="mx-auto grid max-w-6xl gap-10 px-5 py-24 md:grid-cols-[1fr_440px] md:px-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6cff7f]">Team access</p>
              <h2 className="mt-5 text-5xl font-light leading-tight">Log in to run Scout and hand qualified leads to Outreach.</h2>
              <p className="mt-6 max-w-2xl text-xl leading-relaxed text-white/65">Use any valid email and a password of at least six characters to enter the demo console.</p>
            </div>
            <form onSubmit={handleAuth} className="rounded-[28px] border border-white/15 bg-white/[0.03] p-6 shadow-2xl shadow-black/40">
              <div className="mb-5 flex gap-2">
                <button type="button" onClick={() => { setIsSignup(false); setLoginError('') }} className={`rounded-full px-4 py-2 text-sm font-bold transition ${!isSignup ? 'bg-[#6cff7f] text-black' : 'border border-white/15 text-white/70 hover:border-[#6cff7f]'}`}>Log in</button>
                <button type="button" onClick={() => { setIsSignup(true); setLoginError('') }} className={`rounded-full px-4 py-2 text-sm font-bold transition ${isSignup ? 'bg-[#6cff7f] text-black' : 'border border-white/15 text-white/70 hover:border-[#6cff7f]'}`}>Sign up</button>
              </div>
              {isSignup && (
                <>
                  <label className="block text-sm font-semibold text-white/70" htmlFor="signupName">Name</label>
                  <input id="signupName" type="text" value={signupName} onChange={(event) => setSignupName(event.target.value)} placeholder="Your name" className="mt-2 w-full rounded-xl border border-white/15 bg-black px-4 py-4 text-white outline-none transition focus:border-[#6cff7f]" />
                </>
              )}
              <label className="block text-sm font-semibold text-white/70 mt-5" htmlFor="email">Email</label>
              <input id="email" type="text" inputMode="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="operator@aimhigher.gg" className="mt-2 w-full rounded-xl border border-white/15 bg-black px-4 py-4 text-white outline-none transition focus:border-[#6cff7f]" />
              <label className="mt-5 block text-sm font-semibold text-white/70" htmlFor="password">Password</label>
              <div className="mt-2 flex rounded-xl border border-white/15 bg-black focus-within:border-[#6cff7f]">
                <input id="password" type={showPassword ? 'text' : 'password'} value={password} onChange={(event) => setPassword(event.target.value)} placeholder="Minimum 6 characters" className="min-w-0 flex-1 rounded-xl border-0 bg-transparent px-4 py-4 text-white outline-none" />
                <button type="button" onClick={() => setShowPassword((visible) => !visible)} className="shrink-0 rounded-xl px-4 py-2 text-sm font-bold text-[#6cff7f] transition hover:bg-white/5" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                  {showPassword ? 'Hide' : 'Reveal'}
                </button>
              </div>
              {loginError && <p className="mt-4 rounded-xl border border-red-400/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">{loginError}</p>}
              <button type="submit" className="mt-6 w-full rounded-xl bg-[#6cff7f] px-5 py-4 text-lg font-bold text-black transition hover:bg-[#54e868]">
                {isSignup ? 'Create account' : 'Enter team console'}
              </button>
            </form>
          </section>
        </main>
      ) : (
        <main className="mx-auto max-w-[1680px] px-5 py-10 md:px-10">
          <section className="rounded-[30px] border border-white/10 bg-white/[0.03] p-7 md:p-9">
            <div className="flex flex-wrap items-start justify-between gap-6">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.28em] text-[#6cff7f]">Currently using: {agentMeta[activeAgent].name}</p>
                <h1 className="mt-4 text-4xl font-light leading-tight md:text-6xl">{agentMeta[activeAgent].action}</h1>
                <p className="mt-4 max-w-3xl text-lg leading-relaxed text-white/65">{agentMeta[activeAgent].mission}</p>
              </div>
              <div className="flex flex-wrap gap-2">
                {(['scout', 'outreach', 'onboard', 'qa'] as AgentId[]).map((agent) => (
                  <button key={agent} type="button" onClick={() => setActiveAgent(agent)} className={`rounded-full px-4 py-2 text-sm font-bold transition ${activeAgent === agent ? 'bg-[#6cff7f] text-black' : 'border border-white/15 text-white/70 hover:border-[#6cff7f] hover:text-[#6cff7f]'}`}>
                    {agentMeta[agent].name}
                  </button>
                ))}
              </div>
            </div>
          </section>

          <section className="mt-8 grid gap-8 xl:grid-cols-[430px_1fr]">
            <aside className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm uppercase tracking-[0.2em] text-[#6cff7f]">Scout results</p>
                  <h2 className="mt-2 text-3xl font-light">Qualified leads</h2>
                </div>
                <span className="rounded-full bg-[#6cff7f] px-4 py-2 text-sm font-bold text-black">Page {leadPage}/{totalLeadPages}</span>
              </div>
              <div className="mt-6 grid gap-4">
                {paginatedLeads.map((lead) => (
                  <button key={lead.id} type="button" onClick={() => setSelectedLeadId(lead.id)} className={`rounded-2xl border p-5 text-left transition ${selectedLead?.id === lead.id ? 'border-[#6cff7f] bg-[#6cff7f]/10' : 'border-white/10 bg-black/25 hover:border-white/25'}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-xl font-bold">{lead.name}</h3>
                        <p className="mt-1 text-white/50">{lead.ticker} · {lead.chain} · {lead.vertical}</p>
                      </div>
                      <span className="rounded-full bg-[#6cff7f] px-3 py-1 text-xs font-bold text-black">{lead.score}</span>
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-white/60">{lead.painPoint}</p>
                    <p className="mt-4 text-sm text-[#6cff7f]">{lead.stage} · {Math.round(lead.confidence * 100)}% confidence</p>
                  </button>
                ))}
              </div>
              <div className="mt-6 flex items-center justify-between gap-3">
                <button type="button" onClick={() => setLeadPage((page) => Math.max(1, page - 1))} disabled={leadPage === 1} className="rounded-xl border border-white/15 px-4 py-3 font-bold text-white transition hover:border-[#6cff7f] hover:text-[#6cff7f] disabled:cursor-not-allowed disabled:opacity-35">Previous</button>
                <p className="text-sm text-white/50">{leads.length} leads</p>
                <button type="button" onClick={() => setLeadPage((page) => Math.min(totalLeadPages, page + 1))} disabled={leadPage === totalLeadPages} className="rounded-xl border border-white/15 px-4 py-3 font-bold text-white transition hover:border-[#6cff7f] hover:text-[#6cff7f] disabled:cursor-not-allowed disabled:opacity-35">Next</button>
              </div>
            </aside>

            <section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
              {activeAgent === 'scout' && (
                <div className="grid gap-7 lg:grid-cols-[1fr_360px]">
                  <div>
                    <h2 className="text-4xl font-light">Critical source scan</h2>
                    <p className="mt-3 text-white/60">{scanStatus}</p>
                    <div className="mt-6 rounded-3xl border border-white/10 bg-black/30 p-5">
                      <h3 className="text-2xl font-bold">Chains</h3>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {supportedChains.map((chain) => (
                          <button key={chain} type="button" onClick={() => toggleChain(chain)} className={`rounded-full border px-4 py-2 text-sm font-bold ${selectedChains.includes(chain) || chain === 'All EVM-compatible chains' ? 'border-[#6cff7f] bg-[#6cff7f]/10 text-[#baffc2]' : 'border-white/15 text-white/55'}`}>
                            {chain}
                          </button>
                        ))}
                      </div>
                      <h3 className="mt-6 text-2xl font-bold">Sources</h3>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {sourceTypes.map((source) => (
                          <button key={source} type="button" onClick={() => toggleSource(source)} className={`rounded-full border px-4 py-2 text-sm font-bold capitalize ${selectedSources.includes(source) ? 'border-[#6cff7f] bg-[#6cff7f]/10 text-[#baffc2]' : 'border-white/15 text-white/55'}`}>
                            {source}
                          </button>
                        ))}
                      </div>
                      <h3 className="mt-6 text-2xl font-bold">Verticals</h3>
                      <div className="mt-4 flex flex-wrap gap-2">
                        {verticalOptions.map((vertical) => (
                          <button key={vertical} type="button" onClick={() => toggleVertical(vertical)} className={`rounded-full border px-4 py-2 text-sm font-bold ${selectedVerticals.includes(vertical) ? 'border-[#6cff7f] bg-[#6cff7f]/10 text-[#baffc2]' : 'border-white/15 text-white/55'}`}>
                            {vertical}
                          </button>
                        ))}
                      </div>
                      <label className="mt-6 block text-sm font-bold text-white/70" htmlFor="score">Minimum score: {minimumScore}</label>
                      <input id="score" type="range" min="7" max="10" step="0.1" value={minimumScore} onChange={(event) => setMinimumScore(Number(event.target.value))} className="mt-3 w-full accent-[#6cff7f]" />
                      <label className="mt-6 block text-sm font-bold text-white/70" htmlFor="manualSignals">Manual tweet/channel/thread signals</label>
                      <textarea id="manualSignals" value={manualSignals} onChange={(event) => setManualSignals(event.target.value)} placeholder="Paste tweet links, Telegram notes, Reddit threads, governance snippets, one per line" className="mt-3 min-h-[120px] w-full resize-none rounded-2xl border border-white/15 bg-black px-4 py-3 text-white outline-none focus:border-[#6cff7f]" />
                      <button type="button" onClick={runScout} disabled={isScanning} className="mt-5 w-full rounded-xl bg-[#6cff7f] px-5 py-4 font-bold text-black transition hover:bg-[#54e868] disabled:cursor-wait disabled:opacity-70">
                        {isScanning ? 'Scanning sources...' : 'Run Scout scan'}
                      </button>
                    </div>
                  </div>
                  <LeadDetail lead={selectedLead} onOutreach={() => handoffTo('outreach')} onSage={() => handoffTo('qa')} />
                </div>
              )}

              {activeAgent === 'outreach' && (
                <div className="grid gap-7 lg:grid-cols-[1fr_380px]">
                  <div>
                    <h2 className="text-4xl font-light">Outreach composer</h2>
                    <p className="mt-3 text-white/60">Compose for the right person and platform. Outreach leads with pain, mentions AimHigher second, and asks one qualifying question.</p>
                    <div className="mt-6 grid gap-4 rounded-3xl border border-white/10 bg-black/30 p-5 md:grid-cols-2">
                      <Select label="Recipient" value={recipient} options={recipientOptions} onChange={(value) => setRecipient(value as RecipientType)} />
                      <Select label="Platform" value={platform} options={platformOptions} onChange={(value) => setPlatform(value as PlatformType)} />
                      <Select label="Tone" value={tone} options={toneOptions} onChange={(value) => setTone(value as ToneType)} />
                      <Select label="Message type" value={messageType} options={messageTypeOptions} onChange={(value) => setMessageType(value as MessageType)} />
                      <button type="button" onClick={composeAndAddOutreachMessage} className="rounded-xl bg-[#6cff7f] px-5 py-4 font-bold text-black transition hover:bg-[#54e868] md:col-span-2">Compose message</button>
                    </div>
                    <div className="mt-6 flex flex-wrap gap-3">
                      <button type="button" onClick={() => handoffTo('onboard')} className="rounded-xl border border-[#6cff7f] px-5 py-3 font-bold text-[#6cff7f] transition hover:bg-[#6cff7f]/10">Hand off to Aria</button>
                      <button type="button" onClick={() => handoffTo('qa')} className="rounded-xl border border-white/15 px-5 py-3 font-bold text-white transition hover:border-[#6cff7f] hover:text-[#6cff7f]">Ask Outreach</button>
                    </div>
                    <LeadDetail lead={selectedLead} compact />
                  </div>
                  <ChatPanel agent={activeAgent} messages={messages[activeAgent]} input={input} setInput={setInput} onSend={() => sendMessage()} />
                </div>
              )}

              {activeAgent === 'onboard' && (
                <div className="grid gap-7 lg:grid-cols-[1fr_380px]">
                  <div>
                    <h2 className="text-4xl font-light">Aria onboarding</h2>
                    <p className="mt-3 text-white/60">{selectedLead ? `Walk ${selectedLead.name} through setup one step at a time.` : 'Select a lead first by running a Scout scan.'}</p>
                    <div className="mt-6 grid gap-3 md:grid-cols-2">
                      {onboardingSteps.map((step, index) => (
                        <button key={step} type="button" onClick={() => setOnboardingStep(index + 1)} className={`rounded-xl border px-4 py-3 text-left ${index < onboardingStep ? 'border-[#6cff7f]/40 bg-[#6cff7f]/10 text-[#baffc2]' : 'border-white/10 bg-white/5 text-white/55'}`}>
                          {index + 1}. {step}
                        </button>
                      ))}
                    </div>
                    <button type="button" onClick={() => handoffTo('qa')} className="mt-6 rounded-xl border border-white/15 px-5 py-3 font-bold text-white transition hover:border-[#6cff7f] hover:text-[#6cff7f]">Ask Sage</button>
                  </div>
                  <ChatPanel agent={activeAgent} messages={messages[activeAgent]} input={input} setInput={setInput} onSend={() => sendMessage()} />
                </div>
              )}

              {activeAgent === 'qa' && (
                <div className="grid gap-7 lg:grid-cols-[1fr_380px]">
                  <div>
                    <h2 className="text-4xl font-light">Sage Q&A</h2>
                    <p className="mt-3 text-white/60">Answer objections using the selected lead context.</p>
                    <div className="mt-6 flex flex-wrap gap-3">
                      {qaPrompts.map((prompt) => (
                        <button key={prompt} type="button" onClick={() => sendMessage(prompt)} className="rounded-full border border-white/15 px-4 py-2 text-sm text-white/75 transition hover:border-[#6cff7f] hover:text-[#6cff7f]">{prompt}</button>
                      ))}
                    </div>
                    <LeadDetail lead={selectedLead} compact />
                  </div>
                  <ChatPanel agent={activeAgent} messages={messages[activeAgent]} input={input} setInput={setInput} onSend={() => sendMessage()} />
                </div>
              )}
            </section>
          </section>
        </main>
      )}
    </div>
  )
}

function Select({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <label className="block text-sm font-bold text-white/70">
      {label}
      <select value={value} onChange={(event) => onChange(event.target.value)} className="mt-2 w-full rounded-xl border border-white/15 bg-black px-4 py-3 text-white outline-none focus:border-[#6cff7f]">
        {options.map((option) => <option key={option} value={option}>{option}</option>)}
      </select>
    </label>
  )
}

function LeadDetail({ lead, onOutreach, onSage, compact = false }: { lead: Lead | null; onOutreach?: () => void; onSage?: () => void; compact?: boolean }) {
  if (!lead) {
    return (
      <div className={`rounded-3xl border border-white/10 bg-black/30 p-5 ${compact ? 'mt-6' : ''}`}>
        <p className="text-white/50">No lead selected. Run a Scout scan first.</p>
      </div>
    )
  }
  return (
    <div className={`rounded-3xl border border-white/10 bg-black/30 p-5 ${compact ? 'mt-6' : ''}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h3 className="text-3xl font-bold">{lead.name}</h3>
          <p className="mt-2 text-white/50">{lead.ticker} · {lead.chain} · {lead.vertical}</p>
        </div>
        <span className="rounded-full bg-[#6cff7f] px-4 py-2 text-sm font-bold text-black">{lead.verdict} · {lead.score}/10</span>
      </div>
      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <p className="rounded-2xl bg-white/5 p-4"><span className="block text-sm text-white/40">Market cap</span>{lead.mcap}</p>
        <p className="rounded-2xl bg-white/5 p-4"><span className="block text-sm text-white/40">Treasury</span>{lead.treasury}</p>
        <p className="rounded-2xl bg-white/5 p-4"><span className="block text-sm text-white/40">Stage</span>{lead.stage}</p>
      </div>
      <p className="mt-5 text-white/70">{lead.painPoint}</p>
      <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4">
        <p className="text-sm uppercase tracking-[0.2em] text-[#6cff7f]">Evidence source</p>
        <p className="mt-2 text-white/80">{lead.sources[0]?.urlOrLabel}</p>
        <p className="mt-2 text-sm text-white/55">{lead.sources[0]?.signalText}</p>
      </div>
      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        {Object.entries(lead.scoreBreakdown).map(([key, value]) => (
          <p key={key} className="rounded-2xl bg-white/5 p-3 text-sm capitalize text-white/70">
            <span className="block text-white/35">{key}</span>{value}
          </p>
        ))}
      </div>
      <p className="mt-5 text-sm text-[#baffc2]">{lead.nextAction}</p>
      {(onOutreach || onSage) && (
        <div className="mt-5 flex flex-wrap gap-3">
          {onOutreach && <button type="button" onClick={onOutreach} className="rounded-xl bg-[#6cff7f] px-5 py-3 font-bold text-black transition hover:bg-[#54e868]">Hand off to Outreach</button>}
          {onSage && <button type="button" onClick={onSage} className="rounded-xl border border-white/15 px-5 py-3 font-bold text-white transition hover:border-[#6cff7f] hover:text-[#6cff7f]">Ask Sage</button>}
        </div>
      )}
    </div>
  )
}

function ChatPanel({ agent, messages, input, setInput, onSend }: { agent: AgentId; messages: ChatMessage[]; input: string; setInput: (value: string) => void; onSend: () => void }) {
  return (
    <div className="rounded-3xl border border-white/10 bg-black/40 p-5">
      <h3 className="text-2xl font-bold">Back-and-forth</h3>
      <div className="mt-5 flex max-h-[460px] min-h-[320px] flex-col gap-4 overflow-y-auto pr-1">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`rounded-2xl p-4 ${message.role === 'agent' ? 'bg-white/10 text-white' : 'bg-[#6cff7f] text-black'}`}>
            <p className="text-xs font-bold uppercase tracking-[0.16em] opacity-60">{message.role === 'agent' ? agentMeta[agent].name : 'You'}</p>
            <p className="mt-2 leading-relaxed">{message.text}</p>
          </div>
        ))}
      </div>
      <div className="mt-5 grid gap-3">
        <textarea value={input} onChange={(event) => setInput(event.target.value)} placeholder={`Message ${agentMeta[agent].name}`} className="min-h-[110px] resize-none rounded-2xl border border-white/15 bg-black px-4 py-3 text-white outline-none transition focus:border-[#6cff7f]" />
        <button type="button" onClick={onSend} className="rounded-xl bg-[#6cff7f] px-5 py-4 font-bold text-black transition hover:bg-[#54e868]">Send to {agentMeta[agent].name}</button>
      </div>
    </div>
  )
}
