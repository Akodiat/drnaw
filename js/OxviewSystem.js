import * as THREE from './lib/three.module.min.js';
import * as UTILS from './utils.js';

class OxViewSystem {
    constructor() {
        this.strands = [];
        this.monomerIdCounter = 0;
        this.strandIdCounter = 0;
        this.clusterCounter = 1;
        this.box = 0;
        this.idMaps = new Map();
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

    draw(
        sequence,
        startPos = new THREE.Vector3(0,0,1),
        direction = new THREE.Vector3(0,0,-1),
        orientation = new THREE.Vector3(0,-1,0),
        duplex = false, type = 'DNA', cluster = undefined, uuid
    ) {
        let rot, rise, fudge;
        let r1, r2, inclination;
        if (type == 'DNA') {
            rot = -35.9 * Math.PI / 180;
            rise = -0.3897628551303122;
            fudge = 0.6;
        } else if (type == 'RNA') {
            rot = -32.7 * Math.PI / 180;
            rise = -0.3287;
            fudge = 0.4;
            inclination = -15.5 * Math.PI / 180;
            [r1, r2] = calcR1R2(direction, orientation, inclination);
        } else {
            throw `Unknown type: "${type}". Use "DNA" or "RNA".`
        }

        if (cluster === undefined) {
            cluster = this.clusterCounter++; // Get new cluster
        } else {
            // Make sure clusterCounter is up to date
            this.clusterCounter = Math.max(this.clusterCounter, cluster+1);
        }

        direction.normalize();
        orientation.normalize();

        if (typeof sequence !== 'string') {
            if (typeof(sequence) === 'number') {
                let actualSeq = "";
                for (let i=0; i<sequence; i++) {
                    actualSeq += UTILS.randomElement(["A", type==='DNA' ? "T": "U", "C", "G"]);
                }
                sequence = actualSeq;
            } else {
                console.log("Please provide either a sequence string or a sequence length")
            }
        }

        const idMap = new Map();

        let newStrand = {
            id: this.strandIdCounter++,
            monomers: [],
            "class": "NucleicAcidStrand"
        };

        sequence.split("").map((base, i)=>{
            let a1, a3, p;

            if (type == "DNA") {
                a1 = orientation.clone().applyAxisAngle(direction, rot * i);
                a3 = direction.clone();
                p = startPos.clone().add(
                    direction.clone().multiplyScalar(rise * i)
                ).sub(a1.clone().multiplyScalar(fudge));
            } else {
                const localR1 = r1.clone().applyAxisAngle(direction, rot * i).add(direction.clone().multiplyScalar(rise * i));
                const localR2 = r2.clone().applyAxisAngle(direction, rot * i).add(direction.clone().multiplyScalar(rise * i));
                a1 = localR2.clone().sub(localR1).normalize();

                const a1proj = a1.clone().projectOnPlane(direction).normalize();
                a3 = direction.clone().multiplyScalar(-Math.cos(inclination)).add(a1proj.multiplyScalar(Math.sin(inclination))).normalize();

                a1.negate();
                a3.negate();

                p = startPos.clone().add(a1.clone().multiplyScalar(fudge)).add(localR2);
            }
            let id = this.monomerIdCounter++;
            idMap.set(id, id);
            newStrand.monomers.push({
                id: id,
                p: p.toArray(),
                a1: a1.toArray(),
                a3: a3.toArray(),
                class: type,
                type: base,
                cluster: cluster
            });

            // Resize box
            this.box = Math.max(this.box,
                Math.abs(4*p.x),
                Math.abs(4*p.y),
                Math.abs(4*p.z)
            );
        });

        const count = newStrand.monomers.length;

        for (let i=0; i<count; i++) {
            if (i-1 >= 0) {
                newStrand.monomers[i].n5 = newStrand.monomers[i-1].id;
            }
            if (i+1 < count) {
                newStrand.monomers[i].n3 = newStrand.monomers[i+1].id;
            }
        }

        newStrand.end5 = newStrand.monomers[0].id;
        newStrand.end3 = newStrand.monomers.slice(-1)[0].id;

        this.strands.push(newStrand);

        if (duplex) {
            const last = newStrand.monomers.slice(-1)[0];
            const complSeq = sequence.split("").reverse().map(c=>getComplementaryType(c, type==='RNA')).join("");
            const lastA1 = new THREE.Vector3().fromArray(last.a1);
            const p = startPos.clone().add(direction.clone().multiplyScalar(rise * (count-1)));
            const complStrand = this.draw(complSeq, p, direction.clone().negate(), lastA1.clone().negate(), false, type, cluster);

            // Specify basepairs
            for (let i=0; i<count; i++) {
                newStrand.monomers[i].bp = complStrand.monomers[count-i-1].id;
                complStrand.monomers[count-i-1].bp = newStrand.monomers[i].id;
            }
        }

        return newStrand;
    }

    async addFromJSON(data, position, orientation, uuid) {
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
        });

