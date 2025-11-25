import { NextRequest, NextResponse } from 'next/server'
import { google } from 'googleapis'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sheetId = searchParams.get('sheetId')

    // Initialize Google Auth
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_CLIENT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets.readonly',
        'https://www.googleapis.com/auth/drive.readonly',
      ],
    })

    const authClient = await auth.getClient()
    const drive = google.drive({ version: 'v3', auth: authClient as any })
    const sheets = google.sheets({ version: 'v4', auth: authClient as any })

    const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID_CLOCKREPORT

    if (!folderId) {
      return NextResponse.json(
        { error: 'GOOGLE_DRIVE_FOLDER_ID_CLOCKREPORT not configured' },
        { status: 500 }
      )
    }

    // If sheetId is provided, fetch data from that specific sheet
    if (sheetId) {
      // Get all sheet tabs in the spreadsheet
      const spreadsheet = await sheets.spreadsheets.get({
        spreadsheetId: sheetId,
      })

      const sheetTabs = spreadsheet.data.sheets || []
      const allData: any[] = []

      // Fetch data from all tabs
      for (const tab of sheetTabs) {
        const tabName = tab.properties?.title
        if (!tabName) continue

        try {
          const response = await sheets.spreadsheets.values.get({
            spreadsheetId: sheetId,
            range: `${tabName}!A:Z`,
          })

          const rows = response.data.values || []
          if (rows.length === 0) continue

          const headers = rows[0]
          const dataRows = rows.slice(1)

          const formattedData = dataRows.map((row: any[]) => {
            const rowData: any = { _sheet: tabName }
            headers.forEach((header: string, index: number) => {
              rowData[header] = row[index] || ''
            })
            return rowData
          })

          allData.push(...formattedData)
        } catch (error) {
          // Silent catch
        }
      }

      return NextResponse.json({ data: allData })
    }

    // List all Clock Detail Report sheets in the folder (including subfolders)
    try {
      // Function to recursively get all subfolders
      const getAllFolderIds = async (parentFolderId: string): Promise<string[]> => {
        const folderIds = [parentFolderId]
        
        const subfolders = await drive.files.list({
          q: `'${parentFolderId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`,
          fields: 'files(id, name)',
          pageSize: 100,
        })

        if (subfolders.data.files && subfolders.data.files.length > 0) {
          for (const folder of subfolders.data.files) {
            if (folder.id) {
              const childFolderIds = await getAllFolderIds(folder.id)
              folderIds.push(...childFolderIds)
            }
          }
        }
        
        return folderIds
      }

      // Get all folder IDs including subfolders
      const allFolderIds = await getAllFolderIds(folderId)

      // Search for spreadsheets in all folders
      const allFiles: any[] = []
      
      for (const fid of allFolderIds) {
        const response = await drive.files.list({
          q: `'${fid}' in parents and mimeType='application/vnd.google-apps.spreadsheet' and trashed=false`,
          fields: 'files(id, name, createdTime, modifiedTime)',
          orderBy: 'modifiedTime desc',
          pageSize: 100,
        })
        
        if (response.data.files && response.data.files.length > 0) {
          allFiles.push(...response.data.files)
        }
      }

      // Filter for Clock Detail Report files
      const clockReportFiles = allFiles.filter(file => 
        file.name?.toLowerCase().includes('clock') && 
        file.name?.toLowerCase().includes('detail')
      )

      const sheetList = clockReportFiles.map((file) => ({
        id: file.id,
        name: file.name,
        createdTime: file.createdTime,
        modifiedTime: file.modifiedTime,
      }))

      return NextResponse.json({ 
        sheets: sheetList,
        debug: {
          totalFolders: allFolderIds.length,
          totalFiles: allFiles.length,
          filteredFiles: clockReportFiles.length,
          serviceAccount: process.env.GOOGLE_CLIENT_EMAIL
        }
      })
    } catch (listError: any) {
      return NextResponse.json({
        sheets: [],
        error: 'Failed to access folder',
        details: listError.message
      })
    }
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch clock reports', details: error.message },
      { status: 500 }
    )
  }
}
