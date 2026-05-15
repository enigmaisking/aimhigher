import type { User } from './types'

const AIRTABLE_PAT = process.env.AIRTABLE_PAT
const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID
const AIRTABLE_LEADS_TABLE_ID = process.env.AIRTABLE_LEADS_TABLE_ID
const AIRTABLE_USERS_TABLE_ID = process.env.AIRTABLE_USERS_TABLE_ID

// Map internal chain values to Airtable Single select labels
const CHAIN_TO_AIRTABLE: Record<string, string> = {
  eth: 'Ethereum',
  ethereum: 'Ethereum',
  solana: 'Solana',
  bsc: 'BNB',
  bnb: 'BNB',
  base: 'Base',
  avax: 'AVAX',
  avalanche: 'AVAX',
  arbitrum: 'Arbitrum',
  'polygon-pos': 'Polygon',
  polygon: 'Polygon',
  optimism: 'Optimism',
  fantom: 'Fantom',
}

const BASE_URL = 'https://api.airtable.com/v0'

async function fetchAirtable(method: string, path: string, data?: any) {
  if (!AIRTABLE_PAT || !AIRTABLE_BASE_ID) {
    throw new Error('Airtable credentials not configured')
  }

  const url = `${BASE_URL}/${AIRTABLE_BASE_ID}${path}`
  const options: RequestInit = {
    method,
    headers: {
      'Authorization': `Bearer ${AIRTABLE_PAT}`,
      'Content-Type': 'application/json',
    },
  }

  if (data) {
    options.body = JSON.stringify(data)
  }

  const response = await fetch(url, options)
  
  if (!response.ok) {
    const errorText = await response.text()
    console.error(`[Airtable] ${method} ${path} failed:`, response.status, errorText)
    throw new Error(`Airtable error: ${response.status} - ${errorText}`)
  }

  return response.json()
}

// Fields that should NOT be sent (linked records, formulas, etc.)
const SKIP_FIELDS = new Set([
  'id',
  'created_at',
  'updated_at',
  'createdTime',
  'updatedTime',
])

