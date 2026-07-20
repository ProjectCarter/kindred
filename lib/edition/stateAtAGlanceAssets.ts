/**
 * Approved editorial symbol assets for State at a Glance image spreads.
 * Add states here as verified photographs are approved — text facts live separately.
 */

type StateSymbolImage = {
  url: string;
  caption: string;
  credit: string;
  sourceUrl: string;
  license: string;
};

type StateAtAGlanceSymbol = {
  emoji: string;
  label: string;
  name: string;
  image: StateSymbolImage;
};

export type StateSymbolAssets = {
  capitol?: StateAtAGlanceSymbol | null;
  symbols?: {
    flag?: StateAtAGlanceSymbol | null;
    bird?: StateAtAGlanceSymbol | null;
    tree?: StateAtAGlanceSymbol | null;
    flower?: StateAtAGlanceSymbol | null;
  };
};

/** Arizona — Arizona Revised Statutes (state symbols). */
const ARIZONA_SYMBOLS: StateSymbolAssets = {
  capitol: {
    emoji: "🏛️",
    label: "State Capitol",
    name: "Arizona State Capitol",
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6d/Arizona_State_Capitol%2C_Washington_Street_and_17th_Avenue%2C_Phoenix%2C_AZ.jpg/500px-Arizona_State_Capitol%2C_Washington_Street_and_17th_Avenue%2C_Phoenix%2C_AZ.jpg",
      caption: "Arizona State Capitol",
      credit: "Photo: w_lemay / Wikimedia Commons (CC BY-SA 2.0)",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Arizona_State_Capitol,_Washington_Street_and_17th_Avenue,_Phoenix,_AZ.jpg",
      license: "CC BY-SA 2.0",
    },
  },
  symbols: {
    flag: {
      emoji: "🏳️",
      label: "State Flag",
      name: "Arizona State Flag",
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9d/Flag_of_Arizona.svg/500px-Flag_of_Arizona.svg.png",
        caption: "Arizona State Flag",
        credit: "Public domain — Wikimedia Commons",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Flag_of_Arizona.svg",
        license: "public_domain",
      },
    },
    bird: {
      emoji: "🐦",
      label: "State Bird",
      name: "Cactus Wren",
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/Campylorhynchus_brunneicapillus_20061226.jpg/500px-Campylorhynchus_brunneicapillus_20061226.jpg",
        caption: "Cactus Wren",
        credit: "Photo: Mark Wagner / Wikimedia Commons (CC BY 2.5)",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Campylorhynchus_brunneicapillus_20061226.jpg",
        license: "CC BY 2.5",
      },
    },
    tree: {
      emoji: "🌳",
      label: "State Tree",
      name: "Palo Verde",
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f5/Cercidium_floridum_whole.jpg/500px-Cercidium_floridum_whole.jpg",
        caption: "Palo Verde",
        credit: "Photo: Stan Shebs / Wikimedia Commons (CC BY-SA 3.0)",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Cercidium_floridum_whole.jpg",
        license: "CC BY-SA 3.0",
      },
    },
    flower: {
      emoji: "🌸",
      label: "State Flower",
      name: "Saguaro Blossom",
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/f/f1/Carnegiea_gigantea_%28Saguaro_cactus%29_blossoms.jpg/500px-Carnegiea_gigantea_%28Saguaro_cactus%29_blossoms.jpg",
        caption: "Saguaro Blossom",
        credit: "Photo: Ken Bosma / Wikimedia Commons (CC BY 2.0)",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Carnegiea_gigantea_(Saguaro_cactus)_blossoms.jpg",
        license: "CC BY 2.0",
      },
    },
  },
};

/** Washington — leg.wa.gov state symbols. */
const WASHINGTON_SYMBOLS: StateSymbolAssets = {
  capitol: {
    emoji: "🏛️",
    label: "State Capitol",
    name: "Washington State Capitol",
    image: {
      url: "https://upload.wikimedia.org/wikipedia/commons/thumb/3/36/Washington_State_Capitol_Building_%282025%29_-_0364.jpg/500px-Washington_State_Capitol_Building_%282025%29_-_0364.jpg",
      caption: "Washington State Capitol",
      credit: "Photo: Roc0ast3r / Wikimedia Commons (CC0)",
      sourceUrl:
        "https://commons.wikimedia.org/wiki/File:Washington_State_Capitol_Building_(2025)_-_0364.jpg",
      license: "CC0",
    },
  },
  symbols: {
    flag: {
      emoji: "🏳️",
      label: "State Flag",
      name: "Washington State Flag",
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/Flag_of_Washington.svg/500px-Flag_of_Washington.svg.png",
        caption: "Washington State Flag",
        credit: "Public domain — Wikimedia Commons",
        sourceUrl: "https://commons.wikimedia.org/wiki/File:Flag_of_Washington.svg",
        license: "public_domain",
      },
    },
    bird: {
      emoji: "🐦",
      label: "State Bird",
      name: "Willow Goldfinch",
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/6/6a/American_goldfinch_at_Seedskadee_National_Wildlife_Refuge_%2852944831387%29.jpg/500px-American_goldfinch_at_Seedskadee_National_Wildlife_Refuge_%2852944831387%29.jpg",
        caption: "Willow Goldfinch",
        credit:
          "Photo: U.S. Fish & Wildlife Service / Wikimedia Commons (public domain)",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:American_goldfinch_at_Seedskadee_National_Wildlife_Refuge_(52944831387).jpg",
        license: "public_domain",
      },
    },
    tree: {
      emoji: "🌳",
      label: "State Tree",
      name: "Western Hemlock",
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/5/57/Tsuga_heterophylla1.jpg/500px-Tsuga_heterophylla1.jpg",
        caption: "Western Hemlock",
        credit: "Photo: MPF / Wikimedia Commons (CC BY-SA 4.0)",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Tsuga_heterophylla1.jpg",
        license: "CC BY-SA 4.0",
      },
    },
    flower: {
      emoji: "🌸",
      label: "State Flower",
      name: "Coast Rhododendron",
      image: {
        url: "https://upload.wikimedia.org/wikipedia/commons/thumb/9/9a/Rhododendron_macrophyllum_biscuit_june_2005.jpg/500px-Rhododendron_macrophyllum_biscuit_june_2005.jpg",
        caption: "Coast Rhododendron",
        credit: "Photo: Robert Dunning / Wikimedia Commons (CC BY-SA 3.0)",
        sourceUrl:
          "https://commons.wikimedia.org/wiki/File:Rhododendron_macrophyllum_biscuit_june_2005.jpg",
        license: "CC BY-SA 3.0",
      },
    },
  },
};

export const STATE_SYMBOL_ASSETS: Record<string, StateSymbolAssets> = {
  AZ: ARIZONA_SYMBOLS,
  WA: WASHINGTON_SYMBOLS,
};
