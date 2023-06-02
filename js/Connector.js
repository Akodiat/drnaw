import * as THREE from './lib/three.module.js';
import * as UTILS from './utils.js';

class Connector extends THREE.Mesh {
    constructor(pos, dir, orientation, buildingBlock) {
        if(buildingBlock) {
            super(buildingBlock.connectionGeometry, buildingBlock.connectorMaterial);
            dir.normalize();
            orientation.normalize();

            this.dir = dir;
            this.orientation = orientation;
            this.buildingBlock = buildingBlock;

            let q1 = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0,0,1), dir
            );

            this.applyQuaternion(q1);

            //console.assert(new THREE.Vector3(0,0,1).distanceTo(this.getDir()) < 0.01, "Incorrect visual connector direction");

            let angle = UTILS.getSignedAngle(
                new THREE.Vector3(0,1,0), orientation, dir
            );
            console.log(buildingBlock.name+" "+angle*180/Math.PI)
            let q2 = new THREE.Quaternion().setFromAxisAngle(dir, angle);

            this.applyQuaternion(q2);

            //console.assert(new THREE.Vector3(0,1,0).distanceTo(this.getOrientation()) < 0.01, "Incorrect visual connector orientation");

            this.position.copy(pos);
            this.name = "connector";
            this.dir = dir;
            this.orientation = orientation;
        } else {
            // Empty default constructor
            super()
        }
    }

    copy(source) {
        super.copy(source);
        //THREE.Mesh.prototype.copy.call(this, source);

        this.dir = source.dir.clone();
        this.orientation = source.orientation.clone();
        this.buildingBlock = source.buildingBlock;
        this.index = source.index;

        return this;
    }

    getBlock() {
        return this.parent.parent;
    }

    // Get direction in global coordinates
    getDir() {
        let q = this.parent.getWorldQuaternion(new THREE.Quaternion);
        return this.dir.clone().applyQuaternion(q).normalize();
    }

    // Get direction in global coordinates
    getOrientation() {
        let q = this.parent.getWorldQuaternion(new THREE.Quaternion);
        return this.orientation.clone().applyQuaternion(q).normalize();
    }

    // Get direction in global coordinates
    getPos() {
        let q = this.parent.getWorldQuaternion(new THREE.Quaternion);
        return this.position.clone().applyQuaternion(q);
    }
}

export {Connector}