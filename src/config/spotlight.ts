export interface SpotlightSeries {
    id: string;
    seriesUrl: string;
    title: string;
    coverUrl: string;
    source: string;
    external: boolean;
}

export const SPOTLIGHT_SERIES: SpotlightSeries[] = [
    {
        id: "blue-lock-manga",
        seriesUrl: "https://w45.blue-lock-manga.com/",
        title: "Blue Lock",
        coverUrl: "https://w45.blue-lock-manga.com/wp-content/uploads/2022/10/Blue-Lock-Manga-1.webp",
        source: "blue-lock-manga.com",
        external: true
    },
    {
        id: "dbm-manga",
        seriesUrl: "https://www.dragonball-multiverse.com/en/chapters.html?comic=page",
        title: "Dragon Ball Multiverse",
        coverUrl: "https://www.dragonball-multiverse.com/image.php?idp=1000000&lg=en&ext=jpg&pw=6169c76413f09341627904f063c34d87",
        source: "dragonball-multiverse.com",
        external: true
    }
];
