import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { Chess } from 'chess.js';
import { io } from 'socket.io-client';
import './style.css';
import gsap from 'gsap';
// Replace the audio setup with this
const moveSound = new Audio();
const captureSound = new Audio();
const checkSound = new Audio();

// Try to load sounds, but don't crash if they don't exist
try {
  moveSound.src = '/sounds/move.mp3';
  captureSound.src = '/sounds/capture.mp3';
  checkSound.src = '/sounds/check.mp3';
} catch (e) {
  console.log('Error loading sound files:', e);
}

// Add this function to safely play sounds
function playSound(sound) {
  try {
    // Reset the audio to the start and play
    sound.currentTime = 0;
    sound.play().catch(e => console.log('Error playing sound:', e));
  } catch (e) {
    console.log('Error playing sound:', e);
  }
}

// Add at the top
const moveHistory = [];

// Game state
let chess = new Chess(); // This will initialize with the standard starting position
let playerColor = 'w';
let gameId = null;
let selectedPiece = null;
let isMyTurn = true; // Set to true initially so you can see the pieces and interact

// Add these variables to store connection info
let reconnectionAttempts = 0;
let maxReconnectionAttempts = 5;
let previousSocketId = null;

// Three.js setup
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x121212);

const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 5, 8);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
// Update your renderer and light settings for better shadows
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap; // Softer shadows

const directionalLight = new THREE.DirectionalLight(0xffffff, 1);
directionalLight.position.set(5, 10, 7);
directionalLight.castShadow = true;
scene.add(directionalLight);
// Update the directional light for better shadow quality
directionalLight.castShadow = true;
directionalLight.shadow.mapSize.width = 1024;
directionalLight.shadow.mapSize.height = 1024;
directionalLight.shadow.camera.near = 0.5;
directionalLight.shadow.camera.far = 50;
directionalLight.shadow.camera.left = -10;
directionalLight.shadow.camera.right = 10;
directionalLight.shadow.camera.top = 10;
directionalLight.shadow.camera.bottom = -10;
directionalLight.shadow.bias = -0.001;document.body.appendChild(renderer.domElement);

// Lighting
const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);



// Add this after your lighting setup
// Create an environment map for reflections
const envMapTexture = new THREE.CubeTextureLoader().load([
  '/textures/px.jpg', '/textures/nx.jpg',
  '/textures/py.jpg', '/textures/ny.jpg',
  '/textures/pz.jpg', '/textures/nz.jpg'
]);

// Fallback if textures aren't available
try {
  const envMapIntensity = 0.3;
  scene.environment = envMapTexture;
  scene.environment.intensity = envMapIntensity;
} catch (e) {
  console.log('Environment map could not be loaded:', e);
}

// Controls
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;

// Chess board
const boardSize = 8;
const squareSize = 1;
const board = new THREE.Group();
scene.add(board);

// Create board squares
// Make sure the board squares receive shadows
for (let x = 0; x < boardSize; x++) {
  for (let y = 0; y < boardSize; y++) {
    const isWhite = (x + y) % 2 === 0;
    const geometry = new THREE.BoxGeometry(squareSize, 0.1, squareSize);
    const material = new THREE.MeshStandardMaterial({
      color: isWhite ? 0xe0c4a8 : 0x7c4c3e,
      roughness: 0.8,
      metalness: 0.1
    });
    
    const square = new THREE.Mesh(geometry, material);
    square.position.set(
      x - boardSize / 2 + 0.5, 
      0, 
      y - boardSize / 2 + 0.5
    );
    square.receiveShadow = true; // Enable receiving shadows
    square.userData = { type: 'square', file: String.fromCharCode(97 + x), rank: y + 1 };
    board.add(square);
  }
}

// Piece objects cache
const pieces = new THREE.Group();
board.add(pieces);
const pieceGeometries = {};
// Replace the pieceMaterials object with these improved materials
// Replace the pieceMaterials object with these improved materials
const pieceMaterials = {
  'w': new THREE.MeshStandardMaterial({ 
    color: 0xf0f0f0, 
    roughness: 0.3, 
    metalness: 0.1,
    envMapIntensity: 1.0,
    clearcoat: 0.3,          // Subtle polish effect
    clearcoatRoughness: 0.2  // Slightly glossy finish
  }),
  'b': new THREE.MeshStandardMaterial({ 
    color: 0x303030, 
    roughness: 0.4, 
    metalness: 0.2,
    envMapIntensity: 0.8,
    clearcoat: 0.4,          // More polished look for darker pieces
    clearcoatRoughness: 0.3  // Subtle variation in reflection
  })
};

