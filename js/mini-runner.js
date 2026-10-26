/* Original, asset-free runner. The simulation is independent of the page and renderer. */
;(() => {
  'use strict'
  const WORLD = Object.freeze({ width: 336, height: 168, ground: 135, playerX: 43, playerW: 18, playerH: 25, gravity: 1400, jump: 440, minSpeed: 145, maxSpeed: 285 })
  const OBSTACLES = Object.freeze([
    { kind: 'cactus', width: 18, height: 28, boxes: [{ x: 7, y: 1, width: 5, height: 27 }, { x: 1, y: 12, width: 3, height: 7 }, { x: 3, y: 17, width: 5, height: 3 }, { x: 14, y: 7, width: 3, height: 7 }, { x: 11, y: 12, width: 5, height: 3 }] },
    { kind: 'rocks', width: 25, height: 17, boxes: [{ x: 2, y: 8, width: 21, height: 9 }, { x: 6, y: 3, width: 12, height: 8 }] },
    { kind: 'log', width: 28, height: 18, boxes: [{ x: 2, y: 6, width: 24, height: 12 }, { x: 13, y: 2, width: 5, height: 6 }] },
    { kind: 'tumbleweed', width: 22, height: 22, circle: { x: 11, y: 11, radius: 9 } }
  ])
  const hitsObstacle = (player, obstacle) => {
    const top = WORLD.ground - obstacle.height
    const spec = OBSTACLES.find(item => item.kind === obstacle.kind)
    if (spec?.circle) {
      const cx = obstacle.x + spec.circle.x, cy = top + spec.circle.y
      const dx = cx - Math.max(player.left, Math.min(cx, player.right))
      const dy = cy - Math.max(player.top, Math.min(cy, player.bottom))
      return dx * dx + dy * dy < spec.circle.radius * spec.circle.radius
    }
    const boxes = spec?.boxes || [{ x: 2, y: 2, width: obstacle.width - 4, height: obstacle.height - 2 }]
    return boxes.some(box => player.right > obstacle.x + box.x && player.left < obstacle.x + box.x + box.width && player.bottom > top + box.y && player.top < top + box.y + box.height)
  }
  class RunnerEngine {
    constructor(random = Math.random) { this.random = random; this.sceneTime = 0; this.sceneDistance = 0; this.reset() }
    reset() {
      this.state = 'idle'
      this.distance = 0
      this.time = 0
      this.score = 0
      this.speed = WORLD.minSpeed
      this.y = WORLD.ground - WORLD.playerH
      this.velocity = 0
      this.obstacles = []
      this.untilObstacle = 150
      this.landedAt = -1
    }
    start() { this.reset(); this.state = 'running' }
    pause() { if (this.state === 'running') this.state = 'paused' }
    resume() { if (this.state === 'paused') this.state = 'running' }
    jump() {
      if (this.state !== 'running' || this.velocity !== 0 || this.y < WORLD.ground - WORLD.playerH - .01) return false
      this.velocity = -WORLD.jump
      return true
    }
    step(dt) {
      if (this.state !== 'running' || !(dt > 0) || dt > .05) return
      this.time += dt
      this.sceneTime += dt
      this.speed = Math.min(WORLD.maxSpeed, WORLD.minSpeed + this.distance / 180)
      const travel = this.speed * dt
      this.distance += travel
      this.sceneDistance += travel
      this.score = Math.floor(this.distance / 8)
      const wasAirborne = this.y < WORLD.ground - WORLD.playerH - .01
      this.velocity += WORLD.gravity * dt
      this.y = Math.min(WORLD.ground - WORLD.playerH, this.y + this.velocity * dt)
      if (this.y >= WORLD.ground - WORLD.playerH) {
        if (wasAirborne) this.landedAt = this.time
        this.velocity = 0
      }
      this.obstacles.forEach(obstacle => { obstacle.x -= travel })
      this.obstacles = this.obstacles.filter(obstacle => obstacle.x + obstacle.width > -10)
      this.untilObstacle -= travel
      if (this.untilObstacle <= 0) {
        const spec = OBSTACLES[Math.min(OBSTACLES.length - 1, Math.floor(this.random() * OBSTACLES.length))]
        this.obstacles.push({ x: WORLD.width + 20, kind: spec.kind, width: spec.width, height: spec.height })
        // Leading-edge interval exceeds a complete jump + reaction/recovery time.
        this.untilObstacle = this.speed * (.98 + this.random() * .48) + spec.width
      }
      const left = WORLD.playerX + 3, right = WORLD.playerX + WORLD.playerW - 3
      const top = this.y + 3, bottom = this.y + WORLD.playerH - 2
      if (this.obstacles.some(obstacle => hitsObstacle({ left, right, top, bottom }, obstacle))) this.state = 'over'
    }
  }
  const clampPosition = (x, y, width, height, viewWidth, viewHeight) => ({
    x: Math.max(12, Math.min(Number.isFinite(x) ? x : 12, Math.max(12, viewWidth - width - 52))),
    y: Math.max(12, Math.min(Number.isFinite(y) ? y : 12, Math.max(12, viewHeight - height - 12)))
  })
  const wrap = (value, period) => ((value % period) + period) % period
  const smoothstep = (a, b, value) => {
    const t = Math.max(0, Math.min(1, (value - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  const SCENE_PERIOD = 80
  const sceneAt = time => {
    const phase = wrap(Number.isFinite(time) ? time : 0, SCENE_PERIOD)
    const darkness = phase < 40 ? smoothstep(18, 32, phase) : 1 - smoothstep(52, 70, phase)
    const mix = (day, night) => 'rgb(' + day.map((value, i) => Math.round(value + (night[i] - value) * darkness)).join(',') + ')'
    const angle = phase / SCENE_PERIOD * Math.PI * 2 + Math.PI * .28
    const body = a => ({ x: 168 - Math.cos(a) * 147, y: 116 - Math.sin(a) * 82, visible: smoothstep(-.1, .16, Math.sin(a)) })
    return {
      phase, darkness, sun: body(angle), moon: body(angle + Math.PI),
      palette: {
        stage: mix([250, 251, 251], [31, 38, 43]),
        far: mix([232, 236, 237], [44, 54, 61]),
        scenery: mix([192, 201, 205], [95, 113, 123]),
        terrain: mix([148, 161, 168], [142, 159, 168]),
        celestial: mix([165, 180, 188], [218, 229, 235]),
        ink: '#343b40', rim: '#edf1f3', rimAlpha: smoothstep(.2, .65, darkness),
        muted: darkness > .56 ? '#bbc5cb' : '#65747d',
        text: darkness > .56 ? '#edf1f3' : '#343b40',
        button: darkness > .56 ? '#e7ecef' : '#343b40',
        buttonText: darkness > .56 ? '#252d32' : '#fff'
      }
    }
  }
  const drawLandscape = (ctx, engine, colors, scene = sceneAt(engine.sceneTime ?? engine.time)) => {
    const d = engine.sceneDistance ?? engine.distance, time = engine.sceneTime ?? engine.time
    ctx.save()
    ctx.fillStyle = colors.stage || scene.palette.stage
    ctx.fillRect(0, 0, WORLD.width, WORLD.height)
    // Sun and moon follow opposite arcs; both fade softly at the horizon.
    ctx.strokeStyle = colors.celestial || colors.scenery
    ctx.lineWidth = 1
    ctx.save()
    ctx.beginPath(); ctx.rect(0, 25, WORLD.width, 90); ctx.clip()
    if (scene.sun.visible > 0) {
      ctx.globalAlpha = scene.sun.visible
      const sun = scene.sun
      ctx.beginPath(); ctx.arc(sun.x, sun.y, 9, 0, Math.PI * 2); ctx.stroke()
      for (let i = 0; i < 8; i++) {
        const a = i * Math.PI / 4
        ctx.beginPath()
        ctx.moveTo(sun.x + Math.cos(a) * 13, sun.y + Math.sin(a) * 13)
        ctx.lineTo(sun.x + Math.cos(a) * 16, sun.y + Math.sin(a) * 16)
        ctx.stroke()
      }
    }
    if (scene.moon.visible > 0) {
      const moon = scene.moon
      ctx.globalAlpha = scene.moon.visible
      ctx.fillStyle = colors.celestial || colors.terrain
      ctx.beginPath(); ctx.arc(moon.x, moon.y, 9, 0, Math.PI * 2); ctx.fill()
      ctx.fillStyle = colors.stage || scene.palette.stage
      ctx.beginPath(); ctx.arc(moon.x + 4, moon.y - 3, 8, 0, Math.PI * 2); ctx.fill()
    }
    ctx.restore()
    ctx.fillStyle = colors.scenery
    for (let i = 0; i < 14; i++) {
      ctx.globalAlpha = scene.darkness * (.55 + .25 * Math.sin(time * .7 + i * 2))
      const x = Math.round(wrap(i * 71 + 101 - d * .018, 410) - 20), y = 30 + (i * 17) % 54
      ctx.fillRect(x, y, 1, 1)
      if (i % 5 === 0) { ctx.fillRect(x - 1, y + 1, 3, 1); ctx.fillRect(x, y, 1, 3) }
    }
    ctx.globalAlpha = 1
    if (scene.phase > 42 && scene.phase < 43.6) {
      const progress = (scene.phase - 42) / 1.6, x = 263 - progress * 80, y = 34 + progress * 25
      ctx.save(); ctx.globalAlpha = Math.sin(progress * Math.PI) * .4
      ctx.strokeStyle = colors.celestial || colors.scenery
      ctx.beginPath(); ctx.moveTo(x + 10, y - 4); ctx.lineTo(x, y); ctx.stroke(); ctx.restore()
    }
    // A one-pixel lower edge keeps pale scenery readable through grey twilight; no blur/glow.
    ctx.shadowColor = 'rgba(237,241,243,' + scene.darkness * .6 + ')'
    ctx.shadowBlur = 0
    ctx.shadowOffsetY = 1
    const cloud = (x, y) => {
      ctx.fillStyle = colors.far
      ctx.fillRect(x + 12, y, 17, 3)
      ctx.fillRect(x + 7, y + 3, 28, 3)
      ctx.fillRect(x, y + 6, 42, 4)
      ctx.fillRect(x + 3, y + 10, 36, 2)
      ctx.fillStyle = colors.scenery
      ctx.fillRect(x + 4, y + 11, 30, 1)
    }
    cloud(Math.round(wrap(196 - d * .065, 480) - 50), 48)
    cloud(Math.round(wrap(354 - d * .065, 480) - 50), 62)
    // A more distant ridge behind the low hills; bounded drawing, no spawned scene objects.
    ctx.fillStyle = colors.far
    ctx.globalAlpha = .55
    for (let i = -1; i < 3; i++) {
      const x = Math.round(i * 235 - wrap(d * .045, 235))
      ctx.beginPath(); ctx.moveTo(x, 107); ctx.lineTo(x + 45, 84); ctx.lineTo(x + 56, 84)
      ctx.lineTo(x + 82, 67); ctx.lineTo(x + 119, 95); ctx.lineTo(x + 144, 87)
      ctx.lineTo(x + 199, 107); ctx.closePath(); ctx.fill()
    }
    ctx.globalAlpha = 1
    // Low stepped hills move much more slowly than the path, giving depth without a heavy backdrop.
    for (let i = -1; i < 4; i++) {
      const x = Math.round(i * 166 - wrap(d * .115, 166))
      ctx.fillStyle = colors.far
      ctx.beginPath()
      ctx.moveTo(x, 113); ctx.lineTo(x + 22, 107); ctx.lineTo(x + 38, 107)
      ctx.lineTo(x + 38, 100); ctx.lineTo(x + 57, 100); ctx.lineTo(x + 57, 91)
      ctx.lineTo(x + 80, 91); ctx.lineTo(x + 80, 98); ctx.lineTo(x + 100, 98)
      ctx.lineTo(x + 112, 107); ctx.lineTo(x + 145, 113); ctx.closePath(); ctx.fill()
      ctx.strokeStyle = colors.scenery
      ctx.beginPath(); ctx.moveTo(x + 47, 105.5); ctx.lineTo(x + 68, 105.5); ctx.stroke()
    }
    // A distant windmill, cabin, fence and a small grove occasionally pass by.
    const millX = Math.round(wrap(308 - d * .12, 920) - 32)
    ctx.strokeStyle = colors.scenery
    ctx.lineWidth = 1
    ctx.beginPath(); ctx.moveTo(millX - 5, 115); ctx.lineTo(millX - 2, 89)
    ctx.lineTo(millX + 2, 89); ctx.lineTo(millX + 5, 115)
    ctx.moveTo(millX - 4, 106); ctx.lineTo(millX + 4, 106); ctx.stroke()
    ctx.save(); ctx.translate(millX, 89); ctx.rotate(time * .45)
    for (let i = 0; i < 4; i++) {
      ctx.rotate(Math.PI / 2); ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(12, 0)
      ctx.lineTo(12, -3); ctx.lineTo(5, -1); ctx.closePath(); ctx.stroke()
    }
    ctx.restore()
    const cabinX = Math.round(wrap(620 - d * .16, 1170) - 40)
    ctx.fillStyle = colors.scenery
    ctx.fillRect(cabinX, 104, 20, 11)
    ctx.beginPath(); ctx.moveTo(cabinX - 3, 104); ctx.lineTo(cabinX + 10, 95)
    ctx.lineTo(cabinX + 23, 104); ctx.closePath(); ctx.fill()
    ctx.fillStyle = colors.far
    ctx.fillRect(cabinX + 4, 107, 3, 4); ctx.fillRect(cabinX + 12, 107, 4, 8)
    ctx.fillStyle = colors.scenery
    for (let i = 0; i < 4; i++) ctx.fillRect(cabinX + 25 + i * 7, 109, 1, 7)
    ctx.fillRect(cabinX + 25, 111, 22, 1)
    const grove = Math.round(wrap(132 - d * .18, 690) - 32)
    for (let i = 0; i < 3; i++) {
      const x = grove + i * 14, top = 97 - i % 2 * 5
      ctx.fillRect(x, top + 10, 1, 15)
      ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x - 5, top + 10)
      ctx.lineTo(x - 3, top + 10); ctx.lineTo(x - 7, top + 17)
      ctx.lineTo(x + 7, top + 17); ctx.lineTo(x + 3, top + 10)
      ctx.lineTo(x + 5, top + 10); ctx.closePath(); ctx.fill()
    }
    // A pair of small distant birds: decorative, light, and well above the jump lane.
    ctx.strokeStyle = colors.scenery
    for (let i = 0; i < 2; i++) {
      const x = Math.round(wrap(306 + i * 22 - d * .2, 590) - 20)
      const y = 45 + i * 6, wing = Math.floor(time * 3 + i) % 2 ? -3 : 1
      ctx.beginPath()
      ctx.moveTo(x, y + wing); ctx.lineTo(x + 3, y + wing); ctx.lineTo(x + 6, y)
      ctx.lineTo(x + 9, y + wing); ctx.lineTo(x + 12, y + wing); ctx.stroke()
    }
    // An occasional rabbit behind the path, not a jump obstacle.
    const rabbitX = Math.round(wrap(306 - d * .27, 740) - 40)
    const hop = Math.round(Math.max(0, Math.sin(time * 4)) * 2)
    const rabbitY = 120 - hop
    ctx.fillStyle = colors.scenery
    ctx.fillRect(rabbitX + 1, rabbitY - 3, 8, 5)
    ctx.fillRect(rabbitX + 8, rabbitY - 6, 5, 5)
    ctx.fillRect(rabbitX + 8, rabbitY - 11, 2, 6)
    ctx.fillRect(rabbitX + 11, rabbitY - 10, 2, 5)
    ctx.fillRect(rabbitX - 1, rabbitY - 3, 2, 2)
    ctx.fillRect(rabbitX + 1, rabbitY + 2, 3, 1)
    ctx.fillRect(rabbitX + 8, rabbitY + 2, 4, 1)
    const deer = Math.round(wrap(422 - d * .29, 1180) - 40)
    ctx.fillRect(deer, 113, 12, 5); ctx.fillRect(deer + 10, 109, 3, 7)
    ctx.fillRect(deer + 11, 108, 5, 3)
    ctx.fillRect(deer + 1, 117, 1, 6); ctx.fillRect(deer + 9, 117, 1, 6)
    ctx.fillRect(deer + 12, 103, 1, 6); ctx.fillRect(deer + 14, 104, 1, 5)
    ctx.fillRect(deer + 10, 103, 3, 1); ctx.fillRect(deer + 14, 104, 3, 1)
    // A tiny butterfly stays behind the path, far lighter than real obstacles.
    const butterfly = Math.round(wrap(208 - d * .32, 590) - 30), flutter = Math.floor(time * 7) % 2
    const butterflyY = Math.round(101 + Math.sin(time * 1.8) * 3)
    ctx.fillRect(butterfly, butterflyY, 1, 4)
    ctx.fillRect(butterfly - 2 - flutter, butterflyY - 1, 2 + flutter, 3)
    ctx.fillRect(butterfly + 1, butterflyY - 1, 2 + flutter, 3)
    // The near ground is sparse: a crisp path, a little grit, and low grass below the collision lane.
    ctx.fillStyle = colors.terrain
    ctx.fillRect(8, WORLD.ground, WORLD.width - 16, 1)
    for (let i = 0; i < 8; i++) {
      const x = Math.round(i * 53 - wrap(d, 53))
      const tile = i + Math.floor(d / 53)
      ctx.fillStyle = colors.scenery
      ctx.fillRect(x, WORLD.ground + 8 + tile % 3 * 3, 3 + tile % 4 * 2, 1)
    }
    for (let i = 0; i < 4; i++) {
      const x = Math.round(i * 119 - wrap(d, 119))
      ctx.strokeStyle = colors.scenery
      ctx.beginPath(); ctx.moveTo(x, 155); ctx.lineTo(x - 2, 152)
      ctx.moveTo(x, 155); ctx.lineTo(x, 150)
      ctx.moveTo(x, 155); ctx.lineTo(x + 3, 152); ctx.stroke()
      ctx.fillStyle = colors.scenery
      ctx.fillRect(x + 57, 144, 4, 1); ctx.fillRect(x + 58, 143, 2, 1)
    }
    ctx.restore()
  }
  const drawObstacle = (ctx, obstacle, engine, colors) => {
    const x = Math.round(obstacle.x), y = WORLD.ground - obstacle.height
    ctx.save()
    const rim = () => {
      if (!colors.rimAlpha) return
      ctx.save(); ctx.globalAlpha = colors.rimAlpha; ctx.strokeStyle = colors.rim
      ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore()
    }
    ctx.fillStyle = colors.ink
    if (obstacle.kind === 'cactus') {
      ctx.beginPath(); ctx.moveTo(x + 7, y + 28); ctx.lineTo(x + 7, y + 20)
      ctx.lineTo(x + 1, y + 20); ctx.lineTo(x + 1, y + 11); ctx.lineTo(x + 4, y + 11)
      ctx.lineTo(x + 4, y + 17); ctx.lineTo(x + 7, y + 17); ctx.lineTo(x + 7, y + 1)
      ctx.lineTo(x + 8, y); ctx.lineTo(x + 11, y); ctx.lineTo(x + 12, y + 1)
      ctx.lineTo(x + 12, y + 12); ctx.lineTo(x + 14, y + 12); ctx.lineTo(x + 14, y + 6)
      ctx.lineTo(x + 17, y + 6); ctx.lineTo(x + 17, y + 14); ctx.lineTo(x + 16, y + 15)
      ctx.lineTo(x + 12, y + 15); ctx.lineTo(x + 12, y + 28); ctx.closePath(); rim()
      ctx.fillRect(x + 8, y, 3, 1); ctx.fillRect(x + 7, y + 1, 5, 27)
      ctx.fillRect(x + 1, y + 11, 3, 8); ctx.fillRect(x + 3, y + 17, 5, 3)
      ctx.fillRect(x + 14, y + 6, 3, 8); ctx.fillRect(x + 11, y + 12, 5, 3)
      ctx.fillStyle = colors.terrain
      ctx.fillRect(x + 9, y + 4, 1, 19)
      ctx.fillRect(x + 2, y + 13, 1, 4)
    } else if (obstacle.kind === 'rocks') {
      ctx.beginPath(); ctx.moveTo(x, y + 14); ctx.lineTo(x + 3, y + 8)
      ctx.lineTo(x + 6, y + 8); ctx.lineTo(x + 8, y + 2); ctx.lineTo(x + 15, y)
      ctx.lineTo(x + 20, y + 5); ctx.lineTo(x + 20, y + 10); ctx.lineTo(x + 24, y + 12)
      ctx.lineTo(x + 25, y + 17); ctx.lineTo(x, y + 17); ctx.closePath(); rim(); ctx.fill()
      ctx.strokeStyle = colors.terrain; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x + 10, y + 4); ctx.lineTo(x + 16, y + 3)
      ctx.lineTo(x + 18, y + 7); ctx.moveTo(x + 5, y + 10); ctx.lineTo(x + 10, y + 12)
      ctx.lineTo(x + 10, y + 15); ctx.stroke()
    } else if (obstacle.kind === 'log') {
      ctx.beginPath(); ctx.moveTo(x + 6, y + 5); ctx.lineTo(x + 23, y + 6)
      ctx.lineTo(x + 27, y + 9); ctx.lineTo(x + 27, y + 15)
      ctx.lineTo(x + 23, y + 18); ctx.lineTo(x + 6, y + 18); ctx.closePath(); rim(); ctx.fill()
      ctx.beginPath(); ctx.moveTo(x + 15, y + 8); ctx.lineTo(x + 12, y + 3)
      ctx.lineTo(x + 15, y + 1); ctx.lineTo(x + 18, y + 2); ctx.lineTo(x + 15, y + 4)
      ctx.lineTo(x + 18, y + 8); ctx.closePath(); rim(); ctx.fill()
      ctx.beginPath(); ctx.ellipse(x + 6, y + 11.5, 6, 6.5, 0, 0, Math.PI * 2); rim(); ctx.fill()
      ctx.fillStyle = colors.terrain
      ctx.beginPath(); ctx.ellipse(x + 5, y + 11.5, 4, 4.5, 0, 0, Math.PI * 2); ctx.fill()
      ctx.fillRect(x + 13, y + 9, 8, 1); ctx.fillRect(x + 14, y + 14, 10, 1)
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 1
      ctx.beginPath(); ctx.arc(x + 5, y + 11.5, 2, 0, Math.PI * 1.7); ctx.stroke()
    } else if (obstacle.kind === 'tumbleweed') {
      ctx.translate(x + 11, y + 11)
      ctx.rotate(-engine.distance / 11)
      ctx.beginPath(); ctx.arc(0, 0, 9.5, 0, Math.PI * 2); rim()
      ctx.strokeStyle = colors.ink; ctx.lineWidth = 1
      ctx.beginPath()
      ctx.ellipse(-1, 0, 8, 9, .25, 0, Math.PI * 2)
      ctx.ellipse(1, -1, 8, 7, 1, 0, Math.PI * 2)
      ctx.ellipse(0, 1, 5, 9, 2.1, 0, Math.PI * 2); ctx.stroke()
      ctx.beginPath(); ctx.moveTo(-8, -3); ctx.lineTo(-10, -5); ctx.lineTo(-7, -5)
      ctx.moveTo(6, 6); ctx.lineTo(8, 9); ctx.moveTo(-2, -8); ctx.lineTo(0, -11)
      ctx.moveTo(-7, 5); ctx.lineTo(5, -6); ctx.moveTo(-5, -6); ctx.lineTo(6, 4); ctx.stroke()
      ctx.strokeStyle = colors.terrain
      ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.stroke()
    }
    ctx.restore()
  }
  // Presentation only: the original 18 × 25 collision body and physics are untouched.
  const playerPose = engine => {
    const airborne = engine.y < WORLD.ground - WORLD.playerH - 1
    const running = engine.state === 'running' || (engine.state === 'paused' && engine.time > 0)
    const frame = Math.floor(engine.time * 12) % 4
    const sinceLanding = engine.landedAt >= 0 ? engine.time - engine.landedAt : 1
    const landing = !airborne && sinceLanding >= 0 && sinceLanding < .16 ? Math.sin(sinceLanding / .16 * Math.PI) : 0
    const mode = engine.state === 'over' ? 'impact' : airborne ? (engine.velocity < -65 ? 'rise' : engine.velocity > 85 ? 'fall' : 'float') : landing > .05 ? 'land' : running ? 'run' : 'idle'
    return { mode, frame, landing, landingProgress: Math.max(0, Math.min(1, sinceLanding / .16)), airborne, bob: mode === 'run' ? [0, 1, 0, -1][frame] : 0 }
  }
  const drawPlayer = (ctx, engine, colors) => {
    const pose = playerPose(engine), x = WORLD.playerX, y = Math.round(engine.y)
    const night = colors.rimAlpha || 0, squash = Math.round(pose.landing * 2)
    const impact = pose.mode === 'impact'
    const headX = impact ? -1 : pose.airborne ? 1 : 0
    const bodyY = pose.bob + squash + (impact ? 1 : 0)
    const tint = (day, dusk) => 'rgb(' + day.map((v,i) => Math.round(v + (dusk[i] - v) * night)).join(',') + ')'
    const armor = tint([186,197,203], [165,181,191])
    const shade = tint([132,150,159], [119,139,152])
    const dark = '#343b40', face = '#293238', eyes = '#f1f4f5'
    ctx.save()
    ctx.fillStyle = colors.scenery
    const shadow = Math.max(4, 7 - (WORLD.ground - WORLD.playerH - engine.y) / 15) + pose.landing * 2
    ctx.beginPath(); ctx.ellipse(x + 9, WORLD.ground + 2, shadow, 1, 0, 0, Math.PI * 2); ctx.fill()
    if (pose.mode === 'run') {
      const dust = Math.floor(engine.time * 18) % 9
      ctx.fillRect(x - 5 - dust, WORLD.ground - 2, 2, 1)
      ctx.fillRect(x - 12 - dust, WORLD.ground - 4, 1, 1)
    }
    if (pose.landing > .05) {
      const spread = Math.round(pose.landingProgress * 7)
      ctx.fillRect(x - 3 - spread, WORLD.ground, 2, 1)
      ctx.fillRect(x + 20 + spread, WORLD.ground, 2, 1)
    }
    ctx.translate(x, y)
    if (impact) { ctx.translate(10, 25); ctx.rotate(-.12); ctx.translate(-10, -25) }
    let legs = [[4,20,3,4],[3,23,6,2],[11,20,3,4],[11,23,6,2]]
    let arms = [[1,15,3,5],[14,15,3,5]]
    if (pose.mode === 'run' || pose.mode === 'land') {
      const legFrames = [
        [[4,20,3,3],[2,23,6,2],[11,20,3,3],[11,23,6,2]],
        [[6,20,3,4],[5,24,5,1],[10,20,3,3],[11,23,6,2]],
        [[5,20,3,3],[5,23,6,2],[12,20,3,3],[12,23,6,2]],
        [[5,20,3,3],[4,22,5,2],[11,20,3,4],[11,24,6,1]]
      ]
      const armFrames = [
        [[1,16,3,4],[15,14,3,3],[17,12,3,3],[18,11,2,2]],
        [[2,16,3,4],[14,15,3,4]],
        [[0,13,3,4],[-2,12,2,3],[14,16,3,4]],
        [[2,15,3,4],[14,15,3,4]]
      ]
      legs = legFrames[pose.frame]
      arms = armFrames[pose.frame]
    } else if (pose.mode === 'rise' || pose.mode === 'float') {
      legs = [[5,20,3,2],[3,20,3,3],[2,22,6,2],[10,20,3,2],[12,20,3,2],[12,21,6,2]]
      arms = [[0,12,3,4],[2,14,3,3],[14,11,3,4],[16,10,2,3]]
    } else if (pose.mode === 'fall') {
      legs = [[5,20,3,4],[4,24,6,1],[11,20,3,4],[11,24,6,1]]
      arms = [[1,15,3,4],[14,14,3,5]]
    } else if (impact) {
      arms = [[0,15,3,5],[14,16,3,4],[16,18,2,2]]
      legs = [[5,20,3,4],[3,23,6,2],[11,20,3,4],[12,23,6,2]]
    }
    // Bevelled helmet, a small travel pack, short boots: one compact readable silhouette.
    const helmet = [[3 + headX,2 + bodyY,14,1],[2 + headX,3 + bodyY,16,10],[3 + headX,13 + bodyY,14,1]]
    const pack = [[-1,14 + bodyY,5,7],[0,13 + bodyY,3,1]]
    const torso = [[5,14 + bodyY,9,Math.max(4,7 - bodyY)]]
    const antenna = [[10 + headX,0 + bodyY,2,2],[9 + headX,0 + bodyY,3,1]]
    const parts = [...pack, ...legs, ...arms, ...torso, ...helmet, ...antenna]
    if (night > 0) {
      ctx.save(); ctx.fillStyle = colors.rim; ctx.globalAlpha = night * .45
      parts.forEach(([rx,ry,w,h]) => ctx.fillRect(rx - 1,ry - 1,w + 2,h + 2)); ctx.restore()
    }
    ctx.fillStyle = dark
    parts.forEach(([rx,ry,w,h]) => ctx.fillRect(rx,ry,w,h))
    ctx.fillStyle = shade
    ctx.fillRect(0,15 + bodyY,2,4)
    ctx.fillRect(6,15 + bodyY,7,Math.max(2,4 - bodyY))
    ctx.fillStyle = armor
    ctx.fillRect(4 + headX,3 + bodyY,12,9)
    ctx.fillRect(3 + headX,4 + bodyY,14,7)
    ctx.fillRect(6,14 + bodyY,6,1)
    ctx.fillStyle = shade
    ctx.fillRect(3 + headX,5 + bodyY,2,5)
    ctx.fillStyle = face
    ctx.fillRect(7 + headX,5 + bodyY,9,6)
    ctx.fillRect(6 + headX,6 + bodyY,1,4)
    ctx.fillStyle = eyes
    if (impact) {
      ctx.fillRect(8 + headX,8 + bodyY,2,1)
      ctx.fillRect(13 + headX,8 + bodyY,2,1)
    } else {
      const look = pose.mode === 'fall' ? 1 : 0
      ctx.fillRect(8 + headX,6 + bodyY + look,2,3 - look)
      ctx.fillRect(13 + headX,6 + bodyY + look,2,3 - look)
    }
    ctx.fillStyle = armor
    ctx.fillRect(7,17 + bodyY,2,1)
    ctx.restore()
  }
  if (typeof module === 'object' && module.exports) module.exports = { RunnerEngine, WORLD, OBSTACLES, hitsObstacle, clampPosition, sceneAt, SCENE_PERIOD, drawLandscape, drawObstacle, drawPlayer, playerPose }
  if (typeof window === 'undefined' || typeof document === 'undefined' || window.FufffhMiniRunner) return

  const ICONS = {
    robot: '<path d="M6 5h12v11H6zM9 2v3m6-3v3M3 8v5m18-5v5M9 16v5m6-5v5M9 9h1m4 0h1M9 13h6"/>',
    pause: '<path d="M8 5v14M16 5v14"/>',
    play: '<path d="m8 5 11 7-11 7z"/>',
    minus: '<path d="M5 12h14"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>'
  }
  const icon = name => '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICONS[name] + '</svg>'
  const BEST_KEY = 'fufffh.runner.best.v1'
  const POSITION_KEY = 'fufffh.runner.position.v1'
  const read = key => { try { return JSON.parse(localStorage.getItem(key)) } catch { return null } }
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)) } catch { /* Private mode still allows play. */ } }
  const isEditable = element => !!element?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"])')
  let controller = null
  class RunnerWindow {
    constructor() {
      this.engine = new RunnerEngine()
      // The blog theme chooses only the initial sky. It never jumps the in-game clock later.
      this.sceneOffset = document.documentElement.getAttribute('data-theme') === 'dark' ? 40 : 0
      const best = read(BEST_KEY)
      this.best = Number.isFinite(best) ? Math.max(0, Math.min(99999999, Math.floor(best))) : 0
      this.frame = 0
      this.visible = false
      this.lastTime = 0
      this.accumulator = 0
      this.position = null
      this.drag = null
      this.lastScore = -1
      this.abort = new AbortController()
      this.panel = document.createElement('section')
      this.panel.id = 'mini-runner'
      this.panel.hidden = true
      this.panel.setAttribute('role', 'dialog')
      this.panel.setAttribute('aria-modal', 'false')
      this.panel.setAttribute('aria-label', '跑酷小游戏')
      this.panel.innerHTML = `
        <div class="runner-header" title="拖动以移动窗口">
          <span class="runner-title">${icon('robot')}<span>跑两步</span></span>
          <div class="runner-actions">
            <button type="button" class="runner-icon runner-pause" title="暂停" aria-label="暂停游戏">${icon('pause')}</button>
            <button type="button" class="runner-icon runner-minimize" title="收起，保留本局" aria-label="收起小游戏，保留本局">${icon('minus')}</button>
            <button type="button" class="runner-icon runner-close" title="关闭，结束本局" aria-label="关闭小游戏，结束本局">${icon('close')}</button>
          </div>
        </div>
        <div class="runner-stage">
          <canvas class="runner-canvas" tabindex="0" role="button" aria-label="跑酷画面，空格、上方向键或点击跳跃" aria-describedby="runner-controls"></canvas>
          <div class="runner-scoreboard"><span>最佳 <span class="runner-best">00000</span></span><span class="runner-score" aria-label="当前分数">00000</span></div>
          <div class="runner-overlay"><p class="runner-message">跑两步，歇一会</p><button type="button" class="runner-play">开始</button></div>
        </div>
        <div class="runner-footer" id="runner-controls"><span><span class="runner-keyboard-tip"><kbd>空格</kbd> / <kbd>↑</kbd> / </span>点击跳跃</span><span>拖动顶部可移动</span></div>
        <span class="runner-live" role="status" aria-live="polite"></span>`
      document.body.appendChild(this.panel)
      this.header = this.panel.querySelector('.runner-header')
      this.canvas = this.panel.querySelector('canvas')
      this.stage = this.panel.querySelector('.runner-stage')
      this.context = this.canvas.getContext('2d')
      if (!this.context) { this.panel.remove(); throw new Error('Canvas unavailable') }
      this.pauseButton = this.panel.querySelector('.runner-pause')
      this.playButton = this.panel.querySelector('.runner-play')
      this.overlay = this.panel.querySelector('.runner-overlay')
      this.message = this.panel.querySelector('.runner-message')
      this.live = this.panel.querySelector('.runner-live')
      this.scoreNode = this.panel.querySelector('.runner-score')
      this.bestNode = this.panel.querySelector('.runner-best')
      this.bestNode.textContent = String(this.best).padStart(5, '0')
      const on = (target, name, callback, options) => target.addEventListener(name, callback, { ...options, signal: this.abort.signal })
      on(this.playButton, 'click', () => this.play())
      on(this.canvas, 'pointerdown', event => {
        if (event.button !== 0 || !event.isPrimary) return
        this.canvas.focus({ preventScroll: true })
        this.input()
      })
      on(this.pauseButton, 'click', () => {
        if (this.engine.state === 'running') this.pause()
        else this.play()
      })
      on(this.panel.querySelector('.runner-minimize'), 'click', () => this.hide(false))
      on(this.panel.querySelector('.runner-close'), 'click', () => this.hide(true))
      on(this.panel, 'keydown', event => {
        if (isEditable(event.target)) return
        if (event.key === 'Escape') {
          event.preventDefault()
          this.pause()
          document.getElementById('mini-runner-toggle')?.focus({ preventScroll: true })
        } else if ((event.code === 'Space' || event.key === 'ArrowUp' || event.key === 'Enter') && event.target === this.canvas) {
          event.preventDefault()
          if (!event.repeat) this.input()
        }
      })
      on(this.panel, 'focusout', () => queueMicrotask(() => {
        if (!this.panel.contains(document.activeElement)) this.pause()
      }))
      on(document, 'pointerdown', event => {
        if (!this.panel.contains(event.target)) this.pause()
      }, { capture: true, passive: true })
      on(window, 'blur', () => this.pause())
      on(document, 'visibilitychange', () => { if (document.hidden) this.pause() })
      on(window, 'pagehide', () => this.pause())
      on(window, 'pageshow', () => { this.resize(); this.syncTrigger() })
      on(document, 'pjax:send', () => { this.pause(); this.endDrag(false) })
      on(document, 'pjax:complete', () => {
        if (!this.panel.isConnected) document.body.appendChild(this.panel)
        this.resize(); this.syncTrigger()
      })
      on(window, 'resize', () => { this.endDrag(false); this.resize() }, { passive: true })
      if (window.visualViewport) on(window.visualViewport, 'resize', () => this.resize(), { passive: true })
      on(this.header, 'pointerdown', event => this.startDrag(event))
      on(this.header, 'pointermove', event => this.moveDrag(event))
      on(this.header, 'pointerup', () => this.endDrag(true))
      on(this.header, 'pointercancel', () => this.endDrag(false))
      on(this.header, 'lostpointercapture', () => this.endDrag(false))
      this.themeObserver = new MutationObserver(() => { if (this.visible) { this.colors(); this.draw() } })
      this.themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
      this.sizeObserver = new ResizeObserver(() => { if (this.visible) this.resize() })
      this.sizeObserver.observe(this.panel)
      this.colors()
      this.updateState()
    }
    syncTrigger() {
      const button = document.getElementById('mini-runner-toggle')
      button?.setAttribute('aria-expanded', String(this.visible))
      button?.setAttribute('aria-label', this.visible ? '收起跑酷小游戏' : '打开跑酷小游戏')
      button?.setAttribute('title', this.visible ? '收起跑酷小游戏' : '跑酷小游戏')
    }
    open() {
      if (!this.panel.isConnected) document.body.appendChild(this.panel)
      this.visible = true
      this.panel.hidden = false
      this.colors()
      this.resize()
      this.syncTrigger()
      this.draw()
      this.playButton.focus({ preventScroll: true })
    }
    hide(reset) {
      this.pause()
      this.endDrag(false)
      if (reset) { this.recordBest(); this.engine.reset(); this.updateState() }
      this.visible = false
      this.panel.hidden = true
      this.syncTrigger()
      document.getElementById('mini-runner-toggle')?.focus({ preventScroll: true })
    }
    play() {
      if (!this.visible || document.hidden) return
      if (this.engine.state === 'paused') this.engine.resume()
      else if (this.engine.state !== 'running') this.engine.start()
      this.lastTime = 0
      this.accumulator = 0
      this.updateState()
      this.canvas.focus({ preventScroll: true })
      this.loop()
    }
    input() {
      if (this.engine.state !== 'running') this.play()
      this.engine.jump()
      this.draw()
    }
    pause() {
      if (this.engine.state !== 'running') return
      this.engine.pause()
      cancelAnimationFrame(this.frame)
      this.frame = 0
      this.lastTime = 0
      this.updateState()
      this.draw()
    }
    updateState() {
      const state = this.engine.state
      this.panel.dataset.state = state
      this.overlay.hidden = state === 'running'
      this.pauseButton.disabled = state === 'idle' || state === 'over'
      this.pauseButton.innerHTML = icon(state === 'paused' ? 'play' : 'pause')
      this.pauseButton.setAttribute('aria-label', state === 'paused' ? '继续游戏' : '暂停游戏')
      this.pauseButton.title = state === 'paused' ? '继续' : '暂停'
      this.message.textContent = state === 'over' ? '这次跑了 ' + this.engine.score + ' 分' : state === 'paused' ? '已暂停' : '跑两步，歇一会'
      this.playButton.textContent = state === 'over' ? '再跑一次' : state === 'paused' ? '继续' : '开始'
      if (state === 'over') {
        this.recordBest()
        this.live.textContent = '游戏结束，本次 ' + this.engine.score + ' 分，最佳 ' + this.best + ' 分。'
      } else if (state === 'paused') this.live.textContent = '游戏已暂停。'
      else this.live.textContent = state === 'running' ? '游戏开始。空格或点击画面跳跃。' : ''
      this.scoreNode.textContent = String(this.engine.score).padStart(5, '0')
      this.lastScore = this.engine.score
    }
    recordBest() {
      if (this.engine.score <= this.best) return
      this.best = this.engine.score
      write(BEST_KEY, this.best)
      this.bestNode.textContent = String(this.best).padStart(5, '0')
    }
    loop() {
      if (this.frame || !this.visible || this.engine.state !== 'running') return
      this.frame = requestAnimationFrame(time => {
        this.frame = 0
        if (!this.visible || this.engine.state !== 'running') return
        const dt = this.lastTime ? Math.min(.05, (time - this.lastTime) / 1000) : 0
        this.lastTime = time
        this.accumulator += dt
        while (this.accumulator >= 1 / 120 && this.engine.state === 'running') {
          this.engine.step(1 / 120)
          this.accumulator -= 1 / 120
        }
        this.draw()
        if (this.engine.score !== this.lastScore) {
          this.lastScore = this.engine.score
          this.scoreNode.textContent = String(this.engine.score).padStart(5, '0')
        }
        if (this.engine.state === 'over') { this.updateState(); return }
        this.loop()
      })
    }
    colors() {
      this.sceneSignature = ''
    }
    syncScene(scene) {
      const colors = scene.palette
      const signature = colors.stage + colors.text
      if (signature === this.sceneSignature) return
      this.sceneSignature = signature
      this.stage.style.setProperty('--runner-stage', colors.stage)
      this.stage.style.setProperty('--runner-line', colors.far)
      this.stage.style.setProperty('--runner-ink', colors.text)
      this.stage.style.setProperty('--runner-muted', colors.muted)
      this.stage.style.setProperty('--runner-button', colors.button)
      this.stage.style.setProperty('--runner-button-text', colors.buttonText)
    }
    draw() {
      if (!this.visible || !this.context) return
      const ctx = this.context, engine = this.engine
      const scene = sceneAt(engine.sceneTime + this.sceneOffset), colors = scene.palette
      this.syncScene(scene)
      ctx.setTransform(this.canvas.width / WORLD.width, 0, 0, this.canvas.height / WORLD.height, 0, 0)
      ctx.clearRect(0, 0, WORLD.width, WORLD.height)
      ctx.imageSmoothingEnabled = false
      drawLandscape(ctx, engine, colors, scene)
      drawPlayer(ctx, engine, colors)
      engine.obstacles.forEach(obstacle => drawObstacle(ctx, obstacle, engine, colors))
    }
    initialPosition(width, height) {
      const vw = document.documentElement.clientWidth, vh = window.innerHeight
      const saved = vw > 600 ? read(POSITION_KEY) : null
      if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) return { x: saved.x * vw, y: saved.y * vh }
      const content = document.getElementById('content-inner')?.getBoundingClientRect()
      if (vw > 600 && content) {
        if (vw - content.right >= width + 76) return { x: content.right + 16, y: vh - height - 40 }
        if (content.left >= width + 24) return { x: content.left - width - 12, y: vh - height - 40 }
      }
      if (vw <= 600) {
        const tools = document.getElementById('rightside')?.getBoundingClientRect()
        const top = tools && tools.top > height + 24 ? tools.top - height - 14 : vh - height - 32
        return { x: 12, y: top }
      }
      return { x: 12, y: vh - height - (vw <= 600 ? 32 : 40) }
    }
    resize() {
      if (!this.visible) return
      const vw = document.documentElement.clientWidth
      const content = document.getElementById('content-inner')?.getBoundingClientRect()
      const room = content && Math.max(content.left - 24, vw - content.right - 76)
      // A 1920px desktop often has a ~300px gutter: fit it instead of covering text.
      if (vw > 900 && room >= 272 && room < 360) this.panel.style.setProperty('--runner-width', Math.floor(room) + 'px')
      else this.panel.style.removeProperty('--runner-width')
      const rect = this.panel.getBoundingClientRect()
      if (!this.position) this.position = this.initialPosition(rect.width, rect.height)
      this.place(this.position.x, this.position.y)
      const size = this.canvas.getBoundingClientRect()
      const ratio = Math.min(window.devicePixelRatio || 1, 2)
      const width = Math.round(size.width * ratio), height = Math.round(size.height * ratio)
      if (this.canvas.width !== width || this.canvas.height !== height) {
        this.canvas.width = width
        this.canvas.height = height
      }
      this.draw()
    }
    place(x, y) {
      const rect = this.panel.getBoundingClientRect()
      this.position = clampPosition(x, y, rect.width, rect.height, document.documentElement.clientWidth, window.innerHeight)
      this.panel.style.left = this.position.x + 'px'
      this.panel.style.top = this.position.y + 'px'
    }
    startDrag(event) {
      if (event.button !== 0 || !event.isPrimary || event.target.closest('button')) return
      event.preventDefault()
      this.pause()
      const rect = this.panel.getBoundingClientRect()
      this.drag = { id: event.pointerId, dx: event.clientX - rect.left, dy: event.clientY - rect.top }
      this.header.setPointerCapture(event.pointerId)
      this.panel.classList.add('is-dragging')
    }
    moveDrag(event) {
      if (!this.drag || this.drag.id !== event.pointerId) return
      this.place(event.clientX - this.drag.dx, event.clientY - this.drag.dy)
    }
    endDrag(snap) {
      if (!this.drag) return
      const id = this.drag.id
      this.drag = null
      this.panel.classList.remove('is-dragging')
      if (this.header.hasPointerCapture(id)) this.header.releasePointerCapture(id)
      if (snap && this.position) {
        const width = this.panel.getBoundingClientRect().width
        const right = Math.max(12, document.documentElement.clientWidth - width - 52)
        let x = this.position.x
        if (x < 28) x = 12
        else if (right - x < 16) x = right
        this.place(x, this.position.y)
        if (document.documentElement.clientWidth > 600) write(POSITION_KEY, { x: this.position.x / document.documentElement.clientWidth, y: this.position.y / window.innerHeight })
      }
    }
    destroy() {
      this.pause()
      this.endDrag(false)
      this.visible = false
      this.syncTrigger()
      this.abort.abort()
      this.sizeObserver.disconnect()
      this.themeObserver.disconnect()
      this.panel.remove()
    }
  }
  window.FufffhMiniRunner = {
    open() { if (!controller) controller = new RunnerWindow(); controller.open() },
    toggle() { if (controller?.visible) controller.hide(false); else this.open() },
    syncTrigger() { controller?.syncTrigger() },
    destroy() { controller?.destroy(); controller = null }
  }
})()
