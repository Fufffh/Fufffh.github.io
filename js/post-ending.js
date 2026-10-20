/* Text-only share controls; QR generation remains with the existing Share.js. */
(() => {
  const initPostEnding = () => {
    window.__fufffhPostEndingCleanup?.()
    const share = document.querySelector('#post .social-share')
    if (!share) return
    const controller = new AbortController()
    const wechat = share.querySelector('.icon-wechat')
    const qq = share.querySelector('.icon-qq')
    if (qq) {
      const url = new URL(qq.href)
      url.protocol = 'https:'
      qq.href = url.href
    }
    if (!wechat) return
    wechat.setAttribute('tabindex', '0')
    const setOpen = open => {
      wechat.classList.toggle('is-open', open)
      wechat.setAttribute('aria-expanded', String(open))
    }
    const configurePopup = () => {
      const popup = wechat.querySelector('.wechat-qrcode')
      if (!popup) return
      popup.id = 'post-share-wechat-code'
      popup.setAttribute('role', 'region')
      popup.setAttribute('aria-label', '微信分享二维码')
      wechat.setAttribute('aria-controls', popup.id)
    }
    configurePopup()
    const observer = new MutationObserver(configurePopup)
    observer.observe(wechat, { childList: true })
    wechat.addEventListener('click', event => {
      event.preventDefault()
      if (event.target.closest('.wechat-qrcode')) return
      if (wechat.querySelector('.wechat-qrcode')) setOpen(!wechat.classList.contains('is-open'))
    }, { signal: controller.signal })
    wechat.addEventListener('keydown', event => {
      if (event.key === ' ') {
        event.preventDefault()
        wechat.click()
      }
    }, { signal: controller.signal })
    wechat.addEventListener('pointerenter', event => {
      if (event.pointerType === 'mouse' && wechat.querySelector('.wechat-qrcode')) setOpen(true)
    }, { signal: controller.signal })
    wechat.addEventListener('pointerleave', event => {
      if (event.pointerType === 'mouse' && document.activeElement !== wechat) setOpen(false)
    }, { signal: controller.signal })
    document.addEventListener('click', event => {
      if (!wechat.contains(event.target)) setOpen(false)
    }, { signal: controller.signal })
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && wechat.classList.contains('is-open')) {
        event.preventDefault()
        setOpen(false)
        wechat.focus({ preventScroll: true })
      }
    }, { signal: controller.signal })
    wechat.addEventListener('focusout', event => {
      if (!wechat.contains(event.relatedTarget)) setOpen(false)
    }, { signal: controller.signal })
    window.__fufffhPostEndingCleanup = () => {
      controller.abort()
      observer.disconnect()
    }
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPostEnding, { once: true })
  } else initPostEnding()
  document.addEventListener('pjax:complete', initPostEnding)
})()
