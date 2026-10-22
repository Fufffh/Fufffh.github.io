/**
 * Refer to hexo-generator-searchdb
 * https://github.com/next-theme/hexo-generator-searchdb/blob/main/dist/search.js
 * Modified by hexo-theme-butterfly
 */

class LocalSearch {
  constructor ({
    path = '',
    unescape = false,
    top_n_per_article = 1
  }) {
    this.path = path
    this.unescape = unescape
    this.top_n_per_article = top_n_per_article
    this.isfetched = false
    this.datas = null
    this.fetchPromise = null
    this.loadError = null
  }

  _processKeywords (keywords) {
    return keywords.map(String)
  }

  escapeHTML (value) {
    return String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]))
  }

  safeURL (value) {
    try {
      const url = new URL(value, location.origin)
      return /^https?:$/.test(url.protocol) && url.origin === location.origin && !url.username && !url.password ? url : null
    } catch { return null }
  }

  getIndexByWord (words, text, caseSensitive = false) {
    const index = []
    const included = new Set()
    const processedWords = this._processKeywords(words)

    if (!caseSensitive) {
      text = text.toLowerCase()
    }
    processedWords.forEach((word, i) => {
      const wordLen = word.length
      if (wordLen === 0) return
      let startPosition = 0
      let position = -1
      const searchWord = caseSensitive ? word : word.toLowerCase()
      while ((position = text.indexOf(searchWord, startPosition)) > -1) {
        index.push({ position, word })
        included.add(words[i])
        startPosition = position + wordLen
      }
    })
    // Sort index by position of keyword
    index.sort((left, right) => {
      if (left.position !== right.position) {
        return left.position - right.position
      }
      return right.word.length - left.word.length
    })
    return [index, included]
  }

  // Merge hits into slices
  mergeIntoSlice (start, end, index) {
    let item = index[0]
    let { position, word } = item
    const hits = []
    const count = new Set()
    while (position + word.length <= end && index.length !== 0) {
      count.add(word)
      hits.push({
        position,
        length: word.length
      })
      const wordEnd = position + word.length

      // Move to next position of hit
      index.shift()
      while (index.length !== 0) {
        item = index[0]
        position = item.position
        word = item.word
        if (wordEnd > position) {
          index.shift()
        } else {
          break
        }
      }
    }
    return {
      hits,
      start,
      end,
      count: count.size
    }
  }

  // Highlight title and content
  highlightKeyword (val, slice) {
    const parts = []
    let index = slice.start
    for (const { position, length } of slice.hits) {
      parts.push(this.escapeHTML(val.substring(index, position)))
      index = position + length
      parts.push(`<mark class="search-keyword">${this.escapeHTML(val.substring(position, position + length))}</mark>`)
    }
    parts.push(this.escapeHTML(val.substring(index, slice.end)))
    return parts.join('')
  }

  getResultItems (keywords) {
    const resultItems = []
    keywords = [...new Set(keywords.map(word => word.trim().toLowerCase()).filter(Boolean))]
    if (!keywords.length) return resultItems
    const query = keywords.join(' ')
    this.datas.forEach((data, id) => {
      const { title, status, status_label } = data
      const content = data.content || ''
      const url = this.safeURL(data.url)
      if (!url) return
      const categories = Array.isArray(data.categories) ? data.categories.filter(value => typeof value === 'string') : []
      const tags = Array.isArray(data.tags) ? data.tags.filter(value => typeof value === 'string') : []
      const headings = Array.isArray(data.headings) ? data.headings.filter(value => typeof value === 'string') : []
      const metadata = [...categories, ...tags, url.pathname, ...headings].join(' ')
      const matchingSections = headings.filter(heading => keywords.every(word => heading.toLowerCase().includes(word))).map(heading => ({
        position: content.indexOf(heading),
        rank: heading.toLowerCase().replace(/^[\d.\s]+/, '') === query ? 2 : 1
      })).filter(section => section.position >= 0)
      const [indexOfTitle, keysOfTitle] = this.getIndexByWord(keywords, title)
      const [indexOfContent, keysOfContent] = this.getIndexByWord(keywords, content)
      const [, keysOfSearch] = this.getIndexByWord(keywords, data.search_text || content)
      const [, keysOfMeta] = this.getIndexByWord(keywords, metadata)
      const includedCount = new Set([...keysOfTitle, ...keysOfContent, ...keysOfSearch, ...keysOfMeta]).size
      if (!includedCount) return
      const titleLower = title.toLowerCase()
      const titleRank = titleLower === query ? 4 : titleLower.startsWith(query) ? 3 : keysOfTitle.size === keywords.length ? 2 : keysOfTitle.size ? 1 : 0
      const hitCount = Math.min(indexOfContent.length, 20)
      const titleSlice = indexOfTitle.length ? this.mergeIntoSlice(0, title.length, indexOfTitle) : { start: 0, end: title.length, hits: [] }
      const slicesOfContent = []
      while (indexOfContent.length !== 0) {
        const { position } = indexOfContent[0]
        let start = Math.max(0, position - 45)
        const boundary = content.slice(start, position).search(/[。！？]\s*|\.\s+/)
        if (boundary >= 0) start += boundary + 1
        const end = Math.min(content.length, Math.max(position + indexOfContent[0].word.length, position + 130, start + 190))
        const slice = this.mergeIntoSlice(start, end, indexOfContent)
        slice.sectionRank = matchingSections.reduce((rank, section) => section.position >= start && section.position < end ? Math.max(rank, section.rank) : rank, 0)
        slicesOfContent.push(slice)
      }
      // Prefer an early explanation over a later paragraph repeating the same term.
      slicesOfContent.sort((left, right) => right.count - left.count || right.sectionRank - left.sectionRank || left.start - right.start)
      url.searchParams.set('highlight', query)
      let resultItem = `<li class="local-search-hit-item"><a href="${this.escapeHTML(url.href)}"><div class="search-result-heading"><span class="search-result-title">${this.highlightKeyword(title, titleSlice)}</span>`
      if (['planned', 'updating', 'completed'].includes(status) && typeof status_label === 'string') {
        resultItem += `<span class="article-status article-status--${status}" data-status="${status}">${this.escapeHTML(status_label)}</span>`
      }
      resultItem += '</div>'
      const meta = [categories.join(' / '), /^\d{4}-\d{2}-\d{2}$/.test(data.date || '') ? data.date : ''].filter(Boolean)
      if (meta.length) resultItem += `<div class="search-result-meta">${meta.map(value => this.escapeHTML(value)).join('<span aria-hidden="true"> · </span>')}</div>`
      const count = Math.max(1, parseInt(this.top_n_per_article, 10) || 1)
      if (!slicesOfContent.length) {
        const fallback = data.description || content
        if (fallback) resultItem += `<p class="search-result">${this.escapeHTML(fallback.slice(0, 190))}${fallback.length > 190 ? '…' : ''}</p>`
      }
      slicesOfContent.slice(0, count).forEach(slice => {
        resultItem += `<p class="search-result">${slice.start ? '…' : ''}${this.highlightKeyword(content, slice)}${slice.end < content.length ? '…' : ''}</p>`
      })
      resultItem += '</a></li>'
      resultItems.push({ item: resultItem, id, hitCount, includedCount, titleRank, metaCount: keysOfMeta.size })
    })
    return resultItems
  }

  static compareResults (left, right) {
    return right.includedCount - left.includedCount || right.titleRank - left.titleRank || right.metaCount - left.metaCount || right.hitCount - left.hitCount || left.id - right.id
  }

  fetchData () {
    if (this.isfetched) return Promise.resolve(true)
    if (this.fetchPromise) return this.fetchPromise
    this.loadError = null
    const isXml = !this.path.endsWith('json')
    window.dispatchEvent(new Event('search:loading'))
    this.fetchPromise = fetch(this.path)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        return response.text()
      })
      .then(res => {
        // Get the contents from search data
        this.datas = isXml
          ? [...new DOMParser().parseFromString(res, 'text/xml').querySelectorAll('entry')].map(element => ({
              title: element.querySelector('title').textContent,
              content: element.querySelector('content').textContent,
              url: element.querySelector('url').textContent
            }))
          : JSON.parse(res)
        // Only match articles with non-empty titles
        if (!Array.isArray(this.datas)) throw new Error('Invalid search index')
        this.datas = this.datas.filter(data => data && typeof data.title === 'string' && data.title.trim() && typeof data.url === 'string').map(data => ({
          ...data,
          title: data.title.trim(),
          content: typeof data.content === 'string' ? data.content.trim() : '',
          search_text: typeof data.search_text === 'string' ? data.search_text : '',
          description: typeof data.description === 'string' ? data.description : ''
        }))
        this.isfetched = true
        window.dispatchEvent(new Event('search:loaded'))
        return true
      })
      .catch(error => {
        console.error('Local search data fetch failed:', error)
        this.loadError = error
        window.dispatchEvent(new Event('search:error'))
        return false
      })
      .finally(() => { this.fetchPromise = null })
    return this.fetchPromise
  }

  // Highlight by wrapping node in mark elements with the given class name
  highlightText (node, slice, className) {
    const val = node.nodeValue
    let index = slice.start
    const children = []
    for (const { position, length } of slice.hits) {
      const text = document.createTextNode(val.substring(index, position))
      index = position + length
      const mark = document.createElement('mark')
      mark.className = className
      mark.appendChild(document.createTextNode(val.substring(position, position + length)))
      children.push(text, mark)
    }
    node.nodeValue = val.substring(index, slice.end)
    children.forEach(element => {
      node.parentNode.insertBefore(element, node)
    })
  }

  // Highlight the search words provided in the url in the text
  highlightSearchWords (body) {
    const params = new URL(location.href).searchParams.get('highlight')
    const keywords = params ? params.split(' ') : []
    if (!keywords.length || !body) return
    const walk = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null)
    const allNodes = []
    while (walk.nextNode()) {
      if (!walk.currentNode.parentElement.closest('button, select, textarea, script, style, pre, code, .mermaid, .katex, .search-keyword')) allNodes.push(walk.currentNode)
    }
    allNodes.forEach(node => {
      const [indexOfNode] = this.getIndexByWord(keywords, node.nodeValue)
      if (!indexOfNode.length) return
      const slice = this.mergeIntoSlice(0, node.nodeValue.length, indexOfNode)
      this.highlightText(node, slice, 'search-keyword')
    })
  }
}

