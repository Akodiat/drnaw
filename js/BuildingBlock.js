
import * as THREE from './lib/three.module.min.js';
import * as UTILS from './utils.js';
import {ConvexGeometry} from './lib/geometries/ConvexGeometry.js';
import {Line2} from './lib/lines/Line2.js';
import {LineMaterial} from './lib/lines/LineMaterial.js'
import {LineGeometry} from './lib/lines/LineGeometry.js'
import {PrismGeometry} from './PrismGeometry.js';
import {Connector} from './Connector.js';

class BuildingBlock extends THREE.Group {
    constructor(name, color, connectors, strandConnectivity, patchNucleotides) {
        super();

        this.name = name;

        this.clone = (preview) => {
            const cloned = new BuildingBlock(name, color, connectors, strandConnectivity, patchNucleotides);
            if(preview) {
                const previewMaterial = new THREE.MeshLambertMaterial({
                    color: color,
                    opacity: 0.5,
                    transparent: true
                });
                cloned.shapeObject.material = previewMaterial
                this.connectorsObject.children.forEach(c=>c.material = previewMaterial);
            }
            return cloned;
        };

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
        let connectorSide = 0.75;

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
            this.geometry.scale(.9, .9, .9);
        } catch (error) {
            this.geometry = new THREE.BoxGeometry(.75, .75, .75);
        }
        this.shapeObject = new THREE.Mesh(this.geometry, this.material);


        this.connectionGeometry = new PrismGeometry([
            new THREE.Vector2(0, 0),
            new THREE.Vector2(0, connectorSide),
            new THREE.Vector2(connectorSide/4, connectorSide)
        ], connectorSide/2);

        this.connectionGeometry.scale(0.9, 0.9, 0.9);

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
            ], this.material.color, 10);

            const arrowHelper = new THREE.ArrowHelper(dir5.clone().negate(), p5, dist, 0xF0CE1E, dist/2, dist/2);

            this.lineObject.add(line);
            this.lineObject.add(arrowHelper);
        }

        this.connectorId = 0;

        this.add(this.shapeObject);
        this.add(this.lineObject);
        this.add(this.connectorsObject);

        this.connectionCount = () => this.connectorsObject.children.filter(c => c.connection).length;

        return this;
    }

    updateActiveConnectorId() {
        this.connectorId = (this.getActiveConnectorId() + 1) % this.connectors.length
    }

    getActiveConnectorId() {
        return this.connectorId % this.connectors.length;
    }
}


class HelixBuildingBlock extends BuildingBlock {
    constructor(name, color, connectors, strandConnectivity, patchNucleotides) {
        super(name, color, connectors, strandConnectivity, patchNucleotides);
    }
}

export {BuildingBlock}