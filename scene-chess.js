import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader";

const SQUARE_SIZE = 1;
const BOARD_SIZE = 8;

const pieceModelTemplates = new Map();
let modelsInitialized = false;
let modelsInitPromise = null;

export function initPieceModels() {
  if (modelsInitPromise) return modelsInitPromise;
  modelsInitPromise = new Promise((resolve) => {
    const loader = new GLTFLoader();
    // Example ready‑made chess set model; individual meshes are extracted below.
    loader.load(
      "https://assets.babylonjs.com/meshes/chess.glb",
      (gltf) => {
        const root = gltf.scene || gltf.scenes[0];
        if (!root) {
          modelsInitialized = true;
          resolve();
          return;
        }
        root.traverse((child) => {
          if (!child.isMesh) return;
          const name = (child.name || "").toLowerCase();
          let type = null;
          if (name.includes("pawn")) type = "p";
          else if (name.includes("rook")) type = "r";
          else if (name.includes("knight")) type = "n";
          else if (name.includes("bishop")) type = "b";
          else if (name.includes("queen")) type = "q";
          else if (name.includes("king")) type = "k";
          if (!type) return;

          const keyWhite = `${type}_w`;
          const keyBlack = `${type}_b`;

          const templateWhite = child.clone(true);
          const templateBlack = child.clone(true);

          templateWhite.traverse((n) => {
            if (n.isMesh) {
              if (Array.isArray(n.material)) {
                n.material = n.material.map((m) => {
                  const mat = m.clone();
                  mat.polygonOffset = true;
                  mat.polygonOffsetFactor = 1;
                  mat.polygonOffsetUnits = 1;
                  mat.depthTest = true;
                  mat.depthWrite = true;
                  mat.flatShading = false;
                  return mat;
                });
              } else if (n.material) {
                const mat = n.material.clone();
                mat.polygonOffset = true;
                mat.polygonOffsetFactor = 1;
                mat.polygonOffsetUnits = 1;
                mat.depthTest = true;
                mat.depthWrite = true;
                mat.flatShading = false;
                n.material = mat;
              }
              n.castShadow = true;
              n.receiveShadow = true;
            }
          });
          templateBlack.traverse((n) => {
            if (n.isMesh) {
              if (Array.isArray(n.material)) {
                n.material = n.material.map((m) => {
                  const mat = m.clone();
                  mat.polygonOffset = true;
                  mat.polygonOffsetFactor = 1;
                  mat.polygonOffsetUnits = 1;
                  mat.depthTest = true;
                  mat.depthWrite = true;
                  mat.flatShading = false;
                  return mat;
                });
              } else if (n.material) {
                const mat = n.material.clone();
                mat.polygonOffset = true;
                mat.polygonOffsetFactor = 1;
                mat.polygonOffsetUnits = 1;
                mat.depthTest = true;
                mat.depthWrite = true;
                mat.flatShading = false;
                n.material = mat;
              }
              n.castShadow = true;
              n.receiveShadow = true;
            }
          });

          const box = new THREE.Box3().setFromObject(templateWhite);
          const size = new THREE.Vector3();
          const center = new THREE.Vector3();
          box.getSize(size);
          box.getCenter(center);
          const desiredHeight = 0.9;
          const scaleFactor = desiredHeight / (size.y || 1);
          templateWhite.position.sub(center);
          templateBlack.position.sub(center);
          templateWhite.scale.setScalar(scaleFactor);
          templateBlack.scale.setScalar(scaleFactor);
          templateWhite.position.y -= box.min.y * scaleFactor;
          templateBlack.position.y -= box.min.y * scaleFactor;

          pieceModelTemplates.set(keyWhite, templateWhite);
          pieceModelTemplates.set(keyBlack, templateBlack);
        });

        modelsInitialized = true;
        resolve();
      },
      undefined,
      () => {
        modelsInitialized = true;
        resolve();
      }
    );
  });
  return modelsInitPromise;
}

