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
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.readonly',
      'https://www.googleapis.com/auth/drive.metadata.readonly'
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

export const getSheetMetadata = async (
  spreadsheetId: string
): Promise<{ modifiedTime?: string }> => {
  try {
    const auth = getGoogleSheetsAuth()
    const drive = google.drive({ version: 'v3', auth })
    
    const response = await drive.files.get({
      fileId: spreadsheetId,
      fields: 'modifiedTime'
    })
    
    return {
      modifiedTime: response.data.modifiedTime || undefined
    }
  } catch (error) {
    return {}
  }
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
      // Use UNFORMATTED_VALUE to get raw values including serial dates
      valueRenderOption: 'UNFORMATTED_VALUE',
    })

    const rows = response.data.values
    if (!rows || rows.length === 0) {
      return []
    }

    // First row as headers
    const headers = rows[0] as string[]
    const dataRows = rows.slice(1)

    // Convert to array of objects
    const data: SheetData[] = dataRows
      .filter((row: any[]) => {
        // Skip completely empty rows
        return row && row.some(cell => cell !== undefined && cell !== null && cell !== '')
      })
      .map((row: any[]) => {
        const rowData: SheetData = {}
        headers.forEach((header, index) => {
          // Ensure each column gets its value, even if empty
          // This preserves the column alignment
          const cellValue = row[index]
          rowData[header] = cellValue !== undefined && cellValue !== null ? cellValue : ''
        })
        return rowData
      })

    return data
  } catch (error) {
    throw new Error('Failed to fetch data from Google Sheets')
  }
}

// ==================== USER MANAGEMENT ====================

export interface User {
  ID: string
  Email: string
  Name: string
  Password: string
  Region: string
  Role: string
  IsVerified: string
  IsActive: string
  registerDate: string
  phoneNo: string
  departement: string
  Login: string
}

/**
 * Get user by email from Users sheet
 */
