import { NextRequest, NextResponse } from 'next/server'
import { getSheetsClient } from '@/lib/googleSheets'

export async function GET(request: NextRequest) {
  try {
    // Check if user is admin
    const cookie = request.cookies.get('user_session')
    if (!cookie || !cookie.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userData = JSON.parse(cookie.value)
    if (userData.usertype !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID_USER
    const sheetName = process.env.GOOGLE_SHEET_NAME_USER || 'users'

    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
    }

    const sheets = await getSheetsClient()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    })

    const rows = response.data.values || []
    if (rows.length === 0) {
      return NextResponse.json({ success: true, data: [] })
    }

    const headers = rows[0] as string[]
    const users = rows.slice(1).map((row: any[]) => {
      const user: any = {}
      headers.forEach((header, index) => {
        user[header] = row[index] || ''
      })
      return user
    })

    // Remove password from response
    const safeUsers = users.map((user: any) => ({
      ID: user.ID,
      Email: user.Email,
      Name: user.Name,
      Region: user.Region,
      Role: user.Role,
      IsVerified: user.IsVerified,
      IsActive: user.IsActive,
      registerDate: user.registerDate,
      phoneNo: user.phoneNo,
      departement: user.departement,
      Login: user.Login,
    }))

    return NextResponse.json({
      success: true,
      data: safeUsers,
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch users' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    // Check if user is admin
    const cookie = request.cookies.get('user_session')
    if (!cookie || !cookie.value) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const userData = JSON.parse(cookie.value)
    if (userData.usertype !== 'admin') {
      return NextResponse.json({ error: 'Forbidden - Admin only' }, { status: 403 })
    }

    const { userId, field, value } = await request.json()

    if (!userId || !field || value === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Only allow updating specific fields
    const allowedFields = ['IsActive', 'Role', 'Region']
    if (!allowedFields.includes(field)) {
      return NextResponse.json({ error: 'Invalid field' }, { status: 400 })
    }

    const spreadsheetId = process.env.GOOGLE_SHEET_ID_USER
    const sheetName = process.env.GOOGLE_SHEET_NAME_USER || 'users'

    if (!spreadsheetId) {
      return NextResponse.json({ error: 'Configuration error' }, { status: 500 })
    }

    const sheets = await getSheetsClient()
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId,
      range: `${sheetName}!A:Z`,
    })

    const rows = response.data.values || []
    if (rows.length === 0) {
      return NextResponse.json({ error: 'No users found' }, { status: 404 })
    }

    const headers = rows[0] as string[]
    const idIndex = headers.findIndex(h => h === 'ID')
    const fieldIndex = headers.findIndex(h => h === field)

    if (idIndex === -1 || fieldIndex === -1) {
      return NextResponse.json({ error: 'Invalid column' }, { status: 400 })
    }

    // Find user row
    const rowIndex = rows.findIndex((row: any[]) => row[idIndex] === userId)
    if (rowIndex === -1) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Update the cell
    const columnLetter = String.fromCharCode(65 + fieldIndex)
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: `${sheetName}!${columnLetter}${rowIndex + 1}`,
      valueInputOption: 'RAW',
      requestBody: {
        values: [[value]],
      },
    })

    return NextResponse.json({
      success: true,
      message: 'User updated successfully',
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update user' },
      { status: 500 }
    )
  }
}
