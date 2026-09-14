// Public review standing. `rating` is the platform's own figure; display it
// with one decimal (Yelp's 4.87 reads 4.9, matching how Yelp rounds).
export const reviews = {
  google: { platform: 'Google', rating: 4.9, count: 212 },
  yelp: { platform: 'Yelp', rating: 4.87, count: 49 },
  bbb: { platform: 'BBB', rating: 'A+' },
} as const
