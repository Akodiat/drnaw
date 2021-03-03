function getPatchVectors(round=false) {
    let selection = [...selectedBases];
    console.assert(selection.length == 2, "Select both bases in the endpoint basepair")

    let end3, end5
    if (!selection[0].n3 && !selection[1].n5) {
        end3 = selection[0];
        end5 = selection[1];
    } else if (!selection[0].n5 && !selection[1].n3) {
        end5 = selection[0];
        end3 = selection[1];
    }

    let pos = new THREE.Vector3().add(end3.getPos()).add(end5.getPos()).divideScalar(2);
    // Only keep the largest component. Ugly, but works since finding the actual helix axis is tricky.
    let largestComponent = pos.x;
    let largestComponent_idx = 0;
    [1,2].forEach(i=>{
        if(Math.abs(pos.getComponent(i)) > largestComponent) {
            largestComponent_idx = i;
        }
    });
    [0,1,2].forEach(i=>{
        if(i !== largestComponent_idx) {
            pos.setComponent(i, 0);
        }
    });

    let dir = end5.getA3().normalize();
    let orientation = end3.getPos().sub(pos).normalize();

    if(round)
        return [pos.round(), dir.round(), orientation.round()]
    else
        return [pos, dir, orientation]
}