/* No game, canvas, frame loop or storage access until the reader asks to play. */
(() => {
  if (window.FufffhRunnerLoader) return
  const base = new URL('.', document.currentScript.src)
  let pending = null
  let stylesheet = null
  const sync = () => window.FufffhMiniRunner?.syncTrigger()
  const resource = (tag, attributes) => new Promise((resolve, reject) => {
    const node = document.createElement(tag)
    Object.assign(node, attributes)
    const timer = setTimeout(() => fail(), 12000)
    const fail = () => {
      clearTimeout(timer)
      node.remove()
      reject(new Error('小游戏资源加载失败'))
    }
    node.onload = () => { clearTimeout(timer); resolve(node) }
    node.onerror = fail
    document.head.appendChild(node)
  })
  const load = () => {
    if (window.FufffhMiniRunner) return Promise.resolve()
    if (!pending) {
      // Load CSS first: a failed attempt cannot expose an unstyled window.
      const styleReady = stylesheet?.isConnected ? Promise.resolve(stylesheet) :
        resource('link', { rel: 'stylesheet', href: new URL('../css/mini-runner.css', base).href }).then(node => { stylesheet = node; return node })
      pending = styleReady
        .then(() => resource('script', { src: new URL('mini-runner.js', base).href, async: true }))
        .catch(error => { pending = null; throw error })
    }
    return pending
  }
  document.addEventListener('click', async event => {
    const button = event.target.closest('#mini-runner-toggle')
    if (!button || button.getAttribute('aria-busy') === 'true') return
    button.setAttribute('aria-busy', 'true')
    if (!window.FufffhMiniRunner) {
      button.setAttribute('aria-label', '正在加载小游戏')
      button.setAttribute('title', '正在加载小游戏')
    }
    try {
      await load()
      // The reader may have changed pages while the file was in flight.
      if (button.isConnected && document.visibilityState !== 'hidden') window.FufffhMiniRunner.toggle()
    } catch {
      const current = document.getElementById('mini-runner-toggle')
      current?.setAttribute('title', '加载失败，点击重试')
      current?.setAttribute('aria-label', '小游戏加载失败，点击重试')
    } finally {
      button.removeAttribute('aria-busy')
      if (window.FufffhMiniRunner) sync()
    }
  })
  document.addEventListener('pjax:complete', sync)
  window.FufffhRunnerLoader = { load }
})()
