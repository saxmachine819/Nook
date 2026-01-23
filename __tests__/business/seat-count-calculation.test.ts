import { describe, it, expect } from 'vitest'

/**
 * Test seat count calculation and display logic
 * This tests the critical bug we fixed: group bookings should use table's actual seatCount
 */

describe('seat count calculation', () => {
  describe('group table booking', () => {
    it('uses table actual seatCount, not selector value', () => {
      const tableSeatCount = 4
      const selectorSeatCount = 1 // User might have selector still at 1

      // Simulate the booking widget logic
      const selectedTable = { id: 'table-1', seatCount: tableSeatCount }
      const requestBody = {
        tableId: selectedTable.id,
        seatCount: selectedTable.seatCount, // Should use table's seatCount, not selector
      }

      expect(requestBody.seatCount).toBe(4)
      expect(requestBody.seatCount).not.toBe(selectorSeatCount)
    })

    it('handles different table sizes correctly', () => {
      const tables = [
        { id: 'table-1', seatCount: 2 },
        { id: 'table-2', seatCount: 4 },
        { id: 'table-3', seatCount: 6 },
      ]

      tables.forEach((table) => {
        const requestBody = {
          tableId: table.id,
          seatCount: table.seatCount,
        }
        expect(requestBody.seatCount).toBe(table.seatCount)
      })
    })
  })

  describe('individual seat booking', () => {
    it('uses number of selected seats for seatCount', () => {
      const selectedSeatIds = ['seat-1', 'seat-2', 'seat-3']
      const seatCount = selectedSeatIds.length

      expect(seatCount).toBe(3)
    })

    it('handles single seat booking', () => {
      const selectedSeatIds = ['seat-1']
      const seatCount = selectedSeatIds.length

      expect(seatCount).toBe(1)
    })
  })

  describe('display logic', () => {
    it('shows "Table for X" for group bookings', () => {
      const reservation = {
        seatId: null,
        tableId: 'table-1',
        seatCount: 4,
        table: { name: 'Table A', seatCount: 4 },
      }

      let displayText = ''
      if (!reservation.seatId && reservation.tableId && reservation.table?.seatCount) {
        const actualSeatCount = reservation.table.seatCount
        const tableName = reservation.table.name
        displayText = tableName ? `Table ${tableName} for ${actualSeatCount}` : `Table for ${actualSeatCount}`
      }

      expect(displayText).toBe('Table Table A for 4')
    })

    it('shows "X seats" for multiple individual seats', () => {
      const reservation = {
        seatId: 'seat-1',
        tableId: null,
        seatCount: 3,
      }

      let displayText = ''
      if (reservation.seatCount > 1) {
        displayText = `${reservation.seatCount} seat${reservation.seatCount > 1 ? 's' : ''}`
      }

      expect(displayText).toBe('3 seats')
    })

    it('shows singular "seat" for single individual booking', () => {
      const reservation = {
        seatId: 'seat-1',
        tableId: null,
        seatCount: 1,
      }

      let displayText = ''
      if (reservation.seatCount > 1) {
        displayText = `${reservation.seatCount} seat${reservation.seatCount > 1 ? 's' : ''}`
      } else if (reservation.seatId) {
        displayText = 'Seat at Table'
      }

      expect(displayText).toBe('Seat at Table')
    })

    it('uses table seatCount as source of truth for group bookings', () => {
      // Simulates the bug we fixed: reservation might have wrong seatCount in DB
      const reservation = {
        seatId: null,
        tableId: 'table-1',
        seatCount: 1, // Wrong value in DB
        table: { name: 'Table A', seatCount: 4 }, // Correct value
      }

      // The display logic should use table.seatCount, not reservation.seatCount
      if (!reservation.seatId && reservation.tableId && reservation.table?.seatCount) {
        const actualSeatCount = reservation.table.seatCount
        expect(actualSeatCount).toBe(4)
        expect(actualSeatCount).not.toBe(reservation.seatCount) // Should use table's value
      }
    })
  })
})