// Search should be usable before remote images/fonts and counters finish loading.
window.addEventListener('DOMContentLoaded', () => {
  // Search
  const { path, top_n_per_article, unescape, languages, pagination } = GLOBAL_CONFIG.localSearch
  const enablePagination = pagination && pagination.enable
  const localSearch = new LocalSearch({
    path,
    top_n_per_article,
    unescape
  })

  const $input = document.querySelector('.local-search-input input')
  const $statsItem = document.getElementById('local-search-stats')
  const $loadingStatus = document.getElementById('loading-status')
  const $searchMask = document.getElementById('search-mask')
  const $searchDialog = document.querySelector('#local-search .search-dialog')
  const $results = document.getElementById('local-search-results')
  const $pagination = document.getElementById('local-search-pagination')
  const $paginationList = document.querySelector('#local-search-pagination .ais-Pagination-list')
  const $loadDataItem = document.getElementById('loading-database')
  const $error = document.getElementById('local-search-error')

  // Pagination variables (only initialize if pagination is enabled)
  let currentPage = 0
  const hitsPerPage = (pagination && pagination.hitsPerPage) || 10

  let currentResultItems = []

  if (!enablePagination) {
    currentPage = undefined
    currentResultItems = undefined
  }

  // Show/hide search results area
  const toggleResultsVisibility = hasResults => {
    $pagination.style.display = (hasResults && enablePagination && currentResultItems.length > hitsPerPage) ? '' : 'none'
  }

  // Render search results for current page
  const renderResults = (searchText, resultItems) => {
    // Determine items to display based on pagination mode
    const itemsToDisplay = enablePagination
      ? currentResultItems.slice(currentPage * hitsPerPage, (currentPage + 1) * hitsPerPage)
      : resultItems

    // Handle empty page in pagination mode
    if (enablePagination && itemsToDisplay.length === 0 && currentResultItems.length > 0) {
      currentPage = 0
      renderResults(searchText, resultItems)
      return
    }

    $results.innerHTML = `<ul class="search-result-list">${itemsToDisplay.map(result => result.item).join('')}</ul>`

    // Update stats
    const displayCount = enablePagination ? currentResultItems.length : resultItems.length
    const stats = languages.hits_stats.replace(/\$\{hits}/, displayCount)
    $statsItem.textContent = stats

    // Handle pagination
    if (enablePagination) {
      const nbPages = Math.ceil(currentResultItems.length / hitsPerPage)
      renderPagination(currentPage, nbPages, searchText)
    }

    const hasResults = resultItems.length > 0
    toggleResultsVisibility(hasResults)

    window.pjax && window.pjax.refresh($results)
  }

  // Render pagination
  const renderPagination = (page, nbPages) => {
    if (nbPages <= 1) {
      $pagination.style.display = 'none'
      $paginationList.innerHTML = ''
      return
    }

    const isFirstPage = page === 0
    const isLastPage = page === nbPages - 1

    // Responsive page display
    const isMobile = window.innerWidth < 768
    const maxVisiblePages = isMobile ? 3 : 5
    let startPage = Math.max(0, page - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(nbPages - 1, startPage + maxVisiblePages - 1)

    // Adjust starting page to maintain max visible pages
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(0, endPage - maxVisiblePages + 1)
    }

    const parts = []

    // Only add ellipsis and first page when there are many pages
    if (nbPages > maxVisiblePages && startPage > 0) {
      parts.push('<li class="ais-Pagination-item ais-Pagination-item--page"><a class="ais-Pagination-link" aria-label="Page 1" href="#" data-page="0">1</a></li>')
      if (startPage > 1) {
        parts.push('<li class="ais-Pagination-item ais-Pagination-item--ellipsis"><span class="ais-Pagination-link">...</span></li>')
      }
    }

    // Add middle page numbers
    for (let i = startPage; i <= endPage; i++) {
      if (i === page) {
        parts.push(`<li class="ais-Pagination-item ais-Pagination-item--page ais-Pagination-item--selected"><span class="ais-Pagination-link" aria-current="page" aria-label="第 ${i + 1} 页">${i + 1}</span></li>`)
      } else {
        parts.push(`<li class="ais-Pagination-item ais-Pagination-item--page"><a class="ais-Pagination-link" aria-label="Page ${i + 1}" href="#" data-page="${i}">${i + 1}</a></li>`)
      }
    }

    // Only add ellipsis and last page when there are many pages
    if (nbPages > maxVisiblePages && endPage < nbPages - 1) {
      if (endPage < nbPages - 2) {
        parts.push('<li class="ais-Pagination-item ais-Pagination-item--ellipsis"><span class="ais-Pagination-link">...</span></li>')
      }
      parts.push(`<li class="ais-Pagination-item ais-Pagination-item--page"><a class="ais-Pagination-link" aria-label="Page ${nbPages}" href="#" data-page="${nbPages - 1}">${nbPages}</a></li>`)
    }

    // Build prev/next links
    const prevLink = isFirstPage
      ? '<span class="ais-Pagination-link ais-Pagination-link--disabled" aria-label="Previous Page"><i class="fas fa-angle-left"></i></span>'
      : `<a class="ais-Pagination-link" aria-label="Previous Page" href="#" data-page="${page - 1}"><i class="fas fa-angle-left"></i></a>`
    const nextLink = isLastPage
      ? '<span class="ais-Pagination-link ais-Pagination-link--disabled" aria-label="Next Page"><i class="fas fa-angle-right"></i></span>'
      : `<a class="ais-Pagination-link" aria-label="Next Page" href="#" data-page="${page + 1}"><i class="fas fa-angle-right"></i></a>`

    $paginationList.innerHTML = `<li class="ais-Pagination-item ais-Pagination-item--previousPage ${isFirstPage ? 'ais-Pagination-item--disabled' : ''}">${prevLink}</li>${parts.join('')}<li class="ais-Pagination-item ais-Pagination-item--nextPage ${isLastPage ? 'ais-Pagination-item--disabled' : ''}">${nextLink}</li>`
    $pagination.style.display = ''
  }

  // Clear search results and stats
  const clearSearchResults = () => {
    $results.textContent = ''
    $statsItem.textContent = ''
    toggleResultsVisibility(false)
    if (enablePagination) {
      currentResultItems = []
      currentPage = 0
    }
  }

  // Show no results message
  const showNoResults = searchText => {
    $results.textContent = ''
    const statsDiv = document.createElement('div')
    statsDiv.className = 'search-result-stats'
    statsDiv.textContent = languages.hits_empty.replace(/\$\{query}/, searchText)
    $statsItem.innerHTML = statsDiv.outerHTML
    toggleResultsVisibility(false)
    if (enablePagination) {
      currentResultItems = []
      currentPage = 0
    }
  }

  const inputEventFunction = () => {
    const searchText = $input.value.trim()
    if (!searchText) {
      clearSearchResults()
      $loadingStatus.hidden = true
      return
    }
    if (!localSearch.isfetched) return

    if (searchText !== '') $loadingStatus.hidden = false

    const keywords = searchText.toLowerCase().split(/\s+/)
    let resultItems = []

    if (searchText.length > 0) {
      resultItems = localSearch.getResultItems(keywords)
    }

    if (keywords.length === 1 && keywords[0] === '') {
      clearSearchResults()
    } else if (resultItems.length === 0) {
      showNoResults(searchText)
    } else {
      // Sort results by relevance
      resultItems.sort(LocalSearch.compareResults)

      if (enablePagination) {
        currentResultItems = resultItems
        currentPage = 0
      }
      renderResults(searchText, resultItems)
    }

    $loadingStatus.hidden = true
  }

  // Debounced input handler
  let searchTimeout
  const debouncedInputEvent = () => {
    clearTimeout(searchTimeout)
    // Empty input: clear results immediately without debounce delay
    if (!$input.value.trim()) {
      inputEventFunction()
      return
    }
    if (!eventIsComposing) searchTimeout = setTimeout(inputEventFunction, 150)
  }

  let eventIsComposing = false
  let opener = null
  let focusTimer
  $input.addEventListener('input', debouncedInputEvent)
  $input.addEventListener('compositionstart', () => { eventIsComposing = true; clearTimeout(searchTimeout) })
  $input.addEventListener('compositionend', () => { eventIsComposing = false; debouncedInputEvent() })

  const fixSafariHeight = () => {
    if (window.innerWidth < 768) {
      $searchDialog.style.setProperty('--search-height', window.innerHeight + 'px')
    }
  }

  // Debounced resize to avoid layout thrashing
  let resizeTimer
  const onResize = () => {
    clearTimeout(resizeTimer)
    resizeTimer = setTimeout(fixSafariHeight, 150)
  }

  const handleEscape = event => {
    if (event.key === 'Escape' || event.code === 'Escape') {
      event.preventDefault()
      closeSearch()
    } else if (event.key === 'Tab') {
      const focusable = [...$searchDialog.querySelectorAll('input,button,a[href]')].filter(node => node.getClientRects().length && !node.disabled)
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && (document.activeElement === first || !$searchDialog.contains(document.activeElement))) {
        event.preventDefault()
        last && last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !$searchDialog.contains(document.activeElement))) {
        event.preventDefault()
        first && first.focus()
      }
    }
  }

  const openSearch = () => {
    opener = document.activeElement
    btf.overflowPaddingR.add()
    btf.animateIn($searchMask, 'to_show 0.5s')
    btf.animateIn($searchDialog, 'titleScale 0.5s')
    $searchDialog.style.display = 'flex'
    clearTimeout(focusTimer)
    focusTimer = setTimeout(() => { $input.focus() }, 300)
    if (!localSearch.isfetched && !localSearch.loadError) localSearch.fetchData()
    // shortcut: ESC
    document.addEventListener('keydown', handleEscape)

    fixSafariHeight()
    window.addEventListener('resize', onResize)
  }

  const closeSearch = () => {
    clearTimeout(focusTimer)
    btf.overflowPaddingR.remove()
    btf.animateOut($searchDialog, 'search_close .5s')
    btf.animateOut($searchMask, 'to_hide 0.5s')
    document.removeEventListener('keydown', handleEscape)
    window.removeEventListener('resize', onResize)
    if (opener && opener.isConnected) opener.focus({ preventScroll: true })
  }

  const searchClickFn = () => {
    btf.addEventListenerPjax(document.querySelector('#search-button > .search'), 'click', openSearch)
  }

  const searchFnOnce = () => {
    document.querySelector('#local-search .search-close-button').addEventListener('click', closeSearch)
    document.querySelector('#local-search .search-retry').addEventListener('click', () => { localSearch.fetchData() })
    $searchMask.addEventListener('click', closeSearch)
    if (GLOBAL_CONFIG.localSearch.preload) {
      localSearch.fetchData()
    }
    localSearch.highlightSearchWords(document.getElementById('article-container'))

    // Pagination event delegation - only add if pagination is enabled
    if (enablePagination) {
      $pagination.addEventListener('click', e => {
        e.preventDefault()
        const link = e.target.closest('a[data-page]')
        if (link) {
          const page = parseInt(link.dataset.page, 10)
          if (!isNaN(page) && currentResultItems.length > 0) {
            currentPage = page
            renderResults($input.value.trim().toLowerCase(), currentResultItems)
            $results.querySelector('.search-result-list').scrollTop = 0
          }
        }
      })
    }

    // Initial state
    toggleResultsVisibility(false)
  }

  window.addEventListener('search:loading', () => {
    $loadDataItem.hidden = false
    $error.hidden = true
    $results.setAttribute('aria-busy', 'true')
  })
  window.addEventListener('search:loaded', () => {
    $loadDataItem.hidden = true
    $error.hidden = true
    $results.removeAttribute('aria-busy')
    inputEventFunction()
  })
  window.addEventListener('search:error', () => {
    $loadDataItem.hidden = true
    $loadingStatus.hidden = true
    $error.hidden = false
    $results.removeAttribute('aria-busy')
  })

  searchClickFn()
  searchFnOnce()
  // The legacy view counter temporarily replaces the URL while loading.
  // Re-read restored search parameters after that request, without delaying the UI.
  window.addEventListener('load', () => {
    localSearch.highlightSearchWords(document.getElementById('article-container'))
  }, { once: true })

  // pjax
  window.addEventListener('pjax:complete', () => {
    !btf.isHidden($searchMask) && closeSearch()
    localSearch.highlightSearchWords(document.getElementById('article-container'))
    searchClickFn()
  })
})
