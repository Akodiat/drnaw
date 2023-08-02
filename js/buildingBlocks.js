import * as THREE from './lib/three.module.min.js';
import {BuildingBlock} from './BuildingBlock.js';

// Shorthand for Vector3
const v3 = (x,y,z)=>{return new THREE.Vector3(x,y,z)};

const bbdist = 0.34223473072052;
const angle = 2*Math.PI/11;

const buildingBlockTemplates = [
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