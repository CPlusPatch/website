/** A preset's `appearance`: a colour, and the fields of the layers in `packages/render/src/layers/index.ts`. */
type PresetAppearance = {
    color?: string;
    map?: string;
    // Real heights, so the numbers can be checked against the sources. The colours are artistic.
    atmosphere?: {
        top: number;
        day: string;
        twilight: string;
        rim: number;
        haze: number;
    };
    clouds?: { map: string };
    nightSide?: { map: string };
    rings?: { map: string; inner: number; outer: number };
    // The mesh types and their params are in `packages/render/src/meshes/index.ts`.
    mesh?: {
        type: string;
        size?: [number, number, number];
        wings?: 1 | 2;
        wingLength?: number;
        wingWidth?: number;
        boom?: number;
        antenna?: [number, number];
        dish?: number;
        shield?: { shape: "disc" | "plate"; size: number; thickness: number };
    };
};

/** The look of each model by preset, for the bodies that have one of their own. */
export const APPEARANCE: Readonly<Record<string, PresetAppearance>> = {
    sun: { color: "#ffd27a", map: "sun" },
    mercury: { color: "#b9b2a6", map: "mercury" },
    venus: {
        color: "#e9cf98",
        map: "venus",
        atmosphere: {
            top: 90,
            day: "#ffd27a",
            twilight: "#e88a45",
            rim: 1,
            haze: 0.08,
        },
    },
    earth: {
        color: "#62a7ff",
        map: "earth",
        atmosphere: {
            top: 100,
            day: "#4f9bff",
            twilight: "#ff7a3d",
            rim: 1,
            haze: 0.06,
        },
        clouds: { map: "earth-clouds" },
        nightSide: { map: "earth-night" },
    },
    moon: { color: "#cfd0d2", map: "moon" },
    mars: {
        color: "#ec6f4a",
        map: "mars",
        atmosphere: {
            top: 80,
            day: "#d99a6c",
            twilight: "#6f9ad6",
            rim: 0.6,
            haze: 0.05,
        },
    },
    jupiter: {
        color: "#dcae7c",
        map: "jupiter",
        atmosphere: {
            top: 300,
            day: "#d8b890",
            twilight: "#a06840",
            rim: 0.5,
            haze: 0.03,
        },
    },
    saturn: {
        color: "#e8d59a",
        map: "saturn",
        atmosphere: {
            top: 600,
            day: "#f6d98a",
            twilight: "#c89060",
            rim: 0.7,
            haze: 0.03,
        },
        rings: { map: "saturn-ring", inner: 74_500_000, outer: 140_220_000 },
    },
    uranus: {
        color: "#93e0dc",
        map: "uranus",
        atmosphere: {
            top: 300,
            day: "#3fc4e8",
            twilight: "#68bcd0",
            rim: 1,
            haze: 0.05,
        },
    },
    neptune: {
        color: "#7c8cff",
        map: "neptune",
        atmosphere: {
            top: 250,
            day: "#6a9cff",
            twilight: "#4060d0",
            rim: 0.8,
            haze: 0.05,
        },
    },
    pluto: {
        color: "#c8a593",
        map: "pluto",
        atmosphere: {
            top: 200,
            day: "#b8b4e0",
            twilight: "#6080d0",
            rim: 0.4,
            haze: 0,
        },
    },
    // Only bodies with a look of their own get a colour; grey moons keep their kind's.
    io: { color: "#e6cf63", map: "io" },
    europa: { color: "#dccdb2", map: "europa" },
    ganymede: { color: "#aa9f90", map: "ganymede" },
    callisto: { color: "#6f6a66", map: "callisto" },
    titan: {
        color: "#e0a452",
        atmosphere: {
            top: 600,
            day: "#c08a40",
            twilight: "#b05a30",
            rim: 0.6,
            haze: 0.15,
        },
    },
    enceladus: { color: "#eef4f7", map: "enceladus" },
    triton: {
        color: "#dbc1b6",
        map: "triton",
        atmosphere: {
            top: 50,
            day: "#d8c4e8",
            twilight: "#7090d0",
            rim: 0.3,
            haze: 0,
        },
    },
    ceres: { color: "#a7a199", map: "ceres" },
    eris: { color: "#e8e6e2" },
    haumea: { color: "#c9cfd4" },
    makemake: { color: "#c99877" },
    vesta: { color: "#bcae9a", map: "vesta" },
    halley: { color: "#b5c9d6" },
    mimas: { map: "mimas" },
    tethys: { map: "tethys" },
    dione: { map: "dione" },
    rhea: { map: "rhea" },
    iapetus: { map: "iapetus" },
    phobos: { map: "phobos" },
    charon: { map: "charon" },
    kerbol: { map: "kerbol" },
    moho: { map: "moho" },
    eve: {
        map: "eve",
        atmosphere: {
            top: 90,
            day: "#c070e0",
            twilight: "#ff6090",
            rim: 0.9,
            haze: 0.09,
        },
    },
    gilly: { map: "gilly" },
    kerbin: {
        map: "kerbin",
        atmosphere: {
            top: 70,
            day: "#4f9bff",
            twilight: "#ff7a3d",
            rim: 1,
            haze: 0.06,
        },
    },
    mun: { map: "mun" },
    minmus: { map: "minmus" },
    duna: {
        map: "duna",
        atmosphere: {
            top: 50,
            day: "#e08060",
            twilight: "#80a0e0",
            rim: 0.5,
            haze: 0.05,
        },
    },
    ike: { map: "ike" },
    dres: { map: "dres" },
    jool: {
        map: "jool",
        atmosphere: {
            top: 200,
            day: "#a0e070",
            twilight: "#509040",
            rim: 0.6,
            haze: 0.05,
        },
    },
    laythe: {
        map: "laythe",
        atmosphere: {
            top: 50,
            day: "#4f9bff",
            twilight: "#ff7a3d",
            rim: 1,
            haze: 0.06,
        },
    },
    vall: { map: "vall" },
    tylo: { map: "tylo" },
    bop: { map: "bop" },
    pol: { map: "pol" },
    eeloo: { map: "eeloo" },
    // Spacecraft.
    iss: { mesh: { type: "iss" } },
    hubble: { mesh: { type: "hubble" } },
    tiangong: { mesh: { type: "tiangong" } },
    parisat: { mesh: { type: "parisat" } },
    juno: { mesh: { type: "juno" } },
    "landsat-9": {
        mesh: {
            type: "bus",
            size: [3, 2.4, 4.3],
            wings: 1,
            wingLength: 9.4,
            wingWidth: 2.6,
        },
    },
    "gps-biii-1": {
        mesh: {
            type: "bus",
            size: [2.5, 2.5, 2.5],
            wings: 2,
            wingLength: 6.65,
            wingWidth: 1.9,
            antenna: [1.6, 1.6],
        },
    },
    "goes-19": {
        mesh: {
            type: "bus",
            size: [6, 5.6, 3.9],
            wings: 1,
            wingLength: 12,
            wingWidth: 3,
            boom: 8,
        },
    },
    "meridian-10": {
        mesh: {
            type: "bus",
            size: [1.5, 1.5, 2.5],
            wings: 2,
            wingLength: 3.75,
            wingWidth: 1.8,
        },
    },
    mro: {
        mesh: {
            type: "bus",
            size: [3, 2.5, 2.5],
            wings: 2,
            wingLength: 5.35,
            wingWidth: 2.53,
            dish: 3,
        },
    },
    "mars-express": {
        mesh: {
            type: "bus",
            size: [1.5, 1.8, 1.4],
            wings: 2,
            wingLength: 5.3,
            wingWidth: 1.9,
            dish: 1.6,
        },
    },
    "mars-odyssey": {
        mesh: {
            type: "bus",
            size: [2.2, 1.7, 2.6],
            wings: 1,
            wingLength: 3.4,
            wingWidth: 2.1,
            dish: 1.3,
            boom: 6.2,
        },
    },
    tgo: {
        mesh: {
            type: "bus",
            size: [3.2, 2, 2],
            wings: 2,
            wingLength: 7.5,
            wingWidth: 2.2,
            dish: 2.2,
        },
    },
    hope: {
        mesh: {
            type: "bus",
            size: [2.4, 2.9, 2.4],
            wings: 2,
            wingLength: 2.5,
            wingWidth: 1.8,
            dish: 1.85,
        },
    },
    lro: {
        mesh: {
            type: "bus",
            size: [1.9, 1.9, 2.7],
            wings: 1,
            wingLength: 3.3,
            wingWidth: 2.4,
            dish: 0.75,
        },
    },
    "chandrayaan-2": {
        mesh: {
            type: "bus",
            size: [3.2, 2.2, 2.2],
            wings: 1,
            wingLength: 3,
            wingWidth: 2,
            dish: 1,
        },
    },
    danuri: {
        mesh: {
            type: "bus",
            size: [2.14, 1.82, 2.19],
            wings: 2,
            wingLength: 2.3,
            wingWidth: 1.2,
            dish: 2.6,
        },
    },
    "parker-solar-probe": {
        mesh: {
            type: "bus",
            size: [1, 1, 1.4],
            wings: 2,
            wingLength: 1.1,
            wingWidth: 0.6,
            shield: { shape: "disc", size: 2.3, thickness: 0.115 },
        },
    },
    "solar-orbiter": {
        mesh: {
            type: "bus",
            size: [2.5, 3.1, 2.7],
            wings: 2,
            wingLength: 6.5,
            wingWidth: 1.2,
            dish: 1.1,
            boom: 4.4,
            shield: { shape: "plate", size: 3.1, thickness: 0.3 },
        },
    },
};
