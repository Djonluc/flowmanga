export type ForYouProfileTagType = 'core' | 'supporting' | 'excluded' | 'artist' | 'character' | 'series';

export interface ForYouProfile {
  id: string;
  name: string;
  description: string;
  /** Optional single catalog tag used only for Sankaku For You requests. */
  sankakuTag?: string;
  coreTags: string[];
  supportingTags: string[];
  excludedTags: string[];
  artistTags?: string[];
  characterTags?: string[];
  seriesTags?: string[];
  requiredCoreTags?: string[];
  requiredSupportingTags?: string[];
  requiredArtistTags?: string[];
  requiredCharacterTags?: string[];
  requiredSeriesTags?: string[];
  adultCoreTags?: string[];
  adultSupportingTags?: string[];
  adultExcludedTags?: string[];
  adultRequiredCoreTags?: string[];
  adultRequiredSupportingTags?: string[];
  adultRequiredArtistTags?: string[];
  adultRequiredCharacterTags?: string[];
  adultRequiredSeriesTags?: string[];
  adultOnly?: boolean;
  minCoreMatches: number;
}

const adultRelationshipTags = {
  maleMaleCore: ['gay_sex', 'yaoi_sex', 'bara_sex'],
  maleFemaleCore: ['hetero_sex', 'straight_sex'],
  inclusiveCore: ['bisexual', 'threesome'],
  support: ['adult', 'nsfw', 'explicit', 'nude', 'topless', 'underwear', 'lingerie', 'sex', 'oral', 'anal', 'penetration', 'masturbation', 'handjob', 'blowjob', 'sex_toy', 'bondage', 'dominance', 'submission'],
};