function algebraicToIndex(square) {
  const file = square.charCodeAt(0) - "a".charCodeAt(0);
  const rank = parseInt(square[1], 10);
  const row = 8 - rank;
  return row * 8 + file;
}

function squareIndexToPosition(index) {
  const file = index % 8;
  const rank = Math.floor(index / 8);
  const x = (file - 3.5) * SQUARE_SIZE;
  const z = (rank - 3.5) * SQUARE_SIZE;
  return new THREE.Vector3(x, 0, z);
}

function createSquareMesh(isLight) {
  const geo = new THREE.BoxGeometry(SQUARE_SIZE, 0.1, SQUARE_SIZE);
  const mat = new THREE.MeshStandardMaterial({
    color: isLight ? 0xdad1c8 : 0x5b4334,
    roughness: 0.8,
    metalness: 0.05
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function createBoardFrame() {
  const geo = new THREE.BoxGeometry(BOARD_SIZE * SQUARE_SIZE + 0.4, 0.3, BOARD_SIZE * SQUARE_SIZE + 0.4);
  const mat = new THREE.MeshStandardMaterial({
    color: 0x2c1b12,
    roughness: 0.8,
    metalness: 0.05
  });
  const frame = new THREE.Mesh(geo, mat);
  frame.position.y = -0.1;
  frame.receiveShadow = true;
  frame.castShadow = true;
  return frame;
}

export function createPieceGeometry(type, color) {
  const key = `${type}_${color}`;
  if (modelsInitialized && pieceModelTemplates.has(key)) {
    const template = pieceModelTemplates.get(key);
    const mesh = template.clone(true);
    mesh.traverse((n) => {
      if (n.isMesh) {
        n.material = n.material.clone();
        n.castShadow = true;
        n.receiveShadow = true;
      }
    });
    mesh.userData.chessColor = color;
    mesh.userData.pieceType = type;
    return mesh;
  }

  const material = new THREE.MeshStandardMaterial({
    color: color === "w" ? 0xf5f5f5 : 0x222222,
    roughness: 0.4,
    metalness: 0.2,
    polygonOffset: true,
    polygonOffsetFactor: 1,
    polygonOffsetUnits: 1
  });

  let mesh;
  switch (type) {
    case "p": {
      const geo = new THREE.CylinderGeometry(0.24, 0.3, 0.6, 16);
      mesh = new THREE.Mesh(geo, material);
      break;
    }
    case "r": {
      const geo = new THREE.CylinderGeometry(0.35, 0.35, 0.7, 24);
      mesh = new THREE.Mesh(geo, material);
      break;
    }
    case "n": {
      const geo = new THREE.CylinderGeometry(0.18, 0.35, 0.8, 16);
      mesh = new THREE.Mesh(geo, material);
      const head = new THREE.SphereGeometry(0.22, 16, 12);
      const headMesh = new THREE.Mesh(head, material);
      headMesh.position.y = 0.4;
      mesh.add(headMesh);
      break;
    }
    case "b": {
      const geo = new THREE.ConeGeometry(0.28, 0.9, 24);
      mesh = new THREE.Mesh(geo, material);
      break;
    }
    case "q": {
      const geo = new THREE.CylinderGeometry(0.34, 0.3, 0.9, 24);
      mesh = new THREE.Mesh(geo, material);
      const crown = new THREE.SphereGeometry(0.24, 16, 12);
      const crownMesh = new THREE.Mesh(crown, material);
      crownMesh.position.y = 0.45;
      mesh.add(crownMesh);
      break;
    }
    case "k": {
      const geo = new THREE.CylinderGeometry(0.34, 0.32, 0.9, 24);
      mesh = new THREE.Mesh(geo, material);
      const top = new THREE.BoxGeometry(0.4, 0.16, 0.16);
      const topMesh = new THREE.Mesh(top, material);
      topMesh.position.y = 0.5;
      mesh.add(topMesh);
      break;
    }
    default: {
      const geo = new THREE.CylinderGeometry(0.24, 0.3, 0.6, 16);
      mesh = new THREE.Mesh(geo, material);
    }
  }

  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.position.y = 0.35;
  mesh.userData.chessColor = color;
  mesh.userData.pieceType = type;
  return mesh;
}

function createLabelMesh(text) {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "rgba(0,0,0,0)";
  ctx.fillRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 72px system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, size / 2, size / 2);

  const texture = new THREE.CanvasTexture(canvas);
  texture.anisotropy = 4;
  texture.needsUpdate = true;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthWrite: false
  });

  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.35),
    material
  );
  plane.renderOrder = 2;
  return plane;
}

