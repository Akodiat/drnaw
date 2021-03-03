import * as THREE from './lib/three.module.js';
import * as UTILS from './utils.js';
import {ConvexGeometry} from './lib/geometries/ConvexGeometry.js';
import {GLTFLoader} from './lib/loaders/GLTFLoader.js';

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

            let angle = UTILS.getSignedAngle(
                new THREE.Vector3(0,1,0), orientation, dir
            );
            let q2 = new THREE.Quaternion().setFromAxisAngle(dir, angle);

            this.applyQuaternion(q1);
            this.applyQuaternion(q2);

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

// From https://stackoverflow.com/a/27194985
class PrismGeometry extends THREE.ExtrudeGeometry {
    constructor(vertices, height) {
        let Shape = new THREE.Shape();

        (function f(ctx) {
            ctx.moveTo(vertices[0].x, vertices[0].y);
            for (var i = 1; i < vertices.length; i++) {
                ctx.lineTo(vertices[i].x, vertices[i].y);
            }
            ctx.lineTo(vertices[0].x, vertices[0].y);
        })(Shape);
        let g = super(Shape, {'depth': height, 'bevelEnabled': false});
        const xMax = Math.max(...vertices.map(v=>v.x));
        const xMin = Math.min(...vertices.map(v=>v.x));
        const yMax = Math.max(...vertices.map(v=>v.y));
        const yMin = Math.min(...vertices.map(v=>v.y));
        g.translate((xMin-xMax)/2, (yMin-yMax)/2, -height/2);
        g.rotateY(-Math.PI/2);
        return g
    }
}

class BuildingBlock {
    constructor(name, color, connectors) {
        this.name = name;

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
        let connectorSide = 2;

        // Load glTF nucleotide object
        const loader = new GLTFLoader();
        loader.load(`resources/${name}.gltf`, (gltf)=>{
                this.gltfObject = gltf.scene;
            },
            // called while loading is progressing
            function ( xhr ) {
                console.log((xhr.loaded / xhr.total * 100 ) + '% loaded');
            }
        );

        let points = [];
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
                point.add(pos.clone().sub(dir.clone().setLength(connectorSide/4)));
                points.push(point);
            });
        }
        try {
            this.geometry = new ConvexGeometry(points);
        } catch (error) {
            this.geometry = new THREE.BoxBufferGeometry(.75, .75, .75);
        }
        this.shapeObject = new THREE.Mesh(this.geometry, this.material);

        this.connectionGeometry = new PrismGeometry([
            new THREE.Vector2(0, 0),
            new THREE.Vector2(0, connectorSide),
            new THREE.Vector2(connectorSide/2, connectorSide)
        ], connectorSide/2);

        this.connectorsObject = new THREE.Group();
        for (const [pos, dir, orientation] of this.connectors) {
            let connector = new Connector(pos, dir, orientation, this);
            this.connectorsObject.add(connector);
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

        if (this.gltfObject) {
            block.gltfObject = this.gltfObject.clone();
            block.add(block.gltfObject);
        }

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

// Shorthand for Vector3
let v3 = (x,y,z)=>{return new THREE.Vector3(x,y,z)}

let buildingBlocks = [
    new BuildingBlock("11bp_helix", new THREE.Color(.87,.87,.88), [
        [
            v3(0, 0, -1.60850 - .5), // Position of patch (take mean of the nucleotides in the pair)
            v3(0,0,-1), // Direction of patch (probably similar to prev), also A3 of 5' end nucleotide
            v3(0, 1, 0) // Orientation, (the 3' end nucleotide minus the position)
        ],
        [v3(0, 0, 1.64978 + .5), v3(0,0,1), v3(0,-1,0)]
    ]),
    new BuildingBlock("kl180", new THREE.Color(.85,.7,.7), [
        [v3(0, 0, - 2 - .5), v3(0,0,-1), v3(0, 1, 0)],
        [v3(0, 0, 2 + .5), v3(0,0,1), v3(1,0,0)]
    ]),
    new BuildingBlock("crossover", new THREE.Color(.23,.37,.65), [
        [v3(-.7, .9, -1.3), v3(0,0,-1), v3(0,1, 0)],
        [v3(-.7, .9, .5), v3(0,0,1), v3(0,-1,0)],
        [v3(.7, -.9, -.5), v3(0,0,-1), v3(1,1,0)],
        [v3(.7, -.9, 1.3), v3(0,0,1), v3(1,-1,0)]
    ]),
    /*
    new BuildingBlock("Helix", new THREE.Color(.3,.4,.8), [
        [v3(-.5,0,0), v3(-1,0,0), v3(0,1,0)],
        [v3(.5,0,0), v3(1,0,0), v3(0,1,0)]
    ]),
    new BuildingBlock("Corner", new THREE.Color(.3,.7,.5), [
        [v3(-.5,0,0), v3(-1,0,0), v3(0,1,0)],
        [v3(0,.5,0), v3(0,1,0), v3(1,0,0)]
    ]),
    new BuildingBlock("Corner2", new THREE.Color(.3,.7,.2), [
        [v3(-.5,0,0), v3(-1,0,0), v3(0,1,0)],
        [v3(0,0,.5), v3(0,0,1), v3(1,0,0)]
    ]),
    new BuildingBlock("End", new THREE.Color(0.8,.4,.3), [
        [v3(-.5,0,0), v3(-1,0,0), v3(0,1,0)]
    ]),
    new BuildingBlock("Branch", new THREE.Color(0.8,.8,.2), [
        [v3(-.5,0,0), v3(-1,0,0), v3(0,1,0)],
        [v3(.5,0,0), v3(1,0,0), v3(0,-1,0)],
        [v3(0,-.5,0), v3(0,-1,0), v3(1,0,0)]
    ])
    */
]

export {BuildingBlock, buildingBlocks};