// These are editable starting points. They are intentionally tag-based so
// users can adjust them to match the vocabulary used by their sources.
export const DEFAULT_FOR_YOU_PROFILES: ForYouProfile[] = [
  {
    id: 'boy-love',
    name: 'Male/Male & Boy Love',
    description: 'Prioritizes male/male and related themes while filtering male/female results.',
    coreTags: ['gay', 'yaoi', 'bara', 'boy_love', 'male/male', 'm_m', 'homosexual', 'femboy', 'trap', 'crossdressing', 'transgender'],
    supportingTags: ['kissing', 'romance', 'interracial', 'blush', 'couple', 'hug', 'holding_hands', 'date'],
    excludedTags: ['hetero', 'straight', 'male/female', 'female/male', 'm_f', 'f_m'],
    adultCoreTags: adultRelationshipTags.maleMaleCore,
    adultSupportingTags: [...adultRelationshipTags.support, 'sissy'],
    adultExcludedTags: ['hetero_sex', 'straight_sex'],
    adultOnly: true,
    minCoreMatches: 1,
  },
  {
    id: 'lesbian',
    name: 'Female/Female & Lesbian',
    description: 'Prioritizes female/female, lesbian, yuri, and sapphic themes while filtering male/female results.',
    coreTags: ['lesbian', 'yuri', 'girls_love', 'girlslove', 'female/female', 'f_f', 'sapphic'],
    supportingTags: ['kissing', 'romance', 'interracial', 'dark_skin', 'skirt', 'dress', 'couple', 'hug', 'holding_hands', 'date'],
    excludedTags: ['hetero', 'straight', 'male/female', 'female/male', 'm_f', 'f_m'],
    adultCoreTags: ['lesbian_sex', 'yuri_sex'],
    adultSupportingTags: adultRelationshipTags.support,
    adultExcludedTags: ['hetero_sex', 'straight_sex'],
    adultOnly: true,
    minCoreMatches: 1,
  },
  {
    id: 'custom',
    name: 'Custom Theme',
    description: 'Start with a clean theme and add only the core, secondary, and excluded tags you want.',
    coreTags: [],
    supportingTags: [],
    excludedTags: [],
    minCoreMatches: 1,
  },
  {
    id: 'bi',
    name: 'Bi / Inclusive Relationships',
    description: 'Includes male/male and male/female themes, ranked by your supporting tags.',
    coreTags: ['gay', 'yaoi', 'bara', 'boy_love', 'male/male', 'm_m', 'hetero', 'straight', 'male/female', 'female/male', 'm_f', 'f_m', 'bisexual'],
    supportingTags: ['kissing', 'romance', 'interracial', 'femboy', 'crossdressing', 'transgender', 'couple', 'hug', 'threesome'],
    excludedTags: [],
    adultCoreTags: [...adultRelationshipTags.maleMaleCore, ...adultRelationshipTags.maleFemaleCore, ...adultRelationshipTags.inclusiveCore],
    adultSupportingTags: adultRelationshipTags.support,
    adultExcludedTags: [],
    adultOnly: true,
    minCoreMatches: 1,
  },
  {
    id: 'straight',
    name: 'Male/Female Relationships',
    description: 'Prioritizes male/female themes and filters male/male results by default.',
    coreTags: ['hetero', 'straight', 'male/female', 'female/male', 'm_f', 'f_m'],
    supportingTags: ['kissing', 'romance', 'interracial', 'couple', 'blush', 'hug', 'holding_hands', 'date'],
    excludedTags: ['gay', 'yaoi', 'bara', 'boy_love', 'male/male', 'm_m', 'homosexual'],
    adultCoreTags: adultRelationshipTags.maleFemaleCore,
    adultSupportingTags: adultRelationshipTags.support,
    adultExcludedTags: ['gay_sex', 'yaoi_sex', 'bara_sex'],
    adultOnly: true,
    minCoreMatches: 1,
  },
  {
    id: 'cars-motorsport',
    name: 'Cars & Motorsport',
    description: 'Cars, motorcycles, racing, drifting, garages, and automotive culture.',
    coreTags: ['car', 'automobile', 'vehicle', 'motorcycle', 'motorsport', 'racing', 'drift', 'formula_1', 'supercar'],
    supportingTags: ['road', 'highway', 'garage', 'mechanic', 'cityscape', 'night', 'sunset', 'speed', 'team', 'uniform'],
    excludedTags: [],
    minCoreMatches: 1,
  },
  {
    id: 'sports-athletics',
    name: 'Sports & Athletics',
    description: 'Sports, training, competition, teams, and athletic action.',
    coreTags: ['sports', 'athlete', 'soccer', 'football', 'basketball', 'baseball', 'tennis', 'volleyball', 'swimming', 'martial_arts', 'gymnastics', 'cycling', 'running'],
    supportingTags: ['stadium', 'competition', 'team', 'uniform', 'action', 'training', 'medal', 'crowd', 'coach'],
    excludedTags: [],
    minCoreMatches: 1,
  },
  {
    id: 'fantasy-castles',
    name: 'Fantasy & Castles',
    description: 'Fantasy worlds, castles, magic, knights, dragons, and adventure.',
    coreTags: ['fantasy', 'magic', 'wizard', 'witch', 'dragon', 'elf', 'castle', 'sword', 'armor', 'knight', 'fairy', 'mythology'],
    supportingTags: ['forest', 'ruins', 'landscape', 'adventure', 'royal', 'princess', 'king', 'queen', 'medieval', 'village'],
    excludedTags: [],
    minCoreMatches: 1,
  },
  {
    id: 'architecture-history',
    name: 'Architecture & History',
    description: 'Buildings, castles, cathedrals, palaces, historic places, and interiors.',
    coreTags: ['architecture', 'building', 'castle', 'cathedral', 'palace', 'cityscape', 'interior', 'ruins', 'bridge', 'historical'],
    supportingTags: ['gothic', 'landscape', 'night', 'sunset', 'street', 'library', 'museum', 'vintage', 'traditional'],
    excludedTags: [],
    minCoreMatches: 1,
  },
  {
    id: 'sci-fi-cyberpunk',
    name: 'Sci-Fi & Cyberpunk',
    description: 'Science fiction, cyberpunk cities, mecha, robots, and space.',
    coreTags: ['science_fiction', 'cyberpunk', 'mecha', 'robot', 'space', 'spaceship', 'android', 'futuristic', 'alien'],
    supportingTags: ['neon', 'cityscape', 'technology', 'night', 'hologram', 'weapon', 'laboratory', 'space_station', 'dystopia'],
    excludedTags: [],
    minCoreMatches: 1,
  },
  {
    id: 'nature-landscapes',
    name: 'Nature & Landscapes',
    description: 'Mountains, forests, oceans, skies, flowers, weather, and natural scenery.',
    coreTags: ['nature', 'landscape', 'mountain', 'forest', 'ocean', 'sunset', 'sky', 'flower', 'waterfall', 'snow', 'beach'],
    supportingTags: ['clouds', 'night', 'river', 'lake', 'rain', 'season', 'sunlight', 'wildlife', 'garden'],
    excludedTags: [],
    minCoreMatches: 1,
  },
  {
    id: 'fashion-cosplay',
    name: 'Fashion & Cosplay',
    description: 'Cosplay, clothing, uniforms, streetwear, costumes, and styling.',
    coreTags: ['fashion', 'cosplay', 'costume', 'dress', 'uniform', 'streetwear', 'kimono', 'suit', 'outfit'],
    supportingTags: ['portrait', 'makeup', 'hair', 'jewelry', 'runway', 'convention', 'photography', 'accessory'],
    excludedTags: [],
    minCoreMatches: 1,
  },
  {
    id: 'horror-gothic',
    name: 'Horror & Gothic',
    description: 'Horror, gothic atmosphere, monsters, ghosts, vampires, and the occult.',
    coreTags: ['horror', 'gothic', 'dark', 'monster', 'ghost', 'vampire', 'zombie', 'occult', 'haunted_house'],
    supportingTags: ['night', 'fog', 'ruins', 'red_eyes', 'skeleton', 'graveyard', 'moon', 'blood', 'shadow'],
    excludedTags: [],
    minCoreMatches: 1,
  },
  {
    id: 'romance',
    name: 'Romance & Affection',
    description: 'Romantic connection, affection, dates, couples, and emotional scenes.',
    coreTags: ['romance', 'kissing', 'couple', 'date', 'holding_hands', 'hug', 'love', 'heart'],
    supportingTags: ['blush', 'wedding', 'interracial', 'sunset', 'flower', 'letter', 'cafe', 'bedroom'],
    excludedTags: [],
    adultSupportingTags: ['adult', 'nsfw', 'nude', 'topless', 'underwear', 'lingerie', 'sex', 'oral', 'anal', 'penetration', 'sex_toy', 'bondage'],
    minCoreMatches: 1,
  },
  {
    id: 'adult-explicit',
    name: 'Explicit Adult',
    description: 'Adult-only theme for explicit content. It stays unavailable until Adult Content is enabled.',
    coreTags: [],
    supportingTags: [],
    excludedTags: [],
    adultCoreTags: ['adult', 'nsfw', 'explicit', 'sex'],
    adultSupportingTags: ['nude', 'topless', 'underwear', 'lingerie', 'oral', 'anal', 'penetration', 'masturbation', 'handjob', 'blowjob', 'sex_toy', 'bondage', 'dominance', 'submission'],
    adultOnly: true,
    minCoreMatches: 1,
  },
];