// Create piece geometries with enhanced realism
function createPieceGeometries() {
  // PAWN - more elegant with better proportions and details
  const pawnBase = new THREE.CylinderGeometry(0.28, 0.32, 0.12, 32);
  const pawnCollar = new THREE.TorusGeometry(0.26, 0.03, 16, 32);
  pawnCollar.rotateX(Math.PI/2);
  pawnCollar.translate(0, 0.14, 0);
  
  const pawnMiddle = new THREE.CylinderGeometry(0.18, 0.26, 0.25, 32);
  pawnMiddle.translate(0, 0.27, 0);
  
  const pawnNeck = new THREE.CylinderGeometry(0.15, 0.18, 0.06, 32);
  pawnNeck.translate(0, 0.425, 0);
  
  const pawnTop = new THREE.SphereGeometry(0.19, 32, 32);
  pawnTop.translate(0, 0.55, 0);
  
  // Add subtle ridge around the sphere
  const pawnRidge = new THREE.TorusGeometry(0.16, 0.02, 16, 32);
  pawnRidge.rotateX(Math.PI/2);
  pawnRidge.translate(0, 0.51, 0);
  
  pieceGeometries.p = BufferGeometryUtils.mergeGeometries([
    pawnBase, pawnCollar, pawnMiddle, pawnNeck, pawnTop, pawnRidge
  ]);
  
  // ROOK - more detailed with better proportions
  const rookBase = new THREE.CylinderGeometry(0.33, 0.38, 0.15, 32);
  
  const rookBaseRing = new THREE.TorusGeometry(0.33, 0.03, 16, 32);
  rookBaseRing.rotateX(Math.PI/2);
  rookBaseRing.translate(0, 0.16, 0);
  
  const rookMiddle = new THREE.CylinderGeometry(0.28, 0.33, 0.35, 32);
  rookMiddle.translate(0, 0.33, 0);
  
  const rookTop = new THREE.CylinderGeometry(0.33, 0.28, 0.12, 32);
  rookTop.translate(0, 0.57, 0);
  
  // Create crenellations (castle-like top)
  const crenList = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = 0.24;
    
    // Outer box
    const cren = new THREE.BoxGeometry(0.1, 0.12, 0.1);
    cren.translate(
      Math.cos(angle) * radius,
      0.68,
      Math.sin(angle) * radius
    );
    
    // Inner cutout for more realistic battlement look
    const cutout = new THREE.BoxGeometry(0.06, 0.04, 0.06);
    cutout.translate(
      Math.cos(angle) * radius,
      0.7,
      Math.sin(angle) * radius
    );
    
    crenList.push(cren);
    
    // Only add cutouts to alternate crenellations
    if (i % 2 === 0) {
      crenList.push(cutout);
    }
  }
  
  // Add decorative ring below crenellations
  const rookCrenRing = new THREE.TorusGeometry(0.28, 0.02, 16, 32);
  rookCrenRing.rotateX(Math.PI/2);
  rookCrenRing.translate(0, 0.6, 0);
  
  pieceGeometries.r = BufferGeometryUtils.mergeGeometries([
    rookBase, rookBaseRing, rookMiddle, rookTop, rookCrenRing, ...crenList
  ]);
  
  // KNIGHT - highly detailed horse design
  const knightBase = new THREE.CylinderGeometry(0.33, 0.38, 0.15, 32);
  
  const knightBaseRing = new THREE.TorusGeometry(0.33, 0.03, 16, 32);
  knightBaseRing.rotateX(Math.PI/2);
  knightBaseRing.translate(0, 0.16, 0);
  
  const knightPedestal = new THREE.CylinderGeometry(0.26, 0.33, 0.2, 32);
  knightPedestal.translate(0, 0.24, 0);
  
  // Head geometry subgroups for better organization
  const knightHeadGroup = [];
  
  // Neck - more curved and natural
  const neck = new THREE.CylinderGeometry(0.16, 0.2, 0.28, 32);
  neck.rotateZ(Math.PI/5);
  neck.translate(-0.01, 0.44, 0);
  knightHeadGroup.push(neck);
  
  // Smoother head shape using ellipsoid
  const headCore = new THREE.SphereGeometry(0.25, 32, 32);
  headCore.scale(0.8, 0.75, 1.3);
  headCore.rotateY(Math.PI/6);
  headCore.rotateZ(-Math.PI/12);
  headCore.translate(0.15, 0.64, 0);
  knightHeadGroup.push(headCore);
  
  // Muzzle - more organic shape
  const muzzle = new THREE.CylinderGeometry(0.1, 0.14, 0.35, 32);
  muzzle.rotateZ(-Math.PI/3.5);
  muzzle.rotateY(Math.PI/12);
  muzzle.translate(0.36, 0.56, 0.05);
  knightHeadGroup.push(muzzle);
  
  // Nostrils
  const leftNostril = new THREE.SphereGeometry(0.03, 16, 16);
  leftNostril.scale(1, 0.5, 1);
  leftNostril.translate(0.52, 0.48, 0.06);
  knightHeadGroup.push(leftNostril);
  
  const rightNostril = new THREE.SphereGeometry(0.03, 16, 16);
  rightNostril.scale(1, 0.5, 1);
  rightNostril.translate(0.52, 0.48, -0.06);
  knightHeadGroup.push(rightNostril);
  
  // More realistic ears
  const leftEar = new THREE.ConeGeometry(0.06, 0.15, 16);
  leftEar.rotateZ(-Math.PI/8);
  leftEar.rotateY(Math.PI/6);
  leftEar.translate(0.08, 0.85, -0.13);
  knightHeadGroup.push(leftEar);
  
  const rightEar = new THREE.ConeGeometry(0.06, 0.15, 16);
  rightEar.rotateZ(-Math.PI/8);
  rightEar.rotateY(-Math.PI/6);
  rightEar.translate(0.08, 0.85, 0.13);
  knightHeadGroup.push(rightEar);
  
  // Mane - curved flowing shape
  for (let i = 0; i < 9; i++) {
    const y = 0.75 - (i * 0.06);
    const x = -0.06 - (i * 0.025);
    const maneSegment = new THREE.BoxGeometry(0.05, 0.1, 0.08);
    maneSegment.rotateZ(i * 0.02);
    maneSegment.translate(x, y, 0);
    knightHeadGroup.push(maneSegment);
  }
  
  // More detailed eyes
  const leftEyeSocket = new THREE.SphereGeometry(0.04, 16, 16);
  leftEyeSocket.scale(1, 0.8, 0.6);
  leftEyeSocket.translate(0.25, 0.64, 0.18);
  knightHeadGroup.push(leftEyeSocket);
  
  const rightEyeSocket = new THREE.SphereGeometry(0.04, 16, 16);
  rightEyeSocket.scale(1, 0.8, 0.6);
  rightEyeSocket.translate(0.25, 0.64, -0.18);
  knightHeadGroup.push(rightEyeSocket);
  
  // Brow ridges
  const leftBrow = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 16);
  leftBrow.rotateX(Math.PI/3);
  leftBrow.rotateZ(Math.PI/6);
  leftBrow.translate(0.2, 0.7, 0.15);
  knightHeadGroup.push(leftBrow);
  
  const rightBrow = new THREE.CylinderGeometry(0.02, 0.02, 0.1, 16);
  rightBrow.rotateX(-Math.PI/3);
  rightBrow.rotateZ(Math.PI/6);
  rightBrow.translate(0.2, 0.7, -0.15);
  knightHeadGroup.push(rightBrow);
  
  // Jaw definition
  const jaw = new THREE.SphereGeometry(0.15, 16, 16);
  jaw.scale(1.2, 0.6, 0.9);
  jaw.translate(0.4, 0.45, 0);
  knightHeadGroup.push(jaw);
  
  pieceGeometries.n = BufferGeometryUtils.mergeGeometries([
    knightBase, knightBaseRing, knightPedestal, ...knightHeadGroup
  ]);
  
  // BISHOP - more sculpted mitre and details
  const bishopBase = new THREE.CylinderGeometry(0.33, 0.38, 0.15, 32);
  
  const bishopBaseRing = new THREE.TorusGeometry(0.33, 0.03, 16, 32);
  bishopBaseRing.rotateX(Math.PI/2);
  bishopBaseRing.translate(0, 0.16, 0);
  
  const bishopMiddle = new THREE.CylinderGeometry(0.2, 0.33, 0.3, 32);
  bishopMiddle.translate(0, 0.3, 0);
  
  const bishopCollar = new THREE.TorusGeometry(0.22, 0.03, 16, 32);
  bishopCollar.rotateX(Math.PI/2);
  bishopCollar.translate(0, 0.47, 0);
  
  // Use a more organic mitre shape
  const bishopMitre = new THREE.ConeGeometry(0.22, 0.45, 32);
  // Create a subtle curve on the mitre
  for (let i = 0; i < bishopMitre.attributes.position.count; i++) {
    const y = bishopMitre.attributes.position.getY(i);
    if (y > 0) {
      // Add subtle inward curve as y increases
      const x = bishopMitre.attributes.position.getX(i);
      const z = bishopMitre.attributes.position.getZ(i);
      const distance = Math.sqrt(x*x + z*z);
      const factor = 1 - (y * 0.1);
      bishopMitre.attributes.position.setX(i, x * factor);
      bishopMitre.attributes.position.setZ(i, z * factor);
    }
  }
  bishopMitre.computeVertexNormals();
  bishopMitre.translate(0, 0.7, 0);
  
  // Add a realistic slit in the mitre
  const mitreSlit = new THREE.BoxGeometry(0.025, 0.3, 0.45);
  mitreSlit.translate(0, 0.75, 0);
  
  // More detailed cross
  const verticalCross = new THREE.BoxGeometry(0.06, 0.18, 0.06);
  verticalCross.translate(0, 0.98, 0);
  
  const horizontalCross = new THREE.BoxGeometry(0.15, 0.06, 0.06);
  horizontalCross.translate(0, 0.92, 0);
  
  // Add small spheres at tips of cross
  const crossTop = new THREE.SphereGeometry(0.03, 16, 16);
  crossTop.translate(0, 1.07, 0);
  
  const crossLeft = new THREE.SphereGeometry(0.03, 16, 16);
  crossLeft.translate(-0.075, 0.92, 0);
  
  const crossRight = new THREE.SphereGeometry(0.03, 16, 16);
  crossRight.translate(0.075, 0.92, 0);
  
  pieceGeometries.b = BufferGeometryUtils.mergeGeometries([
    bishopBase, bishopBaseRing, bishopMiddle, bishopCollar, 
    bishopMitre, mitreSlit, verticalCross, horizontalCross,
    crossTop, crossLeft, crossRight
  ]);
  
  // QUEEN - highly detailed with elegant crown
  const queenBase = new THREE.CylinderGeometry(0.35, 0.4, 0.15, 32);
  
  const queenBaseRing = new THREE.TorusGeometry(0.35, 0.03, 16, 32);
  queenBaseRing.rotateX(Math.PI/2);
  queenBaseRing.translate(0, 0.16, 0);
  
  const queenLowerMiddle = new THREE.CylinderGeometry(0.3, 0.35, 0.2, 32);
  queenLowerMiddle.translate(0, 0.23, 0);
  
  // Add a decorative ring in the middle
  const queenMidRing = new THREE.TorusGeometry(0.3, 0.03, 16, 32);
  queenMidRing.rotateX(Math.PI/2);
  queenMidRing.translate(0, 0.33, 0);
  
  const queenUpperMiddle = new THREE.CylinderGeometry(0.25, 0.3, 0.25, 32);
  queenUpperMiddle.translate(0, 0.45, 0);
  
  // Queen's crown with organic curves
  const queenCrownBase = new THREE.CylinderGeometry(0.3, 0.25, 0.12, 32);
  queenCrownBase.translate(0, 0.63, 0);
  
  // Crown rings
  const queenLowerCrownRing = new THREE.TorusGeometry(0.28, 0.025, 16, 32);
  queenLowerCrownRing.rotateX(Math.PI/2);
  queenLowerCrownRing.translate(0, 0.58, 0);
  
  const queenUpperCrownRing = new THREE.TorusGeometry(0.28, 0.025, 16, 32);
  queenUpperCrownRing.rotateX(Math.PI/2);
  queenUpperCrownRing.translate(0, 0.68, 0);
  
  // Elegant crown points with spherical tips
  const queenPoints = [];
  for (let i = 0; i < 8; i++) {
    const angle = (i / 8) * Math.PI * 2;
    const radius = 0.24;
    
    // Create a more elegant spike using a cone
    const spike = new THREE.CylinderGeometry(0.02, 0.05, 0.2, 16);
    spike.translate(
      Math.cos(angle) * radius,
      0.78,
      Math.sin(angle) * radius
    );
    queenPoints.push(spike);
    
    // Add detailed sphere at each point
    const point = new THREE.SphereGeometry(0.035, 16, 16);
    point.translate(
      Math.cos(angle) * radius,
      0.9,
      Math.sin(angle) * radius
    );
    queenPoints.push(point);
    
    // Connect points with arcs
    const connectionRadius = 0.04;
    const connectionAngle = Math.PI / 8;
    
    if (i < 8) {
      const nextAngle = ((i + 1) / 8) * Math.PI * 2;
      const midAngle = (angle + nextAngle) / 2;
      
      const arcPoint = new THREE.SphereGeometry(0.025, 16, 16);
      arcPoint.translate(
        Math.cos(midAngle) * (radius - 0.03),
        0.8,
        Math.sin(midAngle) * (radius - 0.03)
      );
      queenPoints.push(arcPoint);
    }
  }
  
  // Central orb with detailed gem faceting
  const queenOrb = new THREE.SphereGeometry(0.08, 32, 32);
  queenOrb.translate(0, 0.95, 0);
  
  // Small supporting cylinder under the orb
  const orbSupport = new THREE.CylinderGeometry(0.04, 0.04, 0.08, 16);
  orbSupport.translate(0, 0.85, 0);
  
  pieceGeometries.q = BufferGeometryUtils.mergeGeometries([
    queenBase, queenBaseRing, queenLowerMiddle, queenMidRing, queenUpperMiddle,
    queenCrownBase, queenLowerCrownRing, queenUpperCrownRing,
    orbSupport, queenOrb, ...queenPoints
  ]);
  
  // KING - majestic with detailed cross and crown
  const kingBase = new THREE.CylinderGeometry(0.37, 0.42, 0.15, 32);
  
  const kingBaseRing = new THREE.TorusGeometry(0.37, 0.03, 16, 32);
  kingBaseRing.rotateX(Math.PI/2);
  kingBaseRing.translate(0, 0.16, 0);
  
  const kingLowerMiddle = new THREE.CylinderGeometry(0.32, 0.37, 0.2, 32);
  kingLowerMiddle.translate(0, 0.23, 0);
  
  // Decorative rings
  const kingMidRing = new THREE.TorusGeometry(0.32, 0.03, 16, 32);
  kingMidRing.rotateX(Math.PI/2);
  kingMidRing.translate(0, 0.33, 0);
  
  const kingUpperMiddle = new THREE.CylinderGeometry(0.27, 0.32, 0.3, 32);
  kingUpperMiddle.translate(0, 0.48, 0);
  
  // King's crown with more detailed shape
  const kingCrown = new THREE.CylinderGeometry(0.34, 0.27, 0.15, 32);
  kingCrown.translate(0, 0.7, 0);
  
  // Crown rings
  const kingLowerCrownRing = new THREE.TorusGeometry(0.3, 0.025, 16, 32);
  kingLowerCrownRing.rotateX(Math.PI/2);
  kingLowerCrownRing.translate(0, 0.65, 0);
  
  const kingUpperCrownRing = new THREE.TorusGeometry(0.32, 0.025, 16, 32);
  kingUpperCrownRing.rotateX(Math.PI/2);
  kingUpperCrownRing.translate(0, 0.75, 0);
  
  // Distinct crown points - fewer than queen for clear differentiation
  const kingPoints = [];
  for (let i = 0; i < 5; i++) {
    const angle = (i / 5) * Math.PI * 2;
    const radius = 0.28;
    
    // More substantial crown points
    const point = new THREE.CylinderGeometry(0.03, 0.06, 0.16, 16);
    point.translate(
      Math.cos(angle) * radius,
      0.83,
      Math.sin(angle) * radius
    );
    kingPoints.push(point);
    
    // Add sphere to top of each point
    const pointTop = new THREE.SphereGeometry(0.04, 16, 16);
    pointTop.translate(
      Math.cos(angle) * radius,
      0.92,
      Math.sin(angle) * radius
    );
    kingPoints.push(pointTop);
  }
  
  // Cross base with more elegant shape
  const crossBase = new THREE.CylinderGeometry(0.06, 0.1, 0.08, 16);
  crossBase.translate(0, 0.88, 0);
  
  // More detailed cross
  const crossVertical = new THREE.CylinderGeometry(0.05, 0.05, 0.3, 16);
  crossVertical.translate(0, 1.07, 0);
  
  const crossHorizontal = new THREE.CylinderGeometry(0.05, 0.05, 0.22, 16);
  crossHorizontal.rotateZ(Math.PI/2);
  crossHorizontal.translate(0, 0.98, 0);
  
  // Add spheres at the ends of the cross
  const crossDecorations = [];
  crossDecorations.push(new THREE.SphereGeometry(0.055, 16, 16).translate(0, 1.22, 0));
  crossDecorations.push(new THREE.SphereGeometry(0.055, 16, 16).translate(-0.11, 0.98, 0));
  crossDecorations.push(new THREE.SphereGeometry(0.055, 16, 16).translate(0.11, 0.98, 0));
  
  // Add small sphere for connection detail
  crossDecorations.push(new THREE.SphereGeometry(0.06, 16, 16).translate(0, 0.98, 0));
  
  pieceGeometries.k = BufferGeometryUtils.mergeGeometries([
    kingBase, kingBaseRing, kingLowerMiddle, kingMidRing, kingUpperMiddle,
    kingCrown, kingLowerCrownRing, kingUpperCrownRing, crossBase,
    crossVertical, crossHorizontal, 
    ...kingPoints, ...crossDecorations
  ]);
}

