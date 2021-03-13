import * as THREE from './lib/three.module.js';
import * as UTILS from './utils.js';
import {OrbitControls} from './lib/OrbitControls.js';
import {buildingBlocks} from './buildingBlocks.js';
import {OxViewSystem} from './oxviewIO.js';
import {EditHistory, RevertableEdit} from './doUndo.js'

let camera, scene, renderer;
let mouse, raycaster;

let rollOverMesh;
let removeMaterial;

let orbitControls;

let connectors = new Set();
let placedBlocks = new Set()
let oxviewSystem;
let editHistory = new EditHistory();


init();
render();

function getCoordinateFile() {

    UTILS.saveString(JSON.stringify(
        [...placedBlocks].map(block=>{
            return {
                'name': block.name,
                'position': block.position.toArray(),
                'orientation': block.getWorldQuaternion(new THREE.Quaternion()).toArray()
            }
        }), undefined, 2    // Indent
        ).replace(          // But not too much
            /(".+": \[)([^\]]+)/g, (_, a, b) => a + b.replace(/\s+/g, ' ')
        ), 'buildingBlocks.json'
    );

    let oxviewFilename = "output.oxview";

    if (oxviewSystem) {
        // If the shape has not changed since we last generated an oxview system
        // (might contain custom sequence)
        console.log("Found existing system "+oxviewSystem.getSequence());
        oxviewSystem.saveToFile(oxviewFilename);
    } else {
        console.log("Have to regenerate");
        getOxviewSystem().then(s=>s.saveToFile(oxviewFilename));
    }

}

async function getOxviewSystem() {
    let s = new OxViewSystem();
    // Add blocks
    for (const block of placedBlocks) {
        const data = await UTILS.getJSON(`resources/${block.name}.oxview`);
        s.addFromJSON(
            data,
            block.position,
            block.getWorldQuaternion(new THREE.Quaternion()),
            block.uuid
        );
    }
    // Connect blocks together
    let done = new Set(); // If we connect a to b we don't need to connect b to a
    for (const c of connectors) {
        if(c.connection && !done.has(c)) {
            s.connectBuildingBlocks(
                c.getBlock(), c.index,
                c.connection.getBlock(), c.connection.index
            );
            done.add(c);
            done.add(c.connection);
        }
    }
    return s;
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

    removeMaterial = new THREE.MeshLambertMaterial({
        color: new THREE.Color(.9,.1,.1),
        opacity: 0.5,
        transparent: true
    });

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

    canvas.addEventListener('pointermove', onDocumentMouseMove, false);
    canvas.addEventListener('pointerdown', onDocumentMouseDown, false);
    window.addEventListener('resize', onWindowResize, false);

    document.addEventListener("keydown", event => {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 's':
                    event.preventDefault();
                    getCoordinateFile();
                    break;
                case 'z':
                    if(event.shiftKey) {
                        editHistory.redo();
                    } else {
                        editHistory.undo();
                    }
                    break;
                case 'y':
                    editHistory.redo();
                    break;
                default:
                    break;
            }
        }

    });

    document.getElementById("saveButton").onclick = getCoordinateFile;
    document.getElementById("undoButton").onclick = ()=>editHistory.undo();
    document.getElementById("redoButton").onclick = ()=>editHistory.redo();

    document.getElementById("showShapes").onchange = updateVisibility;
    document.getElementById("showNucleotides").onchange = updateVisibility;

    document.getElementById("sequence").oninput = (e)=>{
        if(oxviewSystem && oxviewSystem.strands.length == 1) {
            let s = e.target.value;
            if (oxviewSystem.strands[0].monomers.length == s.length) {
                oxviewSystem.setSequence(s);
                document.getElementById("dotBracket").style.fontWeight = 'bold';
            }
        }
    }

    // orbit controls
    orbitControls = new OrbitControls(camera, canvas);
    orbitControls.damping = 0.2;
    orbitControls.addEventListener('change', render);

    let palette = document.getElementById('palette');
    buildingBlocks.forEach((b,i)=>{
        let l = document.createElement('label');
        //l.for = e.id;
        l.style.background = '#'+b.color.getHexString();

        let e = document.createElement('input');
        e.type = 'radio';
        e.name = 'buildingBlock'
        e.value = b.name;
        e.id = 'b.name'+i;
        e.checked = i==0;
        l.append(e);
        l.append(b.name);

        palette.append(l);
    });
}

function getActiveBuildingBlock() {
    const name = document.querySelector('input[name="buildingBlock"]:checked').value;
    return buildingBlocks.find(b => b.name == name);
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
            console.log(connector.index);
            // If we have already connected a building block, but it is not connected
            // further, replace it at another orientation
            if (connector.connection && (connector.connection.getBlock().connectionCount() == 1)) {
                let b = connector.connection.getBlock().buildingBlock;
                rollOverMesh = placeBuildingBlock(b, connector, true);
                rollOverMesh.scale.multiplyScalar(1.01);
                UTILS.setMaterialRecursively(rollOverMesh, removeMaterial);
                scene.add(rollOverMesh);
            }
            if (!connector.connection) {
                rollOverMesh = placeBuildingBlock(getActiveBuildingBlock(), connector, true);
                scene.add(rollOverMesh);
            }
            //showHoverInfo(new THREE.Vector2(event.clientX, event.clientY), connector);
            document.body.style.cursor = 'pointer';
        } else {
            scene.remove(rollOverMesh);
            rollOverMesh = undefined;
            document.body.style.cursor = 'auto';
            //hideHoverInfo();
        }
    }

    render();
}

