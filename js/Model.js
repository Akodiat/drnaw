import * as THREE from './lib/three.module.js';
import * as UTILS from './utils.js';
import {EditHistory} from "./doUndo.js";
import {OxViewSystem} from "./OxviewSystem.js";

class Model {
    rollOverMesh;
    connectors = new Set();
    placedBlocks = new Set()
    oxviewSystem;
    view;
    editHistory = new EditHistory();

    constructor(view) {
        this.view = view;
    }

    removeBuildingBlock(connector) {
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
        this.view.scene.remove(block);
        this.placedBlocks.delete(block);

        // Remove old connectors
        block.connectorsObject.children.forEach(c=>this.connectors.delete(c));

        this.getOxviewSystem().then(sys=>this.view.rebuildStrandview(sys, this));

        this.view.render();
    }

    placeBuildingBlock(buildingBlock, connector, preview) {
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
            b.connectorsObject.children.forEach(c=>this.connectors.add(c));
            this.placedBlocks.add(b);
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
            this.view.scene.add(b);
            this.getOxviewSystem().then(sys=>this.view.rebuildStrandview(sys, this));
            this.view.render();
        } else {
            return b;
        }
    }

    getCoordinateFile() {
        UTILS.saveString(JSON.stringify(
            [...this.placedBlocks].map(block=>{
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

        if (this.oxviewSystem) {
            // If the shape has not changed since we last generated an oxview system
            // (might contain custom sequence)
            console.log("Found existing system "+this.oxviewSystem.getSequence());
            this.oxviewSystem.saveToFile(oxviewFilename);
        } else {
            console.log("Have to regenerate");
            this.getOxviewSystem().then(s=>s.saveToFile(oxviewFilename));
        }
    }

    async getOxviewSystem() {
        let s = new OxViewSystem();
        // Add blocks
        for (const block of this.placedBlocks) {
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
        for (const c of this.connectors) {
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
}

export {Model}