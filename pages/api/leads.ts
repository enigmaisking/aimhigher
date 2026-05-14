// pages/api/leads.ts
// Lead CRM endpoints (Create, Read, Update, Delete)
// Persists leads to Airtable with user attribution

import { NextApiRequest, NextApiResponse } from 'next'
import { airtableClient } from '../../src/lib/airtable-client'
import { withAuth } from '../../src/lib/auth'
import { Lead, ApiResponse } from '../../src/lib/types'

async function handler(req: NextApiRequest, res: NextApiResponse<ApiResponse>) {
  const session = (req as any).session

  // GET /api/leads — Fetch all leads
  if (req.method === 'GET') {
    try {
      const leads = await airtableClient.getLeads()
      return res.status(200).json({
        ok: true,
        data: { leads, count: leads.length },
      })
    } catch (error: any) {
      console.error('[Leads GET Error]', error)
      return res.status(500).json({
        ok: false,
        error: error.message || 'Failed to fetch leads',
      })
    }
  }

  // POST /api/leads — Create a new lead
  if (req.method === 'POST') {
    try {
      const lead = req.body as Omit<Lead, 'id'>

      // Validate required fields
      if (!lead.project_name || !lead.token_ticker || !lead.chain) {
        return res.status(400).json({
          ok: false,
          error: 'Missing required fields: project_name, token_ticker, chain',
        })
      }

      if (typeof lead.fit_score !== 'number' || lead.fit_score < 0 || lead.fit_score > 10) {
        return res.status(400).json({
          ok: false,
          error: 'fit_score must be a number between 0 and 10',
        })
      }

      // Add user context
      const leadWithUser = {
        ...lead,
        created_by: session.email,
        status: (lead.status || 'new') as Lead['status'],
      }

      const recordId = await airtableClient.createLead(leadWithUser)

      console.log(
        `[CRM] Lead saved: ${lead.project_name} ($${lead.token_ticker}) by ${session.email}`
      )

      return res.status(201).json({
        ok: true,
        data: { id: recordId, message: 'Lead saved to Airtable' },
      })
    } catch (error: any) {
      console.error('[Leads POST Error]', error)
      return res.status(500).json({
        ok: false,
        error: error.message || 'Failed to save lead',
      })
    }
  }

  // PATCH /api/leads — Update a lead
  if (req.method === 'PATCH') {
    try {
      const { id, ...updates } = req.body

      if (!id) {
        return res.status(400).json({
          ok: false,
          error: 'Lead ID required',
        })
      }

      await airtableClient.updateLead(id, updates)

      console.log(`[CRM] Lead updated: ${id} by ${session.email}`)

      return res.status(200).json({
        ok: true,
        data: { message: 'Lead updated' },
      })
    } catch (error: any) {
      console.error('[Leads PATCH Error]', error)
      return res.status(500).json({
        ok: false,
        error: error.message || 'Failed to update lead',
      })
    }
  }

  // DELETE /api/leads — Delete a lead
  if (req.method === 'DELETE') {
    try {
      const { id } = req.body

      if (!id) {
        return res.status(400).json({
          ok: false,
          error: 'Lead ID required',
        })
      }

      await airtableClient.deleteLead(id)

      console.log(`[CRM] Lead deleted: ${id} by ${session.email}`)

      return res.status(200).json({
        ok: true,
        data: { message: 'Lead deleted' },
      })
    } catch (error: any) {
      console.error('[Leads DELETE Error]', error)
      return res.status(500).json({
        ok: false,
        error: error.message || 'Failed to delete lead',
      })
    }
  }

  return res.status(405).json({ ok: false, error: 'Method not allowed' })
}

export default withAuth(handler)
