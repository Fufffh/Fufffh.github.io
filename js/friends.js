/* Local-only preparation; nothing is submitted until the visitor confirms on GitHub. */
(() => {
  function initFriends() {
    window.__friendsCleanup?.()
    const root = document.querySelector('.friends-page')
    if (!root) return
    const controller = new AbortController()
    const signal = controller.signal
    let fadeTimer, clearTimer, copyRequest = 0
    root.querySelector('[data-copy-info]').addEventListener('click', async () => {
      const field = root.querySelector('#friends-site-yaml')
      const status = root.querySelector('#friends-copy-status')
      const request = ++copyRequest
      clearTimeout(fadeTimer)
      clearTimeout(clearTimer)
      status.classList.remove('is-visible')
      try {
        await navigator.clipboard.writeText(field.value)
        if (signal.aborted || request !== copyRequest) return
        status.textContent = '已复制'
        status.classList.add('is-visible')
        fadeTimer = setTimeout(() => status.classList.remove('is-visible'), 1600)
        clearTimer = setTimeout(() => { status.textContent = '' }, 2600)
      } catch {
        if (signal.aborted || request !== copyRequest) return
        root.querySelector('.friends-copy-fallback').open = true
        field.focus()
        field.select()
        status.textContent = '未能自动复制，请复制上方已选中的资料。'
        status.classList.add('is-visible')
      }
    }, { signal })
    const form = root.querySelector('form')
    form.hidden = false
    const status = root.querySelector('#friends-form-status')
    form.addEventListener('submit', event => {
      event.preventDefault()
      if (!form.reportValidity()) return
      const data = new FormData(form)
      const value = key => String(data.get(key) || '').trim()
      for (const key of ['siteName', 'description']) {
        const input = form.elements.namedItem(key)
        input.setCustomValidity(value(key) ? '' : '请填写有效文字，不能只包含空格。')
        if (!value(key)) { input.reportValidity(); return }
      }
      for (const key of ['siteUrl', 'avatarUrl', 'linkPage']) {
        const input = form.elements.namedItem(key)
        let valid = false
        try {
          const url = new URL(value(key))
          valid = ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password
        } catch {}
        input.setCustomValidity(valid ? '' : '请填写不含账号密码的 http:// 或 https:// 公开网址。')
        if (!valid) { input.reportValidity(); return }
      }
      const body = [
        ['站点名称', value('siteName')], ['站点地址', value('siteUrl')],
        ['一句话简介', value('description')], ['头像地址', value('avatarUrl')],
        ['已添加本站链接的页面', value('linkPage')], ['补充说明', value('notes') || '无']
      ].map(([label, text]) => `### ${label}\n${text}`).join('\n\n') +
        '\n\n- [x] 我已阅读申请说明，并在站点添加了本站链接。'
      const url = new URL(root.dataset.issueBase)
      url.searchParams.set('title', `[友链申请] ${value('siteName')}`)
      url.searchParams.set('body', body)
      if (url.href.length > 7500) {
        status.textContent = '资料较长，请精简补充说明或网址后重试，避免 GitHub 无法打开。'
        return
      }
      const link = document.createElement('a')
      link.href = url.href
      link.target = '_blank'
      link.rel = 'noopener noreferrer'
      link.textContent = '若未打开，请点击此处前往 GitHub ↗'
      status.replaceChildren(link)
      link.click()
    }, { signal })
    form.addEventListener('input', event => {
      if (event.target instanceof HTMLInputElement) event.target.setCustomValidity('')
    }, { signal })
    window.__friendsCleanup = () => {
      controller.abort()
      clearTimeout(fadeTimer)
      clearTimeout(clearTimer)
    }
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initFriends, { once: true })
  else initFriends()
  document.addEventListener('pjax:complete', initFriends)
})()