function createBoardLabels() {
  const group = new THREE.Group();
  const half = (BOARD_SIZE * SQUARE_SIZE) / 2;

  // Files (A-H) along the Z- edges
  for (let f = 0; f < BOARD_SIZE; f++) {
    const fileChar = String.fromCharCode("A".charCodeAt(0) + f);
    const x = (f - 3.5) * SQUARE_SIZE;

    const near = createLabelMesh(fileChar);
    near.position.set(x, 0.02, -half - 0.3);
    near.rotation.x = -Math.PI / 2;
    group.add(near);

    const far = createLabelMesh(fileChar);
    far.position.set(x, 0.02, half + 0.3);
    far.rotation.x = -Math.PI / 2;
    group.add(far);
  }

  // Ranks (1-8) along the X- edges
  for (let r = 0; r < BOARD_SIZE; r++) {
    const rankChar = (BOARD_SIZE - r).toString();
    const z = (r - 3.5) * SQUARE_SIZE;

    const left = createLabelMesh(rankChar);
    left.position.set(-half - 0.3, 0.02, z);
    left.rotation.x = -Math.PI / 2;
    group.add(left);

    const right = createLabelMesh(rankChar);
    right.position.set(half + 0.3, 0.02, z);
    right.rotation.x = -Math.PI / 2;
    group.add(right);
  }

  // Example combined coordinates on one side (like G4, G5 etc.)
  for (let r = 3; r <= 4; r++) {
    const fileIndex = 6; // G file (0-based)
    const fileChar = String.fromCharCode("A".charCodeAt(0) + fileIndex);
    const rankChar = (BOARD_SIZE - r).toString();
    const coord = `${fileChar}${rankChar}`;
    const x = (fileIndex - 3.5) * SQUARE_SIZE;
    const z = (r - 3.5) * SQUARE_SIZE;

    const coordLabel = createLabelMesh(coord);
    coordLabel.position.set(x + 0.32, 0.02, z + 0.32);
    coordLabel.rotation.x = -Math.PI / 2;
    group.add(coordLabel);
  }

  return group;
}

export function createBoardAndPieces(chess) {
  const boardGroup = new THREE.Group();

  const frame = createBoardFrame();
  boardGroup.add(frame);

  const squareHelpers = [];
  for (let r = 0; r < BOARD_SIZE; r++) {
    for (let f = 0; f < BOARD_SIZE; f++) {
      const index = r * 8 + f;
      const isLight = (r + f) % 2 === 0;
      const mesh = createSquareMesh(isLight);
      const pos = squareIndexToPosition(index);
      // Slightly raise squares above the frame to avoid z-fighting
      mesh.position.set(pos.x, pos.y + 0.01, pos.z);
      boardGroup.add(mesh);

      squareHelpers.push({
        mesh,
        baseColor: mesh.material.color.clone(),
        highlightType: null
      });
    }
  }

  const labelGroup = createBoardLabels();

  const pieceMeshes = new Map();
  const board = chess.board();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (piece) {
        const square =
          String.fromCharCode("a".charCodeAt(0) + file) + (8 - rank).toString();
        const mesh = createPieceGeometry(piece.type, piece.color);
        const index = algebraicToIndex(square);
        const pos = squareIndexToPosition(index);
        mesh.position.set(pos.x, mesh.position.y || 0.35, pos.z);
        boardGroup.add(mesh);
        pieceMeshes.set(square, mesh);
      }
    }
  }

  return { boardGroup, pieceMeshes, squareHelpers, labelGroup };
}