// Create a 3D chess piece with improved materials
function createPiece(type, color) {
  // Safety check to ensure we have the geometry
  if (!pieceGeometries[type.toLowerCase()]) {
    console.error(`Geometry for piece type ${type} not found!`);
    // Create a fallback geometry (simple cylinder) if the specific piece geometry is missing
    pieceGeometries[type.toLowerCase()] = new THREE.CylinderGeometry(0.2, 0.3, 0.6, 16);
  }
  
  const material = pieceMaterials[color].clone();
  
  // Add piece-specific material properties for better visual distinction
  if (color === 'w') {
    // White pieces
    if (type.toLowerCase() === 'p') {
      material.color.setHex(0xf0f0f0);
      material.roughness = 0.5;
      material.metalness = 0.05;
      material.clearcoat = 0.2;
    } else if (type.toLowerCase() === 'r') {
      material.color.setHex(0xf5f5f5);
      material.roughness = 0.4;
      material.metalness = 0.1;
      material.clearcoat = 0.25;
    } else if (type.toLowerCase() === 'n') {
      material.color.setHex(0xf8f8f8);
      material.roughness = 0.35;
      material.metalness = 0.15;
      material.clearcoat = 0.3;
      material.envMapIntensity = 1.0;
    } else if (type.toLowerCase() === 'b') {
      material.color.setHex(0xfafafa);
      material.roughness = 0.3;
      material.metalness = 0.2;
      material.clearcoat = 0.35;
    } else if (type.toLowerCase() === 'q') {
      material.color.setHex(0xffffff);
      material.roughness = 0.2;
      material.metalness = 0.3;
      material.envMapIntensity = 1.3;
      material.clearcoat = 0.4;
    } else if (type.toLowerCase() === 'k') {
      material.color.setHex(0xffffff);
      material.roughness = 0.15;
      material.metalness = 0.35;
      material.envMapIntensity = 1.5;
      material.clearcoat = 0.5;
    }
  } else {
    // Black pieces
    if (type.toLowerCase() === 'p') {
      material.color.setHex(0x303030);
      material.roughness = 0.5;
      material.metalness = 0.05;
      material.clearcoat = 0.3;
    } else if (type.toLowerCase() === 'r') {
      material.color.setHex(0x252525);
      material.roughness = 0.4;
      material.metalness = 0.1;
      material.clearcoat = 0.35;
    } else if (type.toLowerCase() === 'n') {
      material.color.setHex(0x202020);
      material.roughness = 0.35;
      material.metalness = 0.15;
      material.envMapIntensity = 1.0;
      material.clearcoat = 0.4;
    } else if (type.toLowerCase() === 'b') {
      material.color.setHex(0x181818);
      material.roughness = 0.3;
      material.metalness = 0.2;
      material.clearcoat = 0.45;
    } else if (type.toLowerCase() === 'q') {
      material.color.setHex(0x101010);
      material.roughness = 0.2;
      material.metalness = 0.3;
      material.envMapIntensity = 1.3;
      material.clearcoat = 0.5;
    } else if (type.toLowerCase() === 'k') {
      material.color.setHex(0x050505);
      material.roughness = 0.15;
      material.metalness = 0.35;
      material.envMapIntensity = 1.5;
      material.clearcoat = 0.55;
    }
  }
  
  try {
    const geometry = pieceGeometries[type.toLowerCase()];
    const piece = new THREE.Mesh(geometry, material);
    
    piece.castShadow = true;
    piece.receiveShadow = true;
    
    // Make sure userData is properly assigned to the top level mesh
    piece.userData = { 
      type: 'piece',
      pieceType: type,
      pieceColor: color,
      square: '' // This will be filled in when placing the piece
    };
    
    return piece;
  } catch (error) {
    console.error("Error creating piece:", error);
    // Create a fallback piece
    const fallbackGeometry = new THREE.CylinderGeometry(0.2, 0.3, 0.5, 16);
    const fallbackPiece = new THREE.Mesh(fallbackGeometry, material);
    fallbackPiece.castShadow = true;
    fallbackPiece.receiveShadow = true;
    fallbackPiece.userData = { 
      type: 'piece',
      pieceType: type,
      pieceColor: color,
      square: '',
      isFallback: true
    };
    return fallbackPiece;
  }
}

