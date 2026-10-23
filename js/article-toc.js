/* Article navigation owns its offsets/history; unrelated theme scrolling is untouched. */
(() => {
  let dispose = () => {}
  let currentArticle = null
  const decodeHash = hash => {
    const value = String(hash || '').replace(/^#/, '')
    try { return decodeURIComponent(value) } catch { return value }
  }
  const canonicalURL = () => {
    const bridge = window.__fufffhPageURL
    const here = new URL(location.href)
    if (bridge && here.pathname === new URL(bridge.legacyURL).pathname) {
      const url = new URL(bridge.canonicalURL)
      const saved = history.state?.fufffhToc?.url
      if (saved) {
        const snapshot = new URL(saved)
        if (snapshot.origin === url.origin && snapshot.pathname === url.pathname && snapshot.search === url.search) return snapshot
      }
      if (here.hash || !bridge.pending) url.hash = here.hash
      return url
    }
    return here
  }
  const init = (article = document.getElementById('article-container')) => {
    if (article === currentArticle && article?.isConnected) return
    dispose()
    if (!article || article.querySelector('.hbe-container')) return
    const headings = [...article.querySelectorAll('h1[id],h2[id],h3[id],h4[id],h5[id],h6[id]')]
    if (!headings.length) return
    currentArticle = article
    const abort = new AbortController()
    const listen = (target, name, fn, options = {}) => target?.addEventListener(name, fn, { ...options, signal: abort.signal })
    const card = document.getElementById('card-toc')
    const list = card?.querySelector('.toc-content')
    const mask = document.getElementById('toc-mobile-mask')
    const toggle = document.getElementById('mobile-toc-button')
    const expand = card?.querySelector('.toc-expand-button')
    const close = card?.querySelector('.toc-close-button')
    const progress = card?.querySelector('.toc-percentage')
    const nav = document.getElementById('nav')
    card?.classList.add('toc-enhanced')
    const mobile = window.matchMedia('(max-width: 900px)')
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)')
    const overflow = typeof btf !== 'undefined' ? btf.overflowPaddingR : null
    if (progress && typeof GLOBAL_CONFIG !== 'undefined') progress.hidden = !GLOBAL_CONFIG.percent.toc
    const links = new Map()
    const byId = new Map(headings.map(heading => [heading.id, heading]))
    list?.querySelectorAll('.toc-link').forEach(link => {
      const id = decodeHash(link.getAttribute('href'))
      if (!byId.has(id)) return
      links.set(id, link)
      link.classList.toggle('toc-link--auxiliary', /^(更新日志|更新记录|修订记录)$/.test(link.textContent.trim()))
    })
    const key = canonicalURL().pathname + canonicalURL().search
    let dead = false, frame = 0, dirty = true, offset = 82, positions = [], articleEnd = 0
    let active = null, ancestors = [], lock = null, correction = null, settleTimer = 0, positionTimer = 0
    let bodyLocked = false, bodyStyles = null, expanded = list?.classList.contains('is-expand') || false
    const scrollRestoration = history.scrollRestoration
    history.scrollRestoration = 'manual'
    const cleanups = []
    const setExpanded = value => {
      expanded = value
      list?.classList.toggle('is-expand', expanded)
      expand?.setAttribute('aria-expanded', String(expanded))
      if (expand) expand.textContent = expanded ? '收起' : '展开全部'
      schedule()
    }
    if (expand) expand.hidden = !list.querySelector('.toc-child')
    const keepCurrentVisible = link => {
      if (!list || !link || (mobile.matches && !card.classList.contains('open'))) return
      const outer = list.getBoundingClientRect(), item = link.getBoundingClientRect()
      if (item.top < outer.top + 8) list.scrollTop -= outer.top + 8 - item.top
      else if (item.bottom > outer.bottom - 8) list.scrollTop += item.bottom - outer.bottom + 8
    }
    const setActive = id => {
      if (active === id) return
      const old = links.get(active)
      old?.classList.remove('active')
      old?.removeAttribute('aria-current')
      old?.parentElement.classList.remove('toc-current')
      ancestors.forEach(item => item.classList.remove('toc-ancestor'))
      ancestors = []
      active = id
      const link = links.get(id)
      if (!link) return
      link.classList.add('active')
      link.setAttribute('aria-current', 'location')
      link.parentElement.classList.add('toc-current')
      let parent = link.parentElement.parentElement.closest('.toc-item')
      while (parent && list.contains(parent)) {
        parent.classList.add('toc-ancestor')
        ancestors.push(parent)
        parent = parent.parentElement.closest('.toc-item')
      }
      keepCurrentVisible(link)
    }
    const measure = () => {
      offset = (nav?.getBoundingClientRect().height || 0) + 18
      article.style.setProperty('--toc-scroll-offset', offset + 'px')
      positions = headings.filter(h => h.getClientRects().length).map(heading => ({
        heading, top: heading.getBoundingClientRect().top + window.scrollY
      }))
      articleEnd = article.getBoundingClientRect().bottom + window.scrollY
      dirty = false
    }
    const yFor = heading => Math.max(0, Math.min(
      heading.getBoundingClientRect().top + window.scrollY - offset,
      document.documentElement.scrollHeight - window.innerHeight
    ))
    const instant = top => window.scrollTo({ top, behavior: 'instant' })
    const focusHeading = heading => {
      if (!heading.hasAttribute('tabindex')) {
        heading.setAttribute('tabindex', '-1')
        const remove = () => heading.removeAttribute('tabindex')
        heading.addEventListener('blur', remove, { once: true, signal: abort.signal })
        cleanups.push(remove)
      }
      heading.focus({ preventScroll: true })
    }
    const closeMobile = (restoreFocus = true) => {
      if (!card) return
      const wasOpen = card.classList.contains('open')
      card.classList.remove('open')
      if (mask) mask.hidden = true
      toggle?.setAttribute('aria-expanded', 'false')
      toggle?.setAttribute('aria-label', '打开文章目录')
      if (bodyLocked) {
        overflow?.remove()
        document.body.style.overflow = bodyStyles.overflow
        document.body.style.paddingRight = bodyStyles.paddingRight
        document.documentElement.style.overflow = bodyStyles.htmlOverflow
        bodyLocked = false
      }
      card.inert = mobile.matches
      card.setAttribute('role', 'navigation')
      card.removeAttribute('aria-modal')
      if (mobile.matches) card.setAttribute('aria-hidden', 'true')
      else card.removeAttribute('aria-hidden')
      if (wasOpen && restoreFocus && toggle?.isConnected) toggle.focus({ preventScroll: true })
    }
    const toggleMobile = () => {
      if (!card || !mobile.matches) return
      if (card.classList.contains('open')) return closeMobile()
      card.inert = false
      card.removeAttribute('aria-hidden')
      card.classList.add('open')
      card.setAttribute('role', 'dialog')
      card.setAttribute('aria-modal', 'true')
      if (mask) mask.hidden = false
      toggle?.setAttribute('aria-expanded', 'true')
      toggle?.setAttribute('aria-label', '关闭文章目录')
      bodyStyles = { overflow: document.body.style.overflow, paddingRight: document.body.style.paddingRight, htmlOverflow: document.documentElement.style.overflow }
      overflow?.add()
      document.body.style.overflow = 'hidden'
      document.documentElement.style.overflow = 'hidden'
      bodyLocked = true
      ;(links.get(active) || close)?.focus({ preventScroll: true })
      keepCurrentVisible(links.get(active))
    }
    const captureReadingAnchor = () => {
      const visible = headings.filter(heading => heading.getClientRects().length)
      const heading = visible.filter(heading => heading.getBoundingClientRect().top <= offset + 2).at(-1)
      return heading ? { id: heading.id, top: heading.getBoundingClientRect().top } : null
    }
    const rememberPosition = () => {
      const url = canonicalURL()
      const bridge = window.__fufffhPageURL
      const visible = bridge?.pending ? new URL(bridge.legacyURL) : new URL(url)
      visible.hash = url.hash
      history.replaceState({ ...history.state, fufffhToc: { key, scrollY: window.scrollY, url: url.href, anchor: captureReadingAnchor() } }, '', visible.href)
    }
    const saveReadingPosition = () => {
      clearTimeout(positionTimer)
      positionTimer = 0
      const state = history.state?.fufffhToc
      if (dead || lock || state?.key !== key) return
      const url = canonicalURL()
      if (url.pathname + url.search !== key) return
      history.replaceState({ ...history.state, fufffhToc: { ...state, scrollY: window.scrollY, anchor: captureReadingAnchor() } }, '')
    }
    const onScroll = () => {
      schedule()
      if (!positionTimer) positionTimer = setTimeout(saveReadingPosition, 750)
    }
    const writeHistory = heading => {
      rememberPosition()
      const url = canonicalURL()
      const previousHash = decodeHash(url.hash)
      url.hash = encodeURIComponent(heading.id)
      const bridge = window.__fufffhPageURL
      if (bridge?.pending) bridge.canonicalURL = url.href
      const state = { ...history.state, fufffhToc: { key, id: heading.id, scrollY: yFor(heading), url: url.href, anchor: { id: heading.id, top: offset } } }
      const visible = bridge?.pending ? new URL(bridge.legacyURL) : new URL(url)
      visible.hash = url.hash
      if (previousHash === heading.id) history.replaceState(state, '', visible.href)
      else history.pushState(state, '', visible.href)
    }
    const moveTo = (heading, { smooth = false, focus = false, record = false } = {}) => {
      measure()
      if (record) writeHistory(heading)
      if (mobile.matches) closeMobile(false)
      setActive(heading.id)
      lock = { heading, until: performance.now() + 1100 }
      correction = { heading, until: performance.now() + 6000, count: 0 }
      clearTimeout(settleTimer)
      if (smooth && !reduced.matches) window.scrollTo({ top: yFor(heading), behavior: 'smooth' })
      else instant(yFor(heading))
      if (focus || mobile.matches) focusHeading(heading)
      settleTimer = setTimeout(() => {
        if (dead || !lock || lock.heading !== heading) return
        instant(yFor(heading))
        lock = null
        saveReadingPosition()
        schedule()
      }, smooth && !reduced.matches ? 650 : 0)
      schedule()
    }
    const correctLayout = () => {
      if (!correction || performance.now() > correction.until || correction.count >= 4) return
      if (lock) return
      const desired = Number.isFinite(correction.viewportTop)
        ? Math.max(0, correction.heading.getBoundingClientRect().top + window.scrollY - correction.viewportTop)
        : yFor(correction.heading)
      if (Math.abs(window.scrollY - desired) > 3) {
        instant(desired)
        correction.count++
      }
    }
    const render = () => {
      frame = 0
      if (dead) return
      if (dirty) { measure(); correctLayout() }
      const y = window.scrollY
      if (lock && performance.now() < lock.until) setActive(lock.heading.id)
      else {
        lock = null
        const point = y + offset + 2
        let low = 0, high = positions.length - 1, chosen = -1
        while (low <= high) {
          const mid = (low + high) >> 1
          if (positions[mid].top <= point) { chosen = mid; low = mid + 1 }
          else high = mid - 1
        }
        if (chosen >= 0 && y + window.innerHeight >= articleEnd - 2) chosen = positions.length - 1
        setActive(chosen >= 0 ? positions[chosen].heading.id : null)
      }
      if (progress && positions.length) {
        const start = positions[0].top - offset
        const end = Math.max(start + 1, articleEnd - window.innerHeight)
        const percent = Math.max(0, Math.min(100, Math.round((y - start) / (end - start) * 100)))
        progress.textContent = percent + '%'
        progress.setAttribute('aria-label', '阅读进度 ' + percent + '%')
      }
    }
    function schedule() { if (!dead && !frame) frame = requestAnimationFrame(render) }
    const layoutChanged = () => { dirty = true; schedule() }
    const cancelCorrection = () => {
      correction = null
      lock = null
      clearTimeout(settleTimer)
      schedule()
    }
    const findHashHeading = hash => byId.get(decodeHash(hash))
    const restoreReadingPosition = state => {
      measure()
      const heading = byId.get(state.anchor?.id)
      if (heading?.getClientRects().length && Number.isFinite(state.anchor.top)) {
        correction = { heading, viewportTop: state.anchor.top, until: performance.now() + 6000, count: 0 }
        instant(Math.max(0, heading.getBoundingClientRect().top + window.scrollY - state.anchor.top))
      } else instant(state.scrollY)
    }
    let historyHandledURL = ''
    const restoreFromHistory = event => {
      cancelCorrection()
      closeMobile(false)
      const state = event.state?.fufffhToc
      const url = canonicalURL()
      if (url.pathname + url.search !== key) return
      const bridge = window.__fufffhPageURL
      if (!bridge?.pending && location.href !== url.href) history.replaceState(history.state, '', url.href)
      historyHandledURL = location.href
      const target = findHashHeading(url.hash)
      if (state?.key === key && Number.isFinite(state.scrollY)) restoreReadingPosition(state)
      else if (target) moveTo(target)
      layoutChanged()
    }
    listen(document, 'click', event => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
      const link = event.target.closest('a[href]')
      if (!link || link.target === '_blank' || link.hasAttribute('download')) return
      const inDirectory = list?.contains(link)
      if (!inDirectory && !article.contains(link)) return
      let url
      try { url = new URL(link.getAttribute('href'), canonicalURL()) } catch { return }
      const base = canonicalURL()
      if (url.origin !== base.origin || url.pathname + url.search !== key || !url.hash) return
      const heading = findHashHeading(url.hash)
      if (!heading) return
      event.preventDefault()
      moveTo(heading, { smooth: true, focus: event.detail === 0, record: true })
    })
    listen(expand, 'click', () => setExpanded(!expanded))
    listen(close, 'click', () => closeMobile())
    listen(mask, 'click', () => closeMobile())
    listen(window, 'scroll', onScroll, { passive: true })
    listen(window, 'scrollend', saveReadingPosition, { passive: true })
    listen(window, 'resize', layoutChanged, { passive: true })
    listen(window, 'popstate', restoreFromHistory)
    listen(window, 'hashchange', () => {
      if (historyHandledURL === location.href) { historyHandledURL = ''; return }
      historyHandledURL = ''
      cancelCorrection()
      const heading = findHashHeading(canonicalURL().hash)
      if (heading) moveTo(heading)
    })
    listen(window, 'wheel', cancelCorrection, { passive: true })
    listen(window, 'touchstart', cancelCorrection, { passive: true })
    listen(document, 'pointerdown', cancelCorrection, { passive: true })
    listen(document, 'keydown', event => {
      if (['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '].includes(event.key)) cancelCorrection()
      if (!mobile.matches || !card?.classList.contains('open')) return
      if (event.key === 'Escape') { event.preventDefault(); closeMobile() }
      else if (event.key === 'Tab') {
        const items = [...card.querySelectorAll('button,a[href]')].filter(el => el.getClientRects().length && !el.disabled)
        const first = items[0], last = items[items.length - 1]
        if (event.shiftKey && (document.activeElement === first || !card.contains(document.activeElement))) {
          event.preventDefault(); last?.focus()
        } else if (!event.shiftKey && (document.activeElement === last || !card.contains(document.activeElement))) {
          event.preventDefault(); first?.focus()
        }
      }
    })
    listen(article, 'load', layoutChanged, { capture: true })
    listen(article, 'toggle', layoutChanged, { capture: true })
    const size = new ResizeObserver(layoutChanged)
    size.observe(article)
    if (nav) size.observe(nav)
    const mutations = new MutationObserver(layoutChanged)
    mutations.observe(article, { childList: true, subtree: true })
    listen(mobile, 'change', () => { closeMobile(); layoutChanged() })
    document.fonts?.ready.then(() => { if (!dead) layoutChanged() })
    const firstURL = canonicalURL()
    const firstState = history.state?.fufffhToc
    const initial = findHashHeading(firstURL.hash)
    const restoreBridge = () => {
      // A stale counter callback must never drag a reader back after interaction.
      if (correction) layoutChanged()
    }
    listen(window, 'blog:url-restored', restoreBridge)
    toggle?.setAttribute('aria-controls', 'card-toc')
    closeMobile(false)
    setExpanded(expanded)
    if (firstState?.key === key && firstState.url === firstURL.href && Number.isFinite(firstState.scrollY)) {
      restoreReadingPosition(firstState)
      schedule()
    } else if (initial) moveTo(initial)
    else schedule()
    rememberPosition()
    dispose = () => {
      saveReadingPosition()
      dead = true
      closeMobile(false)
      abort.abort()
      clearTimeout(settleTimer)
      clearTimeout(positionTimer)
      cancelAnimationFrame(frame)
      size.disconnect()
      mutations.disconnect()
      cleanups.forEach(fn => fn())
      history.scrollRestoration = scrollRestoration
      article.style.removeProperty('--toc-scroll-offset')
      card?.classList.remove('toc-enhanced')
      currentArticle = null
    }
    window.FufffhArticleToc.toggleMobile = toggleMobile
  }
  window.FufffhArticleToc = { init, toggleMobile() {}, destroy() { dispose() } }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init(), { once: true })
  else init()
  document.addEventListener('pjax:complete', () => init())
  document.addEventListener('pjax:send', () => dispose())
  window.addEventListener('hexo-blog-decrypt', () => { dispose(); init() })
  window.addEventListener('pagehide', () => dispose())
  window.addEventListener('pageshow', event => { if (event.persisted) init() })
})()