export function updatePiecePositions(chess, pieceMeshes, boardGroup) {
  const existingSquares = new Set(pieceMeshes.keys());
  const stillPresent = new Set();

  const board = chess.board();
  const desiredPositions = new Map();
  for (let rank = 0; rank < 8; rank++) {
    for (let file = 0; file < 8; file++) {
      const piece = board[rank][file];
      if (!piece) continue;
      const square =
        String.fromCharCode("a".charCodeAt(0) + file) + (8 - rank).toString();
      desiredPositions.set(square, piece);
      stillPresent.add(square);
    }
  }

  for (const square of existingSquares) {
    if (!desiredPositions.has(square)) {
      const mesh = pieceMeshes.get(square);
      if (mesh && mesh.parent) mesh.parent.remove(mesh);
      pieceMeshes.delete(square);
    }
  }

  for (const [square, piece] of desiredPositions.entries()) {
    let mesh = pieceMeshes.get(square);
    const index = algebraicToIndex(square);
    const pos = squareIndexToPosition(index);

    // If there is an existing mesh but it represents a different piece
    // (e.g. captured piece), remove it so we can create the correct one.
    if (
      mesh &&
      (mesh.userData.chessColor !== piece.color ||
        mesh.userData.pieceType !== piece.type)
    ) {
      if (mesh.parent) {
        mesh.parent.remove(mesh);
      }
      pieceMeshes.delete(square);
      mesh = null;
    }

    if (!mesh) {
      mesh = createPieceGeometry(piece.type, piece.color);
      mesh.position.set(pos.x, mesh.position.y || 0.35, pos.z);
      if (boardGroup) {
        boardGroup.add(mesh);
      }
      pieceMeshes.set(square, mesh);
    } else {
      mesh.position.set(pos.x, mesh.position.y || 0.35, pos.z);
    }
  }
}

export function clearHighlights(squareHelpers) {
  for (const helper of squareHelpers) {
    helper.mesh.material.color.copy(helper.baseColor);
    helper.highlightType = null;
  }
}

export function applyBoardTheme(theme, boardGroup, squareHelpers) {
  if (!theme) return;
  // Update frame color (first child is frame in current construction)
  if (boardGroup && boardGroup.children.length > 0) {
    const frame = boardGroup.children[0];
    if (frame && frame.material && theme.frameColor !== undefined) {
      frame.material.color.setHex(theme.frameColor);
    }
  }
  // Update square colors and base colors for highlights
  for (let i = 0; i < squareHelpers.length; i++) {
    const helper = squareHelpers[i];
    const r = Math.floor(i / 8);
    const f = i % 8;
    const isLight = (r + f) % 2 === 0;
    const colorHex = isLight ? theme.boardLightColor : theme.boardDarkColor;
    if (colorHex !== undefined) {
      helper.mesh.material.color.setHex(colorHex);
      helper.baseColor.setHex(colorHex);
    }
  }
}

export function highlightSquares(info, squareHelpers) {
  clearHighlights(squareHelpers);
  const { selected, moves, captureSquares } = info;

  const selectedSet = new Set(selected ? [selected] : []);
  const moveSet = new Set(moves || []);
  const captureSet = new Set(captureSquares || []);

  for (let i = 0; i < squareHelpers.length; i++) {
    const file = i % 8;
    const rank = Math.floor(i / 8);
    const square =
      String.fromCharCode("a".charCodeAt(0) + file) + (8 - rank).toString();

    const helper = squareHelpers[i];

    if (selectedSet.has(square)) {
      helper.mesh.material.color.setHex(0x88aa44);
      helper.highlightType = "selected";
    } else if (captureSet.has(square)) {
      helper.mesh.material.color.setHex(0xaa4444);
      helper.highlightType = "capture";
    } else if (moveSet.has(square)) {
      helper.mesh.material.color.setHex(0x6699cc);
      helper.highlightType = "move";
    } else {
      helper.mesh.material.color.copy(helper.baseColor);
      helper.highlightType = null;
    }
  }
}