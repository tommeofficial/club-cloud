// The Club Cloud logo's two C's as 3D tubes whose two ends are cut FLAT and VERTICAL, so the gap between the C's has parallel sides.
// (A plain torus arc ends on a radial cut, which leans; this keeps the gap exactly as wide as before at the middle of the tube.)
import * as THREE from 'three';

// R: radius of the tube's centre line; tube: tube radius; gapAngle: the old radial gap in radians (sets the half-gap h = R sin(gap));
// side: -1 for the left C (white), +1 for the right C (cyan).
export function cTubeGeometry(R, tube, gapAngle, side, tubular = 160, radial = 20) {
  const h = R * Math.sin(gapAngle);
  const th0 = Math.asin(Math.max(0, (h - tube * 0.9) / R)), th1 = Math.PI - th0;   // start a little inside the cut; anything past it is flattened onto it
  const pos = [], idx = [];
  for (let i = 0; i <= tubular; i++) {
    const th = th0 + (th1 - th0) * i / tubular;
    const cx = side * R * Math.sin(th), cy = R * Math.cos(th), rx = side * Math.sin(th), ry = Math.cos(th);
    for (let j = 0; j < radial; j++) {
      const a = j / radial * Math.PI * 2, ca = Math.cos(a) * tube, sa = Math.sin(a) * tube;
      let x = cx + rx * ca; const y = cy + ry * ca;
      if (side * x < h) x = side * h;                       // flatten whatever pokes past the cut onto the vertical plane
      pos.push(x, y, sa);
    }
  }
  for (let i = 0; i < tubular; i++) for (let j = 0; j < radial; j++) {
    const a = i * radial + j, b = i * radial + (j + 1) % radial, c = (i + 1) * radial + j, d = (i + 1) * radial + (j + 1) % radial;
    idx.push(a, c, b, b, c, d);
  }
  const cap = (ringStart, flip) => {                          // close the flat end with a fan
    let sx = 0, sy = 0, sz = 0; for (let j = 0; j < radial; j++) { sx += pos[(ringStart + j) * 3]; sy += pos[(ringStart + j) * 3 + 1]; sz += pos[(ringStart + j) * 3 + 2]; }
    const ci = pos.length / 3; pos.push(side * h, sy / radial, sz / radial);
    for (let j = 0; j < radial; j++) { const p = ringStart + j, q = ringStart + (j + 1) % radial; flip ? idx.push(ci, q, p) : idx.push(ci, p, q); }
  };
  cap(0, false); cap(tubular * radial, true);
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setIndex(idx); g.computeVertexNormals();
  return g;
}
