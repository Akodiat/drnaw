import {Line2} from './lib/lines/Line2.js';
import {LineGeometry} from './lib/lines/LineGeometry.js';
import {LineMaterial} from './lib/lines/LineMaterial.js';

let getSignedAngle = function(v1, v2, axis) {
    v1.normalize();
    v2.normalize();
    axis.normalize();
    let s = v1.clone().cross(v2);
    let c = v1.clone().dot(v2);
    let a = Math.atan2(s.length(), c);
    if (!s.equals(axis)) {
        a *= -1;
    }
    return a;
}

function saveString(text, filename) {
    let element = document.createElement('a');
    element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
}

function setMaterialRecursively(object, material) {
    if (object.material) {
        object.material = material
    }
    for (const child of object.children) {
        setMaterialRecursively(child, material)
    }
}

async function getJSON(path) {
    return fetch(path)
        .then((response)=>response.json())
        .then((responseJson)=>{
            return responseJson
        });
}

function makeLine(points, color, width) {
    const geometry = new LineGeometry();
    geometry.setPositions(points.map(p=>p.toArray()).flat());
    const material = new LineMaterial({
        color: color,
        linewidth: 0.08,
        worldUnits: true,
        vertexColors: false,
        dashed: false,
        alphaToCoverage: false,
    });
    const line = new Line2(geometry, material);
    line.computeLineDistances();
    line.scale.set(1, 1, 1);
    return line;
}

function randomElement(items) {
    return items[Math.floor(Math.random()*items.length)];
}

export {getSignedAngle, saveString, getJSON, setMaterialRecursively, makeLine, randomElement}