export const airtableClient = {
  async getUserByEmail(email: string): Promise<User | null> {
    if (!AIRTABLE_USERS_TABLE_ID) return null
    try {
      const response = await fetchAirtable(
        'GET',
        `/${AIRTABLE_USERS_TABLE_ID}?filterByFormula={email}="${email}"`
      )
      const records = response.records || []
      if (records.length === 0) return null
      const record = records[0]
      return {
        id: record.id,
        email: record.fields.email,
        name: record.fields.name,
        password_hash: record.fields.password_hash,
        created_at: record.createdTime,
        updated_at: record.createdTime,
      }
    } catch (err) {
      console.error('[Airtable] getUserByEmail error:', err)
      return null
    }
  },

  async createUser(email: string, name: string, passwordHash: string): Promise<User> {
    if (!AIRTABLE_USERS_TABLE_ID) throw new Error('Users table ID not configured')
    const response = await fetchAirtable('POST', `/${AIRTABLE_USERS_TABLE_ID}`, {
      records: [{ fields: { email, name, password_hash: passwordHash } }],
    })
    const record = response.records?.[0]
    if (!record) throw new Error('Failed to create user in Airtable')
    return {
      id: record.id,
      email: record.fields.email,
      name: record.fields.name,
      password_hash: record.fields.password_hash,
      created_at: record.createdTime,
      updated_at: record.createdTime,
    }
  },

  async createLead(lead: any): Promise<any> {
    if (!AIRTABLE_LEADS_TABLE_ID) throw new Error('Leads table ID not configured')
    
    // Build only non-empty fields, skip linked records
    const fields: Record<string, any> = {}
    
    const fieldMap: Record<string, string> = {
      project_name: 'project_name',
      token_ticker: 'token_ticker',
      chain: 'chain',
      contract_address: 'contract_address',
      estimated_mcap: 'estimated_mcap',
      why_good_fit: 'why_good_fit',
      pain_point: 'pain_point',
      estimated_treasury_size: 'estimated_treasury_size',
      contact_handle: 'contact_handle',
      source_signal: 'source_signal',
      snapshot_vote: 'snapshot_vote',
      fit_score: 'fit_score',
      score_breakdown_json: 'score_breakdown_json',
      verdict: 'verdict',
      hook: 'hook',
      status: 'status',
      created_by: 'created_by',
      notes: 'notes',
    }

    Object.entries(fieldMap).forEach(([key, airtableField]) => {
      let value = lead[key]
      
      // Skip if not provided or should be skipped
      if (SKIP_FIELDS.has(airtableField)) return
      if (value === undefined || value === null || value === '') return
      
      // Map chain to Airtable Single select label
      if (airtableField === 'chain') {
        value = CHAIN_TO_AIRTABLE[String(value).toLowerCase().trim()] || String(value)
      }
      
      // Clean token_ticker: strip $ prefix and  / suffix
      if (airtableField === 'token_ticker') {
        value = String(value).replace(/^\$/, '').replace(/\/.*$/, '').trim()
      }
      
      // Type coercion
      if (airtableField === 'fit_score') {
        fields[airtableField] = Number(value)
      } else {
        fields[airtableField] = String(value)
      }
    })

    console.log('[Airtable] Creating lead with fields:', Object.keys(fields).join(', '))

    try {
      const response = await fetchAirtable('POST', `/${AIRTABLE_LEADS_TABLE_ID}`, {
        records: [{ fields }]
      })
      console.log('[Airtable] Lead created successfully')
      return response.records?.[0] || null
    } catch (err) {
      console.error('[Airtable] createLead error:', err)
      console.error('[Airtable] Fields attempted:', JSON.stringify(fields, null, 2))
      throw err
    }
  },

  async getLeads(): Promise<any[]> {
    if (!AIRTABLE_LEADS_TABLE_ID) return []
    try {
      const response = await fetchAirtable('GET', `/${AIRTABLE_LEADS_TABLE_ID}`)
      return response.records || []
    } catch (err) {
      console.error('[Airtable] getLeads error:', err)
      return []
    }
  },

  async findLeadByContract(contractAddress: string, chain?: string): Promise<{ id: string; fields: Record<string, any> } | null> {
    if (!AIRTABLE_LEADS_TABLE_ID || !contractAddress) return null
    try {
      let formula = `{contract_address}="${contractAddress}"`
      if (chain) {
        const mapped = CHAIN_TO_AIRTABLE[chain.toLowerCase().trim()] || chain
        formula = `AND(${formula},{chain}="${mapped}")`
      }
      const response = await fetchAirtable(
        'GET',
        `/${AIRTABLE_LEADS_TABLE_ID}?filterByFormula=${encodeURIComponent(formula)}&maxRecords=1`
      )
      return response.records?.[0] || null
    } catch (err) {
      console.warn('[Airtable] findLeadByContract error:', err)
      return null
    }
  },

  async findLeadByNameChain(projectName: string, chain: string): Promise<{ id: string; fields: Record<string, any> } | null> {
    if (!AIRTABLE_LEADS_TABLE_ID) return null
    try {
      const safeName = projectName.replace(/"/g, '\\"')
      const airtableChain = CHAIN_TO_AIRTABLE[chain.toLowerCase().trim()] || chain
      const response = await fetchAirtable(
        'GET',
        `/${AIRTABLE_LEADS_TABLE_ID}?filterByFormula=AND({project_name}="${safeName}",{chain}="${airtableChain}")&maxRecords=1`
      )
      return response.records?.[0] || null
    } catch (err) {
      console.warn('[Airtable] findLeadByNameChain error:', err)
      return null
    }
  },

  async updateLead(id: string, updates: any): Promise<any> {
    if (!AIRTABLE_LEADS_TABLE_ID) throw new Error('Leads table ID not configured')
    
    const fields: Record<string, any> = {}
    Object.entries(updates).forEach(([key, value]) => {
      if (SKIP_FIELDS.has(key)) return
      if (value !== undefined && value !== null && value !== '') {
        if (key === 'chain') value = CHAIN_TO_AIRTABLE[String(value).toLowerCase().trim()] || String(value)
        fields[key] = value
      }
    })
    
    try {
      const response = await fetchAirtable('PATCH', `/${AIRTABLE_LEADS_TABLE_ID}`, {
        records: [{ id, fields }]
      })
      return response.records?.[0] || null
    } catch (err) {
      console.error('[Airtable] updateLead error:', err)
      throw err
    }
  },

  async deleteLead(id: string): Promise<boolean> {
    if (!AIRTABLE_LEADS_TABLE_ID) return false
    try {
      await fetchAirtable('DELETE', `/${AIRTABLE_LEADS_TABLE_ID}/${id}`)
      return true
    } catch (err) {
      console.error('[Airtable] deleteLead error:', err)
      return false
    }
  },
}