// Add this before the Socket.io setup
// Determine the server URL based on the current environment
const serverUrl = window.location.hostname === 'localhost' 
  ? 'http://localhost:3000'
  : window.location.hostname.includes('cloudflare') 
    ? `https://${window.location.hostname}` // For Cloudflare tunnels
    : 'https://incredible-pressed-reading-develop.trycloudflare.com'; // Replace with default fallback

console.log('Connecting to server at:', serverUrl);

// Socket.io setup with reconnection options
const socket = io(serverUrl, {
  withCredentials: true,
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  reconnectionDelayMax: 5000,
  timeout: 20000
});

// Store previous socket ID when connected
socket.on('connect', () => {
  console.log('Connected to server with ID:', socket.id);
  previousSocketId = socket.id;
  reconnectionAttempts = 0;
  
  // If we have an active game, try to reconnect to it
  if (gameId) {
    socket.emit('reconnect-to-game', { gameId, previousId: previousSocketId });
  }
});

// Handle reconnection event
socket.on('reconnect', (attemptNumber) => {
  console.log(`Reconnected to server after ${attemptNumber} attempts`);
  
  // If we have an active game, try to reconnect to it
  if (gameId) {
    socket.emit('reconnect-to-game', { gameId, previousId: previousSocketId });
  }
});

socket.on('reconnect_attempt', (attemptNumber) => {
  console.log(`Reconnection attempt #${attemptNumber}`);
  reconnectionAttempts = attemptNumber;
});

socket.on('reconnect_error', (error) => {
  console.log('Reconnection error:', error);
  
  if (reconnectionAttempts >= maxReconnectionAttempts) {
    showToast('Connection lost. Please refresh the page.', 'error');
  }
});

socket.on('reconnect_failed', () => {
  showToast('Unable to connect to game server. Please refresh the page.', 'error');
});

// Add heartbeat to keep connection alive
setInterval(() => {
  if (socket.connected && gameId) {
    socket.emit('heartbeat', { gameId });
  }
}, 25000); // 25 seconds

// Handle game state sync
socket.on('game-state-synced', (data) => {
  chess.load(data.fen);
  isMyTurn = data.turn === playerColor;
  updateBoard();
  updateGameStatus(data);
});

// Handle successful reconnection to a game
socket.on('reconnected-to-game', (data) => {
  gameId = data.gameId;
  playerColor = data.color;
  chess.load(data.fen);
  isMyTurn = data.turn === playerColor;
  
  updateBoard();
  positionCameraForPlayer();
  updateGameStatus(data);
  
  showToast('Successfully reconnected to the game', 'success');
});

// Handle opponent reconnection
socket.on('opponent-reconnected', () => {
  showToast('Your opponent has reconnected', 'info');
});

// Handle opponent disconnection
socket.on('opponent-disconnected', () => {
  showToast('Your opponent has disconnected. Waiting for them to reconnect...', 'warning');
});

// Handle explicit turn notification
socket.on('your-turn', () => {
  isMyTurn = true;
  updateStatus('Your turn');
  showToast('Your turn', 'info');
});

// UI Setup
const uiContainer = document.createElement('div');
uiContainer.id = 'ui-container';
uiContainer.style.position = 'fixed';
uiContainer.style.right = '20px';  // Position from right instead of left
uiContainer.style.top = '20px';
uiContainer.style.maxWidth = '300px';  // Limit width to prevent overflow
uiContainer.style.zIndex = '100';
document.body.appendChild(uiContainer);

// Create game UI
const createGameUI = () => {
  uiContainer.innerHTML = `
    <div class="game-panel">
      <button id="create-game">Create New Game</button>
      <div class="join-game">
        <input type="text" id="game-id" placeholder="Game ID">
        <button id="join-game">Join Game</button>
      </div>
      <div id="status"></div>
    </div>
  `;

  document.getElementById('create-game').addEventListener('click', () => {
    socket.emit('create-game');
  });

  document.getElementById('join-game').addEventListener('click', () => {
    const id = document.getElementById('game-id').value;
    if (id) {
      socket.emit('join-game', { gameId: id });
    }
  });
};

// Socket events
socket.on('game-created', (data) => {
  gameId = data.gameId;
  playerColor = data.color;
  
  // Show the game ID in the UI
  const gameIdDisplay = document.getElementById('game-id-display');
  const currentGameId = document.getElementById('current-game-id');
  
  if (gameIdDisplay && currentGameId) {
    gameIdDisplay.style.display = 'flex';
    currentGameId.textContent = gameId;
  }
  
  // Enable game control buttons
  document.getElementById('resign-btn').disabled = false;
  document.getElementById('draw-btn').disabled = false;
  
  updateStatus(`Game created! ID: ${gameId}. Waiting for opponent...`);
});

socket.on('game-joined', (data) => {
  gameId = data.gameId;
  playerColor = data.color;
  
  // Enable game control buttons
  document.getElementById('resign-btn').disabled = false;
  document.getElementById('draw-btn').disabled = false;
  
  positionCameraForPlayer();
  updateStatus(`Joined game: ${gameId}. You are playing as black.`);
});

socket.on('game-start', (data) => {
  updateStatus(`Game started! ${playerColor === 'w' ? 'Your' : "Opponent's"} turn.`);
  chess.load(data.fen);
  isMyTurn = playerColor === 'w';
  updateBoard();
  logBoardState();
});

// Update the move-made event handler
socket.on('move-made', (data) => {
  clearHighlights();
  selectedPiece = null;
  
  // Play appropriate sound
  if (data.isCheck) {
    playSound(checkSound);
  } else if (data.move && data.move.captured) {
    playSound(captureSound);
  } else {
    playSound(moveSound);
  }
  
  // Save current board state
  const oldBoard = chess.board();
  
  // Load new state
  chess.load(data.fen);
  
  // Set turn consistently with server data
  isMyTurn = data.turn === playerColor;
  
  // Animate the move
  animateMove(data.from, data.to, () => {
    // Update the rest of the board after animation completes
    updateBoard();
  });
  
  // Update game status based on server data
  updateGameStatus(data);
  
  // Add move to history
  moveHistory.push({
    from: data.from,
    to: data.to,
    piece: chess.get(data.to),
    fen: data.fen
  });
  
  updateMoveHistory();
  
  // Request a sync after each move to ensure consistency
  setTimeout(() => {
    if (gameId) {
      socket.emit('sync-game-state', { gameId });
    }
  }, 1000);
});

socket.on('player-disconnected', () => {
  updateStatus('Opponent disconnected!');
});

socket.on('error', (data) => {
  updateStatus(`Error: ${data.message}`);
});