export const getUserByEmail = async (email: string): Promise<User | null> => {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_USER
    const sheetName = process.env.GOOGLE_SHEET_NAME_USER || 'users'
    
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID_USER not configured')
    }

    const sheets = await getSheetsClient()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`, // Get all columns
    })

    const rows = response.data.values
    if (!rows || rows.length === 0) return null

    const headers = rows[0] as string[]
    const dataRows = rows.slice(1)

    // Create column index map from headers
    const getColumnIndex = (columnName: string): number => {
      return headers.findIndex(h => h === columnName)
    }

    const emailIndex = getColumnIndex('Email')
    if (emailIndex === -1) {
      throw new Error('Email column not found in sheet')
    }

    // Find row by email
    const userRow = dataRows.find((row: any[]) => 
      row[emailIndex]?.toLowerCase() === email.toLowerCase()
    )
    if (!userRow) return null

    // Map columns dynamically based on headers
    return {
      ID: userRow[getColumnIndex('ID')] || '',
      Email: userRow[getColumnIndex('Email')] || '',
      Name: userRow[getColumnIndex('Name')] || '',
      Password: userRow[getColumnIndex('Password')] || '',
      Region: userRow[getColumnIndex('Region')] || '',
      Role: userRow[getColumnIndex('Role')] || '',
      IsVerified: userRow[getColumnIndex('IsVerified')] || '',
      IsActive: userRow[getColumnIndex('IsActive')] || '',
      registerDate: userRow[getColumnIndex('registerDate')] || '',
      phoneNo: userRow[getColumnIndex('phoneNo')] || '',
      departement: userRow[getColumnIndex('departement')] || '',
      Login: userRow[getColumnIndex('Login')] || '',
    }
  } catch (error) {
    return null
  }
}

/**
 * Create new user in Users sheet
 */
export const createUser = async (
  email: string,
  name: string,
  hashedPassword: string,
  region: string = ''
): Promise<void> => {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_USER
    const sheetName = process.env.GOOGLE_SHEET_NAME_USER || 'users'
    
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID_USER not configured')
    }

    const sheets = await getSheetsClient()
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9)
    const now = new Date()
    const registerDate = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: 'numeric' })
    const loginTimestamp = now.toISOString()

    // ID, Email, Name, Password, Region, Role, IsVerified, IsActive, registerDate, phoneNo, departement, Login
    const rowData = [
      id,                  // ID
      email,              // Email
      name,               // Name
      hashedPassword,     // Password
      region,             // Region
      'user',             // Role
      'yes',              // IsVerified
      'no',               // IsActive (pending activation by admin)
      registerDate,       // registerDate
      '',                 // phoneNo
      '',                 // departement
      loginTimestamp      // Login
    ]

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:L`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [rowData],
      },
    })

  } catch (error) {
    console.error('Error creating user:', error)
    throw new Error(`Failed to create user: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// ==================== VERIFICATION CODES ====================

export interface VerificationCode {
  ID: string
  Email: string
  Code: string
  Type: string
  ExpiresAt: string
  UsedAt: string
  CreatedAt: string
}

/**
 * Create verification code
 */
export const createVerificationCode = async (
  email: string,
  code: string,
  type: 'registration' | 'password_reset'
): Promise<void> => {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_USER
    const sheetName = process.env.GOOGLE_SHEET_NAME_VERIFICATIONCODES || 'verificationCodes'
    
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID_USER not configured')
    }

    const sheets = await getSheetsClient()
    const id = Date.now().toString() + Math.random().toString(36).substring(2, 9)
    const now = new Date()
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000) // 15 minutes

    await sheets.spreadsheets.values.append({
      spreadsheetId,
      range: `${sheetName}!A:G`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[
          id,
          email,
          code,
          type,
          expiresAt.toISOString(),
          '', // UsedAt
          now.toISOString(), // CreatedAt
        ]],
      },
    })

  } catch (error) {
    throw new Error('Failed to create verification code')
  }
}

/**
 * Get valid verification code
 */
export const getVerificationCode = async (
  email: string,
  code: string
): Promise<VerificationCode | null> => {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_USER
    const sheetName = process.env.GOOGLE_SHEET_NAME_VERIFICATIONCODES || 'verificationCodes'
    
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID_USER not configured')
    }

    const sheets = await getSheetsClient()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:G`,
    })

    const rows = response.data.values
    if (!rows || rows.length === 0) return null

    const dataRows = rows.slice(1)
    const now = new Date()

    // Find valid code: matching email & code, not used, not expired
    const codeRow = dataRows.find((row: any[]) => {
      const isMatchingEmail = row[1]?.toLowerCase() === email.toLowerCase()
      const isMatchingCode = row[2] === code
      const isNotUsed = !row[5] // UsedAt is empty
      const isNotExpired = new Date(row[4]) > now

      return isMatchingEmail && isMatchingCode && isNotUsed && isNotExpired
    })

    if (!codeRow) return null

    return {
      ID: codeRow[0] || '',
      Email: codeRow[1] || '',
      Code: codeRow[2] || '',
      Type: codeRow[3] || '',
      ExpiresAt: codeRow[4] || '',
      UsedAt: codeRow[5] || '',
      CreatedAt: codeRow[6] || '',
    }
  } catch (error) {
    return null
  }
}

/**
 * Mark verification code as used
 */
export const markCodeAsUsed = async (email: string, code: string): Promise<void> => {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_USER
    const sheetName = process.env.GOOGLE_SHEET_NAME_VERIFICATIONCODES || 'verificationCodes'
    
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID_USER not configured')
    }

    const sheets = await getSheetsClient()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:G`,
    })

    const rows = response.data.values
    if (!rows || rows.length === 0) return

    // Find row index (add 1 for header, add 1 for 1-based index)
    const dataRows = rows.slice(1)
    const rowIndex = dataRows.findIndex(
      (row: any[]) => row[1]?.toLowerCase() === email.toLowerCase() && row[2] === code
    )

    if (rowIndex === -1) return

    const sheetRowNumber = rowIndex + 2 // +1 for header, +1 for 0-based to 1-based

    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!F${sheetRowNumber}`, // UsedAt column
      valueInputOption: 'RAW',
      requestBody: {
        values: [[new Date().toISOString()]],
      },
    })

  } catch (error) {
    throw new Error('Failed to mark code as used')
  }
}

