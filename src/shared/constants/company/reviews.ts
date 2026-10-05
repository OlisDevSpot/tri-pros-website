// Public review standing. `rating` is the platform's own figure; display it
// with one decimal (Yelp's 4.87 reads 4.9, matching how Yelp rounds).
export const reviews = {
  google: { platform: 'Google', rating: 4.9, count: 212, url: 'https://www.google.com/search?q=Tri%20Pros%20Remodeling' },
  yelp: { platform: 'Yelp', rating: 4.87, count: 49, url: 'https://www.yelp.com/biz/tri-pros-remodeling-los-angeles?osq=Tri+Pros+Remodeling' },
  bbb: { platform: 'BBB', rating: 'A+', url: 'https://www.bbb.org/us/ca/los-angeles/profile/remodel-contractors/tri-pros-remodeling-inc-1216-1000023827/customer-reviews' },
} as const
