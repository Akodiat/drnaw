import * as THREE from './lib/three.module.js';
import * as UTILS from './utils.js';

class OxViewSystem {
    constructor() {
        this.strands = [];
        this.monomerIdCounter = 0;
        this.strandIdCounter = 0;
        this.clusterCounter = 1;
        this.box = 0;
    }

    toJSON() {
        return {
            date: new Date(),
            box: [this.box, this.box, this.box],
            systems: [{
                id: 0,
                strands: this.strands
            }],
        }
    }

    saveToFile(filename) {
        UTILS.saveString(
            JSON.stringify(this,
                undefined, 2  // Indent
                ).replace(    // But not too much
                    /(".+": \[)([^\]]+)/g, (_, a, b) => a + b.replace(/\s+/g, ' ')
            ), filename
        );
    }

    async addFromJSON(data, position, orientation) {
        const cluster = this.clusterCounter++;
        const idMap = new Map();
        let newStrands = [];
        data.systems.forEach(sys => {
            sys.strands.forEach(strand=>{
                let newStrand = Object.assign({}, strand);
                newStrand.id = this.strandIdCounter++;
                newStrand.monomers = [];
                strand.monomers.forEach(monomer=>{

                    // Position and orientate correctly

                    let p = new THREE.Vector3().fromArray(monomer.p);
                    let a1 = new THREE.Vector3().fromArray(monomer.a1);
                    let a3 = new THREE.Vector3().fromArray(monomer.a3);

                    p.applyQuaternion(orientation);
                    a1.applyQuaternion(orientation);
                    a3.applyQuaternion(orientation);

                    p.add(position);

                    console.log(`p from ${monomer.p} to ${p.toArray()}`);
                    console.log(`a1 from ${monomer.a1} to ${a1.toArray()}`);
                    console.log(`a3 from ${monomer.a3} to ${a3.toArray()}`);

                    monomer.p = p.toArray();
                    monomer.a1 = a1.toArray();
                    monomer.a3 = a3.toArray();
                    monomer.cluster = cluster;

                    // Update monomer IDs
                    let newId = this.monomerIdCounter++;
                    idMap.set(monomer.id, newId);
                    monomer.id = newId;

                    // Resize box
                    this.box = Math.max(this.box,
                        Math.abs(4*p.x),
                        Math.abs(4*p.y),
                        Math.abs(4*p.z)
                    );

                    newStrand.monomers.push(monomer);
                });
                newStrand.monomers.forEach(monomer=>{
                    if (monomer.n3 !== undefined) {
                        monomer.n3 = idMap.get(monomer.n3);
                    }
                    if (monomer.n5 !== undefined) {
                        monomer.n5 = idMap.get(monomer.n5);
                    }
                })
                if(newStrand.end3 >= 0) {
                    newStrand.end3 = idMap.get(newStrand.end3);
                }
                if(newStrand.end5 >= 0) {
                    newStrand.end5 = idMap.get(newStrand.end5);
                }
                newStrands.push(newStrand);
            });
        });

        newStrands.forEach(strand=>{
            strand.monomers.forEach(monomer=>{
                if (monomer.bp !== undefined) {
                    monomer.bp = idMap.get(monomer.bp);
                }
            });
            this.strands.push(strand);
        })
    }
}

export {OxViewSystem}