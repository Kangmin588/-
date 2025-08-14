import * as THREE from 'https://unpkg.com/three@0.160.0/build/three.module.js';
import { DeviceOrientationControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/DeviceOrientationControls.js';
import { OrbitControls } from 'https://unpkg.com/three@0.160.0/examples/jsm/controls/OrbitControls.js';

const canvas = document.getElementById('scene');
const enableSensorsBtn = document.getElementById('enableSensorsBtn');
const demoModeBtn = document.getElementById('demoModeBtn');
const calibrateBtn = document.getElementById('calibrateBtn');
const resetBtn = document.getElementById('resetBtn');
const locationText = document.getElementById('locationText');
const timeText = document.getElementById('timeText');
const sensorStatus = document.getElementById('sensorStatus');
const modeStatus = document.getElementById('modeStatus');
const yawOffsetSlider = document.getElementById('yawOffset');
const yawOffsetVal = document.getElementById('yawOffsetVal');

let renderer, scene, camera;
let deviceControls = null;
let orbitControls = null;
let starsPoints = null;
let starCatalog = [];
let useDeviceOrientation = false;
let yawOffsetRad = 0;
let observerLatitudeDeg = 37.5665; // Default: Seoul
let observerLongitudeDeg = 126.9780; // Default: Seoul
let lastPositionUpdateMs = 0;
let lastStarRecomputeMs = 0;

init();

async function init() {
	setupRenderer();
	setupScene();
	setupCamera();
	setupEventHandlers();
	await loadStars();
	setupStarsLayer();
	await tryGetGeolocation();
	animate();
}

function setupRenderer() {
	renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
	renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
	resize();
	window.addEventListener('resize', resize);
}

function setupScene() {
	scene = new THREE.Scene();
	const ambient = new THREE.AmbientLight(0xffffff, 0.6);
	scene.add(ambient);
	// Subtle galactic background gradient using a big sphere
	const skyGeo = new THREE.SphereGeometry(1000, 32, 32);
	const skyMat = new THREE.MeshBasicMaterial({ color: 0x000510, side: THREE.BackSide, depthWrite: false });
	scene.add(new THREE.Mesh(skyGeo, skyMat));
}

function setupCamera() {
	camera = new THREE.PerspectiveCamera(65, window.innerWidth / window.innerHeight, 0.1, 5000);
	camera.position.set(0, 0, 0.1);
	camera.lookAt(new THREE.Vector3(0, 0, -1));
	// Default to Orbit controls for desktops until sensor is enabled
	orbitControls = new OrbitControls(camera, renderer.domElement);
	orbitControls.enableDamping = true;
	orbitControls.enablePan = false;
	orbitControls.minDistance = 0.1;
	orbitControls.maxDistance = 0.1;
	orbitControls.update();
	modeStatus.textContent = '데모(마우스)';
}

function setupEventHandlers() {
	enableSensorsBtn.addEventListener('click', onEnableSensors);
	demoModeBtn.addEventListener('click', enableDemoMode);
	calibrateBtn.addEventListener('click', calibrateNorth);
	resetBtn.addEventListener('click', () => {
		yawOffsetRad = 0;
		yawOffsetSlider.value = 0;
		yawOffsetVal.textContent = '0';
		if (deviceControls) deviceControls.alphaOffset = 0;
	});
	yawOffsetSlider.addEventListener('input', () => {
		const deg = Number(yawOffsetSlider.value);
		yawOffsetVal.textContent = String(deg);
		yawOffsetRad = THREE.MathUtils.degToRad(deg);
		if (deviceControls) deviceControls.alphaOffset = yawOffsetRad;
	});
}

async function loadStars() {
	const res = await fetch('./stars.json');
	starCatalog = await res.json();
}

function setupStarsLayer() {
	const geometry = new THREE.BufferGeometry();
	const positions = new Float32Array(starCatalog.length * 3);
	const colors = new Float32Array(starCatalog.length * 3);

	for (let i = 0; i < starCatalog.length; i++) {
		positions[i * 3 + 0] = 0;
		positions[i * 3 + 1] = 0;
		positions[i * 3 + 2] = 0;
		const brightness = magnitudeToBrightness(starCatalog[i].mag);
		colors[i * 3 + 0] = brightness;
		colors[i * 3 + 1] = brightness * 0.95;
		colors[i * 3 + 2] = 1.0;
	}

	geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
	geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));

	const material = new THREE.PointsMaterial({
		size: 6,
		sizeAttenuation: true,
		vertexColors: true,
		transparent: true,
		opacity: 0.95,
		depthWrite: false
	});

	starsPoints = new THREE.Points(geometry, material);
	scene.add(starsPoints);
}

