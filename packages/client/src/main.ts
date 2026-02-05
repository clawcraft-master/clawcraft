import * as THREE from 'three';
import { BlockTypes, BlockDefinitions, CHUNK_SIZE } from '@clawcraft/shared';
import type { Agent, Chunk, Vec3 } from '@clawcraft/shared';
import {
  initConvex,
  authenticate,
  subscribeToAgents,
  subscribeToChunk,
  subscribeToChat,
  updatePosition,
  sendChat,
  loadOrGenerateChunks,
  disconnect,
  getMyAgentId,
  type ConvexAgent,
  type ConvexChunk,
  type ConvexChatMessage,
} from './convex-client';

// ============================================================================
// STATE
// ============================================================================

let myAgent: ConvexAgent | null = null;
let agents: Map<string, ConvexAgent> = new Map();
let chunks: Map<string, Chunk> = new Map();
let spectatorMode = false;
let connected = false;

// Three.js
let scene: THREE.Scene;
let camera: THREE.PerspectiveCamera;
let renderer: THREE.WebGLRenderer;
let chunkMeshes: Map<string, THREE.Mesh> = new Map();
let waterMeshes: Map<string, THREE.Mesh> = new Map();
let agentMeshes: Map<string, THREE.Mesh> = new Map();
let agentLabels: Map<string, THREE.Sprite> = new Map();

// Controls
const keys: Set<string> = new Set();
let mouseLocked = false;
let yaw = 0;
let pitch = 0;

// Player physics (client-side prediction)
let playerPosition = { x: 0, y: 64, z: 0 };
let playerVelocity = { x: 0, y: 0, z: 0 };
const GRAVITY = -0.02;
const JUMP_FORCE = 0.3;
const MOVE_SPEED = 0.15;
const FRICTION = 0.8;
let onGround = false;

// Block interaction
let selectedBlockIndex = 0;
const hotbarBlocks = [
  BlockTypes.STONE,
  BlockTypes.DIRT,
  BlockTypes.GRASS,
  BlockTypes.WOOD,
  BlockTypes.LEAVES,
  BlockTypes.SAND,
];
const raycaster = new THREE.Raycaster();
raycaster.far = 10;

// Stats
let lastTime = performance.now();
let frames = 0;
let fps = 0;

// Block highlight
let blockHighlight: THREE.LineSegments | null = null;
let lastHighlightPos: Vec3 | null = null;

// Position sync
let lastPositionSync = 0;
const POSITION_SYNC_INTERVAL = 50; // ms

// Chunk subscriptions
let chunkUnsubscribes: Map<string, () => void> = new Map();

// Player dimensions (bounding box)
const PLAYER_WIDTH = 0.6;
const PLAYER_HEIGHT = 1.8;

// ============================================================================
// COLLISION DETECTION
// ============================================================================

