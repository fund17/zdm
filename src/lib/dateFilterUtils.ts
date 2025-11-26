/**
 * Date Filter Utilities
 * Shared date filter configurations for different table types
 */

export interface DateFilter {
  startDate: string
  endDate: string
}

/**
 * Get default date filter with 1 week back to tomorrow range
 * Used for Daily Plan table - optimized for bandwidth reduction
 * Loads 7 days back + today + tomorrow = 9 days total
 */
export function getDefaultDateFilter(): DateFilter {
  const today = new Date()
  const oneWeekAgo = new Date(today)
  oneWeekAgo.setDate(today.getDate() - 7)
  const tomorrow = new Date(today)
  tomorrow.setDate(today.getDate() + 1)
  
  return {
    startDate: oneWeekAgo.toISOString().split('T')[0],
    endDate: tomorrow.toISOString().split('T')[0]
  }
}

/**
 * Get empty/null date filter
 * Used for tables without initial date filtering
 */
export function getNoDateFilter(): DateFilter | undefined {
  return undefined
}

/**
 * Get custom date range filter
 */
export function getCustomDateFilter(daysBack: number, daysForward: number): DateFilter {
  const today = new Date()
  const startDate = new Date(today)
  startDate.setDate(today.getDate() - daysBack)
  const endDate = new Date(today)
  endDate.setDate(today.getDate() + daysForward)
  
  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0]
  }
}

/**
 * Get current month date filter
 */
export function getCurrentMonthFilter(): DateFilter {
  const today = new Date()
  const firstDay = new Date(today.getFullYear(), today.getMonth(), 1)
  const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0)
  
  return {
    startDate: firstDay.toISOString().split('T')[0],
    endDate: lastDay.toISOString().split('T')[0]
  }
}
