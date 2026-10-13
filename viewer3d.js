// ==========================================================================
// VIEWER3D.JS - 3D ACUPUNCTURE HUMAN MODEL VIEWER (UPGRADED PROFESSIONAL VERSION)
// Three.js r147 + Draco GLTF + Z-Anatomy Body + Billboard Sprites + 60/60 Acupoints
// Optimized for Mobile Safari/Chrome, High-DPI screens, Offline Resilience
// ==========================================================================
/* globals THREE, GLTFLoader, DRACOLoader, AcuModel, MODEL_GLB_BASE64, MERIDIANS, ACUPOINTS_DATA */

(function () {
  "use strict";

  var Acu3D = {};

  var container = null;
  var scene, camera, renderer;
  var pivot, body;
  var isInitialized = false;

  // Meshes & Sprites
  var bodyMeshes = [];
  var corePoints = [];          // All 60 exam acupoint markers
  var meridianVisuals = [];     // 14 meridian lines
  var allPointMeshes = [];      // Additional meridian points (if any)
  var beaconBeam = null;        // Glowing vertical column above focused point
  var pulseGroup = null;

  // Textures cache
  var coreTexture = null;
  var selectedTexture = null;
  var ringTexture = null;

  // Camera & Animation State
  var isAnimatingCamera = false;
  var camTargetPos = new THREE.Vector3(0, 0, 2.7);
  var camTargetLook = new THREE.Vector3(0, 0, 0);
  var camCurrentLook = new THREE.Vector3(0, 0, 0);

  // Interaction State
  var pointers = new Map();
  var pointerStartPos = new Map();
  var prevPinchDist = null;
  var isAutoRotate = false;
  var selectedMarker = null;
  var onSelectCallback = null;
  var hasDragged = false;

  // Display toggles
  var showMeridianTubes = false;
  var showCoreOnly = true;

  // Mini-game State
  var gameTargetPoint = null;
  var onGameResultCallback = null;

  // Camera Region Presets (Target look and distance)
  var PRESETS = {
    all:   { pos: [0, 0, 2.7],    look: [0, 0, 0],     rotY: 0 },
    head:  { pos: [0, 0.74, 0.82], look: [0, 0.74, 0], rotY: 0 },
    chest: { pos: [0, 0.32, 0.95], look: [0, 0.32, 0], rotY: 0 },
    back:  { pos: [0, 0.28, 1.05], look: [0, 0.28, 0], rotY: Math.PI },
    arm:   { pos: [0.32, 0.05, 0.78], look: [0.30, 0.05, 0], rotY: 0.3 },
    leg:   { pos: [0.08, -0.45, 1.15], look: [0.08, -0.45, 0], rotY: 0 }
  };

  // --------------------------------------------------------------------------
  // TEXTURE GENERATORS (HIGH-CONTRAST CANVAS BILLBOARDS)
  // --------------------------------------------------------------------------
  function createDotTexture(colorHex, isSelected) {
    var size = 128;
    var canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    var ctx = canvas.getContext("2d");
    var c = size / 2;

    // 1. Ambient outer glow gradient
    var outerRadius = size * 0.48;
    var halo = ctx.createRadialGradient(c, c, size * 0.22, c, c, outerRadius);
    if (isSelected) {
      halo.addColorStop(0, "rgba(245, 158, 11, 0.85)"); // Amber gold
      halo.addColorStop(0.55, "rgba(245, 158, 11, 0.25)");
      halo.addColorStop(1, "rgba(245, 158, 11, 0)");
    } else {
      halo.addColorStop(0, "rgba(16, 185, 129, 0.90)");  // Emerald jade
      halo.addColorStop(0.55, "rgba(16, 185, 129, 0.28)");
      halo.addColorStop(1, "rgba(16, 185, 129, 0)");
    }
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(c, c, outerRadius, 0, Math.PI * 2);
    ctx.fill();

    // 2. High-contrast dark shadow rim (makes dot clearly visible against skin)
    ctx.beginPath();
    ctx.arc(c, c, size * 0.27, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(10, 15, 29, 0.85)";
    ctx.fill();

    // 3. Crisp white circular border
    ctx.beginPath();
    ctx.arc(c, c, size * 0.23, 0, Math.PI * 2);
    ctx.fillStyle = "#ffffff";
    ctx.fill();

    // 4. Center vibrant color dot
    ctx.beginPath();
    ctx.arc(c, c, size * 0.16, 0, Math.PI * 2);
    ctx.fillStyle = colorHex;
    ctx.fill();

    var texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  function createPulseRingTexture() {
    var size = 128;
    var canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    var ctx = canvas.getContext("2d");
    var c = size / 2;

    ctx.strokeStyle = "rgba(255, 255, 255, 0.95)";
    ctx.lineWidth = size * 0.05;
    ctx.beginPath();
    ctx.arc(c, c, size * 0.40, 0, Math.PI * 2);
    ctx.stroke();

    var texture = new THREE.CanvasTexture(canvas);
    if (THREE.SRGBColorSpace) texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
  }

  // --------------------------------------------------------------------------
  // INITIALIZATION
  // --------------------------------------------------------------------------
  Acu3D.init = function (domContainer, onSelect) {
    container = domContainer;
    onSelectCallback = onSelect;

    if (isInitialized) {
      Acu3D.resize();
      return;
    }

    var width = Math.max(container.clientWidth || 0, 320);
    var height = Math.max(container.clientHeight || 0, 460);

    // 1. Scene
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);

    // 2. Camera
    camera = new THREE.PerspectiveCamera(36, width / height, 0.05, 50);
    camera.position.set(0, 0, 2.7);
    camCurrentLook.set(0, 0, 0);

    // 3. WebGL Renderer
    try {
      renderer = new THREE.WebGLRenderer({
        antialias: true,
        alpha: true,
        powerPreference: "high-performance"
      });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.setSize(width, height);
      if (renderer.outputEncoding !== undefined) {
        renderer.outputEncoding = THREE.sRGBEncoding;
      }
      container.innerHTML = "";
      container.appendChild(renderer.domElement);
    } catch (e) {
      console.warn("WebGL initialization error:", e);
      return;
    }

    // 4. Lights
    scene.add(new THREE.AmbientLight(0xffffff, 0.45));
    scene.add(new THREE.HemisphereLight(0xe8f2f0, 0x182030, 0.75));

    var keyLight = new THREE.DirectionalLight(0xfff5ea, 1.4);
    keyLight.position.set(2.5, 4.0, 3.5);
    scene.add(keyLight);

    var fillLight = new THREE.DirectionalLight(0x93c5fd, 0.8);
    fillLight.position.set(-3.0, 2.0, 2.5);
    scene.add(fillLight);

    var rimLight = new THREE.DirectionalLight(0x34d399, 0.9);
    rimLight.position.set(0, 2.5, -4.0);
    scene.add(rimLight);

    // 5. Pivot & Body hierarchy
    pivot = new THREE.Group();
    body = new THREE.Group();
    body.position.y = -0.90; // Center human torso at y=0 world coordinates
    pivot.add(body);
    scene.add(pivot);

    // Pedestal plinth & contact shadow
    var pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.52, 0.58, 0.03, 36),
      new THREE.MeshStandardMaterial({ color: 0x121a28, roughness: 0.85, metalness: 0.15 })
    );
    pedestal.position.y = -0.015;
    body.add(pedestal);

    // Vertical beacon beam for focused point
    var beamGeo = new THREE.CylinderGeometry(0.0035, 0.0035, 0.45, 8);
    var beamMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.85 });
    beaconBeam = new THREE.Mesh(beamGeo, beamMat);
    beaconBeam.visible = false;
    body.add(beaconBeam);

    // Pulse group for active animations
    pulseGroup = new THREE.Group();
    body.add(pulseGroup);

    // Initialize textures
    coreTexture = createDotTexture("#10b981", false);
    selectedTexture = createDotTexture("#f59e0b", true);
    ringTexture = createPulseRingTexture();

    // 6. Model Loading Pipeline
    loadModel();

    // 7. Input Events
    bindInteraction();

    isInitialized = true;
    animate();
  };

  // --------------------------------------------------------------------------
  // MODEL LOADER (DRACO Z-ANATOMY WITH FALLBACK)
  // --------------------------------------------------------------------------
  function updateLoadingUI(ratio, text) {
    var loadingWrap = document.getElementById("canvas3d-loading");
    var fill = document.getElementById("canvas3d-progress-fill");
    var label = document.getElementById("canvas3d-loading-text");
    if (!loadingWrap) return;

    if (ratio >= 1) {
      if (fill) fill.style.width = "100%";
      setTimeout(function () {
        loadingWrap.style.opacity = "0";
        setTimeout(function () { loadingWrap.style.display = "none"; }, 400);
      }, 250);
    } else {
      loadingWrap.style.display = "flex";
      loadingWrap.style.opacity = "1";
      if (fill) fill.style.width = Math.round(ratio * 100) + "%";
      if (label && text) label.textContent = text;
    }
  }

  function loadModel() {
    updateLoadingUI(0.1, "Đang tải mô hình giải phẫu 3D...");

    // Try loading body.glb using DRACOLoader
    if (typeof THREE.GLTFLoader !== "undefined") {
      try {
        var loader = new THREE.GLTFLoader();

        if (typeof THREE.DRACOLoader !== "undefined") {
          var dracoLoader = new THREE.DRACOLoader();
          dracoLoader.setDecoderPath("assets/draco/");
          dracoLoader.preload();
          loader.setDRACOLoader(dracoLoader);
        }

        var modelUrl = "assets/models/body.glb";
        loader.load(
          modelUrl,
          function (gltf) {
            updateLoadingUI(0.85, "Đang căn chỉnh tọa độ huyệt đạo...");
            applyFittedModel(gltf.scene);
            updateLoadingUI(1.0, "Hoàn tất!");
          },
          function (xhr) {
            if (xhr.total > 0) {
              var p = 0.1 + (xhr.loaded / xhr.total) * 0.75;
              updateLoadingUI(p, "Đang nạp mô hình: " + Math.round(p * 100) + "%");
            }
          },
          function (err) {
            console.warn("Could not load assets/models/body.glb, switching to embedded fallback:", err);
            loadFallbackModel();
          }
        );
        return;
      } catch (err) {
        console.warn("GLTFLoader error, falling back:", err);
        loadFallbackModel();
        return;
      }
    }

    loadFallbackModel();
  }

  function loadFallbackModel() {
    updateLoadingUI(0.6, "Đang tải mô hình nhân thể chuẩn...");
    try {
      if (typeof MODEL_GLB_BASE64 !== "undefined" && typeof AcuModel !== "undefined") {
        var bin = base64ToArrayBuffer(MODEL_GLB_BASE64);
        var loader = new THREE.GLTFLoader();
        loader.parse(bin, "", function (gltf) {
          var skinMat = new THREE.MeshStandardMaterial({
            color: 0x243247,
            roughness: 0.65,
            metalness: 0.12
          });
          var prep = AcuModel.prepare(gltf.scene, skinMat);
          body.add(prep.group);
          collectMeshes(prep.group);
          buildAll60Acupoints(prep.snap);
          updateLoadingUI(1.0, "Hoàn tất!");
        }, function () {}, function (err) {
          console.warn("Fallback to procedural figure:", err);
          buildProceduralModel();
        });
      } else {
        buildProceduralModel();
      }
    } catch (e) {
      console.warn("Fallback to procedural figure:", e);
      buildProceduralModel();
    }
  }

  function base64ToArrayBuffer(base64) {
    var binary_string = window.atob(base64);
    var len = binary_string.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) {
      bytes[i] = binary_string.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function applyFittedModel(sceneGroup) {
    // 1. Measure and fit model so soles are at y=0, crown at y=1.80, centered in X and Z
    sceneGroup.updateMatrixWorld(true);
    var box = new THREE.Box3().setFromObject(sceneGroup);
    var size = box.getSize(new THREE.Vector3());
    var center = box.getCenter(new THREE.Vector3());

    // Center X and Z
    sceneGroup.position.x -= center.x;
    sceneGroup.position.z -= center.z;
    sceneGroup.position.y -= box.min.y; // Soles at y=0

    var targetHeight = 1.80;
    var scale = targetHeight / (size.y || 1);
    sceneGroup.scale.setScalar(scale);

    sceneGroup.updateMatrixWorld(true);
    var boxAfter = new THREE.Box3().setFromObject(sceneGroup);
    sceneGroup.position.y -= boxAfter.min.y;

    // 2. Style materials with sleek dark slate jade sheen
    var skinMat = new THREE.MeshStandardMaterial({
      color: 0x26354a,
      roughness: 0.58,
      metalness: 0.10,
      transparent: true,
      opacity: 0.94
    });

    sceneGroup.traverse(function (obj) {
      if (obj.isMesh) {
        obj.material = skinMat;
        obj.castShadow = false;
        obj.receiveShadow = false;
        bodyMeshes.push(obj);
      }
    });

    body.add(sceneGroup);

    // Build snapper and create all 60 points
    var snapFunc = createFastMeshSnapper(bodyMeshes);
    buildAll60Acupoints(snapFunc);
  }

  function buildProceduralModel() {
    var skinMat = new THREE.MeshStandardMaterial({
      color: 0x26354a,
      roughness: 0.65,
      metalness: 0.12
    });

    function addPart(geo, x, y, z, sx, sy, sz) {
      var m = new THREE.Mesh(geo, skinMat);
      m.position.set(x, y, z);
      if (sx !== undefined) m.scale.set(sx, sy, sz);
      body.add(m);
      bodyMeshes.push(m);
      return m;
    }

    var sphere = new THREE.SphereGeometry(1, 24, 18);
    addPart(sphere, 0, 1.66, 0.01, 0.095, 0.125, 0.105); // Head
    addPart(new THREE.CylinderGeometry(0.045, 0.052, 0.11, 24), 0, 1.52, 0); // Neck
    addPart(new THREE.CapsuleGeometry(0.155, 0.35, 8, 20), 0, 1.20, 0, 1.1, 1.3, 0.68); // Chest
    addPart(new THREE.CapsuleGeometry(0.135, 0.25, 8, 20), 0, 0.95, 0, 1.15, 1.1, 0.75); // Abdomen
    addPart(new THREE.CapsuleGeometry(0.042, 0.28, 8, 16), 0.26, 1.18, 0, 1, 1, 1); // Arm R
    addPart(new THREE.CapsuleGeometry(0.042, 0.28, 8, 16), -0.26, 1.18, 0, 1, 1, 1); // Arm L
    addPart(new THREE.CapsuleGeometry(0.034, 0.26, 8, 16), 0.33, 0.88, 0, 1, 1, 1); // Forearm R
    addPart(new THREE.CapsuleGeometry(0.034, 0.26, 8, 16), -0.33, 0.88, 0, 1, 1, 1); // Forearm L
    addPart(new THREE.CapsuleGeometry(0.056, 0.36, 8, 16), 0.10, 0.60, 0); // Thigh R
    addPart(new THREE.CapsuleGeometry(0.056, 0.36, 8, 16), -0.10, 0.60, 0); // Thigh L
    addPart(new THREE.CapsuleGeometry(0.042, 0.36, 8, 16), 0.10, 0.22, 0); // Shin R
    addPart(new THREE.CapsuleGeometry(0.042, 0.36, 8, 16), -0.10, 0.22, 0); // Shin L

    buildAll60Acupoints(function (p) {
      return { point: p.clone(), normal: new THREE.Vector3(0, 0, p.z >= 0 ? 1 : -1) };
    });
    updateLoadingUI(1.0, "Hoàn tất!");
  }

  function collectMeshes(root) {
    root.traverse(function (obj) {
      if (obj.isMesh) bodyMeshes.push(obj);
    });
  }

  // Fast mesh surface snapper using vertex proximity & direction cones
  function createFastMeshSnapper(meshes) {
    if (!meshes || meshes.length === 0) {
      return function (p) {
        return { point: p.clone(), normal: new THREE.Vector3(0, 0, p.z >= 0 ? 1 : -1) };
      };
    }

    return function snap(targetVec, maxDist) {
      var limit = maxDist || 0.25;
      var bestDist = limit * limit;
      var bestPt = null;
      var bestNormal = null;

      var v = new THREE.Vector3();
      var norm = new THREE.Vector3();

      for (var m = 0; m < meshes.length; m++) {
        var mesh = meshes[m];
        var geo = mesh.geometry;
        var posAttr = geo.getAttribute("position");
        var normAttr = geo.getAttribute("normal");
        if (!posAttr) continue;

        var stride = posAttr.count > 10000 ? 3 : 1;

        for (var i = 0; i < posAttr.count; i += stride) {
          v.fromBufferAttribute(posAttr, i);
          v.applyMatrix4(mesh.matrixWorld);

          // Soft height gate (reject vertices more than 22cm away in Y)
          if (Math.abs(v.y - targetVec.y) > 0.22) continue;

          var d2 = v.distanceToSquared(targetVec);
          if (d2 < bestDist) {
            bestDist = d2;
            bestPt = v.clone();
            if (normAttr) {
              norm.fromBufferAttribute(normAttr, i);
              bestNormal = norm.clone();
            } else {
              bestNormal = new THREE.Vector3(0, 0, targetVec.z >= 0 ? 1 : -1);
            }
          }
        }
      }

      if (bestPt) {
        return { point: bestPt, normal: bestNormal || new THREE.Vector3(0, 0, 1) };
      }
      return { point: targetVec.clone(), normal: new THREE.Vector3(0, 0, targetVec.z >= 0 ? 1 : -1) };
    };
  }

  // --------------------------------------------------------------------------
  // BUILD ALL 60 ACUPOINTS (BILLBOARD SPRITES & TOUCH HIT-TARGETS)
  // --------------------------------------------------------------------------
  function buildAll60Acupoints(snap) {
    corePoints = [];
    var LIFT = 0.010;

    var pointsData = window.ACUPOINTS_DATA || [];
    var processedIds = new Set();

    pointsData.forEach(function (p) {
      var rawPos = p.pos_3d || [0, 1.2, 0.05];
      var targetVec = new THREE.Vector3(rawPos[0], rawPos[1], rawPos[2]);

      var s = snap ? snap(targetVec, 0.30) : null;
      var anchor = (s && s.point) ? s.point.clone().addScaledVector(s.normal || new THREE.Vector3(0, 0, 1), LIFT) : targetVec.clone();

      var isBack = (anchor.z < -0.015) || (p.region_id === "back");

      // 1. Core Sprite Dot (sizeAttenuation: false ensures fixed touch-friendly pixel size on mobile)
      var spriteMat = new THREE.SpriteMaterial({
        map: coreTexture,
        transparent: true,
        depthWrite: false,
        depthTest: false, // Ensures marker never disappears behind complex mesh crevices
        sizeAttenuation: false
      });

      var sprite = new THREE.Sprite(spriteMat);
      sprite.position.copy(anchor);
      sprite.scale.setScalar(0.034); // Screen-height fraction (~32px on phone)
      sprite.renderOrder = 20;

      // 2. Pulse Ring Sprite (for selection and focus animation)
      var pulseMat = new THREE.SpriteMaterial({
        map: ringTexture,
        color: new THREE.Color(0xf59e0b),
        transparent: true,
        depthWrite: false,
        depthTest: false,
        sizeAttenuation: false,
        opacity: 0
      });
      var pulse = new THREE.Sprite(pulseMat);
      pulse.position.copy(anchor);
      pulse.scale.setScalar(0.048);
      pulse.renderOrder = 19;

      body.add(sprite);
      pulseGroup.add(pulse);

      var markerData = {
        point: p,
        sprite: sprite,
        pulse: pulse,
        anchor: anchor.clone(),
        isBack: isBack,
        isCore: true,
        opacity: 1.0,
        isSelected: false
      };

      corePoints.push(markerData);
      processedIds.add(p.id);
    });

    // 3. Build 14 Glowing Meridian Polylines
    buildMeridianLines(snap);

    console.log("3D Viewer: Loaded " + corePoints.length + "/60 core acupoints successfully!");
  }

  function buildMeridianLines(snap) {
    if (!window.MERIDIANS) return;

    window.MERIDIANS.forEach(function (m) {
      var mColor = m.color || 0x10b981;
      var polylines = m.path ? [m.path] : (m.branches || []);

      polylines.forEach(function (poly) {
        var sides = m.bilateral ? [1, -1] : [1];
        sides.forEach(function (side) {
          var snappedCurvePoints = [];

          poly.forEach(function (pt) {
            if (!pt.pos) return;
            var targetVec = new THREE.Vector3(pt.pos[0] * side, pt.pos[1], pt.pos[2]);
            var s = snap ? snap(targetVec, 0.25) : null;
            if (s && s.point) {
              snappedCurvePoints.push(s.point.clone().addScaledVector(s.normal, 0.006));
            } else {
              snappedCurvePoints.push(targetVec);
            }
          });

          if (snappedCurvePoints.length > 1) {
            try {
              var curve = new THREE.CatmullRomCurve3(snappedCurvePoints);
              var tubeGeo = new THREE.TubeGeometry(curve, snappedCurvePoints.length * 4, 0.0032, 8, false);
              var tubeMat = new THREE.MeshStandardMaterial({
                color: mColor,
                emissive: mColor,
                emissiveIntensity: 0.65,
                transparent: true,
                opacity: 0.72,
                roughness: 0.35
              });
              var tubeMesh = new THREE.Mesh(tubeGeo, tubeMat);
              tubeMesh.visible = showMeridianTubes;
              body.add(tubeMesh);
              meridianVisuals.push(tubeMesh);
            } catch (e) {}
          }
        });
      });
    });
  }

  // --------------------------------------------------------------------------
  // CAMERA CONTROLS & SIDE TOGGLE
  // --------------------------------------------------------------------------
  Acu3D.focusRegion = function (presetKey) {
    var p = PRESETS[presetKey] || PRESETS.all;
    camTargetPos.set(p.pos[0], p.pos[1], p.pos[2]);
    camTargetLook.set(p.look[0], p.look[1], p.look[2]);

    if (p.rotY !== undefined) {
      pivot.rotation.y = p.rotY;
      updateSideButtons(p.rotY);
    }
    isAnimatingCamera = true;
  };

  Acu3D.setSide = function (side) {
    if (side === "back") {
      pivot.rotation.y = Math.PI;
    } else {
      pivot.rotation.y = 0;
    }
    updateSideButtons(pivot.rotation.y);
  };

  function updateSideButtons(currentRotY) {
    var angle = ((currentRotY % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    var isBack = (angle > Math.PI * 0.5 && angle < Math.PI * 1.5);
    var btnFront = document.getElementById("btn-side-front");
    var btnBack = document.getElementById("btn-side-back");
    if (btnFront) btnFront.classList.toggle("active", !isBack);
    if (btnBack) btnBack.classList.toggle("active", isBack);
  }

  Acu3D.zoomDelta = function (delta) {
    camera.position.z = Math.max(0.48, Math.min(3.8, camera.position.z + delta));
  };

  Acu3D.resetView = function () {
    pivot.rotation.set(0, 0, 0);
    Acu3D.focusRegion("all");
    if (beaconBeam) beaconBeam.visible = false;
    deselectMarker();
  };

  Acu3D.toggleMeridians = function (show) {
    showMeridianTubes = (show !== undefined) ? show : !showMeridianTubes;
    meridianVisuals.forEach(function (m) { m.visible = showMeridianTubes; });
    return showMeridianTubes;
  };

  Acu3D.toggleCoreOnly = function (onlyCore) {
    showCoreOnly = (onlyCore !== undefined) ? onlyCore : !showCoreOnly;
    return showCoreOnly;
  };

  Acu3D.toggleAutoRotate = function () {
    isAutoRotate = !isAutoRotate;
    return isAutoRotate;
  };

  Acu3D.filterByRegion = function (regionId) {
    corePoints.forEach(function (marker) {
      var p = marker.point;
      if (regionId === "all" || p.region_id === regionId) {
        marker.sprite.visible = true;
        marker.sprite.scale.setScalar(0.034);
      } else {
        marker.sprite.scale.setScalar(0.020);
      }
    });
  };

  // --------------------------------------------------------------------------
  // ACUPOINT SELECTION & SMOOTH FLIP
  // --------------------------------------------------------------------------
  Acu3D.selectPoint = function (whoCodeOrId) {
    var query = String(whoCodeOrId).trim().toUpperCase();
    var marker = corePoints.find(function (m) {
      return (m.point.who_code && m.point.who_code.toUpperCase() === query) ||
             (m.point.id && m.point.id.toUpperCase() === query);
    });

    if (marker) {
      focusMarker(marker);
    }
  };

  function deselectMarker() {
    if (selectedMarker) {
      selectedMarker.sprite.material.map = coreTexture;
      selectedMarker.sprite.scale.setScalar(0.034);
      selectedMarker.pulse.material.opacity = 0;
      selectedMarker.isSelected = false;
      selectedMarker = null;
    }
  }

  function focusMarker(marker) {
    deselectMarker();

    selectedMarker = marker;
    marker.isSelected = true;
    marker.sprite.material.map = selectedTexture;
    marker.sprite.scale.setScalar(0.046);

    // Auto-spin 180° to face the exact side if point is posterior/anterior!
    var p = marker.anchor;
    if (marker.isBack) {
      pivot.rotation.y = Math.PI; // Face Back
    } else {
      pivot.rotation.y = 0;       // Face Front
    }
    updateSideButtons(pivot.rotation.y);

    // Smoothly focus camera on acupoint
    var worldPos = new THREE.Vector3();
    marker.sprite.getWorldPosition(worldPos);
    camTargetLook.set(worldPos.x * 0.35, worldPos.y, 0);

    // Zoom framing
    var camZ = marker.isBack ? -1.05 : 1.05;
    camTargetPos.set(worldPos.x * 0.35, worldPos.y, camZ);
    isAnimatingCamera = true;

    // Glowing beacon beam above point
    if (beaconBeam) {
      beaconBeam.position.copy(marker.anchor).add(new THREE.Vector3(0, 0.22, 0));
      beaconBeam.visible = true;
    }
  }

  // --------------------------------------------------------------------------
  // 3D PINPOINT GAME WITH DIRECTION COMPASS
  // --------------------------------------------------------------------------
  Acu3D.startFindPointGame = function (targetPoint, onResult) {
    gameTargetPoint = targetPoint;
    onGameResultCallback = onResult;
    if (beaconBeam) beaconBeam.visible = false;
    deselectMarker();
  };

  Acu3D.stopFindPointGame = function () {
    gameTargetPoint = null;
    onGameResultCallback = null;
    if (beaconBeam) beaconBeam.visible = false;
  };

  Acu3D.getTargetDirectionHint = function () {
    if (!gameTargetPoint) return "";
    var marker = corePoints.find(function (m) {
      return (m.point.id === gameTargetPoint.id) ||
             (m.point.who_code === gameTargetPoint.who_code);
    });
    if (!marker) return "";

    var angle = ((pivot.rotation.y % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
    var isLookingAtBack = (angle > Math.PI * 0.5 && angle < Math.PI * 1.5);

    if (marker.isBack && !isLookingAtBack) {
      return "🔄 Huyệt ở MẶT SAU lưng! Hãy xoay người 180°";
    } else if (!marker.isBack && isLookingAtBack) {
      return "🔄 Huyệt ở MẶT TRƯỚC! Hãy xoay người ra trước";
    }

    if (marker.anchor.y < 0.6) {
      return "⬇️ Huyệt ở VÙNG CHÂN / BÀN CHÂN!";
    } else if (marker.anchor.y > 1.5) {
      return "⬆️ Huyệt ở VÙNG ĐẦU MẶT CỔ!";
    }
    return "🔍 Huyệt ở quanh vùng THÂN TRÊN / TAY!";
  };

  // --------------------------------------------------------------------------
  // TOUCH & POINTER GESTURES (HIGH-DPI TOUCH SCREEN SPACE PICKING)
  // --------------------------------------------------------------------------
  function bindInteraction() {
    var canvas = renderer.domElement;
    canvas.style.touchAction = "none";

    canvas.addEventListener("pointerdown", function (e) {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      pointerStartPos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      hasDragged = false;
      prevPinchDist = null;
    });

    canvas.addEventListener("pointermove", function (e) {
      if (!pointers.has(e.pointerId)) return;
      var start = pointerStartPos.get(e.pointerId);
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 7) {
        hasDragged = true;
      }

      var prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 1) {
        var dx = e.clientX - prev.x;
        var dy = e.clientY - prev.y;
        pivot.rotation.y += dx * 0.009;
        pivot.rotation.x = Math.max(-0.6, Math.min(0.6, pivot.rotation.x + dy * 0.007));
        updateSideButtons(pivot.rotation.y);
      } else if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (prevPinchDist !== null) {
          var delta = dist - prevPinchDist;
          camera.position.z = Math.max(0.48, Math.min(3.8, camera.position.z - delta * 0.005));
        }
        prevPinchDist = dist;
      }
    });

    function onPointerUp(e) {
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      if (!hasDragged && pointerStartPos.has(e.pointerId)) {
        handleScreenTap(e.clientX, e.clientY);
      }
      pointers.delete(e.pointerId);
      pointerStartPos.delete(e.pointerId);
      if (pointers.size < 2) prevPinchDist = null;
    }

    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      camera.position.z = Math.max(0.48, Math.min(3.8, camera.position.z + e.deltaY * 0.002));
    }, { passive: false });
  }

  // Generous 2D screen-space hit testing (accurate, touch-friendly 44px radius)
  function handleScreenTap(clientX, clientY) {
    var rect = renderer.domElement.getBoundingClientRect();
    var touchX = clientX - rect.left;
    var touchY = clientY - rect.top;

    var bestMarker = null;
    var bestDist = 44; // 44px finger touch threshold
    var proj = new THREE.Vector3();

    corePoints.forEach(function (marker) {
      if (marker.opacity < 0.22) return; // Ignore occluded points facing opposite side
      marker.sprite.getWorldPosition(proj);
      proj.project(camera);

      // Check if inside camera view frustum
      if (proj.z > 1) return;

      var sx = (proj.x * 0.5 + 0.5) * rect.width;
      var sy = (-proj.y * 0.5 + 0.5) * rect.height;

      var dist = Math.hypot(sx - touchX, sy - touchY);
      if (dist < bestDist) {
        bestDist = dist;
        bestMarker = marker;
      }
    });

    if (bestMarker) {
      if (gameTargetPoint && onGameResultCallback) {
        var isCorrect = (bestMarker.point.id === gameTargetPoint.id) ||
                        (bestMarker.point.who_code === gameTargetPoint.who_code);
        onGameResultCallback(isCorrect, bestMarker.point);
        focusMarker(bestMarker);
        return;
      }

      focusMarker(bestMarker);
      if (onSelectCallback) {
        onSelectCallback(bestMarker.point, bestMarker.point.who_code);
      }
    }
  }

  // --------------------------------------------------------------------------
  // ANIMATION LOOP (FACING CHECK & PULSE WAVE)
  // --------------------------------------------------------------------------
  var worldPos = new THREE.Vector3();
  var centerPos = new THREE.Vector3();
  var outward = new THREE.Vector3();
  var toCamera = new THREE.Vector3();

  function animate() {
    requestAnimationFrame(animate);

    // 1. Camera interpolation
    if (isAnimatingCamera) {
      camera.position.lerp(camTargetPos, 0.09);
      camCurrentLook.lerp(camTargetLook, 0.09);
      camera.lookAt(camCurrentLook);

      if (camera.position.distanceTo(camTargetPos) < 0.005 &&
          camCurrentLook.distanceTo(camTargetLook) < 0.005) {
        isAnimatingCamera = false;
      }
    } else {
      camera.lookAt(camCurrentLook);
    }

    // 2. Auto-rotate
    if (isAutoRotate && pointers.size === 0) {
      pivot.rotation.y += 0.006;
      updateSideButtons(pivot.rotation.y);
    }

    // 3. Update point facing opacity & pulse ring
    body.getWorldPosition(centerPos);
    var now = Date.now() * 0.001;

    corePoints.forEach(function (marker) {
      marker.sprite.getWorldPosition(worldPos);

      // Horizontal outward vector relative to body center
      outward.copy(worldPos).sub(centerPos);
      outward.y = 0;

      toCamera.copy(camera.position).sub(worldPos).normalize();
      var facing = outward.length() > 0.001 ? outward.normalize().dot(toCamera) : 1;

      // When facing camera, full opacity (1.0). When behind, subtle translucency (0.18).
      var targetOpacity = (facing >= -0.15) ? 1.0 : 0.18;
      marker.opacity = THREE.MathUtils.lerp(marker.opacity, targetOpacity, 0.15);
      marker.sprite.material.opacity = marker.opacity;

      // Pulse ring animation for selected point
      if (marker.isSelected) {
        var wave = Math.sin(now * 5.0) * 0.5 + 0.5;
        marker.pulse.material.opacity = (0.35 + wave * 0.55) * marker.opacity;
        marker.pulse.scale.setScalar(0.046 * (1.2 + wave * 0.5));
      }
    });

    renderer.render(scene, camera);
  }

  // --------------------------------------------------------------------------
  // RESIZE & EXPORTS
  // --------------------------------------------------------------------------
  Acu3D.resize = function () {
    if (!renderer || !container) return;
    var width = container.clientWidth || 340;
    var height = container.clientHeight || 460;
    if (width > 0 && height > 0) {
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      renderer.setSize(width, height);
    }
  };

  window.addEventListener("resize", function () {
    Acu3D.resize();
  });

  window.Acu3D = Acu3D;
})();