function resize() {
	const w = window.innerWidth;
	const h = window.innerHeight;
	renderer.setSize(w, h, false);
	if (camera) {
		camera.aspect = w / h;
		camera.updateProjectionMatrix();
	}
}

async function onEnableSensors() {
	try {
		// iOS permission flow
		if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
			const response = await DeviceOrientationEvent.requestPermission();
			if (response !== 'granted') {
				alert('센서 권한이 필요합니다. 설정에서 권한을 허용해 주세요.');
				return;
			}
		}
		useDeviceOrientation = true;
		if (orbitControls) {
			orbitControls.dispose();
			orbitControls = null;
		}
		deviceControls = new DeviceOrientationControls(camera);
		deviceControls.alphaOffset = yawOffsetRad;
		sensorStatus.textContent = '활성';
		modeStatus.textContent = '센서(기기 방향)';
	} catch (err) {
		console.error(err);
		alert('센서를 사용할 수 없습니다. 데모 모드를 사용하세요.');
	}
}

function enableDemoMode() {
	useDeviceOrientation = false;
	if (deviceControls) {
		deviceControls.disconnect();
		deviceControls.dispose();
		deviceControls = null;
	}
	if (!orbitControls) {
		orbitControls = new OrbitControls(camera, renderer.domElement);
		orbitControls.enableDamping = true;
		orbitControls.enablePan = false;
		orbitControls.minDistance = 0.1;
		orbitControls.maxDistance = 0.1;
	}
	sensorStatus.textContent = '비활성';
	modeStatus.textContent = '데모(마우스)';
}

function calibrateNorth() {
	if (!useDeviceOrientation || !deviceControls) return;
	// Align current camera yaw to 0 (north)
	const euler = new THREE.Euler().setFromQuaternion(camera.quaternion, 'YXZ');
	const currentYaw = euler.y; // yaw around Y
	const offset = -currentYaw;
	yawOffsetRad += offset;
	deviceControls.alphaOffset = yawOffsetRad;
	yawOffsetSlider.value = String(Math.round(THREE.MathUtils.radToDeg(yawOffsetRad)));
	yawOffsetVal.textContent = String(Math.round(THREE.MathUtils.radToDeg(yawOffsetRad)));
}

async function tryGetGeolocation() {
	if (!('geolocation' in navigator)) {
		locationText.textContent = 'Geolocation 미지원. 기본(서울) 사용';
		return;
	}
	return new Promise((resolve) => {
		navigator.geolocation.getCurrentPosition((pos) => {
			observerLatitudeDeg = pos.coords.latitude;
			observerLongitudeDeg = pos.coords.longitude;
			locationText.textContent = `${observerLatitudeDeg.toFixed(4)}°, ${observerLongitudeDeg.toFixed(4)}°`;
			resolve();
		}, (err) => {
			console.warn('위치 가져오기 실패:', err);
			locationText.textContent = '위치 거부됨. 기본(서울) 사용';
			resolve();
		}, { enableHighAccuracy: true, maximumAge: 30_000, timeout: 8_000 });
	});
}

function animate(nowMs) {
	reqAnimationFrame(animate);
	const now = new Date();
	if (deviceControls) deviceControls.update();
	if (orbitControls) orbitControls.update();

	// Update UI time text once per second
	if (!lastPositionUpdateMs || nowMs - lastPositionUpdateMs > 500) {
		timeText.textContent = now.toLocaleString();
		lastPositionUpdateMs = nowMs;
	}

	// Recompute star positions around twice per second
	if (!lastStarRecomputeMs || nowMs - lastStarRecomputeMs > 500) {
		updateStarsPositions(now);
		lastStarRecomputeMs = nowMs;
	}

	renderer.render(scene, camera);
}