// Helper functions
function updateStatus(message) {
  const status = document.getElementById('status');
  if (status) {
    status.textContent = message;
  }
}
function updateGameStatus(data) {
  if (data.isCheckmate) {
    const winner = data.turn === 'w' ? 'Black' : 'White';
    updateStatus(`Checkmate! ${winner} wins!`);
    showToast(`Checkmate! ${winner} wins!`, 'success');
  } else if (data.isDraw) {
    updateStatus('Game ended in a draw!');
    showToast('Game ended in a draw!', 'info');
  } else if (data.isCheck) {
    updateStatus(`Check! ${isMyTurn ? 'Your' : "Opponent's"} turn.`);
    if (isMyTurn) showToast('Check! Your turn', 'warning');
  } else {
    updateStatus(`${isMyTurn ? 'Your' : "Opponent's"} turn.`);
  }
}

// Add or modify this function to ensure pieces are properly positioned on the board
// Ensure pieces are properly positioned on the board
function updateBoard() {
  // Clear existing pieces
  while (pieces.children.length > 0) {
    const child = pieces.children[0];
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
    pieces.remove(child);
  }
  
  // Add pieces based on current chess.js state
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const square = String.fromCharCode(97 + file) + (rank + 1);
      const piece = chess.get(square);
      
      if (piece) {
        const pieceObj = createPiece(piece.type, piece.color);
        if (!pieceObj) continue; // Skip if piece creation failed
        
        const x = file - 3.5;
        const z = rank - 3.5;
        
        // Consistent height for all pieces
        const baseHeight = 0.05;
        pieceObj.position.set(x, baseHeight, z);
        
        // Make sure the userData is complete
        pieceObj.userData = { 
          type: 'piece', 
          pieceType: piece.type,
          pieceColor: piece.color,
          square: square 
        };
        
        // If king is in check, add a red glow
        if (piece.type === 'k' && chess.isCheck() && piece.color === chess.turn()) {
          const checkIndicator = new THREE.Mesh(
            new THREE.RingGeometry(0.4, 0.5, 32),
            new THREE.MeshBasicMaterial({ 
              color: 0xff0000, 
              side: THREE.DoubleSide,
              transparent: true,
              opacity: 0.7,
              depthWrite: false
            })
          );
          checkIndicator.rotation.x = -Math.PI / 2;
          checkIndicator.position.y = 0.01;
          checkIndicator.userData = { type: 'check-indicator' };
          pieceObj.add(checkIndicator);
        }
        
        pieces.add(pieceObj);
      }
    }
  }
  
  logBoardState();
  applyRenderOrder();
}

// Add debugging function
function logBoardState() {
  console.log("Current FEN:", chess.fen());
  console.log("Number of pieces rendered:", pieces.children.length);
  console.log("Pieces on board:", pieces.children.map(p => 
    `${p.userData.pieceType}${p.userData.pieceColor} at ${p.userData.square}`
  ));
}

// Raycaster for piece selection
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function onMouseClick(event) {
  // Calculate mouse position in normalized device coordinates
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
  
  // Update the raycaster
  raycaster.setFromCamera(mouse, camera);
  
  // Check for intersections with highlights first (for move selection)
  let intersects = raycaster.intersectObjects(highlights.children, false);
  
  if (intersects.length > 0 && selectedPiece) {
    // User clicked on a highlighted square (legal move)
    const highlightObj = intersects[0].object;
    const targetSquare = highlightObj.userData.targetSquare;
    
    console.log(`Moving piece from ${selectedPiece} to ${targetSquare}`);
    
    // Make the move
    if (isMyTurn) {
      socket.emit('make-move', {
        gameId,
        from: selectedPiece,
        to: targetSquare
      });
    }
    
    clearHighlights();
    selectedPiece = null;
    return;
  }
  
  // Check for intersections with pieces
  // Use recursive flag to catch child objects too
  intersects = raycaster.intersectObjects(pieces.children, true);
  
  if (intersects.length > 0) {
    // Handle piece selection
    const clickedObject = intersects[0].object;
    
    // Traverse up to find the piece object (which has the userData we want)
    let pieceObject = clickedObject;
    while (pieceObject && (!pieceObject.userData || !pieceObject.userData.type || pieceObject.userData.type !== 'piece')) {
      pieceObject = pieceObject.parent;
    }
    
    if (pieceObject && pieceObject.userData && pieceObject.userData.type === 'piece') {
      const piece = pieceObject.userData;
      console.log(`Clicked on piece:`, piece);
      
      if (piece.pieceColor === playerColor && isMyTurn) {
        selectedPiece = piece.square;
        console.log(`Selected piece at ${selectedPiece}`);
        showLegalMoves(selectedPiece); // Show legal moves for the selected piece
      }
    }
  } else {
    // If no piece was clicked, check for intersections with board squares
    intersects = raycaster.intersectObjects(board.children);
    
    if (intersects.length > 0) {
      const clickedObject = intersects[0].object;
      
      if (clickedObject.userData && clickedObject.userData.type === 'square') {
        const file = clickedObject.userData.file;
        const rank = clickedObject.userData.rank;
        const square = file + rank;
        
        console.log(`Clicked on square ${square}`);
        
        if (selectedPiece) {
          // Attempt to move the piece
          if (isMyTurn) {
            // Check if this is a legal move
            const moves = chess.moves({ square: selectedPiece, verbose: true });
            const isLegalMove = moves.some(move => move.to === square);
            
            if (isLegalMove) {
              console.log(`Making move from ${selectedPiece} to ${square}`);
              socket.emit('make-move', {
                gameId,
                from: selectedPiece,
                to: square
              });
            }
          }
          clearHighlights();
          selectedPiece = null;
        } else {
          // Try to select a piece on this square
          const piece = chess.get(square);
          if (piece && piece.color === playerColor && isMyTurn) {
            selectedPiece = square;
            console.log(`Selected piece at ${selectedPiece}`);
            showLegalMoves(selectedPiece); // Show legal moves for the selected piece
          }
        }
      }
    } else {
      // Clicked on empty space - clear selection
      clearHighlights();
      selectedPiece = null;
    }
  }
}

// Highlight selected piece
function highlightSelectedPiece(square) {
  clearHighlights();
  
  // Find the piece and add highlight
  pieces.children.forEach(piece => {
    if (piece.userData.square === square) {
      const highlight = new THREE.Mesh(
        new THREE.RingGeometry(0.4, 0.5, 32),
        new THREE.MeshBasicMaterial({ color: 0x00ff00, side: THREE.DoubleSide })
      );
      highlight.rotation.x = -Math.PI / 2;
      highlight.position.y = 0.01;
      highlight.userData = { type: 'highlight' };
      piece.add(highlight);
    }
  });
}

// Highlight materials for different types of moves
const highlightMaterials = {
  selected: new THREE.MeshBasicMaterial({ 
    color: 0x00ff00, 
    opacity: 0.7, 
    transparent: true,
    depthWrite: false, // Prevents z-fighting
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4
  }),
  move: new THREE.MeshBasicMaterial({ 
    color: 0x0088ff, 
    opacity: 0.7, 
    transparent: true,
    depthWrite: false, // Prevents z-fighting
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4
  }),
  capture: new THREE.MeshBasicMaterial({ 
    color: 0xff0000, 
    opacity: 0.7, 
    transparent: true,
    depthWrite: false, // Prevents z-fighting
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -4
  })
};

// Highlight group
const highlights = new THREE.Group();
board.add(highlights);

// Function to show legal moves for a selected piece
function showLegalMoves(square) {
  console.log(`Showing legal moves for piece at ${square}`);
  
  // Clear all existing highlights first
  clearHighlights();
  
  // Highlight the selected square
  highlightSquare(square, 'selected');
  
  // Get all legal moves for the selected piece
  const moves = chess.moves({ square: square, verbose: true });
  console.log(`Legal moves:`, moves.map(m => m.to));
  
  // Highlight each legal move
  moves.forEach(move => {
    const moveType = move.captured ? 'capture' : 'move';
    highlightSquare(move.to, moveType);
  });
  
  console.log(`Total highlights: ${highlights.children.length}`);
  applyRenderOrder();
}

