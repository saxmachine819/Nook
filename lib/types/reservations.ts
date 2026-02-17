export interface ReservationListItem {
  id: string
  userId: string | null
  startAt: Date | string
  endAt: Date | string
  seatId: string | null
  tableId: string | null
  seatCount: number
  status: string
  createdAt: Date | string
  venue: {
    id: string
    name: string
    address: string | null
    heroImageUrl: string | null
    imageUrls: unknown
    hourlySeatPrice: number
    googleMapsUrl?: string | null
    rulesText?: string | null
    tags?: string[]
  }
  seat: {
    id: string
    label: string | null
    position: number | null
    pricePerHour: number
    table: {
      name: string | null
      directionsText?: string | null
    } | null
  } | null
  table: {
    id: string
    name: string | null
    seatCount: number | null
    tablePricePerHour: number | null
    directionsText?: string | null
    seats?: { id: string }[]
  } | null
  payment?: {
    id: string
    status: string
    amount: number
    currency: string
    amountRefunded: number
    refundRequests: Array<{
      id: string
      status: string
      requestedAmount: number
      approvedAmount: number | null
      createdAt: Date | string
    }>
  } | null
}

export interface ReservationDetail extends ReservationListItem {
  venue: ReservationListItem["venue"] & {
    googleMapsUrl: string | null
    rulesText: string | null
    tags: string[]
  }
  seat: ReservationListItem["seat"] & {
    table: {
      name: string | null
      directionsText: string | null
    } | null
  }
  table: ReservationListItem["table"] & {
    directionsText: string | null
  }
}
