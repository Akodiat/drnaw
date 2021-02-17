import * as THREE from './lib/three.module.js';

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
        this.connectors = connectors;
        this.color = color;
        this.material = new THREE.MeshLambertMaterial({
            color: color
        });
        this.previewMaterial = new THREE.MeshLambertMaterial({
            color: color,
            opacity: 0.5,
            transparent: true
        });
        this.geometry = new THREE.BoxBufferGeometry(.75, .75, .75);
        this.connectionGeometry = new PrismGeometry([
            new THREE.Vector2(0, 0),
            new THREE.Vector2(0, .5),
            new THREE.Vector2(.5, .5)
        ], 0.25);

        //this.connectionGeometry = new THREE.BoxBufferGeometry(0.25,0.25,0.25);
        this.getMesh = function (preview) {
            let material = preview ? this.previewMaterial : this.material;
            let mesh = new THREE.Mesh(this.geometry, material);
            mesh.name = this.name;
            for (const [pos, dir, orientation] of this.connectors) {
                let connector = new THREE.Mesh(this.connectionGeometry, material);
                connector.up = orientation;
                connector.lookAt(dir);
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
                mesh.add(connector);
            }
            mesh.connectionCount = () => mesh.children.filter(c => c.connection).length;
            return mesh;
        };
    }
}

// Shorthand for Vector3
let v3 = (x,y,z)=>{return new THREE.Vector3(x,y,z)}  

let buildingBlocks = [
    new BuildingBlock("Helix", new THREE.Color(.3,.4,.8), [
        [v3(-.5,0,0), v3(-1,0,0), v3(0,1,0)],
        [v3(.5,0,0), v3(1,0,0), v3(0,-1,0)]
    ]),
    new BuildingBlock("Corner", new THREE.Color(.3,.7,.5), [
        [v3(-.5,0,0), v3(-1,0,0), v3(0,1,0)],
        [v3(0,.5,0), v3(0,1,0), v3(1,0,0)]
    ]),
    new BuildingBlock("Corner2", new THREE.Color(.3,.7,.2), [
        [v3(-.5,0,0), v3(-1,0,0), v3(0,1,0)],
        [v3(0,.5,0), v3(0,1,0), v3(1,0,1)]
    ]),
    new BuildingBlock("End", new THREE.Color(0.8,.4,.3), [
        [v3(-.5,0,0), v3(-1,0,0), v3(0,1,0)]
    ])
]

export {BuildingBlock, buildingBlocks};