export function getActiveForYouProfile(profile: ForYouProfile, showAdultContent: boolean): ForYouProfile {
  if (!showAdultContent) return profile;
  return {
    ...profile,
    coreTags: Array.from(new Set([...profile.coreTags, ...(profile.adultCoreTags || [])])),
    supportingTags: Array.from(new Set([...profile.supportingTags, ...(profile.adultSupportingTags || [])])),
    excludedTags: Array.from(new Set([...profile.excludedTags, ...(profile.adultExcludedTags || [])])),
    requiredCoreTags: Array.from(new Set([...(profile.requiredCoreTags || []), ...(profile.adultRequiredCoreTags || [])])),
    requiredSupportingTags: Array.from(new Set([...(profile.requiredSupportingTags || []), ...(profile.adultRequiredSupportingTags || [])])),
    requiredArtistTags: Array.from(new Set([...(profile.requiredArtistTags || []), ...(profile.adultRequiredArtistTags || [])])),
    requiredCharacterTags: Array.from(new Set([...(profile.requiredCharacterTags || []), ...(profile.adultRequiredCharacterTags || [])])),
    requiredSeriesTags: Array.from(new Set([...(profile.requiredSeriesTags || []), ...(profile.adultRequiredSeriesTags || [])])),
  };
}

export const getProfileSuggestions = (profile: ForYouProfile, showAdultContent: boolean): string[] => {
  const active = getActiveForYouProfile(profile, showAdultContent);
  return Array.from(new Set(active.supportingTags)).filter(tag => !active.coreTags.includes(tag));
};
