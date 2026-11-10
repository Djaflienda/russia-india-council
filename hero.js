'use strict';
(() => {
  const hero = document.querySelector('.hero');
  if (!hero) return;
  const controls = hero.querySelector('.hero-controls');
  const toggle = hero.querySelector('.motion-toggle');
  const scenes = [...hero.querySelectorAll('[data-scene-select]')];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let paused = false;
  let visible = true;
  let scene = 0;
  let timer;
  const glassMotion = createGlassMotion(hero.querySelector('.hero-image'));

  function selectScene(index) {
    scene = index;
    hero.dataset.scene = String(index);
    scenes.forEach((button, i) => button.setAttribute('aria-pressed', String(i === index)));
  }
  function update() {
    clearInterval(timer);
    const stopped = paused || reduced.matches || document.hidden || !visible;
    hero.classList.toggle('is-paused', stopped);
    glassMotion?.setActive(!stopped, reduced.matches);
    toggle.setAttribute('aria-pressed', String(paused));
    const english = document.documentElement.lang === 'en';
    toggle.setAttribute('aria-label', english ? (paused ? 'Play animation' : 'Pause animation') : (paused ? 'Продолжить анимацию' : 'Приостановить анимацию'));
    scenes.forEach((button, i) => button.setAttribute('aria-label', `${english ? 'Background view' : 'Ракурс'} ${i + 1}`));
    if (!stopped) timer = setInterval(() => selectScene((scene + 1) % scenes.length), 8500);
  }
  toggle.addEventListener('click', () => { paused = !paused; update(); });
  scenes.forEach((button, index) => button.addEventListener('click', () => { selectScene(index); update(); }));
  reduced.addEventListener('change', update);
  document.addEventListener('visibilitychange', update);
  new MutationObserver(update).observe(document.documentElement, { attributes: true, attributeFilter: ['lang'] });
  if ('IntersectionObserver' in window) new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    update();
  }).observe(hero);
  controls.hidden = false;
  update();

  // Bend the original Figma glass texture continuously, without moving the text.
  // Unsupported GPUs retain the existing image and CSS animation.
  function createGlassMotion(image) {
    const canvas = document.createElement('canvas');
    canvas.className = 'hero-glass';
    const gl = canvas.getContext('webgl', { alpha: false, antialias: false, powerPreference: 'low-power' });
    if (!gl) return null;
    const vertex = `attribute vec2 position; void main(){gl_Position=vec4(position,0.0,1.0);}`;
    const fragment = `precision mediump float;
      uniform sampler2D textureImage;
      uniform vec2 resolution;
      uniform vec2 cover;
      uniform float time;
      void main(){
        vec2 uv=gl_FragCoord.xy/resolution;
        vec2 p=uv;
        p.x+=0.045*sin(uv.y*5.0+time*0.65)+0.018*sin(uv.y*11.0-time*0.45);
        p.y+=0.035*sin(uv.x*4.0-time*0.45);
        p=(p-0.5)*0.84*cover+0.5;
        p.x=1.0-p.x;
        vec3 color=texture2D(textureImage,p).rgb;
        float light=pow(0.5+0.5*sin(uv.x*8.0+uv.y*3.0-time*0.6),8.0);
        color*=0.92+0.22*light;
        gl_FragColor=vec4(color,1.0);
      }`;
    const shaders = [];
    const program = gl.createProgram();
    for (const [type, source] of [[gl.VERTEX_SHADER, vertex], [gl.FRAGMENT_SHADER, fragment]]) {
      const shader = gl.createShader(type);
      shaders.push(shader);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        shaders.forEach(item => gl.deleteShader(item));
        gl.deleteProgram(program);
        return null;
      }
      gl.attachShader(program, shader);
    }
    gl.linkProgram(program);
    shaders.forEach(shader => gl.deleteShader(shader));
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) { gl.deleteProgram(program); return null; }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]), gl.STATIC_DRAW);
    const position = gl.getAttribLocation(program, 'position');
    gl.enableVertexAttribArray(position);
    gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const timeUniform = gl.getUniformLocation(program, 'time');
    const resolution = gl.getUniformLocation(program, 'resolution');
    const cover = gl.getUniformLocation(program, 'cover');
    let ready = false, active = false, disabled = false, lost = false;
    let frame = 0, last = 0, elapsed = 0;
    const camera = image.parentElement;
    camera.append(canvas);
    function render() {
      if (!ready || lost) return;
      const ratio = Math.min(devicePixelRatio || 1, 1.5, 1600 / camera.clientWidth);
      const width = Math.max(1, Math.round(camera.clientWidth * ratio));
      const height = Math.max(1, Math.round(camera.clientHeight * ratio));
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      gl.viewport(0, 0, width, height);
      const aspect = width / height / (image.naturalWidth / image.naturalHeight);
      gl.uniform2f(cover, Math.min(1, aspect), Math.min(1, 1 / aspect));
      gl.uniform2f(resolution, width, height);
      gl.uniform1f(timeUniform, elapsed);
      gl.drawArrays(gl.TRIANGLES, 0, 6);
    }
    function tick(now) {
      if (!active || !ready || lost) return;
      if (!last) last = now;
      if (now - last >= 1000 / 30) {
        elapsed += Math.min((now - last) / 1000, 0.1);
        last = now;
        render();
      }
      frame = requestAnimationFrame(tick);
    }
    function setActive(value, staticOnly) {
      active = value;
      disabled = staticOnly;
      cancelAnimationFrame(frame);
      last = 0;
      camera.classList.toggle('has-glass-motion', ready && !disabled && !lost);
      if (active && ready && !lost) frame = requestAnimationFrame(tick);
    }
    function loadTexture() {
      if (!image.naturalWidth || lost) return;
      try {
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE, image);
        ready = true;
        render();
        setActive(active, disabled);
      } catch { camera.classList.remove('has-glass-motion'); }
    }
    if (image.complete) loadTexture();
    else image.addEventListener('load', loadTexture, { once: true });
    const resize = new ResizeObserver(render);
    resize.observe(camera);
    canvas.addEventListener('webglcontextlost', () => {
      lost = true;
      cancelAnimationFrame(frame);
      resize.disconnect();
      camera.classList.remove('has-glass-motion');
    });
    return { setActive };
  }
})();
