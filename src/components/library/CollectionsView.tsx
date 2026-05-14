/**
 * CollectionsView
 * 
 * Entry point for the Gallery Ecosystem.
 * Renders the GalleryHub which contains all discovery, saving,
 * and slideshow functionality.
 */

import React from 'react';
import { GalleryHub } from '../gallery/GalleryHub';

export const CollectionsView = () => {
  return <GalleryHub />;
};
