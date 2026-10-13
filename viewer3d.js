// ==========================================================================
// VIEWER3D.JS - 3D ACUPUNCTURE HUMAN MODEL VIEWER (ENHANCED FOR MOBILE)
// Three.js r147 + Reliable WebGL + Snapped 60 Points + Direction Compass
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
  var beaconBeam = null;         // Glowing vertical beam for focused point

  // Camera animation state
  var isAnimatingCamera = false;
  var camTargetPos = new THREE.Vector3(0, 0, 2.7);
  var camTargetLook = new THREE.Vector3(0, 0, 0);
  var camCurrentLook = new THREE.Vector3(0, 0, 0);

  // Interaction state
  var pointers = new Map();
  var prevPinchDist = null;
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
    back: { pos: [0, 0.28, 1.05], look: [0, 0.28, 0], rotY: Math.PI },
    arm: { pos: [0.32, 0.05, 0.75], look: [0.30, 0.05, 0], rotY: 0.3 },
    leg: { pos: [0.08, -0.45, 1.15], look: [0.08, -0.45, 0], rotY: 0 }
  };

  Acu3D.init = function (domContainer, onSelect) {
    container = domContainer;
    onSelectCallback = onSelect;

    if (isInitialized) {
      Acu3D.resize();
      return;
    }

    // Check if container has valid dimension, otherwise fallback to reasonable default
    var width = Math.max(container.clientWidth || 0, 320);
    var height = Math.max(container.clientHeight || 0, 460);

    // 1. Scene setup
    scene = new THREE.Scene();
    scene.background = new THREE.Color(0x0a0f1d);

    camera = new THREE.PerspectiveCamera(36, width / height, 0.05, 50);
    camera.position.set(0, 0, 2.7);
    camCurrentLook.set(0, 0, 0);

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
      console.warn("WebGL initialization warning:", e);
      return;
    }

    // 2. Lights
    scene.add(new THREE.HemisphereLight(0xffffff, 0x182030, 0.9));
    var dirLight1 = new THREE.DirectionalLight(0xffffff, 1.0);
    dirLight1.position.set(2, 3, 3);
    scene.add(dirLight1);

    var rimLight = new THREE.DirectionalLight(0x38bdf8, 0.6);
    rimLight.position.set(-2, 2, -3);
    scene.add(rimLight);

    var backLight = new THREE.DirectionalLight(0x10b981, 0.4);
    backLight.position.set(0, 1, -3);
    scene.add(backLight);

    // 3. Pivot & Body Group
    pivot = new THREE.Group();
    body = new THREE.Group();
    body.position.y = -0.9;
    pivot.add(body);
    scene.add(pivot);

    haloMeshGroup = new THREE.Group();
    body.add(haloMeshGroup);

    // Pedestal
    var pedestal = new THREE.Mesh(
      new THREE.CylinderGeometry(0.5, 0.55, 0.02, 36),
      new THREE.MeshStandardMaterial({ color: 0x111927, roughness: 0.9, metalness: 0.1 })
    );
    pedestal.position.y = -0.01;
    body.add(pedestal);

    // Vertical beacon beam for focused point
    var beamGeo = new THREE.CylinderGeometry(0.003, 0.003, 0.4, 8);
    var beamMat = new THREE.MeshBasicMaterial({ color: 0x34d399, transparent: true, opacity: 0.8 });
    beaconBeam = new THREE.Mesh(beamGeo, beamMat);
    beaconBeam.visible = false;
    body.add(beaconBeam);

    // 4. Load Model
    loadModel();

    // 5. Input Events
    bindInteraction();

    isInitialized = true;
    animate();
  };

  function loadModel() {
    try {
      if (typeof MODEL_GLB_BASE64 !== "undefined") {
        var bin = base64ToArrayBuffer(MODEL_GLB_BASE64);
        var loader = new THREE.GLTFLoader();
        loader.parse(bin, "", function (gltf) {
          var skinMat = new THREE.MeshStandardMaterial({
            color: 0x2e384d,
            roughness: 0.70,
            metalness: 0.15
          });

          prepModel = AcuModel.prepare(gltf.scene, skinMat);
          body.add(prepModel.group);

          buildAcupointEntities(prepModel.snap);
        }, function (xhr) {}, function (err) {
          console.warn("Fallback to procedural figure:", err);
          buildProceduralFallback();
        });
      } else {
        buildProceduralFallback();
      }
    } catch (err) {
      console.warn("Fallback to procedural figure:", err);
      buildProceduralFallback();
    }
  }

  function buildProceduralFallback() {
    var skinMat = new THREE.MeshStandardMaterial({ color: 0x2e384d, roughness: 0.7 });
    var sphere = new THREE.SphereGeometry(1, 24, 18);
    
    function addPart(geo, x, y, z, sx, sy, sz) {
      var m = new THREE.Mesh(geo, skinMat);
      m.position.set(x, y, z);
      if (sx !== undefined) m.scale.set(sx, sy, sz);
      body.add(m);
      return m;
    }
    
    addPart(sphere, 0, 1.66, 0, 0.11, 0.13, 0.11); // Head
    addPart(new THREE.CylinderGeometry(0.05, 0.05, 0.12), 0, 1.52, 0); // Neck
    var chest = new THREE.CapsuleGeometry(0.155, 0.35, 8, 20);
    addPart(chest, 0, 1.2, 0).scale.set(1, 1, 0.62); // Torso
    
    buildAcupointEntities(function (p) {
      return { point: p.clone(), normal: new THREE.Vector3(0, 0, 1), dist: 0 };
    });
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

  // --- BUILD ACUPOINT ENTITIES ---
  function buildAcupointEntities(snap) {
    var LIFT = 0.008;

    var whoToOurPoint = {};
    if (window.ACUPOINTS_DATA) {
      window.ACUPOINTS_DATA.forEach(function (p) {
        if (p.who_code) whoToOurPoint[p.who_code.toUpperCase()] = p;
      });
    }

    var sphereGeo = new THREE.SphereGeometry(1, 16, 12);

    // Highly visible glowing emerald material for core points
    var matCore = new THREE.MeshStandardMaterial({
      color: 0x10b981,
      emissive: 0x10b981,
      emissiveIntensity: 0.9,
      roughness: 0.2
    });

    var matOther = new THREE.MeshStandardMaterial({
      color: 0x334155,
      emissive: 0x1e293b,
      emissiveIntensity: 0.2,
      roughness: 0.7
    });

    var processedIds = new Set();

    // 1. Process 14 meridians
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
              var s = snap(targetVec, 0.25);
              if (!s) return;

              var finalPos = s.point.clone().addScaledVector(s.normal, LIFT);
              snappedCurvePoints.push(finalPos);

              if (pt.code) {
                var whoCode = pt.code.toUpperCase();
                var ourPoint = whoToOurPoint[whoCode];

                // Make core points visibly larger on mobile screens (r = 0.016)
                var r = ourPoint ? 0.016 : 0.007;
                var mesh = new THREE.Mesh(sphereGeo, ourPoint ? matCore : matOther);
                mesh.position.copy(finalPos);
                mesh.scale.set(r, r, r);
                mesh.userData = {
                  whoCode: whoCode,
                  side: side,
                  meridianId: m.id,
                  ourPoint: ourPoint,
                  isCore: !!ourPoint,
                  isBack: (finalPos.z < -0.01)
                };

                body.add(mesh);

                if (ourPoint) {
                  corePoints.push(mesh);
                  processedIds.add(ourPoint.id);
                  addHaloRing(finalPos, s.normal);
                } else {
                  allPointMeshes.push(mesh);
                  if (showCoreOnly) mesh.visible = false;
                }

                // Generous hit sphere (r = 0.038) for easy finger taps on mobile!
                var hit = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ visible: false }));
                hit.position.copy(finalPos);
                hit.scale.set(0.038, 0.038, 0.038);
                hit.userData = mesh.userData;
                hit.userData.visualMesh = mesh;
                body.add(hit);
                hitTargets.push(hit);
              }
            });

            // Build glowing meridian tube
            if (snappedCurvePoints.length > 1) {
              try {
                var curve = new THREE.CatmullRomCurve3(snappedCurvePoints);
                var tubeGeo = new THREE.TubeGeometry(curve, snappedCurvePoints.length * 4, 0.0032, 8, false);
                var tubeMat = new THREE.MeshStandardMaterial({
                  color: mColor,
                  emissive: mColor,
                  emissiveIntensity: 0.6,
                  transparent: true,
                  opacity: 0.75,
                  roughness: 0.3
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

    // 2. Ensure ALL remaining points from our 60 points are created!
    if (window.ACUPOINTS_DATA) {
      window.ACUPOINTS_DATA.forEach(function (p) {
        if (!processedIds.has(p.id)) {
          var targetVec;
          if (p.pos_3d) {
            targetVec = new THREE.Vector3(p.pos_3d[0], p.pos_3d[1], p.pos_3d[2]);
          } else {
            // Default based on body part
            if (p.region_id === "head") targetVec = new THREE.Vector3(0, 1.68, 0.08);
            else if (p.region_id === "chest_abdomen") targetVec = new THREE.Vector3(0, 1.25, 0.12);
            else if (p.region_id === "back") targetVec = new THREE.Vector3(0, 1.20, -0.10);
            else if (p.region_id === "arm") targetVec = new THREE.Vector3(0.32, 0.85, 0);
            else targetVec = new THREE.Vector3(0.08, 0.35, 0.05);
          }

          var s = snap(targetVec, 0.35);
          if (s) {
            var finalPos = s.point.clone().addScaledVector(s.normal, LIFT);
            var mesh = new THREE.Mesh(sphereGeo, matCore);
            mesh.position.copy(finalPos);
            mesh.scale.set(0.017, 0.017, 0.017);
            mesh.userData = {
              whoCode: p.who_code,
              side: 1,
              meridianId: "EX",
              ourPoint: p,
              isCore: true,
              isBack: (finalPos.z < -0.01)
            };
            body.add(mesh);
            corePoints.push(mesh);
            processedIds.add(p.id);
            addHaloRing(finalPos, s.normal);

            var hit = new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ visible: false }));
            hit.position.copy(finalPos);
            hit.scale.set(0.040, 0.040, 0.040);
            hit.userData = mesh.userData;
            hit.userData.visualMesh = mesh;
            body.add(hit);
            hitTargets.push(hit);
          }
        }
      });
    }

    console.log("3D Viewer loaded: Total core meshes = " + corePoints.length + ", unique IDs = " + processedIds.size + "/60");
  }

  function addHaloRing(pos, normal) {
    var ringGeo = new THREE.RingGeometry(0.022, 0.028, 20);
    var ringMat = new THREE.MeshBasicMaterial({
      color: 0x34d399,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.6
    });
    var ring = new THREE.Mesh(ringGeo, ringMat);
    ring.position.copy(pos);
    ring.lookAt(pos.clone().add(normal));
    haloMeshGroup.add(ring);
  }

  // --- CAMERA CONTROLS & SIDE TOGGLE ---
  Acu3D.focusRegion = function (presetKey) {
    var p = PRESETS[presetKey] || PRESETS.all;
    camTargetPos.set(p.pos[0], p.pos[1], p.pos[2]);
    camTargetLook.set(p.look[0], p.look[1], p.look[2]);

    if (p.rotY !== undefined) {
      pivot.rotation.y = p.rotY;
    }
    isAnimatingCamera = true;
  };

  Acu3D.setSide = function (side) {
    if (side === "back") {
      pivot.rotation.y = Math.PI;
    } else {
      pivot.rotation.y = 0;
    }
  };

  Acu3D.zoomDelta = function (delta) {
    camera.position.z = Math.max(0.45, Math.min(3.8, camera.position.z + delta));
  };

  Acu3D.resetView = function () {
    pivot.rotation.set(0, 0, 0);
    Acu3D.focusRegion("all");
    if (beaconBeam) beaconBeam.visible = false;
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
          emissive: 0x10b981,
          emissiveIntensity: 0.9
        });
        mesh.scale.set(0.016, 0.016, 0.016);
      } else {
        mesh.material = new THREE.MeshStandardMaterial({
          color: 0x334155,
          emissive: 0x0f172a,
          emissiveIntensity: 0.2
        });
        mesh.scale.set(0.007, 0.007, 0.007);
      }
    });
  };

  // Select point and zoom smoothly to it
  Acu3D.selectPoint = function (whoCode) {
    var target = corePoints.find(function (m) {
      return m.userData.whoCode === whoCode.toUpperCase() ||
             (m.userData.ourPoint && m.userData.ourPoint.id === whoCode);
    });
    if (target) {
      highlightPoint(target);

      // Check if point is on back side
      var p = target.position;
      if (p.z < -0.01) {
        pivot.rotation.y = Math.PI; // Face back
      } else {
        pivot.rotation.y = 0; // Face front
      }

      // Smoothly look at target position
      var worldPos = new THREE.Vector3();
      target.getWorldPosition(worldPos);
      camTargetLook.copy(worldPos);

      // Adjust camera distance for clear close-up
      camTargetPos.set(worldPos.x * 0.3, worldPos.y, (p.z < -0.01 ? -1 : 1) * 0.95);
      isAnimatingCamera = true;

      // Position beacon beam above point
      if (beaconBeam) {
        beaconBeam.position.copy(target.position).add(new THREE.Vector3(0, 0.2, 0));
        beaconBeam.visible = true;
      }
    }
  };

  function highlightPoint(mesh) {
    if (selectedPointMesh) {
      selectedPointMesh.scale.set(0.016, 0.016, 0.016);
    }
    selectedPointMesh = mesh;
    mesh.scale.set(0.026, 0.026, 0.026);
  }

  // --- 3D PINPOINT GAME WITH DIRECTION COMPASS ---
  Acu3D.startFindPointGame = function (targetPoint, onResult) {
    gameTargetPoint = targetPoint;
    onGameResultCallback = onResult;
    if (beaconBeam) beaconBeam.visible = false;
  };

  Acu3D.stopFindPointGame = function () {
    gameTargetPoint = null;
    onGameResultCallback = null;
    if (beaconBeam) beaconBeam.visible = false;
  };

  Acu3D.getTargetDirectionHint = function () {
    if (!gameTargetPoint) return "";
    var targetMesh = corePoints.find(function (m) {
      return (m.userData.ourPoint && m.userData.ourPoint.id === gameTargetPoint.id) ||
             (m.userData.whoCode === gameTargetPoint.who_code);
    });
    if (!targetMesh) return "";

    var isBack = targetMesh.position.z < -0.01;
    var currentAngle = (pivot.rotation.y % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
    var isLookingAtBack = (currentAngle > Math.PI * 0.5 && currentAngle < Math.PI * 1.5);

    if (isBack && !isLookingAtBack) {
      return "🔄 Huyệt ở MẶT SAU lưng! Hãy xoay người 180°";
    } else if (!isBack && isLookingAtBack) {
      return "🔄 Huyệt ở MẶT TRƯỚC! Hãy xoay người ra trước";
    }

    if (targetMesh.position.y < 0.6) {
      return "⬇️ Huyệt ở VÙNG CHÂN / ĐÙI!";
    } else if (targetMesh.position.y > 1.5) {
      return "⬆️ Huyệt ở VÙNG ĐẦU MẶT!";
    }
    return "🔍 Huyệt ở quanh vùng thân trên / tay!";
  };

  // --- TOUCH & POINTER GESTURES ---
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
        var dx = e.clientX - prev.x;
        var dy = e.clientY - prev.y;
        pivot.rotation.y += dx * 0.009;
        pivot.rotation.x = Math.max(-0.6, Math.min(0.6, pivot.rotation.x + dy * 0.007));
      } else if (pointers.size === 2) {
        var pts = Array.from(pointers.values());
        var dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        if (prevPinchDist !== null) {
          var delta = dist - prevPinchDist;
          camera.position.z = Math.max(0.45, Math.min(3.8, camera.position.z - delta * 0.005));
        }
        prevPinchDist = dist;
      }
    });

    function onPointerUp(e) {
      if (canvas.hasPointerCapture(e.pointerId)) {
        canvas.releasePointerCapture(e.pointerId);
      }
      if (!hasMoved && pointerStartPos.has(e.pointerId)) {
        handleRaycast(e.clientX, e.clientY);
      }
      pointers.delete(e.pointerId);
      pointerStartPos.delete(e.pointerId);
      if (pointers.size < 2) prevPinchDist = null;
    }

    canvas.addEventListener("pointerup", onPointerUp);
    canvas.addEventListener("pointercancel", onPointerUp);

    canvas.addEventListener("wheel", function (e) {
      e.preventDefault();
      camera.position.z = Math.max(0.45, Math.min(3.8, camera.position.z + e.deltaY * 0.002));
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

    if (isAutoRotate && pointers.size === 0) {
      pivot.rotation.y += 0.006;
    }

    if (haloMeshGroup) {
      var scale = 1 + Math.sin(Date.now() * 0.0035) * 0.12;
      haloMeshGroup.scale.set(scale, scale, scale);
    }

    renderer.render(scene, camera);
  }

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
