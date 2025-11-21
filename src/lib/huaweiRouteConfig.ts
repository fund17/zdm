// Generic factory untuk create API routes ITC & RNO
// Hanya beda environment variable

interface RouteConfig {
  spreadsheetIdEnv: string
  defaultSheetNameEnv: string
  settingSheetNameEnv: string
  sheetSelectionEnv: string
}

export const ITC_CONFIG: RouteConfig = {
  spreadsheetIdEnv: 'GOOGLE_SHEET_ID_HWROLLOUTITC',
  defaultSheetNameEnv: 'GOOGLE_SHEET_NAME_HWROLLOUTITC',
  settingSheetNameEnv: 'GOOGLE_SHEET_NAME_HWROLLOUTITC_SETTING',
  sheetSelectionEnv: 'GOOGLE_SHEET_NAME_HWROLLOUTITC_SHEETSELECTION'
}

export const RNO_CONFIG: RouteConfig = {
  spreadsheetIdEnv: 'GOOGLE_SHEET_ID_HWROLLOUTRNO',
  defaultSheetNameEnv: 'GOOGLE_SHEET_NAME_HWROLLOUTRNO',
  settingSheetNameEnv: 'GOOGLE_SHEET_NAME_HWROLLOUTRNO_SETTING',
  sheetSelectionEnv: 'GOOGLE_SHEET_NAME_HWROLLOUTRNO_SHEETSELECTION'
}

export function getEnvValues(config: RouteConfig) {
  return {
    spreadsheetId: process.env[config.spreadsheetIdEnv],
    defaultSheetName: process.env[config.defaultSheetNameEnv],
    settingSheetName: process.env[config.settingSheetNameEnv] || 'settings',
    sheetSelectionName: process.env[config.sheetSelectionEnv] || 'sheet_list'
  }
}
