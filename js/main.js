import * as THREE from './lib/three.module.js';
import {OrbitControls} from './lib/OrbitControls.js';
import {buildingBlocks} from './buildingBlocks.js'

let camera, scene, renderer;
let mouse, raycaster;

let rollOverMesh;

let orbitControls;

let connectors = new Set();
let connectorId = 0;

init();
render();


function saveString(text, filename) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function init() {
    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
    camera.position.set(2, 3, 5);
    camera.lookAt(0, 0, 0);

    scene = new THREE.Scene();
    raycaster = new THREE.Raycaster();
    mouse = new THREE.Vector2();

    // lights
    let ambientLight = new THREE.AmbientLight(0x606060);
    scene.add(ambientLight);

    let directionalLight = new THREE.DirectionalLight(0xffffff);
    directionalLight.position.set(1, 0.75, 0.5).normalize();
    scene.add(directionalLight);

    let canvas = document.getElementById("threeCanvas");
    renderer = new THREE.WebGLRenderer({
        antialias: true,
        canvas: canvas,
        alpha: true,
        preserveDrawingBuffer: true
    });
    renderer.setPixelRatio(window.devicePixelRatio);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x000000, 0);
    document.body.appendChild(renderer.domElement);

    window.addEventListener('resize', onWindowResize, false);
    document.body.appendChild(renderer.domElement);

    canvas.addEventListener('mousemove', onDocumentMouseMove, false);
    canvas.addEventListener('click', onDocumentMouseDown, false);
    window.addEventListener('resize', onWindowResize, false);

    document.addEventListener("keydown", event => {
        if (event.key == 's' && event.ctrlKey) {
            event.preventDefault();
            this.getCoordinateFile();
        }
    });

    // orbit controls
    orbitControls = new OrbitControls(camera, canvas);
    orbitControls.damping = 0.2;
    orbitControls.addEventListener('change', render);

    let palette = document.getElementById('palette');
    buildingBlocks.forEach((b,i)=>{
        let e = document.createElement('input');
        e.type = 'radio';
        e.name = 'buildingBlock'
        e.value = b.name;
        e.id = 'b.name'+i;
        e.index = i;
        e.checked = i==0;
        palette.append(e);

        let l = document.createElement('label');
        l.for = e.id;
        l.style.background = '#'+b.color.getHexString();
        l.innerHTML = b.name;

        palette.append(l);
    });
}

function getActiveBuildingBlock() {
    return buildingBlocks[document.querySelector('input[name="buildingBlock"]:checked').index];
}

function getActiveConnectorId() {
    return connectorId % getActiveBuildingBlock().connectors.length;
}

function getNextActiveConnectorId() {
    return (getActiveConnectorId() + 1) % getActiveBuildingBlock().connectors.length;
}

function updateActiveConnectorId() {
    connectorId = getNextActiveConnectorId();
}

function getSignedAngle(v1, v2, axis) {
    let s = v1.clone().cross(v2);
    let c = v1.clone().dot(v2);
    let a = Math.atan2(s.length(), c);
    if (!s.equals(axis)) {
        a *= -1;
    }
    return a;
}

function onWindowResize() {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();

    renderer.setSize(window.innerWidth, window.innerHeight);
}

function onDocumentMouseMove(event) {
    event.preventDefault();
    mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    raycaster.setFromCamera(mouse, camera);

    if(connectors.size > 0) {
        let intersects = raycaster.intersectObjects([...connectors]);
        if (intersects.length > 0) {
            scene.remove(rollOverMesh);
            let connector = intersects[0].object;
            // If we have already connected a building block, but it is not connected
            // further, replace it at another orientation
            if (connector.connection && (connector.connection.connectionCount() == 1)) {
                rollOverMesh = createBuildingBlock(connector, true, getNextActiveConnectorId());
                rollOverMesh.scale.multiplyScalar(1.2);
                scene.add(rollOverMesh);
            }
            if (!connector.connection) {
                rollOverMesh = createBuildingBlock(connector, true);
                scene.add(rollOverMesh);
            }
        } else {
            scene.remove(rollOverMesh);
            rollOverMesh = undefined;
        }
    }
    
    render();
}

function onDocumentMouseDown(event) {
    if (event.button == 0) {
        if(connectors.size > 0) {
            event.preventDefault();
            mouse.set((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
            raycaster.setFromCamera(mouse, camera);
            let intersects = raycaster.intersectObjects([...connectors]);
            if (intersects.length > 0) {
                let connector = intersects[0].object;
                // If we have already connected a building block, but it is not connected
                // further, replace it at another orientation
                if (connector.connection) {
                    if (connector.connection.connectionCount() == 1) {
                        scene.remove(connector.connection);
                        // Remove old connectors
                        connector.connection.children.forEach(c=>connectors.delete(c));
                        updateActiveConnectorId();
                        connector.connection = undefined;
                        console.log("Replacing building block")
                    } else {
                        console.log("Cannot replace connected building block")
                    }
                } else {
                    let buildingBlock = createBuildingBlock(connector)
                    scene.add(buildingBlock);
                }
            }
        } else {
            document.getElementById("initprompt").style.display = 'none';
            scene.add(createBuildingBlock());
        }
        render();
    }
}

function createBuildingBlock(connector, preview, connectorId) {
    if (connectorId === undefined) {
        connectorId = getActiveConnectorId();
    }
    let pos = new THREE.Vector3();
    if (connector) {
        // Set position relative to previous connector
        connector.getWorldPosition(pos);
        pos.add(connector.getDir());
    }

    let b = getActiveBuildingBlock().getMesh(preview);
    b.position.copy(pos);

    if (!preview) {
        b.children.forEach(c=>connectors.add(c));
    }

    if (connector) {
        let connectedConnector = b.children[connectorId];

        if (!preview) {
            // Make connection between the two connectors
            connectedConnector.connection = connector.parent;
            connector.connection = b;
        }

        // Set orientation such that the new connector of specified
        // id faces the old connector
        let q1 = new THREE.Quaternion().setFromUnitVectors(
            connectedConnector.getDir().normalize(),
            connector.getDir().negate().normalize()
        );
        b.applyQuaternion(q1);

        // Set orientation such that the two connectors are aligned
        let angle = getSignedAngle(
            connector.getOrientation().normalize(),
            connectedConnector.getOrientation().negate().normalize(),
            connector.getDir()
        )
        let q2 = new THREE.Quaternion().setFromAxisAngle(connector.getDir(), angle);
        b.applyQuaternion(q2);

    }
    return b;
}

function render() {
    renderer.render(scene, camera);
}