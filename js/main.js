import * as THREE from './lib/three.module.min.js';
import * as UTILS from './utils.js';
import {View} from './View.js';
import {Model} from './Model.js';
import {RevertableEdit} from './doUndo.js';

let saveButtonId = "saveButton";
let undoButtonId = "undoButton";
let redoButtonId = "redoButton";
let showShapesToggleId = "showShapes";
let showNucleotidesToggleId = "showNucleotides";
let sequenceInputId = "sequence";
let dotBracketId = "dotBracket";

let view, model;

function init() {
    view = new View(onDocumentMouseMove, onDocumentMouseDown);
    model = new Model(view);

    document.addEventListener("keydown", event => {
        if (event.ctrlKey || event.metaKey) {
            switch (event.key.toLowerCase()) {
                case 's':
                    event.preventDefault();
                    model.getCoordinateFile();
                    break;
                case 'z':
                    if(event.shiftKey) {
                        model.editHistory.redo();
                    } else {
                        model.editHistory.undo();
                    }
                    break;
                case 'y':
                    model.editHistory.redo();
                    break;
                default:
                    break;
            }
        }

    });

    document.getElementById(saveButtonId).onclick = () => model.getCoordinateFile();
    document.getElementById(undoButtonId).onclick = () => model.editHistory.undo();
    document.getElementById(redoButtonId).onclick = () => model.editHistory.redo();

    const updateVisibility = () => {
        model.placedBlocks.forEach(b=>{
            b.shapeObject.visible = document.getElementById('showShapes').checked;
        })
        view.render();
    }

    document.getElementById(showShapesToggleId).onchange = updateVisibility;

    document.getElementById(sequenceInputId).oninput = (e)=>{
        if(model.oxviewSystem && model.oxviewSystem.strands.length == 1) {
            let s = e.target.value;
            if (model.oxviewSystem.strands[0].monomers.length == s.length) {
                model.oxviewSystem.setSequence(s);
                document.getElementById(dotBracketId).style.fontWeight = 'bold';
            }
        }
    }
    view.render();
}

function onDocumentMouseMove(event) {
    event.preventDefault();
    const mouse = new THREE.Vector2((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
    view.raycaster.setFromCamera(mouse, view.camera);

    if(model.connectors.size > 0) {
        let intersects = view.raycaster.intersectObjects([...model.connectors]);
        if (intersects.length > 0) {
            view.scene.remove(model.rollOverMesh);
            let connector = intersects[0].object;
            console.log(connector.index);
            // If we have already connected a building block, but it is not connected
            // further, replace it at another orientation
            if (connector.connection && (connector.connection.getBlock().connectionCount() == 1)) {
                let b = connector.connection.getBlock();
                model.rollOverMesh = model.placeBuildingBlock(b, connector, true);
                model.rollOverMesh.scale.multiplyScalar(1.01);
                UTILS.setMaterialRecursively(model.rollOverMesh, view.removeMaterial);
                view.scene.add(model.rollOverMesh);
            }
            if (!connector.connection) {
                model.rollOverMesh = model.placeBuildingBlock(view.getActiveBuildingBlock(), connector, true);
                view.scene.add(model.rollOverMesh);
            }
            //showHoverInfo(new THREE.Vector2(event.clientX, event.clientY), connector);
            document.body.style.cursor = 'pointer';
        } else {
            view.scene.remove(model.rollOverMesh);
            model.rollOverMesh = undefined;
            document.body.style.cursor = 'auto';
            //hideHoverInfo();
        }
    }

    view.render();
}

function onDocumentMouseDown(event) {
    event.preventDefault();
    if (event.button == 0) {
        if(model.connectors.size > 0) {
            event.preventDefault();
            const mouse = new THREE.Vector2((event.clientX / window.innerWidth) * 2 - 1, -(event.clientY / window.innerHeight) * 2 + 1);
            view.raycaster.setFromCamera(mouse, view.camera);
            let intersects = view.raycaster.intersectObjects([...model.connectors]);
            if (intersects.length > 0) {
                let connector = intersects[0].object;
                // If we have already connected a building block, but it is not connected
                // further, replace it at another orientation
                if (connector.connection) {
                    if (connector.connection.getBlock().connectionCount() == 1) {
                        model.editHistory.do(new RevertableDeletion(connector, model));
                        //removeBuildingBlock(connector);
                        console.log("Replacing building block");
                        view.getActiveBuildingBlock().updateActiveConnectorId();
                    } else {
                        console.log("Cannot replace connected building block")
                    }
                } else {
                    model.editHistory.do(new RevertableAddition(view.getActiveBuildingBlock(), connector, model));
                }
            }
        } else {
            document.getElementById("initprompt").style.display = 'none';
            model.editHistory.do(new RevertableAddition(view.getActiveBuildingBlock(), undefined, model));
        }
        view.render();
    }
}

class RevertableAddition extends RevertableEdit {
    constructor(buildingBlock, connector, model) {
        const b = buildingBlock;
        const c = connector;
        let undo = () => {model.removeBuildingBlock(c)};
        let redo = () => {model.placeBuildingBlock(b, c, false)};
        super(undo, redo);
    }
}

class RevertableDeletion extends RevertableEdit {
    constructor(connector, model) {
        const c = connector;
        const b = c.connection.buildingBlock;
        let undo = () => {model.placeBuildingBlock(b, c, false)};
        let redo = () => {model.removeBuildingBlock(c)};
        super(undo, redo);
    }
}


init();