// pages/agents/scout.tsx
// Scout Agent Page (Tailwind Version)

import React, { useState } from 'react'
import { Button, Card, Badge, Select, Spinner } from '../../src/components/shared'

interface Lead {
  rank: number
  project_name: string
  token_ticker: string
  chain: string
  fit_score: number
  verdict: 'PREMIUM' | 'LEAD'
  pain_point: string
  hook: string
  contact_handle: string
  engagement_gap_ratio: number
  twitterHandle?: string | null
  telegramHandle?: string | null
  websiteUrl?: string | null
  discordUrl?: string | null
}

export default function ScoutPage() {
  const [vertical, setVertical] = useState('all')
  const [chain, setChain] = useState('any chain')
  const [loading, setLoading] = useState(false)
  const [leads, setLeads] = useState<Lead[]>([])
  const [status, setStatus] = useState('')

  const verticalOptions = [
    { value: 'all', label: 'All Verticals' },
    { value: 'defi', label: 'DeFi / TVL Growth' },
    { value: 'gamefi', label: 'GameFi' },
    { value: 'socialfi', label: 'SocialFi' },
    { value: 'rwa', label: 'Real World Assets' },
  ]

  const chainOptions = [
    { value: 'any chain', label: 'All Chains' },
    { value: 'base', label: 'Base' },
    { value: 'arbitrum', label: 'Arbitrum' },
    { value: 'solana', label: 'Solana' },
    { value: 'eth', label: 'Ethereum' },
    { value: 'bsc', label: 'BNB Chain' },
  ]

  const handleHunt = async () => {
    setLoading(true)
    setStatus('🔍 Scanning GeckoTerminal for trending pools...')
    setLeads([])

    try {
      const res = await fetch('/api/scout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vertical, chain }),
      })

      const data = await res.json()

      if (data.ok && data.data?.leads) {
        setLeads(data.data.leads)
        const premium = data.data.leads.filter((l: Lead) => l.verdict === 'PREMIUM').length
        const leadCount = data.data.leads.filter((l: Lead) => l.verdict === 'LEAD').length
        setStatus(
          `✅ Found ${data.data.leads.length} leads (${premium} PREMIUM, ${leadCount} LEAD) · ${data.data.signal_stats?.gecko_pools || 0} pools analyzed`
        )
      } else {
        setStatus('❌ No leads found. Try different filters.')
      }
    } catch (err) {
      setStatus('❌ Error scanning. Please try again.')
      console.error(err)
    }

    setLoading(false)
  }

  return (
    <div className="bg-[#0A0A0F] min-h-screen text-white">
      {/* Header */}
      <header className="bg-[#0A0A0F] border-b border-[#1A1A2E] px-8 py-4">
        <div className="flex items-center justify-between">
          <div className="text-2xl font-bold">🔍 Scout Agent</div>
          <Button variant="ghost" size="sm" onClick={() => window.location.href = '/dashboard'}>
            ← Back to Dashboard
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="text-center py-16 px-8 bg-gradient-to-b from-[#0A0A0F] to-[#1A1A2E] border-b border-[#1A1A2E]">
        <h1 className="text-5xl font-bold mb-4">Find Your Next Campaign</h1>
        <p className="text-lg text-[#A0A0B0] mb-8">
          Discover trending pools with high founder engagement and untapped potential
        </p>
        <Button variant="primary" size="lg" onClick={handleHunt} disabled={loading}>
          {loading ? '⏳ Hunting...' : '🚀 Hunt Live Projects'}
        </Button>
      </section>

      {/* Filters Section */}
      <section className="px-8 py-6 bg-[#1A1A2E] border-b border-[#1A1A2E]">
        <div className="max-w-7xl mx-auto flex gap-4 flex-wrap items-end">
          <div className="flex-1 min-w-[200px]">
            <Select
              label="Vertical"
              value={vertical}
              onChange={(e) => setVertical(e.target.value)}
              options={verticalOptions}
            />
          </div>
          <div className="flex-1 min-w-[200px]">
            <Select
              label="Chain"
              value={chain}
              onChange={(e) => setChain(e.target.value)}
              options={chainOptions}
            />
          </div>
        </div>
      </section>

      {/* Status Bar */}
      {status && (
        <section className="px-8 py-4 bg-[#1A1A2E] border-b border-[#1A1A2E]">
          <div className="max-w-7xl mx-auto flex items-center gap-3">
            {loading && <Spinner size="sm" />}
            <p className="text-sm text-[#A0A0B0]">{status}</p>
          </div>
        </section>
      )}

      {/* Results Grid */}
      <section className="px-8 py-8 max-w-7xl mx-auto">
        {leads.length === 0 && !loading && status === '' && (
          <div className="text-center py-32">
            <p className="text-lg text-[#6B6B80]">
              👆 Select filters and click "Hunt Live Projects" to find leads
            </p>
          </div>
        )}

        {leads.length === 0 && !loading && status && (
          <div className="text-center py-32">
            <p className="text-lg text-[#6B6B80]">{status}</p>
          </div>
        )}

        {leads.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {leads.map((lead) => (
              <Card
                key={`${lead.project_name}-${lead.chain}`}
                variant={lead.verdict === 'PREMIUM' ? 'premium' : 'default'}
                className="flex flex-col justify-between"
              >
                {/* Header */}
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <div className="text-xl font-semibold">{lead.project_name}</div>
                    <div className="text-xs text-[#00FF88] font-mono font-semibold">
                      {lead.token_ticker}
                    </div>
                  </div>
                  <Badge variant={lead.verdict === 'PREMIUM' ? 'premium' : 'lead'}>
                    {lead.fit_score.toFixed(1)}
                  </Badge>
                </div>

                {/* Tags */}
                <div className="flex gap-2 flex-wrap mb-4">
                  <Badge variant="chain">{lead.chain}</Badge>
                  <Badge variant="default">{lead.contact_handle}</Badge>
                </div>

                {/* Pain Point */}
                <p className="text-sm text-[#F59E0B] mb-3 font-mono font-medium">
                  ⚡ {lead.pain_point}
                </p>

                {/* Social Links */}
                <div className="flex gap-2 flex-wrap mb-3">
                  {lead.twitterHandle && (
                    <a href={lead.twitterHandle.startsWith('http') ? lead.twitterHandle : `https://twitter.com/${lead.twitterHandle}`}
                       target="_blank" rel="noopener noreferrer"
                       className="text-xs text-[#1DA1F2] hover:underline">
                      𝕏 / Twitter
                    </a>
                  )}
                  {lead.telegramHandle && (
                    <a href={lead.telegramHandle.startsWith('http') ? lead.telegramHandle : `https://t.me/${lead.telegramHandle}`}
                       target="_blank" rel="noopener noreferrer"
                       className="text-xs text-[#0088CC] hover:underline">
                      ✈️ Telegram
                    </a>
                  )}
                  {lead.websiteUrl && (
                    <a href={lead.websiteUrl.startsWith('http') ? lead.websiteUrl : `https://${lead.websiteUrl}`}
                       target="_blank" rel="noopener noreferrer"
                       className="text-xs text-[#A0A0B0] hover:underline">
                      🌐 Website
                    </a>
                  )}
                  {lead.discordUrl && (
                    <a href={lead.discordUrl.startsWith('http') ? lead.discordUrl : `https://discord.gg/${lead.discordUrl}`}
                       target="_blank" rel="noopener noreferrer"
                       className="text-xs text-[#5865F2] hover:underline">
                      💬 Discord
                    </a>
                  )}
                </div>

                {/* Hook */}
                <p className="text-sm text-[#A0A0B0] mb-4 leading-relaxed flex-1">
                  {lead.hook}
                </p>

                {/* Action Buttons */}
                <div className="flex gap-3">
                  <Button variant="secondary" size="sm" className="flex-1">
                    → Outreach
                  </Button>
                  <Button variant="secondary" size="sm" className="flex-1">
                    → Onboard
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  )
}
