// Wellness Images - centralized image exports
// Simplified paths for Metro bundler compatibility

export const WELLNESS_IMAGES = {
  // Reflect/Meditation images
  sunset: require('../../assets/sunset.jpg'),

  // Restore/Spa images
  spa: require('../../assets/spa.jpg'),

  // Recharge/Gym images
  gym: require('../../assets/gym.jpg'),

  // Explore images
  explore: require('../../assets/explore.jpg'),

  // Dining images
  dining: require('../../assets/dining.jpg'),
};

// Export individual images for direct use
export const SUNSET_IMAGE = WELLNESS_IMAGES.sunset;
export const SPA_IMAGE = WELLNESS_IMAGES.spa;
export const GYM_IMAGE = WELLNESS_IMAGES.gym;
export const EXPLORE_IMAGE = WELLNESS_IMAGES.explore;
export const DINING_IMAGE = WELLNESS_IMAGES.dining;
