
import * as THREE from './lib/three.module.min.js';
import * as UTILS from './utils.js';
import {ConvexGeometry} from './lib/geometries/ConvexGeometry.js';
import {PrismGeometry} from './PrismGeometry.js';
import {Connector} from './Connector.js';
import { OxViewSystem } from './OxviewSystem.js';

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
                cloned.shapeObject.material = previewMaterial;
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

        this.helixLineObject = new THREE.Group();

        this.add(this.shapeObject);
        this.add(this.lineObject);
        this.add(this.connectorsObject);
        this.add(this.helixLineObject);

        this.connectionCount = () => this.connectorsObject.children.filter(c => c.connection).length;

        return this;
    }

    updateActiveConnectorId() {
        this.connectorId = (this.getActiveConnectorId() + 1) % this.connectors.length
    }

    getActiveConnectorId() {
        return this.connectorId % this.connectors.length;
    }

    updateHelixObject(sys) {
        this.helixLineObject.clear();
        sys.strands.forEach(strand=>{
            const positions = strand.monomers.map(e=>new THREE.Vector3().fromArray(e.p));
            let line = UTILS.makeLine(positions, this.material.color.clone().multiplyScalar(0.5), 5);
            this.helixLineObject.add(line);
        });
    }

    async getOxview() {
        let s = new OxViewSystem();
        const data = await UTILS.getJSON(`resources/${this.name}.oxview`);
        s.addFromJSON(
            data,
            new THREE.Vector3, new THREE.Quaternion(),
            this.uuid
        );
        //this.updateHelixObject(s);
        return s;
    }
}

class HelixBuildingBlock extends BuildingBlock {

    constructor(length) {
        const startPos = new THREE.Vector3(0,0,0);
        const direction = new THREE.Vector3(0,0,-1);
        const orientation = new THREE.Vector3(0,-1,0);
        const rise = -0.3287;
        const rot = 2*Math.PI/11;

        const name = `${length}bp_helix`
        const color = new THREE.Color(.77,.77,.78);

        const halfLength = direction.clone().multiplyScalar((rise*length)/2).add(startPos);

        const posPatchA = halfLength.clone();
        const dirPatchA = direction.clone().negate();
        const oriPatchA = orientation.clone();

        const posPatchB = posPatchA.clone().negate();
        const dirPatchB = dirPatchA.clone().negate();
        const oriPatchB = oriPatchA.clone().negate().applyAxisAngle(dirPatchB, rot * length);

        const connectors = [
            [posPatchA, dirPatchA, oriPatchA],
            [posPatchB, dirPatchB, oriPatchB]
        ];

        const strandConnectivity = [
            [1,0], // One strand goes from patch 1 to 0 (5' to 3')
            [0,1]  // One strand goes from patch 0 to 1 (5' to 3')
        ]

        const patchNucleotides = [
            [
                length, // 5' end id on patch 1
                length - 1, // 3' end id on patch 1
            ],[
                0, // 3' end id on patch 0
                length*2 - 1, // 5' end id on patch 0
            ]
        ]
        super(name, color, connectors, strandConnectivity, patchNucleotides);

        this.length = length;
        this.startPos = startPos;
        this.direction = direction;
        this.orientation = orientation;
        this.rise = rise;

        this.clone = (preview) => {
            const cloned = new HelixBuildingBlock(length);
            if(preview) {
                const previewMaterial = new THREE.MeshLambertMaterial({
                    color: color,
                    opacity: 0.5,
                    transparent: true
                });
                cloned.shapeObject.material = previewMaterial;
                this.connectorsObject.children.forEach(c=>c.material = previewMaterial);
            }
            return cloned;
        };
    }

    isHelixBuildingBlock() {
        return true
    }

    async getOxview() {
        // Create oxView system
        const s = new OxViewSystem();
        // Sequence should not be set, use "N" with correct length
        const sequence = Array.from({length: this.length}, _ => "N").join('');
        s.draw(
            sequence,
            this.startPos,
            this.direction,
            this.orientation,
            true, 'RNA', undefined, this.uuid
        );
        // Center system
        const halfLength = this.direction.clone().multiplyScalar(
            (this.rise*this.length)/2
        ).add(this.startPos);
        s.strands.forEach(
            s=>s.monomers.forEach(
                e=>e.p = new THREE.Vector3().fromArray(
                    e.p).sub(halfLength
                ).toArray()
        ));

        //this.updateHelixObject(s);
        return s;
    }
}

export {BuildingBlock, HelixBuildingBlock}