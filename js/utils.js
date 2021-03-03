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

export {getSignedAngle, saveString, getJSON, setMaterialRecursively}