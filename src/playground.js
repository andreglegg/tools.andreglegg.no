// The hero playground. Runs treegen's generator entirely in the browser, so it
// keeps working when the MCP host is offline — a showcase that goes dark with
// the home server would be worse than no showcase.
import * as THREE from 'three';
import { buildTree, meshStats, presets } from 'treegen/generator';
import { exportGlb } from 'treegen/export';

const REDUCED_MOTION = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function createPlayground({ canvas, hud, onParams }) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  const pivot = new THREE.Group();
  scene.add(pivot);

  scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x2a3320, 1.5));
  const key = new THREE.DirectionalLight(0xfff2d4, 2.1);
  key.position.set(4, 8, 5);
  scene.add(key);

  let current = null;
  let params = {};

  function resize() {
    const { clientWidth: w, clientHeight: h } = canvas;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }

  function frame(group, height) {
    // Frame the tree so its full height fits regardless of species/params.
    const box = new THREE.Box3().setFromObject(group);
    const size = box.getSize(new THREE.Vector3());
    const center = box.getCenter(new THREE.Vector3());
    group.position.y -= center.y;

    // Fit by the widest axis and leave headroom, so a hero-detail acacia at
    // max canopy still sits inside the frame without clipping.
    const radius = Math.max(size.x, size.y, size.z) * 0.5;
    const dist = radius / Math.sin((camera.fov * Math.PI) / 360);
    camera.position.set(0, height * 0.1, dist * 1.42);
    camera.lookAt(0, 0, 0);
  }

  function render(next) {
    params = { ...params, ...next };
    const settings = { ...presets.oak, ...params };

    const t0 = performance.now();
    const group = buildTree(settings);
    const elapsed = performance.now() - t0;

    if (current) {
      pivot.remove(current);
      current.traverse((o) => {
        o.geometry?.dispose();
        o.material?.dispose();
      });
    }
    current = group;
    pivot.add(group);
    frame(group, settings.height ?? 6.7);

    const stats = meshStats(group);
    hud({ seed: settings.seed, tris: stats.triangles, meshes: stats.meshes, ms: elapsed });
    onParams?.(settings);
    return settings;
  }

  let raf = 0;
  function loop() {
    raf = requestAnimationFrame(loop);
    if (!REDUCED_MOTION) pivot.rotation.y += 0.0025;
    renderer.render(scene, camera);
  }

  const onResize = () => resize();
  window.addEventListener('resize', onResize);
  resize();
  loop();

  return {
    render,
    /** Current tree as a GLB blob, for download. */
    async toGlb() {
      const buffer = await exportGlb(current);
      return new Blob([buffer], { type: 'model/gltf-binary' });
    },
    get params() {
      return { ...presets.oak, ...params };
    },
    dispose() {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      renderer.dispose();
    },
  };
}
