;(function () {
  const CACHE_KEY = "nooc.upcomingReservations.v1"
  const message = document.getElementById("message")
  const cacheStatus = document.getElementById("cache-status")
  const cacheList = document.getElementById("cache-list")
  const retry = document.getElementById("retry")
  const cachedBtn = document.getElementById("cached")

  function readCache() {
    try {
      const raw = localStorage.getItem(CACHE_KEY)
      if (!raw) return []
      const parsed = JSON.parse(raw)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  function renderCache() {
    const items = readCache()
    if (!items.length) {
      cacheStatus.textContent = "No cached bookings on this device yet."
      cacheList.hidden = true
      cacheList.innerHTML = ""
      return
    }
    cacheStatus.textContent = `${items.length} cached booking${items.length === 1 ? "" : "s"}`
    cacheList.hidden = false
    cacheList.innerHTML = items
      .slice(0, 8)
      .map(function (item) {
        const title = item.venueName || "Reservation"
        const when = item.startAt
          ? new Date(item.startAt).toLocaleString()
          : "Time TBD"
        return (
          '<li style="padding:0.75rem 0;border-bottom:1px solid rgba(255,255,255,0.08)">' +
          '<div style="font-weight:700">' +
          title +
          "</div>" +
          '<div style="font-size:0.8rem;opacity:0.7;margin-top:0.2rem">' +
          when +
          "</div></li>"
        )
      })
      .join("")
  }

  retry.addEventListener("click", function () {
    message.textContent = "Reconnecting…"
    // Prefer production; Capacitor config server.url is the primary path when online.
    window.location.href = "https://nooc.io/"
  })

  cachedBtn.addEventListener("click", function () {
    renderCache()
  })

  window.addEventListener("online", function () {
    window.location.href = "https://nooc.io/"
  })

  renderCache()
})()
