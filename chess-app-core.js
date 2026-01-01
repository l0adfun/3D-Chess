import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";
import { Chess } from "chess.js";
import nipplejs from "nipplejs";
import {
  initPieceModels,
  createBoardAndPieces,
  updatePiecePositions,
  highlightSquares,
  clearHighlights,
  applyBoardTheme,
  createPieceGeometry
} from "./scene-chess.js";
import THEMES from "./themes.js";

export async function initChessApp() {
  const appEl = document.getElementById("app");
  const turnIndicator = document.getElementById("turnIndicator");
  const turnLabel = document.getElementById("turnLabel");
  const statusToast = document.getElementById("statusToast");
  const joystickContainer = document.getElementById("joystick");
  const themeSelect = document.getElementById("themeSelect");
  const newGameBtn = document.getElementById("newGameBtn");
  const flipBoardBtn = document.getElementById("flipBoardBtn");
  const squareTooltip = document.getElementById("squareTooltip");
  const moveHistoryEl = document.getElementById("moveHistory");
  const moveHistoryListEl = document.getElementById("moveHistoryList");
  const toggleHistoryBtn = document.getElementById("toggleHistoryBtn");
  const newGameModalEl = document.getElementById("newGameModal");
  const confirmNewGameBtn = document.getElementById("confirmNewGameBtn");
  const cancelNewGameBtn = document.getElementById("cancelNewGameBtn");
  const saveGameBtn = document.getElementById("saveGameBtn");
  const loadGameBtn = document.getElementById("loadGameBtn");
  const loadGameFileInput = document.getElementById("loadGameFileInput");

  const chess = new Chess();
  let currentThemeKey = "classic";

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(appEl.clientWidth, appEl.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  appEl.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(THEMES[currentThemeKey].backgroundColor);

  const camera = new THREE.PerspectiveCamera(
    45,
    appEl.clientWidth / appEl.clientHeight,
    0.1,
    100
  );
  const defaultCameraPosition = new THREE.Vector3(6, 8, 10);
  const defaultCameraTarget = new THREE.Vector3(0, 0, 0);

  const resetCameraPosition = () => {
    camera.position.copy(defaultCameraPosition);
    controls.target.copy(defaultCameraTarget);
    camera.lookAt(defaultCameraTarget);
    isBoardFlipped = false;
  };

  camera.position.copy(defaultCameraPosition);
  camera.lookAt(defaultCameraTarget);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 6;
  controls.maxDistance = 18;
  controls.maxPolarAngle = Math.PI * 0.49;
  controls.target.set(0, 0, 0);

  const hemiLight = new THREE.HemisphereLight(0xffffff, 0x111111, 0.6);
  scene.add(hemiLight);

  const dirLight = new THREE.DirectionalLight(0xffffff, 0.8);
  dirLight.position.set(8, 10, 5);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.set(2048, 2048);
  dirLight.shadow.camera.near = 2;
  dirLight.shadow.camera.far = 30;
  scene.add(dirLight);

  const groundGeo = new THREE.PlaneGeometry(60, 60);
  const groundMat = new THREE.MeshStandardMaterial({
    color: THEMES[currentThemeKey].groundColor,
    roughness: 0.9,
    metalness: 0.0
  });
  const ground = new THREE.Mesh(groundGeo, groundMat);
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.001;
  ground.receiveShadow = true;
  scene.add(ground);

  await initPieceModels();
  const { boardGroup, pieceMeshes, squareHelpers, labelGroup } = createBoardAndPieces(chess);
  scene.add(boardGroup);
  if (labelGroup) {
    scene.add(labelGroup);
  }

  // Side groups for captured pieces ("refreshed tiles")
  const whiteCapturedGroup = new THREE.Group();
  const blackCapturedGroup = new THREE.Group();
  whiteCapturedGroup.position.set(-6, 0, 0);
  blackCapturedGroup.position.set(6, 0, 0);
  scene.add(whiteCapturedGroup);
  scene.add(blackCapturedGroup);

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let selectedSquare = null;
  let legalMovesFromSelected = [];
  let isBoardFlipped = false;

  function algebraicFromSquareIndex(index) {
    const file = String.fromCharCode("a".charCodeAt(0) + (index % 8));
    const rank = (8 - Math.floor(index / 8)).toString();
    return file + rank;
  }

  function pieceTypeToName(type) {
    switch (type) {
      case "p": return "Pawn";
      case "r": return "Rook";
      case "n": return "Knight";
      case "b": return "Bishop";
      case "q": return "Queen";
      case "k": return "King";
      default: return "Piece";
    }
  }

  function showStatus(message, duration = 1500) {
    if (!statusToast) return;
    statusToast.textContent = message;
    statusToast.classList.add("visible");
    clearTimeout(showStatus._timer);
    showStatus._timer = setTimeout(() => {
      statusToast.classList.remove("visible");
    }, duration);
  }

  function updateTurnUI() {
    const turn = chess.turn();
    turnIndicator.classList.toggle("white", turn === "w");
    turnIndicator.classList.toggle("black", turn === "b");
    turnLabel.textContent = turn === "w" ? "White to move" : "Black to move";
  }

  function updateMoveHistory() {
    if (!moveHistoryListEl) return;
    const verboseHistory = chess.history({ verbose: true });
    moveHistoryListEl.innerHTML = "";
    for (let i = 0; i < verboseHistory.length; i += 2) {
      const moveNumber = i / 2 + 1;
      const whiteMove = verboseHistory[i] ? verboseHistory[i].san : "";
      const blackMove = verboseHistory[i + 1] ? verboseHistory[i + 1].san : "";
      const row = document.createElement("div");
      row.className = "move-history-row";
      const spanIndex = document.createElement("span");
      spanIndex.className = "move-index";
      spanIndex.textContent = moveNumber + ".";
      const spanWhite = document.createElement("span");
      spanWhite.className = "move-white";
      spanWhite.textContent = whiteMove;
      const spanBlack = document.createElement("span");
      spanBlack.className = "move-black";
      spanBlack.textContent = blackMove;
      row.appendChild(spanIndex);
      row.appendChild(spanWhite);
      row.appendChild(spanBlack);
      moveHistoryListEl.appendChild(row);
    }
    moveHistoryListEl.scrollTop = moveHistoryListEl.scrollHeight;
  }

  function updateCapturedPieces() {
    while (whiteCapturedGroup.children.length) {
      whiteCapturedGroup.remove(whiteCapturedGroup.children[0]);
    }
    while (blackCapturedGroup.children.length) {
      blackCapturedGroup.remove(blackCapturedGroup.children[0]);
    }

    const history = chess.history({ verbose: true });
    const capturedWhite = []; // pieces captured from white
    const capturedBlack = []; // pieces captured from black

    for (const move of history) {
      if (move.captured) {
        if (move.color === "w") {
          capturedBlack.push(move.captured);
        } else {
          capturedWhite.push(move.captured);
        }
      }
    }

    const spacing = 0.6;
    capturedWhite.forEach((type, idx) => {
      const mesh = createPieceGeometry(type, "w");
      mesh.position.set(0, 0.35, (idx - (capturedWhite.length - 1) / 2) * spacing);
      whiteCapturedGroup.add(mesh);
    });

    capturedBlack.forEach((type, idx) => {
      const mesh = createPieceGeometry(type, "b");
      mesh.position.set(0, 0.35, (idx - (capturedBlack.length - 1) / 2) * spacing);
      blackCapturedGroup.add(mesh);
    });
  }

  function applyTheme(key) {
    const theme = THEMES[key] || THEMES.classic;
    currentThemeKey = key;
    scene.background.setHex(theme.backgroundColor);
    groundMat.color.setHex(theme.groundColor);
    applyBoardTheme(theme, boardGroup, squareHelpers);

    // Update board pieces based on current chess position
    pieceMeshes.forEach((mesh, square) => {
      const piece = chess.get(square);
      if (!piece) return;
      const colorHex = piece.color === "w" ? theme.whitePieceColor : theme.blackPieceColor;
      mesh.traverse((n) => {
        if (!n.isMesh || !n.material) return;
        if (Array.isArray(n.material)) {
          n.material.forEach((m) => {
            if (m && m.color) m.color.setHex(colorHex);
          });
        } else if (n.material.color) {
          n.material.color.setHex(colorHex);
        }
      });
    });

    // Update captured pieces color using their stored color
    const updateCapturedGroupColors = (group) => {
      group.children.forEach((mesh) => {
        const color = mesh.userData.chessColor || "w";
        const colorHex = color === "w" ? theme.whitePieceColor : theme.blackPieceColor;
        mesh.traverse((n) => {
          if (!n.isMesh || !n.material) return;
          if (Array.isArray(n.material)) {
            n.material.forEach((m) => {
              if (m && m.color) m.color.setHex(colorHex);
            });
          } else if (n.material.color) {
            n.material.color.setHex(colorHex);
          }
        });
      });
    };
    updateCapturedGroupColors(whiteCapturedGroup);
    updateCapturedGroupColors(blackCapturedGroup);
  }

  function serializeGameState() {
    const verboseHistory = chess.history({ verbose: true });
    const lastMove = verboseHistory.length ? verboseHistory[verboseHistory.length - 1] : null;
    return {
      type: "3d-chess-save",
      version: 2,
      timestamp: Date.now(),
      fen: chess.fen(),
      history: verboseHistory,
      turn: chess.turn(),
      lastMove,
      theme: currentThemeKey,
      camera: {
        position: {
          x: camera.position.x,
          y: camera.position.y,
          z: camera.position.z
        },
        target: {
          x: controls.target.x,
          y: controls.target.y,
          z: controls.target.z
        },
        isBoardFlipped
      }
    };
  }

  function downloadJson(filename, data) {
    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function restoreGameFromData(data) {
    if (!data || data.type !== "3d-chess-save") {
      throw new Error("Invalid save file");
    }
    if (!data.fen || typeof data.fen !== "string") {
      throw new Error("Save file missing FEN");
    }

    chess.reset();

    if (Array.isArray(data.history) && data.history.length > 0) {
      // Rebuild the game by replaying moves so history & captures are correct
      for (const move of data.history) {
        if (!move.from || !move.to) continue;
        chess.move({
          from: move.from,
          to: move.to,
          promotion: move.promotion || "q"
        });
      }
      // Optional: validate final position matches stored FEN, but don't fail hard if it doesn't
      try {
        const fenNow = chess.fen();
        if (fenNow.split(" ").slice(0, 4).join(" ") !== data.fen.split(" ").slice(0, 4).join(" ")) {
          console.warn("Loaded history does not match FEN exactly; using history result.");
        }
      } catch (e) {
        console.warn("Could not verify FEN after history replay", e);
      }
    } else {
      const loaded = chess.load(data.fen);
      if (!loaded) {
        throw new Error("Failed to load FEN from save");
      }
    }

    if (data.theme && THEMES[data.theme]) {
      currentThemeKey = data.theme;
    }

    updatePiecePositions(chess, pieceMeshes, boardGroup);
    clearHighlights(squareHelpers);
    selectedSquare = null;
    legalMovesFromSelected = [];
    updateCapturedPieces();
    applyTheme(currentThemeKey);
    updateMoveHistory();
    updateTurnUI();

    // Restore camera & board flip state if present (backwards-compatible with old saves)
    if (data.camera && data.camera.position && data.camera.target) {
      const cp = data.camera.position;
      const ct = data.camera.target;
      camera.position.set(cp.x, cp.y, cp.z);
      controls.target.set(ct.x, ct.y, ct.z);
      camera.lookAt(controls.target);

      if (typeof data.camera.isBoardFlipped === "boolean") {
        isBoardFlipped = data.camera.isBoardFlipped;
      }
    }
  }

  function handleSquareTap(squareIndex) {
    const algebraic = algebraicFromSquareIndex(squareIndex);
    const piece = chess.get(algebraic);

    if (selectedSquare === null) {
      if (!piece) {
        showStatus("Empty square");
        return;
      }
      const turn = chess.turn();
      if ((turn === "w" && piece.color !== "w") || (turn === "b" && piece.color !== "b")) {
        showStatus(turn === "w" ? "White's move" : "Black's move");
        return;
      }
      selectedSquare = algebraic;
      legalMovesFromSelected = chess.moves({ square: algebraic, verbose: true });
      highlightSquares({
        selected: algebraic,
        moves: legalMovesFromSelected.map(m => m.to),
        captureSquares: legalMovesFromSelected.filter(m => m.flags.includes("c") || m.flags.includes("e")).map(m => m.to)
      }, squareHelpers);
    } else {
      if (algebraic === selectedSquare) {
        selectedSquare = null;
        legalMovesFromSelected = [];
        clearHighlights(squareHelpers);
        return;
      }

      const move = chess.moves({ square: selectedSquare, verbose: true }).find(m => m.to === algebraic);
      if (!move) {
        const maybePiece = chess.get(algebraic);
        if (maybePiece && maybePiece.color === chess.turn()) {
          selectedSquare = algebraic;
          legalMovesFromSelected = chess.moves({ square: algebraic, verbose: true });
          highlightSquares({
            selected: algebraic,
            moves: legalMovesFromSelected.map(m => m.to),
            captureSquares: legalMovesFromSelected.filter(m => m.flags.includes("c") || m.flags.includes("e")).map(m => m.to)
          }, squareHelpers);
        } else {
          showStatus("Illegal move");
        }
        return;
      }

      chess.move({ from: move.from, to: move.to, promotion: move.promotion || "q" });
      updatePiecePositions(chess, pieceMeshes, boardGroup);
      updateCapturedPieces();
      updateMoveHistory();
      selectedSquare = null;
      legalMovesFromSelected = [];
      clearHighlights(squareHelpers);
      updateTurnUI();

      if (chess.isGameOver()) {
        if (chess.isCheckmate()) {
          showStatus(`Checkmate – ${chess.turn() === "w" ? "Black" : "White"} wins`, 3000);
        } else if (chess.isDraw()) {
          showStatus("Draw", 3000);
        } else {
          showStatus("Game over", 3000);
        }
      } else if (chess.inCheck()) {
        showStatus("Check");
      }
    }
  }

  function updateSquareTooltipFromPointer(x, y) {
    if (!squareTooltip) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);

    const squareMeshes = squareHelpers.map(h => h.mesh);
    const intersects = raycaster.intersectObjects(squareMeshes, false);
    if (intersects.length === 0) {
      squareTooltip.classList.remove("visible");
      return;
    }

    const mesh = intersects[0].object;
    const index = squareHelpers.findIndex(h => h.mesh === mesh);
    if (index === -1) {
      squareTooltip.classList.remove("visible");
      return;
    }
    const square = algebraicFromSquareIndex(index);
    const piece = chess.get(square);
    let text;
    if (piece) {
      const side = piece.color === "w" ? "White" : "Black";
      text = `${side} ${pieceTypeToName(piece.type)} – ${square}`;
    } else {
      text = `Empty – ${square}`;
    }
    squareTooltip.textContent = text;
    squareTooltip.classList.add("visible");
  }

  function onPointerDown(event) {
    const rect = renderer.domElement.getBoundingClientRect();
    const x = event.touches ? event.touches[0].clientX : event.clientX;
    const y = event.touches ? event.touches[0].clientY : event.clientY;

    pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((y - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);

    const squareMeshes = squareHelpers.map(h => h.mesh);
    const intersects = raycaster.intersectObjects(squareMeshes, false);
    if (intersects.length > 0) {
      const mesh = intersects[0].object;
      const index = squareHelpers.findIndex(h => h.mesh === mesh);
      if (index !== -1) {
        handleSquareTap(index);
      }
    }
  }

  function onPointerMove(event) {
    const x = event.touches ? event.touches[0].clientX : event.clientX;
    const y = event.touches ? event.touches[0].clientY : event.clientY;
    updateSquareTooltipFromPointer(x, y);
  }

  renderer.domElement.addEventListener("pointerdown", onPointerDown, { passive: true });
  renderer.domElement.addEventListener("pointermove", onPointerMove, { passive: true });

  let keys = { w: false, a: false, s: false, d: false };
  let joystickManager = null;
  let joystickVec = { x: 0, y: 0 };

  function setupKeyboardControls() {
    window.addEventListener("keydown", (e) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        keys[key] = true;
      }
    });
    window.addEventListener("keyup", (e) => {
      const key = e.key.toLowerCase();
      if (["w", "a", "s", "d"].includes(key)) {
        keys[key] = false;
      }
    });
  }

  function setupJoystick() {
    if (!("ontouchstart" in window)) return;
    joystickContainer.style.display = "block";
    joystickManager = nipplejs.create({
      zone: joystickContainer,
      mode: "dynamic",
      color: "white",
      size: 90,
      restJoystick: true
    });

    joystickManager.on("move", (evt, data) => {
      if (!data.vector) return;
      joystickVec.x = data.vector.x;
      joystickVec.y = data.vector.y;
    });

    joystickManager.on("end", () => {
      joystickVec.x = 0;
      joystickVec.y = 0;
    });
  }

  setupKeyboardControls();
  setupJoystick();
  updatePiecePositions(chess, pieceMeshes, boardGroup);
  updateCapturedPieces();
  applyTheme(currentThemeKey);
  updateTurnUI();
  updateMoveHistory();
  if (moveHistoryEl) {
    moveHistoryEl.classList.add("hidden");
  }

  if (themeSelect) {
    themeSelect.value = currentThemeKey;
    themeSelect.addEventListener("change", (e) => {
      applyTheme(e.target.value);
    });
  }

  if (newGameBtn) {
    newGameBtn.addEventListener("click", () => {
      if (newGameModalEl) {
        newGameModalEl.classList.add("visible");
      } else {
        // Fallback if modal is not available
        if (window.confirm("Start a new game? This will reset the board and move history.")) {
          chess.reset();
          updatePiecePositions(chess, pieceMeshes, boardGroup);
          clearHighlights(squareHelpers);
          selectedSquare = null;
          legalMovesFromSelected = [];
          updateCapturedPieces();
          updateTurnUI();
          applyTheme(currentThemeKey);
          updateMoveHistory();
          resetCameraPosition();
          showStatus("New game");
        }
      }
    });
  }

  if (toggleHistoryBtn && moveHistoryEl) {
    toggleHistoryBtn.addEventListener("click", () => {
      moveHistoryEl.classList.toggle("hidden");
    });
  }

  if (newGameModalEl && confirmNewGameBtn && cancelNewGameBtn) {
    const closeNewGameModal = () => newGameModalEl.classList.remove("visible");

    cancelNewGameBtn.addEventListener("click", () => {
      closeNewGameModal();
    });

    confirmNewGameBtn.addEventListener("click", () => {
      chess.reset();
      updatePiecePositions(chess, pieceMeshes, boardGroup);
      clearHighlights(squareHelpers);
      selectedSquare = null;
      legalMovesFromSelected = [];
      updateCapturedPieces();
      updateTurnUI();
      applyTheme(currentThemeKey);
      updateMoveHistory();
      resetCameraPosition();
      showStatus("New game");
      closeNewGameModal();
    });
  }

  if (saveGameBtn) {
    saveGameBtn.addEventListener("click", () => {
      try {
        const data = serializeGameState();
        downloadJson("chess-game.json", data);
        showStatus("Game saved");
      } catch (err) {
        console.error(err);
        showStatus("Failed to save game");
      }
    });
  }

  if (loadGameBtn && loadGameFileInput) {
    loadGameBtn.addEventListener("click", () => {
      loadGameFileInput.click();
    });

    loadGameFileInput.addEventListener("change", async (event) => {
      const file = event.target.files && event.target.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        restoreGameFromData(data);
        showStatus("Game loaded");
      } catch (err) {
        console.error(err);
        showStatus("Failed to load game");
      } finally {
        loadGameFileInput.value = "";
      }
    });
  }

  if (flipBoardBtn) {
    flipBoardBtn.addEventListener("click", () => {
      const offset = new THREE.Vector3().subVectors(camera.position, controls.target);
      offset.applyAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI);
      camera.position.copy(controls.target).add(offset);
      camera.lookAt(controls.target);
      isBoardFlipped = !isBoardFlipped;
    });
  }

  function updateCameraMovement(delta) {
    const speed = 3;
    let moveX = 0;
    let moveZ = 0;

    if (keys.w) moveZ -= 1;
    if (keys.s) moveZ += 1;
    if (keys.a) moveX -= 1;
    if (keys.d) moveX += 1;

    moveX += joystickVec.x;
    moveZ += joystickVec.y;

    if (moveX === 0 && moveZ === 0) return;

    const length = Math.hypot(moveX, moveZ);
    if (length > 0) {
      moveX /= length;
      moveZ /= length;
    }

    const moveSpeed = speed * delta;
    const forward = new THREE.Vector3();
    camera.getWorldDirection(forward);
    forward.y = 0;
    forward.normalize();

    const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

    const move = new THREE.Vector3();
    move.addScaledVector(forward, moveZ * moveSpeed);
    move.addScaledVector(right, moveX * moveSpeed);

    camera.position.add(move);
    controls.target.add(move);
  }

  let lastTime = performance.now();
  function animate() {
    requestAnimationFrame(animate);
    const now = performance.now();
    const delta = (now - lastTime) / 1000;
    lastTime = now;

    updateCameraMovement(delta);
    controls.update();
    renderer.render(scene, camera);
  }
  animate();

  window.addEventListener("resize", () => {
    const w = appEl.clientWidth;
    const h = appEl.clientHeight;
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  });
}