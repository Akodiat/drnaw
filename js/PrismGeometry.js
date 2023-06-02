// From https://stackoverflow.com/a/27194985
import * as THREE from './lib/three.module.js';

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

export {PrismGeometry}