const reqAnimationFrame = (cb) => (window.requestAnimationFrame || window.webkitRequestAnimationFrame || function (f) { return setTimeout(() => f(performance.now()), 16); })(cb);

function updateStarsPositions(date) {
	if (!starsPoints) return;
	const positions = starsPoints.geometry.getAttribute('position');
	for (let i = 0; i < starCatalog.length; i++) {
		const star = starCatalog[i];
		const { azimuthRad, altitudeRad } = equatorialToHorizontal(star.raHours, star.decDeg, observerLatitudeDeg, observerLongitudeDeg, date);
		const v = horizontalToWorldVector(azimuthRad, altitudeRad);
		positions.array[i * 3 + 0] = v.x * 500; // Large radius for parallax-free look
		positions.array[i * 3 + 1] = v.y * 500;
		positions.array[i * 3 + 2] = v.z * 500;
	}
	positions.needsUpdate = true;
}

function magnitudeToBrightness(mag) {
	// Convert visual magnitude to [0..1] brightness (approx)
	const minMag = -1.46; // Sirius
	const maxMag = 2.5;
	const normalized = 1 - Math.min(Math.max((mag - minMag) / (maxMag - minMag), 0), 1);
	return 0.4 + 0.6 * Math.pow(normalized, 1.6);
}

// Astronomy math
function equatorialToHorizontal(raHours, decDeg, latDeg, lonDeg, date) {
	const raRad = hoursToRad(raHours);
	const decRad = THREE.MathUtils.degToRad(decDeg);
	const latRad = THREE.MathUtils.degToRad(latDeg);
	const lstRad = localSiderealTimeRad(date, lonDeg);
	let hourAngleRad = wrapRad(lstRad - raRad);

	const sinAlt = Math.sin(decRad) * Math.sin(latRad) + Math.cos(decRad) * Math.cos(latRad) * Math.cos(hourAngleRad);
	const altitudeRad = Math.asin(sinAlt);
	const y = -Math.cos(decRad) * Math.sin(hourAngleRad);
	const x = Math.sin(decRad) * Math.cos(latRad) - Math.cos(decRad) * Math.sin(latRad) * Math.cos(hourAngleRad);
	const azimuthRad = wrapRad(Math.atan2(y, x)); // 0=N, +E
	return { azimuthRad, altitudeRad };
}

function horizontalToWorldVector(azimuthRad, altitudeRad) {
	// ENU to Three.js world: X=East, Y=Up, Z=-North
	const east = Math.cos(altitudeRad) * Math.sin(azimuthRad);
	const north = Math.cos(altitudeRad) * Math.cos(azimuthRad);
	const up = Math.sin(altitudeRad);
	return new THREE.Vector3(east, up, -north).normalize();
}

function localSiderealTimeRad(date, lonDeg) {
	// Compute GMST using simple approximation then add longitude
	const jd = julianDate(date);
	const t = (jd - 2451545.0) / 36525.0;
	let gmstHours = 6.697374558 + 2400.051336 * t + 0.000025862 * t * t + (date.getUTCHours() + date.getUTCMinutes() / 60 + date.getUTCSeconds() / 3600) * 1.0027379093;
	gmstHours = ((gmstHours % 24) + 24) % 24;
	const lstHours = gmstHours + lonDeg / 15.0;
	const lstRad = hoursToRad(((lstHours % 24) + 24) % 24);
	return lstRad;
}

function julianDate(date) {
	const Y = date.getUTCFullYear();
	const M = date.getUTCMonth() + 1;
	const D = date.getUTCDate();
	let a = Math.floor((14 - M) / 12);
	let y = Y + 4800 - a;
	let m = M + 12 * a - 3;
	let JDN = D + Math.floor((153 * m + 2) / 5) + 365 * y + Math.floor(y / 4) - Math.floor(y / 100) + Math.floor(y / 400) - 32045;
	let dayFraction = (date.getUTCHours() - 12) / 24 + date.getUTCMinutes() / 1440 + date.getUTCSeconds() / 86400 + date.getUTCMilliseconds() / 86400000;
	return JDN + dayFraction;
}

function hoursToRad(hours) {
	return hours * (Math.PI / 12);
}

function wrapRad(a) {
	const twoPi = Math.PI * 2;
	return ((a % twoPi) + twoPi) % twoPi;
}