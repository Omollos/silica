import React, { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { GameState, SkyState } from "../types";

export type InspectId =
  | "earth"
  | "dirt"
  | "solar"
  | "battery"
  | "dome"
  | "oxygen"
  | "greenhouse"
  | "rover";

export type CameraPreset = "overview" | "inside" | "outside";

export interface CommandBayStateSnapshot {
  gameState: GameState;
  sky: SkyState;
  lastChoiceId: string | null;
  currentEventType?: string;
  inspected: InspectId | null;
  cameraPreset: CameraPreset;
  rightPanelOpen?: boolean;
}

interface CommandBay3DProps extends CommandBayStateSnapshot {
  onInspect: (id: InspectId) => void;
}

interface CrewRig {
  name: string;
  roleColor: number;
  root: THREE.Group;
  hips: THREE.Group;
  torso: THREE.Group;
  headGroup: THREE.Group;
  leftArm: THREE.Group;
  rightArm: THREE.Group;
  leftLeg: THREE.Group;
  rightLeg: THREE.Group;
  visorMat: THREE.MeshStandardMaterial;
  stripMat: THREE.MeshBasicMaterial;
  homePos: THREE.Vector3;
  homeYaw: number;
  propBlock: THREE.Mesh;
  propBlockMat: THREE.MeshStandardMaterial;
  toolWrench: THREE.Group;
  toolTablet: THREE.Group;
  toolBroom: THREE.Group;
  toolScanner: THREE.Group;
}

interface SceneActionDescriptor {
  id: string;
  activeDecision: string;
  headline: string;
  sickAstroIndex: number | null;
  isCold: boolean;
  isFlare: boolean;
  isSheltered: boolean;
  isTreating: boolean;
  isExercising: boolean;
  isGreenhouse: boolean;
  isBuildingBattery: boolean;
  isBakingAir: boolean;
  isShielding: boolean;
  isCleaningSolar: boolean;
  isPanelsDusty: boolean;
  isRoverActive: boolean;
  isPatchingLeak: boolean;
  isAirLeaking: boolean;
  isRationingFood: boolean;
  isEmergencyAir: boolean;
  isFlareWork: boolean;
  isWon: boolean;
  isLost: boolean;
}

export function deriveSceneAction(
  gameState: GameState,
  sky: SkyState,
  lastChoiceId: string | null,
  currentEventType?: string,
): SceneActionDescriptor {
  const { sick, queue, trace, status } = gameState;
  const isLost = status === "lost";
  const isWon = status === "won" || status === "partial";
  const isFlare = sky === "flare";
  const isSheltered = lastChoiceId === "flare_shelter";
  const isFlareWork =
    lastChoiceId === "flare_work" || (isFlare && !isSheltered && !isLost);
  const isTreating = lastChoiceId === "treat_now";
  const isCold = lastChoiceId === "heat_off";
  const isExercising = lastChoiceId === "exercise_yes";
  const isGreenhouse =
    lastChoiceId === "delay_greenhouse" ||
    queue.some((q) => q.choiceId === "delay_greenhouse") ||
    trace.some((t) => t.choiceId === "delay_greenhouse");
  const isBuildingBattery = lastChoiceId === "dirt_build";
  const isBakingAir = lastChoiceId === "dirt_air";
  const isShielding = lastChoiceId === "dirt_shield";
  const isCleaningSolar = lastChoiceId === "clean_yes";
  const isPanelsDusty = (() => {
    let dusty = false;
    for (const t of trace) {
      if (t.choiceId === "clean_skip") dusty = true;
      if (t.choiceId === "clean_yes") dusty = false;
    }
    return dusty;
  })();
  const isRoverActive =
    currentEventType === "dig_ice" ||
    lastChoiceId === "ice_send" ||
    queue.some((q) => q.choiceId === "ice_send");
  const isPatchingLeak = lastChoiceId === "leak_patch";
  const isAirLeaking =
    lastChoiceId === "leak_ignore" ||
    (!isPatchingLeak &&
      (currentEventType === "air_leak" ||
        queue.some((q) => q.choiceId === "leak_ignore")));
  const isRationingFood = lastChoiceId === "delay_eat_less";
  const isEmergencyAir = lastChoiceId === "delay_air";

  let activeDecision = lastChoiceId ?? "nominal";
  let headline = "Open Airlock Active · Crew Patrolling Bay & Moon Surface";

  if (isLost) {
    activeDecision = "lost";
    headline = "Emergency Alert · Station Oxygen & Life Support Offline";
  } else if (isWon) {
    activeDecision = "won";
    headline = "Resupply Landed · All 4 Astronauts Outside Greeting Rocket!";
  } else if (isFlare && isSheltered) {
    activeDecision = "flare_shelter";
    headline = "Airlock Sealed · All 4 Crew Inside Under Cyan Shield Dome";
  } else if (isFlareWork) {
    activeDecision = "flare_work";
    headline = "Solar Storm Exposure · Crew Bracing & Working Through Flare";
  } else {
    switch (lastChoiceId) {
      case "treat_now":
        activeDecision = "treat_now";
        headline =
          "Med. Sam Scanning & Healing Sick Crewmate While Crew Assists";
        break;
      case "treat_rest":
        activeDecision = "treat_rest";
        headline =
          "Crew Illness Worsens · Sick Eng. Leo Resting While Crew Checks Air";
        break;
      case "dirt_build":
        activeDecision = "dirt_build";
        headline =
          "Eng. Leo Carrying & Installing New Battery Box With Crew Support!";
        break;
      case "dirt_air":
        activeDecision = "dirt_air";
        headline =
          "Crew Hauling Moon Dirt Inside to Extract +36 Breathable Oxygen!";
        break;
      case "dirt_shield":
        activeDecision = "dirt_shield";
        headline =
          "Crew Carrying & Stacking Moon Dirt Armor Bricks Over Habitat Roof!";
        break;
      case "heat_on":
        activeDecision = "heat_on";
        headline =
          "Cabin Heating ON · Crew Tuning Heaters & Warming Up Inside Bay";
        break;
      case "heat_off":
        activeDecision = "heat_off";
        headline =
          "Heaters OFF · All 4 Astronauts Shivering Inside Freezing Bay";
        break;
      case "clean_yes":
        activeDecision = "clean_yes";
        headline =
          "Eng. Leo & Sci. Priya Outside Brushing Moon Dust Off Solar Wings!";
        break;
      case "clean_skip":
        activeDecision = "clean_skip";
        headline =
          "Cleaning Skipped · Crew Checking Dimmed Solar & Dust Static";
        break;
      case "delay_greenhouse":
        activeDecision = "delay_greenhouse";
        headline =
          "Crew Outside Planting & Tending CSA Hydroponic Lunar Greenhouse!";
        break;
      case "delay_eat_less":
        activeDecision = "delay_eat_less";
        headline =
          "Supply Ship Late · All 4 Astronauts Sharing Small Ration Packs";
        break;
      case "delay_air":
        activeDecision = "delay_air";
        headline =
          "Crew Cranking Open Emergency Reserve Air Valves at O2 Tanks!";
        break;
      case "exercise_yes":
        activeDecision = "exercise_yes";
        headline = "1/6g Low-Gravity Workout · All 4 Astronauts Exercising!";
        break;
      case "exercise_skip":
        activeDecision = "exercise_skip";
        headline =
          "Exercise Skipped · Crew Stretching Stiff Muscles in Low Gravity";
        break;
      case "ice_send":
        activeDecision = "ice_send";
        headline =
          "Crew Outside Driving Rover & Gathering Shackleton Crater Ice!";
        break;
      case "ice_stay":
        activeDecision = "ice_stay";
        headline =
          "Rover Docked · Crew Staying Inside Conserving Station Batteries";
        break;
      case "leak_patch":
        activeDecision = "leak_patch";
        headline =
          "Eng. Leo Welding Airlock Seal While Maya Presses Regolith Patch!";
        break;
      case "leak_ignore":
        activeDecision = "leak_ignore";
        headline =
          "Airlock Hissing! Crew Reacting to Oxygen Venting Into Space";
        break;
      default:
        if (sick) {
          activeDecision = "treat_rest";
          headline =
            "Crew Illness Alert · Eng. Leo Shivering Inside Command Bay";
        } else if (isAirLeaking) {
          activeDecision = "leak_ignore";
          headline =
            "Airlock Seal Leak · Oxygen Mist Venting Onto Lunar Surface";
        } else if (isRoverActive) {
          activeDecision = "ice_send";
          headline = "Shackleton Crater Ice Sighted · Rover Scanning Rim";
        }
        break;
    }
  }

  return {
    id: activeDecision,
    activeDecision,
    headline,
    sickAstroIndex: sick || lastChoiceId === "treat_rest" ? 1 : null,
    isCold,
    isFlare,
    isSheltered,
    isTreating,
    isExercising,
    isGreenhouse,
    isBuildingBattery,
    isBakingAir,
    isShielding,
    isCleaningSolar,
    isPanelsDusty,
    isRoverActive,
    isPatchingLeak,
    isAirLeaking,
    isRationingFood,
    isEmergencyAir,
    isFlareWork,
    isWon,
    isLost,
  };
}

function buildAstronautRig(
  name: string,
  roleColor: number,
  homePos: THREE.Vector3,
  homeYaw: number,
  scale = 1,
  disposables: Array<{ dispose: () => void }>,
): CrewRig {
  const root = new THREE.Group();
  root.position.copy(homePos);
  root.rotation.y = homeYaw;
  root.scale.setScalar(scale);

  const hips = new THREE.Group();
  hips.position.y = 0.88;
  root.add(hips);

  const suitWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xe2e8f0,
    roughness: 0.4,
    metalness: 0.16,
  });
  const suitJointMat = new THREE.MeshStandardMaterial({
    color: 0x334155,
    roughness: 0.65,
    metalness: 0.35,
  });
  const bootMat = new THREE.MeshStandardMaterial({
    color: 0x1e293b,
    roughness: 0.7,
    metalness: 0.25,
  });
  const roleMat = new THREE.MeshStandardMaterial({
    color: roleColor,
    roughness: 0.35,
    metalness: 0.3,
    emissive: roleColor,
    emissiveIntensity: 0.25,
  });
  const visorMat = new THREE.MeshStandardMaterial({
    color: 0x0ea5e9,
    roughness: 0.12,
    metalness: 0.85,
    emissive: 0x0284c7,
    emissiveIntensity: 0.55,
  });
  const stripMat = new THREE.MeshBasicMaterial({
    color: roleColor,
  });

  disposables.push(
    suitWhiteMat,
    suitJointMat,
    bootMat,
    roleMat,
    visorMat,
    stripMat,
  );

  const pelvisGeo = new THREE.CylinderGeometry(0.21, 0.2, 0.2, 12);
  disposables.push(pelvisGeo);
  const pelvis = new THREE.Mesh(pelvisGeo, suitJointMat);
  hips.add(pelvis);

  const torso = new THREE.Group();
  torso.position.y = 0.08;
  hips.add(torso);

  const chestGeo = new THREE.BoxGeometry(0.44, 0.52, 0.28);
  const packGeo = new THREE.BoxGeometry(0.36, 0.56, 0.22);
  const chestPlateGeo = new THREE.BoxGeometry(0.26, 0.24, 0.05);
  const stripGeo = new THREE.BoxGeometry(0.05, 0.32, 0.04);
  const collarGeo = new THREE.TorusGeometry(0.17, 0.032, 8, 18);
  const exoBarGeo = new THREE.BoxGeometry(0.42, 0.08, 0.08);
  const chestStripGeo = new THREE.BoxGeometry(0.16, 0.05, 0.04);
  disposables.push(
    chestGeo,
    packGeo,
    chestPlateGeo,
    stripGeo,
    collarGeo,
    exoBarGeo,
    chestStripGeo,
  );

  const chest = new THREE.Mesh(chestGeo, suitWhiteMat);
  chest.position.y = 0.28;
  torso.add(chest);

  const pack = new THREE.Mesh(packGeo, suitJointMat);
  pack.position.set(0, 0.3, -0.22);
  torso.add(pack);

  const exoTop = new THREE.Mesh(exoBarGeo, roleMat);
  exoTop.position.set(0, 0.5, -0.26);
  torso.add(exoTop);

  const packGlow = new THREE.Mesh(stripGeo, stripMat);
  packGlow.position.set(0, 0.3, -0.34);
  torso.add(packGlow);

  const chestPlate = new THREE.Mesh(chestPlateGeo, suitJointMat);
  chestPlate.position.set(0, 0.31, 0.15);
  torso.add(chestPlate);

  const chestStrip = new THREE.Mesh(chestStripGeo, stripMat);
  chestStrip.position.set(0, 0.34, 0.17);
  torso.add(chestStrip);

  const collar = new THREE.Mesh(collarGeo, suitJointMat);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 0.56;
  torso.add(collar);

  const headGroup = new THREE.Group();
  headGroup.position.y = 0.68;
  torso.add(headGroup);

  const helmetGeo = new THREE.SphereGeometry(0.21, 16, 14);
  const visorGeo = new THREE.SphereGeometry(
    0.165,
    14,
    12,
    0,
    Math.PI,
    0.22,
    Math.PI * 0.58,
  );
  const earPodGeo = new THREE.CylinderGeometry(0.055, 0.055, 0.44, 10);
  disposables.push(helmetGeo, visorGeo, earPodGeo);

  const helmet = new THREE.Mesh(helmetGeo, suitWhiteMat);
  headGroup.add(helmet);

  const visor = new THREE.Mesh(visorGeo, visorMat);
  visor.position.set(0, 0.02, 0.08);
  visor.rotation.y = -Math.PI / 2;
  headGroup.add(visor);

  const earPod = new THREE.Mesh(earPodGeo, roleMat);
  earPod.rotation.z = Math.PI / 2;
  headGroup.add(earPod);

  const armUpperGeo = new THREE.CylinderGeometry(0.072, 0.064, 0.32, 10);
  const shoulderGeo = new THREE.SphereGeometry(0.085, 10, 10);
  const armForeGeo = new THREE.CylinderGeometry(0.064, 0.054, 0.28, 10);
  const gloveGeo = new THREE.SphereGeometry(0.068, 10, 10);
  disposables.push(armUpperGeo, shoulderGeo, armForeGeo, gloveGeo);

  const makeArm = (side: -1 | 1) => {
    const arm = new THREE.Group();
    arm.position.set(side * 0.29, 0.49, 0);
    const sh = new THREE.Mesh(shoulderGeo, roleMat);
    arm.add(sh);
    const upper = new THREE.Mesh(armUpperGeo, suitWhiteMat);
    upper.position.y = -0.15;
    arm.add(upper);
    const elbow = new THREE.Mesh(shoulderGeo, suitJointMat);
    elbow.scale.setScalar(0.8);
    elbow.position.y = -0.31;
    arm.add(elbow);
    const fore = new THREE.Mesh(armForeGeo, suitWhiteMat);
    fore.position.set(0, -0.43, 0.04);
    fore.rotation.x = -0.25;
    arm.add(fore);
    const glove = new THREE.Mesh(gloveGeo, suitJointMat);
    glove.position.set(0, -0.56, 0.08);
    arm.add(glove);
    torso.add(arm);
    return arm;
  };
  const leftArm = makeArm(-1);
  const rightArm = makeArm(1);

  const thighGeo = new THREE.CylinderGeometry(0.095, 0.08, 0.42, 10);
  const shinGeo = new THREE.CylinderGeometry(0.082, 0.075, 0.4, 10);
  const bootGeo = new THREE.BoxGeometry(0.16, 0.12, 0.27);
  disposables.push(thighGeo, shinGeo, bootGeo);

  const makeLeg = (side: -1 | 1) => {
    const leg = new THREE.Group();
    leg.position.set(side * 0.13, -0.04, 0);
    const thigh = new THREE.Mesh(thighGeo, suitWhiteMat);
    thigh.position.y = -0.2;
    leg.add(thigh);
    const knee = new THREE.Mesh(shoulderGeo, suitJointMat);
    knee.position.set(0, -0.41, 0.02);
    leg.add(knee);
    const shin = new THREE.Mesh(shinGeo, suitWhiteMat);
    shin.position.y = -0.62;
    leg.add(shin);
    const boot = new THREE.Mesh(bootGeo, bootMat);
    boot.position.set(0, -0.8, 0.05);
    leg.add(boot);
    hips.add(leg);
    return leg;
  };
  const leftLeg = makeLeg(-1);
  const rightLeg = makeLeg(1);

  // Reusable Hand Props & Tools so Astronauts physically act out every choice!
  const propBlockGeo = new THREE.BoxGeometry(0.32, 0.24, 0.24);
  const propBlockMat = new THREE.MeshStandardMaterial({
    color: 0xfbbf24,
    emissive: 0xf59e0b,
    emissiveIntensity: 0.45,
    roughness: 0.35,
    metalness: 0.3,
  });
  const propBlock = new THREE.Mesh(propBlockGeo, propBlockMat);
  propBlock.position.set(-0.18, -0.55, 0.22);
  propBlock.visible = false;
  rightArm.add(propBlock);

  // Wrench / Welder Tool (Right Hand)
  const toolWrench = new THREE.Group();
  toolWrench.position.set(0, -0.56, 0.16);
  const wrenchHandleGeo = new THREE.CylinderGeometry(0.024, 0.024, 0.32, 8);
  const wrenchHeadGeo = new THREE.BoxGeometry(0.11, 0.06, 0.06);
  const wrenchTipMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
  const wHandle = new THREE.Mesh(wrenchHandleGeo, suitJointMat);
  wHandle.rotation.x = Math.PI / 2;
  const wHead = new THREE.Mesh(wrenchHeadGeo, wrenchTipMat);
  wHead.position.set(0, 0, 0.16);
  toolWrench.add(wHandle, wHead);
  toolWrench.visible = false;
  rightArm.add(toolWrench);

  // Command Tablet (Left Hand)
  const toolTablet = new THREE.Group();
  toolTablet.position.set(0, -0.55, 0.17);
  const tabletBodyGeo = new THREE.BoxGeometry(0.24, 0.03, 0.18);
  const tabletScreenGeo = new THREE.PlaneGeometry(0.2, 0.14);
  const tabletMat = new THREE.MeshBasicMaterial({
    color: 0x38bdf8,
    side: THREE.DoubleSide,
  });
  const tBody = new THREE.Mesh(tabletBodyGeo, suitJointMat);
  const tScreen = new THREE.Mesh(tabletScreenGeo, tabletMat);
  tScreen.rotation.x = -Math.PI / 2;
  tScreen.position.y = 0.018;
  toolTablet.add(tBody, tScreen);
  toolTablet.visible = false;
  leftArm.add(toolTablet);

  // Lunar Solar Brush / Broom (Right Hand)
  const toolBroom = new THREE.Group();
  toolBroom.position.set(0, -0.55, 0.14);
  const broomShaftGeo = new THREE.CylinderGeometry(0.02, 0.02, 0.95, 8);
  const broomHeadGeo = new THREE.BoxGeometry(0.36, 0.07, 0.12);
  const bShaft = new THREE.Mesh(broomShaftGeo, suitJointMat);
  bShaft.rotation.x = Math.PI * 0.45;
  bShaft.position.set(0, -0.1, 0.35);
  const bHead = new THREE.Mesh(broomHeadGeo, roleMat);
  bHead.position.set(0, -0.18, 0.8);
  toolBroom.add(bShaft, bHead);
  toolBroom.visible = false;
  rightArm.add(toolBroom);

  // Medical Scanner (Right Hand)
  const toolScanner = new THREE.Group();
  toolScanner.position.set(0, -0.56, 0.15);
  const scanBodyGeo = new THREE.BoxGeometry(0.08, 0.08, 0.24);
  const scanTipMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
  const sBody = new THREE.Mesh(scanBodyGeo, suitJointMat);
  const sTip = new THREE.Mesh(wrenchHeadGeo, scanTipMat);
  sTip.position.set(0, 0, 0.13);
  toolScanner.add(sBody, sTip);
  toolScanner.visible = false;
  rightArm.add(toolScanner);

  disposables.push(
    propBlockGeo,
    propBlockMat,
    wrenchHandleGeo,
    wrenchHeadGeo,
    wrenchTipMat,
    tabletBodyGeo,
    tabletScreenGeo,
    tabletMat,
    broomShaftGeo,
    broomHeadGeo,
    scanBodyGeo,
    scanTipMat,
  );

  return {
    name,
    roleColor,
    root,
    hips,
    torso,
    headGroup,
    leftArm,
    rightArm,
    leftLeg,
    rightLeg,
    visorMat,
    stripMat,
    homePos,
    homeYaw,
    propBlock,
    propBlockMat,
    toolWrench,
    toolTablet,
    toolBroom,
    toolScanner,
  };
}

function drawLifeSupportCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: CommandBayStateSnapshot,
  act: SceneActionDescriptor,
) {
  ctx.clearRect(0, 0, w, h);

  ctx.fillStyle = act.isLost
    ? "rgba(69, 10, 24, 0.88)"
    : act.isFlare
      ? "rgba(67, 20, 7, 0.86)"
      : "rgba(8, 32, 58, 0.86)";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = act.isLost
    ? "#fb7185"
    : act.isFlare
      ? "#f59e0b"
      : "#38bdf8";
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.fillStyle = act.isFlare ? "#fde68a" : "#7dd3fc";
  ctx.font = 'bold 20px "JetBrains Mono", monospace';
  ctx.fillText("STATION LIFE SUPPORT", 20, 34);

  ctx.fillStyle = "#94a3b8";
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillText(
    `ROUND ${snap.gameState.round}/12 · ${snap.sky.toUpperCase()}`,
    20,
    56,
  );

  const drawBar = (
    y: number,
    label: string,
    val: number,
    max: number,
    color: string,
  ) => {
    ctx.fillStyle = "#e2e8f0";
    ctx.font = 'bold 17px "JetBrains Mono", monospace';
    ctx.fillText(label, 20, y);
    ctx.fillText(`${val}/${max}`, w - 108, y);

    ctx.fillStyle = "rgba(15, 23, 42, 0.9)";
    ctx.fillRect(20, y + 8, w - 40, 16);
    ctx.fillStyle = color;
    const pct = Math.max(0, Math.min(1, val / Math.max(1, max)));
    ctx.fillRect(20, y + 8, Math.max(4, (w - 40) * pct), 16);
  };

  drawBar(
    94,
    "POWER",
    snap.gameState.power,
    snap.gameState.powerCap,
    snap.gameState.power <= 15 ? "#f43f5e" : "#fbbf24",
  );
  drawBar(
    144,
    "OXYGEN",
    snap.gameState.oxygen,
    snap.gameState.oxygenCap,
    snap.gameState.oxygen <= 25 ? "#f43f5e" : "#38bdf8",
  );
  drawBar(
    194,
    "SHIELD",
    Math.min(30, snap.gameState.shield),
    30,
    act.isFlare ? "#fb923c" : "#a78bfa",
  );

  ctx.fillStyle = act.isCold
    ? "#67e8f9"
    : act.isGreenhouse
      ? "#4ade80"
      : "#cbd5e1";
  ctx.font = 'bold 15px "JetBrains Mono", monospace';
  ctx.fillText(
    act.isCold
      ? "THERMAL: HEATERS OFF!"
      : act.isGreenhouse
        ? "CSA POD: OUTDOOR FARMING"
        : `MOON DIRT: ${snap.gameState.moonDirt} UNITS`,
    20,
    244,
  );
}

function drawCrewBioCanvas(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  snap: CommandBayStateSnapshot,
  act: SceneActionDescriptor,
) {
  ctx.clearRect(0, 0, w, h);

  const alertMode = act.sickAstroIndex !== null || act.isLost || act.isFlare;
  ctx.fillStyle = alertMode
    ? "rgba(54, 15, 24, 0.88)"
    : act.isTreating || act.isGreenhouse
      ? "rgba(6, 46, 36, 0.86)"
      : "rgba(12, 29, 52, 0.86)";
  ctx.fillRect(0, 0, w, h);

  ctx.strokeStyle = alertMode
    ? "#fb7185"
    : act.isTreating
      ? "#34d399"
      : "#fbbf24";
  ctx.lineWidth = 4;
  ctx.strokeRect(4, 4, w - 8, h - 8);

  ctx.fillStyle = alertMode ? "#fda4af" : "#fde68a";
  ctx.font = 'bold 20px "JetBrains Mono", monospace';
  ctx.fillText("CREW & EVA TRACKER", 20, 34);

  ctx.fillStyle = "#e2e8f0";
  ctx.font = 'bold 16px "JetBrains Mono", monospace';
  ctx.fillText(`CREW HEALTH: ${snap.gameState.health}%`, 20, 62);

  // Stylized bio figure
  ctx.strokeStyle = alertMode ? "#fb7185" : "#38bdf8";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(68, 108, 16, 0, Math.PI * 2);
  ctx.stroke();
  ctx.strokeRect(48, 130, 40, 56);
  ctx.beginPath();
  ctx.moveTo(48, 138);
  ctx.lineTo(32, 175);
  ctx.moveTo(88, 138);
  ctx.lineTo(104, 175);
  ctx.moveTo(58, 186);
  ctx.lineTo(54, 224);
  ctx.moveTo(78, 186);
  ctx.lineTo(82, 224);
  ctx.stroke();

  if (act.sickAstroIndex !== null) {
    ctx.fillStyle = "rgba(244, 63, 94, 0.5)";
    ctx.beginPath();
    ctx.arc(68, 154, 18, 0, Math.PI * 2);
    ctx.fill();
  }

  const statusFor = (idx: number): string => {
    switch (act.activeDecision) {
      case "lost":
        return "OFFLINE";
      case "won":
        return "CHEERING";
      case "dirt_build":
        return idx === 1
          ? "PLACING"
          : idx === 2
            ? "WIRING"
            : idx === 0
              ? "DIRECTING"
              : "METER";
      case "dirt_air":
        return idx === 1 || idx === 2 ? "HAULING" : "O2 PREP";
      case "dirt_shield":
        return idx === 0 ? "DIRECTING" : idx === 3 ? "CONSOLE" : "STACKING";
      case "heat_on":
        return idx === 1 ? "HEATER" : "WARMING";
      case "heat_off":
        return "COLD!";
      case "clean_yes":
        return idx === 1 ? "SWEEPING" : idx === 2 ? "EVA SUN" : "MONITOR";
      case "clean_skip":
        return "DUST CHK";
      case "delay_greenhouse":
        return idx === 2 || idx === 3 ? "PLANTING" : "CSA POD";
      case "delay_eat_less":
        return "RATIONS";
      case "delay_air":
        return idx === 1 || idx === 2 ? "O2 VALVE" : "MONITOR";
      case "treat_now":
        return idx === 3 ? "SCANNING" : idx === 1 ? "HEALING" : "ASSIST";
      case "treat_rest":
        return idx === 1 ? "SICK!" : "CONCERN";
      case "flare_shelter":
        return "SHELTER";
      case "flare_work":
        return "BRACING!";
      case "exercise_yes":
        return "WORKOUT";
      case "exercise_skip":
        return "FATIGUE";
      case "ice_send":
        return idx === 0 ? "ROVER" : idx === 2 ? "MINING" : "EVA ICE";
      case "ice_stay":
        return "STANDBY";
      case "leak_patch":
        return idx === 1 ? "WELDING" : idx === 0 ? "SEALING" : "PRESSURE";
      case "leak_ignore":
        return "AIR LEAK!";
      default:
        return idx === 1 || idx === 2
          ? "EVA/BAY"
          : idx === 0
            ? "BAY CMD"
            : "MED BAY";
    }
  };

  const crewList = [
    { name: "MAYA", state: statusFor(0), color: "#38bdf8" },
    {
      name: "LEO",
      state: statusFor(1),
      color: act.sickAstroIndex === 1 ? "#fb7185" : "#fbbf24",
    },
    { name: "PRIYA", state: statusFor(2), color: "#34d399" },
    { name: "SAM", state: statusFor(3), color: "#a78bfa" },
  ];

  crewList.forEach((c, idx) => {
    const ry = 104 + idx * 34;
    ctx.fillStyle = c.color;
    ctx.fillRect(128, ry - 12, 8, 18);
    ctx.fillStyle = "#f8fafc";
    ctx.font = 'bold 15px "JetBrains Mono", monospace';
    ctx.fillText(c.name, 144, ry + 2);
    ctx.fillStyle =
      c.state.includes("!") || c.state === "OFFLINE" || c.state === "COLD!"
        ? "#fda4af"
        : "#7dd3fc";
    ctx.fillText(c.state, w - 112, ry + 2);
  });

  ctx.fillStyle = alertMode ? "#fecdd3" : "#94a3b8";
  ctx.font = 'bold 14px "JetBrains Mono", monospace';
  ctx.fillText(
    act.sickAstroIndex !== null
      ? "STATUS: COLD ILLNESS DETECTED"
      : act.isSheltered
        ? "STATUS: AIRLOCK SEALED · SHIELD"
        : act.isExercising
          ? "STATUS: 1/6G EVA EXERCISE"
          : "STATUS: AIRLOCK & EVA NOMINAL",
    20,
    244,
  );
}

