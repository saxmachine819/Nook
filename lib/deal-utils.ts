import { DealType, Deal } from "@prisma/client"

interface EligibilityJson {
  minHours?: number
  percentOff?: number
  amountOff?: number
  minSpend?: number
  daysOfWeek?: string[]
  startTime?: string
  endTime?: string
  itemName?: string
  appliesTo?: string
}

/**
 * Format a compact eligibility summary for display on deal cards
 */
export function formatEligibilitySummary(deal: Deal): string {
  const eligibility = (deal.eligibilityJson as EligibilityJson) || {}
  const parts: string[] = []

  // Time window
  if (eligibility.daysOfWeek && eligibility.daysOfWeek.length > 0 && eligibility.startTime && eligibility.endTime) {
    const dayAbbrevs: Record<string, string> = {
      MON: "Mon",
      TUE: "Tue",
      WED: "Wed",
      THU: "Thu",
      FRI: "Fri",
      SAT: "Sat",
      SUN: "Sun",
    }

    const days = eligibility.daysOfWeek.map((d) => dayAbbrevs[d] || d).join("–")
    const startTime = formatTime(eligibility.startTime)
    const endTime = formatTime(eligibility.endTime)
    parts.push(`${days} ${startTime}–${endTime}`)
  }

  // Percent off
  if (eligibility.percentOff) {
    parts.push(`${eligibility.percentOff}% off`)
  }

  // Amount off
  if (eligibility.amountOff) {
    if (eligibility.minSpend) {
      parts.push(`$${eligibility.amountOff} off $${eligibility.minSpend}+`)
    } else {
      parts.push(`$${eligibility.amountOff} off`)
    }
  }

  // Min hours
  if (eligibility.minHours) {
    parts.push(`${eligibility.minHours}+ hrs`)
  }

  // If no specific eligibility, return empty string
  if (parts.length === 0) {
    return ""
  }

  return parts.join(" • ")
}

/**
 * Format time string (HH:MM) to 12-hour format
 */
function formatTime(timeStr: string): string {
  try {
    const [hours, minutes] = timeStr.split(":").map(Number)
    const hour12 = hours % 12 || 12
    const ampm = hours < 12 ? "am" : "pm"
    return `${hour12}:${minutes.toString().padStart(2, "0")}${ampm}`
  } catch {
    return timeStr
  }
}

/**
 * Generate a description sentence based on deal type and form data
 */
export function generateDescription(
  type: DealType,
  data: {
    itemName?: string
    minHours?: number
    percentOff?: number
    appliesTo?: string
    amountOff?: number
    minSpend?: number
    daysOfWeek?: string[]
    startTime?: string
    endTime?: string
  }
): string {
  switch (type) {
    case DealType.FREE_ITEM: {
      const { itemName, minHours } = data
      if (!itemName) return "Free item with booking."
      if (minHours) {
        return `Book ${minHours} hour${minHours !== 1 ? "s" : ""} and get 1 free ${itemName}.`
      }
      return `Get 1 free ${itemName} with any booking.`
    }

    case DealType.PERCENT_OFF: {
      const { percentOff, appliesTo, minHours } = data
      if (!percentOff) return "Percentage discount available."
      let desc = `${percentOff}% off`
      if (appliesTo) {
        desc += ` ${appliesTo}`
      }
      if (minHours) {
        desc += ` when booking ${minHours}+ hours`
      }
      return desc + "."
    }

    case DealType.AMOUNT_OFF: {
      const { amountOff, minSpend, minHours } = data
      if (!amountOff) return "Amount discount available."
      let desc = `$${amountOff} off`
      if (minSpend) {
        desc += ` when you spend $${minSpend}+`
      }
      if (minHours) {
        desc += ` and book ${minHours}+ hours`
      }
      return desc + "."
    }

    case DealType.TIME_WINDOW: {
      const { daysOfWeek, startTime, endTime, itemName, percentOff, amountOff, minHours } = data
      if (!daysOfWeek || daysOfWeek.length === 0 || !startTime || !endTime) {
        return "Time window deal available."
      }

      const dayAbbrevs: Record<string, string> = {
        MON: "Monday",
        TUE: "Tuesday",
        WED: "Wednesday",
        THU: "Thursday",
        FRI: "Friday",
        SAT: "Saturday",
        SUN: "Sunday",
      }

      const days = daysOfWeek.map((d) => dayAbbrevs[d] || d)
      let dayRange = ""
      if (days.length === 1) {
        dayRange = days[0]
      } else if (days.length === 2) {
        dayRange = `${days[0]} and ${days[1]}`
      } else {
        dayRange = `${days[0]}–${days[days.length - 1]}`
      }

      const startTimeFormatted = formatTime(startTime)
      const endTimeFormatted = formatTime(endTime)

      let dealPart = ""
      if (itemName) {
        dealPart = `1 free ${itemName}`
      } else if (percentOff) {
        dealPart = `${percentOff}% off`
      } else if (amountOff) {
        dealPart = `$${amountOff} off`
      } else {
        dealPart = "special offer"
      }

      let desc = `${dealPart} on ${dayRange} from ${startTimeFormatted} to ${endTimeFormatted}`
      if (minHours) {
        desc += ` when booking ${minHours}+ hours`
      }
      return desc + "."
    }

    default:
      return "Deal available."
  }
}

