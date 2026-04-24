import { NextRequest, NextResponse } from 'next/server'
import { isAuthenticated } from '@/lib/auth'
import { getUnpaidInvoices } from '@/lib/invoiceSheets'

export async function GET(req: NextRequest) {
  if (!isAuthenticated()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const invoices = await getUnpaidInvoices()
    return NextResponse.json({ invoices })
  } catch (err) {
    console.error('Invoice fetch error:', err)
    return NextResponse.json({ error: 'Failed to load invoices' }, { status: 500 })
  }
}