// Replace the highlightSquare function with this improved version
function highlightSquare(square, type) {
  // Find the position from algebraic notation
  const file = square.charCodeAt(0) - 97; // 'a' is 97 in ASCII
  const rank = parseInt(square.charAt(1)) - 1;
  
  // Create a highlight mesh with a slight size increase to prevent edge flicker
  const geometry = new THREE.PlaneGeometry(squareSize, squareSize);
  const material = highlightMaterials[type].clone();
  const highlight = new THREE.Mesh(geometry, material);
  
  // Position the highlight above the board to prevent z-fighting
  highlight.position.set(
    file - 3.5, 
    0.06, // Raised slightly higher
    rank - 3.5
  );
  
  // Rotate to lie flat on the board
  highlight.rotation.x = -Math.PI / 2;
  
  // Store the square information for interaction
  highlight.userData = { 
    type: 'highlight',
    moveType: type,
    targetSquare: square 
  };
  
  highlight.renderOrder = 20; // Make sure highlights render on top
  
  highlights.add(highlight);
  
  return highlight;
}

// Update the clearHighlights function to be more thorough
function clearHighlights() {
  // Remove all highlights from the highlights group
  while (highlights.children.length > 0) {
    const child = highlights.children[0];
    highlights.remove(child);
    
    // Dispose of geometries and materials to prevent memory leaks
    if (child.geometry) child.geometry.dispose();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach(m => m.dispose());
      } else {
        child.material.dispose();
      }
    }
  }
  
  // Also clear any highlights attached directly to pieces
  pieces.children.forEach(piece => {
    for (let i = piece.children.length - 1; i >= 0; i--) {
      if (piece.children[i].userData && 
          (piece.children[i].userData.type === 'highlight' || 
           piece.children[i].userData.type === 'check-indicator')) {
        const child = piece.children[i];
        piece.remove(child);
        
        // Dispose of geometries and materials
        if (child.geometry) child.geometry.dispose();
        if (child.material) {
          if (Array.isArray(child.material)) {
            child.material.forEach(m => m.dispose());
          } else {
            child.material.dispose();
          }
        }
      }
    }
  });
}

// Store the last move for animation
let lastMove = null;

// Animate piece movement


// Event listeners
window.addEventListener('click', onMouseClick);
window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// Animation loop
function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}

// Add loading screen to improve user experience
function showLoadingScreen() {
  const loadingScreen = document.createElement('div');
  loadingScreen.id = 'loading-screen';
  loadingScreen.style.position = 'fixed';
  loadingScreen.style.top = '0';
  loadingScreen.style.left = '0';
  loadingScreen.style.width = '100%';
  loadingScreen.style.height = '100%';
  loadingScreen.style.backgroundColor = '#121212';
  loadingScreen.style.display = 'flex';
  loadingScreen.style.flexDirection = 'column';
  loadingScreen.style.alignItems = 'center';
  loadingScreen.style.justifyContent = 'center';
  loadingScreen.style.zIndex = '1000';
  loadingScreen.style.color = 'white';
  
  loadingScreen.innerHTML = `
    <h1 style="margin-bottom: 20px;">3D Chess</h1>
    <div class="loading-spinner" style="border: 5px solid rgba(255,255,255,0.1); 
         border-top: 5px solid #4CAF50; border-radius: 50%; 
         width: 50px; height: 50px; animation: spin 1s linear infinite;"></div>
    <p style="margin-top: 20px;">Loading game...</p>
  `;
  
  // Add keyframes for the spinner
  const style = document.createElement('style');
  style.textContent = `
    @keyframes spin {
      0% { transform: rotate(0deg); }
      100% { transform: rotate(360deg); }
    }
  `;
  document.head.appendChild(style);
  
  document.body.appendChild(loadingScreen);
}

function hideLoadingScreen() {
  const loadingScreen = document.getElementById('loading-screen');
  if (loadingScreen) {
    loadingScreen.style.opacity = '0';
    loadingScreen.style.transition = 'opacity 0.5s ease';
    setTimeout(() => {
      if (loadingScreen.parentNode) {
        loadingScreen.parentNode.removeChild(loadingScreen);
      }
    }, 500);
  }
}

// Call at the beginning of your application
showLoadingScreen();

// Start the application
createBetterUI();
createPieceGeometries();
updateBoard(); // Show initial board setup
applyRenderOrder();
animate();

// Hide loading screen after everything is loaded
setTimeout(hideLoadingScreen, 800); // Give it a slight delay for a smooth transition

function positionCameraForPlayer() {
  if (playerColor === 'b') {
    camera.position.set(0, 5, -8);
    camera.lookAt(0, 0, 0);
  } else {
    camera.position.set(0, 5, 8);
    camera.lookAt(0, 0, 0);
  }
  controls.update();
}

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => {
        document.body.removeChild(toast);
      }, 500);
    }, 3000);
  }, 100);
}

// Add this function to update move history
function updateMoveHistory() {
  const historyElement = document.getElementById('move-history');
  if (!historyElement) return;

  let htmlContent = '';
  
  // Group moves in pairs for standard chess notation
  for (let i = 0; i < moveHistory.length; i += 2) {
    const moveNumber = Math.floor(i / 2) + 1;
    const whiteMove = moveHistory[i];
    const blackMove = i + 1 < moveHistory.length ? moveHistory[i + 1] : null;
    
    htmlContent += `<div class="move-row">
      <span class="move-number">${moveNumber}.</span>
      <span class="white-move">${formatMove(whiteMove)}</span>
      ${blackMove ? `<span class="black-move">${formatMove(blackMove)}</span>` : ''}
    </div>`;
  }
  
  historyElement.innerHTML = htmlContent;
  
  // Scroll to bottom to show latest moves
  historyElement.scrollTop = historyElement.scrollHeight;
  
  // Update captured pieces display
  updateCapturedPieces();
}

// Format chess moves in a nicer way
function formatMove(move) {
  if (!move) return '';
  
  const pieceSymbols = {
    'p': '',
    'n': 'N',
    'b': 'B',
    'r': 'R',
    'q': 'Q',
    'k': 'K'
  };
  
  // Get piece symbol
  let notation = pieceSymbols[move.piece.type.toLowerCase()];
  
  // Add capture symbol
  if (move.captured) notation += 'x';
  
  // Add destination square
  notation += move.to;
  
  // Add check or checkmate symbol
  if (move.isCheck) notation += '+';
  if (move.isCheckmate) notation += '#';
  
  return notation;
}

// Add this function to display captured pieces
function updateCapturedPieces() {
  const whiteCaptured = document.getElementById('captured-white');
  const blackCaptured = document.getElementById('captured-black');
  
  if (!whiteCaptured || !blackCaptured) return;
  
  // Clear existing displays
  whiteCaptured.innerHTML = '';
  blackCaptured.innerHTML = '';
  
  // Get all captured pieces from move history
  const captured = {
    'w': [],
    'b': []
  };
  
  moveHistory.forEach(move => {
    if (move.captured) {
      captured[move.captured.color].push(move.captured.type);
    }
  });
  
  // Create HTML for captured pieces
  for (const color in captured) {
    const container = color === 'w' ? whiteCaptured : blackCaptured;
    
    captured[color].forEach(pieceType => {
      const pieceSpan = document.createElement('span');
      pieceSpan.className = `captured-piece ${color}`;
      pieceSpan.textContent = getPieceSymbol(pieceType);
      container.appendChild(pieceSpan);
    });
  }
}

// Get Unicode chess symbols
function getPieceSymbol(pieceType) {
  const symbols = {
    'p': '♟',
    'n': '♞',
    'b': '♝',
    'r': '♜',
    'q': '♛',
    'k': '♚'
  };
  return symbols[pieceType.toLowerCase()] || '';
}

