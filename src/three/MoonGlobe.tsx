import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

function createMoonTextures(maxAnisotropy: number): {
  albedo: THREE.CanvasTexture;
  bump: THREE.CanvasTexture;
} {
  const width = 1024;
  const height = 512;

  const albedoCanvas = document.createElement('canvas');
  albedoCanvas.width = width;
  albedoCanvas.height = height;
  const aCtx = albedoCanvas.getContext('2d')!;

  const bumpCanvas = document.createElement('canvas');
  bumpCanvas.width = width;
  bumpCanvas.height = height;
  const bCtx = bumpCanvas.getContext('2d')!;

  // Base regolith tone with subtle silver-slate variation
  aCtx.fillStyle = '#a3adc0';
  aCtx.fillRect(0, 0, width, height);

  bCtx.fillStyle = '#808080';
  bCtx.fillRect(0, 0, width, height);

  let seed = 1337;
  const rand = () => {
    seed = (seed * 16807) % 2147483647;
    return (seed - 1) / 2147483646;
  };

  for (let i = 0; i < 18; i++) {
    const x = rand() * width;
    const y = rand() * (height * 0.72) + height * 0.14;
    const r = 45 + rand() * 98;
    const grad = aCtx.createRadialGradient(x, y, r * 0.12, x, y, r);
    grad.addColorStop(0, 'rgba(56, 65, 84, 0.62)');
    grad.addColorStop(0.6, 'rgba(78, 88, 108, 0.32)');
    grad.addColorStop(1, 'rgba(72, 80, 96, 0)');
    aCtx.fillStyle = grad;
    aCtx.beginPath();
    aCtx.arc(x, y, r, 0, Math.PI * 2);
    aCtx.fill();
  }

  for (let i = 0; i < 6; i++) {
    const x = rand() * width;
    const y = height * 0.24 + rand() * (height * 0.56);
    const rays = 8 + Math.floor(rand() * 6);
    aCtx.save();
    aCtx.translate(x, y);
    for (let rIdx = 0; rIdx < rays; rIdx++) {
      const ang = (rIdx / rays) * Math.PI * 2 + rand() * 0.3;
      const len = 38 + rand() * 68;
      const rGrad = aCtx.createLinearGradient(
        0,
        0,
        Math.cos(ang) * len,
        Math.sin(ang) * len
      );
      rGrad.addColorStop(0, 'rgba(232, 238, 248, 0.42)');
      rGrad.addColorStop(1, 'rgba(232, 238, 248, 0)');
      aCtx.strokeStyle = rGrad;
      aCtx.lineWidth = 2 + rand() * 3;
      aCtx.beginPath();
      aCtx.moveTo(0, 0);
      aCtx.lineTo(Math.cos(ang) * len, Math.sin(ang) * len);
      aCtx.stroke();
    }
    aCtx.restore();
  }

  for (let i = 0; i < 260; i++) {
    const x = rand() * width;
    const y = rand() * height;
    const r = 3 + rand() * 26;

    const bGrad = bCtx.createRadialGradient(x, y, 0, x, y, r);
    bGrad.addColorStop(0, '#2c2c2c');
    bGrad.addColorStop(0.68, '#585858');
    bGrad.addColorStop(0.88, '#dadada');
    bGrad.addColorStop(1, 'rgba(128,128,128,0)');
    bCtx.fillStyle = bGrad;
    bCtx.beginPath();
    bCtx.arc(x, y, r, 0, Math.PI * 2);
    bCtx.fill();

    const aGrad = aCtx.createRadialGradient(x, y, 0, x, y, r);
    aGrad.addColorStop(0, 'rgba(54, 62, 78, 0.5)');
    aGrad.addColorStop(0.84, 'rgba(220, 228, 240, 0.3)');
    aGrad.addColorStop(1, 'rgba(154, 163, 178, 0)');
    aCtx.fillStyle = aGrad;
    aCtx.beginPath();
    aCtx.arc(x, y, r, 0, Math.PI * 2);
    aCtx.fill();
  }

  const albedo = new THREE.CanvasTexture(albedoCanvas);
  albedo.colorSpace = THREE.SRGBColorSpace;
  albedo.anisotropy = maxAnisotropy;
  albedo.needsUpdate = true;

  const bump = new THREE.CanvasTexture(bumpCanvas);
  bump.anisotropy = maxAnisotropy;
  bump.needsUpdate = true;

  return { albedo, bump };
}