export const CommandBay3D: React.FC<CommandBay3DProps> = ({
  gameState,
  sky,
  lastChoiceId,
  currentEventType,
  inspected,
  cameraPreset,
  rightPanelOpen = true,
  onInspect,
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const [webglError, setWebglError] = useState(false);
  const stateRef = useRef<CommandBayStateSnapshot>({
    gameState,
    sky,
    lastChoiceId,
    currentEventType,
    inspected,
    cameraPreset,
    rightPanelOpen,
  });
  const onInspectRef = useRef(onInspect);
  const redrawScreensRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    stateRef.current = {
      gameState,
      sky,
      lastChoiceId,
      currentEventType,
      inspected,
      cameraPreset,
      rightPanelOpen,
    };
    redrawScreensRef.current?.();
  }, [
    gameState,
    sky,
    lastChoiceId,
    currentEventType,
    inspected,
    cameraPreset,
    rightPanelOpen,
  ]);

  useEffect(() => {
    onInspectRef.current = onInspect;
  }, [onInspect]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const probe = document.createElement("canvas").getContext("webgl2");
    let isSoftwareGl = true;
    if (probe) {
      const ext = probe.getExtension("WEBGL_debug_renderer_info");
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : probe.RENDERER;
      const gpu = String(probe.getParameter(param));
      probe.getExtension("WEBGL_lose_context")?.loseContext();
      isSoftwareGl =
        /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    }

    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: !isSoftwareGl,
        alpha: false,
        powerPreference: "high-performance",
      });
    } catch {
      setWebglError(true);
      return;
    }

    const width = container.clientWidth || window.innerWidth || 1280;
    const height = container.clientHeight || window.innerHeight || 720;

    renderer.setPixelRatio(
      isSoftwareGl ? 1 : Math.min(window.devicePixelRatio || 1, 2),
    );
    renderer.setSize(width, height);
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setClearColor(0x050914, 1);

    container.appendChild(renderer.domElement);

    const disposables: Array<{ dispose: () => void }> = [];

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x050914);
    scene.fog = new THREE.FogExp2(0x050914, 0.012);

    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 140);
    camera.position.set(1.85, 3.4, 8.6);
    const cameraTarget = new THREE.Vector3(2.05, 1.15, -1.65);
    camera.lookAt(cameraTarget);

    // Metallic IBL reflections
    const pmrem = new THREE.PMREMGenerator(renderer);
    const roomEnv = new RoomEnvironment();
    const envTarget = pmrem.fromScene(roomEnv, 0.04);
    scene.environment = envTarget.texture;
    roomEnv.dispose();
    pmrem.dispose();
    disposables.push(envTarget);

    // Three-point indoor + lunar exterior lighting
    const hemiLight = new THREE.HemisphereLight(0xcbe6ff, 0x1e293b, 0.9);
    scene.add(hemiLight);

    const sunKey = new THREE.DirectionalLight(0xfff4df, 1.9);
    sunKey.position.set(9, 10, 6);
    scene.add(sunKey);

    const bayCenterLight = new THREE.PointLight(0x38bdf8, 4.4, 16, 1.5);
    bayCenterLight.position.set(-1.3, 4.1, -0.4);
    scene.add(bayCenterLight);

    const evaExteriorLight = new THREE.PointLight(0xe0f2fe, 3.2, 18, 1.4);
    evaExteriorLight.position.set(5.4, 4.2, 1.2);
    scene.add(evaExteriorLight);

    // ------------------------------------------------------------------
    // 1. OPEN SHACKLETON CRATER LUNAR ENVIRONMENT (RIGHT & HORIZON)
    // ------------------------------------------------------------------
    const extGroup = new THREE.Group();
    scene.add(extGroup);

    // Starfield InstancedMesh
    const starCount = 190;
    const starGeo = new THREE.SphereGeometry(0.065, 5, 5);
    const starMat = new THREE.MeshBasicMaterial({ color: 0xf1f5f9 });
    disposables.push(starGeo, starMat);
    const starInst = new THREE.InstancedMesh(starGeo, starMat, starCount);
    const dummy = new THREE.Object3D();
    let seed = 8817;
    const srand = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    for (let i = 0; i < starCount; i++) {
      const ang = -Math.PI * 0.95 + srand() * Math.PI * 1.1;
      const rad = 28 + srand() * 16;
      const py = 2.6 + srand() * 13;
      dummy.position.set(Math.cos(ang) * rad, py, Math.sin(ang) * rad - 4);
      dummy.scale.setScalar(0.5 + srand() * 1.3);
      dummy.updateMatrix();
      starInst.setMatrixAt(i, dummy.matrix);
    }
    starInst.instanceMatrix.needsUpdate = true;
    extGroup.add(starInst);

    // Planet Earth in starry lunar sky
    const earthGroup = new THREE.Group();
    earthGroup.position.set(-6.5, 6.8, -18);
    extGroup.add(earthGroup);
    const earthMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      roughness: 0.45,
      emissive: 0x0369a1,
      emissiveIntensity: 0.45,
    });
    const earthLandMat = new THREE.MeshStandardMaterial({
      color: 0x4ade80,
      roughness: 0.65,
    });
    const earthHaloMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.22,
    });
    const earthGeo = new THREE.SphereGeometry(1.45, 20, 16);
    const landGeo = new THREE.SphereGeometry(0.48, 10, 8);
    const haloGeo = new THREE.SphereGeometry(1.75, 16, 12);
    disposables.push(
      earthMat,
      earthLandMat,
      earthHaloMat,
      earthGeo,
      landGeo,
      haloGeo,
    );
    const earthMesh = new THREE.Mesh(earthGeo, earthMat);
    const land1 = new THREE.Mesh(landGeo, earthLandMat);
    land1.position.set(-0.4, 0.35, 1.05);
    land1.scale.set(1.2, 0.7, 0.4);
    const land2 = new THREE.Mesh(landGeo, earthLandMat);
    land2.position.set(0.45, -0.25, 1.08);
    land2.scale.set(0.9, 1.1, 0.4);
    const earthHalo = new THREE.Mesh(haloGeo, earthHaloMat);
    earthGroup.add(earthMesh, land1, land2, earthHalo);

    // Sun & Solar Flare Plasma Arcs
    const sunOrbMat = new THREE.MeshBasicMaterial({ color: 0xfef08a });
    const sunHaloMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.32,
    });
    const sunOrbGeo = new THREE.SphereGeometry(1.15, 16, 12);
    disposables.push(sunOrbMat, sunHaloMat, sunOrbGeo);
    const sunGroup = new THREE.Group();
    sunGroup.position.set(11.5, 7.2, -18);
    const sunOrb = new THREE.Mesh(sunOrbGeo, sunOrbMat);
    const sunHalo = new THREE.Mesh(sunOrbGeo, sunHaloMat);
    sunHalo.scale.setScalar(1.75);
    sunGroup.add(sunOrb, sunHalo);
    extGroup.add(sunGroup);

    const flareArcMat = new THREE.MeshBasicMaterial({
      color: 0xfb7185,
      transparent: true,
      opacity: 0.85,
    });
    const flareArcGeo = new THREE.TorusGeometry(
      7.2,
      0.16,
      8,
      32,
      Math.PI * 0.75,
    );
    disposables.push(flareArcMat, flareArcGeo);
    const flareArc = new THREE.Mesh(flareArcGeo, flareArcMat);
    flareArc.position.set(3.5, 4.8, -12);
    flareArc.rotation.z = 0.35;
    flareArc.visible = false;
    extGroup.add(flareArc);

    // Sculpted Moon Surface Ground, Craters, Rocks, Ice Crystals & Mountains
    const regolithMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.92,
      metalness: 0.04,
    });
    const craterDarkMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      roughness: 0.95,
    });
    const craterRimMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.88,
    });
    const moonGroundGeo = new THREE.PlaneGeometry(54, 42);
    const ridgeGeo = new THREE.ConeGeometry(4.5, 3.6, 6);
    const craterRimGeo = new THREE.TorusGeometry(1.7, 0.18, 8, 24);
    const boulderGeo = new THREE.DodecahedronGeometry(0.32, 0);
    const iceMat = new THREE.MeshStandardMaterial({
      color: 0x67e8f9,
      emissive: 0x06b6d4,
      emissiveIntensity: 0.65,
      roughness: 0.15,
    });
    const iceCrystalGeo = new THREE.ConeGeometry(0.18, 0.55, 5);
    disposables.push(
      regolithMat,
      craterDarkMat,
      craterRimMat,
      moonGroundGeo,
      ridgeGeo,
      craterRimGeo,
      boulderGeo,
      iceMat,
      iceCrystalGeo,
    );

    const moonSurface = new THREE.Mesh(moonGroundGeo, regolithMat);
    moonSurface.rotation.x = -Math.PI / 2;
    moonSurface.position.set(4, -0.02, -6);
    extGroup.add(moonSurface);

    const mountainCoords = [
      [-14, 1.1, -17, 1.3],
      [-6.5, 0.9, -16.5, 1.1],
      [2.5, 1.2, -17.5, 1.4],
      [10.2, 1.0, -16, 1.25],
      [17.5, 1.2, -16.5, 1.35],
    ];
    mountainCoords.forEach(([mx, my, mz, ms]) => {
      const m = new THREE.Mesh(ridgeGeo, craterDarkMat);
      m.position.set(mx, my, mz);
      m.scale.setScalar(ms);
      extGroup.add(m);
    });

    // Walkable Craters & Rocks out on the open Moon surface
    const craterSpecs = [
      [8.0, -2.5, 1.0],
      [5.5, 3.2, 0.72],
      [10.5, 1.4, 0.85],
    ];
    craterSpecs.forEach(([cx, cz, cs]) => {
      const rim = new THREE.Mesh(craterRimGeo, craterRimMat);
      rim.rotation.x = Math.PI / 2;
      rim.position.set(cx, 0.02, cz);
      rim.scale.setScalar(cs);
      extGroup.add(rim);
    });

    // Shimmering Shackleton Crater Water-Ice Vein in right crater
    [
      [7.7, -2.3],
      [8.1, -2.6],
      [8.35, -2.2],
    ].forEach(([ix, iz], idx) => {
      const ice = new THREE.Mesh(iceCrystalGeo, iceMat);
      ice.position.set(ix, 0.2, iz);
      ice.rotation.z = (idx - 1) * 0.25;
      extGroup.add(ice);
    });

    // Lunar boulders around outdoor EVA field
    [
      [3.6, 2.5, 0.9],
      [6.9, 1.9, 1.1],
      [9.4, -0.4, 0.8],
      [3.4, -4.8, 1.2],
    ].forEach(([bx, bz, bs], i) => {
      const rock = new THREE.Mesh(boulderGeo, craterRimMat);
      rock.position.set(bx, 0.18 * bs, bz);
      rock.rotation.set(i, i * 0.7, 0);
      rock.scale.setScalar(bs);
      extGroup.add(rock);
    });

    // Fluttering Silica Station Flag on lunar soil (x=6.4, z=1.1)
    const poleMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.75,
      roughness: 0.25,
    });
    const flagMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0369a1,
      emissiveIntensity: 0.35,
      side: THREE.DoubleSide,
    });
    const poleGeo = new THREE.CylinderGeometry(0.03, 0.03, 1.7, 8);
    const flagGeo = new THREE.PlaneGeometry(0.75, 0.44);
    disposables.push(poleMat, flagMat, poleGeo, flagGeo);
    const flagPole = new THREE.Mesh(poleGeo, poleMat);
    flagPole.position.set(6.4, 0.85, 1.1);
    const flagCloth = new THREE.Mesh(flagGeo, flagMat);
    flagCloth.position.set(0.39, 0.56, 0);
    flagPole.add(flagCloth);
    extGroup.add(flagPole);

    // Outdoor Moon-Dirt Regolith Mound (walk-up accessible at x=4.6, z=2.0!)
    const dirtPileMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      roughness: 0.9,
    });
    const dirtPileGeo = new THREE.ConeGeometry(1.15, 0.85, 14);
    disposables.push(dirtPileMat, dirtPileGeo);
    const dirtPile = new THREE.Mesh(dirtPileGeo, dirtPileMat);
    dirtPile.position.set(4.6, 0.38, 2.05);
    extGroup.add(dirtPile);

    // Outdoor Solar Wing Array + Wiper + Dust Overlay (x=5.4, z=-4.8)
    const solarArrayGroup = new THREE.Group();
    solarArrayGroup.position.set(5.4, 1.65, -4.8);
    extGroup.add(solarArrayGroup);

    const mastMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.6,
      roughness: 0.35,
    });
    const panelMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      metalness: 0.45,
      roughness: 0.2,
      emissive: 0x0369a1,
      emissiveIntensity: 0.38,
    });
    const dustOverlayMat = new THREE.MeshStandardMaterial({
      color: 0x78716c,
      transparent: true,
      opacity: 0,
      roughness: 0.95,
    });
    const wiperMat = new THREE.MeshBasicMaterial({ color: 0xfde047 });
    const mastGeo = new THREE.CylinderGeometry(0.1, 0.14, 1.85, 10);
    const wingGeo = new THREE.BoxGeometry(3.2, 0.08, 1.25);
    const wiperGeo = new THREE.BoxGeometry(0.12, 0.14, 1.35);
    disposables.push(
      mastMat,
      panelMat,
      dustOverlayMat,
      wiperMat,
      mastGeo,
      wingGeo,
      wiperGeo,
    );

    const solarMast = new THREE.Mesh(mastGeo, mastMat);
    solarMast.position.y = -0.82;
    solarArrayGroup.add(solarMast);

    const solarWingPivot = new THREE.Group();
    solarWingPivot.rotation.x = 0.45;
    solarArrayGroup.add(solarWingPivot);

    const solarWing = new THREE.Mesh(wingGeo, panelMat);
    const solarDust = new THREE.Mesh(wingGeo, dustOverlayMat);
    solarDust.position.y = 0.055;
    const solarWiper = new THREE.Mesh(wiperGeo, wiperMat);
    solarWiper.position.set(-1.3, 0.09, 0);
    solarWiper.visible = false;
    solarWingPivot.add(solarWing, solarDust, solarWiper);

    // Outdoor CSA Hydroponic Lunar Greenhouse Dome (x=4.5, z=-1.55)
    const greenhouseGroup = new THREE.Group();
    greenhouseGroup.position.set(4.5, 0, -1.55);
    extGroup.add(greenhouseGroup);

    const planterGeo = new THREE.BoxGeometry(1.75, 0.36, 1.05);
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xbae6fd,
      transparent: true,
      opacity: 0.18,
      roughness: 0.08,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });
    const growGlassGeo = new THREE.CylinderGeometry(0.86, 0.92, 1.15, 14);
    const growLampMat = new THREE.MeshBasicMaterial({ color: 0x4ade80 });
    const plantLeafMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      emissive: 0x16a34a,
      emissiveIntensity: 0.42,
      roughness: 0.48,
    });
    const leafGeo = new THREE.ConeGeometry(0.16, 0.42, 7);
    const growLampGeo = new THREE.TorusGeometry(0.55, 0.045, 8, 20);
    const trimRibMat = new THREE.MeshStandardMaterial({
      color: 0x475569,
      roughness: 0.38,
      metalness: 0.65,
    });
    disposables.push(
      planterGeo,
      glassMat,
      growGlassGeo,
      growLampMat,
      plantLeafMat,
      leafGeo,
      growLampGeo,
      trimRibMat,
    );

    const planterBox = new THREE.Mesh(planterGeo, trimRibMat);
    planterBox.position.y = 0.18;
    const growCanopy = new THREE.Mesh(growGlassGeo, glassMat);
    growCanopy.position.y = 0.9;
    const growLamp = new THREE.Mesh(growLampGeo, growLampMat);
    growLamp.rotation.x = Math.PI / 2;
    growLamp.position.y = 1.38;
    greenhouseGroup.add(planterBox, growCanopy, growLamp);

    const cropMeshes: THREE.Mesh[] = [];
    [-0.45, 0, 0.45].forEach((cx) => {
      const leaf = new THREE.Mesh(leafGeo, plantLeafMat);
      leaf.position.set(cx, 0.56, 0);
      greenhouseGroup.add(leaf);
      cropMeshes.push(leaf);
    });

    // Outdoor Shackleton Ice Rover (drives dynamically along Moon surface!)
    const roverGroup = new THREE.Group();
    roverGroup.position.set(7.2, 0.05, -0.4);
    extGroup.add(roverGroup);

    const roverBodyMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.35,
      metalness: 0.4,
    });
    const wheelMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.75,
    });
    const roverHeadlightMat = new THREE.MeshBasicMaterial({
      color: 0xfef08a,
      transparent: true,
      opacity: 0.45,
      side: THREE.DoubleSide,
    });
    const roverBodyGeo = new THREE.BoxGeometry(1.25, 0.38, 0.72);
    const wheelGeo = new THREE.CylinderGeometry(0.18, 0.18, 0.14, 12);
    const coneLightGeo = new THREE.ConeGeometry(0.65, 2.2, 12, 1, true);
    const roverMastGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.45, 8);
    disposables.push(
      roverBodyMat,
      wheelMat,
      roverHeadlightMat,
      roverBodyGeo,
      wheelGeo,
      coneLightGeo,
      roverMastGeo,
    );

    const roverChassis = new THREE.Mesh(roverBodyGeo, roverBodyMat);
    roverChassis.position.y = 0.28;
    roverGroup.add(roverChassis);

    const roverMast = new THREE.Mesh(roverMastGeo, mastMat);
    roverMast.position.set(0.38, 0.62, 0);
    roverGroup.add(roverMast);

    const roverBeam = new THREE.Mesh(coneLightGeo, roverHeadlightMat);
    roverBeam.rotation.z = Math.PI / 2;
    roverBeam.position.set(1.65, 0.3, 0);
    roverBeam.visible = false;
    roverGroup.add(roverBeam);

    [-0.45, 0, 0.45].forEach((wx) => {
      [-0.4, 0.4].forEach((wz) => {
        const w = new THREE.Mesh(wheelGeo, wheelMat);
        w.rotation.x = Math.PI / 2;
        w.position.set(wx, 0.14, wz);
        roverGroup.add(w);
      });
    });

    // Outdoor Resupply Rocket & Pad (x=8.5, z=-5.5)
    const padBaseGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.14, 24);
    disposables.push(padBaseGeo);
    const padMesh = new THREE.Mesh(padBaseGeo, trimRibMat);
    padMesh.position.set(8.5, 0.05, -5.5);
    extGroup.add(padMesh);

    const rocketGroup = new THREE.Group();
    rocketGroup.position.set(8.5, 9.5, -5.5);
    extGroup.add(rocketGroup);

    const rocketBodyMat = new THREE.MeshStandardMaterial({
      color: 0xf8fafc,
      roughness: 0.25,
      metalness: 0.55,
    });
    const rocketAccentMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48,
      roughness: 0.35,
    });
    const rocketFlameMat = new THREE.MeshBasicMaterial({ color: 0xfb923c });
    const rocketCylGeo = new THREE.CylinderGeometry(0.42, 0.54, 2.6, 14);
    const rocketNoseGeo = new THREE.ConeGeometry(0.42, 0.9, 14);
    const rocketFlameGeo = new THREE.ConeGeometry(0.32, 1.2, 10);
    disposables.push(
      rocketBodyMat,
      rocketAccentMat,
      rocketFlameMat,
      rocketCylGeo,
      rocketNoseGeo,
      rocketFlameGeo,
    );

    const rBody = new THREE.Mesh(rocketCylGeo, rocketBodyMat);
    rBody.position.y = 1.35;
    const rNose = new THREE.Mesh(rocketNoseGeo, rocketAccentMat);
    rNose.position.y = 3.1;
    const rFlame = new THREE.Mesh(rocketFlameGeo, rocketFlameMat);
    rFlame.rotation.x = Math.PI;
    rFlame.position.y = -0.5;
    rocketGroup.add(rBody, rNose, rFlame);
    rocketGroup.visible = false;

    // ------------------------------------------------------------------
    // 2. OPEN-AIRLOCK COMMAND BAY INTERIOR (LEFT & CENTER-BACK)
    // ------------------------------------------------------------------
    const bayGroup = new THREE.Group();
    bayGroup.position.set(-1.35, 0, 0);
    scene.add(bayGroup);

    const hullWhiteMat = new THREE.MeshStandardMaterial({
      color: 0xdbe2eb,
      roughness: 0.34,
      metalness: 0.32,
    });
    const deckDarkMat = new THREE.MeshStandardMaterial({
      color: 0x1e2532,
      roughness: 0.42,
      metalness: 0.55,
    });
    const deckRingGlowMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
    const floorThermalGlowMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
    });
    disposables.push(
      hullWhiteMat,
      deckDarkMat,
      deckRingGlowMat,
      floorThermalGlowMat,
    );

    const floorBaseGeo = new THREE.CylinderGeometry(4.25, 4.35, 0.14, 36);
    const centralPadGeo = new THREE.CylinderGeometry(1.75, 1.85, 0.04, 32);
    const ringTrackGeo = new THREE.RingGeometry(1.82, 1.94, 42);
    const outerTrackGeo = new THREE.RingGeometry(3.82, 3.92, 42);
    const rampGeo = new THREE.BoxGeometry(2.1, 0.1, 2.25);
    disposables.push(
      floorBaseGeo,
      centralPadGeo,
      ringTrackGeo,
      outerTrackGeo,
      rampGeo,
    );

    const floorMesh = new THREE.Mesh(floorBaseGeo, deckDarkMat);
    floorMesh.position.set(0, 0.03, -0.35);
    bayGroup.add(floorMesh);

    const centralPad = new THREE.Mesh(centralPadGeo, hullWhiteMat);
    centralPad.position.set(0, 0.11, -0.35);
    bayGroup.add(centralPad);

    const centerGlowRing = new THREE.Mesh(ringTrackGeo, deckRingGlowMat);
    centerGlowRing.rotation.x = -Math.PI / 2;
    centerGlowRing.position.set(0, 0.125, -0.35);
    bayGroup.add(centerGlowRing);

    const outerGlowRing = new THREE.Mesh(outerTrackGeo, floorThermalGlowMat);
    outerGlowRing.rotation.x = -Math.PI / 2;
    outerGlowRing.position.set(0, 0.115, -0.35);
    bayGroup.add(outerGlowRing);

    // Metallic Lunar Walk-Out Ramp connecting Command Deck right out onto Moon Soil!
    const airlockRamp = new THREE.Mesh(rampGeo, trimRibMat);
    airlockRamp.position.set(4.0, 0.03, -0.35);
    bayGroup.add(airlockRamp);

    // Curved Bay Arc Bulkhead + Panoramic Windows (stops at Airlock Opening!)
    const panelGeo = new THREE.BoxGeometry(1.9, 1.35, 0.24);
    const pillarGeo = new THREE.BoxGeometry(0.28, 4.15, 0.36);
    const upperBeamGeo = new THREE.BoxGeometry(1.96, 0.48, 0.42);
    const windowGlassGeo = new THREE.PlaneGeometry(1.9, 1.82);
    const shutterGeo = new THREE.BoxGeometry(1.72, 0.52, 0.16);
    const shutterMat = new THREE.MeshStandardMaterial({
      color: 0x64748b,
      roughness: 0.78,
      metalness: 0.3,
    });
    disposables.push(
      panelGeo,
      pillarGeo,
      upperBeamGeo,
      windowGlassGeo,
      shutterGeo,
      shutterMat,
    );

    const bayRadius = 4.15;
    const bayCenterZ = -0.35;
    const roofShutters: THREE.Mesh[] = [];
    const segAngles = [
      -Math.PI * 0.76,
      -Math.PI * 0.52,
      -Math.PI * 0.28,
      -Math.PI * 0.04,
      Math.PI * 0.2,
    ];

    segAngles.forEach((theta) => {
      const px = Math.sin(theta) * bayRadius;
      const pz = bayCenterZ - Math.cos(theta) * bayRadius;

      const segGroup = new THREE.Group();
      segGroup.position.set(px, 0, pz);
      segGroup.rotation.y = -theta;
      bayGroup.add(segGroup);

      const lowerWall = new THREE.Mesh(panelGeo, hullWhiteMat);
      lowerWall.position.y = 0.68;
      segGroup.add(lowerWall);

      const pillar = new THREE.Mesh(pillarGeo, trimRibMat);
      pillar.position.set(-0.98, 2.08, 0.05);
      segGroup.add(pillar);

      const upperBeam = new THREE.Mesh(upperBeamGeo, hullWhiteMat);
      upperBeam.position.set(0, 3.45, 0.1);
      segGroup.add(upperBeam);

      const glassPane = new THREE.Mesh(windowGlassGeo, glassMat);
      glassPane.position.set(0, 2.28, 0.04);
      segGroup.add(glassPane);

      const shutter = new THREE.Mesh(shutterGeo, shutterMat);
      shutter.position.set(0, 3.42, 0.16);
      segGroup.add(shutter);
      roofShutters.push(shutter);
    });

    // Overhead Circular Gantry Halo
    const ceilingGantry = new THREE.Group();
    ceilingGantry.position.set(0, 3.65, -0.35);
    bayGroup.add(ceilingGantry);

    const haloOuterGeo = new THREE.TorusGeometry(2.15, 0.18, 12, 32);
    const haloInnerGeo = new THREE.TorusGeometry(1.18, 0.09, 10, 28);
    const haloLightMat = new THREE.MeshBasicMaterial({ color: 0xe0f2fe });
    disposables.push(haloOuterGeo, haloInnerGeo, haloLightMat);

    const haloOuter = new THREE.Mesh(haloOuterGeo, hullWhiteMat);
    haloOuter.rotation.x = Math.PI / 2;
    ceilingGantry.add(haloOuter);

    const haloInner = new THREE.Mesh(haloInnerGeo, haloLightMat);
    haloInner.rotation.x = Math.PI / 2;
    haloInner.position.y = -0.2;
    ceilingGantry.add(haloInner);

    // Walk-Through Sliding Airlock Portal (at local x = +3.35, world x = +2.0!)
    const airlockPortal = new THREE.Group();
    airlockPortal.position.set(3.35, 0, -0.35);
    bayGroup.add(airlockPortal);

    const portalPostGeo = new THREE.BoxGeometry(0.24, 2.45, 0.34);
    const portalHeaderGeo = new THREE.BoxGeometry(0.32, 0.38, 2.55);
    const sealLightMat = new THREE.MeshBasicMaterial({ color: 0x34d399 });
    const sealLightGeo = new THREE.BoxGeometry(0.36, 0.1, 1.9);
    const doorWingGeo = new THREE.BoxGeometry(0.1, 2.05, 1.05);
    disposables.push(
      portalPostGeo,
      portalHeaderGeo,
      sealLightMat,
      sealLightGeo,
      doorWingGeo,
    );

    const postF = new THREE.Mesh(portalPostGeo, hullWhiteMat);
    postF.position.set(0, 1.22, 1.15);
    const postB = new THREE.Mesh(portalPostGeo, hullWhiteMat);
    postB.position.set(0, 1.22, -1.15);
    const header = new THREE.Mesh(portalHeaderGeo, hullWhiteMat);
    header.position.set(0, 2.38, 0);
    const airlockBeacon = new THREE.Mesh(sealLightGeo, sealLightMat);
    airlockBeacon.position.set(0.05, 2.54, 0);
    airlockPortal.add(postF, postB, header, airlockBeacon);

    const airlockDoorL = new THREE.Mesh(doorWingGeo, glassMat);
    airlockDoorL.position.set(0, 1.05, -0.52);
    const airlockDoorR = new THREE.Mesh(doorWingGeo, glassMat);
    airlockDoorR.position.set(0, 1.05, 0.52);
    airlockPortal.add(airlockDoorL, airlockDoorR);

    // Center Cyan Shelter Force-Field Dome inside Bay
    const forceShieldMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      transparent: true,
      opacity: 0.24,
      side: THREE.DoubleSide,
    });
    const forceShieldWireMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.42,
      wireframe: true,
    });
    const forceShieldGeo = new THREE.SphereGeometry(
      1.95,
      18,
      14,
      0,
      Math.PI * 2,
      0,
      Math.PI * 0.52,
    );
    disposables.push(forceShieldMat, forceShieldWireMat, forceShieldGeo);
    const shelterDomeGroup = new THREE.Group();
    shelterDomeGroup.position.set(0, 0.1, -0.35);
    const shelterShell = new THREE.Mesh(forceShieldGeo, forceShieldMat);
    const shelterWire = new THREE.Mesh(forceShieldGeo, forceShieldWireMat);
    shelterDomeGroup.add(shelterShell, shelterWire);
    shelterDomeGroup.visible = false;
    bayGroup.add(shelterDomeGroup);

    // ------------------------------------------------------------------
    // 3. CONSOLES, HOLOGRAMS, BATTERY RACK & TWIN O2 TANKS INSIDE BAY
    // ------------------------------------------------------------------
    const deskMat = new THREE.MeshStandardMaterial({
      color: 0xcbd5e1,
      roughness: 0.35,
      metalness: 0.4,
    });
    const deskBaseGeo = new THREE.BoxGeometry(1.35, 0.78, 0.64);
    const holoPlaneGeo = new THREE.PlaneGeometry(1.58, 0.84);
    disposables.push(deskMat, deskBaseGeo, holoPlaneGeo);

    const leftDesk = new THREE.Mesh(deskBaseGeo, deskMat);
    leftDesk.position.set(-1.7, 0.44, -1.6);
    leftDesk.rotation.y = 0.35;
    bayGroup.add(leftDesk);

    const lifeCanvas = document.createElement("canvas");
    lifeCanvas.width = 512;
    lifeCanvas.height = 270;
    const lifeCtx = lifeCanvas.getContext("2d")!;
    const lifeTex = new THREE.CanvasTexture(lifeCanvas);
    lifeTex.colorSpace = THREE.SRGBColorSpace;
    const lifeHoloMat = new THREE.MeshBasicMaterial({
      map: lifeTex,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
    });
    disposables.push(lifeTex, lifeHoloMat);
    const leftHolo = new THREE.Mesh(holoPlaneGeo, lifeHoloMat);
    leftHolo.position.set(-1.68, 1.48, -1.64);
    leftHolo.rotation.y = 0.32;
    bayGroup.add(leftHolo);

    const rightDesk = new THREE.Mesh(deskBaseGeo, deskMat);
    rightDesk.position.set(1.35, 0.44, -1.75);
    rightDesk.rotation.y = -0.32;
    bayGroup.add(rightDesk);

    const bioCanvas = document.createElement("canvas");
    bioCanvas.width = 512;
    bioCanvas.height = 270;
    const bioCtx = bioCanvas.getContext("2d")!;
    const bioTex = new THREE.CanvasTexture(bioCanvas);
    bioTex.colorSpace = THREE.SRGBColorSpace;
    const bioHoloMat = new THREE.MeshBasicMaterial({
      map: bioTex,
      transparent: true,
      opacity: 0.94,
      side: THREE.DoubleSide,
    });
    disposables.push(bioTex, bioHoloMat);
    const rightHolo = new THREE.Mesh(holoPlaneGeo, bioHoloMat);
    rightHolo.position.set(1.32, 1.48, -1.8);
    rightHolo.rotation.y = -0.28;
    bayGroup.add(rightHolo);

    const redrawScreens = () => {
      const snap = stateRef.current;
      const act = deriveSceneAction(
        snap.gameState,
        snap.sky,
        snap.lastChoiceId,
        snap.currentEventType,
      );
      drawLifeSupportCanvas(
        lifeCtx,
        lifeCanvas.width,
        lifeCanvas.height,
        snap,
        act,
      );
      drawCrewBioCanvas(bioCtx, bioCanvas.width, bioCanvas.height, snap, act);
      lifeTex.needsUpdate = true;
      bioTex.needsUpdate = true;
    };
    redrawScreensRef.current = redrawScreens;
    redrawScreens();

    // Battery Bank + Optional 2nd Rack (Bay Left)
    const batteryBayGroup = new THREE.Group();
    batteryBayGroup.position.set(-2.95, 0.08, 0.2);
    batteryBayGroup.rotation.y = Math.PI * 0.42;
    bayGroup.add(batteryBayGroup);

    const batFrameGeo = new THREE.BoxGeometry(0.75, 1.35, 0.5);
    const batCoreMat = new THREE.MeshStandardMaterial({
      color: 0xfbbf24,
      emissive: 0xf59e0b,
      emissiveIntensity: 0.55,
      roughness: 0.25,
    });
    const batCoreGeo = new THREE.BoxGeometry(0.42, 0.92, 0.14);
    disposables.push(batFrameGeo, batCoreMat, batCoreGeo);

    const batRack1 = new THREE.Mesh(batFrameGeo, trimRibMat);
    batRack1.position.y = 0.68;
    const batCore1 = new THREE.Mesh(batCoreGeo, batCoreMat);
    batCore1.position.set(0, 0.72, 0.24);
    batteryBayGroup.add(batRack1, batCore1);

    const batExpansionRack = new THREE.Group();
    batExpansionRack.position.set(0.86, 0, 0);
    const batRack2 = new THREE.Mesh(batFrameGeo, trimRibMat);
    batRack2.position.y = 0.62;
    batRack2.scale.set(0.85, 0.9, 0.9);
    const batCore2 = new THREE.Mesh(batCoreGeo, batCoreMat);
    batCore2.position.set(0, 0.62, 0.22);
    batExpansionRack.add(batRack2, batCore2);
    batExpansionRack.visible = false;
    batteryBayGroup.add(batExpansionRack);

    // Twin Oxygen Tanks at Back Center of Bay
    const o2TankGroup = new THREE.Group();
    o2TankGroup.position.set(-0.1, 0.08, -3.55);
    bayGroup.add(o2TankGroup);

    const tankShellGeo = new THREE.CylinderGeometry(0.24, 0.24, 1.38, 14);
    const tankGlowMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      roughness: 0.2,
    });
    disposables.push(tankShellGeo, tankGlowMat);

    const o2TankL = new THREE.Mesh(tankShellGeo, tankGlowMat);
    o2TankL.position.set(-0.3, 0.7, 0);
    const o2TankR = new THREE.Mesh(tankShellGeo, tankGlowMat);
    o2TankR.position.set(0.3, 0.7, 0);
    o2TankGroup.add(o2TankL, o2TankR);

    // ------------------------------------------------------------------
    // 4. 4 ASTRONAUTS IN WORLD SPACE (WALK SMOOTHLY INSIDE <-> OUTSIDE!)
    // ------------------------------------------------------------------
    const crewMaya = buildAstronautRig(
      "Maya",
      0x38bdf8,
      new THREE.Vector3(-2.65, 0.08, 1.35),
      Math.PI * 0.75,
      1.08,
      disposables,
    );
    const crewLeo = buildAstronautRig(
      "Leo",
      0xfbbf24,
      new THREE.Vector3(3.75, 0, -0.35),
      -Math.PI * 0.35,
      0.95,
      disposables,
    );
    const crewPriya = buildAstronautRig(
      "Priya",
      0x34d399,
      new THREE.Vector3(5.3, 0, 0.9),
      -Math.PI * 0.4,
      0.95,
      disposables,
    );
    const crewSam = buildAstronautRig(
      "Sam",
      0xa78bfa,
      new THREE.Vector3(-0.3, 0.08, 0.35),
      -Math.PI * 0.2,
      0.96,
      disposables,
    );

    const crewRigs = [crewMaya, crewLeo, crewPriya, crewSam];
    crewRigs.forEach((r) => scene.add(r.root));

    // Floating Medical Cross Alert over Sick Crewmate
    const medAlertGroup = new THREE.Group();
    const medCardGeo = new THREE.BoxGeometry(0.46, 0.32, 0.06);
    const medCardMat = new THREE.MeshBasicMaterial({ color: 0xfef2f2 });
    const crossMat = new THREE.MeshBasicMaterial({ color: 0xe11d48 });
    const crossVGeo = new THREE.BoxGeometry(0.08, 0.22, 0.08);
    const crossHGeo = new THREE.BoxGeometry(0.22, 0.08, 0.08);
    disposables.push(medCardGeo, medCardMat, crossMat, crossVGeo, crossHGeo);
    medAlertGroup.add(
      new THREE.Mesh(medCardGeo, medCardMat),
      new THREE.Mesh(crossVGeo, crossMat),
      new THREE.Mesh(crossHGeo, crossMat),
    );
    medAlertGroup.visible = false;
    scene.add(medAlertGroup);

    // Emerald Medical Scanner Cone
    const scannerConeMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
    });
    const scannerConeGeo = new THREE.ConeGeometry(0.45, 1.35, 14, 1, true);
    disposables.push(scannerConeMat, scannerConeGeo);
    const scannerCone = new THREE.Mesh(scannerConeGeo, scannerConeMat);
    scannerCone.rotation.z = Math.PI / 2;
    scannerCone.visible = false;
    scene.add(scannerCone);

    // Dynamic Action Particles (World space!)
    const particleCount = 32;
    const particleGeo = new THREE.SphereGeometry(0.06, 6, 6);
    const particleMat = new THREE.MeshBasicMaterial({
      color: 0x7dd3fc,
      transparent: true,
      opacity: 0.9,
    });
    disposables.push(particleGeo, particleMat);
    const particles: Array<{
      mesh: THREE.Mesh;
      phase: number;
      offsetX: number;
      offsetZ: number;
    }> = [];
    for (let i = 0; i < particleCount; i++) {
      const m = new THREE.Mesh(particleGeo, particleMat);
      m.visible = false;
      scene.add(m);
      particles.push({
        mesh: m,
        phase: i / particleCount,
        offsetX: ((i % 7) - 3) * 0.24,
        offsetZ: (((i * 3) % 5) - 2) * 0.22,
      });
    }

    // ------------------------------------------------------------------
    // 5. FAST RAYCAST HITBOXES
    // ------------------------------------------------------------------
    const hitboxMat = new THREE.MeshBasicMaterial({ visible: false });
    disposables.push(hitboxMat);
    const clickables: THREE.Mesh[] = [];

    const addHitbox = (
      id: InspectId,
      w: number,
      h: number,
      d: number,
      x: number,
      y: number,
      z: number,
    ) => {
      const geo = new THREE.BoxGeometry(w, h, d);
      disposables.push(geo);
      const box = new THREE.Mesh(geo, hitboxMat);
      box.position.set(x, y, z);
      box.userData.inspectId = id;
      scene.add(box);
      clickables.push(box);
    };

    addHitbox("dome", 4.6, 2.2, 4.2, -1.35, 1.1, -0.35);
    addHitbox("battery", 1.8, 1.8, 1.4, -4.3, 0.9, 0.2);
    addHitbox("oxygen", 1.5, 1.8, 1.2, -1.45, 0.9, -3.55);
    addHitbox("greenhouse", 2.1, 1.6, 1.6, 4.5, 0.8, -1.55);
    addHitbox("solar", 3.6, 2.2, 2.2, 5.4, 1.65, -4.8);
    addHitbox("dirt", 2.4, 1.4, 2.2, 4.6, 0.5, 2.05);
    addHitbox("rover", 2.6, 1.4, 2.2, 7.2, 0.5, -0.4);
    addHitbox("earth", 3.4, 3.4, 3.0, -6.5, 6.8, -18);

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    let pointerDownPos = { x: 0, y: 0 };

    const updatePointer = (ev: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;
    };

    const handlePointerDown = (ev: PointerEvent) => {
      pointerDownPos = { x: ev.clientX, y: ev.clientY };
    };

    const handlePointerUp = (ev: PointerEvent) => {
      const dx = ev.clientX - pointerDownPos.x;
      const dy = ev.clientY - pointerDownPos.y;
      if (Math.hypot(dx, dy) > 8) return;
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickables, false);
      if (hits.length > 0) {
        const hitId = hits[0].object.userData.inspectId as
          | InspectId
          | undefined;
        if (hitId) onInspectRef.current(hitId);
      }
    };

    let lastHoverCheck = 0;
    const handlePointerMove = (ev: PointerEvent) => {
      const now = performance.now();
      if (now - lastHoverCheck < 55) return;
      lastHoverCheck = now;
      updatePointer(ev);
      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(clickables, false);
      renderer.domElement.style.cursor =
        hits.length > 0 ? "pointer" : "default";
    };

    const handleContextLost = (ev: Event) => {
      ev.preventDefault();
      setWebglError(true);
    };
    const handleContextRestored = () => {
      setWebglError(false);
    };

    renderer.domElement.addEventListener("pointerdown", handlePointerDown);
    renderer.domElement.addEventListener("pointerup", handlePointerUp);
    renderer.domElement.addEventListener("pointermove", handlePointerMove);
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost);
    renderer.domElement.addEventListener(
      "webglcontextrestored",
      handleContextRestored,
    );

    // Zero-allocation scratch helpers
    const _targetPos = new THREE.Vector3();
    const _camGoalPos = new THREE.Vector3();
    const _camGoalLook = new THREE.Vector3();
    const _targetColor = new THREE.Color();
    const reducedMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

    let disposed = false;
    let frameId = 0;

    function afterDraw(cb: () => void) {
      if (disposed) return;
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync?.(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      if (!sync) {
        frameId = window.setTimeout(cb, 75);
        return;
      }
      const poll = () => {
        if (disposed) {
          gl.deleteSync(sync);
          return;
        }
        const status = gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 75);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    let lastTime = performance.now();
    let elapsed = 0;
    let lastDecisionKey = "";
    let decisionTimer = 0;

    function tick() {
      if (disposed) return;
      const now = performance.now();
      const dt = Math.min(0.08, (now - lastTime) / 1000);
      lastTime = now;
      elapsed += dt;

      const snap = stateRef.current;
      const gs = snap.gameState;
      const act = deriveSceneAction(
        gs,
        snap.sky,
        snap.lastChoiceId,
        snap.currentEventType,
      );
      const decisionKey = `${gs.round}-${snap.lastChoiceId ?? "none"}-${act.activeDecision}`;
      if (decisionKey !== lastDecisionKey) {
        lastDecisionKey = decisionKey;
        decisionTimer = 0;
      } else {
        decisionTimer += dt;
      }

      const isNight = snap.sky === "night" || snap.sky === "flare";

      // --- Lighting & Atmosphere ---
      if (act.isLost) {
        _targetColor.setHex(0x16070f);
        bayCenterLight.color.setHex(0xf43f5e);
        bayCenterLight.intensity = 2.6 + Math.sin(elapsed * 4) * 0.9;
        deckRingGlowMat.color.setHex(0xf43f5e);
        floorThermalGlowMat.color.setHex(0x9f1239);
      } else if (act.isFlare) {
        _targetColor.setHex(0x280d0b);
        bayCenterLight.color.setHex(act.isSheltered ? 0x38bdf8 : 0xf97316);
        bayCenterLight.intensity = 3.8 + Math.sin(elapsed * 6) * 0.9;
        deckRingGlowMat.color.setHex(act.isSheltered ? 0x38bdf8 : 0xfb7185);
        floorThermalGlowMat.color.setHex(0xfb923c);
      } else if (act.isCold) {
        _targetColor.setHex(0x040b18);
        bayCenterLight.color.setHex(0x67e8f9);
        bayCenterLight.intensity = 3.6;
        deckRingGlowMat.color.setHex(0x22d3ee);
        floorThermalGlowMat.color.setHex(0x0891b2);
      } else if (act.sickAstroIndex !== null) {
        _targetColor.setHex(0x090b18);
        bayCenterLight.color.setHex(0xfbbf24);
        bayCenterLight.intensity = 3.9;
        deckRingGlowMat.color.setHex(0xf59e0b);
        floorThermalGlowMat.color.setHex(0xf43f5e);
      } else {
        _targetColor.setHex(isNight ? 0x030712 : 0x071226);
        bayCenterLight.color.setHex(act.isGreenhouse ? 0x34d399 : 0x38bdf8);
        bayCenterLight.intensity = 4.2;
        deckRingGlowMat.color.setHex(0x38bdf8);
        floorThermalGlowMat.color.setHex(
          act.activeDecision === "heat_on" ? 0xf59e0b : 0x0284c7,
        );
      }
      (scene.background as THREE.Color).lerp(_targetColor, Math.min(1, dt * 4));

      sunGroup.visible = !isNight && !act.isLost;
      sunKey.intensity = isNight ? 0.65 : act.isFlare ? 2.4 : 1.95;
      sunKey.color.setHex(act.isFlare ? 0xfb923c : 0xfff4df);

      flareArc.visible = act.isFlare;
      if (act.isFlare) {
        flareArc.rotation.z = 0.25 + Math.sin(elapsed * 2.2) * 0.16;
        flareArcMat.opacity = 0.55 + Math.sin(elapsed * 5.2) * 0.3;
      }

      if (!reducedMotion) {
        earthGroup.rotation.y += dt * 0.12;
        starInst.rotation.y += dt * 0.004;
        flagCloth.rotation.y = Math.sin(elapsed * 2.8) * 0.22;
      }

      // --- Exterior Solar Wing, Moon Dirt, Battery, Shield & Greenhouse ---
      const targetWingTilt = isNight ? 0.12 : 0.45;
      solarWingPivot.rotation.x = THREE.MathUtils.damp(
        solarWingPivot.rotation.x,
        targetWingTilt,
        4,
        dt,
      );
      dustOverlayMat.opacity = THREE.MathUtils.damp(
        dustOverlayMat.opacity,
        act.isPanelsDusty && !act.isCleaningSolar ? 0.85 : 0,
        4,
        dt,
      );
      solarWiper.visible = act.isCleaningSolar;
      if (act.isCleaningSolar) {
        solarWiper.position.x = Math.sin(elapsed * 4.5) * 1.35;
      }

      const dirtScale = Math.max(0.35, Math.min(1.25, gs.moonDirt / 55));
      dirtPile.scale.setScalar(dirtScale);

      // Animate 2nd Battery Rack physically sliding/locking into place as Leo installs it!
      const showBatteryExpansion = gs.powerCap > 100 || act.isBuildingBattery;
      batExpansionRack.visible = showBatteryExpansion;
      if (act.isBuildingBattery) {
        const buildT = Math.min(1, Math.max(0, (decisionTimer - 0.6) / 1.4));
        batExpansionRack.position.y = (1 - buildT) * 0.55;
        batExpansionRack.scale.setScalar(0.35 + 0.65 * buildT);
      } else {
        batExpansionRack.position.y = THREE.MathUtils.damp(
          batExpansionRack.position.y,
          0,
          6,
          dt,
        );
        batExpansionRack.scale.setScalar(1);
      }
      batCoreMat.emissiveIntensity =
        gs.power <= 0
          ? 0.08
          : 0.35 + (gs.power / Math.max(1, gs.powerCap)) * 0.65;
      batCoreMat.color.setHex(gs.power <= 15 ? 0xf43f5e : 0xfbbf24);

      const shieldRatio = act.isShielding ? 0.65 : Math.min(1, gs.shield / 30);
      const shutterTargetY = 3.45 - shieldRatio * 0.68;
      for (let i = 0; i < roofShutters.length; i++) {
        roofShutters[i].position.y = THREE.MathUtils.damp(
          roofShutters[i].position.y,
          shutterTargetY,
          3.5,
          dt,
        );
      }

      shelterDomeGroup.visible =
        act.isSheltered || (act.isFlare && gs.shield >= 15);
      if (shelterDomeGroup.visible) {
        forceShieldMat.opacity =
          (act.isSheltered ? 0.24 : 0.12) +
          (reducedMotion ? 0 : Math.sin(elapsed * 4.2) * 0.06);
        if (!reducedMotion) shelterWire.rotation.y += dt * 0.22;
      }

      const o2Pct = Math.max(0.05, Math.min(1, gs.oxygen / 100));
      o2TankL.scale.y = o2Pct;
      o2TankL.position.y = 0.05 + 0.65 * o2Pct;
      o2TankR.scale.y = o2Pct;
      o2TankR.position.y = 0.05 + 0.65 * o2Pct;
      tankGlowMat.color.setHex(gs.oxygen <= 25 ? 0xf43f5e : 0x38bdf8);

      growLampMat.color.setHex(act.isGreenhouse ? 0x4ade80 : 0x334155);
      cropMeshes.forEach((leaf, cIdx) => {
        const targetCropScale = act.isGreenhouse
          ? 1.2 + Math.sin(elapsed * 2.5 + cIdx) * 0.16
          : 0.48;
        leaf.scale.y = THREE.MathUtils.damp(
          leaf.scale.y,
          targetCropScale,
          4,
          dt,
        );
        leaf.position.y = 0.4 + 0.16 * leaf.scale.y;
      });

      sealLightMat.color.setHex(
        act.isAirLeaking ? 0xf43f5e : act.isPatchingLeak ? 0xfbbf24 : 0x34d399,
      );

      // --- Exterior Rover & Rocket ---
      if (act.isRoverActive && act.activeDecision !== "ice_stay") {
        roverGroup.position.x = 7.6 + Math.sin(elapsed * 1.1) * 1.8;
        roverGroup.position.z = -1.2 + Math.cos(elapsed * 0.8) * 1.4;
        roverBeam.visible = true;
      } else {
        roverGroup.position.x = THREE.MathUtils.damp(
          roverGroup.position.x,
          7.2 + Math.sin(elapsed * 0.35) * 0.35,
          3,
          dt,
        );
        roverGroup.position.z = THREE.MathUtils.damp(
          roverGroup.position.z,
          -0.4,
          3,
          dt,
        );
        roverBeam.visible = false;
      }

      const showRocket = snap.sky === "resupply" || act.isWon;
      rocketGroup.visible = showRocket && !act.isLost;
      if (rocketGroup.visible) {
        const targetRocketY = act.isWon
          ? 0.14
          : 1.5 + Math.sin(elapsed * 1.8) * 0.32;
        rocketGroup.position.y = THREE.MathUtils.damp(
          rocketGroup.position.y,
          targetRocketY,
          2.2,
          dt,
        );
        rFlame.visible = !act.isWon;
        rFlame.scale.y = 0.85 + Math.sin(elapsed * 14) * 0.25;
      }

      // --- 4 ASTRONAUTS: ACT OUT EVERY SINGLE DECISION TOGETHER! ---
      medAlertGroup.visible = act.sickAstroIndex !== null && !act.isLost;
      scannerCone.visible = act.activeDecision === "treat_now" && !act.isLost;

      let someoneNearOrCrossingAirlock = false;

      crewRigs.forEach((rig, idx) => {
        _targetPos.copy(rig.homePos);
        let targetYaw = rig.homeYaw;
        let hipOffset = 0.88;
        let torsoX = 0;
        let torsoZ = 0;
        let headX = 0;
        let headY = 0;
        let lArmX = -0.15;
        let lArmZ = 0.15;
        let rArmX = -0.15;
        let rArmZ = -0.15;
        let lLegX = 0;
        let rLegX = 0;
        let visorHex = 0x0ea5e9;

        // Reset hand props every frame and enable only what matches this role's action
        rig.propBlock.visible = false;
        rig.toolWrench.visible = false;
        rig.toolTablet.visible = false;
        rig.toolBroom.visible = false;
        rig.toolScanner.visible = false;

        const d = act.activeDecision;

        if (d === "lost") {
          _targetPos.set(-2.3 + idx * 0.9, 0.08, -0.2);
          hipOffset = 0.56;
          torsoX = 0.45;
          headX = 0.35;
          visorHex = 0x64748b;
        } else if (d === "won") {
          const spots = [
            [4.2, 0.8],
            [5.3, 1.3],
            [5.9, -0.8],
            [4.7, -0.3],
          ];
          _targetPos.set(spots[idx][0], 0, spots[idx][1]);
          targetYaw = Math.PI * 0.65;
          const jump = Math.abs(Math.sin(elapsed * 4.5 + idx * 0.7)) * 0.48;
          hipOffset = 0.88 + jump;
          lArmX = -2.4 + Math.sin(elapsed * 7 + idx) * 0.3;
          rArmX = -2.4 - Math.sin(elapsed * 7 + idx) * 0.3;
          lArmZ = 0.45;
          rArmZ = -0.45;
          visorHex = 0x34d399;
        } else if (d === "flare_shelter") {
          const angle = (idx / 4) * Math.PI * 2 + 0.5;
          _targetPos.set(
            -1.35 + Math.cos(angle) * 0.85,
            0.08,
            -0.35 + Math.sin(angle) * 0.85,
          );
          targetYaw = -angle + Math.PI / 2;
          hipOffset = 0.56;
          torsoX = 0.38;
          lLegX = -0.55;
          rLegX = -0.55;
          lArmX = -1.6;
          rArmX = -1.6;
          headX = 0.25;
          visorHex = 0x38bdf8;
        } else if (d === "flare_work") {
          if (idx === 0) {
            _targetPos.set(-2.5, 0.08, -0.9);
            targetYaw = Math.PI * 0.8;
            rig.toolTablet.visible = true;
            lArmX = -1.1;
          } else if (idx === 1) {
            _targetPos.set(4.1, 0, -2.5);
            targetYaw = Math.PI * 0.7;
            rig.toolWrench.visible = true;
          } else if (idx === 2) {
            _targetPos.set(3.9, 0, 0.9);
            targetYaw = -Math.PI * 0.4;
          } else {
            _targetPos.set(-0.2, 0.08, -1.1);
            targetYaw = Math.PI;
          }
          // Shielding helmet with left/right arm while working through flare!
          rArmX = -2.05 + Math.sin(elapsed * 6 + idx) * 0.14;
          rArmZ = 0.35;
          torsoX = 0.16;
          visorHex = 0xfb7185;
        } else if (d === "dirt_build") {
          // ALL 4 ACT OUT BUILDING A NEW BATTERY BOX!
          // Phase 1 (0..1.7s): Leo hauls glowing amber Battery Module from deck to Battery Vault;
          // Phase 2 (1.7s+): Leo crouches/places & welds module into 2nd Rack while Priya bolts busbar, Maya directs with blueprint tablet, Sam checks Left Holo!
          const placingPhase = decisionTimer < 1.7;
          if (idx === 1) {
            if (placingPhase) {
              const p = decisionTimer / 1.7;
              _targetPos.set(
                THREE.MathUtils.lerp(-1.2, -3.35, p),
                0.08,
                THREE.MathUtils.lerp(0.5, 0.32, p),
              );
              targetYaw = -Math.PI * 0.5;
              rig.propBlock.visible = true;
              rig.propBlockMat.color.setHex(0xfbbf24);
              rig.propBlockMat.emissive.setHex(0xf59e0b);
              lArmX = -1.25;
              rArmX = -1.25;
              torsoX = 0.15;
            } else {
              _targetPos.set(-3.35, 0.08, 0.25);
              targetYaw = -Math.PI * 0.45;
              hipOffset = 0.76 + Math.sin(elapsed * 6) * 0.03;
              torsoX = 0.24;
              rig.toolWrench.visible = true;
              rArmX = -1.4 + Math.sin(elapsed * 14) * 0.22;
              lArmX = -1.0;
            }
            visorHex = 0xfbbf24;
          } else if (idx === 2) {
            _targetPos.set(-3.55, 0.08, 1.05);
            targetYaw = -Math.PI * 0.75;
            rig.toolWrench.visible = true;
            rArmX = -1.25 + Math.cos(elapsed * 9) * 0.18;
            lArmX = -0.8;
            visorHex = 0x34d399;
          } else if (idx === 0) {
            _targetPos.set(-2.35, 0.08, 0.7);
            targetYaw = -Math.PI * 0.65;
            rig.toolTablet.visible = true;
            lArmX = -1.1;
            rArmX = -0.95 + Math.sin(elapsed * 3) * 0.2;
          } else {
            _targetPos.set(-2.7, 0.08, -0.9);
            targetYaw = Math.PI * 0.85;
            lArmX = -0.95;
            rArmX = -0.95 + Math.sin(elapsed * 4) * 0.15;
          }
        } else if (d === "dirt_air") {
          // ALL 4 ACT OUT TURNING MOON DIRT INTO BREATHABLE AIR!
          const carryLoop = (elapsed * 0.42) % 1;
          if (idx === 2 || idx === 1) {
            // Priya & Leo haul gray-cyan Regolith Ore Crates from Moon Dirt Mound IN through Airlock to the O2 Baker/Tanks!
            const phaseOffset = idx === 1 ? 0.5 : 0;
            const cycle = (carryLoop + phaseOffset) % 1;
            const toTanks = cycle < 0.5;
            const u = toTanks ? cycle * 2 : (1 - cycle) * 2;
            _targetPos.set(
              THREE.MathUtils.lerp(4.2, -1.2, u),
              u > 0.65 ? 0.08 : 0.02,
              THREE.MathUtils.lerp(1.45, -2.55, u),
            );
            targetYaw = toTanks ? -Math.PI * 0.68 : Math.PI * 0.32;
            rig.propBlock.visible = toTanks;
            rig.propBlockMat.color.setHex(0x38bdf8);
            rig.propBlockMat.emissive.setHex(0x0284c7);
            if (toTanks) {
              lArmX = -1.25;
              rArmX = -1.25;
              torsoX = 0.16;
            }
            visorHex = 0x38bdf8;
          } else if (idx === 0) {
            _targetPos.set(-0.7, 0.08, -2.55);
            targetYaw = Math.PI;
            rig.toolWrench.visible = true;
            rArmX = -1.3 + Math.sin(elapsed * 7) * 0.2;
          } else {
            _targetPos.set(-2.5, 0.08, -1.0);
            targetYaw = Math.PI * 0.82;
            rig.toolTablet.visible = true;
            lArmX = -1.1;
          }
        } else if (d === "dirt_shield") {
          // ALL 4 ACT OUT STACKING MOON DIRT ARMOR ON HABITAT!
          if (idx === 1 || idx === 2) {
            const liftWave = (Math.sin(elapsed * 2.2 + idx) + 1) * 0.5;
            _targetPos.set(
              idx === 1 ? 2.8 + liftWave * 0.9 : 3.7 - liftWave * 0.8,
              0,
              idx === 1 ? 1.3 : 1.9,
            );
            targetYaw = -Math.PI * 0.55;
            rig.propBlock.visible = true;
            rig.propBlockMat.color.setHex(0x94a3b8);
            rig.propBlockMat.emissive.setHex(0x334155);
            lArmX = -1.55 - liftWave * 0.65;
            rArmX = -1.55 - liftWave * 0.65;
            hipOffset = 0.78 + liftWave * 0.1;
          } else if (idx === 0) {
            _targetPos.set(3.2, 0, -0.1);
            targetYaw = Math.PI * 0.25;
            rig.toolTablet.visible = true;
            lArmX = -1.1;
            rArmX = -1.8 + Math.sin(elapsed * 3) * 0.2;
          } else {
            _targetPos.set(-0.2, 0.08, -1.05);
            targetYaw = Math.PI * 0.9;
            lArmX = -0.9;
            rArmX = -1.05 + Math.sin(elapsed * 4) * 0.15;
          }
        } else if (d === "heat_on") {
          // ALL 4 ACT OUT KEEPING CABIN HEATING ON!
          const spots = [
            [-2.2, -0.7],
            [-2.5, 0.2],
            [-0.4, 0.1],
            [-0.2, -0.9],
          ];
          _targetPos.set(spots[idx][0], 0.08, spots[idx][1]);
          targetYaw = idx < 2 ? Math.PI * 0.4 : -Math.PI * 0.4;
          if (idx === 1) {
            rig.toolWrench.visible = true;
            rArmX = -1.2 + Math.sin(elapsed * 6) * 0.25;
          } else if (idx === 0) {
            rig.toolTablet.visible = true;
            lArmX = -1.05;
          } else {
            // Warming hands comfortably over amber floor thermal vents
            lArmX = -1.05 + Math.sin(elapsed * 3 + idx) * 0.12;
            rArmX = -1.05 + Math.cos(elapsed * 3 + idx) * 0.12;
            lArmZ = -0.15;
            rArmZ = 0.15;
          }
          visorHex = 0xfbbf24;
        } else if (d === "heat_off") {
          _targetPos.set(-2.35 + idx * 0.85, 0.08, 0.1);
          targetYaw = (idx % 2 === 0 ? 1 : -1) * 0.25;
          hipOffset = 0.82;
          torsoX = 0.14;
          torsoZ = Math.sin(elapsed * 16 + idx) * 0.06;
          lArmX = -1.15;
          lArmZ = -0.38;
          rArmX = -1.15;
          rArmZ = 0.38;
          visorHex = 0x67e8f9;
        } else if (d === "clean_yes") {
          // ALL 4 ACT OUT CLEANING SOLAR PANELS!
          if (idx === 1) {
            _targetPos.set(4.6 + Math.sin(elapsed * 2.2) * 0.6, 0, -3.55);
            targetYaw = Math.PI * 0.92;
            rig.toolBroom.visible = true;
            rArmX = -1.35 + Math.sin(elapsed * 5.2) * 0.35;
            lArmX = -1.1 + Math.sin(elapsed * 5.2) * 0.25;
            visorHex = 0xfde047;
          } else if (idx === 2) {
            _targetPos.set(6.3, 0, -3.7);
            targetYaw = -Math.PI * 0.85;
            rig.toolTablet.visible = true;
            lArmX = -1.1;
            visorHex = 0x34d399;
          } else if (idx === 0) {
            _targetPos.set(3.2, 0, -1.6);
            targetYaw = Math.PI * 0.78;
            rArmX = -1.5;
          } else {
            _targetPos.set(-2.55, 0.08, -0.95);
            targetYaw = Math.PI * 0.82;
            lArmX = -1.0;
            rArmX = -0.95 + Math.sin(elapsed * 4) * 0.15;
          }
        } else if (d === "clean_skip") {
          if (idx === 1) {
            _targetPos.set(3.9, 0, -2.5);
            targetYaw = Math.PI;
            rArmX = -1.65;
            headY = Math.sin(elapsed * 2) * 0.3;
          } else {
            _targetPos.set(-2.2 + idx * 0.7, 0.08, -0.4);
            targetYaw = Math.PI * 0.85;
            lArmX = -0.8;
            rArmX = -0.9 + Math.sin(elapsed * 2 + idx) * 0.15;
          }
          visorHex = 0xf59e0b;
        } else if (d === "delay_greenhouse") {
          // ALL 4 ACT OUT PLANTING & RUNNING CSA LUNAR GREENHOUSE!
          if (idx === 2) {
            _targetPos.set(4.35, 0, -0.68);
            targetYaw = Math.PI;
            torsoX = 0.24;
            rig.propBlock.visible = true;
            rig.propBlockMat.color.setHex(0x22c55e);
            rig.propBlockMat.emissive.setHex(0x16a34a);
            lArmX = -1.2 + Math.sin(elapsed * 3.5) * 0.18;
            rArmX = -1.2 - Math.sin(elapsed * 3.5) * 0.18;
            visorHex = 0x34d399;
          } else if (idx === 3) {
            _targetPos.set(5.35, 0, -1.2);
            targetYaw = -Math.PI * 0.6;
            rig.propBlock.visible = true;
            rig.propBlockMat.color.setHex(0x4ade80);
            rig.propBlockMat.emissive.setHex(0x15803d);
            lArmX = -1.1;
            rArmX = -1.1;
            visorHex = 0x34d399;
          } else if (idx === 1) {
            _targetPos.set(3.55, 0, -1.45);
            targetYaw = Math.PI * 0.5;
            rig.toolWrench.visible = true;
            rArmX = -1.55 + Math.sin(elapsed * 5) * 0.2;
          } else {
            _targetPos.set(3.6, 0, 0.3);
            targetYaw = Math.PI * 0.75;
            rig.toolTablet.visible = true;
            lArmX = -1.05;
          }
        } else if (d === "delay_eat_less") {
          // ALL 4 GATHER INSIDE SHARING SMALL RATION PACKS!
          const angle = (idx / 4) * Math.PI * 2 + 0.4;
          _targetPos.set(
            -1.35 + Math.cos(angle) * 0.95,
            0.08,
            -0.3 + Math.sin(angle) * 0.85,
          );
          targetYaw = -angle - Math.PI / 2;
          rig.propBlock.visible = true;
          rig.propBlockMat.color.setHex(0xfb923c);
          rig.propBlockMat.emissive.setHex(0xc2410c);
          hipOffset = 0.82;
          torsoX = 0.15;
          rArmX = -1.35 + Math.sin(elapsed * 2.2 + idx) * 0.25;
          lArmX = -0.8;
          visorHex = 0xfbbf24;
        } else if (d === "delay_air") {
          // ALL 4 RUSH TO TWIN O2 TANKS TO CRANK OPEN EMERGENCY VALVES!
          if (idx === 1 || idx === 2) {
            _targetPos.set(idx === 1 ? -1.75 : -0.95, 0.08, -2.55);
            targetYaw = Math.PI;
            rig.toolWrench.visible = true;
            rArmX = -1.4 + Math.sin(elapsed * 10 + idx) * 0.3;
            lArmX = -1.1;
          } else {
            _targetPos.set(idx === 0 ? -2.4 : -0.3, 0.08, -1.5);
            targetYaw = Math.PI * 0.85;
            rig.toolTablet.visible = true;
            lArmX = -1.1;
          }
          visorHex = 0x38bdf8;
        } else if (d === "treat_now") {
          if (idx === 1) {
            _targetPos.set(-1.75, 0.08, -0.25);
            targetYaw = Math.PI * 0.45;
            hipOffset = 0.78;
            torsoX = 0.1;
            visorHex = 0x34d399;
          } else if (idx === 3) {
            _targetPos.set(-0.65, 0.08, -0.25);
            targetYaw = -Math.PI * 0.5;
            rig.toolScanner.visible = true;
            rArmX = -1.35 + Math.sin(elapsed * 4.5) * 0.12;
            lArmX = -0.65;
            visorHex = 0x34d399;
            scannerCone.position.set(-1.18, 1.42, -0.25);
            scannerConeMat.opacity = 0.28 + Math.sin(elapsed * 6) * 0.14;
          } else if (idx === 2) {
            _targetPos.set(-1.35, 0.08, -1.05);
            targetYaw = 0.1;
            rig.propBlock.visible = true;
            rig.propBlockMat.color.setHex(0xfef2f2);
            rig.propBlockMat.emissive.setHex(0x34d399);
            lArmX = -1.1;
            rArmX = -1.1;
          } else {
            _targetPos.set(-0.15, 0.08, -1.05);
            targetYaw = Math.PI * 0.85;
            rig.toolTablet.visible = true;
            lArmX = -1.1;
          }
        } else if (d === "treat_rest" || act.sickAstroIndex !== null) {
          if (idx === 1) {
            const shiver = Math.sin(elapsed * 18) * 0.09;
            _targetPos.set(-1.45, 0.08, -0.35);
            targetYaw = Math.PI * 0.15;
            hipOffset = 0.72;
            torsoX = 0.52 + Math.sin(elapsed * 3.2) * 0.06;
            torsoZ = shiver;
            headX = 0.32;
            lArmX = -1.05;
            lArmZ = -0.32;
            rArmX = -1.05;
            rArmZ = 0.32;
            visorHex = Math.sin(elapsed * 5) > 0 ? 0xf43f5e : 0xf59e0b;
            medAlertGroup.position.set(
              rig.root.position.x,
              2.2 + Math.sin(elapsed * 3.5) * 0.08,
              rig.root.position.z,
            );
            medAlertGroup.rotation.y = Math.sin(elapsed * 1.6) * 0.2;
          } else if (idx === 3) {
            _targetPos.set(-0.55, 0.08, -0.25);
            targetYaw = -Math.PI * 0.5;
            rig.toolTablet.visible = true;
            lArmX = -1.1;
            headY = Math.sin(elapsed * 2.5) * 0.22;
            visorHex = 0xf59e0b;
          } else {
            _targetPos.set(idx === 0 ? -2.25 : -0.35, 0.08, -1.2);
            targetYaw = Math.PI * 0.85;
            lArmX = -0.8;
            rArmX = -0.9;
          }
        } else if (d === "exercise_yes") {
          if (idx === 0 || idx === 3) {
            _targetPos.set(idx === 0 ? -2.2 : -0.5, 0.08, 0.65);
          } else {
            _targetPos.set(idx === 1 ? 3.8 : 5.4, 0, 0.85);
          }
          const bounce = Math.abs(Math.sin(elapsed * 4.6 + idx * 0.6)) * 0.58;
          hipOffset = 0.88 + bounce;
          lArmX = -0.9 + Math.sin(elapsed * 9.2 + idx) * 1.1;
          rArmX = -0.9 - Math.sin(elapsed * 9.2 + idx) * 1.1;
          lLegX = Math.sin(elapsed * 9.2 + idx) * 0.42;
          rLegX = -Math.sin(elapsed * 9.2 + idx) * 0.42;
          visorHex = 0x38bdf8;
        } else if (d === "exercise_skip") {
          // ALL 4 SLOUCH & STRETCH STIFF MUSCLES INSIDE BAY!
          _targetPos.set(-2.35 + idx * 0.72, 0.08, 0.25);
          targetYaw = 0.15 * (idx - 1.5);
          hipOffset = 0.78;
          torsoX = 0.28;
          headX = 0.18;
          lArmX = -0.5 + Math.sin(elapsed * 1.8 + idx) * 0.1;
          rArmX = -0.5 + Math.sin(elapsed * 1.8 + idx) * 0.1;
          visorHex = 0xf59e0b;
        } else if (d === "ice_send") {
          // ALL 4 ACT OUT SHACKLETON CRATER ROVER ICE HARVEST!
          if (idx === 0) {
            _targetPos.set(5.4, 0, 0.2);
            targetYaw = Math.PI * 0.55;
            rig.toolTablet.visible = true;
            lArmX = -1.15;
            rArmX = -1.0;
            visorHex = 0x38bdf8;
          } else if (idx === 2) {
            _targetPos.set(6.7, 0, -1.6);
            targetYaw = Math.PI * 0.75;
            rig.propBlock.visible = true;
            rig.propBlockMat.color.setHex(0x67e8f9);
            rig.propBlockMat.emissive.setHex(0x06b6d4);
            torsoX = 0.25;
            lArmX = -1.25;
            rArmX = -1.25;
            visorHex = 0x67e8f9;
          } else if (idx === 1) {
            _targetPos.set(5.8, 0, -0.75);
            targetYaw = Math.PI * 0.45;
            rig.toolWrench.visible = true;
            rArmX = -1.1;
          } else {
            _targetPos.set(-0.85, 0.08, -2.55);
            targetYaw = Math.PI;
            rig.toolTablet.visible = true;
            lArmX = -1.1;
          }
        } else if (d === "ice_stay") {
          // ALL 4 STAY INSIDE CONSERVING BATTERY POWER!
          _targetPos.set(-2.8 + idx * 0.55, 0.08, 0.15 + (idx % 2) * 0.5);
          targetYaw = -Math.PI * 0.35;
          hipOffset = 0.84;
          lArmX = -0.45;
          rArmX = -0.45;
          visorHex = 0x94a3b8;
        } else if (d === "leak_patch") {
          // ALL 4 ACT OUT PATCHING THE AIRLOCK SEAL LEAK!
          if (idx === 1) {
            _targetPos.set(2.05, 0.05, 0.1);
            targetYaw = Math.PI;
            rig.toolWrench.visible = true;
            rArmX = -1.45 + Math.sin(elapsed * 16) * 0.18;
            lArmX = -0.9;
            visorHex = 0xfbbf24;
          } else if (idx === 0) {
            _targetPos.set(1.65, 0.06, -0.75);
            targetYaw = Math.PI * 0.25;
            rig.propBlock.visible = true;
            rig.propBlockMat.color.setHex(0x94a3b8);
            rig.propBlockMat.emissive.setHex(0xf59e0b);
            lArmX = -1.35;
            rArmX = -1.35;
          } else if (idx === 2) {
            _targetPos.set(2.85, 0, -0.35);
            targetYaw = -Math.PI * 0.5;
            rig.toolTablet.visible = true;
            lArmX = -1.1;
          } else {
            _targetPos.set(0.7, 0.08, -0.35);
            targetYaw = Math.PI * 0.5;
            rArmX = -1.1;
          }
        } else if (d === "leak_ignore") {
          // ALL 4 REACT TO HISSING O2 LEAK AT AIRLOCK!
          if (idx === 1 || idx === 2) {
            _targetPos.set(
              idx === 1 ? 1.4 : 2.9,
              0.04,
              idx === 1 ? -0.8 : 0.35,
            );
            targetYaw = idx === 1 ? Math.PI * 0.4 : -Math.PI * 0.4;
            lArmX = -1.7 + Math.sin(elapsed * 9 + idx) * 0.3;
            rArmX = -1.7 - Math.sin(elapsed * 9 + idx) * 0.3;
          } else {
            _targetPos.set(idx === 0 ? -0.9 : -0.2, 0.08, -2.35);
            targetYaw = Math.PI;
            rig.toolTablet.visible = true;
            lArmX = -1.1;
          }
          visorHex = 0xfb7185;
        } else {
          // OPEN OUTPOST IDLE PATROL (IN & OUT THROUGH AIRLOCK!)
          if (idx === 1) {
            const patrolPhase = Math.sin(elapsed * 0.32);
            _targetPos.set(
              1.6 + (patrolPhase + 1) * 1.9,
              patrolPhase > 0.1 ? 0 : 0.06,
              -0.35 + Math.sin(elapsed * 0.5) * 0.65,
            );
            targetYaw =
              Math.cos(elapsed * 0.32) > 0 ? Math.PI * 0.5 : -Math.PI * 0.5;
          } else if (idx === 2) {
            const evaLoop = Math.sin(elapsed * 0.26 + 1.2);
            _targetPos.set(
              3.9 + evaLoop * 1.6,
              0,
              0.4 + Math.cos(elapsed * 0.4) * 0.95,
            );
            targetYaw =
              Math.cos(elapsed * 0.26 + 1.2) > 0
                ? Math.PI * 0.4
                : -Math.PI * 0.6;
          } else {
            _targetPos.x += Math.sin(elapsed * 0.55 + idx * 1.4) * 0.26;
            _targetPos.z += Math.cos(elapsed * 0.45 + idx * 1.1) * 0.18;
          }
        }

        // Apply natural walking leg & arm stride whenever any astronaut is walking to a target!
        const distMoving = Math.hypot(
          _targetPos.x - rig.root.position.x,
          _targetPos.z - rig.root.position.z,
        );
        if (
          distMoving > 0.2 &&
          d !== "lost" &&
          d !== "won" &&
          d !== "exercise_yes"
        ) {
          lLegX = Math.sin(elapsed * 6.5 + idx) * 0.45;
          rLegX = -Math.sin(elapsed * 6.5 + idx) * 0.45;
          if (!rig.propBlock.visible) {
            lArmX = -Math.sin(elapsed * 6.5 + idx) * 0.32;
            rArmX = Math.sin(elapsed * 6.5 + idx) * 0.32;
          }
          hipOffset = 0.88 + Math.abs(Math.sin(elapsed * 6.5 + idx)) * 0.07;
        }

        // Check if any astronaut is crossing the sliding Airlock portal (x ~ 0.6 .. 3.4)!
        if (
          Math.abs(rig.root.position.x - 2.0) < 1.35 ||
          Math.abs(_targetPos.x - 2.0) < 1.35 ||
          (rig.root.position.x < 2.0 && _targetPos.x > 2.0) ||
          (rig.root.position.x > 2.0 && _targetPos.x < 2.0)
        ) {
          someoneNearOrCrossingAirlock = true;
        }

        const dampRate = reducedMotion ? 18 : 4.2;
        rig.root.position.x = THREE.MathUtils.damp(
          rig.root.position.x,
          _targetPos.x,
          dampRate,
          dt,
        );
        rig.root.position.y = THREE.MathUtils.damp(
          rig.root.position.y,
          _targetPos.y,
          dampRate,
          dt,
        );
        rig.root.position.z = THREE.MathUtils.damp(
          rig.root.position.z,
          _targetPos.z,
          dampRate,
          dt,
        );
        rig.root.rotation.y = THREE.MathUtils.damp(
          rig.root.rotation.y,
          targetYaw,
          5,
          dt,
        );
        rig.hips.position.y = THREE.MathUtils.damp(
          rig.hips.position.y,
          hipOffset,
          8,
          dt,
        );
        rig.torso.rotation.x = THREE.MathUtils.damp(
          rig.torso.rotation.x,
          torsoX,
          8,
          dt,
        );
        rig.torso.rotation.z = THREE.MathUtils.damp(
          rig.torso.rotation.z,
          torsoZ,
          12,
          dt,
        );
        rig.headGroup.rotation.x = THREE.MathUtils.damp(
          rig.headGroup.rotation.x,
          headX,
          8,
          dt,
        );
        rig.headGroup.rotation.y = THREE.MathUtils.damp(
          rig.headGroup.rotation.y,
          headY,
          8,
          dt,
        );
        rig.leftArm.rotation.x = THREE.MathUtils.damp(
          rig.leftArm.rotation.x,
          lArmX,
          8,
          dt,
        );
        rig.leftArm.rotation.z = THREE.MathUtils.damp(
          rig.leftArm.rotation.z,
          lArmZ,
          8,
          dt,
        );
        rig.rightArm.rotation.x = THREE.MathUtils.damp(
          rig.rightArm.rotation.x,
          rArmX,
          8,
          dt,
        );
        rig.rightArm.rotation.z = THREE.MathUtils.damp(
          rig.rightArm.rotation.z,
          rArmZ,
          8,
          dt,
        );
        rig.leftLeg.rotation.x = THREE.MathUtils.damp(
          rig.leftLeg.rotation.x,
          lLegX,
          8,
          dt,
        );
        rig.rightLeg.rotation.x = THREE.MathUtils.damp(
          rig.rightLeg.rotation.x,
          rLegX,
          8,
          dt,
        );

        rig.visorMat.emissive.setHex(visorHex);
        rig.visorMat.color.setHex(visorHex);
      });

      // Animate Sliding Airlock Doors opening automatically when astronauts pass!
      const lockClosed = act.isSheltered && act.isFlare;
      const doorOpenSlide = lockClosed
        ? 0
        : someoneNearOrCrossingAirlock
          ? 0.92
          : 0.45;
      airlockDoorL.position.z = THREE.MathUtils.damp(
        airlockDoorL.position.z,
        -0.52 - doorOpenSlide,
        5,
        dt,
      );
      airlockDoorR.position.z = THREE.MathUtils.damp(
        airlockDoorR.position.z,
        0.52 + doorOpenSlide,
        5,
        dt,
      );

      // --- Contextual Dynamic Particles ---
      const hasParticles =
        act.isBakingAir ||
        act.isEmergencyAir ||
        act.isTreating ||
        act.isBuildingBattery ||
        act.isPatchingLeak ||
        act.isAirLeaking ||
        act.isCold ||
        act.isGreenhouse;

      particles.forEach((p) => {
        if (!hasParticles || act.isLost) {
          p.mesh.visible = false;
          return;
        }
        p.mesh.visible = true;
        const cycle = (elapsed * 0.75 + p.phase) % 1;

        if (act.isPatchingLeak) {
          particleMat.color.setHex(0xfde047);
          p.mesh.position.set(
            2.05 + Math.sin(cycle * 14 + p.phase * 9) * 0.45,
            1.1 + (cycle - 0.5) * 0.7,
            -0.35 + p.offsetZ * 0.4,
          );
          p.mesh.scale.setScalar((1 - cycle) * 1.1);
        } else if (act.isAirLeaking) {
          particleMat.color.setHex(0xe0f2fe);
          p.mesh.position.set(
            2.05 + cycle * 1.8,
            1.1 + p.offsetZ * 0.5,
            -0.35 + p.offsetX * 0.5,
          );
          p.mesh.scale.setScalar(0.5 + cycle * 0.9);
        } else if (act.isBuildingBattery) {
          particleMat.color.setHex(0xfbbf24);
          p.mesh.position.set(
            -4.1 + p.offsetX * 0.6,
            0.8 + cycle * 1.1,
            0.2 + p.offsetZ * 0.6,
          );
          p.mesh.scale.setScalar((1 - cycle) * 1.0);
        } else if (act.isTreating) {
          particleMat.color.setHex(0x34d399);
          p.mesh.position.set(
            -1.45 + p.offsetX * 0.8,
            0.4 + cycle * 1.6,
            -0.3 + p.offsetZ * 0.8,
          );
          p.mesh.scale.setScalar(0.8 * (1 - cycle * 0.5));
        } else if (act.isBakingAir || act.isEmergencyAir) {
          particleMat.color.setHex(0x38bdf8);
          p.mesh.position.set(
            -1.45 + p.offsetX * 0.6,
            0.3 + cycle * 1.8,
            -3.5 + p.offsetZ * 0.4,
          );
          p.mesh.scale.setScalar(0.85);
        } else if (act.isGreenhouse) {
          particleMat.color.setHex(0x4ade80);
          p.mesh.position.set(
            4.5 + p.offsetX * 0.7,
            0.5 + cycle * 1.2,
            -1.55 + p.offsetZ * 0.5,
          );
          p.mesh.scale.setScalar(0.75);
        } else if (act.isCold) {
          particleMat.color.setHex(0xa5f3fc);
          p.mesh.position.set(
            -1.35 + p.offsetX * 3.8,
            2.8 - cycle * 2.6,
            -0.35 + p.offsetZ * 2.5,
          );
          p.mesh.scale.setScalar(0.7);
        }
      });

      // --- Smooth Camera Preset Framing (Full-Screen Viewport + Optional Side Panel Balance) ---
      const panelOffsetX =
        snap.rightPanelOpen && window.innerWidth >= 1024 ? 0.95 : 0;

      if (snap.cameraPreset === "inside") {
        _camGoalPos.set(-1.1 + panelOffsetX * 0.45, 2.35, 5.15);
        _camGoalLook.set(-1.1 + panelOffsetX * 0.55, 1.28, -1.6);
      } else if (snap.cameraPreset === "outside") {
        _camGoalPos.set(6.35 + panelOffsetX * 0.65, 3.05, 6.0);
        _camGoalLook.set(5.45 + panelOffsetX * 0.75, 1.05, -2.0);
      } else {
        _camGoalPos.set(1.35 + panelOffsetX * 0.65, 3.4, 8.55);
        _camGoalLook.set(1.45 + panelOffsetX * 0.85, 1.15, -1.65);
      }

      if (!reducedMotion) {
        _camGoalPos.x += Math.sin(elapsed * 0.26) * 0.14;
        _camGoalPos.y += Math.cos(elapsed * 0.32) * 0.05;
      }

      camera.position.lerp(_camGoalPos, Math.min(1, dt * 4.5));
      cameraTarget.lerp(_camGoalLook, Math.min(1, dt * 4.5));
      camera.lookAt(cameraTarget);

      renderer.render(scene, camera);
      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = window.requestAnimationFrame(tick);
      }
    }

    tick();

    const handleResize = () => {
      if (!container || disposed) return;
      const w = container.clientWidth || window.innerWidth || 1280;
      const h = container.clientHeight || window.innerHeight || 720;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver =
      typeof ResizeObserver !== "undefined"
        ? new ResizeObserver(handleResize)
        : null;
    resizeObserver?.observe(container);
    window.addEventListener("resize", handleResize);

    return () => {
      disposed = true;
      redrawScreensRef.current = null;
      window.removeEventListener("resize", handleResize);
      resizeObserver?.disconnect();
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(frameId);
      renderer.domElement.removeEventListener("pointerdown", handlePointerDown);
      renderer.domElement.removeEventListener("pointerup", handlePointerUp);
      renderer.domElement.removeEventListener("pointermove", handlePointerMove);
      renderer.domElement.removeEventListener(
        "webglcontextlost",
        handleContextLost,
      );
      renderer.domElement.removeEventListener(
        "webglcontextrestored",
        handleContextRestored,
      );
      disposables.forEach((d) => d.dispose());
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  const actionSummary = deriveSceneAction(
    gameState,
    sky,
    lastChoiceId,
    currentEventType,
  );

  return (
    <div
      ref={mountRef}
      className="w-full h-full relative select-none overflow-hidden"
      aria-label="Interactive 3D Silica Station Command Bay with sliding airlock opening onto Shackleton Crater lunar surface"
    >
      {webglError && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-950 text-center p-6 space-y-2">
          <div className="text-sm font-bold text-sky-300">
            Silica Station Outpost (Safe Mode View)
          </div>
          <p className="text-xs text-slate-300 max-w-md">
            {actionSummary.headline}
          </p>
        </div>
      )}
    </div>
  );
};
