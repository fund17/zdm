import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

// Initialize Google Sheets API
const auth = new google.auth.GoogleAuth({
  credentials: {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
  },
  scopes: ['https://www.googleapis.com/auth/spreadsheets'],
})

const sheets = google.sheets({ version: 'v4', auth })

const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID_USER!
const SHEET_NAME = process.env.GOOGLE_SHEET_NAME_ROLEPERMISSION || 'rolePermission'

// Helper function to check user permission
async function checkUserPermission(userRole: string): Promise<boolean> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:Z`,
    })

    const rows = response.data.values || []
    if (rows.length === 0) return false

    const headers = rows[0]
    const userManagementIndex = headers.findIndex((h: string) => 
      h.toLowerCase().includes('user') && h.toLowerCase().includes('management')
    )

    if (userManagementIndex === -1) return false

    const roleRow = rows.find((row: string[], index) => 
      index > 0 && row[0]?.toLowerCase().trim() === userRole.toLowerCase().trim()
    )

    if (!roleRow) return false

    const permission = (roleRow[userManagementIndex] || 'no').toLowerCase()
    return permission === 'edit'
  } catch (error) {

    return false
  }
}

// GET - Fetch all role permissions
export async function GET(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('user_session')

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    let session: any
    try {
      session = JSON.parse(sessionCookie.value)
    } catch (parseError) {
      return NextResponse.json(
        { success: false, message: 'Invalid session format' },
        { status: 401 }
      )
    }

    const userRole = session.role || session.usertype || ''
    
    if (!userRole) {
      return NextResponse.json(
        { success: false, message: 'No role found in session' },
        { status: 401 }
      )
    }
    
    const hasPermission = await checkUserPermission(userRole)
    
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, message: 'Access denied. You need edit permission for User Management.' },
        { status: 403 }
      )
    }

    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:Z`,
    })

    const rows = response.data.values || []
    
    if (rows.length === 0) {
      return NextResponse.json({
        success: true,
        permissions: [],
      })
    }

    const headers = rows[0]
    const menus = headers.slice(1)
    const permissions: any[] = []
    
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i]
      const role = row[0]
      
      if (!role) continue
      
      for (let j = 1; j < headers.length; j++) {
        const menu = headers[j]
        const permission = (row[j] || 'no').toLowerCase()
        
        permissions.push({
          Role: role,
          Menu: menu,
          Permission: permission as 'no' | 'read' | 'edit',
        })
      }
    }
    
    return NextResponse.json({
      success: true,
      permissions,
    })
  } catch (error) {

    return NextResponse.json(
      { success: false, message: 'Failed to fetch role permissions' },
      { status: 500 }
    )
  }
}

// PATCH - Update a role permission
export async function PATCH(request: NextRequest) {
  try {
    const sessionCookie = request.cookies.get('user_session')

    if (!sessionCookie || !sessionCookie.value) {
      return NextResponse.json(
        { success: false, message: 'Unauthorized - No session found' },
        { status: 401 }
      )
    }

    let session: any
    try {
      session = JSON.parse(sessionCookie.value)
    } catch (parseError) {
      return NextResponse.json(
        { success: false, message: 'Invalid session format' },
        { status: 401 }
      )
    }

    const userRole = session.role || session.usertype || ''
    const hasPermission = await checkUserPermission(userRole)
    
    if (!hasPermission) {
      return NextResponse.json(
        { success: false, message: 'Access denied. You need edit permission for User Management.' },
        { status: 403 }
      )
    }

    const { role, menu, permission } = await request.json()

    if (!role || !menu || !permission) {
      return NextResponse.json(
        { success: false, message: 'Role, menu, and permission are required' },
        { status: 400 }
      )
    }

    if (!['no', 'read', 'edit'].includes(permission)) {
      return NextResponse.json(
        { success: false, message: 'Permission must be "no", "read", or "edit"' },
        { status: 400 }
      )
    }

    // Fetch all data to find the row to update
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${SHEET_NAME}!A:Z`,
    })

    const rows = response.data.values || []
    
    if (rows.length === 0) {
      return NextResponse.json({
        success: false,
        message: 'No data found in sheet',
      }, { status: 404 })
    }

    const headers = rows[0]
    
    // Find column index for the menu
    const menuColumnIndex = headers.findIndex((h: string) => h === menu)
    if (menuColumnIndex === -1) {
      return NextResponse.json({
        success: false,
        message: `Menu column "${menu}" not found`,
      }, { status: 404 })
    }

    // Find row index for the role
    const roleRowIndex = rows.findIndex((row: string[], index) => 
      index > 0 && row[0]?.toLowerCase() === role.toLowerCase()
    )

    if (roleRowIndex === -1) {
      return NextResponse.json({
        success: false,
        message: `Role "${role}" not found`,
      }, { status: 404 })
    }

    // Update the permission value (rowIndex + 1 because sheets are 1-indexed)
    const columnLetter = String.fromCharCode(65 + menuColumnIndex) // Convert index to column letter (A, B, C, etc.)
    const cellRange = `${SHEET_NAME}!${columnLetter}${roleRowIndex + 1}`

    await sheets.spreadsheets.values.update({
      spreadsheetId: SPREADSHEET_ID,
      range: cellRange,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[permission]],
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Permission updated successfully',
    })
  } catch (error) {

    return NextResponse.json(
      { success: false, message: 'Failed to update role permission' },
      { status: 500 }
    )
  }
}
