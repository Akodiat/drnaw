import * as THREE from './lib/three.module.js';
import * as UTILS from './utils.js';
import {ConvexGeometry} from './lib/geometries/ConvexGeometry.js';

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
        let connectorSide = 0.5;

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
                new THREE.Vector3(-connectorSide/4,-connectorSide/2, 0),
                new THREE.Vector3(-connectorSide/4, connectorSide/2, 0),
                new THREE.Vector3(connectorSide/4, connectorSide/2, 0),
                new THREE.Vector3(connectorSide/4, -connectorSide/2, 0),
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

        this.connectionGeometry = new PrismGeometry([
            new THREE.Vector2(0, 0),
            new THREE.Vector2(0, connectorSide),
            new THREE.Vector2(connectorSide/2, connectorSide)
        ], connectorSide/2);
    }

    createMesh(preview) {
        let material = preview ? this.previewMaterial : this.material;
        let connectorMaterial = preview ? this.previewMaterial : this.connectorMaterial;
        let mesh = new THREE.Mesh(this.geometry, material);
        mesh.name = this.name;
        let connectorId = 0;
        for (const [pos, dir, orientation] of this.connectors) {
            dir.normalize();
            orientation.normalize();
            let connector = new THREE.Mesh(this.connectionGeometry, connectorMaterial);
            //connector.up = orientation;

            let q1 = new THREE.Quaternion().setFromUnitVectors(
                new THREE.Vector3(0,0,1), dir
            );

            let angle = UTILS.getSignedAngle(
                new THREE.Vector3(0,1,0), orientation, dir
            );
            let q2 = new THREE.Quaternion().setFromAxisAngle(dir, angle);

            connector.applyQuaternion(q1);
            connector.applyQuaternion(q2);

            connector.connId = connectorId++;

            connector.position.copy(pos);
            connector.name = "connector";
            connector.dir = dir;
            connector.getDir = () => {
                // Get direction in global coordinates
                return dir.clone().applyQuaternion(mesh.quaternion);
            };
            connector.orientation = orientation;
            connector.getOrientation = () => {
                // Get direction in global coordinates
                return orientation.clone().applyQuaternion(mesh.quaternion);
            };
            //connector.scale.multiplyScalar(0.9);
            mesh.add(connector);
        }
        mesh.connectionCount = () => mesh.children.filter(c => c.connection).length;
        //mesh.scale.multiplyScalar(0.9);
        return mesh;
    };
}

// Shorthand for Vector3
let v3 = (x,y,z)=>{return new THREE.Vector3(x,y,z)}  

let buildingBlocks = [
    new BuildingBlock("Helix", new THREE.Color(.3,.4,.8), [
        [v3(-.5,0,0), v3(-1,0,0), v3(0,1,0)],
        [v3(.5,0,0), v3(1,0,0), v3(0,1,0)]
    ]),
    new BuildingBlock("Helix2", new THREE.Color(.3,.4,.8), [
        [v3(-.25,0,0), v3(-1,0,0), v3(0,0,1)],
        [v3(.25,0,0), v3(1,0,0), v3(0,-1,0)]
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
]

export {BuildingBlock, buildingBlocks};