function createEarthTexture(maxAnisotropy: number): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const ctx = c.getContext('2d')!;

  ctx.fillStyle = '#0c4a6e';
  ctx.fillRect(0, 0, 512, 256);

  const grad = ctx.createRadialGradient(210, 120, 20, 256, 128, 260);
  grad.addColorStop(0, '#0284c7');
  grad.addColorStop(1, '#082f49');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 512, 256);

   ctx.fillStyle = '#22c55e';
  ctx.globalAlpha = 0.72;
  const blobs = [
    [130, 105, 48, 32],
    [170, 155, 28, 36],
    [295, 92, 54, 30],
    [325, 138, 36, 40],
    [410, 118, 42, 28],
  ];
  blobs.forEach(([x, y, rx, ry]) => {
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0.35, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = '#f8fafc';
  ctx.globalAlpha = 0.34;
  for (let i = 0; i < 14; i++) {
    ctx.beginPath();
    ctx.ellipse(
      (i * 73) % 512,
      36 + ((i * 41) % 180),
      52,
      8,
      0.15,
      0,
      Math.PI * 2
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = maxAnisotropy;
  tex.needsUpdate = true;
  return tex;
}

function createGatewaySatellite(): {
  group: THREE.Group;
  dispose: () => void;
} {
  const group = new THREE.Group();

  const hullGeo = new THREE.CylinderGeometry(0.052, 0.052, 0.19, 12);
  const hullMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    metalness: 0.72,
    roughness: 0.25,
  });
  const hull = new THREE.Mesh(hullGeo, hullMat);
  hull.rotation.z = Math.PI / 2;
  group.add(hull);

   const goldGeo = new THREE.CylinderGeometry(0.06, 0.06, 0.08, 12);
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xf59e0b,
    metalness: 0.85,
    roughness: 0.2,
  });
  const goldModule = new THREE.Mesh(goldGeo, goldMat);
  goldModule.rotation.z = Math.PI / 2;
  goldModule.position.x = -0.035;
  group.add(goldModule);

  // Twin Solar Wings
  const wingGeo = new THREE.BoxGeometry(0.085, 0.01, 0.42);
  const wingMat = new THREE.MeshStandardMaterial({
    color: 0x0284c7,
    metalness: 0.4,
    roughness: 0.2,
    emissive: 0x0ea5e9,
    emissiveIntensity: 0.45,
  });
  const wings = new THREE.Mesh(wingGeo, wingMat);
  group.add(wings);

  const dishGeo = new THREE.ConeGeometry(0.04, 0.03, 12, 1, true);
  const dishMat = new THREE.MeshStandardMaterial({
    color: 0xf8fafc,
    metalness: 0.5,
    roughness: 0.3,
    side: THREE.DoubleSide,
  });
  const dish = new THREE.Mesh(dishGeo, dishMat);
  dish.position.set(0.11, 0.025, 0);
  dish.rotation.z = -Math.PI / 2;
  group.add(dish);

  // Thruster glow
  const thrustGeo = new THREE.SphereGeometry(0.024, 8, 8);
  const thrustMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
  const thruster = new THREE.Mesh(thrustGeo, thrustMat);
  thruster.position.set(-0.115, 0, 0);
  group.add(thruster);

  return {
    group,
    dispose: () => {
      hullGeo.dispose();
      hullMat.dispose();
      goldGeo.dispose();
      goldMat.dispose();
      wingGeo.dispose();
      wingMat.dispose();
      dishGeo.dispose();
      dishMat.dispose();
      thrustGeo.dispose();
      thrustMat.dispose();
    },
  };
}

export const MoonGlobe: React.FC = () => {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const probe = document.createElement('canvas').getContext('webgl2');
    let isSoftwareGl = true;
    if (probe) {
      const ext = probe.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension('WEBGL_lose_context')?.loseContext();
      isSoftwareGl = /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: 'high-performance',
      });
    } catch {
      return;
    }

    const width = container.clientWidth || window.innerWidth || 1280;
    const height = container.clientHeight || window.innerHeight || 720;

    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setClearColor(0x050914, 1);

    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050914);
    scene.fog = new THREE.FogExp2(0x050914, 0.025);

    const camera = new THREE.PerspectiveCamera(38, width / height, 0.1, 100);
    camera.position.set(0, 0.15, 5.2);

    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();

    const heroStage = new THREE.Group();
    scene.add(heroStage);

    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    const { albedo, bump } = createMoonTextures(maxAniso);

    const moonGeo = new THREE.SphereGeometry(
      1.48,
      isSoftwareGl ? 40 : 64,
      isSoftwareGl ? 28 : 48
    );
    const moonMat = new THREE.MeshStandardMaterial({
      map: albedo,
      bumpMap: bump,
      bumpScale: 0.075,
      roughness: 0.88,
      metalness: 0.05,
    });
    const moonMesh = new THREE.Mesh(moonGeo, moonMat);
    moonMesh.rotation.z = THREE.MathUtils.degToRad(6.5);
    heroStage.add(moonMesh);

    // Subtle atmospheric fresnel halo rim around the Moon
    const haloGeo = new THREE.SphereGeometry(1.56, 36, 24);
    const haloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.075,
      side: THREE.BackSide,
      depthWrite: false,
    });
    const moonHalo = new THREE.Mesh(haloGeo, haloMat);
    heroStage.add(moonHalo);

    const beaconGeo = new THREE.SphereGeometry(0.058, 16, 16);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const beacon = new THREE.Mesh(beaconGeo, beaconMat);
    beacon.position.set(0.16, -1.46, 0.22);
    moonMesh.add(beacon);

    const beamGeo = new THREE.CylinderGeometry(0.012, 0.048, 0.42, 12, 1, true);
    const beamMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const beaconBeam = new THREE.Mesh(beamGeo, beamMat);
    beaconBeam.position.set(0.18, -1.66, 0.24);
    beaconBeam.rotation.z = -0.11;
    beaconBeam.rotation.x = 0.14;
    moonMesh.add(beaconBeam);

    const ringGeo = new THREE.RingGeometry(0.095, 0.135, 32);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.88,
    });
    const landingRing = new THREE.Mesh(ringGeo, ringMat);
    landingRing.position.set(0.16, -1.48, 0.22);
    landingRing.lookAt(0.32, -2.96, 0.44);
    moonMesh.add(landingRing);