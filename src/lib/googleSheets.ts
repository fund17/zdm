import { google } from 'googleapis'

export const getGoogleSheetsAuth = () => {
  const credentials = {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error('Google Sheets credentials are not properly configured')
  }

  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets.readonly',
      'https://www.googleapis.com/auth/spreadsheets'
    ],
  })

  return auth
}

export const getSheetsClient = async () => {
  const auth = getGoogleSheetsAuth()
  const sheets = google.sheets({ version: 'v4', auth })
  return sheets
}

export interface SheetData {
  [key: string]: string | number
}

export const getSheetData = async (
  spreadsheetId: string,
  range: string = 'A:Z'
): Promise<SheetData[]> => {
  try {
    const sheets = await getSheetsClient()
    
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range,
    })

    const rows = response.data.values
    if (!rows || rows.length === 0) {
      return []
    }

    // First row as headers
    const headers = rows[0] as string[]
    const dataRows = rows.slice(1)

    // Convert to array of objects
    const data: SheetData[] = dataRows.map((row: any[]) => {
      const rowData: SheetData = {}
      headers.forEach((header, index) => {
        rowData[header] = row[index] || ''
      })
      return rowData
    })

    return data
  } catch (error) {
    console.error('Error fetching sheet data:', error)
    throw new Error('Failed to fetch data from Google Sheets')
  }
}