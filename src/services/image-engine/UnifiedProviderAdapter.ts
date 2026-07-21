import type { ImageProvider, PlatformImage } from '../../image-platform/types';
import type { AutocompleteResult, EngineSearchOptions, ImageMedia, LegacyImageProvider, SourceCapabilities, StructuredQuery } from './types';

export function mapPlatformImageToLegacyMedia(image: PlatformImage): ImageMedia {
  return {
    id: image.id, sourceId: image.sourceId, providerId: image.providerId,
    title: image.title || `Image ${image.sourceId}`,
    thumbnailUrl: image.thumbnailUrl, previewUrl: image.previewUrl || image.thumbnailUrl,
    sampleUrl: image.sampleUrl, fullUrl: image.fullUrl, mediaStatus: image.mediaStatus,
    width: image.width, height: image.height, tags: image.tags || [],
    artistTags: image.artistTags || [], characterTags: image.characterTags || [],
    copyrightTags: image.copyrightTags || [], metaTags: image.metaTags || [], generalTags: image.generalTags || [],
    rating: image.rating, score: image.score, createdAt: new Date(image.createdAt || Date.now()).toISOString(),
    mediaType: image.mediaType || 'image', contentCategory: image.relatedGroupId ? 'gallery' : 'image',
    sourceUrl: image.sourceUrl || '', relatedGroupId: image.relatedGroupId, relatedIndex: image.relatedIndex,
    parentId: image.parentId, poolIds: image.poolIds, bookIds: image.bookIds, sequence: image.sequence,
    isPremium: image.isPremium, redirectToSignup: image.redirectToSignup, hasChildren: image.hasChildren,
    fileType: image.fileType, fileSize: image.fileSize, videoDuration: image.videoDuration,
    source: image.source, author: image.author,
  };
}

export class UnifiedProviderAdapter implements LegacyImageProvider {
  readonly id: string;
  readonly name: string;
  readonly baseUrl: string;
  readonly capabilities: SourceCapabilities;

  constructor(private readonly provider: ImageProvider) {
    this.id = provider.id;
    this.name = provider.name;
    this.baseUrl = provider.domains?.[0] ? `https://${provider.domains[0]}` : '';
    const status = provider.capabilities.status;
    this.capabilities = {
      supportsNegativeTags: provider.capabilities.supportsNegative,
      maxTagsPerRequest: provider.capabilities.maxTags,
      supportsSort: true,
      supportsScore: provider.capabilities.supportsScore,
      nativeRecommendations: false,
      status: status === 'operational' ? 'working' : status as SourceCapabilities['status'] || 'working',
      authentication: provider.capabilities.authentication,
      requiresCookies: provider.capabilities.requiresCookies,
      authUrl: provider.capabilities.authUrl,
    };
  }

  async search(query: StructuredQuery, options: EngineSearchOptions): Promise<ImageMedia[]> {
    return (await this.provider.search({
      raw: query.raw,
      positiveTags: query.positiveTags,
      negativeTags: query.negativeTags,
      predicates: query.targetSource ? { source: query.targetSource } : {},
    }, options.page || 1)).map(mapPlatformImageToLegacyMedia);
  }

  async getDiscovery(options: EngineSearchOptions): Promise<ImageMedia[]> {
    return (await this.provider.getDiscovery(options.page || 1)).map(mapPlatformImageToLegacyMedia);
  }

  async getLatest(options: EngineSearchOptions): Promise<ImageMedia[]> {
    return (await this.provider.getLatest(options.page || 1)).map(mapPlatformImageToLegacyMedia);
  }

  async getRecommendations(): Promise<ImageMedia[]> { return []; }

  async autocomplete(tag: string): Promise<AutocompleteResult[]> {
    const suggestions = await this.provider.autocompleteTags?.(tag) || [];
    return suggestions.map(suggestion => ({ tag: suggestion, postCount: 0, category: 'general', source: this.id }));
  }
}