// Add a proper move history display panel
function createBetterUI() {
  // Replace the existing UI
  uiContainer.innerHTML = `
    <div class="game-panel">
      <div class="game-info">
        <button id="create-game" class="primary-btn">Create New Game</button>
        <div class="join-game">
          <input type="text" id="game-id" placeholder="Enter Game ID">
          <button id="join-game" class="secondary-btn">Join</button>
        </div>
        <div id="game-id-display" class="game-id-display" style="display: none;">
          <span id="current-game-id"></span>
          <button class="copy-button" id="copy-game-id" title="Copy Game ID">📋</button>
        </div>
        <div id="status" class="status-display">Welcome to 3D Chess</div>
        <div class="game-options">
          <button id="resign-btn" class="danger-btn" disabled>Resign</button>
          <button id="draw-btn" class="neutral-btn" disabled>Offer Draw</button>
          <button id="flip-board" class="neutral-btn">Flip Board</button>
        </div>
      </div>
      <div class="move-history-panel">
        <h3>Move History</h3>
        <div id="move-history" class="move-list"></div>
      </div>
      <div class="captured-pieces">
        <div id="captured-white" class="captured-row"></div>
        <div id="captured-black" class="captured-row"></div>
      </div>
    </div>
  `;

  // Add event listeners
  document.getElementById('create-game').addEventListener('click', () => {
    socket.emit('create-game');
    showToast('Creating new game...', 'info');
  });

  document.getElementById('join-game').addEventListener('click', () => {
    const id = document.getElementById('game-id').value;
    if (id) {
      socket.emit('join-game', { gameId: id });
      showToast('Joining game...', 'info');
    } else {
      showToast('Please enter a Game ID', 'warning');
    }
  });

  document.getElementById('flip-board').addEventListener('click', () => {
    flipBoard();
  });

  document.getElementById('resign-btn').addEventListener('click', () => {
    if (gameId && confirm('Are you sure you want to resign?')) {
      socket.emit('resign-game', { gameId });
      showToast('You resigned the game', 'info');
    }
  });

  document.getElementById('draw-btn').addEventListener('click', () => {
    if (gameId) {
      if (document.getElementById('draw-btn').textContent === 'Accept Draw') {
        socket.emit('accept-draw', { gameId });
        showToast('Draw accepted', 'success');
      } else {
        socket.emit('offer-draw', { gameId });
        document.getElementById('draw-btn').textContent = 'Draw Offered...';
        document.getElementById('draw-btn').disabled = true;
        setTimeout(() => {
          document.getElementById('draw-btn').textContent = 'Offer Draw';
          document.getElementById('draw-btn').disabled = false;
        }, 3000);
        showToast('Draw offer sent', 'info');
      }
    }
  });
  
  // Add copy game ID functionality
  document.getElementById('copy-game-id').addEventListener('click', () => {
    const gameIdText = document.getElementById('current-game-id').textContent;
    navigator.clipboard.writeText(gameIdText)
      .then(() => {
        showToast('Game ID copied to clipboard!', 'success');
      })
      .catch(err => {
        showToast('Failed to copy: ' + err, 'error');
      });
  });
  
  // Create mobile-friendly controls overlay
  const controlsOverlay = document.createElement('div');
  controlsOverlay.className = 'game-controls-overlay';
  controlsOverlay.innerHTML = `
    <button class="control-button" id="zoom-in" title="Zoom In">+</button>
    <button class="control-button" id="zoom-out" title="Zoom Out">-</button>
    <button class="control-button" id="reset-view" title="Reset View">⟲</button>
    <button class="control-button" id="toggle-ui" title="Toggle UI">≡</button>
  `;
  document.body.appendChild(controlsOverlay);
  // Replace your existing toggle UI function with this:
  function toggleUI() {
    const uiContainer = document.getElementById('ui-container');
    
    if (uiContainer.classList.contains('ui-hidden')) {
      uiContainer.classList.remove('ui-hidden');
    } else {
      uiContainer.classList.add('ui-hidden');
    }
    
    localStorage.setItem('chessUIHidden', uiContainer.classList.contains('ui-hidden'));
  }

// Add this function to restore UI state on page load
function restoreUIState() {
  const uiContainer = document.getElementById('ui-container');
  const wasHidden = localStorage.getItem('chessUIHidden') === 'true';
  
  if (wasHidden) {
    uiContainer.classList.add('ui-hidden');
  } else {
    uiContainer.classList.remove('ui-hidden');
  }
}

// Call this on page load after the UI is created
document.addEventListener('DOMContentLoaded', function() {
  restoreUIState();
});

// Update the event listener for your toggle UI button
document.getElementById('toggle-ui').addEventListener('click', toggleUI);
  // Add event listeners for the control buttons
  document.getElementById('zoom-in').addEventListener('click', () => {
    camera.position.multiplyScalar(0.9);
    controls.update();
  });
  
  document.getElementById('zoom-out').addEventListener('click', () => {
    camera.position.multiplyScalar(1.1);
    controls.update();
  });
  
  document.getElementById('reset-view').addEventListener('click', () => {
    positionCameraForPlayer();
  });
  
  document.getElementById('toggle-ui').addEventListener('click', () => {
    uiContainer.style.display = uiContainer.style.display === 'none' ? 'block' : 'none';
  });
}

// Add this new function to create more visually distinct highlights
function createBetterHighlights() {
  // Replace the showLegalMoves function with this new version
  window.showLegalMoves = function(square) {
    console.log(`Showing legal moves for piece at ${square}`);
    
    // Clear all existing highlights first
    clearHighlights();
    
    // Get all legal moves for the selected piece
    const moves = chess.moves({ square: square, verbose: true });
    console.log(`Legal moves:`, moves.map(m => m.to));
    
    // Create a raised border for the selected square
    const fileSelected = square.charCodeAt(0) - 97;
    const rankSelected = parseInt(square.charAt(1)) - 1;
    
    // Create a glowing border for the selected piece
    const selectedGeometry = new THREE.BoxGeometry(squareSize + 0.1, 0.12, squareSize + 0.1);
    const selectedMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff00,
      transparent: true,
      opacity: 0.8
    });
    
    const selectedHighlight = new THREE.Mesh(selectedGeometry, selectedMaterial);
    selectedHighlight.position.set(
      fileSelected - 3.5,
      0.05,
      rankSelected - 3.5
    );
    
    selectedHighlight.userData = {
      type: 'highlight',
      moveType: 'selected',
      targetSquare: square
    };
    
    selectedHighlight.renderOrder = 20;
    highlights.add(selectedHighlight);
    
    // Highlight each legal move with a different style
    moves.forEach(move => {
      
      const file = move.to.charCodeAt(0) - 97;
      const rank = parseInt(move.to.charAt(1)) - 1;
      
      let highlightMesh;
      
      if (move.captured) {
        // For captures, add a red circle
        const circleGeometry = new THREE.RingGeometry(0.3, 0.4, 32);
        const circleMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xff0000, 
          transparent: true, 
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        
        highlightMesh = new THREE.Mesh(circleGeometry, circleMaterial);
        highlightMesh.rotation.x = -Math.PI / 2;
        highlightMesh.position.set(file - 3.5, 0.07, rank - 3.5);
      } else {
        // For regular moves, add a small dot
        const dotGeometry = new THREE.CircleGeometry(0.15, 32);
        const dotMaterial = new THREE.MeshBasicMaterial({ 
          color: 0x0088ff, 
          transparent: true, 
          opacity: 0.8,
          side: THREE.DoubleSide,
          depthWrite: false
        });
        
        highlightMesh = new THREE.Mesh(dotGeometry, dotMaterial);
        highlightMesh.rotation.x = -Math.PI / 2;
        highlightMesh.position.set(file - 3.5, 0.07, rank - 3.5);
      }
      
      highlightMesh.userData = {
        type: 'highlight',
        moveType: move.captured ? 'capture' : 'move',
        targetSquare: move.to
      };
      
      highlightMesh.renderOrder = 20;
      highlights.add(highlightMesh);
    });
    
    console.log(`Total highlights: ${highlights.children.length}`);
  };
}

// Add a renderOrder property to ensure highlights render properly
function applyRenderOrder() {
  // Set render order to ensure proper drawing sequence
  board.children.forEach((child) => {
    if (child.userData && child.userData.type === 'square') {
      child.renderOrder = 0; // Board squares render first
    }
  });
  
  pieces.children.forEach((child) => {
    child.renderOrder = 10; // Pieces render after board
  });
  
  highlights.children.forEach((child) => {
    child.renderOrder = 20; // Highlights render last
  });
}

// Call at the end of your initialization code (before the animate() call)
createBetterHighlights();

// Also call this after createPieceGeometries and updateBoard
applyRenderOrder();

