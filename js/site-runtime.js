(() => {
  const pad = value => String(value).padStart(2, '0')

  const updateRuntime = () => {
    const runtime = document.getElementById('site-runtime')
    if (!runtime) return

    const startedAt = Date.parse(runtime.dataset.start)
    if (!Number.isFinite(startedAt)) return

    let seconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
    const days = Math.floor(seconds / 86400)
    seconds %= 86400
    const hours = Math.floor(seconds / 3600)
    seconds %= 3600
    const minutes = Math.floor(seconds / 60)
    seconds %= 60

    runtime.querySelector('[data-runtime="days"]').textContent = days
    runtime.querySelector('[data-runtime="hours"]').textContent = pad(hours)
    runtime.querySelector('[data-runtime="minutes"]').textContent = pad(minutes)
    runtime.querySelector('[data-runtime="seconds"]').textContent = pad(seconds)
  }

  const startRuntime = () => {
    updateRuntime()
    if (!window.__fufffhRuntimeTimer) {
      window.__fufffhRuntimeTimer = window.setInterval(updateRuntime, 1000)
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startRuntime, { once: true })
  } else {
    startRuntime()
  }

  document.addEventListener('pjax:complete', updateRuntime)
})()
