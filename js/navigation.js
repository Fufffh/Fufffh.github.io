/* Navigation presentation is independent of Butterfly's fixed-position logic. */
(() => {
  const initNavigation = () => {
    window.__fufffhNavigationCleanup?.()
    const header = document.getElementById('page-header')
    const nav = document.getElementById('nav')
    if (!header || !nav) return

    const controller = new AbortController()
    let frame = 0
    const updateSurface = () => {
      frame = 0
      const overContent = header.classList.contains('not-top-img') ||
        header.getBoundingClientRect().bottom <= nav.offsetHeight
      header.classList.toggle('nav-over-content', overContent)
    }
    const scheduleSurface = () => {
      if (!frame) frame = requestAnimationFrame(updateSurface)
    }
    window.addEventListener('scroll', scheduleSurface, { passive: true, signal: controller.signal })
    window.addEventListener('resize', scheduleSurface, { passive: true, signal: controller.signal })
    const sizeObserver = new ResizeObserver(scheduleSurface)
    sizeObserver.observe(header)
    sizeObserver.observe(nav)
    updateSurface()

    const normalizePath = path => path.replace(/\/index\.html$/, '/').replace(/\/+$/, '') || '/'
    const path = normalizePath(location.pathname)
    document.querySelectorAll('#nav .menus_item a, #sidebar-menus .menus_item a').forEach(link => {
      const url = new URL(link.href, location.href)
      const target = normalizePath(url.pathname)
      const exact = path === target
      const active = url.origin === location.origin &&
        (exact || (target !== '/' && path.startsWith(target + '/')))
      if (active) link.setAttribute('aria-current', exact ? 'page' : 'location')
      else link.removeAttribute('aria-current')
    })

    const panel = document.getElementById('sidebar-menus')
    const toggle = document.querySelector('#toggle-menu button')
    const close = panel?.querySelector('.sidebar-close')
    const closePanel = () => document.getElementById('menu-mask')?.click()
    const syncPanel = () => {
      const open = panel.classList.contains('open')
      toggle?.setAttribute('aria-expanded', String(open))
      toggle?.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单')
      if (open) {
        panel.inert = false
        panel.removeAttribute('aria-hidden')
        panel.setAttribute('role', 'dialog')
        panel.setAttribute('aria-modal', 'true')
        panel.setAttribute('aria-label', '导航菜单')
        close?.focus({ preventScroll: true })
      } else {
        panel.removeAttribute('role')
        panel.removeAttribute('aria-modal')
        if (panel.contains(document.activeElement)) toggle?.focus({ preventScroll: true })
        panel.inert = true
        panel.setAttribute('aria-hidden', 'true')
      }
    }
    const panelObserver = new MutationObserver(syncPanel)
    if (panel) {
      panelObserver.observe(panel, { attributes: true, attributeFilter: ['class'] })
      syncPanel()
      close?.addEventListener('click', closePanel, { signal: controller.signal })
      panel.addEventListener('keydown', event => {
        if (!panel.classList.contains('open')) return
        if (event.key === 'Escape') {
          event.preventDefault()
          closePanel()
        } else if (event.key === 'Tab') {
          const items = [...panel.querySelectorAll('a[href], button')]
            .filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden')
          const first = items[0], last = items[items.length - 1]
          if (event.shiftKey && document.activeElement === first) {
            event.preventDefault()
            last?.focus()
          } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault()
            first?.focus()
          }
        }
      }, { signal: controller.signal })
    }
    window.__fufffhNavigationCleanup = () => {
      controller.abort()
      cancelAnimationFrame(frame)
      sizeObserver.disconnect()
      panelObserver.disconnect()
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNavigation, { once: true })
  } else initNavigation()
  document.addEventListener('pjax:complete', initNavigation)
})()