// Add hover effect to pieces
function setupPieceHoverEffects() {
  // Track the hovered piece
  let hoveredPiece = null;
  const hoverScaleFactor = 1.1;
  const hoverHeight = 0.25;
  const baseHeight = 0.09; // Match the height used in updateBoard
  
  // Set up the raycaster for hover detection
  const hoverRaycaster = new THREE.Raycaster();
  
  // Add mousemove event listener
  window.addEventListener('mousemove', (event) => {
    if (!isMyTurn) return; // Only allow hover when it's player's turn
    
    // Calculate mouse position in normalized device coordinates
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
    
    // Update the raycaster
    hoverRaycaster.setFromCamera(mouse, camera);
    
    // Check for intersections with pieces
    const intersects = hoverRaycaster.intersectObjects(pieces.children, true);
    
    // If we found an intersection with a piece
    if (intersects.length > 0) {
      // Find the top-level piece mesh
      let pieceObject = intersects[0].object;
      while (pieceObject && (!pieceObject.userData || pieceObject.userData.type !== 'piece')) {
        pieceObject = pieceObject.parent;
      }
      
      // Only proceed if we found a valid piece
      if (pieceObject && pieceObject.userData && 
          pieceObject.userData.type === 'piece' && 
          pieceObject.userData.pieceColor === playerColor) {
        
        // If this is a new piece being hovered
        if (hoveredPiece !== pieceObject) {
          // Reset previous hover, if any
          if (hoveredPiece) {
            // Reset the old hovered piece
            gsap.to(hoveredPiece.position, {
              y: baseHeight,  // Return to the correct base height
              duration: 0.2
            });
            gsap.to(hoveredPiece.scale, {
              x: 1,
              y: 1,
              z: 1,
              duration: 0.2
            });
          }
          
          // Set the new hover
          hoveredPiece = pieceObject;
          
          // Animate the hover effect
          gsap.to(hoveredPiece.position, {
            y: baseHeight + hoverHeight,  // Lift from the base height
            duration: 0.2
          });
          gsap.to(hoveredPiece.scale, {
            x: hoverScaleFactor,
            y: hoverScaleFactor,
            z: hoverScaleFactor,
            duration: 0.2
          });
          
          document.body.style.cursor = 'pointer';
        }
        return;
      }
    }
    
    // If we're here, nothing is being hovered
    if (hoveredPiece) {
      // Reset the hover effect
      gsap.to(hoveredPiece.position, {
        y: baseHeight,  // Return to the correct base height
        duration: 0.2
      });
      gsap.to(hoveredPiece.scale, {
        x: 1,
        y: 1,
        z: 1,
        duration: 0.2
      });
      hoveredPiece = null;
      document.body.style.cursor = 'auto';
    }
  });
}

// Enhanced animation for piece movement
// Enhanced animation for piece movement
function animateMove(from, to, onComplete) {
  // Get position data
  const fromFile = from.charCodeAt(0) - 97;
  const fromRank = parseInt(from.charAt(1)) - 1;
  const toFile = to.charCodeAt(0) - 97; 
  const toRank = parseInt(to.charAt(1)) - 1;
  
  // Find the piece at the source position
  let movingPiece = null;
  pieces.children.forEach(piece => {
    if (piece.userData.square === from) {
      movingPiece = piece;
    }
  });
  
  if (!movingPiece) return;
  
  // Update the square in userData
  movingPiece.userData.square = to;
  
  // Use the consistent base height throughout the code
  const baseHeight = 0.05;
  
  // Calculate start and target positions
  const startPos = { 
    x: fromFile - 3.5, 
    y: baseHeight, 
    z: fromRank - 3.5 
  };
  
  const targetPos = { 
    x: toFile - 3.5, 
    y: baseHeight, 
    z: toRank - 3.5 
  };
  
  // Use GSAP for smoother animation
  gsap.to(movingPiece.position, {
    x: targetPos.x,
    z: targetPos.z,
    duration: 0.5,
    ease: "power2.inOut",
    onComplete: () => {
      // Make sure the piece ends at exactly the right height
      movingPiece.position.y = baseHeight;
      if (onComplete) onComplete();
    },
    onUpdate: function() {
      // Calculate progress for the arc movement
      const dx = targetPos.x - startPos.x;
      const dz = targetPos.z - startPos.z;
      const distance = Math.sqrt(dx*dx + dz*dz);
      
      // The progress is more accurately calculated based on both x and z movement
      const xProgress = (movingPiece.position.x - startPos.x) / dx;
      const zProgress = (movingPiece.position.z - startPos.z) / dz;
      
      // Use the more appropriate progress value (avoid NaN)
      let progress;
      if (isNaN(xProgress) || !isFinite(xProgress)) {
        progress = zProgress;
      } else if (isNaN(zProgress) || !isFinite(zProgress)) {
        progress = xProgress;
      } else {
        // Use an average if both are valid
        progress = (xProgress + zProgress) / 2;
      }
      
      if (!isNaN(progress) && isFinite(progress)) {
        // Add a nice arc based on distance (higher arc for longer moves)
        const arcHeight = Math.min(0.5 + (distance * 0.2), 1.0);
        movingPiece.position.y = baseHeight + Math.sin(progress * Math.PI) * arcHeight;
      }
    }
  });
}

// Call this function after all other UI setup
setupPieceHoverEffects();

// Replace createEnhancedBoard with this improved version
function createEnhancedBoard() {
  // Add a thicker border around the board
  const borderSize = 0.5;
  const borderHeight = 0.15;
  const borderGeometry = new THREE.BoxGeometry(boardSize + borderSize*2, borderHeight, boardSize + borderSize*2);
  const borderMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x5d4037,
    roughness: 0.7,
    metalness: 0.2
  });
  
  const boardBorder = new THREE.Mesh(borderGeometry, borderMaterial);
  boardBorder.position.set(0, -0.05 - borderHeight/2, 0);
  boardBorder.receiveShadow = true;
  board.add(boardBorder);
  
  // Add a wooden table under the board
  const tableSize = boardSize + 4;
  const tableHeight = 0.5;
  const tableGeometry = new THREE.BoxGeometry(tableSize, tableHeight, tableSize);
  const tableMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x8d6e63,
    roughness: 0.8,
    metalness: 0.1
  });
  
  const table = new THREE.Mesh(tableGeometry, tableMaterial);
  table.position.set(0, -0.05 - borderHeight - tableHeight/2, 0);
  table.receiveShadow = true;
  scene.add(table);
  
  // Add ambient environment - a subtle room
  const roomSize = 30;
  const roomHeight = 15;
  const roomGeometry = new THREE.BoxGeometry(roomSize, roomHeight, roomSize);
  const roomMaterial = new THREE.MeshStandardMaterial({ 
    color: 0x212121,
    side: THREE.BackSide,
    roughness: 1,
    metalness: 0
  });
  
  const room = new THREE.Mesh(roomGeometry, roomMaterial);
  room.position.set(0, roomHeight/2 - 0.05 - borderHeight - tableHeight, 0);
  scene.add(room);
  

  
  // Add coordinate labels around the board
  const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
  const ranks = ['1', '2', '3', '4', '5', '6', '7', '8'];
  
  // Create labels manually with sprites instead of text geometry
  for (let i = 0; i < 8; i++) {
    // File labels (a-h)
    createLabelSprite(files[i], i - 3.5, 0.06, 4.2);
    createLabelSprite(files[i], i - 3.5, 0.06, -4.2);
    
    // Rank labels (1-8)
    createLabelSprite(ranks[i], -4.2, 0.06, i - 3.5);
    createLabelSprite(ranks[i], 4.2, 0.06, i - 3.5);
  }
}

// Helper function to create text labels
function createLabelSprite(text, x, y, z) {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  
  const context = canvas.getContext('2d');
  context.fillStyle = '#dddddd';
  context.font = 'bold 40px Arial';
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  context.fillText(text, 32, 32);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture });
  const sprite = new THREE.Sprite(material);
  
  sprite.position.set(x, y, z);
  sprite.scale.set(0.3, 0.3, 0.3);
  board.add(sprite);
}

// Call this after creating the board
createEnhancedBoard();

// Add these socket event handlers after the other socket events
socket.on('draw-offered', () => {
  showToast('Your opponent offered a draw', 'info');
  const drawBtn = document.getElementById('draw-btn');
  drawBtn.textContent = 'Accept Draw';
  drawBtn.classList.add('highlight-btn');
});

socket.on('draw-accepted', () => {
  showToast('Draw accepted! Game ended in a draw.', 'success');
  updateStatus('Game ended in a draw by agreement!');
  
  // Disable game controls when game ends
  document.getElementById('resign-btn').disabled = true;
  document.getElementById('draw-btn').disabled = true;
});

socket.on('player-resigned', (data) => {
  const winner = data.winner === playerColor ? 'You' : 'Your opponent';
  const loser = data.winner !== playerColor ? 'You' : 'Your opponent';
  
  showToast(`${loser} resigned. ${winner} won!`, 'info');
  updateStatus(`Game over. ${loser} resigned. ${winner} won!`);
  
  // Disable game controls when game ends
  document.getElementById('resign-btn').disabled = true;
  document.getElementById('draw-btn').disabled = true;
});

// Replace the incorrect event listener at the end of createBetterUI function

document.getElementById('toggle-ui').addEventListener('click', () => {
  toggleUI();
});