function onDocumentMouseDown(event) {
    event.preventDefault();
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
                    if (connector.connection.getBlock().connectionCount() == 1) {
                        editHistory.do(new RevertableDeletion(connector));
                        //removeBuildingBlock(connector);
                        console.log("Replacing building block");
                        getActiveBuildingBlock().updateActiveConnectorId();
                    } else {
                        console.log("Cannot replace connected building block")
                    }
                } else {
                    editHistory.do(new RevertableAddition(getActiveBuildingBlock(), connector));
                }
            }
        } else {
            document.getElementById("initprompt").style.display = 'none';
            editHistory.do(new RevertableAddition(getActiveBuildingBlock()));
        }
        render();
    }
}

function rebuildStrandview() {
    getOxviewSystem().then(sys=>{
        let strandCountElem = document.getElementById("strandCount");
        let dotBracketElem = document.getElementById("dotBracket");
        let sequenceElem = document.getElementById("sequence");
        let strandView = document.getElementById("strandView");
        if (sys.strands.length == 1) {
            strandCountElem.innerHTML = '<span style="color:#4db34d">1 strand</span>';
            dotBracketElem.innerHTML = sys.getDotBracket();
            dotBracketElem.style.fontWeight = 'normal';
            strandView.style.display = "block";
            sequenceElem.value = sys.getSequence();
            oxviewSystem = sys;
        } else {
            strandCountElem.innerHTML = sys.strands.length + " strands";
            strandView.style.display = "none";
            oxviewSystem = undefined;
        }
    });
}

function updateVisibility() {
    placedBlocks.forEach(b=>{
        b.gltfObject.visible = document.getElementById('showNucleotides').checked;
        b.shapeObject.visible = document.getElementById('showShapes').checked;
    })
    render();
}

function removeBuildingBlock(connector) {
    let block;
    if(connector) {
        block = connector.connection.getBlock();
        connector.connection = undefined;
    } else if (placedBlocks.size == 1)  {
        block = [...placedBlocks][0]
    } else {
        throw "Don't know which block to remove"
    }

    // Remove block
    scene.remove(block);
    placedBlocks.delete(block);

    // Remove old connectors
    block.connectorsObject.children.forEach(c=>connectors.delete(c));

    rebuildStrandview();

    render();
}

function placeBuildingBlock(buildingBlock, connector, preview) {
    let pos = new THREE.Vector3();
    if (connector) {
        // Set position relative to previous connector
        connector.getWorldPosition(pos);
    }

    let b = buildingBlock.createMesh(preview);
    b.gltfObject.visible = document.getElementById('showNucleotides').checked;
    b.shapeObject.visible = document.getElementById('showShapes').checked;
    b.position.copy(pos);

    if (!preview) {
        b.connectorsObject.children.forEach(c=>connectors.add(c));
        placedBlocks.add(b);
    }

    if (connector) {
        let connectedConnector = b.connectorsObject.children[buildingBlock.getActiveConnectorId()];

        if (!preview) {
            // Make connection between the two connectors
            connectedConnector.connection = connector;
            connector.connection = connectedConnector;
        }

        // Set orientation such that the new connector of specified
        // id faces the old connector
        let q1 = new THREE.Quaternion().setFromUnitVectors(
            connectedConnector.getDir(),
            connector.getDir().negate()
        );

        b.applyQuaternion(q1);

        console.assert(connectedConnector.getDir().distanceTo(connector.getDir().negate()) < 0.01, "Not coaxial!");

        // This is sooo ugly, why doesn't it work on the first try?
        while(true) {
            // Set orientation such that the two connectors are aligned
            let angle = UTILS.getSignedAngle(
                connectedConnector.getOrientation(),
                connector.getOrientation().negate(),
                connector.getDir().negate()
            );

            if (Math.abs(angle) < 0.01) {
                break;
            }

            let q2 = new THREE.Quaternion().setFromAxisAngle(connector.getDir().negate(), angle);
            b.applyQuaternion(q2);
        }

        b.position.sub(connectedConnector.getPos());
    }
    if (!preview) {
        scene.add(b);
        rebuildStrandview();
        render();
    } else {
        return b;
    }
}

function render() {
    renderer.render(scene, camera);
}

class RevertableAddition extends RevertableEdit {
    constructor(buildingBlock, connector) {
        const b = buildingBlock;
        const c = connector;
        let undo = function () {removeBuildingBlock(c)};
        let redo = function () {placeBuildingBlock(b, c, false)};
        super(undo, redo);
    }
}

class RevertableDeletion extends RevertableEdit {
    constructor(connector) {
        const c = connector;
        const b = c.connection.buildingBlock;
        let undo = function () {placeBuildingBlock(b, c, false)};
        let redo = function () {removeBuildingBlock(c)};
        super(undo, redo);
    }
}