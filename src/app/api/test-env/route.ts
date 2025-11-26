import { NextResponse } from 'next/server'

export async function GET() {
  // Environment test endpoint
  
  return NextResponse.json({
    success: true,
    env: {
      GOOGLE_SHEET_ID_DAILYPLAN: process.env.GOOGLE_SHEET_ID_DAILYPLAN,
      GOOGLE_SHEET_ID_DAILYPLAN_SHEETNAME: process.env.GOOGLE_SHEET_ID_DAILYPLAN_SHEETNAME,
      GOOGLE_SHEET_ID_DAILYPLAN_SHEETSETTING: process.env.GOOGLE_SHEET_ID_DAILYPLAN_SHEETSETTING,
      GOOGLE_SHEET_ID_DAILYPLAN_SHEETMENU: process.env.GOOGLE_SHEET_ID_DAILYPLAN_SHEETMENU,
    },
    allGoogleEnv: Object.fromEntries(
      Object.entries(process.env).filter(([key]) => key.includes('GOOGLE'))
    )
  })
}