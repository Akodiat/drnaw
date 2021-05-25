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
            this.geometry = new THREE.BoxBufferGeometry(.75, .75, .75);
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

// Shorthand for Vector3
const v3 = (x,y,z)=>{return new THREE.Vector3(x,y,z)};

const bbdist = 0.34223473072052;;
const angle = 2*Math.PI/11;

const buildingBlocks = [

    new BuildingBlock("11bp_helix", new THREE.Color(.87,.87,.88), [
        [
            v3(0, 0, -bbdist*11/2), // Position of patch (take mean of the nucleotides in the pair)
            v3(0,0,-1), // Direction of patch (probably similar to prev), also A3 of 5' end nucleotide
            v3(0, 1, 0) // Orientation, (the 3' end nucleotide minus the 5' end minus direction*pos)
        ],
        [v3(0, 0, bbdist*11/2), v3(0,0,1), v3(0,-1,0)]
    ], [
        [0, 1], // One strand goes from patch 0 to 1 (5' to 3')
        [1,0] // One strand goes from patch 1 to 0 (5' to 3')
    ], [[
            22, // 5' end id on patch 0
            30 // 3' end id on patch 0
        ],[
            4, // 5' end id on patch 1
            12 // 3' end id on patch 1
        ]]
    ),
    new BuildingBlock("1bp", new THREE.Color(.87,.87,.88), [
        [v3(0, 0, -bbdist/2), v3(0,0,-1), v3(0,1,0)],
        [v3(0, 0, bbdist/2), v3(0,0,1), v3(0,-1,0).applyAxisAngle(v3(0,0,1), angle)]
    ],
    [[0, 1], [1, 0]],
    [[0, 1], [1, 0]]
    ),
    new BuildingBlock("1bp_end5", new THREE.Color(.3,.3,.3), [
        [v3(0, 0, -bbdist/2), v3(0,0,-1), v3(0,1,0)],
        [v3(0, 0, bbdist/2), v3(0,0,1), v3(0,-1,0).applyAxisAngle(v3(0,0,1), angle)]
    ],
    [[0, 1], [1, 0]],
    [[0, 1], [undefined, 0]]
    ),
    new BuildingBlock("kl180", new THREE.Color(.85,.7,.7), [
        [v3(0, 0, -13*bbdist/2), v3(0,0,-1), v3(0, 1, 0)],
        [v3(0, 0, 14*bbdist/2), v3(0,0,1), v3(0,-1,0).applyAxisAngle(v3(0,0,1), angle*13)]
    ],
    [[0, 0], [1,1]],
    [[132, 120], [154, 152]]
    ),
    new BuildingBlock("single_kl180", new THREE.Color(.85,.7,.7), [
        [v3(0, 0, bbdist/2), v3(0,0,1), v3(0,-1,0).applyAxisAngle(v3(0,0,1), angle)]
    ],
    [[0, 0]],
    [[12, 0]]
    ),
    new BuildingBlock("crossover", new THREE.Color(.23,.37,.65), [
        [v3(-.7, .9, -1.3), v3(0,0,-1), v3(0,1, 0)],
        [v3(-.7, .9, .5), v3(0,0,1), v3(0,-1,0)],
        [v3(.7, -.9, -.5), v3(0,0,-1), v3(0,1, 0)],
        [v3(.7, -.9, 1.3), v3(0,0,1), v3(0,-1,0)]
    ], [[0, 1], [1, 3], [3, 2], [2, 0]],
    [[70, 108], [109, 143], [173, 69], [144, 172]]
    )
]

export {BuildingBlock, buildingBlocks};