        // Save id map to use in ligation
        this.idMaps.set(uuid, idMap);
    }

    findById(id) {
        for (const s of this.strands) {
            for (const e of s.monomers) {
                if (e.id == id) {
                    return [s, e];
                }
            }
        }
    }

    connectBuildingBlocks(b1, b1PatchId, b2, b2PatchId) {
        // Find monomer ID's for patch pasepairs
        let [n5b1, n3b1] = b1.buildingBlock.patchNucleotides[b1PatchId];
        let [n5b2, n3b2] = b2.buildingBlock.patchNucleotides[b2PatchId];

        // Check if ends should be ligated (i.e. not an endpoint)
        if (n5b1 !== undefined && n3b2 !== undefined) {
            // Change to actual updated IDs
            n5b1 = this.idMaps.get(b1.uuid).get(n5b1);
            n3b2 = this.idMaps.get(b2.uuid).get(n3b2);
            // Ligate
            this.ligate(n5b1, n3b2);
        }
        // Do the same for second patch
        if (n5b2 !== undefined && n3b1 !== undefined) {
            n5b2 = this.idMaps.get(b2.uuid).get(n5b2);
            n3b1 = this.idMaps.get(b1.uuid).get(n3b1);
            this.ligate(n5b2, n3b1);
        }
    }

    ligate(id5, id3) {
        let [strand5, end5] = this.findById(id5);
        let [strand3, end3] = this.findById(id3);

        console.assert(end5.n5 == undefined && end3.n3 == undefined,
            "Select one nucleotide with an available 3' connection and one with an available 5'"+
            `\n${end5.id}.n5 == ${end5.n5}, ${end3.id}.n5 == ${end3.n3}`
        );

        // strand3 will be merged into strand5

        //connect the 2 element objects
        end5.n5 = end3.id;
        end3.n3 = end5.id;
        // Update 5' end to include the new elements
        strand5.end5 = strand3.end5;

        //check that it is not the same strand
        if (strand5 !== strand3) {
            // Move all monomers from strand 3 to strand 5
            for(const e of strand3.monomers) {
                strand5.monomers.push(e);
            }
            // Remove strand3
            this.strands = this.strands.filter(s => s !== strand3);
        }
    }

    getSequence() {
        if (this.strands.length !== 1) {
            throw 'System has more than one strand (forgot to ligate?)';
        } else {
            let strand = this.getStrandInOrder(this.strands[0]);
            return strand.map(e=>e.type).join('');
        }
    }

    setSequence(sequence) {
        if (this.strands.length !== 1) {
            throw 'System has more than one strand (forgot to ligate?)';
        } else {
            let strand = this.getStrandInOrder(this.strands[0]);
            if(sequence.length == strand.length) {
                strand.forEach((e,i)=>{
                    e.type = sequence[i].toUpperCase();
                });
                console.log("Changed sequence to "+sequence.toUpperCase());
            }
        }
    }

    getStrandInOrder(strand) {
        let [,p5] = this.findById(strand.end5);
        console.assert(p5.n5 === undefined, "No end?")
        let [,p3] = this.findById(strand.end3);
        console.assert(p3.n3 === undefined, "No end?")
        let strandInOrder = []
        while(true) {
            if(strandInOrder.length > strand.monomers.length) {
                throw 'Circular strand?';
            }
            strandInOrder.push(p5);
            if(p5 === p3) {
                break;
            }
            [,p5] = this.findById(p5.n3);
        }
        console.assert(strandInOrder.length == strand.monomers.length, "Missed some elements");
        return strandInOrder;
    }

    getDotBracket() {
        if (this.strands.length !== 1) {
            throw 'System has more than one strand (forgot to ligate?)';
        } else {
            let strandInOrder = this.getStrandInOrder(this.strands[0]);
            let s = "";
            for (let i=0; i < strandInOrder.length; i++) {
                if (strandInOrder[i].bp !== undefined) {
                    let j = strandInOrder.findIndex(e=>e.id == strandInOrder[i].bp);
                    if (j<0) {
                        throw 'Paired outside strand: ' + strandInOrder[i].id;
                    }
                    if (i<j) {
                        s += '(';
                    } else if (j<i) {
                        s += ')';
                    } else {
                        throw 'Element paired with itself: ' + strandInOrder[i].id;
                    }
                } else {
                    s += '.';
                }
            }
            return s;
        }
    }
}

// Helper functions

function getComplementaryType(type, RNA=false) {
    console.assert(RNA && type !== 'T' || !RNA && type !== 'U', `Type cannot be ${type} in ${RNA?'RNA':'DNA'}!`);
    let tu = RNA ? 'U':'T';
    let map = {'A': tu, 'G': 'C', 'C': 'G'};
    map[tu] = 'A';
    let complType = map[type];
    console.assert(complType !== undefined, `Type ${type} has no defined complementary type! (for ${RNA?'RNA':'DNA'})`);
    return complType;
}

// Code adapted from RNA.js in oxView
function calcR1R2(dir, orientation,
    inclination = -15.5 * Math.PI / 180,
    bp_backbone_distance = 2,
    diameter = 2.35
) {
    const cord = Math.cos(inclination) * bp_backbone_distance;
    const center_to_cord = Math.sqrt(Math.pow(diameter / 2, 2) - Math.pow(cord / 2, 2));

    const x1 = center_to_cord;
    const y1 = -cord / 2;
    const z1 = -(bp_backbone_distance / 2) * Math.sin(inclination);
    const x2 = center_to_cord;
    const y2 = cord / 2;
    const z2 = (bp_backbone_distance / 2) * Math.sin(inclination);
    let r1 = new THREE.Vector3(x1, y1, z1);
    let r2 = new THREE.Vector3(x2, y2, z2);

    let q1 = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    r1.applyQuaternion(q1);
    r2.applyQuaternion(q1);

    const r1_to_r2 = r1.clone().sub(r2);
    r1_to_r2.normalize();
    let rotAxis2 = dir.clone();
    rotAxis2.normalize();
    let rotAngle2 = r1_to_r2.clone().projectOnPlane(dir).angleTo(orientation.clone().projectOnPlane(dir));
    let cross2 = r1_to_r2.clone().cross(orientation);
    if (cross2.dot(dir) < 0) {
        rotAngle2 = -rotAngle2;
    }
    let q2 = new THREE.Quaternion();
    q2.setFromAxisAngle(rotAxis2, rotAngle2);
    r1.applyQuaternion(q2);
    r2.applyQuaternion(q2);

    return [r1, r2];
}

export {OxViewSystem}