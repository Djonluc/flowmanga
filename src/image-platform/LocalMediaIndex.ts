const LOCAL_MEDIA_PROVIDER_PREFIXES = [
  'sankaku-books',
  'e-hentai',
  'danbooru',
  'gelbooru',
  'rule34',
  'sankaku',
  'konachan',
  'zerochan',
  'nekos',
];

export const parseLocalMediaIdentity = (fileName: string, normalizedPath: string) => {
  const stem = fileName.replace(/\.[^.]+$/, '');
  const lowerStem = stem.toLowerCase();
  const providerId = LOCAL_MEDIA_PROVIDER_PREFIXES.find(candidate => lowerStem.startsWith(`${candidate}-`)) || 'local';
  return {
    stem,
    providerId,
    sourceId: providerId === 'local' ? normalizedPath : stem.slice(providerId.length + 1),
  };
};
