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
