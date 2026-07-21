import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Clock, Pin, Plus, RotateCcw, Sparkles, Trash2, X } from 'lucide-react';
import { getDb } from '../../services/db';
import { useGalleryStore } from '../../stores/useGalleryStore';
import { useSettingsStore, type ForYouQualityMode } from '../../stores/useSettingsStore';
import { useImageEngineStore } from '../useImageEngineStore';
import { getActiveForYouProfile, getProfileSuggestions } from '../forYouProfiles';
import { TagIntelligenceService, type UserInterest } from '../services/TagIntelligenceService';
import { ContentFilter } from '../../services/ContentFilter';

type TagBucket = 'core' | 'supporting' | 'excluded' | 'artist' | 'character' | 'series' | 'blocked';
type EditableBucket = Exclude<TagBucket, 'blocked'>;

const MODE_COPY: Record<ForYouQualityMode, { label: string; description: string }> = {
  broad: {
    label: 'Broad',
    description: 'Core tags are required. Secondary tags improve ranking but do not block discovery.',
  },
  strict: {
    label: 'Strict',
    description: 'An image must match at least one core tag and one secondary tag when secondary tags exist.',
  },
  themed: {
    label: 'Themed',
    description: 'Uses the selected theme with the same core-plus-secondary rule as Strict mode.',
  },
};

const bucketLabels: Record<EditableBucket, string> = {
  core: 'Core tags',
  supporting: 'Secondary tags',
  excluded: 'Excluded tags',
  artist: 'Artist tags',
  character: 'Character tags',
  series: 'Series tags',
};

