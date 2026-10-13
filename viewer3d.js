// ==========================================================================
// VIEWER3D.JS - 3D ACUPUNCTURE HUMAN MODEL VIEWER
// Three.js r147 + Snapped Points + Smooth Camera Lerp + 3D Pinpoint Game
// ==========================================================================
/* globals THREE, GLTFLoader, AcuModel, MODEL_GLB_BASE64, MERIDIANS, ACUPOINTS_DATA */

(function () {
  "use strict";

  var Acu3D = {};

  var container = null;
  var scene, camera, renderer;
  var pivot, body, prepModel;
  var isInitialized = false;

  // Visual collections
  var corePoints = [];          // Our 60 exam points meshes
  var meridianVisuals = [];      // 14 meridian tube meshes
  var allPointMeshes = [];       // Other 300+ acupoints
  var hitTargets = [];           // Raycast targets
  var haloMeshGroup = null;

  // Camera animation state
  var isAnimatingCamera = false;
  var camTargetPos = new THREE.Vector3(0, 0, 2.7);
  var camTargetLook = new THREE.Vector3(0, 0, 0);
  var camCurrentLook = new THREE.Vector3(0, 0, 0);

  // Interaction state
  var pointers = new Map();
  var prevPinchDist = null;
  var isRotating = false;
  var isPanning = false;
  var isAutoRotate = false;
  var selectedPointMesh = null;
  var onSelectCallback = null;

  // Display toggles
  var showMeridianTubes = false;
  var showCoreOnly = true;

  // Game state
  var gameTargetPoint = null;
  var onGameResultCallback = null;

  // Camera presets
  var PRESETS = {
    all: { pos: [0, 0, 2.7], look: [0, 0, 0], rotY: 0 },
    head: { pos: [0, 0.72, 0.85], look: [0, 0.72, 0], rotY: 0 },
    chest: { pos: [0, 0.32, 0.95], look: [0, 0.32, 0], rotY: 0 },
    back: { pos: [0, 0.28, 1.05], look: [0, 0.28, 0], rotY: Math.PI }, // Rotate 180 deg to show back!
    arm: { pos: [0.32, 0.05, 0.75], look: [0.30, 0.05, 0], rotY: 0.3 },
    leg: { pos: [0.08, -0.45, 1.15], look: [0.08, -0.45, 0], rotY: 0 }
  };

  Acu3D.init = function (domContainer, onSelect) {
    if (isInitialized) {
      Acu3D.resize();
      return;
    }
    container = domContainer;
    onSelectCallback = onSelect;

    // 1. Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);

    var width = container.clientWidth || 360;
    var height = container.clientHeight || 480;

    camera = new THREE.PerspectiveCamera(36, width / height, 0.05, 50);
    camera.position.set(0, 0, 2.7);
    camCurrentLook.set(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    renderer.outputEncoding = THREE.sRGBEncoding;
    container.innerHTML = "";
    container.appendChild(renderer.domElement);

    // 2. Lights
    scene.add(new THREE.HemisphereLight(0xffffff, 0x182030, 0.85));
    var dirLight1 = new THREE.DirectionalLight(0xffffff, 0.95);
    dirLight1.position.set(2, 3, 3);
    scene.add(dirLight1);

    var rimLight = new THREE.DirectionalLight(0x38bdf8, 0.5);
    rimLight.position.set(-2, 2, -3);
    scene.add(rimLight);

    var bottomLight = new THREE.DirectionalLight(0x10b981, 0.25);
    bottomLight.position.set(0, -2, 2);
    scene.add(bottomLight);

    // 3. Pivot & Body Group
    pivot = new THREE.Group();
    body = new THREE.Group();
    body.position.y = -0.9; // Center model pivot
    pivot.add(body);
    scene.add(pivot);

    haloMeshGroup = new THREE.Group();
    body.add(haloMeshGroup);

    // Subtle floor pedestal
    var pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.55, 0.02, 36),
      new THREE.MeshStandardMaterial({ color: 0x111927, roughness: 0.9, metalness: 0.1 })
    );
    pedestal.position.y = -0.01;
    body.add(pedestal);

    // 4. Load & Prepare Model
    loadModel();

    // 5. Input Events
    bindInteraction();

    // 6. Start Loop
    isInitialized = true;
    animate();
  };

  function loadModel() {
    try {
      var bin = base64ToArrayBuffer(MODEL_GLB_BASE64);
      var loader = new THREE.GLTFLoader();
      loader.parse(bin, "", function (gltf) {
        // High quality anatomical skin shader
        var skinMat = new THREE.MeshStandardMaterial({
          color: 0x2d3748,
          roughness: 0.72,
          metalness: 0.18,
          wireframe: false
        });

        prepModel = AcuModel.prepare(gltf.scene, skinMat);
        body.add(prepModel.group);

        // Build all 3D acupuncture points & tubes
        buildAcupointEntities(prepModel.snap);
      });
    } catch (err) {
      console.error("Failed to parse 3D model:", err);
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

  // --- ENTITY BUILDING (POINTS, HALOS, TUBES) ---
  function buildAcupointEntities(snap) {
    var LIFT = 0.007;

    // Map WHO code -> our 60 acupoints
    var whoToOurPoint = {};
    if (window.ACUPOINTS_DATA) {
      window.ACUPOINTS_DATA.forEach(function (p) {
        if (p.who_code) whoToOurPoint[p.who_code.toUpperCase()] = p;
      });
    }

    var sphereGeo = new THREE.SphereGeometry(1, 16, 12);

    // Standard materials
    var matCore = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x059669,
      emissiveIntensity: 0.8,
      roughness: 0.3
    });

    var matOther = new THREE.MeshStandardMaterial({
      color: 0x475569,
      emissive: 0x1e293b,
      emissiveIntensity: 0.3,
      roughness: 0.6
    });

    // 1. Process standard 14 meridians
    if (window.MERIDIANS) {
      window.MERIDIANS.forEach(function (m) {
        var mColor = m.color || 0x10b981;
        var polylines = m.path ? [m.path] : (m.branches || []);

        polylines.forEach(function (poly) {
          var sides = m.bilateral ? [1, -1] : [1];
          sides.forEach(function (side) {
            var snappedCurvePoints = [];

            poly.forEach(function (pt) {
              var raw = pt.pos;
              if (!raw) return;
              var targetVec = new THREE.Vector3(raw[0] * side, raw[1], raw[2]);
              var s = snap(targetVec, 0.15);
              if (!s) return;

              var finalPos = s.point.clone().addScaledVector(s.normal, LIFT);
              snappedCurvePoints.push(finalPos);

              // If this is a named acupoint
              if (pt.code) {
                var whoCode = pt.code.toUpperCase();
                var ourPoint = whoToOurPoint[whoCode];

                var r = ourPoint ? 0.011 : 0.006;
                var mesh = new THREE.Mesh(sphereGeo, ourPoint ? matCore : matOther);
                mesh.position.copy(finalPos);
                mesh.scale.set(r, r, r);
                mesh.userData = {
                  whoCode: whoCode,
                  side: side,
                  meridianId: m.id,
                  ourPoint: ourPoint,
                  isCore: !!ourPoint
                };

                body.add(mesh);

                if (ourPoint) {
                  corePoints.push(mesh);
                  addHaloRing(finalPos, s.normal);
                } else {
                  allPointMeshes.push(mesh);
                  if (showCoreOnly) mesh.visible = false;
                }

                // Add invisible raycast target
                var hit = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ visible: false }));
                hit.position.copy(finalPos);
                hit.scale.set(0.025, 0.025, 0.025);
                hit.userData = mesh.userData;
                hit.userData.visualMesh = mesh;
                body.add(hit);
                hitTargets.push(hit);
              }
            });

            // Build meridian tube
            if (snappedCurvePoints.length > 1) {
              try {
                var curve = new THREE.CatmullRomCurve3(snappedCurvePoints);
                var tubeGeo = new THREE.TubeGeometry(curve, snappedCurvePoints.length * 4, 0.0028, 8, false);
                var tubeMat = new THREE.MeshStandardMaterial({
                  color: mColor,
                  emissive: mColor,
                  emissiveIntensity: 0.6,
                  transparent: true,
                  opacity: 0.75,
                  roughness: 0.4
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

    // 2. Add Extra Points (Kỳ huyệt) that were not in 14 meridians
    if (window.ACUPOINTS_DATA) {
      window.ACUPOINTS_DATA.forEach(function (p) {
        if (p.pos_3d && !corePoints.some(function (cp) { return cp.userData.ourPoint && cp.userData.ourPoint.id === p.id; })) {
          var targetVec = new THREE.Vector3(p.pos_3d[0], p.pos_3d[1], p.pos_3d[2]);
          var s = snap(targetVec, 0.2);
          if (s) {
            var finalPos = s.point.clone().addScaledVector(s.normal, LIFT);
            var mesh = new THREE.Mesh(sphereGeo, matCore);
            mesh.position.copy(finalPos);
            mesh.scale.set(0.012, 0.012, 0.012);
            mesh.userData = {
              whoCode: p.who_code,
              side: 1,
              meridianId: "EX",
              ourPoint: p,
              isCore: true
            };
            body.add(mesh);
            corePoints.push(mesh);
            addHaloRing(finalPos, s.normal);

            var hit = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ visible: false }));
            hit.position.copy(finalPos);
            hit.scale.set(0.026, 0.026, 0.026);
            hit.userData = mesh.userData;
            hit.userData.visualMesh = mesh;
            body.add(hit);
            hitTargets.push(hit);
          }
        }
      });
    }
  }

  function addHaloRing(pos, normal) {
    var ringGeo = new THREE.RingGeometry(0.015, 0.019, 20);
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.5
    });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.lookAt(pos.clone().add(normal));
    haloMeshGroup.add(ring);
  }

  // --- CAMERA TWEEN & CONTROLS ---
  Acu3D.focusRegion = function (presetKey) {
    var p = PRESETS[presetKey] || PRESETS.all;
    camTargetPos.set(p.pos[0], p.pos[1], p.pos[2]);
    camTargetLook.set(p.look[0], p.look[1], p.look[2]);

    if (p.rotY !== undefined) {
      // Smoothly rotate model pivot
      pivot.rotation.y = p.rotY;
    }
    isAnimatingCamera = true;
  };

  Acu3D.resetView = function () {
    pivot.rotation.set(0, 0, 0);
    Acu3D.focusRegion("all");
  };

  Acu3D.toggleMeridians = function (show) {
    showMeridianTubes = (show !== undefined) ? show : !showMeridianTubes;
    meridianVisuals.forEach(function (m) { m.visible = showMeridianTubes; });
    return showMeridianTubes;
  };

  Acu3D.toggleCoreOnly = function (onlyCore) {
    showCoreOnly = (onlyCore !== undefined) ? onlyCore : !showCoreOnly;
    allPointMeshes.forEach(function (m) { m.visible = !showCoreOnly; });
    return showCoreOnly;
  };

  Acu3D.toggleAutoRotate = function () {
    isAutoRotate = !isAutoRotate;
    return isAutoRotate;
  };

  Acu3D.filterByRegion = function (regionId) {
    corePoints.forEach(function (mesh) {
      if (!mesh.userData.ourPoint) return;
      if (regionId === "all" || mesh.userData.ourPoint.region_id === regionId) {
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0x10b981,
          emissive: 0x059669,
          emissiveIntensity: 0.8
        });
        mesh.scale.set(0.012, 0.012, 0.012);
      } else {
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0x334155,
          emissive: 0x0f172a,
          emissiveIntensity: 0.2
        });
        mesh.scale.set(0.006, 0.006, 0.006);
      }
    });
  };

  Acu3D.selectPoint = function (whoCode) {
    var target = corePoints.find(function (m) {
      return m.userData.whoCode === whoCode.toUpperCase();
    });
    if (target) {
      highlightPoint(target);
      // Move camera slightly toward point
      var worldPos = new THREE.Vector3();
      target.getWorldPosition(worldPos);
      camTargetLook.copy(worldPos);
      isAnimatingCamera = true;
    }
  };

  function highlightPoint(mesh) {
    if (selectedPointMesh) {
      selectedPointMesh.scale.set(0.011, 0.011, 0.011);
    }
    selectedPointMesh = mesh;
    mesh.scale.set(0.022, 0.022, 0.022);
  }

  // --- 3D PINPOINT GAME ---
  Acu3D.startFindPointGame = function (targetPoint, onResult) {
    gameTargetPoint = targetPoint;
    onGameResultCallback = onResult;
  };

  Acu3D.stopFindPointGame = function () {
    gameTargetPoint = null;
    onGameResultCallback = null;
  };

  // --- INTERACTION & GESTURES ---
  function bindInteraction() {
    var canvas = renderer.domElement;
    canvas.style.touchAction = "none";

    var pointerStartPos = new Map();
    var hasMoved = false;

    canvas.addEventListener("pointerdown", function (e) {
      canvas.setPointerCapture(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      pointerStartPos.set(e.pointerId, { x: e.clientX, y: e.clientY });
      hasMoved = false;
      prevPinchDist = null;
    });

    canvas.addEventListener("pointermove", function (e) {
      if (!pointers.has(e.pointerId)) return;
      var start = pointerStartPos.get(e.pointerId);
      if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 6) {
        hasMoved = true;
      }

      var prev = pointers.get(e.pointerId);
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (pointers.size === 1) {
        // Orbit rotation
        var dx = e.clientX - prev.x;
        var dy = e.clientY - prev.y;
        pivot.rotation.y += dx * 0.009;
        pivot.rotation.x = Math.max(-0.6, Math.min(0.6, pivot.rotation.x + dy * 0.007));
      } else if (pointers.size === 2) {
        // Pinch zoom
        var pts = Array.from(pointers.values());
        var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (prevPinchDist !== null) {
          var delta = dist - prevPinchDist;
          camera.position.z = Math.max(0.5, Math.min(3.8, camera.position.z - delta * 0.005));
        }
        prevPinchDist = dist;
      }
    });

    function onPointerUp(e) {
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      if (!hasMoved && pointerStartPos.has(e.pointerId)) {
        // Click / Tap detected
        handleRaycast(e.clientX, e.clientY);
      }
      pointers.delete(e.pointerId);
      pointerStartPos.delete(e.pointerId);
      if (pointers.size < 2) prevPinchDist = null;
    }

    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    // Wheel zoom
    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      camera.position.z = Math.max(0.5, Math.min(3.8, camera.position.z + e.deltaY * 0.002));
    }, { passive: false });
  }

  function handleRaycast(clientX, clientY) {
    var rect = renderer.domElement.getBoundingClientRect();
    var x = ((clientX - rect.left) / rect.width) * 2 - 1;
    var y = -((clientY - rect.top) / rect.height) * 2 + 1;

    var raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(new THREE.Vector2(x, y), camera);

    var hits = raycaster.intersectObjects(hitTargets, false);
    if (hits.length > 0) {
      var hitData = hits[0].object.userData;
      var visualMesh = hitData.visualMesh;

      if (gameTargetPoint && onGameResultCallback) {
        // Game mode active!
        var isCorrect = (hitData.ourPoint && hitData.ourPoint.id === gameTargetPoint.id) ||
                        (hitData.whoCode === gameTargetPoint.who_code);
        onGameResultCallback(isCorrect, hitData.ourPoint || hitData);
        if (visualMesh) highlightPoint(visualMesh);
        return;
      }

      if (visualMesh) highlightPoint(visualMesh);
      if (onSelectCallback) {
        onSelectCallback(hitData.ourPoint, hitData.whoCode);
      }
    }
  }

  // --- RENDER LOOP ---
  function animate() {
    requestAnimationFrame(animate);

    // Camera smoothing
    if (isAnimatingCamera) {
      camera.position.lerp(camTargetPos, 0.08);
      camCurrentLook.lerp(camTargetLook, 0.08);
      camera.lookAt(camCurrentLook);

      if (camera.position.distanceTo(camTargetPos) < 0.005 &&
          camCurrentLook.distanceTo(camTargetLook) < 0.005) {
        isAnimatingCamera = false;
      }
    } else {
      camera.lookAt(camCurrentLook);
    }

    // Auto rotate if active
    if (isAutoRotate && pointers.size === 0) {
      pivot.rotation.y += 0.006;
    }

    // Subtle pulse for halo rings
    if (haloMeshGroup) {
      var scale = 1 + Math.sin(Date.now() * 0.0035) * 0.12;
      haloMeshGroup.scale.set(scale, scale, scale);
    }

    renderer.render(scene, camera);
  }

  Acu3D.resize = function () {
    if (!renderer || !container) return;
    var width = container.clientWidth || 360;
    var height = container.clientHeight || 480;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
  };

  window.addEventListener("resize", function () {
    Acu3D.resize();
  });

  window.Acu3D = Acu3D;
})();