// ==================== RATE LIMITING ====================

export interface RateLimit {
  Email: string
  IP: string
  AttemptCount: number
  LastAttempt: string
  BlockedUntil: string
}

/**
 * Check and update rate limit
 */
export const checkRateLimit = async (
  email: string,
  ip: string
): Promise<{ allowed: boolean; remainingAttempts: number; blockedUntil?: string }> => {
  try {
    const spreadsheetId = process.env.GOOGLE_SHEET_ID_USER
    const sheetName = process.env.GOOGLE_SHEET_NAME_RATELIMITS || 'rateLimits'
    
    if (!spreadsheetId) {
      throw new Error('GOOGLE_SHEET_ID_USER not configured')
    }

    const sheets = await getSheetsClient()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:E`,
    })

    const rows = response.data.values || []
    const dataRows = rows.slice(1)
    const now = new Date()
    const maxAttempts = 5
    const blockDuration = 60 * 60 * 1000 // 1 hour
    const resetDuration = 15 * 60 * 1000 // 15 minutes

    // Find existing rate limit entry
    const existingIndex = dataRows.findIndex(
      (row: any[]) => row[0]?.toLowerCase() === email.toLowerCase()
    )

    if (existingIndex === -1) {
      // No rate limit entry, create new one
      await sheets.spreadsheets.values.append({
        spreadsheetId,
        range: `${sheetName}!A:E`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[email, ip, 1, now.toISOString(), '']],
        },
      })
      return { allowed: true, remainingAttempts: maxAttempts - 1 }
    }

    const existingRow = dataRows[existingIndex]
    const attemptCount = parseInt(existingRow[2] || '0')
    const lastAttempt = new Date(existingRow[3])
    const blockedUntil = existingRow[4] ? new Date(existingRow[4]) : null

    // Check if still blocked
    if (blockedUntil && blockedUntil > now) {
      return {
        allowed: false,
        remainingAttempts: 0,
        blockedUntil: blockedUntil.toISOString(),
      }
    }

    // Reset if last attempt was more than 15 minutes ago
    if (now.getTime() - lastAttempt.getTime() > resetDuration) {
      const sheetRowNumber = existingIndex + 2
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${sheetRowNumber}:E${sheetRowNumber}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[email, ip, 1, now.toISOString(), '']],
        },
      })
      return { allowed: true, remainingAttempts: maxAttempts - 1 }
    }

    // Increment attempt count
    const newAttemptCount = attemptCount + 1
    const sheetRowNumber = existingIndex + 2

    if (newAttemptCount >= maxAttempts) {
      // Block user
      const newBlockedUntil = new Date(now.getTime() + blockDuration)
      await sheets.spreadsheets.values.update({
        spreadsheetId,
        range: `${sheetName}!A${sheetRowNumber}:E${sheetRowNumber}`,
        valueInputOption: 'RAW',
        requestBody: {
          values: [[email, ip, newAttemptCount, now.toISOString(), newBlockedUntil.toISOString()]],
        },
      })
      return {
        allowed: false,
        remainingAttempts: 0,
        blockedUntil: newBlockedUntil.toISOString(),
      }
    }

    // Update attempt count
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!A${sheetRowNumber}:E${sheetRowNumber}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[email, ip, newAttemptCount, now.toISOString(), '']],
      },
    })

    return {
      allowed: true,
      remainingAttempts: maxAttempts - newAttemptCount,
    }
  } catch (error) {
    // Allow on error to prevent blocking legitimate users
    return { allowed: true, remainingAttempts: 5 }
  }
}