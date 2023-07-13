
import * as THREE from './lib/three.module.min.js';
import * as UTILS from './utils.js';
import {ConvexGeometry} from './lib/geometries/ConvexGeometry.js';
import {PrismGeometry} from './PrismGeometry.js';
import {Connector} from './Connector.js';
import {GLTFLoader} from './lib/loaders/GLTFLoader.js';

class BuildingBlock {
    constructor(name, color, connectors, strandConnectivity, patchNucleotides) {
        this.name = name;

        console.assert(patchNucleotides.length == connectors.length,
            `${name}: patchNucleotides needs to be the same length as connectors`
        )
        this.patchNucleotides = patchNucleotides;

        // Make sure dir and orientation are unit vectors
        this.connectors = connectors.map(e=>{
            let [pos, dir, orientation] = e;
            return [pos, dir.normalize(), orientation.normalize()]
        });

        this.color = color;
        this.material = new THREE.MeshLambertMaterial({
            color: color
        });
        this.connectorMaterial = new THREE.MeshLambertMaterial({
            color: color.clone().addScalar(-0.1)
        });
        this.previewMaterial = new THREE.MeshLambertMaterial({
            color: color,
            opacity: 0.5,
            transparent: true
        });
        let connectorSide = 0.75;

        // Load glTF nucleotide object
        const loader = new GLTFLoader();
        loader.load(`resources/${name}.gltf`, (gltf)=>{
                this.gltfObject = gltf.scene;
            },
            // called while loading is progressing
            function (xhr) {
                console.log((xhr.loaded / xhr.total * 100 ) + '% loaded');
            }
        );

        let connectorBorderPoints = [new THREE.Vector3()];
        //Set points for the base of each connector triangle
        for (const [pos, dir, orientation] of this.connectors) {
            let q1 = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0,0,1), dir
            );
            let angle = UTILS.getSignedAngle(
                new THREE.Vector3(0,1,0), orientation, dir
            );
            let q2 = new THREE.Quaternion().setFromAxisAngle(dir, angle);
            [
                new THREE.Vector3(-connectorSide/3,-connectorSide/2, 0),
                new THREE.Vector3(-connectorSide/3, connectorSide/2, 0),
                new THREE.Vector3(connectorSide/3, connectorSide/2, 0),
                new THREE.Vector3(connectorSide/3, -connectorSide/2, 0),
            ].forEach(corner=>{
                let point = corner.clone();
                point.applyQuaternion(q1);
                point.applyQuaternion(q2);
                point.add(pos.clone().sub(dir.clone().setLength(connectorSide/8)));
                connectorBorderPoints.push(point);
            });
        }
        try {
            this.geometry = new ConvexGeometry(connectorBorderPoints);
        } catch (error) {
            this.geometry = new THREE.BoxGeometry(.75, .75, .75);
        }
        this.shapeObject = new THREE.Mesh(this.geometry, this.material);

        this.connectionGeometry = new PrismGeometry([
            new THREE.Vector2(0, 0),
            new THREE.Vector2(0, connectorSide),
            new THREE.Vector2(connectorSide/4, connectorSide)
        ], connectorSide/2);

        this.connectorsObject = new THREE.Group();
        let connectorIndex = 0;
        for (const [pos, dir, orientation] of this.connectors) {
            let connector = new Connector(pos, dir, orientation, this);
            connector.index = connectorIndex++;
            this.connectorsObject.add(connector);
        }

        const sep = 1;
        this.lineObject = new THREE.Group();
        for (const [e5, e3] of strandConnectivity) {
            let [pos5, dir5, orientation5] = this.connectors[e5];
            let [pos3, dir3, orientation3] = this.connectors[e3];

            let p5 = pos5.clone().add(orientation5.clone().setLength(sep/2));
            let p3 = pos3.clone().add(orientation3.clone().negate().setLength(sep/2));

            let dist = 1/2;

            let line = UTILS.makeLine([
                //p5,
                p5.clone().sub(dir5.clone().setLength(dist)),
                p3.clone().sub(dir3.clone().setLength(dist)),
                p3
            ], new THREE.LineBasicMaterial({color: this.material.color, linewidth: 10}))

            const arrowHelper = new THREE.ArrowHelper(dir5.clone().negate(), p5, dist, 0xF0CE1E, dist/2, dist/2);

            this.lineObject.add(line);
            this.lineObject.add(arrowHelper);
        }

        this.connectorId = 0;
    }

    updateActiveConnectorId() {
        this.connectorId = (this.getActiveConnectorId() + 1) % this.connectors.length
    }

    getActiveConnectorId() {
        return this.connectorId % this.connectors.length;
    }

    createMesh(preview) {
        let block = new THREE.Group();
        block.name = this.name;
        block.buildingBlock = this;

        block.shapeObject = this.shapeObject.clone();
        block.add(block.shapeObject);

        block.gltfObject = this.gltfObject.clone();
        block.add(block.gltfObject);

        block.lineObject = this.lineObject.clone();
        block.add(block.lineObject);

        block.connectorsObject = this.connectorsObject.clone();
        block.add(block.connectorsObject);
        block.connectionCount = () => block.connectorsObject.children.filter(c => c.connection).length;

        if(preview) {
            block.shapeObject.material = this.previewMaterial
            block.connectorsObject.children.forEach(c=>c.material = this.previewMaterial);
        }

        return block;
    };
}

export {BuildingBlock}