export const InterestManager = ({ onClose }: { onClose: () => void }) => {
  const [interests, setInterests] = useState<UserInterest[]>([]);
  const [favoriteTags, setFavoriteTags] = useState<string[]>([]);
  const [inputValues, setInputValues] = useState<Record<TagBucket, string>>({
    core: '',
    supporting: '',
    excluded: '',
    artist: '',
    character: '',
    series: '',
    blocked: '',
  });
  const {
    blockedTags,
    blockTag,
    unblockTag,
    clearBlockedTags,
    clearViewHistory,
  } = useGalleryStore();
  const {
    forYouQualityMode,
    setForYouQualityMode,
    forYouProfiles,
    activeForYouProfileId,
    setActiveForYouProfile,
    addForYouProfileTag,
    removeForYouProfileTag,
    toggleForYouProfileRequiredTag,
    updateForYouProfile,
    showAdultContent,
    suppressedFavoriteSupportTags,
    suppressFavoriteSupportTag,
  } = useSettingsStore();

  const storedProfile = forYouProfiles.find(profile => profile.id === activeForYouProfileId);
  const activeProfile = storedProfile && (!storedProfile.adultOnly || showAdultContent)
    ? getActiveForYouProfile(storedProfile, showAdultContent)
    : undefined;
  const favoriteSupportTags = favoriteTags
    .map(tag => tag.trim().toLowerCase())
    .filter(tag => tag && !suppressedFavoriteSupportTags.includes(tag));
  const displayedProfile = activeProfile
    ? {
        ...activeProfile,
        supportingTags: Array.from(new Set([...activeProfile.supportingTags, ...favoriteSupportTags])),
      }
    : undefined;

  const refreshCurated = () => void useImageEngineStore.getState().fetchCurated(true);

  useEffect(() => {
    void TagIntelligenceService.getInterests().then(setInterests);
    void getDb().select<{ tag: string }[]>('SELECT tag FROM FavoriteTags').then(rows => setFavoriteTags(rows.map(row => row.tag)));
  }, []);

  useEffect(() => {
    if (storedProfile?.adultOnly && !showAdultContent) setActiveForYouProfile(null);
  }, [setActiveForYouProfile, showAdultContent, storedProfile]);

  const learnedSuggestions = useMemo(() => {
    const profileSuggestions = activeProfile
      ? getProfileSuggestions(activeProfile, showAdultContent)
      : [];
    const learned = interests.map(interest => interest.name);
    const used = new Set([
      ...(activeProfile?.coreTags || []),
      ...(activeProfile?.supportingTags || []),
      ...(activeProfile?.excludedTags || []),
    ]);
    return Array.from(new Set([...profileSuggestions, ...learned]))
      .filter(tag => showAdultContent || !ContentFilter.isAdultTag(tag))
      .filter(tag => !used.has(tag))
      .slice(0, 16);
  }, [activeProfile, interests, showAdultContent]);

  const selectProfile = (profileId: string | null) => {
    setActiveForYouProfile(profileId);
    refreshCurated();
  };

  const addTag = (bucket: TagBucket, rawTag = inputValues[bucket]) => {
    const typedPrefix = bucket === 'artist' || bucket === 'character' || bucket === 'series'
      ? `${bucket}:`
      : '';
    const tag = rawTag.trim().toLowerCase().replace(new RegExp(`^${typedPrefix}`), '');
    if (!tag) return;

    if (bucket === 'blocked') {
      void blockTag(tag);
    } else if (activeProfile) {
      addForYouProfileTag(activeProfile.id, bucket, tag);
    }

    setInputValues(previous => ({ ...previous, [bucket]: '' }));
    refreshCurated();
  };

  const removeTag = (bucket: EditableBucket, tag: string) => {
    if (!activeProfile) return;
    if (bucket === 'supporting' && favoriteSupportTags.includes(tag)) {
      suppressFavoriteSupportTag(tag);
    }
    removeForYouProfileTag(activeProfile.id, bucket, tag);
    refreshCurated();
  };

  const clearInterestSetup = async () => {
    if (!confirm('Clear learned interests and reset the Custom Theme tags?')) return;
    await getDb().execute('DELETE FROM UserInterests');
    const custom = forYouProfiles.find(profile => profile.id === 'custom');
    if (custom) {
      updateForYouProfile(custom.id, {
        coreTags: [],
        supportingTags: [],
        excludedTags: [],
        adultCoreTags: [],
        adultSupportingTags: [],
        adultExcludedTags: [],
      });
      setActiveForYouProfile(custom.id);
    } else {
      setActiveForYouProfile(null);
    }
    setInterests([]);
    refreshCurated();
  };

  const renderTagBucket = (bucket: EditableBucket, tags: string[]) => {
    const requiredKey = bucket === 'core'
      ? 'requiredCoreTags'
      : bucket === 'supporting'
        ? 'requiredSupportingTags'
        : bucket === 'artist'
          ? 'requiredArtistTags'
          : bucket === 'character'
            ? 'requiredCharacterTags'
            : bucket === 'series'
              ? 'requiredSeriesTags'
              : null;
    const requiredTags = requiredKey ? ((activeProfile?.[requiredKey] || []) as string[]) : [];

    return (
    <section className="border-t border-border-subtle pt-4" aria-labelledby={`${bucket}-tags-heading`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 id={`${bucket}-tags-heading`} className="text-sm font-semibold text-foreground">
            {bucketLabels[bucket]}
          </h3>
          <p className="mt-1 text-xs text-foreground-muted">
            {bucket === 'core'
              ? 'The subject must match at least one of these tags.'
              : bucket === 'supporting'
                ? forYouQualityMode === 'broad'
                  ? 'Optional in Broad mode; used to rank compatible results higher.'
                  : 'At least one must match alongside a core tag.'
                : bucket === 'excluded'
                  ? 'Results with any of these tags are removed.'
                  : 'Optional typed filters that boost matching results.'}
          </p>
        </div>
        <span className="text-[10px] font-medium uppercase tracking-wider text-foreground-muted">
          {tags.length} {tags.length === 1 ? 'tag' : 'tags'}
        </span>
      </div>

      <div className="mt-3 flex gap-2">
        <input
          value={inputValues[bucket]}
          onChange={event => setInputValues(previous => ({ ...previous, [bucket]: event.target.value }))}
          onKeyDown={event => { if (event.key === 'Enter') addTag(bucket); }}
          placeholder={`Add ${bucket === 'supporting' ? 'a secondary' : `an ${bucket}`} tag`}
          className="min-w-0 flex-1 rounded-md border border-border-subtle bg-black/20 px-3 py-2 text-sm outline-none focus:border-indigo-500"
        />
        <button
          type="button"
          onClick={() => addTag(bucket)}
          disabled={!activeProfile || !inputValues[bucket].trim()}
          className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-2 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus size={14} /> Add
        </button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {tags.length === 0 ? (
          <span className="text-xs italic text-foreground-muted">None added.</span>
        ) : tags.map(tag => (
          <span
            key={`${bucket}-${tag}`}
            className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs ${bucket === 'excluded' ? 'border-red-500/30 bg-red-500/10 text-red-300' : 'border-indigo-500/25 bg-indigo-500/10 text-indigo-200'}`}
          >
            {bucket !== 'excluded' && (
              <button
                type="button"
                onClick={() => {
                  if (activeProfile) {
                    toggleForYouProfileRequiredTag(activeProfile.id, bucket, tag);
                    refreshCurated();
                  }
                }}
                aria-pressed={requiredTags.includes(tag)}
                aria-label={`${requiredTags.includes(tag) ? 'Stop always matching' : 'Always match'} ${tag}`}
                title={requiredTags.includes(tag) ? 'Always match: on' : 'Always match this tag'}
                className={requiredTags.includes(tag) ? 'text-amber-300' : 'text-foreground-muted/60 hover:text-amber-300'}
              >
                <Pin size={12} className={requiredTags.includes(tag) ? 'fill-current' : ''} />
              </button>
            )}
            {tag}
            <button
              type="button"
              onClick={() => removeTag(bucket, tag)}
              aria-label={`Remove ${tag}`}
              title={`Remove ${tag}`}
              className="text-current opacity-70 hover:opacity-100"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>
    </section>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4 pt-8 backdrop-blur-sm sm:pt-16">
      <div className="w-full max-w-2xl overflow-hidden rounded-xl border border-border-subtle bg-background shadow-2xl">
        <header className="flex items-start justify-between gap-4 border-b border-border-subtle p-5">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Interest Manager</h2>
            <p className="mt-1 max-w-xl text-sm text-foreground-muted">
              Set the subject first, then refine it with compatible secondary tags.
            </p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close Interest Manager" title="Close" className="text-foreground-muted hover:text-foreground">
            <X size={22} />
          </button>
        </header>

        <div className="space-y-5 p-5">
          <section>
            <div className="flex items-center gap-2">
              <Sparkles size={16} className="text-indigo-400" />
              <h3 className="text-sm font-semibold text-foreground">Recommendation mode</h3>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="Recommendation mode">
              {(Object.keys(MODE_COPY) as ForYouQualityMode[]).map(mode => (
                <button
                  key={mode}
                  type="button"
                  onClick={() => { setForYouQualityMode(mode); refreshCurated(); }}
                  aria-pressed={forYouQualityMode === mode}
                  className={`rounded-md border px-2 py-2 text-sm font-semibold transition-colors ${forYouQualityMode === mode ? 'border-indigo-500 bg-indigo-600 text-white' : 'border-border-subtle bg-surface text-foreground-muted hover:text-foreground'}`}
                >
                  {MODE_COPY[mode].label}
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-foreground-muted">{MODE_COPY[forYouQualityMode].description}</p>
          </section>

          <section className="border-t border-border-subtle pt-4">
            <label htmlFor="interest-theme" className="text-sm font-semibold text-foreground">Theme</label>
            <select
              id="interest-theme"
              value={activeForYouProfileId || ''}
              onChange={event => selectProfile(event.target.value || null)}
              className="mt-2 w-full rounded-md border border-border-subtle bg-surface px-3 py-2 text-sm text-foreground outline-none focus:border-indigo-500"
            >
              <option value="">Automatic recommendations</option>
              {forYouProfiles
                .filter(profile => !profile.adultOnly || showAdultContent)
                .map(profile => <option key={profile.id} value={profile.id}>{profile.name}</option>)}
            </select>
            <p className="mt-2 text-xs text-foreground-muted">
              {activeProfile?.description || 'Choose Custom Theme to define your own core and secondary tags.'}
            </p>
            {storedProfile && (storedProfile.adultCoreTags?.length || storedProfile.adultSupportingTags?.length) ? (
              <p className="mt-2 text-xs text-amber-300/80">
                {showAdultContent ? 'Adult-only tags are active for this theme.' : 'Adult-only tags stay hidden while Adult Content is off.'}
              </p>
            ) : null}
          </section>

          {activeProfile ? (
            <>
              <section className="border-t border-border-subtle pt-4">
                <label htmlFor="sankaku-profile-tag" className="text-sm font-semibold text-foreground">Sankaku For You tag</label>
                <p className="mt-1 text-xs text-foreground-muted">Optional. Sankaku searches only this one tag; other sources continue using the full theme.</p>
                <div className="mt-3 flex gap-2">
                  <input
                    id="sankaku-profile-tag"
                    value={storedProfile?.sankakuTag || ''}
                    onChange={event => {
                      if (storedProfile) updateForYouProfile(storedProfile.id, { sankakuTag: event.target.value.trim().toLowerCase().replace(/\s+/g, '_') });
                    }}
                    onBlur={refreshCurated}
                    placeholder={showAdultContent ? 'Example: animated' : 'Example: landscape'}
                    className="min-w-0 flex-1 rounded-md border border-border-subtle bg-black/20 px-3 py-2 text-sm outline-none focus:border-indigo-500"
                  />
                </div>
              </section>
              {renderTagBucket('core', displayedProfile?.coreTags || [])}
              {renderTagBucket('supporting', displayedProfile?.supportingTags || [])}
              {renderTagBucket('excluded', displayedProfile?.excludedTags || [])}
              {renderTagBucket('artist', displayedProfile?.artistTags || [])}
              {renderTagBucket('character', displayedProfile?.characterTags || [])}
              {renderTagBucket('series', displayedProfile?.seriesTags || [])}

              {learnedSuggestions.length > 0 && (
                <section className="border-t border-border-subtle pt-4">
                  <h3 className="text-sm font-semibold text-foreground">Suggested refinements</h3>
                  <p className="mt-1 text-xs text-foreground-muted">Add a suggestion as a secondary tag when it fits your theme.</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {learnedSuggestions.map(tag => (
                      <button key={tag} type="button" onClick={() => addTag('supporting', tag)} className="inline-flex items-center gap-1 rounded-md border border-border-subtle bg-surface px-2 py-1 text-xs text-foreground-muted hover:text-foreground">
                        <Plus size={12} /> {tag}
                      </button>
                    ))}
                  </div>
                </section>
              )}
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border-subtle px-4 py-5 text-center text-sm text-foreground-muted">
              Select a theme to edit its core, secondary, and excluded tags.
            </div>
          )}

          <section className="border-t border-border-subtle pt-4">
            <h3 className="text-sm font-semibold text-foreground">Recommendation-wide exclusions</h3>
            <p className="mt-1 text-xs text-foreground-muted">These affect only For You recommendations. Manage app-wide exclusions under Settings → Sources.</p>
            <div className="mt-3 flex gap-2">
              <input
                value={inputValues.blocked}
                onChange={event => setInputValues(previous => ({ ...previous, blocked: event.target.value }))}
                onKeyDown={event => { if (event.key === 'Enter') addTag('blocked'); }}
                placeholder="Exclude from For You"
                className="min-w-0 flex-1 rounded-md border border-border-subtle bg-black/20 px-3 py-2 text-sm outline-none focus:border-red-500"
              />
              <button type="button" onClick={() => addTag('blocked')} disabled={!inputValues.blocked.trim()} className="inline-flex items-center gap-1 rounded-md bg-red-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40">
                <Plus size={14} /> Exclude
              </button>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {blockedTags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 rounded-md border border-red-500/30 bg-red-500/10 px-2 py-1 text-xs text-red-300">
                  {tag}
                  <button type="button" onClick={() => { void unblockTag(tag); refreshCurated(); }} aria-label={`Unblock ${tag}`} title={`Unblock ${tag}`}><X size={12} /></button>
                </span>
              ))}
              {blockedTags.length > 0 && <button type="button" onClick={() => { void clearBlockedTags(); refreshCurated(); }} className="text-xs text-red-300 underline">Clear blocked tags</button>}
            </div>
          </section>

          <section className="flex flex-col gap-3 border-t border-border-subtle pt-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-2">
              <Clock size={16} className="mt-0.5 text-indigo-400" />
              <div>
                <h3 className="text-sm font-semibold text-foreground">Browsing history</h3>
                <p className="mt-1 text-xs text-foreground-muted">History helps the automatic feed learn what you view.</p>
              </div>
            </div>
            <button type="button" onClick={() => { if (confirm('Clear browsing history?')) void clearViewHistory(); }} className="inline-flex items-center justify-center gap-2 rounded-md border border-red-500/30 px-3 py-2 text-xs font-semibold text-red-300 hover:bg-red-500/10">
              <Trash2 size={14} /> Clear history
            </button>
          </section>
        </div>

        <footer className="flex flex-col gap-3 border-t border-border-subtle bg-surface/30 p-5 sm:flex-row sm:items-center sm:justify-between">
          <button type="button" onClick={() => void clearInterestSetup()} className="inline-flex items-center justify-center gap-2 rounded-md border border-amber-500/30 px-3 py-2 text-xs font-semibold text-amber-300 hover:bg-amber-500/10">
            <RotateCcw size={14} /> Reset learned interests
          </button>
          <span className="text-xs text-foreground-muted">Changes apply to the next feed refresh.</span>
        </footer>
      </div>
    </div>,
    document.body,
  );
};
