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