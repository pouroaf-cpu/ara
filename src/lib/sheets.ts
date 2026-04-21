import { google } from 'googleapis'

const SHEET_ID = process.env.GOOGLE_SHEET_ID!
const SHEET_NAME = 'Outbound'

function getAuth() {
  return new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  })
}

export type Contact = {
  rowIndex: number
  name: string
  tradeType: string
  phone: string
  mobile: string
  region: string
  pipelineStage: string
  callOutcome: string
  lastCall: string
  nextActionDate: string
  attempts: string
  decisionMaker: string
  notes: string
}

function rowToContact(row: string[], rowIndex: number): Contact {
  return {
    rowIndex,
    name: row[0] || '',
    tradeType: row[1] || '',
    phone: row[2] || '',
    mobile: row[3] || '',
    region: row[4] || '',
    pipelineStage: row[5] || 'Cold',
    callOutcome: row[6] || '',
    lastCall: row[7] || '',
    nextActionDate: row[8] || '',
    attempts: row[9] || '0',
    decisionMaker: row[10] || '',
    notes: row[11] || '',
  }
}

export async function getAllContacts(): Promise<Contact[]> {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A2:L`,
  })
  const rows = res.data.values || []
  return rows.map((row, i) => rowToContact(row, i + 2))
}

export async function updateContact(
  rowIndex: number,
  fields: Partial<Omit<Contact, 'rowIndex'>>
) {
  const auth = getAuth()
  const sheets = google.sheets({ version: 'v4', auth })

  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A${rowIndex}:L${rowIndex}`,
  })
  const currentRow: string[] = res.data.values?.[0] || Array(12).fill('')

  const updated = [...currentRow]
  if (fields.name !== undefined) updated[0] = fields.name
  if (fields.tradeType !== undefined) updated[1] = fields.tradeType
  if (fields.phone !== undefined) updated[2] = fields.phone
  if (fields.mobile !== undefined) updated[3] = fields.mobile
  if (fields.region !== undefined) updated[4] = fields.region
  if (fields.pipelineStage !== undefined) updated[5] = fields.pipelineStage
  if (fields.callOutcome !== undefined) updated[6] = fields.callOutcome
  if (fields.lastCall !== undefined) updated[7] = fields.lastCall
  if (fields.nextActionDate !== undefined) updated[8] = fields.nextActionDate
  if (fields.attempts !== undefined) updated[9] = fields.attempts
  if (fields.decisionMaker !== undefined) updated[10] = fields.decisionMaker
  if (fields.notes !== undefined) updated[11] = fields.notes

  await sheets.spreadsheets.values.update({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_NAME}!A${rowIndex}:L${rowIndex}`,
    valueInputOption: 'USER_ENTERED',
    requestBody: { values: [updated] },
  })
}

