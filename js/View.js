import * as THREE from './lib/three.module.min.js';
import {OrbitControls} from './lib/OrbitControls.js';
import {buildingBlocks} from './buildingBlocks.js';

class View {

    camera;
    scene;
    canvas;
    renderer;
    raycaster;
    orbitControls;
    removeMaterial;

    constructor(
        onDocumentMouseMove,
        onDocumentMouseDown,
        canvasId="threeCanvas",
        paletteId = "palette"
    ) {
        this.camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 1, 10000);
        this.camera.position.set(2, 3, 5);
        this.camera.lookAt(0, 0, 0);

        this.scene = new THREE.Scene();
        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        // lights
        let ambientLight = new THREE.AmbientLight(0x606060);
        this.scene.add(ambientLight);

        let directionalLight = new THREE.DirectionalLight(0xffffff);
        directionalLight.position.set(1, 0.75, 0.5).normalize();
        this.scene.add(directionalLight);

        this.removeMaterial = new THREE.MeshLambertMaterial({
            color: new THREE.Color(.9,.1,.1),
            opacity: 0.5,
            transparent: true
        });

        this.canvas = document.getElementById(canvasId);
        this.renderer = new THREE.WebGLRenderer({
            antialias: true,
            canvas: this.canvas,
            alpha: true,
            preserveDrawingBuffer: true
        });
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setClearColor(0x000000, 0);
        document.body.appendChild(this.renderer.domElement);

        window.addEventListener('resize', ()=>this.onWindowResize(), false);
        document.body.appendChild(this.renderer.domElement);

        this.canvas.addEventListener('pointermove', onDocumentMouseMove, false);
        this.canvas.addEventListener('pointerdown', onDocumentMouseDown, false);


        // orbit controls
        this.orbitControls = new OrbitControls(this.camera, this.canvas);
        this.orbitControls.damping = 0.2;
        this.orbitControls.addEventListener('change', ()=>this.render());

        let palette = document.getElementById(paletteId);
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

    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    render() {
        this.renderer.render(this.scene, this.camera);
    }

    rebuildStrandview(sys, model) {
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
            model.oxviewSystem = sys;
        } else {
            strandCountElem.innerHTML = sys.strands.length + " strands";
            strandView.style.display = "none";
            model.oxviewSystem = undefined;
        }
    }

    getActiveBuildingBlock() {
        const name = document.querySelector('input[name="buildingBlock"]:checked').value;
        return buildingBlocks.find(b => b.name == name);
    }
}

export {View}