/** Get block ID at world coordinates */
function getBlockAtWorld(worldX: number, worldY: number, worldZ: number): number {
  const cx = Math.floor(worldX / CHUNK_SIZE);
  const cy = Math.floor(worldY / CHUNK_SIZE);
  const cz = Math.floor(worldZ / CHUNK_SIZE);
  const key = `${cx},${cy},${cz}`;
  
  const chunk = chunks.get(key);
  if (!chunk) return BlockTypes.AIR; // Unloaded = air (passable)
  
  const localX = ((Math.floor(worldX) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const localY = ((Math.floor(worldY) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const localZ = ((Math.floor(worldZ) % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  
  const index = localX + localY * CHUNK_SIZE + localZ * CHUNK_SIZE * CHUNK_SIZE;
  return chunk.blocks[index] ?? BlockTypes.AIR;
}

/** Check if a block is solid (collidable) */
function isBlockSolid(blockId: number): boolean {
  const def = BlockDefinitions[blockId as keyof typeof BlockDefinitions];
  return def?.solid ?? false;
}

/** Check if a position collides with solid blocks (AABB collision) */
function checkCollision(x: number, y: number, z: number): boolean {
  const halfWidth = PLAYER_WIDTH / 2;
  
  // Check all 8 corners of the player's bounding box
  const minX = x - halfWidth;
  const maxX = x + halfWidth;
  const minY = y;
  const maxY = y + PLAYER_HEIGHT;
  const minZ = z - halfWidth;
  const maxZ = z + halfWidth;
  
  // Check corners and edges
  const checkPoints = [
    [minX, minY, minZ], [maxX, minY, minZ], [minX, minY, maxZ], [maxX, minY, maxZ],
    [minX, maxY, minZ], [maxX, maxY, minZ], [minX, maxY, maxZ], [maxX, maxY, maxZ],
    // Mid points for better collision on thin walls
    [x, minY, minZ], [x, minY, maxZ], [minX, minY, z], [maxX, minY, z],
    [x, maxY, minZ], [x, maxY, maxZ], [minX, maxY, z], [maxX, maxY, z],
  ];
  
  for (const [px, py, pz] of checkPoints) {
    if (isBlockSolid(getBlockAtWorld(px, py, pz))) {
      return true;
    }
  }
  
  return false;
}

/** Check if standing on solid ground */
function checkGrounded(x: number, y: number, z: number): boolean {
  const halfWidth = PLAYER_WIDTH / 2;
  const groundY = y - 0.01; // Slightly below feet
  
  // Check under feet
  const checkPoints = [
    [x, groundY, z],
    [x - halfWidth, groundY, z - halfWidth],
    [x + halfWidth, groundY, z - halfWidth],
    [x - halfWidth, groundY, z + halfWidth],
    [x + halfWidth, groundY, z + halfWidth],
  ];
  
  for (const [px, py, pz] of checkPoints) {
    if (isBlockSolid(getBlockAtWorld(px, py, pz))) {
      return true;
    }
  }
  
  return false;
}

// ============================================================================
// INITIALIZATION
// ============================================================================

function init(): void {
  // Three.js setup
  scene = new THREE.Scene();
  scene.background = new THREE.Color(0x87ceeb);
  scene.fog = new THREE.Fog(0x87ceeb, 50, 200);

  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
  camera.position.set(0, 70, 0);

  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.getElementById('canvas-container')!.appendChild(renderer.domElement);

  // Lighting
  const ambient = new THREE.AmbientLight(0xffffff, 0.6);
  scene.add(ambient);

  const sun = new THREE.DirectionalLight(0xffffff, 0.8);
  sun.position.set(100, 200, 100);
  scene.add(sun);

  // Block highlight (wireframe cube)
  const highlightGeometry = new THREE.BoxGeometry(1.01, 1.01, 1.01);
  const highlightEdges = new THREE.EdgesGeometry(highlightGeometry);
  const highlightMaterial = new THREE.LineBasicMaterial({ 
    color: 0x000000, 
    linewidth: 2,
    transparent: true,
    opacity: 0.8 
  });
  blockHighlight = new THREE.LineSegments(highlightEdges, highlightMaterial);
  blockHighlight.visible = false;
  scene.add(blockHighlight);

  // Event listeners
  window.addEventListener('resize', onResize);
  document.addEventListener('keydown', (e) => keys.add(e.code));
  document.addEventListener('keyup', (e) => keys.delete(e.code));
  document.addEventListener('mousemove', onMouseMove);
  renderer.domElement.addEventListener('click', () => {
    if (!mouseLocked) {
      renderer.domElement.requestPointerLock();
    }
  });
  
  // Block interaction
  renderer.domElement.addEventListener('mousedown', onBlockInteract);
  renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  
  // Hotbar selection
  document.addEventListener('keydown', (e) => {
    if (document.activeElement?.tagName === 'INPUT') return;
    const num = parseInt(e.key);
    if (num >= 1 && num <= hotbarBlocks.length) {
      selectedBlockIndex = num - 1;
      updateHotbar();
    }
  });
  
  document.addEventListener('pointerlockchange', () => {
    mouseLocked = document.pointerLockElement === renderer.domElement;
  });

  // UI - Spectate only (agents use API)
  document.getElementById('spectate-btn')!.addEventListener('click', () => connect(true));

  // Chat input
  const chatInput = document.getElementById('chat-input') as HTMLInputElement;
  chatInput.addEventListener('keydown', async (e) => {
    e.stopPropagation();
    if (e.key === 'Enter' && chatInput.value.trim()) {
      const input = chatInput.value.trim();
      
      // Handle commands
      if (input.startsWith('/')) {
        handleCommand(input);
      } else if (!spectatorMode && myAgent) {
        await sendChat(input);
      } else if (spectatorMode) {
        addChatMessage('System', 'Spectators cannot chat. Connect as an agent to chat.');
      }
      chatInput.value = '';
      chatInput.blur();
    } else if (e.key === 'Escape') {
      chatInput.blur();
    }
  });

  // Press T or Enter to focus chat
  document.addEventListener('keydown', (e) => {
    if (document.activeElement !== chatInput && (e.key === 't' || e.key === 'T' || e.key === 'Enter')) {
      if (document.getElementById('connect-modal')!.style.display !== 'none') return;
      e.preventDefault();
      chatInput.focus();
    }
  });

  // Start render loop
  animate();
}

async function connect(spectate: boolean): Promise<void> {
  // Browser clients are spectators only - agents use the HTTP API
  spectatorMode = true;

  try {
    // Initialize Convex
    const convexUrl = import.meta.env.VITE_CONVEX_URL;
    if (!convexUrl) {
      throw new Error('VITE_CONVEX_URL not set');
    }
    initConvex(convexUrl);

    // Spectator mode - no authentication needed
    addChatMessage('System', 'Spectating... Use WASD + Space/Shift to fly');

    // Subscribe to real-time updates
    setupSubscriptions();

    // Load initial chunks around player
    await loadInitialChunks();

    connected = true;
    document.getElementById('connect-modal')!.style.display = 'none';
  } catch (err: any) {
    console.error('Connection failed:', err);
    alert('Connection failed: ' + err.message);
  }
}

function setupSubscriptions(): void {
  // Subscribe to online agents
  subscribeToAgents((agentList) => {
    const oldAgents = new Set(agents.keys());
    
    for (const agent of agentList) {
      const id = agent._id;
      const existing = agents.get(id);
      
      if (!existing) {
        // New agent joined
        agents.set(id, agent);
        createAgentMesh(agent);
        if (connected) {
          addChatMessage('System', `${agent.username} joined the world`);
        }
      } else {
        // Update existing agent
        agents.set(id, agent);
        updateAgentMesh(agent);
      }
      oldAgents.delete(id);
    }
    
    // Remove agents that left
    for (const id of oldAgents) {
      const leftAgent = agents.get(id);
      if (leftAgent) {
        addChatMessage('System', `${leftAgent.username} left the world`);
      }
      agents.delete(id);
      removeAgentMesh(id);
    }
    
    updateAgentList();
    document.getElementById('agent-count')!.textContent = agents.size.toString();
  });

  // Subscribe to chat
  subscribeToChat((messages) => {
    const container = document.getElementById('chat-messages')!;
    container.innerHTML = '';
    
    for (const msg of messages) {
      addChatMessageDirect(msg.senderName, msg.message);
    }
  });
}

async function loadInitialChunks(): Promise<void> {
  const cx = Math.floor(playerPosition.x / CHUNK_SIZE);
  const cy = Math.floor(playerPosition.y / CHUNK_SIZE);
  const cz = Math.floor(playerPosition.z / CHUNK_SIZE);
  
  const radius = 3;
  const coords: Array<{ key: string; cx: number; cy: number; cz: number }> = [];
  
  for (let dx = -radius; dx <= radius; dx++) {
    for (let dy = -1; dy <= 2; dy++) {
      for (let dz = -radius; dz <= radius; dz++) {
        const chunkCx = cx + dx;
        const chunkCy = cy + dy;
        const chunkCz = cz + dz;
        coords.push({
          key: `${chunkCx},${chunkCy},${chunkCz}`,
          cx: chunkCx,
          cy: chunkCy,
          cz: chunkCz,
        });
      }
    }
  }
  
  // Load or generate chunks
  const loadedChunks = await loadOrGenerateChunks(coords);
  
  for (const [key, chunk] of Object.entries(loadedChunks)) {
    if (chunk) {
      handleChunkData(chunk);
      subscribeToChunkUpdates(key);
    }
  }
}

function subscribeToChunkUpdates(key: string): void {
  if (chunkUnsubscribes.has(key)) return;
  
  const unsub = subscribeToChunk(key, (chunk) => {
    handleChunkData(chunk);
  });
  chunkUnsubscribes.set(key, unsub);
}

function handleChunkData(convexChunk: ConvexChunk): void {
  // Decode base64 blocks
  const binaryString = atob(convexChunk.blocksBase64);
  const blocks = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    blocks[i] = binaryString.charCodeAt(i);
  }
  
  const chunk: Chunk = {
    coord: { cx: convexChunk.cx, cy: convexChunk.cy, cz: convexChunk.cz },
    blocks,
  };
  
  chunks.set(convexChunk.key, chunk);
  createChunkMesh(chunk);
}

// ============================================================================
// BLOCK INTERACTION
// ============================================================================

function onBlockInteract(e: MouseEvent): void {
  if (!mouseLocked || spectatorMode || !myAgent) return;
  
  if (e.button === 0) {
    // Left click - break block
    const hit = raycastBlock(false);
    if (hit) {
      breakBlockAt(hit.x, hit.y, hit.z);
    }
  } else if (e.button === 2) {
    // Right click - place block
    const hit = raycastBlock(true);
    if (hit) {
      placeBlockAt(hit.x, hit.y, hit.z, hotbarBlocks[selectedBlockIndex] as number);
    }
  }
}

async function placeBlockAt(x: number, y: number, z: number, blockType: number): Promise<void> {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);
  const key = `${cx},${cy},${cz}`;
  
  const chunk = chunks.get(key);
  if (!chunk) return;
  
  // Local update
  const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const index = localX + localY * CHUNK_SIZE + localZ * CHUNK_SIZE * CHUNK_SIZE;
  
  chunk.blocks[index] = blockType;
  createChunkMesh(chunk);
  
  // Sync to Convex
  const { placeBlock } = await import('./convex-client');
  const blocksBase64 = btoa(String.fromCharCode(...chunk.blocks));
  await placeBlock(x, y, z, blockType, key, cx, cy, cz, blocksBase64);
}

async function breakBlockAt(x: number, y: number, z: number): Promise<void> {
  const cx = Math.floor(x / CHUNK_SIZE);
  const cy = Math.floor(y / CHUNK_SIZE);
  const cz = Math.floor(z / CHUNK_SIZE);
  const key = `${cx},${cy},${cz}`;
  
  const chunk = chunks.get(key);
  if (!chunk) return;
  
  // Local update
  const localX = ((x % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const localY = ((y % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const localZ = ((z % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
  const index = localX + localY * CHUNK_SIZE + localZ * CHUNK_SIZE * CHUNK_SIZE;
  
  chunk.blocks[index] = BlockTypes.AIR;
  createChunkMesh(chunk);
  
  // Sync to Convex
  const { breakBlock } = await import('./convex-client');
  const blocksBase64 = btoa(String.fromCharCode(...chunk.blocks));
  await breakBlock(x, y, z, key, blocksBase64);
}

function raycastBlock(placeMode: boolean): Vec3 | null {
  raycaster.setFromCamera(new THREE.Vector2(0, 0), camera);
  
  const meshes = Array.from(chunkMeshes.values());
  const intersects = raycaster.intersectObjects(meshes);
  
  if (intersects.length === 0) return null;
  
  const hit = intersects[0];
  const point = hit.point;
  const normal = hit.face?.normal;
  
  if (!normal) return null;
  
  if (placeMode) {
    return {
      x: Math.floor(point.x + normal.x * 0.5),
      y: Math.floor(point.y + normal.y * 0.5),
      z: Math.floor(point.z + normal.z * 0.5),
    };
  } else {
    return {
      x: Math.floor(point.x - normal.x * 0.5),
      y: Math.floor(point.y - normal.y * 0.5),
      z: Math.floor(point.z - normal.z * 0.5),
    };
  }
}

// ============================================================================
// PHYSICS & INPUT
// ============================================================================

function processInput(): void {
  if (spectatorMode) {
    // Spectator fly-cam - use camera's actual direction vectors
    const speed = 0.5;
    
    // Get camera direction vectors
    const forward = new THREE.Vector3();
    const right = new THREE.Vector3();
    camera.getWorldDirection(forward);
    right.crossVectors(forward, camera.up).normalize();
    
    // Calculate movement
    const move = new THREE.Vector3(0, 0, 0);
    
    if (keys.has('KeyW')) move.add(forward);
    if (keys.has('KeyS')) move.sub(forward);
    if (keys.has('KeyA')) move.sub(right);
    if (keys.has('KeyD')) move.add(right);
    if (keys.has('Space')) move.y += 1;
    if (keys.has('ShiftLeft') || keys.has('ShiftRight')) move.y -= 1;

    if (move.length() > 0) {
      move.normalize().multiplyScalar(speed);
      camera.position.add(move);
    }
    return;
  }

  if (!myAgent) return;

  // Movement input
  let moveX = 0, moveZ = 0;
  
  if (keys.has('KeyW')) moveZ -= 1;
  if (keys.has('KeyS')) moveZ += 1;
  if (keys.has('KeyA')) moveX -= 1;
  if (keys.has('KeyD')) moveX += 1;

  if (moveX !== 0 || moveZ !== 0) {
    const sin = Math.sin(yaw);
    const cos = Math.cos(yaw);
    
    const len = Math.sqrt(moveX ** 2 + moveZ ** 2);
    moveX /= len;
    moveZ /= len;
    
    playerVelocity.x += (moveX * cos - moveZ * sin) * MOVE_SPEED;
    playerVelocity.z += (moveX * sin + moveZ * cos) * MOVE_SPEED;
  }

  // Jump
  if (keys.has('Space') && onGround) {
    playerVelocity.y = JUMP_FORCE;
    onGround = false;
  }

  // Apply gravity
  playerVelocity.y += GRAVITY;

  // Apply friction
  playerVelocity.x *= FRICTION;
  playerVelocity.z *= FRICTION;

  // Collision detection - check each axis separately for sliding
  const newX = playerPosition.x + playerVelocity.x;
  const newY = playerPosition.y + playerVelocity.y;
  const newZ = playerPosition.z + playerVelocity.z;

  // X-axis collision
  if (!checkCollision(newX, playerPosition.y, playerPosition.z)) {
    playerPosition.x = newX;
  } else {
    playerVelocity.x = 0;
  }

  // Z-axis collision
  if (!checkCollision(playerPosition.x, playerPosition.y, newZ)) {
    playerPosition.z = newZ;
  } else {
    playerVelocity.z = 0;
  }

  // Y-axis collision
  if (!checkCollision(playerPosition.x, newY, playerPosition.z)) {
    playerPosition.y = newY;
  } else {
    // Hit ceiling or floor
    if (playerVelocity.y < 0) {
      // Falling - snap to ground
      playerPosition.y = Math.floor(playerPosition.y) + 0.001;
    }
    playerVelocity.y = 0;
  }

  // Ground check
  onGround = checkGrounded(playerPosition.x, playerPosition.y, playerPosition.z);

  // Prevent falling through world (safety net)
  if (playerPosition.y < -64) {
    playerPosition.y = 65;
    playerVelocity.y = 0;
  }

  // Update camera
  camera.position.set(playerPosition.x, playerPosition.y + 1.6, playerPosition.z);

  // Sync position to server
  const now = performance.now();
  if (now - lastPositionSync > POSITION_SYNC_INTERVAL) {
    lastPositionSync = now;
    updatePosition(
      { x: playerPosition.x, y: playerPosition.y, z: playerPosition.z },
      { x: pitch, y: yaw, z: 0 }
    ).catch(console.error);
  }
}

function onResize(): void {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
}

function onMouseMove(event: MouseEvent): void {
  if (!mouseLocked) return;

  const sensitivity = 0.002;
  yaw -= event.movementX * sensitivity;
  pitch -= event.movementY * sensitivity;
  pitch = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, pitch));

  camera.rotation.order = 'YXZ';
  camera.rotation.y = yaw;
  camera.rotation.x = pitch;
}

// ============================================================================
// RENDERING
// ============================================================================

const blockColors: Record<number, number> = {
  [BlockTypes.STONE]: 0x808080,
  [BlockTypes.DIRT]: 0x8b4513,
  [BlockTypes.GRASS]: 0x228b22,
  [BlockTypes.WOOD]: 0x8b6914,
  [BlockTypes.LEAVES]: 0x006400,
  [BlockTypes.WATER]: 0x4169e1,
  [BlockTypes.SAND]: 0xf4a460,
  [BlockTypes.BEDROCK]: 0x1a1a1a,
  [BlockTypes.FLOWER_RED]: 0xff3333,
  [BlockTypes.FLOWER_YELLOW]: 0xffff00,
  [BlockTypes.TALL_GRASS]: 0x32cd32,
};

function createChunkMesh(chunk: Chunk): void {
  const key = `${chunk.coord.cx},${chunk.coord.cy},${chunk.coord.cz}`;
  
  // Remove old meshes
  const oldMesh = chunkMeshes.get(key);
  if (oldMesh) {
    scene.remove(oldMesh);
    oldMesh.geometry.dispose();
  }
  const oldWater = waterMeshes.get(key);
  if (oldWater) {
    scene.remove(oldWater);
    oldWater.geometry.dispose();
  }

  const geometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const colors: number[] = [];
  
  const waterGeometry = new THREE.BufferGeometry();
  const waterPositions: number[] = [];

  const worldX = chunk.coord.cx * CHUNK_SIZE;
  const worldY = chunk.coord.cy * CHUNK_SIZE;
  const worldZ = chunk.coord.cz * CHUNK_SIZE;

  for (let x = 0; x < CHUNK_SIZE; x++) {
    for (let y = 0; y < CHUNK_SIZE; y++) {
      for (let z = 0; z < CHUNK_SIZE; z++) {
        const index = x + y * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
        const blockId = chunk.blocks[index] as number;
        
        if (blockId === BlockTypes.AIR) continue;
        
        if (blockId === BlockTypes.WATER) {
          const aboveIndex = x + (y + 1) * CHUNK_SIZE + z * CHUNK_SIZE * CHUNK_SIZE;
          const aboveBlock = y + 1 < CHUNK_SIZE ? chunk.blocks[aboveIndex] : BlockTypes.AIR;
          if (aboveBlock === BlockTypes.AIR) {
            addWaterFace(waterPositions, worldX + x, worldY + y, worldZ + z);
          }
          continue;
        }

        const def = BlockDefinitions[blockId as keyof typeof BlockDefinitions];
        
        if (!def?.solid) {
          if (blockId === BlockTypes.FLOWER_RED || blockId === BlockTypes.FLOWER_YELLOW || blockId === BlockTypes.TALL_GRASS) {
            addDecorationBlock(positions, colors, worldX + x, worldY + y, worldZ + z, blockColors[blockId as keyof typeof blockColors] ?? 0xff00ff);
          }
          continue;
        }

        const neighbors: [number, number, number][] = [
          [1, 0, 0], [-1, 0, 0],
          [0, 1, 0], [0, -1, 0],
          [0, 0, 1], [0, 0, -1],
        ];

        for (const neighbor of neighbors) {
          const [dx, dy, dz] = neighbor;
          const nx = x + dx;
          const ny = y + dy;
          const nz = z + dz;

          let neighborSolid = false;
          if (nx >= 0 && nx < CHUNK_SIZE && ny >= 0 && ny < CHUNK_SIZE && nz >= 0 && nz < CHUNK_SIZE) {
            const nIndex = nx + ny * CHUNK_SIZE + nz * CHUNK_SIZE * CHUNK_SIZE;
            const nBlock = chunk.blocks[nIndex] as number;
            const nDef = BlockDefinitions[nBlock as keyof typeof BlockDefinitions];
            neighborSolid = nDef?.solid ?? false;
          }

          if (!neighborSolid) {
            addFace(positions, colors, worldX + x, worldY + y, worldZ + z, dx, dy, dz, blockColors[blockId as keyof typeof blockColors] ?? 0xff00ff);
          }
        }
      }
    }
  }

  if (positions.length > 0) {
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();

    const material = new THREE.MeshLambertMaterial({ vertexColors: true });
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);
    chunkMeshes.set(key, mesh);
  }

  if (waterPositions.length > 0) {
    waterGeometry.setAttribute('position', new THREE.Float32BufferAttribute(waterPositions, 3));
    waterGeometry.computeVertexNormals();

    const waterMaterial = new THREE.MeshLambertMaterial({
      color: 0x4488ff,
      transparent: true,
      opacity: 0.6,
      side: THREE.DoubleSide,
    });
    const waterMesh = new THREE.Mesh(waterGeometry, waterMaterial);
    scene.add(waterMesh);
    waterMeshes.set(key, waterMesh);
  }
}

function addWaterFace(positions: number[], x: number, y: number, z: number): void {
  const waterY = y + 0.9;
  positions.push(
    x, waterY, z,
    x, waterY, z + 1,
    x + 1, waterY, z + 1,
    x, waterY, z,
    x + 1, waterY, z + 1,
    x + 1, waterY, z,
  );
}

function addDecorationBlock(positions: number[], colors: number[], x: number, y: number, z: number, color: number): void {
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;
  
  const cx = x + 0.5;
  const cz = z + 0.5;
  const h = 0.8;
  
  positions.push(
    cx - 0.4, y, cz - 0.4,
    cx - 0.4, y + h, cz - 0.4,
    cx + 0.4, y + h, cz + 0.4,
    cx - 0.4, y, cz - 0.4,
    cx + 0.4, y + h, cz + 0.4,
    cx + 0.4, y, cz + 0.4,
  );
  
  positions.push(
    cx + 0.4, y, cz - 0.4,
    cx + 0.4, y + h, cz - 0.4,
    cx - 0.4, y + h, cz + 0.4,
    cx + 0.4, y, cz - 0.4,
    cx - 0.4, y + h, cz + 0.4,
    cx - 0.4, y, cz + 0.4,
  );
  
  for (let i = 0; i < 12; i++) {
    colors.push(r, g, b);
  }
}

function addFace(
  positions: number[],
  colors: number[],
  x: number, y: number, z: number,
  dx: number, dy: number, dz: number,
  color: number
): void {
  const r = ((color >> 16) & 255) / 255;
  const g = ((color >> 8) & 255) / 255;
  const b = (color & 255) / 255;

  let vertices: [number, number, number][];

  if (dx === 1) {
    vertices = [
      [x + 1, y, z], [x + 1, y + 1, z], [x + 1, y + 1, z + 1],
      [x + 1, y, z], [x + 1, y + 1, z + 1], [x + 1, y, z + 1],
    ];
  } else if (dx === -1) {
    vertices = [
      [x, y, z + 1], [x, y + 1, z + 1], [x, y + 1, z],
      [x, y, z + 1], [x, y + 1, z], [x, y, z],
    ];
  } else if (dy === 1) {
    vertices = [
      [x, y + 1, z], [x, y + 1, z + 1], [x + 1, y + 1, z + 1],
      [x, y + 1, z], [x + 1, y + 1, z + 1], [x + 1, y + 1, z],
    ];
  } else if (dy === -1) {
    vertices = [
      [x, y, z + 1], [x, y, z], [x + 1, y, z],
      [x, y, z + 1], [x + 1, y, z], [x + 1, y, z + 1],
    ];
  } else if (dz === 1) {
    vertices = [
      [x + 1, y, z + 1], [x + 1, y + 1, z + 1], [x, y + 1, z + 1],
      [x + 1, y, z + 1], [x, y + 1, z + 1], [x, y, z + 1],
    ];
  } else {
    vertices = [
      [x, y, z], [x, y + 1, z], [x + 1, y + 1, z],
      [x, y, z], [x + 1, y + 1, z], [x + 1, y, z],
    ];
  }

  for (const v of vertices) {
    positions.push(v[0], v[1], v[2]);
    colors.push(r, g, b);
  }
}

function createAgentMesh(agent: ConvexAgent): void {
  if (agentMeshes.has(agent._id)) return;
  if (myAgent && agent._id === myAgent._id) return; // Don't render self

  const geometry = new THREE.BoxGeometry(0.6, 1.8, 0.6);
  const material = new THREE.MeshLambertMaterial({ color: 0x4ecdc4 });
  const mesh = new THREE.Mesh(geometry, material);
  
  const pos = agent.position || { x: 0, y: 64, z: 0 };
  mesh.position.set(pos.x, pos.y + 0.9, pos.z);
  
  scene.add(mesh);
  agentMeshes.set(agent._id, mesh);
  
  const label = createNameLabel(agent.username);
  label.position.set(pos.x, pos.y + 2.5, pos.z);
  scene.add(label);
  agentLabels.set(agent._id, label);
}

function updateAgentMesh(agent: ConvexAgent): void {
  if (myAgent && agent._id === myAgent._id) return;
  
  const mesh = agentMeshes.get(agent._id);
  const label = agentLabels.get(agent._id);
  const pos = agent.position || { x: 0, y: 64, z: 0 };
  
  if (mesh) {
    mesh.position.set(pos.x, pos.y + 0.9, pos.z);
  }
  if (label) {
    label.position.set(pos.x, pos.y + 2.5, pos.z);
  }
}

function createNameLabel(name: string): THREE.Sprite {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d')!;
  canvas.width = 256;
  canvas.height = 64;
  
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.roundRect(0, 16, canvas.width, 40, 8);
  ctx.fill();
  
  ctx.font = 'bold 28px Arial';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#4ecdc4';
  ctx.fillText(name, canvas.width / 2, canvas.height / 2 + 4);
  
  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ 
    map: texture, 
    transparent: true,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set(2, 0.5, 1);
  
  return sprite;
}

function removeAgentMesh(agentId: string): void {
  const mesh = agentMeshes.get(agentId);
  if (mesh) {
    scene.remove(mesh);
    mesh.geometry.dispose();
    agentMeshes.delete(agentId);
  }
  
  const label = agentLabels.get(agentId);
  if (label) {
    scene.remove(label);
    label.material.dispose();
    agentLabels.delete(agentId);
  }
}

// ============================================================================
// UI
// ============================================================================

function updateAgentList(): void {
  const container = document.getElementById('agents')!;
  container.innerHTML = '';
  
  for (const agent of agents.values()) {
    const div = document.createElement('div');
    div.className = 'agent-item';
    div.textContent = agent.username + (myAgent && agent._id === myAgent._id ? ' (you)' : '');
    container.appendChild(div);
  }
}

function addChatMessage(name: string, message: string): void {
  const container = document.getElementById('chat-messages')!;
  addChatMessageDirect(name, message);
  container.scrollTop = container.scrollHeight;
}

function addChatMessageDirect(name: string, message: string): void {
  const container = document.getElementById('chat-messages')!;
  const div = document.createElement('div');
  div.className = 'chat-message';
  
  if (name === 'System') {
    div.innerHTML = `<span class="system">* ${message}</span>`;
  } else {
    const safeName = name.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const safeMsg = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
    div.innerHTML = `<span class="name">${safeName}:</span> ${safeMsg}`;
  }
  
  container.appendChild(div);

  while (container.children.length > 50) {
    container.removeChild(container.firstChild!);
  }
}

function updateHotbar(): void {
  const container = document.getElementById('hotbar');
  if (!container) return;
  
  container.innerHTML = '';
  const blockNames = ['Stone', 'Dirt', 'Grass', 'Wood', 'Leaves', 'Sand'];
  
  for (let i = 0; i < hotbarBlocks.length; i++) {
    const slot = document.createElement('div');
    slot.className = 'hotbar-slot' + (i === selectedBlockIndex ? ' selected' : '');
    slot.innerHTML = `<span class="key">${i + 1}</span><span class="name">${blockNames[i]}</span>`;
    slot.style.backgroundColor = '#' + (blockColors[hotbarBlocks[i] as keyof typeof blockColors] ?? 0xff00ff).toString(16).padStart(6, '0');
    container.appendChild(slot);
  }
}

// ============================================================================
// MAIN LOOP
// ============================================================================

function animate(): void {
  requestAnimationFrame(animate);

  frames++;
  const now = performance.now();
  if (now - lastTime >= 1000) {
    fps = frames;
    frames = 0;
    lastTime = now;
    document.getElementById('fps')!.textContent = fps.toString();
  }

  if (connected) {
    processInput();
    updateBlockHighlight();
    
    // Update coordinates display
    const coordsEl = document.getElementById('coords');
    if (coordsEl) {
      const x = Math.floor(playerPosition.x);
      const y = Math.floor(playerPosition.y);
      const z = Math.floor(playerPosition.z);
      coordsEl.textContent = `X: ${x} Y: ${y} Z: ${z}`;
    }
  }
  
  renderer.render(scene, camera);
}

/** Handle chat commands */
function handleCommand(input: string): void {
  const parts = input.slice(1).split(' ');
  const cmd = parts[0].toLowerCase();
  
  switch (cmd) {
    case 'tp':
    case 'teleport': {
      if (parts.length < 4) {
        addChatMessage('System', 'Usage: /tp x y z');
        return;
      }
      const x = parseFloat(parts[1]);
      const y = parseFloat(parts[2]);
      const z = parseFloat(parts[3]);
      
      if (isNaN(x) || isNaN(y) || isNaN(z)) {
        addChatMessage('System', 'Invalid coordinates');
        return;
      }
      
      if (spectatorMode) {
        camera.position.set(x, y, z);
        addChatMessage('System', `Teleported to ${x}, ${y}, ${z}`);
      } else {
        playerPosition.x = x;
        playerPosition.y = y;
        playerPosition.z = z;
        playerVelocity = { x: 0, y: 0, z: 0 };
        addChatMessage('System', `Teleported to ${x}, ${y}, ${z}`);
      }
      break;
    }
    
    case 'spawn': {
      const spawnX = 0, spawnY = 65, spawnZ = 0;
      if (spectatorMode) {
        camera.position.set(spawnX, spawnY, spawnZ);
      } else {
        playerPosition.x = spawnX;
        playerPosition.y = spawnY;
        playerPosition.z = spawnZ;
        playerVelocity = { x: 0, y: 0, z: 0 };
      }
      addChatMessage('System', 'Teleported to spawn');
      break;
    }
    
    case 'pos':
    case 'position': {
      const pos = spectatorMode ? camera.position : playerPosition;
      addChatMessage('System', `Position: ${Math.floor(pos.x)}, ${Math.floor(pos.y)}, ${Math.floor(pos.z)}`);
      break;
    }
    
    case 'help': {
      addChatMessage('System', 'Commands: /tp x y z, /spawn, /pos, /help');
      break;
    }
    
    default:
      addChatMessage('System', `Unknown command: /${cmd}. Type /help for help.`);
  }
}

/** Update the block highlight to show where player is looking */
function updateBlockHighlight(): void {
  if (!blockHighlight) return;
  
  if (spectatorMode) {
    blockHighlight.visible = false;
    // Update coords for spectator
    const coordsEl = document.getElementById('coords');
    if (coordsEl) {
      const x = Math.floor(camera.position.x);
      const y = Math.floor(camera.position.y);
      const z = Math.floor(camera.position.z);
      coordsEl.textContent = `X: ${x} Y: ${y} Z: ${z} (Spectating)`;
    }
    return;
  }
  
  // Raycast to find block player is looking at
  const hit = raycastBlock(false);
  
  if (hit) {
    blockHighlight.visible = true;
    blockHighlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    lastHighlightPos = hit;
  } else {
    blockHighlight.visible = false;
    lastHighlightPos = null;
  }
}

function cleanup(): void {
  disconnect();
  myAgent = null;
  spectatorMode = false;
  connected = false;
  
  // Cleanup chunk subscriptions
  for (const unsub of chunkUnsubscribes.values()) {
    unsub();
  }
  chunkUnsubscribes.clear();
  
  const modal = document.getElementById('connect-modal');
  if (modal) modal.style.display = 'block';
}

// Expose functions to window
let initialized = false;

(window as any).initGame = (autoConnect?: boolean) => {
  if (!initialized) {
    init();
    initialized = true;
  } else {
    const modal = document.getElementById('connect-modal');
    if (modal) modal.style.display = 'block';
  }
  
  // Auto-connect removed - browser clients are spectators only
};

(window as any).cleanupGame = cleanup;

// Check for auto-connect on load
function checkAutoConnect(): void {
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('autoconnect') === 'true') {
    // Clean up URL
    window.history.replaceState({}, '', '/');
    
    // Show game UI
    const landing = document.getElementById('landing');
    const app = document.getElementById('app');
    const backBtn = document.getElementById('back-btn');
    
    if (landing) landing.classList.add('hidden');
    if (app) app.classList.add('active');
    if (backBtn) backBtn.style.display = 'block';
    
    // Init and auto-connect
    (window as any).initGame(true);
  }
}

// Auto-init
if (!document.getElementById('landing') || document.getElementById('landing')?.classList.contains('hidden')) {
  init();
  initialized = true;
}

// Check for auto-connect after DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', checkAutoConnect);
} else {
  checkAutoConnect();
}
