// The LED screen's shader: eight looks that crossfade, drawn through an LED dot grid. Shared by the club and the website.
export function screenMaterial(THREE, textTex, specTex) {
  return new THREE.ShaderMaterial({
    fog: false,
    uniforms: {
      uTime: { value: 0 }, uBeat: { value: 0 }, uPulse: { value: 0 }, uEnergy: { value: 0 },
      uC1: { value: new THREE.Color() }, uC2: { value: new THREE.Color() }, uC3: { value: new THREE.Color() },
      uModeA: { value: 1 }, uModeB: { value: 1 }, uMix: { value: 1 },
      uDark: { value: 0 }, uBlast: { value: 0 }, uTextDim: { value: 0 },
      uText: { value: textTex }, uSpec: { value: specTex },
    },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `
      precision highp float;
      varying vec2 vUv;
      uniform float uTime, uBeat, uPulse, uEnergy, uModeA, uModeB, uMix, uDark, uBlast, uTextDim;
      uniform vec3 uC1, uC2, uC3; uniform sampler2D uText, uSpec;
      #define PI 3.14159265
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7))) * 43758.5453); }
      float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
        return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
      float fbm(vec2 p){ float v = 0.0, a = 0.5; for (int i = 0; i < 5; i++){ v += a*noise(p); p = p*2.03 + 7.1; a *= 0.5; } return v; }
      vec3 pal(float t){ t = fract(t); return t < 0.333 ? mix(uC1, uC2, t*3.0) : t < 0.666 ? mix(uC2, uC3, t*3.0-1.0) : mix(uC3, uC1, t*3.0-2.0); }
      vec3 look(float m, vec2 p){
        float r = length(p), a = atan(p.y, p.x), b = uBeat, kick = uPulse;
        if (m < 0.5) { // 0 kaleidoscope tunnel: rings rushing towards you, folded into mirrored segments
          float seg = PI / 6.0; float fa = abs(mod(a + b*0.05, seg*2.0) - seg);
          float z = 0.35 / max(r, 0.02) + b*0.5;
          float rings = smoothstep(0.42, 0.5, abs(fract(z) - 0.5)) ;
          float spokes = smoothstep(0.05, 0.0, abs(fa - 0.25 - 0.1*sin(z*2.0)));
          vec3 col = pal(z*0.15) * (rings*1.4 + spokes*1.2) * (0.35 + 0.65*kick);
          return col * smoothstep(0.0, 0.25, r) + pal(b*0.1) * exp(-r*6.0) * 0.6;
        } else if (m < 1.5) { // 1 liquid plasma
          vec2 q = p*1.6; float t = uTime*0.25 + b*0.02;
          float n = fbm(q + vec2(fbm(q + t), fbm(q - t + 3.7)) * (1.4 + uEnergy));
          vec3 col = pal(n*1.3 + t*0.3);
          return col * (0.25 + 1.1*pow(n, 1.6)) * (0.55 + 0.45*kick);
        } else if (m < 2.5) { // 2 warp: streaks flying out from the middle on the beat
          float ang = floor((a + PI) / (2.0*PI) * 90.0);
          float h = hash(vec2(ang, 1.3)), sp = 0.5 + h;
          float z = fract(h*7.0 - b*0.25*sp);
          float streak = smoothstep(0.08, 0.0, abs(r - z)) * smoothstep(0.0, 0.3, z) * step(0.35, h);
          return pal(h + b*0.03) * streak * (1.5 + 1.5*kick) + pal(b*0.05) * exp(-r*5.0) * (0.3 + 0.7*kick);
        } else if (m < 3.5) { // 3 spectrum ring: the live frequencies as glowing bars round a ring
          float k = fract((a + PI) / (2.0*PI) + b*0.01);
          float v = texture2D(uSpec, vec2(abs(k*2.0 - 1.0), 0.5)).r;
          float r0 = 0.26 + 0.03*kick, r1 = r0 + 0.04 + v*0.6;
          float bars = step(r0, r) * step(r, r1) * smoothstep(0.5, 0.35, abs(fract(k*96.0) - 0.5));
          float core = smoothstep(r0 - 0.02, r0 - 0.08, r) * (0.4 + 0.6*kick);
          return pal(k + r) * bars * 1.6 + pal(b*0.05) * core + pal(r) * exp(-abs(r - r0)*30.0) * 0.6;
        } else if (m > 5.5 && m < 6.5) { // 6 outrun: a sun sinking into a glowing grid that rushes towards you
          float hz = -0.08;
          if (p.y < hz) {
            float dep = 0.32 / max(hz - p.y, 0.012);
            float gx = abs(fract(p.x * dep * 0.9) - 0.5), gz = abs(fract(dep * 0.7 - b * 0.5) - 0.5);
            float l = max(smoothstep(0.44, 0.5, gx), smoothstep(0.44, 0.5, gz));
            return pal(0.15 + b * 0.01) * l * (0.55 + 0.9 * kick) * exp(-dep * 0.07) + pal(0.6) * 0.06;
          }
          vec2 sp = p - vec2(0.0, 0.3 + 0.02 * kick);
          float sun = smoothstep(0.34, 0.325, length(sp));
          float cut = step(0.0, sin(p.y * 46.0 - b * 0.4 + 2.0)) * smoothstep(0.28, 0.02, sp.y + 0.2);
          vec3 sc = mix(pal(0.05), pal(0.35), (sp.y + 0.34) / 0.68);
          return sc * sun * (1.0 - 0.9 * cut * step(sp.y, 0.0)) * (1.1 + 0.6 * kick) + pal(0.5) * exp(-abs(p.y - hz) * 22.0) * 0.8;
        } else if (m > 6.5) { // 7 mirror bars: the spectrum as LED columns climbing from the middle line, mirrored both ways
          float x = abs(p.x);
          float col_ = floor(x * 28.0) / 28.0;
          float v = texture2D(uSpec, vec2(col_, 0.5)).r;
          float h = 0.05 + v * 0.85 * (0.75 + 0.25 * kick);
          float inBar = step(abs(p.y), h) * step(fract(x * 28.0), 0.78);
          float seg = step(0.12, fract(abs(p.y) * 18.0));
          return pal(col_ * 0.8 + b * 0.02) * inBar * seg * 1.5 + pal(b * 0.03) * exp(-abs(p.y) * 14.0) * 0.4;
        } else if (m > 4.5) { // 5 black hole, Interstellar style: shadow, photon ring, a thin disk in front and its lensed back arching over and under
          vec2 q = p * 1.15;
          float rr = length(q), ang = atan(q.y, q.x);
          float Rs = 0.24;                                        // the shadow
          // swirling gas texture that orbits faster near the hole
          float swirl = fbm(vec2(ang * 3.0 - uTime * (0.6 / max(rr, 0.2)), rr * 9.0));
          float doppler = 1.0 + 0.85 * (-q.x / max(rr, 0.001));   // the side coming towards us is brighter
          vec3 hot = mix(vec3(1.0, 0.55, 0.18), vec3(1.0, 0.95, 0.85), smoothstep(0.2, 0.9, swirl));
          hot = mix(hot, pal(uBeat * 0.02), 0.18);                // a hint of the rig's colours
          // the lensed back of the disk: a fat glowing ring hugging the shadow, thickest over the top and under the bottom
          float halo = exp(-pow((rr - Rs * 1.32) / (0.07 + 0.05 * abs(sin(ang))), 2.0));
          // the front of the disk: a thin band crossing straight through the middle, wider than the hole
          float band = exp(-pow(q.y / (0.022 + 0.012 * smoothstep(0.2, 1.0, abs(q.x))), 2.0)) * smoothstep(1.05, 0.3, abs(q.x)) * smoothstep(Rs * 0.6, Rs * 1.6, abs(q.x) + 0.12);
          float diskSwirl = fbm(vec2(q.x * 6.0 - uTime * 0.9, q.y * 30.0));
          // photon ring: a razor-thin bright circle right at the edge of the shadow
          float photon = exp(-pow((rr - Rs * 1.04) / 0.006, 2.0));
          vec3 col = hot * halo * (0.55 + 0.8 * swirl) * doppler * 1.3;
          col += hot * band * (0.6 + 0.9 * diskSwirl) * (1.0 + 0.6 * (-q.x)) * 1.6;
          col += vec3(1.0, 0.92, 0.8) * photon * 1.4;
          col *= smoothstep(Rs * 0.98, Rs * 1.04, rr) + band * step(rr, Rs);   // the shadow eats everything behind it, but the front band crosses it
          // faint lensed stars behind
          vec2 sp = q / (1.0 + 0.12 / max(rr * rr, 0.02));
          float star = step(0.996, hash(floor(sp * 90.0))) * smoothstep(Rs * 1.3, Rs * 2.0, rr);
          col += vec3(0.8, 0.85, 1.0) * star * 0.7;
          return col * (0.7 + 0.5 * kick);
        } else { // 4 mandala: a turning flower of light that blooms on the kick
          float petals = 8.0; float rot = b*0.04;
          float f = cos((a + rot) * petals) * 0.5 + 0.5;
          float g = cos((a - rot*1.7) * petals * 0.5 + r*10.0 - b*0.5) * 0.5 + 0.5;
          float shape = smoothstep(0.02, 0.0, abs(r - (0.18 + 0.28*f*(0.7 + 0.3*kick))));
          float shape2 = smoothstep(0.015, 0.0, abs(r - (0.12 + 0.36*g)));
          return pal(f*0.3 + rot) * shape * 1.6 + pal(g*0.3 + 0.5) * shape2 * 1.2 + pal(rot) * exp(-r*7.0) * 0.5;
        }
      }
      void main(){
        vec2 p = vUv*2.0 - 1.0;
        vec3 col = mix(look(uModeA, p), look(uModeB, p), smoothstep(0.0, 1.0, uMix));
        col *= (1.0 - uDark) * (1.0 - 0.7*uTextDim);
        vec4 tx = texture2D(uText, vUv);
        col = col*(1.0 - tx.a) + tx.rgb;                       // the text sits on top, crisp
        col = mix(col, vec3(1.0, 0.97, 0.92), uBlast);         // blinder blast
        // LED dot grid: each pixel is a little round light with a dark gap round it
        vec2 cell = fract(vUv * 150.0) - 0.5;
        float dot_ = smoothstep(0.5, 0.25, length(cell));
        col *= mix(0.25 + 0.95*dot_, 0.82 + 0.18*dot_, tx.a);   // text keeps its shape through the dots
        col *= smoothstep(1.0, 0.92, length(p));               // soft edge at the rim
        gl_FragColor = vec4(col, 1.0);
        #include <colorspace_fragment>
      }`,
  });
}
