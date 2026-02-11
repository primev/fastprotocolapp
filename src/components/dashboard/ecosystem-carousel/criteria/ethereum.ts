import type { EcosystemSet } from "./types"

const CHAIN_ETH = 1
const ASSETS_URL = process.env.NEXT_PUBLIC_R2_BASE_URL

const AZUKI_IMG = `${ASSETS_URL}/nfts/azuki.jpg`
const DOODLES_IMG = `${ASSETS_URL}/nfts/doodles.jpg`
const MOONBIRDS_IMG = `${ASSETS_URL}/nfts/moonbirds.jpg`
const PUDGY_PENGUINS_IMG = `${ASSETS_URL}/nfts/pudgy-penguins.jpg`
const YUGA_LABS_IMG = `${ASSETS_URL}/nfts/yuga-labs.jpg`

export const ethereumSets: readonly EcosystemSet[] = [
  {
    id: "pudgy",
    name: "Pudgy\nPenguins",
    img: PUDGY_PENGUINS_IMG,
    chainId: CHAIN_ETH,
    contracts: [
      {
        address: "0xbd3531da5cf5857e7cfaa92426877b022e612cf8",
        chainId: CHAIN_ETH,
        label: "Pudgy Penguins",
      },
      {
        address: "0x524cab2ec69124574082676e6f654a18df49a048",
        chainId: CHAIN_ETH,
        label: "Lil Pudgys",
      },
      {
        address: "0x062e691c2054de82f28008a8ccc6d7a1c8ce060d",
        chainId: CHAIN_ETH,
        label: "Pudgy Rods",
      },
    ],
    criteriaStatement: "Hold a balance in any of the following collections.",
    criteriaLinks: [
      { label: "Pudgy Penguins", url: "https://opensea.io/collection/pudgypenguins" },
      { label: "Lil Pudgys", url: "https://opensea.io/collection/lilpudgys" },
      { label: "Pudgy Rods", url: "https://opensea.io/collection/pudgyrods" },
    ],
    createdAt: 1770051639,
  },
  {
    id: "moonbirds",
    name: "Moonbirds",
    img: MOONBIRDS_IMG,
    chainId: CHAIN_ETH,
    contracts: [
      {
        address: "0x23581767a106ae21c074b2276d25e5c3e136a68b",
        chainId: CHAIN_ETH,
        label: "Moonbirds",
      },
      {
        address: "0x1792a96e5668ad7c167ab804a100ce42395ce54d",
        chainId: CHAIN_ETH,
        label: "Moonbirds Oddities",
      },
      {
        address: "0xc0ffee8ff7e5497c2d6f7684859709225fcc5be8",
        chainId: CHAIN_ETH,
        label: "Moonbirds Mythics",
      },
    ],
    criteriaStatement: "Hold a balance in any of the following collections.",
    criteriaLinks: [
      { label: "Moonbirds", url: "https://opensea.io/collection/proof-moonbirds" },
      { label: "Moonbirds Oddities", url: "https://opensea.io/collection/moonbirds-oddities" },
      { label: "Moonbirds Mythics", url: "https://opensea.io/collection/moonbirds-mythics" },
    ],
    createdAt: 1770051639,
  },
  {
    id: "azuki",
    name: "Azuki",
    img: AZUKI_IMG,
    chainId: CHAIN_ETH,
    contracts: [
      {
        address: "0xed5af388653567af2f388e6224dc7c4b3241c544",
        chainId: CHAIN_ETH,
        label: "Azuki (primary)",
      },
      {
        address: "0x306b1ea3ecdf94ab739f1910bbda052ed4a9f949",
        chainId: CHAIN_ETH,
        label: "BEANZ Official",
      },
      {
        address: "0xb6a37b5d14d502c3ab0ae6f3a0e058bc9517786e",
        chainId: CHAIN_ETH,
        label: "Azuki Elementals",
      },
    ],
    criteriaStatement: "Hold a balance in any of the following collections.",
    criteriaLinks: [
      { label: "Azuki", url: "https://opensea.io/collection/azuki" },
      { label: "BEANZ Official", url: "https://opensea.io/collection/beanzofficial" },
      { label: "Azuki Elementals", url: "https://opensea.io/collection/azukielementals" },
    ],
    createdAt: 1770051639,
  },
  {
    id: "yuga",
    name: "Yuga Labs",
    img: YUGA_LABS_IMG,
    chainId: CHAIN_ETH,
    contracts: [
      { address: "0xbc4ca0eda7647a8ab7c2061c2e118a18a936f13d", chainId: CHAIN_ETH, label: "BAYC" },
      { address: "0x60e4d786628fea6478f785a6d7e704777c86a7c6", chainId: CHAIN_ETH, label: "MAYC" },
      { address: "0xba30e5f9bb24caa003e9f2f0497ad287fdf95623", chainId: CHAIN_ETH, label: "BAKC" },
      {
        address: "0x34d85c9cdeb23fa97cb08333b511ac86e1c4e258",
        chainId: CHAIN_ETH,
        label: "Otherdeed",
      },
      {
        address: "0xb47e3cd837ddf8e4c57f05d70ab865de6e193bbb",
        chainId: CHAIN_ETH,
        label: "CryptoPunks",
      },
      {
        address: "0x7bd29408f11d2bfc23c34f18275bbf23bb716bc7",
        chainId: CHAIN_ETH,
        label: "Meebits",
      },
    ],
    criteriaStatement: "Hold a balance in any of the following collections.",
    criteriaLinks: [
      { label: "BAYC", url: "https://opensea.io/collection/boredapeyachtclub" },
      { label: "MAYC", url: "https://opensea.io/collection/mutant-ape-yacht-club" },
      { label: "BAKC", url: "https://opensea.io/collection/bored-ape-kennel-club" },
      { label: "Otherdeed", url: "https://opensea.io/collection/otherdeed" },
      { label: "CryptoPunks", url: "https://opensea.io/collection/cryptopunks" },
      { label: "Meebits", url: "https://opensea.io/collection/meebits" },
    ],
    createdAt: 1770051639,
  },
  {
    id: "doodles",
    name: "Doodles",
    img: DOODLES_IMG,
    chainId: CHAIN_ETH,
    contracts: [
      {
        address: "0x8a90cab2b38dba80c64b7734e58ee1db38b8992e",
        chainId: CHAIN_ETH,
        label: "Doodles",
      },
      {
        address: "0x89afdbf071050a67cfdc28b2ccb4277eef598f37",
        chainId: CHAIN_ETH,
        label: "Space Doodles",
      },
      {
        address: "0x466cfcd0525189b573e794f554b8a751279213ac",
        chainId: CHAIN_ETH,
        label: "The Dooplicator",
      },
    ],
    criteriaStatement: "Hold a balance in any of the following collections.",
    criteriaLinks: [
      { label: "Doodles", url: "https://opensea.io/collection/doodles-official" },
      { label: "Space Doodles", url: "https://opensea.io/collection/space-doodles" },
      { label: "The Dooplicator", url: "https://opensea.io/collection/dooplicator" },
    ],
    createdAt: 1770051639,
  },
]