/**
 * Generate default title based on deal type and data
 */
export function generateDefaultTitle(
  type: DealType,
  data: {
    itemName?: string
    percentOff?: number
    amountOff?: number
  }
): string {
  switch (type) {
    case DealType.FREE_ITEM:
      return data.itemName ? `Free ${data.itemName}` : "Free item"
    case DealType.PERCENT_OFF:
      return data.percentOff ? `${data.percentOff}% off` : "Percent off"
    case DealType.AMOUNT_OFF:
      return data.amountOff ? `$${data.amountOff} off` : "Amount off"
    case DealType.TIME_WINDOW:
      return "Time window deal"
    default:
      return "Deal"
  }
}

/**
 * Format a compact deal summary for badge display on venue cards
 * Returns a short, punchy summary like "20% Off" or "Free Coffee"
 * Designed to be displayed prominently on venue cards
 */
export function formatDealBadgeSummary(deal: Deal): string {
  try {
    if (!deal) return "Deal"
    
    const eligibility = (deal.eligibilityJson as EligibilityJson) || {}
    
    // Generate short, punchy text based on deal type
    switch (deal.type) {
      case DealType.FREE_ITEM:
        if (eligibility.itemName) {
          // Shorten common items
          const item = eligibility.itemName.toLowerCase()
          if (item.includes("coffee")) return "Free Coffee"
          if (item.includes("drink")) return "Free Drink"
          if (item.includes("food")) return "Free Food"
          return `Free ${eligibility.itemName}`
        }
        return "Free Item"
        
      case DealType.PERCENT_OFF:
        if (eligibility.percentOff) {
          return `${eligibility.percentOff}% Off`
        }
        return "Percent Off"
        
      case DealType.AMOUNT_OFF:
        if (eligibility.amountOff) {
          return `$${eligibility.amountOff} Off`
        }
        return "Amount Off"
        
      case DealType.TIME_WINDOW:
        // For time windows, show the deal benefit if available
        if (eligibility.itemName) {
          const item = eligibility.itemName.toLowerCase()
          if (item.includes("coffee")) return "Free Coffee"
          if (item.includes("drink")) return "Free Drink"
          return `Free ${eligibility.itemName}`
        }
        if (eligibility.percentOff) {
          return `${eligibility.percentOff}% Off`
        }
        if (eligibility.amountOff) {
          return `$${eligibility.amountOff} Off`
        }
        return "Special Deal"
        
      default:
        // Fall back to title if it's short and punchy
        if (deal.title && deal.title.trim() && deal.title.length <= 20) {
          return deal.title
        }
        return "Deal"
    }
  } catch (error) {
    console.error("Error in formatDealBadgeSummary:", error)
    return deal?.title || "Deal"
  }
}
