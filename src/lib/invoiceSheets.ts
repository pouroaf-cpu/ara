import { google } from 'googleapis'

const SHEET_ID = process.env.INVOICE_SHEET_ID!
const SHEET_TAB = 'Call Queue'

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

// Column indices (0-based)
const CALL_STAGES = [
  { label: 'Pre-Due', colIndex: 11 },  // L
  { label: 'OD 3',   colIndex: 12 },  // M
  { label: 'OD 7',   colIndex: 13 },  // N
  { label: 'OD 10',  colIndex: 14 },  // O
  { label: 'OD 13',  colIndex: 15 },  // P
  { label: 'OD 16',  colIndex: 16 },  // Q
  { label: 'OD 19',  colIndex: 17 },  // R
  { label: 'OD 22',  colIndex: 18 },  // S
  { label: 'OD 25',  colIndex: 19 },  // T
  { label: 'OD 28',  colIndex: 20 },  // U
  { label: 'OD 31',  colIndex: 21 },  // V
  { label: 'OD 34',  colIndex: 22 },  // W
  { label: 'OD 37',  colIndex: 23 },  // X
  { label: 'OD 40',  colIndex: 24 },  // Y
  { label: 'OD 43',  colIndex: 25 },  // Z
  { label: 'OD 46',  colIndex: 26 },  // AA
  { label: 'OD 49',  colIndex: 27 },  // AB
  { label: 'OD 52',  colIndex: 28 },  // AC
  { label: 'OD 55',  colIndex: 29 },  // AD
  { label: 'OD 58',  colIndex: 30 },  // AE
]

export type InvoiceRow = {
  rowIndex: number
  clientName: string
  debtorName: string
  debtorPhone: string
  invoiceNumber: string
  invoiceTotal: string
  amountOwing: string
  amountPaid: string
  invoiceDate: string
  dueDate: string
  paidStatus: string
  initialCall: string
  callDue: string      // AF
  callTypeDue: string  // AG
  callHistory: { label: string; date: string }[]
  // derived
  daysOverdue: number
  currentStage: string
}

function parseDDMMYYYY(s: string): Date | null {
  const parts = s.split('/')
  if (parts.length !== 3) return null
  const [dd, mm, yyyy] = parts.map(Number)
  if (!dd || !mm || !yyyy) return null
  return new Date(yyyy, mm - 1, dd)
}

function rowToInvoice(row: string[], rowIndex: number, today: Date): InvoiceRow {
  const callHistory = CALL_STAGES
    .map(s => ({ label: s.label, date: row[s.colIndex] || '' }))
    .filter(s => s.date)

  const completedStages = CALL_STAGES.filter(s => row[s.colIndex]?.trim())
  const currentStage = completedStages.length > 0
    ? completedStages[completedStages.length - 1].label
    : 'Initial'

  const dueDateParsed = parseDDMMYYYY(row[8] || '')
  const daysOverdue = dueDateParsed
    ? Math.round((today.getTime() - dueDateParsed.getTime()) / 86_400_000)
    : 0

  return {
    rowIndex,
    clientName:   row[0]  || '',
    debtorName:   row[1]  || '',
    debtorPhone:  row[2]  || '',
    invoiceNumber: row[3] || '',
    invoiceTotal:  row[4] || '',
    amountOwing:   row[5] || '',
    amountPaid:    row[6] || '',
    invoiceDate:   row[7] || '',
    dueDate:       row[8] || '',
    paidStatus:    row[9] || '',
    initialCall:   row[10] || '',
    callDue:       row[31] || '',  // AF
    callTypeDue:   row[32] || '',  // AG
    callHistory,
    daysOverdue,
    currentStage,
  }
}

export async function getUnpaidInvoices(): Promise<InvoiceRow[]> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A2:AG`,
  })

  const rows = res.data.values || []
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  return rows
    .map((row, i) => rowToInvoice(row, i + 2, today))
    .filter(inv => inv.paidStatus !== 'Paid' && inv.invoiceNumber)
    .sort((a, b) => b.daysOverdue - a.daysOverdue)
}
