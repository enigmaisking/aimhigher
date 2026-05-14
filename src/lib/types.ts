// lib/types.ts
// Centralized TypeScript interfaces for the entire application

export interface User {
  id: string
  email: string
  name: string
  password_hash: string
  created_at: string
  updated_at: string
  // Future: role?: 'admin' | 'editor' | 'viewer'
}

export interface Session {
  userId: string
  email: string
  name: string
  iat: number
  exp: number
}

export interface ScoreBreakdown {
  sector_alpha: number
  sentiment_pain: number
  engagement_gap: number
  chain_momentum: number
}

export interface Lead {
  id: string
  project_name: string
  token_ticker: string
  chain: string
  contract_address: string
  estimated_mcap: string
  why_good_fit: string
  pain_point: string
  estimated_treasury_size: string
  contact_handle: string
  source_signal: string
  snapshot_vote: string | null
  fit_score: number
  score_breakdown: ScoreBreakdown
  verdict: 'PREMIUM' | 'LEAD'
  hook: string
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'disqualified'
  notes?: string
  created_by: string // user email
  created_at: string
  updated_at: string
}

export interface Project {
  project_name: string
  token_ticker: string
  chain: string
  contract_address: string
  estimated_mcap: string
  why_good_fit: string
  pain_point: string
  estimated_treasury_size: string
  contact_handle: string
  source_signal: string
  snapshot_vote: string | null
  fit_score: number
  score_breakdown: ScoreBreakdown
  verdict: 'PREMIUM' | 'LEAD'
  hook: string
}

export interface ApiResponse<T = any> {
  ok?: boolean
  data?: T
  text?: string
  error?: string | null
}

export interface Message {
  role: 'user' | 'assistant'
  content: string
}
