import * as THREE from './lib/three.module.min.js';
import {BuildingBlock} from './BuildingBlock.js';

// Shorthand for Vector3
const v3 = (x,y,z)=>{return new THREE.Vector3(x,y,z)};

const bbdist = 0.34223473072052;
const angle = 2*Math.PI/11;

const buildingBlockTemplates = [

    new BuildingBlock("11bp_helix", new THREE.Color(.77,.77,.78), [
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
    new BuildingBlock("1bp", new THREE.Color(.77,.77,.78), [
        [v3(0, 0, -bbdist/2), v3(0,0,-1), v3(0,1,0)],
        [v3(0, 0, bbdist/2), v3(0,0,1), v3(0,-1,0).applyAxisAngle(v3(0,0,1), angle)]
    ],
    [[0, 1], [1, 0]],
    [[0, 1], [1, 0]]
    ),
    new BuildingBlock("1bp_end5", new THREE.Color(.45,.45,.45), [
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

export {buildingBlockTemplates};